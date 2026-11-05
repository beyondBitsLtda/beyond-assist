// O terminal da IDE livre (05/11/2026): um shell de verdade sobre o sistema de arquivos do projeto (./ide.js).
//
// Entende aspas, variáveis ($HOME, $USER, as que a pessoa exportar), curingas (*.js), redirecionamentos (>, >>, <),
// encadeamento (|, &&, ||, ;) e os comandos de sempre (ls, cd, mkdir, cat, grep, find, tree, rm, mv, cp, head, tail,
// wc, sort, uniq, echo...). Os PROGRAMAS (node, python, gcc, java, sqlite3, lua...) não rodam aqui: o shell monta o
// pedido e chama `ctx.rodar(pedido)`, que a tela liga aos executores (src/componentes/ide/executores.js). Assim
// este arquivo fica puro e testado em scripts/dominio-check.mjs, com um `rodar` de mentira.
//
// executarLinha(linha, estado, ctx) → { estado, saida, erro, status, efeitos }
//   estado:  { projeto, cwd, env, historico }
//   efeitos: [{ tipo: "limpar" | "abrir" | "previa" | "repl" | "historico-limpo", ... }] — o que a tela faz depois

import {
  IDE, normalizarCaminho, ehArquivo, ehPasta, existe, listar, escrever, criarPasta, remover, mover, copiar, arvore,
  caminhoParaMostrar, nomeDe, pastaDe, linguagemDoArquivo, extensaoDe, todasAsPastas, leEntrada,
} from "./ide.js";

export const USUARIO_DO_TERMINAL = "aluno";
export const ESTADO_INICIAL = (projeto) => ({
  projeto, cwd: "/", historico: [],
  env: { USER: USUARIO_DO_TERMINAL, HOME: "~", SHELL: "/bin/proof", LANG: "pt_BR.UTF-8", TERM: "proof-256color", PATH: "/usr/local/bin:/usr/bin:/bin" },
});

/** O prompt: aluno@proof:~/src$ */
export const promptDe = (estado) => `${USUARIO_DO_TERMINAL}@proof:${caminhoParaMostrar(estado.cwd)}$`;

// ------------------------------------------------------------------ separar a linha

const OPERADORES = ["&&", "||", ">>", "2>&1", "2>", "|", ">", "<", ";"];

/**
 * A linha em pedaços: palavras (com as aspas resolvidas e as variáveis trocadas) e operadores.
 * `curinga` marca a palavra que tinha * ou ? fora das aspas (o shell expande depois, olhando as pastas).
 */
export function tokenizar(linha, env = {}) {
  const t = String(linha ?? "");
  const tokens = [];
  let atual = "", temPalavra = false, curinga = false, i = 0;
  const fechar = () => { if (temPalavra) tokens.push({ tipo: "palavra", valor: atual, curinga }); atual = ""; temPalavra = false; curinga = false; };
  const variavel = () => {
    // $NOME, ${NOME}, $? fica literal (o shell não guarda o último status aqui)
    if (t[i + 1] === "{") {
      const fim = t.indexOf("}", i + 2);
      if (fim > 0) { const nome = t.slice(i + 2, fim); i = fim + 1; return env[nome] ?? ""; }
    }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(t.slice(i + 1));
    if (m) { i += 1 + m[0].length; return env[m[0]] ?? ""; }
    i++;
    return "$";
  };
  while (i < t.length) {
    const c = t[i];
    if (c === "#" && !temPalavra) break; // comentário
    if (/\s/.test(c)) { fechar(); i++; continue; }
    const op = OPERADORES.find((o) => t.startsWith(o, i));
    if (op && !(op === "2>" && temPalavra) && !(op === "2>&1" && temPalavra)) { fechar(); tokens.push({ tipo: "op", valor: op }); i += op.length; continue; }
    if (c === "'") {
      const fim = t.indexOf("'", i + 1);
      if (fim < 0) throw erroDoShell("aspas simples sem fechar");
      atual += t.slice(i + 1, fim); temPalavra = true; i = fim + 1; continue;
    }
    if (c === "\"") {
      i++; temPalavra = true;
      let fechou = false;
      while (i < t.length) {
        if (t[i] === "\\" && i + 1 < t.length && "\"\\$`".includes(t[i + 1])) { atual += t[i + 1]; i += 2; continue; }
        if (t[i] === "\"") { i++; fechou = true; break; }
        if (t[i] === "$") { atual += variavel(); continue; }
        atual += t[i++];
      }
      if (!fechou) throw erroDoShell("aspas duplas sem fechar");
      continue;
    }
    if (c === "\\" && i + 1 < t.length) { atual += t[i + 1]; temPalavra = true; i += 2; continue; }
    if (c === "$") { atual += variavel(); temPalavra = true; continue; }
    if (c === "~" && !temPalavra && (i + 1 === t.length || /[\s/]/.test(t[i + 1]))) { atual += "~"; temPalavra = true; i++; continue; }
    if (c === "*" || c === "?") curinga = true;
    atual += c; temPalavra = true; i++;
  }
  fechar();
  return tokens;
}

/** Os tokens em comandos: [{ conector, pipeline: [{ argv, entrada, saida, acrescentar, erroParaSaida }] }]. */
export function analisar(tokens) {
  const sequencia = [];
  let pipeline = [], cmd = novoComando(), conector = null;
  const fecharComando = () => {
    if (!cmd.argv.length && (cmd.entrada || cmd.saida)) throw erroDoShell("redirecionamento sem comando");
    if (cmd.argv.length) pipeline.push(cmd);
    cmd = novoComando();
  };
  const fecharPipeline = (proximo) => {
    fecharComando();
    if (pipeline.length) sequencia.push({ conector, pipeline });
    else if (proximo && proximo !== ";") throw erroDoShell(`erro de sintaxe perto de "${proximo}"`);
    pipeline = []; conector = proximo;
  };
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk.tipo === "palavra") { cmd.argv.push(tk); continue; }
    if (tk.valor === "|") { if (!cmd.argv.length) throw erroDoShell("erro de sintaxe perto de \"|\""); fecharComando(); continue; }
    if (tk.valor === "&&" || tk.valor === "||" || tk.valor === ";") { fecharPipeline(tk.valor); continue; }
    if (tk.valor === "2>&1") { cmd.erroParaSaida = true; continue; }
    const alvo = tokens[i + 1];
    if (!alvo || alvo.tipo !== "palavra") throw erroDoShell(`faltou o arquivo depois de "${tk.valor}"`);
    i++;
    if (tk.valor === "<") cmd.entrada = alvo.valor;
    else if (tk.valor === "2>") cmd.erroEm = alvo.valor;
    else { cmd.saida = alvo.valor; cmd.acrescentar = tk.valor === ">>"; }
  }
  fecharPipeline(null);
  return sequencia;
}
const novoComando = () => ({ argv: [], entrada: null, saida: null, acrescentar: false, erroParaSaida: false, erroEm: null });

function erroDoShell(mensagem) { const e = new Error(mensagem); e.doTerminal = true; return e; }

// ------------------------------------------------------------------ curingas

const reDoCuringa = (padrao) => new RegExp("^" + padrao.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]") + "$");

