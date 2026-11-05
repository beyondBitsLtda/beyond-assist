// A IDE livre da Prática (05/11/2026: "ponha um modo de IDE e terminal livre para os usuários poderem escrever
// seus códigos e testarem; faça esse terminal da forma mais completa possível").
//
// Aqui, sem rede nem tela (testado em scripts/dominio-check.mjs): o sistema de arquivos do projeto, as linguagens
// por extensão (onde cada uma roda e com que comando), os limites, os modelos de projeto e a detecção de
// programas que leem a entrada. O terminal (os comandos) mora em ./shell.js; quem roda o código, em
// src/componentes/ide/executores.js; quem guarda o projeto na conta, em src/lib/ide.js.
//
// O PROJETO é { nome, arquivos: { "/caminho/arquivo.ext": "conteúdo" }, pastas: ["/caminho"], principal }.
// Os caminhos são absolutos a partir da raiz do projeto ("/"), que o terminal mostra como "~".

export const IDE = {
  maxProjetos: 30,
  maxArquivos: 300,
  maxTamanhoDoArquivo: 200_000,   // letras
  maxTamanhoDoProjeto: 1_500_000,
  maxNome: 80,
  // o "executável" que o gcc, o javac e o rustc deixam no projeto: roda no compilador on-line ao chamar ./nome
  marcaDeBinario: "#!proof-binario ",
};

// ------------------------------------------------------------------ as linguagens, pela extensão

// `executor`: "js" (Worker do navegador), "python" (Pyodide, no navegador), "sql" (SQLite do navegador),
// "servidor" (o compilador on-line, Wandbox, com o `compilador` dele), "previa" (a página web) ou null (só texto).
// `editor`: a chave de cor do editor (src/componentes/codigo/linguagens.js).
const L = (rotulo, editor, executor, extra = {}) => ({ rotulo, editor, executor, ...extra });
export const LINGUAGENS_DA_IDE = {
  js: L("JavaScript", "javascript", "js"),
  mjs: L("JavaScript (módulo)", "javascript", "js"),
  cjs: L("JavaScript (CommonJS)", "javascript", "js"),
  jsx: L("JavaScript (JSX)", "jsx", null),
  ts: L("TypeScript", "typescript", "servidor", { compilador: "typescript-5.6.2", chave: "typescript" }),
  py: L("Python", "python", "python"),
  sql: L("SQL (SQLite)", "sql", "sql"),
  html: L("HTML", "html", "previa"),
  htm: L("HTML", "html", "previa"),
  css: L("CSS", "css", null),
  json: L("JSON", "json", null),
  md: L("Markdown", "markdown", null),
  txt: L("Texto", "", null),
  csv: L("CSV", "", null),
  c: L("C", "cpp", "servidor", { compilador: "gcc-13.2.0-c", chave: "c", compila: true }),
  h: L("C (cabeçalho)", "cpp", null),
  cpp: L("C++", "cpp", "servidor", { compilador: "gcc-13.2.0", chave: "cpp", compila: true }),
  cc: L("C++", "cpp", "servidor", { compilador: "gcc-13.2.0", chave: "cpp", compila: true }),
  hpp: L("C++ (cabeçalho)", "cpp", null),
  java: L("Java", "java", "servidor", { compilador: "openjdk-jdk-21+35", chave: "java" }),
  cs: L("C#", "csharp", "servidor", { compilador: "mono-6.12.0.199", chave: "csharp" }),
  go: L("Go", "go", "servidor", { compilador: "go-1.23.2", chave: "go" }),
  rs: L("Rust", "rust", "servidor", { compilador: "rust-1.82.0", chave: "rust", compila: true }),
  rb: L("Ruby", "ruby", "servidor", { compilador: "ruby-3.4.9", chave: "ruby" }),
  php: L("PHP", "php", "servidor", { compilador: "php-8.3.12", chave: "php" }),
  swift: L("Swift", "swift", "servidor", { compilador: "swift-6.0.1", chave: "swift" }),
  lua: L("Lua", "lua", "servidor", { compilador: "lua-5.4.7", chave: "lua" }),
  sh: L("Bash", "shell", "servidor", { compilador: "bash", chave: "shell" }),
  pl: L("Perl", "perl", "servidor", { compilador: "perl-5.40.0", chave: "perl" }),
  r: L("R", "r", "servidor", { compilador: "r-4.4.1", chave: "r" }),
  hs: L("Haskell", "haskell", "servidor", { compilador: "ghc-9.10.1", chave: "haskell" }),
  exs: L("Elixir", "", "servidor", { compilador: "elixir-1.17.3", chave: "elixir" }),
  ex: L("Elixir", "", "servidor", { compilador: "elixir-1.17.3", chave: "elixir" }),
  scala: L("Scala", "scala", "servidor", { compilador: "scala-3.5.1", chave: "scala" }),
  jl: L("Julia", "julia", "servidor", { compilador: "julia-1.10.5", chave: "julia" }),
  nim: L("Nim", "", "servidor", { compilador: "nim-2.2.4", chave: "nim" }),
  zig: L("Zig", "", "servidor", { compilador: "zig-0.13.0", chave: "zig" }),
  pas: L("Pascal", "pascal", "servidor", { compilador: "fpc-3.2.2", chave: "pascal" }),
  ml: L("OCaml", "", "servidor", { compilador: "ocaml-5.2.0", chave: "ocaml" }),
  groovy: L("Groovy", "groovy", "servidor", { compilador: "groovy-4.0.23", chave: "groovy" }),
  cr: L("Crystal", "", "servidor", { compilador: "crystal-1.13.3", chave: "crystal" }),
  d: L("D", "", "servidor", { compilador: "ldc-1.39.0", chave: "d" }),
};

