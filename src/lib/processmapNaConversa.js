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