/** "*.js" → os arquivos que casam, na pasta do padrão (sem casar nada, fica a palavra como veio). */
export function expandirCuringa(projeto, cwd, palavra) {
  const abs = normalizarCaminho(cwd, palavra);
  const pasta = pastaDe(abs);
  const padrao = nomeDe(abs);
  if (!/[*?]/.test(padrao) || /[*?]/.test(pasta)) return [palavra];
  const re = reDoCuringa(padrao);
  const achados = listar(projeto, pasta).filter((f) => re.test(f.nome) && (padrao.startsWith(".") || !f.nome.startsWith(".")));
  if (!achados.length) return [palavra];
  const relativo = !palavra.startsWith("/") && !palavra.startsWith("~");
  const prefixo = palavra.includes("/") ? palavra.slice(0, palavra.lastIndexOf("/") + 1) : "";
  return achados.map((f) => (relativo ? prefixo + f.nome : f.caminho));
}

// ------------------------------------------------------------------ os comandos de dentro

const ok = (saida = "") => ({ saida, erro: "", status: 0 });
const falha = (erro, status = 1) => ({ saida: "", erro: erro.endsWith("\n") ? erro : erro + "\n", status });
const linhas = (texto) => { const l = String(texto ?? "").split("\n"); if (l[l.length - 1] === "") l.pop(); return l; };
const juntar = (ls) => (ls.length ? ls.join("\n") + "\n" : "");

/** Separa as opções curtas (-la, -n 5) dos argumentos. `comValor`: as opções que levam um valor depois. */
function opcoes(args, comValor = []) {
  const o = {}, resto = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") { resto.push(...args.slice(i + 1)); break; }
    if (/^-\d+$/.test(a)) { o.n = a.slice(1); continue; }
    if (a.startsWith("--") && a.length > 2) { const [k, v] = a.slice(2).split("="); o[k] = v ?? true; continue; }
    if (a.startsWith("-") && a.length > 1) {
      const letras = a.slice(1);
      for (let j = 0; j < letras.length; j++) {
        const l = letras[j];
        if (comValor.includes(l)) { o[l] = letras.slice(j + 1) || args[++i]; break; }
        o[l] = true;
      }
      continue;
    }
    resto.push(a);
  }
  return { o, resto };
}