/** Os compiladores que a IDE pode pedir ao servidor (a rota confere contra esta lista). */
export const COMPILADORES_DA_IDE = new Set(Object.values(LINGUAGENS_DA_IDE).map((l) => l.compilador).filter(Boolean));

export const extensaoDe = (caminho) => {
  const nome = nomeDe(caminho);
  const i = nome.lastIndexOf(".");
  return i > 0 ? nome.slice(i + 1).toLowerCase() : "";
};

/** A linguagem do arquivo (pela extensão). Sem extensão conhecida: texto, sem rodar. */
export function linguagemDoArquivo(caminho) {
  const ext = extensaoDe(caminho);
  const l = LINGUAGENS_DA_IDE[ext];
  if (l) return { ext, ...l };
  if (nomeDe(caminho).toLowerCase() === "makefile") return { ext: "", rotulo: "Makefile", editor: "", executor: null };
  return { ext, rotulo: ext ? ext.toUpperCase() : "Texto", editor: "", executor: null };
}

// ------------------------------------------------------------------ os caminhos

export const nomeDe = (caminho) => String(caminho || "").split("/").filter(Boolean).pop() || "";
export const pastaDe = (caminho) => {
  const partes = String(caminho || "").split("/").filter(Boolean);
  partes.pop();
  return "/" + partes.join("/");
};

/** O caminho absoluto de `alvo` a partir da pasta `atual` ("~" é a raiz do projeto; "." e ".." valem). */
export function normalizarCaminho(atual, alvo = "") {
  let t = String(alvo ?? "").trim();
  if (t === "~" || t.startsWith("~/")) t = "/" + t.slice(1);
  const base = t.startsWith("/") ? [] : String(atual || "/").split("/").filter(Boolean);
  for (const parte of t.split("/")) {
    if (!parte || parte === ".") continue;
    if (parte === "..") base.pop();
    else base.push(parte);
  }
  return "/" + base.join("/");
}

/** Como o terminal mostra o caminho: "~" na raiz, "~/src" dentro dela. */
export const caminhoParaMostrar = (caminho) => (caminho === "/" ? "~" : `~${caminho}`);

