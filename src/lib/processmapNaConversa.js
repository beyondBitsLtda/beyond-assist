// Os projetos do ProcessMap na conversa (01/11/2026): "faça a Lisa poder trabalhar num projeto do
// ProcessMap específico — na conversa eu falo 'Lisa, no projeto X do ProcessMap, faça tal coisa' — e
// ela ter a capacidade de ver os fluxogramas de lá e ter o contexto perfeito para trabalhar".
//
// Aqui, sem rede e sem banco (testado em scripts/fluxogramas-check.mjs): reconhecer na pergunta o
// projeto citado (pelo nome, aguentando erro de digitação) e, dentro dele, o fluxo citado; e montar o
// texto com todos os fluxogramas do projeto, que vai junto da pergunta (/api/ask) ou do pedido de
// desenho (/api/diagrama). Quem busca os projetos e salva o resultado é a página do Assistente.

import { descreverDiagrama, distanciaDeEdicao } from "./diagramaDaLisa.js";

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const palavrasDe = (texto) => semAcento(texto).split(/[^a-z0-9]+/).filter(Boolean);
// palavras que não identificam um projeto ou um fluxo ("o fluxo de compras" é identificado por "compras")
const VAZIAS = new Set(["a", "o", "as", "os", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas", "um", "uma", "para", "pra", "com", "por"]);
const GENERICAS = new Set(["projeto", "projetos", "fluxo", "fluxos", "fluxograma", "fluxogramas", "mapa", "mapas", "mental", "mentais", "novo", "nova", "processo", "processos", "diagrama", "diagramas", "meus", "minhas", "meu", "minha"]);
const folgaDe = (p) => (p.length <= 4 ? 0 : p.length <= 7 ? 1 : 2);
const parecida = (a, b) => a === b || (Math.abs(a.length - b.length) <= folgaDe(b) && distanciaDeEdicao(a, b) <= folgaDe(b));

/** A pergunta fala de um projeto do ProcessMap ("no projeto X", "do processmap")? */
export function citaProjeto(pergunta) {
  const p = palavrasDe(pergunta);
  return p.some((x) => x === "projeto" || x === "projetos" || parecida(x, "processmap")) || /\bprocess map\b/.test(semAcento(pergunta));
}

/**
 * Quão bem o nome aparece na pergunta: o número de palavras do nome que estão nela (cada uma pode ter
 * erro de digitação), se TODAS as que identificam estão; 0 se falta alguma. Nome só de palavras
 * genéricas ("Novo fluxograma") só vale escrito igual.
 */
function encaixe(nome, palavras, texto) {
  const doNome = palavrasDe(nome).filter((x) => !VAZIAS.has(x));
  const fortes = doNome.filter((x) => !GENERICAS.has(x));
  if (!fortes.length) return doNome.length && texto.includes(doNome.join(" ")) ? doNome.length : 0;
  return fortes.every((f) => palavras.some((p) => parecida(p, f))) ? fortes.length + doNome.length * 0.01 : 0;
}

function melhor(lista, pergunta, nomeDe) {
  const palavras = palavrasDe(pergunta);
  const texto = palavras.join(" ");
  let achado = null;
  let nota = 0;
  for (const item of lista || []) {
    const n = encaixe(nomeDe(item), palavras, texto);
    if (n > nota) { nota = n; achado = item; }
  }
  return achado;
}

/** O projeto citado na pergunta (o de nome mais completo que bate), ou null — só se ela fala de projeto. */
export function projetoCitado(pergunta, projetos) {
  return citaProjeto(pergunta) ? melhor(projetos, pergunta, (p) => p.nome) : null;
}

/**
 * O fluxo citado na pergunta, dentro dos fluxos do projeto (o nome do projeto não conta como citação
 * do fluxo: "no projeto Compras" não escolhe o fluxo "Compras do mês"), ou null.
 */
export function fluxoCitado(pergunta, fluxos, { nomeDoProjeto = "" } = {}) {
  const doProjeto = new Set(palavrasDe(nomeDoProjeto));
  const sem = palavrasDe(pergunta).filter((p) => !doProjeto.has(p)).join(" ");
  return melhor(fluxos, sem, (f) => f.nome);
}

const LIMITE_POR_FLUXO = 6000;
const LIMITE_TOTAL = 24_000;

/**
 * O projeto em texto, para a Lisa: o nome, a lista dos fluxogramas e cada um descrito (formas com id,
 * cor, raias, abas e ligações — o mesmo texto do quadro). `alvo`: o fluxo que o pedido vai mudar, que
 * vem primeiro e marcado.
 */
export function contextoDoProjeto(projeto, fluxos, { alvo = null } = {}) {
  const ordem = [...(fluxos || [])].sort((a, b) => (a.id === alvo?.id ? -1 : b.id === alvo?.id ? 1 : 0));
  const tipo = (f) => (f.modo === "mindmap" ? "mapa mental" : "fluxograma");
  const partes = [
    `PROJETO "${projeto?.nome || "?"}" DO PROCESSMAP — ${ordem.length} ${ordem.length === 1 ? "desenho" : "desenhos"}: ${ordem.map((f) => `"${f.nome}" (${tipo(f)})`).join(", ") || "nenhum ainda"}.`,
  ];
  let total = partes[0].length;
  for (const f of ordem) {
    const marca = f.id === alvo?.id ? " — É ESTE QUE O PEDIDO MUDA" : "";
    const corpo = f.documento ? descreverDiagrama(f.documento).slice(0, LIMITE_POR_FLUXO) : "(sem desenho)";
    const bloco = `\n\n=== "${f.nome}" (${tipo(f)}, ${f.formas ?? "?"} formas${f.origem === "lisa" ? ", desenhado pela Lisa" : ""})${marca} ===\n${corpo}`;
    if (total + bloco.length > LIMITE_TOTAL) { partes.push(`\n\n(… e mais ${ordem.length - partes.length + 1} desenhos que não couberam aqui)`); break; }
    partes.push(bloco);
    total += bloco.length;
  }
  return partes.join("");
}

/** A seção do prompt da conversa com o projeto citado ("" sem projeto). */
export function secaoDoProjeto(texto) {
  const t = typeof texto === "string" ? texto.slice(0, LIMITE_TOTAL + 2000).trim() : "";
  return t
    ? `\n\nO PROJETO DO PROCESSMAP QUE A PESSOA CITOU (os desenhos dele como estão salvos agora; cada forma tem um id entre colchetes, e "→" é uma ligação). Use para responder sobre o projeto, comparar fluxos, achar etapas, apontar falhas. Se o pedido for mudar um fluxo e não disser qual (e houver mais de um), pergunte qual, citando os nomes:\n${t}`
    : "";
}

// ---- o plano (01/11/2026): "essa minha interação deveria ser o suficiente para ela fazer a alteração" ----
//
// Um pedido sobre o projeto pode mexer em vários desenhos de uma vez ("ponha nas funcionalidades…
// e crie uma nota em todos os fluxogramas…"), escrito com erros de digitação. Em vez de adivinhar por
// palavras-chave, a Lisa planeja com o modelo (src/lib/gemini.js: planejarNoProjeto): "mudar" (com uma
// operação por desenho, cada uma com a instrução completa) ou "responder" (é pergunta). A página
// executa as operações uma a uma (/api/diagrama) e salva cada desenho no projeto.

export const LIMITE_DE_OPERACOES = 12;
const linha = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Confere o plano: operação sem instrução sai; desenho que não é do projeto vira desenho novo; duas
 * operações no mesmo desenho viram uma (as instruções se somam); no máximo LIMITE_DE_OPERACOES.
 * Sem operação que sobre, é "responder".
 */
export function validarPlano(bruto, fluxos) {
  const ids = new Set((fluxos || []).map((f) => String(f.id)));
  const operacoes = [];
  for (const op of Array.isArray(bruto?.operacoes) ? bruto.operacoes : []) {
    // (o modelo às vezes escreve a quebra de linha como "\n" literal: vira quebra de verdade)
    const pedido = String(op?.pedido ?? "").replace(/\\n/g, "\n").trim().slice(0, 6000);
    if (!pedido) continue;
    const fluxo = ids.has(String(op?.fluxo ?? "")) ? String(op.fluxo) : "";
    const mesma = fluxo && operacoes.find((o) => o.fluxo === fluxo);
    if (mesma) { mesma.pedido = `${mesma.pedido}\n\nAlém disso: ${pedido}`.slice(0, 9000); continue; }
    if (operacoes.length >= LIMITE_DE_OPERACOES) break;
    operacoes.push({
      fluxo,
      nome: fluxo ? "" : linha(op?.nome, 120) || "Novo fluxograma",
      tipo: op?.tipo === "mapa mental" ? "mapa mental" : "fluxograma",
      pedido,
    });
  }
  // os .md que o pedido pede (01/11/2026: "faça um fluxograma da arquitetura pensando em cibersegurança
  // … faça um arquivo md também" — um documento SOBRE O ASSUNTO, ao lado do desenho novo)
  const documentos = [];
  for (const d of Array.isArray(bruto?.documentos) ? bruto.documentos : []) {
    const pedido = String(d?.pedido ?? "").replace(/\\n/g, "\n").trim().slice(0, 4000);
    if (!pedido || documentos.length >= LIMITE_DE_DOCUMENTOS) continue;
    const titulo = linha(d?.titulo, 120) || "Documento";
    documentos.push({
      arquivo: nomeDeArquivo(d?.arquivo || titulo, documentos.map((x) => x.arquivo)),
      titulo,
      desenhos: [...new Set((Array.isArray(d?.desenhos) ? d.desenhos : []).map(String).filter((id) => ids.has(id)))],
      novos: d?.novos === true,
      pedido,
      estilo: "livre",
    });
  }
  const explicacao = linha(bruto?.explicacao, 600);
  // "documentar": a pessoa quer TEXTO a partir dos desenhos — o modelo disse que nenhum desenho muda
  if (bruto?.acao === "documentar") return { acao: "documentar", explicacao, operacoes: [], documentos };
  const mudar = bruto?.acao === "mudar" && operacoes.length > 0;
  return { acao: mudar ? "mudar" : documentos.length ? "documentar" : "responder", explicacao, operacoes: mudar ? operacoes : [], documentos };
}

export const LIMITE_DE_DOCUMENTOS = 8;

/** O nome do .md: curto, com hífens, sem repetir outro da mesma resposta. */
export function nomeDeArquivo(texto, usados = []) {
  const base = fatia(String(texto || "").replace(/\.md$/i, "")) || "documento";
  let nome = `${base}.md`;
  for (let i = 2; usados.includes(nome); i++) nome = `${base}-${i}.md`;
  return nome;
}

// ---- documentar (01/11/2026: "faça um arquivo MD no editor explicando a estratégia e o conceito do
// MVP, uma aba de MD por fluxograma e mapa mental — vou usar para pedir ao Claude construir as rotas";
// a Lisa mexeu nos desenhos em vez disso, e estragou um) ----
//
// Pedido de documento é reconhecido sem o modelo (não pode virar mudança de desenho por engano): fala
// de MD/markdown/README, ou do editor de código junto de arquivo/documento/página, ou de documentação
// sem falar de nota no desenho. A Lisa escreve um .md por desenho do projeto, mais a visão geral.

// (01/11/2026, de novo: "ele ainda não abriu o editor e escreveu os arquivos md" — o pedido veio com
// erros que as palavras exatas não pegavam. Agora vale letra trocada de lugar, "mds", "emedê", "editro".)

// a distância de edição contando a troca de duas letras vizinhas como um erro só ("editro" → "editor")
function distanciaComTroca(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
const perto = (x, alvo) => x === alvo || (Math.abs(x.length - alvo.length) <= folgaDe(alvo) && distanciaComTroca(x, alvo) <= folgaDe(alvo));
const pertoDeAlgum = (p, lista) => p.some((x) => lista.some((d) => perto(x, d)));

// "md", "mds", "emd", "emedê" (a voz); "markdown" e "readme" com erro
const ehMarkdown = (x) => /^e?m+d+s?$/.test(x) || /^emede(s|is)?$/.test(x) || (x.length >= 6 && (perto(x, "markdown") || perto(x, "markdowns"))) || perto(x, "readme");
// o editor de código — mas não o verbo: "editar a aba" é mudar o desenho
const VERBO_EDITAR = new Set(["editar", "edite", "edita", "editei", "editou", "editam", "editem", "editado", "editada", "editando", "editaria", "edito"]);
const ehEditor = (x) => x === "ide" || x === "ides" || x === "vscode" || (!VERBO_EDITAR.has(x) && perto(x, "editor"));
const DE_TEXTO = ["arquivo", "arquivos", "documento", "documentos", "pagina", "paginas", "aba", "abas", "spec", "especificacao", "especificacoes", "escreva", "escrever", "escreve", "codigo", "abra", "abre", "abrir", "texto", "textos"];
// (o verbo; "documento" e "documentação" sozinhos também são assunto de fluxo — "o fluxo de aprovação de
// documentos" — e só contam junto de "cada/todos/por" + desenho)
const DOCUMENTAR = ["documente", "documentar", "documentem", "documenta"];
const DOCUMENTACAO = ["documentacao", "documentacoes", "documentos", "especificacao", "especificacoes"];
const CADA = ["cada", "todos", "todas", "por"];
const NO_DESENHO = ["nota", "notas", "anotacao", "anotacoes", "comentario", "comentarios"];

/** O pedido é escrever documentos (.md no editor) a partir dos desenhos, e não mudar os desenhos? */
export function pedeDocumentacao(pedido) {
  const p = palavrasDe(pedido);
  if (p.some(ehMarkdown) || p.some((x, i) => x === "eme" && /^des?$/.test(p[i + 1] || ""))) return true;
  if ((p.some(ehEditor) || /\bvs code\b/.test(p.join(" "))) && pertoDeAlgum(p, DE_TEXTO)) return true;
  if (pertoDeAlgum(p, NO_DESENHO)) return false;
  // ("documento(s)" e "documentação" estão a uma letra do verbo: não contam aqui)
  if (p.some((x) => !/^documento|^documentac/.test(x) && DOCUMENTAR.some((d) => perto(x, d)))) return true;
  // "a documentação de cada fluxograma", "a especificação de todos os fluxos" (e não "documentos de cada área")
  return pertoDeAlgum(p, DOCUMENTACAO) && umPorDesenho(pedido);
}

/** "um md POR fluxograma", "a documentação de CADA fluxo", "de TODOS os desenhos". */
export function umPorDesenho(pedido) {
  const p = palavrasDe(pedido);
  return p.some((x, i) => CADA.some((c) => perto(x, c)) && p.slice(i + 1, i + 4).some((y) => DESENHOS.some((d) => parecida(y, d))));
}

// ---- desenho E documento no mesmo pedido (01/11/2026: "faça um fluxograma desenhando a arquitetura do
// nosso produto já pensando em cibersegurança, onde hoje nós falhamos … faça um arquivo md também" — a
// Lisa reescreveu os .md do MVP e não desenhou nada) ----
//
// O plano diz o que desenhar e quais documentos escrever. A trava (ajustarAoPedido), sem o modelo: num
// pedido que fala de documento, desenho que JÁ EXISTE só muda se o pedido mandar mudar (PEDE_MUDANCA), e
// desenho NOVO só nasce se o pedido pedir um (pedeNovoDesenho) — foi assim que a aba "Fluxo Desktop" se perdeu.

const FAZER = ["faca", "faz", "fazer", "crie", "cria", "criar", "monte", "monta", "montar", "gere", "gera", "gerar", "desenhe", "desenha", "desenhar"];
const DESENHO_NOVO = ["fluxograma", "fluxo", "diagrama", "mapa", "desenho", "arquitetura", "bpmn"];

/** O pedido manda fazer um desenho novo ("faça um fluxograma da arquitetura", "desenhando a arquitetura")? */
export function pedeNovoDesenho(pedido) {
  const p = palavrasDe(pedido);
  if (p.some((x) => x !== "desenho" && x !== "desenhos" && (perto(x, "desenhando") || perto(x, "desenhe") || perto(x, "desenhar")))) return true;
  return p.some((x, i) => FAZER.some((v) => perto(x, v)) && p.slice(i + 1, i + 4).some((y) => DESENHO_NOVO.some((d) => parecida(y, d))));
}

/** O pedido manda mudar o que já está desenhado (incluir, pôr, mudar, pintar, tirar, anotar…). */
export const PEDE_MUDANCA = /\b(inclu|adicion|acrescent|ponh|coloqu|mud[ae]|alter|atualiz|pint|remov|apag|exclu|tir[ae]|corrij|corrig|edit[ae]|renome|separ|mov[ae]|anot|refac|refaz)\w*/;

/** Os documentos "um por desenho": a visão geral do projeto e uma especificação de cada desenho. */
export function documentosPorDesenho(fluxos) {
  return [
    { arquivo: "00-visao-geral.md", titulo: "Visão geral do projeto", desenhos: [], novos: false, pedido: "", estilo: "visao-geral" },
    ...(fluxos || []).map((f, i) => ({
      arquivo: `${String(i + 1).padStart(2, "0")}-${fatia(f.nome) || "desenho"}.md`, titulo: String(f.nome || "Desenho"),
      desenhos: [String(f.id)], novos: false, pedido: "", estilo: "especificacao",
    })),
  ];
}

/**
 * A trava do plano num pedido de documento (sem o modelo): tira as mudanças que o pedido não mandou
 * fazer e garante os documentos — os do plano; ou, se o plano não trouxe (ou trouxe menos que "um por
 * desenho" pedia), um por desenho ou um só sobre o pedido.
 */
export function ajustarAoPedido(plano, pedido, fluxos) {
  if (!pedeDocumentacao(pedido)) return plano;
  const muda = PEDE_MUDANCA.test(semAcento(pedido));
  const novo = pedeNovoDesenho(pedido);
  const operacoes = (plano.operacoes || []).filter((o) => (o.fluxo ? muda : novo));
  let documentos = plano.documentos || [];
  if (umPorDesenho(pedido) && documentos.length < (fluxos || []).length) documentos = documentosPorDesenho(fluxos);
  if (!documentos.length) {
    documentos = [{
      arquivo: "documento.md", titulo: linha(pedido, 80) || "Documento", desenhos: [], novos: operacoes.some((o) => !o.fluxo),
      pedido: String(pedido).slice(0, 4000), estilo: "livre",
    }];
  }
  return { ...plano, acao: operacoes.length ? "mudar" : "documentar", operacoes, documentos };
}

const fatia = (s) => semAcento(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

/** O caminho do .md de um desenho: docs/<projeto>/01-<desenho>.md (0 = a visão geral). */
export function arquivoDoDocumento(projeto, desenho, i) {
  const pasta = `docs/${fatia(projeto?.nome) || "projeto"}`;
  return i === 0 ? `${pasta}/00-visao-geral.md` : `${pasta}/${String(i).padStart(2, "0")}-${fatia(desenho?.nome) || "desenho"}.md`;
}

/** O caminho de um documento do plano: docs/<projeto>/<arquivo>. */
export const caminhoDoDocumento = (projeto, arquivo) => `docs/${fatia(projeto?.nome) || "projeto"}/${arquivo}`;

/**
 * A resposta com os documentos, cada um num bloco "````markdown docs/…/01-x.md" (quatro crases: o .md
 * pode ter blocos de três dentro) — o editor de código abre uma aba por bloco. Uma linha de quatro ou
 * mais crases dentro do documento fecharia o bloco antes da hora: vira três.
 */
export function respostaComDocumentos(intro, documentos) {
  const blocos = documentos.map((d) => {
    const corpo = String(d.markdown || "").replace(/\r/g, "").replace(/^(\s*)`{4,}/gm, "$1```").trim();
    return `${d.legenda ? `${d.legenda}\n\n` : ""}\`\`\`\`markdown ${d.arquivo}\n${corpo}\n\`\`\`\``;
  });
  return [String(intro || "").trim(), ...blocos].filter(Boolean).join("\n\n");
}

// ---- "em todos os fluxogramas" (01/11/2026: "ela não criou comentários detalhados em todos os
// fluxogramas dentro do projeto, fez apenas em um") ----
//
// O modelo leu "fluxograma" ao pé da letra e deixou os mapas mentais de fora. Para quem fala,
// "fluxograma" é qualquer desenho do projeto. Quando o pedido diz "todos"/"cada" desenho e o plano
// esquece algum, a rota do plano pede um segundo plano só para os que faltaram (faltandoNoPlano).

// "todos" com as trocas de letra de quem digita rápido ("tdoso"): a mesma letra, em outra ordem
const ordenada = (p) => [...p].sort().join("");
const TODOS = new Set(["todos", "todas", "cada"].map(ordenada));
const DESENHOS = ["fluxo", "fluxos", "fluxograma", "fluxogramas", "desenho", "desenhos", "mapa", "mapas", "diagrama", "diagramas", "aba", "abas", "processo", "processos"];

/** O pedido vale para todos os desenhos do projeto ("em todos os fluxogramas", "em cada fluxo")? */
export function pedeEmTodos(pedido) {
  const p = palavrasDe(pedido);
  return p.some((x, i) => (TODOS.has(ordenada(x)) || parecida(x, "todos"))
    && p.slice(i + 1, i + 4).some((y) => DESENHOS.some((d) => parecida(y, d))));
}

/** Os desenhos do projeto que o plano deixou de fora ("todos os mapas mentais": o quase vazio também). */
export function faltandoNoPlano(plano, fluxos) {
  const cobertos = new Set((plano?.operacoes || []).map((o) => o.fluxo).filter(Boolean));
  return (fluxos || []).filter((f) => !cobertos.has(String(f.id)));
}

/** Junta ao plano as operações do segundo plano (só as dos desenhos que faltavam, sem repetir). */
export function completarPlano(plano, extra, faltando) {
  const ids = new Set(faltando.map((f) => String(f.id)));
  const novas = (extra?.operacoes || []).filter((o) => ids.has(o.fluxo) && !plano.operacoes.some((x) => x.fluxo === o.fluxo));
  return { ...plano, operacoes: [...plano.operacoes, ...novas].slice(0, LIMITE_DE_OPERACOES) };
}