const tamanhoLegivel = (n) => (n < 1024 ? `${n}` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)}K` : `${(n / 1048576).toFixed(1)}M`);

function lerArquivos(estado, args, entrada, nomeDoComando) {
  if (!args.length) return { textos: [entrada ?? ""], erros: [] };
  const textos = [], erros = [];
  for (const a of args) {
    if (a === "-") { textos.push(entrada ?? ""); continue; }
    const c = normalizarCaminho(estado.cwd, a);
    if (ehArquivo(estado.projeto, c)) textos.push(estado.projeto.arquivos[c]);
    else erros.push(`${nomeDoComando}: ${a}: ${ehPasta(estado.projeto, c) ? "é uma pasta" : "arquivo ou pasta não encontrado"}`);
  }
  return { textos, erros };
}

export const AJUDA = [
  ["Arquivos", "ls [-la] · cd · pwd · tree · mkdir [-p] · touch · cat [-n] · head/tail [-n N] · wc [-lwc] · rm [-rf] · rmdir · mv · cp [-r] · find [-name] [-type f|d] · grep [-inrvc]"],
  ["Texto", "echo · sort [-rnu] · uniq [-c] · > (grava) · >> (acrescenta) · < (entrada) · | (encadeia) · && · || · ;"],
  ["JavaScript", "node arquivo.js · node -e \"código\" · node (modo interativo) · npm install pacote · npm run script"],
  ["Python", "python arquivo.py · python -c \"código\" · python (modo interativo) · pip install pacote · pip list"],
  ["SQL", "sqlite3 banco.db (modo interativo) · sqlite3 banco.db < consultas.sql · sqlite3 banco.db \"SELECT 1;\""],
  ["Compilar", "gcc main.c -o app && ./app · g++ main.cpp -o app · javac Main.java && java Main · rustc main.rs && ./main · go run main.go · go build -o app"],
  ["Rodar direto", "ruby · php · lua · perl · bash · Rscript · runghc · elixir · scala · julia · swift · ts-node · csharp · run arquivo"],
  ["IDE", "open arquivo (abre no editor) · preview [index.html] (prévia da página) · clear · history · env · export NOME=valor · date · whoami"],
  ["Teclas", "↑ ↓ histórico · Tab completa · Ctrl+C interrompe · Ctrl+L limpa · Ctrl+D sai do modo interativo"],
];

const BUILTINS = {
  help: () => ok(["Terminal do Proof — os comandos:", "", ...AJUDA.map(([t, c]) => `  ${t.padEnd(13)}${c}`), "", "Programas que leem a entrada (input, scanf...) pedem as linhas antes de rodar, ou use: programa < entrada.txt", ""].join("\n")),
  pwd: (_a, { estado }) => ok(caminhoParaMostrar(estado.cwd) + "\n"),
  cd: (args, { estado }) => {
    const alvo = args[0] === "-" ? (estado.env.OLDPWD || "/") : normalizarCaminho(estado.cwd, args[0] || "~");
    if (ehArquivo(estado.projeto, alvo)) return falha(`cd: ${args[0]}: não é uma pasta`);
    if (!ehPasta(estado.projeto, alvo)) return falha(`cd: ${args[0]}: pasta não encontrada`);
    return { ...ok(), estado: { ...estado, cwd: alvo, env: { ...estado.env, OLDPWD: estado.cwd, PWD: caminhoParaMostrar(alvo) } } };
  },
  ls: (args, { estado }) => {
    const { o, resto } = opcoes(args);
    const alvos = resto.length ? resto : ["."];
    const saidas = [], erros = [];
    for (const a of alvos) {
      const c = normalizarCaminho(estado.cwd, a);
      if (ehArquivo(estado.projeto, c)) { saidas.push(o.l ? `-rw-r--r--  ${tamanhoLegivel(estado.projeto.arquivos[c].length).padStart(6)}  ${a}` : a); continue; }
      if (!ehPasta(estado.projeto, c)) { erros.push(`ls: ${a}: arquivo ou pasta não encontrado`); continue; }
      const filhos = listar(estado.projeto, c).filter((f) => o.a || !f.nome.startsWith("."));
      if (alvos.length > 1) saidas.push(`${a}:`);
      if (o.l) {
        saidas.push(`total ${filhos.length}`);
        for (const f of filhos) saidas.push(`${f.tipo === "pasta" ? "drwxr-xr-x" : "-rw-r--r--"}  ${tamanhoLegivel(f.tamanho).padStart(6)}  ${f.nome}${f.tipo === "pasta" ? "/" : ""}`);
      } else if (filhos.length) saidas.push(filhos.map((f) => f.nome + (f.tipo === "pasta" ? "/" : "")).join("  "));
    }
    return { saida: juntar(saidas), erro: juntar(erros), status: erros.length ? 1 : 0 };
  },
  tree: (args, { estado }) => {
    const c = normalizarCaminho(estado.cwd, args[0] || ".");
    if (!ehPasta(estado.projeto, c)) return falha(`tree: ${args[0]}: pasta não encontrada`);
    return ok(juntar(arvore(estado.projeto, c)));
  },
  mkdir: (args, { estado }) => {
    const { o, resto } = opcoes(args);
    if (!resto.length) return falha("mkdir: faltou o nome da pasta");
    let projeto = estado.projeto;
    for (const a of resto) projeto = criarPasta(projeto, normalizarCaminho(estado.cwd, a), { pais: Boolean(o.p) });
    return { ...ok(), estado: { ...estado, projeto } };
  },
  touch: (args, { estado }) => {
    if (!args.length) return falha("touch: faltou o nome do arquivo");
    let projeto = estado.projeto;
    for (const a of args) { const c = normalizarCaminho(estado.cwd, a); if (!ehArquivo(projeto, c)) projeto = escrever(projeto, c, ""); }
    return { ...ok(), estado: { ...estado, projeto } };
  },
  cat: (args, { estado, entrada }) => {
    const { o, resto } = opcoes(args);
    const { textos, erros } = lerArquivos(estado, resto, entrada, "cat");
    let saida = textos.join("");
    if (o.n) saida = juntar(linhas(saida).map((l, i) => `${String(i + 1).padStart(6)}\t${l}`));
    return { saida, erro: juntar(erros), status: erros.length ? 1 : 0 };
  },
  head: (args, ctx) => pedaco(args, ctx, "head"),
  tail: (args, ctx) => pedaco(args, ctx, "tail"),
  wc: (args, { estado, entrada }) => {
    const { o, resto } = opcoes(args);
    const { textos, erros } = lerArquivos(estado, resto, entrada, "wc");
    const todos = !o.l && !o.w && !o.c;
    const saidas = textos.map((t, i) => {
      const partes = [];
      if (todos || o.l) partes.push(String((t.match(/\n/g) || []).length).padStart(7));
      if (todos || o.w) partes.push(String(t.split(/\s+/).filter(Boolean).length).padStart(7));
      if (todos || o.c) partes.push(String(new TextEncoder().encode(t).length).padStart(7));
      return partes.join(" ") + (resto[i] ? ` ${resto[i]}` : "");
    });
    return { saida: juntar(saidas), erro: juntar(erros), status: erros.length ? 1 : 0 };
  },
  echo: (args) => {
    let semQuebra = false, escapes = false;
    while (args[0] === "-n" || args[0] === "-e") { if (args[0] === "-n") semQuebra = true; else escapes = true; args = args.slice(1); }
    let t = args.join(" ");
    if (escapes) t = t.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
    return ok(semQuebra ? t : t + "\n");
  },
  rm: (args, { estado }) => {
    const { o, resto } = opcoes(args);
    if (!resto.length) return falha("rm: faltou o que apagar");
    let projeto = estado.projeto;
    const erros = [];
    for (const a of resto) {
      const c = normalizarCaminho(estado.cwd, a);
      if (!existe(projeto, c)) { if (!o.f) erros.push(`rm: ${a}: arquivo ou pasta não encontrado`); continue; }
      if (ehPasta(projeto, c) && !ehArquivo(projeto, c) && !o.r && !o.R) { erros.push(`rm: ${a}: é uma pasta (use rm -r)`); continue; }
      projeto = remover(projeto, c, { recursivo: true });
    }
    return { saida: "", erro: juntar(erros), status: erros.length ? 1 : 0, estado: { ...estado, projeto } };
  },
  rmdir: (args, { estado }) => {
    let projeto = estado.projeto;
    for (const a of args) projeto = remover(projeto, normalizarCaminho(estado.cwd, a));
    return { ...ok(), estado: { ...estado, projeto } };
  },
  mv: (args, { estado }) => {
    if (args.length < 2) return falha("mv: use mv origem destino");
    const destino = normalizarCaminho(estado.cwd, args[args.length - 1]);
    let projeto = estado.projeto;
    for (const a of args.slice(0, -1)) projeto = mover(projeto, normalizarCaminho(estado.cwd, a), destino);
    return { ...ok(), estado: { ...estado, projeto } };
  },
  cp: (args, { estado }) => {
    const { o, resto } = opcoes(args);
    if (resto.length < 2) return falha("cp: use cp origem destino");
    const destino = normalizarCaminho(estado.cwd, resto[resto.length - 1]);
    let projeto = estado.projeto;
    for (const a of resto.slice(0, -1)) projeto = copiar(projeto, normalizarCaminho(estado.cwd, a), destino, { recursivo: Boolean(o.r || o.R) });
    return { ...ok(), estado: { ...estado, projeto } };
  },
  grep: (args, { estado, entrada }) => {
    const { o, resto } = opcoes(args, ["e"]);
    const padrao = o.e ?? resto.shift();
    if (padrao === undefined) return falha("grep: faltou o padrão");
    let re;
    try { re = new RegExp(padrao, o.i ? "i" : ""); } catch { return falha(`grep: padrão inválido: ${padrao}`); }
    const fontes = [];
    if (!resto.length) fontes.push({ nome: "", texto: entrada ?? "" });
    for (const a of resto) {
      const c = normalizarCaminho(estado.cwd, a);
      if (ehArquivo(estado.projeto, c)) fontes.push({ nome: a, texto: estado.projeto.arquivos[c] });
      else if (ehPasta(estado.projeto, c) && (o.r || o.R)) {
        for (const [arq, texto] of Object.entries(estado.projeto.arquivos)) if (c === "/" || arq.startsWith(c + "/")) fontes.push({ nome: arq.slice(1), texto });
      } else return falha(`grep: ${a}: ${ehPasta(estado.projeto, c) ? "é uma pasta (use grep -r)" : "arquivo não encontrado"}`, 2);
    }
    const varios = fontes.length > 1 || o.r || o.R;
    const saidas = [];
    let achou = 0;
    for (const f of fontes) {
      let conta = 0;
      linhas(f.texto).forEach((l, i) => {
        if (re.test(l) === !o.v) {
          conta++; achou++;
          if (!o.c && !o.l) saidas.push(`${varios ? f.nome + ":" : ""}${o.n ? `${i + 1}:` : ""}${l}`);
        }
      });
      if (o.c) saidas.push(`${varios ? f.nome + ":" : ""}${conta}`);
      if (o.l && conta) saidas.push(f.nome);
    }
    return { saida: juntar(saidas), erro: "", status: achou ? 0 : 1 };
  },
  find: (args, { estado }) => {
    // find [pasta] [-name padrão] [-type f|d]
    const iNome = args.indexOf("-name"), iTipo = args.indexOf("-type");
    const nome = iNome >= 0 ? args[iNome + 1] : null;
    const tipo = iTipo >= 0 ? args[iTipo + 1] : null;
    const usados = new Set([iNome, iNome + 1, iTipo, iTipo + 1].filter((i) => i >= 0));
    const pastaArg = args.find((a, i) => !usados.has(i) && !a.startsWith("-")) || ".";
    const base = normalizarCaminho(estado.cwd, pastaArg);
    if (!ehPasta(estado.projeto, base)) return falha(`find: ${pastaArg}: pasta não encontrada`);
    const re = nome ? reDoCuringa(nome) : null;
    const prefixo = base === "/" ? "/" : base + "/";
    const itens = [
      ...todasAsPastas(estado.projeto).filter((d) => d === base || d.startsWith(prefixo)).map((d) => ({ c: d, t: "d" })),
      ...Object.keys(estado.projeto.arquivos).filter((a) => a.startsWith(prefixo)).map((a) => ({ c: a, t: "f" })),
    ].filter((x) => (!tipo || x.t === tipo) && (!re || re.test(nomeDe(x.c) || "")));
    const mostrar = (c) => (pastaArg === "." ? "." + (c === base ? "" : c.slice(base === "/" ? 0 : base.length)) : caminhoParaMostrar(c));
    return ok(juntar(itens.sort((a, b) => a.c.localeCompare(b.c)).map((x) => mostrar(x.c))));
  },
  sort: (args, { estado, entrada }) => {
    const { o, resto } = opcoes(args);
    const { textos, erros } = lerArquivos(estado, resto, entrada, "sort");
    let ls = linhas(textos.join(""));
    ls.sort(o.n ? (a, b) => parseFloat(a) - parseFloat(b) : (a, b) => a.localeCompare(b));
    if (o.r) ls.reverse();
    if (o.u) ls = [...new Set(ls)];
    return { saida: juntar(ls), erro: juntar(erros), status: erros.length ? 1 : 0 };
  },
  uniq: (args, { estado, entrada }) => {
    const { o, resto } = opcoes(args);
    const { textos } = lerArquivos(estado, resto, entrada, "uniq");
    const saida = [];
    for (const l of linhas(textos.join(""))) {
      const ultimo = saida[saida.length - 1];
      if (ultimo && ultimo.l === l) ultimo.n++; else saida.push({ l, n: 1 });
    }
    return ok(juntar(saida.map((x) => (o.c ? `${String(x.n).padStart(7)} ${x.l}` : x.l))));
  },
  clear: () => ({ ...ok(), efeitos: [{ tipo: "limpar" }] }),
  history: (args, { estado }) => {
    if (args[0] === "-c") return { ...ok(), estado: { ...estado, historico: [] }, efeitos: [{ tipo: "historico-limpo" }] };
    return ok(juntar(estado.historico.map((l, i) => `${String(i + 1).padStart(5)}  ${l}`)));
  },
  date: () => ok(new Date().toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "medium" }) + "\n"),
  whoami: () => ok(USUARIO_DO_TERMINAL + "\n"),
  hostname: () => ok("proof\n"),
  uname: (args) => ok((args.includes("-a") ? "Proof proof 1.9 navegador wasm/js" : "Proof") + "\n"),
  env: (_a, { estado }) => ok(juntar(Object.entries(estado.env).map(([k, v]) => `${k}=${v}`))),
  printenv: (args, { estado }) => ok(args.length ? juntar(args.map((k) => estado.env[k] ?? "")) : juntar(Object.entries(estado.env).map(([k, v]) => `${k}=${v}`))),
  export: (args, { estado }) => {
    const env = { ...estado.env };
    for (const a of args) { const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(a); if (m) env[m[1]] = m[2]; else if (!/^[A-Za-z_]\w*$/.test(a)) return falha(`export: "${a}": nome inválido`); }
    return { ...ok(), estado: { ...estado, env } };
  },
  unset: (args, { estado }) => { const env = { ...estado.env }; for (const a of args) delete env[a]; return { ...ok(), estado: { ...estado, env } }; },
  which: (args) => ok(juntar(args.map((a) => (BUILTINS[a] ? `${a}: comando do terminal` : PROGRAMAS_CONHECIDOS.includes(a) ? `/usr/bin/${a}` : `${a} não encontrado`)))),
  type: (args) => BUILTINS.which(args),
  open: (args, { estado }) => abrirNoEditor(args, estado),
  code: (args, { estado }) => abrirNoEditor(args, estado),
  preview: (args, { estado }) => {
    const c = args[0] ? normalizarCaminho(estado.cwd, args[0]) : (Object.keys(estado.projeto.arquivos).find((a) => /\/index\.html?$/i.test(a)) || Object.keys(estado.projeto.arquivos).find((a) => /\.html?$/i.test(a)));
    if (!c || !ehArquivo(estado.projeto, c)) return falha("preview: não achei uma página .html no projeto");
    return { ...ok(`Abrindo a prévia de ${caminhoParaMostrar(c)}…\n`), efeitos: [{ tipo: "previa", caminho: c }] };
  },
  exit: () => ok("Este é o terminal do projeto: ele fica aberto. Use Ctrl+D para sair de um modo interativo.\n"),
  true: () => ok(),
  false: () => ({ saida: "", erro: "", status: 1 }),
  curl: () => falha("curl: o terminal não acessa a internet. No JavaScript, use fetch() dentro de um programa (node)."),
  wget: () => falha("wget: o terminal não acessa a internet. No JavaScript, use fetch() dentro de um programa (node)."),
  sudo: () => falha("sudo: aqui você já pode tudo no seu projeto — não precisa de sudo 🙂"),
  apt: () => falha("apt: não há instalação de programas no terminal. Para JavaScript use npm install, para Python pip install."),
  "apt-get": () => falha("apt-get: não há instalação de programas no terminal. Para JavaScript use npm install, para Python pip install."),
  git: () => falha("git: ainda não há git no terminal do Proof. O projeto é salvo sozinho na sua conta."),
  npm: (args, ctx) => npm(args, ctx),
  ajuda: (a, ctx) => BUILTINS.help(a, ctx),
  cls: () => BUILTINS.clear(),
  ll: (args, ctx) => BUILTINS.ls(["-l", ...args], ctx),
};

function pedaco(args, { estado, entrada }, nomeDoComando) {
  const { o, resto } = opcoes(args, ["n"]);
  const n = Math.max(0, parseInt(o.n ?? "10", 10) || 0);
  const { textos, erros } = lerArquivos(estado, resto, entrada, nomeDoComando);
  const ls = linhas(textos.join(""));
  return { saida: juntar(nomeDoComando === "head" ? ls.slice(0, n) : ls.slice(Math.max(0, ls.length - n))), erro: juntar(erros), status: erros.length ? 1 : 0 };
}

function abrirNoEditor(args, estado) {
  if (!args.length) return falha("open: faltou o arquivo");
  let projeto = estado.projeto;
  const efeitos = [];
  for (const a of args) {
    const c = normalizarCaminho(estado.cwd, a);
    if (ehPasta(projeto, c) && !ehArquivo(projeto, c)) return falha(`open: ${a}: é uma pasta`);
    if (!ehArquivo(projeto, c)) projeto = escrever(projeto, c, ""); // como o "code arquivo-novo": cria e abre
    efeitos.push({ tipo: "abrir", caminho: c });
  }
  return { ...ok(), estado: { ...estado, projeto }, efeitos };
}

// ------------------------------------------------------------------ npm (o package.json do projeto)

function lerPacote(projeto) {
  const t = projeto.arquivos["/package.json"];
  if (t === undefined) return null;
  try { return JSON.parse(t); } catch { throw erroDoShell("npm: o package.json não é um JSON válido"); }
}

async function npm(args, ctx) {
  const { estado } = ctx;
  const [sub, ...resto] = args;
  let pacote = lerPacote(estado.projeto);
  if (sub === "init") {
    if (pacote) return ok("O package.json já existe.\n");
    pacote = { name: (estado.projeto.nome || "projeto").toLowerCase().replace(/[^a-z0-9-]+/g, "-"), version: "1.0.0", main: "index.js", scripts: { start: "node index.js" }, dependencies: {} };
    return { ...ok("Criei o package.json.\n"), estado: { ...estado, projeto: escrever(estado.projeto, "/package.json", JSON.stringify(pacote, null, 2) + "\n") } };
  }
  if (sub === "install" || sub === "i" || sub === "add") {
    const nomes = resto.filter((a) => !a.startsWith("-"));
    if (!nomes.length) return ok(pacote?.dependencies && Object.keys(pacote.dependencies).length ? `As ${Object.keys(pacote.dependencies).length} dependência(s) do package.json vêm do esm.sh na hora de rodar.\n` : "Nada para instalar. Use: npm install nome-do-pacote\n");
    pacote = pacote || { name: "projeto", version: "1.0.0", main: "index.js", scripts: {}, dependencies: {} };
    pacote.dependencies = pacote.dependencies || {};
    for (const n of nomes) {
      const m = /^(@?[^@]+)(?:@(.+))?$/.exec(n);
      if (!m || !/^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(m[1])) return falha(`npm: "${n}" não parece um nome de pacote`);
      pacote.dependencies[m[1]] = m[2] ? m[2] : "latest";
    }
    return {
      ...ok(`+ ${nomes.join(", ")}\nPronto: o pacote entra no package.json e vem do esm.sh na hora de rodar (require("${nomes[0].split("@")[0] || nomes[0]}") ou import).\n`),
      estado: { ...estado, projeto: escrever(estado.projeto, "/package.json", JSON.stringify(pacote, null, 2) + "\n") },
    };
  }
  if (sub === "uninstall" || sub === "remove" || sub === "rm") {
    if (!pacote?.dependencies) return ok("Nada para remover.\n");
    for (const n of resto) delete pacote.dependencies[n];
    return { ...ok(`- ${resto.join(", ")}\n`), estado: { ...estado, projeto: escrever(estado.projeto, "/package.json", JSON.stringify(pacote, null, 2) + "\n") } };
  }
  if (sub === "ls" || sub === "list") {
    const deps = Object.entries(pacote?.dependencies || {});
    return ok(deps.length ? juntar([`${pacote.name || "projeto"}@${pacote.version || "1.0.0"}`, ...deps.map(([n, v], i) => `${i === deps.length - 1 ? "└──" : "├──"} ${n}@${v}`)]) : "(nenhuma dependência)\n");
  }
  if (sub === "run" || sub === "start" || sub === "test") {
    const nome = sub === "run" ? resto[0] : sub;
    const scripts = pacote?.scripts || {};
    if (!nome) return ok(Object.keys(scripts).length ? juntar(["Scripts do package.json:", ...Object.entries(scripts).map(([k, v]) => `  ${k}\n    ${v}`)]) : "O package.json não tem scripts.\n");
    if (!scripts[nome]) return falha(`npm: o script "${nome}" não existe no package.json`);
    if ((ctx.profundidade || 0) > 4) return falha("npm: scripts chamando scripts demais");
    ctx.aoEscrever?.("info", `> ${nome}\n> ${scripts[nome]}\n`);
    const r = await executarLinha(scripts[nome], estado, { ...ctx.ctx, profundidade: (ctx.profundidade || 0) + 1 });
    return { saida: r.saida, erro: r.erro, status: r.status, estado: r.estado, efeitos: r.efeitos };
  }
  return ok("Comandos do npm: npm init · npm install pacote · npm uninstall pacote · npm ls · npm run script · npm start\n");
}

// ------------------------------------------------------------------ os programas

export const PROGRAMAS_CONHECIDOS = [
  "node", "js", "deno", "bun", "python", "python3", "py", "pip", "pip3", "sqlite3", "sqlite", "sql", "gcc", "cc", "clang", "g++", "c++", "clang++",
  "javac", "java", "go", "rustc", "cargo", "ruby", "php", "lua", "lua5.4", "bash", "sh", "zsh", "perl", "Rscript", "R", "runghc", "runhaskell", "ghc",
  "elixir", "scala", "julia", "swift", "ts-node", "tsx", "csharp", "mcs", "mono", "dotnet", "run", "nim", "zig", "fpc", "ocaml", "groovy", "crystal",
];

/** Por extensão, como rodar direto um arquivo (o "run arquivo" e o "./script"). */
function pedidoPeloArquivo(caminho, args, estado) {
  const l = linguagemDoArquivo(caminho);
  if (l.executor === "previa") return { tipo: "previa", caminho };
  if (!l.executor) return null;
  if (l.executor === "sql") return { tipo: "sql", banco: null, sql: estado.projeto.arquivos[caminho], rotulo: l.rotulo };
  return { tipo: "programa", executor: l.executor, linguagem: l, arquivo: caminho, args };
}

const DIRETOS = {
  ruby: "rb", php: "php", lua: "lua", "lua5.4": "lua", bash: "sh", sh: "sh", zsh: "sh", perl: "pl", Rscript: "r", R: "r", runghc: "hs", runhaskell: "hs",
  elixir: "exs", scala: "scala", julia: "jl", swift: "swift", "ts-node": "ts", tsx: "ts", deno: "ts", bun: "js", csharp: "cs", nim: "nim", zig: "zig",
  fpc: "pas", ocaml: "ml", groovy: "groovy", crystal: "cr",
};

const COMPILADORES_C = { gcc: "c", cc: "c", clang: "c", "g++": "cpp", "c++": "cpp", "clang++": "cpp" };

/** O que o comando pede para rodar — ou null se não é um programa. Erros de uso viram { erro }. */
export function pedidoDoPrograma(argv, estado) {
  const [nome, ...args] = argv;
  const arquivo = (a) => normalizarCaminho(estado.cwd, a);
  const precisaExistir = (a) => (ehArquivo(estado.projeto, arquivo(a)) ? null : { erro: `${nome}: ${a}: arquivo não encontrado` });

  // ./programa (o executável do gcc/javac/rustc/go build) ou ./script.sh
  if (nome.startsWith("./") || nome.startsWith("../") || (nome.startsWith("/") && !PROGRAMAS_CONHECIDOS.includes(nome))) {
    const c = arquivo(nome);
    if (!ehArquivo(estado.projeto, c)) return { erro: `${nome}: arquivo não encontrado` };
    const conteudo = estado.projeto.arquivos[c];
    if (conteudo.startsWith(IDE.marcaDeBinario)) {
      try { return { tipo: "binario", ...JSON.parse(conteudo.slice(IDE.marcaDeBinario.length).split("\n")[0]), args }; } catch { return { erro: `${nome}: o executável está estragado — compile de novo` }; }
    }
    const p = pedidoPeloArquivo(c, args, estado);
    return p || { erro: `${nome}: não sei rodar este arquivo (extensão .${extensaoDe(c) || "?"})` };
  }

  if (nome === "node" || nome === "js") {
    if (!args.length) return { tipo: "repl", linguagem: "javascript" };
    if (args[0] === "-e" || args[0] === "--eval" || args[0] === "-p") return { tipo: "programa", executor: "js", codigo: args[1] ?? "", imprimir: args[0] === "-p", args: args.slice(2), linguagem: linguagemDoArquivo("x.js") };
    if (args[0] === "-v" || args[0] === "--version") return { tipo: "texto", saida: "v20.0.0 (JavaScript do navegador)\n" };
    return precisaExistir(args[0]) || { tipo: "programa", executor: extensaoDe(args[0]) === "ts" ? "servidor" : "js", linguagem: linguagemDoArquivo(args[0]), arquivo: arquivo(args[0]), args: args.slice(1) };
  }
  if (nome === "python" || nome === "python3" || nome === "py") {
    if (!args.length) return { tipo: "repl", linguagem: "python" };
    if (args[0] === "-V" || args[0] === "--version") return { tipo: "texto", saida: "Python 3 (Pyodide, no navegador)\n" };
    if (args[0] === "-c") return { tipo: "programa", executor: "python", codigo: args[1] ?? "", args: args.slice(2), linguagem: linguagemDoArquivo("x.py") };
    if (args[0] === "-m" && (args[1] === "pip")) return { tipo: "pip", args: args.slice(2) };
    return precisaExistir(args[0]) || { tipo: "programa", executor: "python", linguagem: linguagemDoArquivo(args[0]), arquivo: arquivo(args[0]), args: args.slice(1) };
  }
  if (nome === "pip" || nome === "pip3") return { tipo: "pip", args };
  if (nome === "sqlite3" || nome === "sqlite" || nome === "sql") {
    const banco = args.find((a) => !a.startsWith("-") && /\.(db|sqlite3?)$/i.test(a));
    const sqlArg = args.find((a) => !a.startsWith("-") && a !== banco && !/\.sql$/i.test(a));
    const arquivoSql = args.find((a) => /\.sql$/i.test(a));
    if (arquivoSql) { const e = precisaExistir(arquivoSql); if (e) return e; }
    return { tipo: "sql", banco: banco ? arquivo(banco) : null, sql: arquivoSql ? estado.projeto.arquivos[arquivo(arquivoSql)] : sqlArg ?? null, rotulo: "SQL (SQLite)" };
  }
  if (COMPILADORES_C[nome]) {
    // como o gcc lê: -o <saída> (ou -oapp), as fontes, e as outras opções vão para o compilador (-lm, -Wall, -O2, -std=c11)
    let saidaArg = null;
    const fontes = [], opcoesDoCompilador = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-o") saidaArg = args[++i];
      else if (a.startsWith("-o") && a.length > 2) saidaArg = a.slice(2);
      else if (a.startsWith("-")) { if (/^-(l\w+|D[\w=]+|W[\w-]*|O[0-3s]?|g|std=[\w+]+|pedantic|fsanitize=\w+|march=\w+|lm)$/.test(a)) opcoesDoCompilador.push(a); }
      else fontes.push(a);
    }
    const doCodigo = fontes.filter((a) => /\.(c|cc|cpp|cxx)$/i.test(a));
    if (!doCodigo.length) return { erro: `${nome}: faltou o arquivo .${COMPILADORES_C[nome] === "c" ? "c" : "cpp"}` };
    for (const f of doCodigo) { const e = precisaExistir(f); if (e) return e; }
    const ext = COMPILADORES_C[nome] === "c" && !doCodigo.some((f) => /\.(cc|cpp|cxx)$/i.test(f)) ? "c" : "cpp";
    return { tipo: "compilar", linguagem: linguagemDoArquivo(`x.${ext}`), fontes: doCodigo.map(arquivo), saida: arquivo(saidaArg || "a.out"), opcoes: opcoesDoCompilador };
  }
  if (nome === "javac") {
    const fontes = args.filter((a) => /\.java$/i.test(a));
    if (!fontes.length) return { erro: "javac: faltou o arquivo .java" };
    for (const f of fontes) { const e = precisaExistir(f); if (e) return e; }
    const principal = fontes[0];
    return { tipo: "compilar", linguagem: linguagemDoArquivo("x.java"), fontes: fontes.map(arquivo), saida: arquivo(principal.replace(/\.java$/i, ".class")) };
  }
  if (nome === "java") {
    const alvo = args.find((a) => !a.startsWith("-"));
    if (!alvo) return { erro: "java: use java Main (depois do javac) ou java Main.java" };
    const fonte = /\.java$/i.test(alvo) ? alvo : `${alvo.replace(/\.class$/i, "")}.java`;
    const e = precisaExistir(fonte); if (e) return { erro: `java: não achei ${fonte} (a classe ${alvo})` };
    const fontes = [arquivo(fonte), ...Object.keys(estado.projeto.arquivos).filter((a) => /\.java$/i.test(a) && a !== arquivo(fonte) && pastaDe(a) === pastaDe(arquivo(fonte)))];
    return { tipo: "programa", executor: "servidor", linguagem: linguagemDoArquivo(fonte), arquivo: arquivo(fonte), fontes, args: args.slice(args.indexOf(alvo) + 1) };
  }
  if (nome === "rustc") {
    const { o, resto } = opcoes(args, ["o"]);
    const fonte = resto.find((a) => /\.rs$/i.test(a));
    if (!fonte) return { erro: "rustc: faltou o arquivo .rs" };
    const e = precisaExistir(fonte); if (e) return e;
    return { tipo: "compilar", linguagem: linguagemDoArquivo("x.rs"), fontes: [arquivo(fonte)], saida: arquivo(o.o || fonte.replace(/\.rs$/i, "")) };
  }
  if (nome === "cargo") {
    if (args[0] !== "run") return { erro: "cargo: só o cargo run (com src/main.rs) funciona aqui" };
    const fonte = ["/src/main.rs", "/main.rs"].find((c) => ehArquivo(estado.projeto, c));
    return fonte ? { tipo: "programa", executor: "servidor", linguagem: linguagemDoArquivo(fonte), arquivo: fonte, args: args.slice(1) } : { erro: "cargo: não achei src/main.rs" };
  }
  if (nome === "go") {
    const [sub, ...resto] = args;
    if (sub === "version") return { tipo: "texto", saida: "go version go1.23.2 (compilador on-line)\n" };
    const { o, resto: r2 } = opcoes(resto, ["o"]);
    const fontes = r2.filter((a) => /\.go$/i.test(a));
    const lista = fontes.length ? fontes.map(arquivo) : Object.keys(estado.projeto.arquivos).filter((a) => /\.go$/i.test(a) && pastaDe(a) === estado.cwd);
    if (!lista.length) return { erro: "go: não achei arquivos .go nesta pasta" };
    if (sub === "run") return { tipo: "programa", executor: "servidor", linguagem: linguagemDoArquivo("x.go"), arquivo: lista[0], fontes: lista, args: r2.filter((a) => !/\.go$/i.test(a)) };
    if (sub === "build") return { tipo: "compilar", linguagem: linguagemDoArquivo("x.go"), fontes: lista, saida: arquivo(o.o || nomeDe(lista[0]).replace(/\.go$/i, "")) };
    return { erro: "go: use go run main.go ou go build -o app" };
  }
  if (nome === "mcs" || (nome === "dotnet" && args[0] === "build")) {
    const fonte = args.find((a) => /\.cs$/i.test(a)) || Object.keys(estado.projeto.arquivos).find((a) => /\.cs$/i.test(a))?.slice(1);
    if (!fonte) return { erro: `${nome}: faltou o arquivo .cs` };
    return { tipo: "compilar", linguagem: linguagemDoArquivo("x.cs"), fontes: [arquivo(fonte)], saida: arquivo(fonte.replace(/\.cs$/i, ".exe")) };
  }
  if (nome === "mono") {
    const c = args[0] ? arquivo(args[0]) : "";
    if (!c || !ehArquivo(estado.projeto, c)) return { erro: "mono: faltou o .exe (compile antes com mcs arquivo.cs)" };
    return pedidoDoPrograma(["./" + c.slice(1), ...args.slice(1)], { ...estado, cwd: "/" });
  }
  if (nome === "dotnet" && args[0] === "run") {
    const fonte = Object.keys(estado.projeto.arquivos).find((a) => /\.cs$/i.test(a));
    return fonte ? { tipo: "programa", executor: "servidor", linguagem: linguagemDoArquivo(fonte), arquivo: fonte, args: args.slice(1) } : { erro: "dotnet: não achei arquivo .cs" };
  }
  if (nome === "ghc") {
    const fonte = args.find((a) => /\.hs$/i.test(a));
    if (!fonte) return { erro: "ghc: faltou o arquivo .hs" };
    return { tipo: "compilar", linguagem: linguagemDoArquivo("x.hs"), fontes: [arquivo(fonte)], saida: arquivo(fonte.replace(/\.hs$/i, "")) };
  }
  if (DIRETOS[nome]) {
    const alvo = args.find((a) => !a.startsWith("-"));
    if (!alvo) return { erro: `${nome}: faltou o arquivo (ex.: ${nome} programa.${DIRETOS[nome]})` };
    const e = precisaExistir(alvo); if (e) return e;
    const l = linguagemDoArquivo(alvo);
    const linguagem = l.executor ? l : linguagemDoArquivo(`x.${DIRETOS[nome]}`);
    return { tipo: "programa", executor: linguagem.executor, linguagem, arquivo: arquivo(alvo), args: args.slice(args.indexOf(alvo) + 1) };
  }
  if (nome === "run") {
    const alvo = args[0] ? arquivo(args[0]) : estado.projeto.principal;
    if (!alvo) return { erro: "run: diga o arquivo (run main.py) ou marque um arquivo principal no explorador" };
    if (!ehArquivo(estado.projeto, alvo)) return { erro: `run: ${args[0] || alvo}: arquivo não encontrado` };
    return pedidoPeloArquivo(alvo, args.slice(1), estado) || { erro: `run: não sei rodar arquivos .${extensaoDe(alvo) || "?"}` };
  }
  return null;
}

/** O comando que roda o arquivo (o botão ▶ da IDE digita isto no terminal). */
export function comandoParaRodar(caminho) {
  const rel = caminho.startsWith("/") ? caminho.slice(1) : caminho;
  const q = /[\s'"$]/.test(rel) ? `"${rel.replace(/(["\\$])/g, "\\$1")}"` : rel;
  const l = linguagemDoArquivo(caminho);
  const base = nomeDe(rel).replace(/\.[^.]+$/, "");
  const ext = l.ext;
  if (l.executor === "previa") return `preview ${q}`;
  if (ext === "js" || ext === "mjs" || ext === "cjs") return `node ${q}`;
  if (ext === "py") return `python ${q}`;
  if (ext === "sql") return `sqlite3 < ${q}`;
  if (ext === "c") return `gcc ${q} -o ${base} && ./${base}`;
  if (ext === "cpp" || ext === "cc") return `g++ ${q} -o ${base} && ./${base}`;
  if (ext === "java") return `java ${q}`;
  if (ext === "go") return `go run ${q}`;
  if (ext === "rs") return `rustc ${q} -o ${base} && ./${base}`;
  if (l.executor) return `run ${q}`;
  return "";
}