const PROIBIDOS = /[\\:*?"<>|\u0000-\u001f]/;
/** O nome de um arquivo ou pasta: sem barra, sem caracteres que o Windows recusa, até 80 letras. */
export function nomeValido(nome) {
  const n = String(nome ?? "");
  if (!n.trim()) return { ok: false, erro: "o nome está vazio" };
  if (n.includes("/")) return { ok: false, erro: "o nome não pode ter barra" };
  if (n === "." || n === "..") return { ok: false, erro: "nome reservado" };
  if (PROIBIDOS.test(n)) return { ok: false, erro: `o nome "${n}" tem um caractere que não pode` };
  if (n.length > IDE.maxNome) return { ok: false, erro: "o nome passou de 80 letras" };
  return { ok: true, nome: n };
}

// ------------------------------------------------------------------ o sistema de arquivos (imutável)

export const projetoVazio = (nome = "Meu projeto") => ({ nome, arquivos: {}, pastas: [], principal: "" });

export const ehArquivo = (p, caminho) => Object.prototype.hasOwnProperty.call(p.arquivos, caminho);
export const ehPasta = (p, caminho) => caminho === "/" || p.pastas.includes(caminho) || Object.keys(p.arquivos).some((a) => a.startsWith(caminho + "/")) || p.pastas.some((d) => d.startsWith(caminho + "/"));
export const existe = (p, caminho) => ehArquivo(p, caminho) || ehPasta(p, caminho);

/** Todas as pastas (as criadas e as que existem por terem arquivos dentro). */
export function todasAsPastas(p) {
  const s = new Set(["/"]);
  const somar = (caminho) => {
    let atual = pastaDe(caminho);
    while (atual !== "/") { s.add(atual); atual = pastaDe(atual); }
  };
  for (const d of p.pastas) { s.add(d); somar(d); }
  for (const a of Object.keys(p.arquivos)) somar(a);
  return [...s].sort();
}

/** O que há dentro da pasta: pastas primeiro, depois arquivos, em ordem alfabética. */
export function listar(p, pasta = "/") {
  const prefixo = pasta === "/" ? "/" : pasta + "/";
  const filhos = new Map();
  for (const d of todasAsPastas(p)) {
    if (d !== pasta && d.startsWith(prefixo) && !d.slice(prefixo.length).includes("/")) filhos.set(d, { nome: nomeDe(d), caminho: d, tipo: "pasta", tamanho: 0 });
  }
  for (const [a, conteudo] of Object.entries(p.arquivos)) {
    if (a.startsWith(prefixo) && !a.slice(prefixo.length).includes("/")) filhos.set(a, { nome: nomeDe(a), caminho: a, tipo: "arquivo", tamanho: conteudo.length });
  }
  return [...filhos.values()].sort((x, y) => (x.tipo === y.tipo ? x.nome.localeCompare(y.nome) : x.tipo === "pasta" ? -1 : 1));
}

const erro = (mensagem) => { const e = new Error(mensagem); e.doTerminal = true; return e; };
const semAPasta = (pastas, alvo) => pastas.filter((d) => d !== alvo && !d.startsWith(alvo + "/"));

function conferirNomeDoCaminho(caminho) {
  if (caminho === "/") throw erro("a raiz do projeto não tem nome");
  for (const parte of caminho.split("/").filter(Boolean)) {
    const v = nomeValido(parte);
    if (!v.ok) throw erro(v.erro);
  }
}

/** Grava um arquivo (cria as pastas do caminho). `acrescentar` soma no fim (o ">>" do terminal). */
export function escrever(p, caminho, conteudo, { acrescentar = false } = {}) {
  conferirNomeDoCaminho(caminho);
  if (ehPasta(p, caminho) && !ehArquivo(p, caminho)) throw erro(`${nomeDe(caminho)}: é uma pasta`);
  for (let pai = pastaDe(caminho); pai !== "/"; pai = pastaDe(pai)) if (ehArquivo(p, pai)) throw erro(`${nomeDe(pai)}: não é uma pasta`);
  const novo = acrescentar && ehArquivo(p, caminho) ? p.arquivos[caminho] + String(conteudo ?? "") : String(conteudo ?? "");
  if (novo.length > IDE.maxTamanhoDoArquivo) throw erro(`${nomeDe(caminho)}: passou de ${IDE.maxTamanhoDoArquivo.toLocaleString("pt-BR")} letras`);
  if (!ehArquivo(p, caminho) && Object.keys(p.arquivos).length >= IDE.maxArquivos) throw erro(`o projeto chegou a ${IDE.maxArquivos} arquivos`);
  return { ...p, arquivos: { ...p.arquivos, [caminho]: novo } };
}

/** Cria uma pasta (`pais`: cria as do meio também, o "mkdir -p"). */
export function criarPasta(p, caminho, { pais = false } = {}) {
  conferirNomeDoCaminho(caminho);
  if (ehArquivo(p, caminho)) throw erro(`${nomeDe(caminho)}: já existe um arquivo com esse nome`);
  if (ehPasta(p, caminho)) {
    if (pais) return p;
    throw erro(`${nomeDe(caminho)}: a pasta já existe`);
  }
  const pai = pastaDe(caminho);
  if (!pais && !ehPasta(p, pai)) throw erro(`${caminhoParaMostrar(pai)}: a pasta não existe (use mkdir -p)`);
  return { ...p, pastas: [...p.pastas, caminho].sort() };
}

/** Apaga um arquivo, ou uma pasta (só com `recursivo`, se tiver coisa dentro). */
export function remover(p, caminho, { recursivo = false } = {}) {
  if (caminho === "/") throw erro("não dá para apagar a raiz do projeto");
  if (ehArquivo(p, caminho)) {
    const { [caminho]: _, ...resto } = p.arquivos;
    return { ...p, arquivos: resto, principal: p.principal === caminho ? "" : p.principal };
  }
  if (!ehPasta(p, caminho)) throw erro(`${nomeDe(caminho)}: não existe`);
  const dentro = Object.keys(p.arquivos).filter((a) => a.startsWith(caminho + "/"));
  const subpastas = p.pastas.filter((d) => d.startsWith(caminho + "/"));
  if ((dentro.length || subpastas.length) && !recursivo) throw erro(`${nomeDe(caminho)}: a pasta não está vazia (use rm -r)`);
  const arquivos = Object.fromEntries(Object.entries(p.arquivos).filter(([a]) => !a.startsWith(caminho + "/")));
  return { ...p, arquivos, pastas: semAPasta(p.pastas, caminho), principal: p.principal.startsWith(caminho + "/") ? "" : p.principal };
}

/** Move (ou renomeia). Se o destino é uma pasta que existe, vai para dentro dela. */
export function mover(p, de, para) {
  if (!existe(p, de)) throw erro(`${nomeDe(de)}: não existe`);
  if (de === "/") throw erro("não dá para mover a raiz do projeto");
  let destino = para;
  if (ehPasta(p, para) && !ehArquivo(p, para)) destino = normalizarCaminho(para, nomeDe(de));
  if (destino === de) return p;
  if (destino.startsWith(de + "/")) throw erro("não dá para mover uma pasta para dentro dela mesma");
  if (existe(p, destino) && !(ehArquivo(p, de) && ehArquivo(p, destino))) throw erro(`${nomeDe(destino)}: já existe`);
  conferirNomeDoCaminho(destino);
  if (ehArquivo(p, de)) {
    const { [de]: conteudo, ...resto } = p.arquivos;
    return { ...p, arquivos: { ...resto, [destino]: conteudo }, principal: p.principal === de ? destino : p.principal };
  }
  const trocar = (c) => (c === de ? destino : c.startsWith(de + "/") ? destino + c.slice(de.length) : c);
  const arquivos = Object.fromEntries(Object.entries(p.arquivos).map(([a, c]) => [trocar(a), c]));
  return { ...p, arquivos, pastas: [...new Set(p.pastas.map(trocar).concat(destino))].sort(), principal: trocar(p.principal) };
}

/** Copia um arquivo, ou uma pasta inteira (com `recursivo`). */
export function copiar(p, de, para, { recursivo = false } = {}) {
  if (!existe(p, de)) throw erro(`${nomeDe(de)}: não existe`);
  let destino = para;
  if (ehPasta(p, para) && !ehArquivo(p, para)) destino = normalizarCaminho(para, nomeDe(de));
  if (ehArquivo(p, de)) return escrever(p, destino, p.arquivos[de]);
  if (!recursivo) throw erro(`${nomeDe(de)}: é uma pasta (use cp -r)`);
  if (destino.startsWith(de + "/") || destino === de) throw erro("não dá para copiar uma pasta para dentro dela mesma");
  let novo = criarPasta(p, destino, { pais: true });
  for (const [a, c] of Object.entries(p.arquivos)) if (a.startsWith(de + "/")) novo = escrever(novo, destino + a.slice(de.length), c);
  for (const d of p.pastas) if (d.startsWith(de + "/")) novo = criarPasta(novo, destino + d.slice(de.length), { pais: true });
  return novo;
}

/** A árvore da pasta, em linhas (o "tree"). */
export function arvore(p, pasta = "/") {
  const linhas = [caminhoParaMostrar(pasta)];
  let pastas = 0, arquivos = 0;
  const descer = (atual, recuo) => {
    const filhos = listar(p, atual);
    filhos.forEach((f, i) => {
      const ultimo = i === filhos.length - 1;
      linhas.push(`${recuo}${ultimo ? "└── " : "├── "}${f.nome}${f.tipo === "pasta" ? "/" : ""}`);
      if (f.tipo === "pasta") { pastas++; descer(f.caminho, recuo + (ultimo ? "    " : "│   ")); } else arquivos++;
    });
  };
  descer(pasta, "");
  linhas.push("", `${pastas} pasta(s), ${arquivos} arquivo(s)`);
  return linhas;
}

/** O projeto que chega da tela (ou do banco), conferido: só strings, caminhos válidos e dentro dos limites. */
export function conferirProjeto(bruto) {
  const nome = String(bruto?.nome ?? "").trim().slice(0, IDE.maxNome) || "Meu projeto";
  const arquivos = {};
  let total = 0;
  for (const [cru, conteudo] of Object.entries(bruto?.arquivos && typeof bruto.arquivos === "object" ? bruto.arquivos : {})) {
    const caminho = normalizarCaminho("/", cru);
    if (caminho === "/" || typeof conteudo !== "string") continue;
    if (caminho.split("/").filter(Boolean).some((parte) => !nomeValido(parte).ok)) return { ok: false, erro: `nome inválido: ${caminho}` };
    if (conteudo.length > IDE.maxTamanhoDoArquivo) return { ok: false, erro: `${nomeDe(caminho)} passou do tamanho máximo de um arquivo` };
    arquivos[caminho] = conteudo;
    total += conteudo.length + caminho.length;
  }
  if (Object.keys(arquivos).length > IDE.maxArquivos) return { ok: false, erro: `o projeto passou de ${IDE.maxArquivos} arquivos` };
  if (total > IDE.maxTamanhoDoProjeto) return { ok: false, erro: "o projeto passou do tamanho máximo (1,5 milhão de letras)" };
  const pastas = [...new Set((Array.isArray(bruto?.pastas) ? bruto.pastas : []).map((d) => normalizarCaminho("/", d)).filter((d) => d !== "/" && d.split("/").filter(Boolean).every((parte) => nomeValido(parte).ok)))].sort().slice(0, IDE.maxArquivos);
  const principal = typeof bruto?.principal === "string" && arquivos[normalizarCaminho("/", bruto.principal)] !== undefined ? normalizarCaminho("/", bruto.principal) : "";
  return { ok: true, projeto: { nome, arquivos, pastas, principal } };
}

export const tamanhoDoProjeto = (p) => Object.entries(p.arquivos).reduce((s, [a, c]) => s + a.length + c.length, 0);

/**
 * O que mudou de `antes` para `depois` (o que um comando ou programa fez). Aplicada sobre o projeto de AGORA, a
 * diferença não desfaz o que a pessoa digitou no editor enquanto o programa rodava.
 */
export function diferencaDoProjeto(antes, depois) {
  const escritos = {}, apagados = [];
  for (const [c, t] of Object.entries(depois.arquivos)) if (antes.arquivos[c] !== t) escritos[c] = t;
  for (const c of Object.keys(antes.arquivos)) if (!(c in depois.arquivos)) apagados.push(c);
  const pastasNovas = depois.pastas.filter((d) => !antes.pastas.includes(d));
  const pastasApagadas = antes.pastas.filter((d) => !depois.pastas.includes(d));
  const vazia = !Object.keys(escritos).length && !apagados.length && !pastasNovas.length && !pastasApagadas.length && antes.principal === depois.principal;
  return vazia ? null : { escritos, apagados, pastasNovas, pastasApagadas, principal: antes.principal !== depois.principal ? depois.principal : undefined };
}

export function aplicarDiferenca(p, d) {
  if (!d) return p;
  const arquivos = { ...p.arquivos };
  for (const c of d.apagados) delete arquivos[c];
  Object.assign(arquivos, d.escritos);
  const pastas = [...new Set(p.pastas.filter((x) => !d.pastasApagadas.includes(x)).concat(d.pastasNovas))].sort();
  const principal = d.principal !== undefined ? d.principal : p.principal && p.principal in arquivos ? p.principal : "";
  return { ...p, arquivos, pastas, principal };
}

// ------------------------------------------------------------------ o programa que lê a entrada

const LEITURAS = {
  python: /\binput\s*\(|sys\.stdin/,
  js: /\bprompt\s*\(|readline|process\.stdin/,
  c: /\bscanf\s*\(|\bgets\s*\(|\bfgets\s*\(|getchar\s*\(|\bstdin\b/,
  cpp: /\bcin\s*>>|\bgetline\s*\(|\bscanf\s*\(|\bstdin\b/,
  java: /new\s+Scanner\s*\(\s*System\.in|System\.in\.read|BufferedReader/,
  csharp: /Console\.Read(Line)?\s*\(/,
  go: /bufio\.NewReader\s*\(\s*os\.Stdin|bufio\.NewScanner\s*\(\s*os\.Stdin|fmt\.Scan/,
  rust: /stdin\s*\(\s*\)/,
  ruby: /\bgets\b|STDIN|\$stdin/,
  php: /fgets\s*\(\s*STDIN|readline\s*\(|fscanf\s*\(\s*STDIN|php:\/\/stdin/,
  lua: /io\.read|io\.stdin/,
  shell: /\bread\s+-?\w/,
  perl: /<STDIN>|<>/,
};

/** O programa lê a entrada (input(), scanf, Scanner(System.in)...)? Assim o terminal pede as linhas antes de rodar. */
export function leEntrada(codigo, linguagem) {
  const l = linguagem?.chave || ({ js: "js", python: "python", sql: "sql" })[linguagem?.executor] || "";
  const re = LEITURAS[l] || LEITURAS[{ typescript: "js" }[l]];
  return Boolean(re && re.test(String(codigo || "")));
}

// ------------------------------------------------------------------ os modelos de projeto

const LEIA = (titulo, rodar) => `# ${titulo}\n\nProjeto criado na IDE do Proof.\n\nPara rodar, abra o terminal (embaixo) e digite:\n\n    ${rodar}\n\nOu aperte Ctrl+Enter no editor. Digite \`help\` no terminal para ver todos os comandos.\n`;

export const MODELOS_DE_PROJETO = {
  vazio: { nome: "Projeto vazio", icone: "📁", descricao: "Comece do zero", principal: "", arquivos: { "/LEIAME.md": "# Meu projeto\n\nDigite `help` no terminal para ver os comandos.\n" } },
  javascript: {
    nome: "JavaScript", icone: "🟨", descricao: "Node no navegador: require, módulos, fs e npm pelo esm.sh", principal: "/index.js",
    arquivos: {
      "/index.js": "// Rode com: node index.js\nconst { saudar } = require(\"./util.js\");\n\nconst nomes = [\"Ana\", \"Bia\", \"Caio\"];\nfor (const nome of nomes) console.log(saudar(nome));\n\nconsole.log(\"Total:\", nomes.length);\n",
      "/util.js": "function saudar(nome) {\n  return `Olá, ${nome}!`;\n}\n\nmodule.exports = { saudar };\n",
      "/LEIAME.md": LEIA("JavaScript", "node index.js"),
    },
  },
  python: {
    nome: "Python", icone: "🐍", descricao: "Python 3 no navegador, com pip install e o modo interativo", principal: "/main.py",
    arquivos: {
      "/main.py": "# Rode com: python main.py\nfrom util import media\n\nnotas = [7.5, 8, 9.25]\nprint(\"Notas:\", notas)\nprint(f\"Média: {media(notas):.2f}\")\n\nnome = input(\"Seu nome: \")\nprint(f\"Até mais, {nome}!\")\n",
      "/util.py": "def media(valores):\n    return sum(valores) / len(valores)\n",
      "/LEIAME.md": LEIA("Python", "python main.py"),
    },
  },
  web: {
    nome: "Página web", icone: "🌐", descricao: "HTML, CSS e JavaScript com prévia ao vivo", principal: "/index.html",
    arquivos: {
      "/index.html": "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n  <meta charset=\"utf-8\">\n  <title>Minha página</title>\n  <link rel=\"stylesheet\" href=\"estilo.css\">\n</head>\n<body>\n  <h1>Olá, mundo!</h1>\n  <button id=\"botao\">Clique aqui</button>\n  <p id=\"contador\">0 cliques</p>\n  <script src=\"app.js\"></script>\n</body>\n</html>\n",
      "/estilo.css": "body {\n  font-family: system-ui, sans-serif;\n  padding: 24px;\n  background: #10140f;\n  color: #eef5e6;\n}\n\nbutton {\n  padding: 10px 16px;\n  border-radius: 10px;\n  border: 0;\n  background: #a3e635;\n  font-weight: 700;\n  cursor: pointer;\n}\n",
      "/app.js": "let cliques = 0;\nconst contador = document.getElementById(\"contador\");\n\ndocument.getElementById(\"botao\").addEventListener(\"click\", () => {\n  cliques++;\n  contador.textContent = `${cliques} clique${cliques === 1 ? \"\" : \"s\"}`;\n  console.log(\"clicou\", cliques);\n});\n",
      "/LEIAME.md": LEIA("Página web", "preview"),
    },
  },
  c: {
    nome: "C", icone: "🔧", descricao: "gcc 13: compile e rode o executável", principal: "/main.c",
    arquivos: {
      "/main.c": "#include <stdio.h>\n\nint main(void) {\n    int n;\n    printf(\"Quantos números? \");\n    if (scanf(\"%d\", &n) != 1) return 1;\n    int soma = 0;\n    for (int i = 1; i <= n; i++) soma += i;\n    printf(\"\\nA soma de 1 a %d é %d\\n\", n, soma);\n    return 0;\n}\n",
      "/LEIAME.md": LEIA("C", "gcc main.c -o app && ./app"),
    },
  },
  cpp: {
    nome: "C++", icone: "⚙️", descricao: "g++ 13 com a biblioteca padrão", principal: "/main.cpp",
    arquivos: {
      "/main.cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n\nint main() {\n    std::vector<int> v{5, 3, 8, 1};\n    std::sort(v.begin(), v.end());\n    for (int x : v) std::cout << x << ' ';\n    std::cout << '\\n';\n}\n",
      "/LEIAME.md": LEIA("C++", "g++ main.cpp -o app && ./app"),
    },
  },
  java: {
    nome: "Java", icone: "☕", descricao: "OpenJDK 21", principal: "/Main.java",
    arquivos: {
      "/Main.java": "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        List<String> linguagens = new ArrayList<>(List.of(\"Java\", \"Python\", \"C\"));\n        Collections.sort(linguagens);\n        System.out.println(\"Em ordem: \" + linguagens);\n    }\n}\n",
      "/LEIAME.md": LEIA("Java", "java Main.java"),
    },
  },
  sql: {
    nome: "SQL", icone: "🗃️", descricao: "SQLite no navegador, com o modo interativo", principal: "/consultas.sql",
    arquivos: {
      "/consultas.sql": "-- Rode com: sqlite3 < consultas.sql   (ou abra o modo interativo: sqlite3 loja.db)\nCREATE TABLE produtos (id INTEGER PRIMARY KEY, nome TEXT, preco REAL);\nINSERT INTO produtos (nome, preco) VALUES ('Teclado', 150), ('Mouse', 80), ('Monitor', 900);\n\nSELECT nome, preco FROM produtos WHERE preco > 100 ORDER BY preco DESC;\n",
      "/LEIAME.md": LEIA("SQL", "sqlite3 < consultas.sql"),
    },
  },
  lua: {
    nome: "Lua", icone: "🌙", descricao: "Lua 5.4", principal: "/main.lua",
    arquivos: {
      "/main.lua": "-- Rode com: lua main.lua\nlocal frutas = { \"maçã\", \"banana\", \"uva\" }\n\nfor i, fruta in ipairs(frutas) do\n  print(i .. \": \" .. fruta)\nend\n\nlocal function fatorial(n)\n  if n <= 1 then return 1 end\n  return n * fatorial(n - 1)\nend\n\nprint(\"5! = \" .. fatorial(5))\n",
      "/LEIAME.md": LEIA("Lua", "lua main.lua"),
    },
  },
  go: {
    nome: "Go", icone: "🐹", descricao: "Go 1.23", principal: "/main.go",
    arquivos: {
      "/main.go": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfor i := 1; i <= 3; i++ {\n\t\tfmt.Printf(\"Olá %d vez(es)\\n\", i)\n\t}\n}\n",
      "/LEIAME.md": LEIA("Go", "go run main.go"),
    },
  },
};

/** Um projeto novo a partir do modelo. */
export function projetoDoModelo(chave, nome) {
  const m = MODELOS_DE_PROJETO[chave] || MODELOS_DE_PROJETO.vazio;
  return { nome: String(nome || "").trim().slice(0, IDE.maxNome) || m.nome, arquivos: { ...m.arquivos }, pastas: [], principal: m.principal };
}