// ------------------------------------------------------------------ rodar a linha

/** Uma linha do terminal, do começo ao fim. */
export async function executarLinha(linha, estadoInicial, ctx = {}) {
  let estado = estadoInicial;
  const efeitos = [];
  let saidaTotal = "", erroTotal = "", status = 0;
  let sequencia;
  try {
    sequencia = analisar(tokenizar(linha, estado.env));
  } catch (e) {
    return { estado, saida: "", erro: `proof: ${e.message}\n`, status: 2, efeitos };
  }
  for (const { conector, pipeline } of sequencia) {
    if (conector === "&&" && status !== 0) continue;
    if (conector === "||" && status === 0) continue;
    if (ctx.sinal?.aborted) break;
    let entrada = null;
    for (let i = 0; i < pipeline.length; i++) {
      const cmd = pipeline[i];
      const ultimo = i === pipeline.length - 1;
      const argv = cmd.argv.flatMap((tk) => (tk.curinga ? expandirCuringa(estado.projeto, estado.cwd, tk.valor) : [tk.valor]));
      if (cmd.entrada !== null) {
        const c = normalizarCaminho(estado.cwd, cmd.entrada);
        if (!ehArquivo(estado.projeto, c)) { erroTotal += `proof: ${cmd.entrada}: arquivo não encontrado\n`; status = 1; entrada = null; break; }
        entrada = estado.projeto.arquivos[c];
      }
      // a saída vai para a tela ao vivo só no último comando sem redirecionamento
      const aoVivo = ultimo && !cmd.saida ? ctx.aoEscrever : null;
      let r;
      try {
        r = await executarComando(argv, { estado, entrada, ctx, aoEscrever: aoVivo, profundidade: ctx.profundidade || 0 });
      } catch (e) {
        r = { saida: "", erro: e.doTerminal ? `${argv[0]}: ${e.message}\n` : `${argv[0]}: ${e.message || e}\n`, status: 1 };
      }
      if (r.estado) estado = r.estado;
      if (r.efeitos) efeitos.push(...r.efeitos);
      let saida = r.saida || "";
      let erroDoCmd = r.erro || "";
      if (cmd.erroParaSaida) { saida += erroDoCmd; erroDoCmd = ""; }
      if (cmd.erroEm) {
        try { estado = { ...estado, projeto: escrever(estado.projeto, normalizarCaminho(estado.cwd, cmd.erroEm), erroDoCmd) }; } catch (e) { erroDoCmd = `proof: ${e.message}\n`; }
        if (cmd.erroEm) erroDoCmd = "";
      }
      // o programa que já escreveu ao vivo (saída e erro) não repete nada no fim
      if (!(r.jaEscreveu && aoVivo)) erroTotal += erroDoCmd;
      status = r.status ?? 0;
      if (cmd.saida) {
        try {
          estado = { ...estado, projeto: escrever(estado.projeto, normalizarCaminho(estado.cwd, cmd.saida), saida, { acrescentar: cmd.acrescentar }) };
        } catch (e) { erroTotal += `proof: ${e.message}\n`; status = 1; }
        entrada = "";
      } else if (ultimo) {
        if (!(r.jaEscreveu && aoVivo)) saidaTotal += saida;
      } else entrada = saida;
    }
  }
  return { estado, saida: saidaTotal, erro: erroTotal, status, efeitos };
}

async function executarComando(argv, contexto) {
  const [nome, ...args] = argv;
  const { estado } = contexto;
  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(nome) && !args.length) return BUILTINS.export([nome], contexto);
  if (BUILTINS[nome]) return BUILTINS[nome](args, contexto);
  const pedido = pedidoDoPrograma(argv, estado);
  if (!pedido) {
    const c = normalizarCaminho(estado.cwd, nome);
    const dica = ehArquivo(estado.projeto, c) && comandoParaRodar(c) ? ` (para rodar este arquivo: ${comandoParaRodar(c)})` : "";
    return falha(`${nome}: comando não encontrado${dica}. Digite help para ver os comandos.`, 127);
  }
  if (pedido.erro) return falha(pedido.erro);
  if (pedido.tipo === "texto") return ok(pedido.saida);
  if (pedido.tipo === "previa") return { ...ok(`Abrindo a prévia de ${caminhoParaMostrar(pedido.caminho)}…\n`), efeitos: [{ tipo: "previa", caminho: pedido.caminho }] };
  if (pedido.tipo === "repl" && contexto.entrada === null) return { ...ok(), efeitos: [{ tipo: "repl", linguagem: pedido.linguagem }] };
  if (pedido.tipo === "repl") {
    // "echo 'print(1)' | python": a entrada vira o programa
    const executor = pedido.linguagem === "python" ? "python" : "js";
    return rodarPedido({ tipo: "programa", executor, codigo: contexto.entrada, linguagem: linguagemDoArquivo(executor === "python" ? "x.py" : "x.js"), args: [] }, { ...contexto, entrada: "" });
  }
  if (pedido.tipo === "sql" && pedido.sql === null && contexto.entrada === null) return { ...ok(), efeitos: [{ tipo: "repl", linguagem: "sql", banco: pedido.banco }] };
  return rodarPedido(pedido, contexto);
}

async function rodarPedido(pedido, { estado, entrada: entradaDoComando, ctx, aoEscrever }) {
  if (!ctx.rodar) return falha("este terminal não roda programas");
  // sem < nem |, vale a entrada que o terminal pediu antes de rodar (o programa que lê input/scanf)
  const entrada = entradaDoComando ?? ctx.entradaPadrao ?? null;
  if (pedido.tipo === "sql" && pedido.sql === null) pedido = { ...pedido, sql: entrada ?? "" };
  if (pedido.tipo === "compilar") {
    const r = await ctx.rodar({ ...pedido, projeto: estado.projeto, cwd: estado.cwd, entrada: "", aoEscrever, sinal: ctx.sinal });
    if (r.status !== 0) return { saida: r.saida || "", erro: r.erro || "", status: r.status || 1, jaEscreveu: r.jaEscreveu };
    const marca = IDE.marcaDeBinario + JSON.stringify({ executor: "servidor", compilador: pedido.linguagem.compilador, linguagem: pedido.linguagem, arquivo: pedido.fontes[0], fontes: pedido.fontes, opcoes: pedido.opcoes || [] }) + "\n";
    return { saida: r.saida || "", erro: r.erro || "", status: 0, estado: { ...estado, projeto: escrever(estado.projeto, pedido.saida, marca) } };
  }
  const p = pedido.tipo === "binario" ? { ...pedido, tipo: "programa" } : pedido;
  const r = await ctx.rodar({ ...p, projeto: estado.projeto, cwd: estado.cwd, entrada: entrada ?? "", aoEscrever, sinal: ctx.sinal });
  const novoEstado = r.projeto ? { ...estado, projeto: r.projeto } : estado;
  return { saida: r.saida || "", erro: r.erro || "", status: r.status ?? 0, estado: novoEstado, jaEscreveu: r.jaEscreveu };
}

// ------------------------------------------------------------------ o programa que vai ler a entrada

/**
 * A linha roda um programa que lê a entrada (input, scanf, Scanner...) sem < nem | para dar essa entrada? Então o
 * terminal pede as linhas antes de rodar. Vale também para "gcc main.c -o app && ./app": o ./app ainda não existe,
 * mas o main.c que vai virar ele sim.
 */
export function precisaDeEntrada(linha, estado) {
  let sequencia;
  try { sequencia = analisar(tokenizar(linha, estado.env)); } catch { return false; }
  const compilados = new Map();
  for (const { pipeline } of sequencia) {
    const cmd = pipeline[0];
    if (!cmd || cmd.entrada !== null) continue;
    const argv = cmd.argv.map((t) => t.valor);
    let pedido;
    const alvo = argv[0] && (argv[0].startsWith("./") || argv[0].startsWith("/")) ? normalizarCaminho(estado.cwd, argv[0]) : null;
    if (alvo && compilados.has(alvo) && !ehArquivo(estado.projeto, alvo)) pedido = compilados.get(alvo);
    else { try { pedido = pedidoDoPrograma(argv, estado); } catch { pedido = null; } }
    if (!pedido || pedido.erro) continue;
    if (pedido.tipo === "compilar") { compilados.set(pedido.saida, { tipo: "programa", linguagem: pedido.linguagem, fontes: pedido.fontes, arquivo: pedido.fontes[0] }); continue; }
    if (pedido.tipo !== "programa" && pedido.tipo !== "binario") continue;
    const fontes = pedido.fontes?.length ? pedido.fontes : [pedido.arquivo].filter(Boolean);
    const codigo = pedido.codigo ?? fontes.map((f) => estado.projeto.arquivos[f] || "").join("\n");
    if (leEntrada(codigo, pedido.linguagem)) return true;
  }
  return false;
}

// ------------------------------------------------------------------ completar com Tab

/**
 * O Tab: completa o comando (na 1ª palavra) ou o caminho. Devolve { linha, opcoes } — `opcoes` com mais de uma
 * quando não dá para decidir (a tela mostra a lista, como no bash).
 */
export function completar(linha, estado) {
  const m = /(\S*)$/.exec(linha);
  const atual = m ? m[1] : "";
  const antes = linha.slice(0, linha.length - atual.length);
  const primeira = !antes.trim() || /(\|\||&&|[|;])\s*$/.test(antes);
  let candidatos;
  if (primeira && !atual.includes("/")) {
    candidatos = [...new Set([...Object.keys(BUILTINS), ...PROGRAMAS_CONHECIDOS])].filter((c) => c.startsWith(atual)).sort().map((c) => c + " ");
  } else {
    const barra = atual.lastIndexOf("/");
    const pastaDigitada = barra >= 0 ? atual.slice(0, barra + 1) : "";
    const pedacoDoNome = atual.slice(barra + 1);
    const pasta = normalizarCaminho(estado.cwd, pastaDigitada || ".");
    if (!ehPasta(estado.projeto, pasta)) return { linha, opcoes: [] };
    candidatos = listar(estado.projeto, pasta).filter((f) => f.nome.startsWith(pedacoDoNome)).map((f) => pastaDigitada + f.nome + (f.tipo === "pasta" ? "/" : " "));
  }
  if (!candidatos.length) return { linha, opcoes: [] };
  if (candidatos.length === 1) return { linha: antes + candidatos[0], opcoes: [] };
  let comum = candidatos[0];
  for (const c of candidatos) while (!c.startsWith(comum)) comum = comum.slice(0, -1);
  return { linha: antes + (comum.length > atual.length ? comum : atual), opcoes: candidatos.map((c) => c.trim()) };
}
