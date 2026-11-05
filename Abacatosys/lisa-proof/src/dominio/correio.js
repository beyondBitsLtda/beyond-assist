// O correio dos jogadores (03/11/2026, BEYOND-0016): "cada jogador vai ganhar um mensageiro e uma caixa de
// correio; os jogadores mandam recados uns para os outros, e quem recebe avalia — se achar útil, os dois
// ganham moedas. Dá para mandar perguntas do quiz pelo correio: no quiz do dia, até duas perguntas vão para
// outros jogadores, e eu termino respondendo só três (com moedas reduzidas) — inclusive as que eu errei. A
// Lisa também manda perguntas e recados, mas ninguém manda perguntas para ela."
//
// Aqui, sem banco (testado em scripts/dominio-check.mjs): as regras do recado, a conta do quiz com
// perguntas mandadas, e quanto cada um ganha. Quem grava é src/lib/correio.js.

export const CORREIO = {
  mensageiro: "🕊️",
  recadoMinimo: 3,
  recadoMaximo: 500,
  recadosPorDia: 5,            // quantos recados cada um manda por dia
  recompensaDoRecado: 15,      // para cada um, quando quem recebe acha útil
  recadosPagosPorDia: 3,       // de quantos recados úteis por dia quem MANDA ganha (o resto é só gentileza)
  perguntasPorQuiz: 2,
  respondidasNoMinimo: 3,
  fatorDoQuizComCorreio: 0.7,  // o quiz que mandou perguntas vale menos: só os acertos, vezes isto
  recompensaDaPergunta: 10,    // quem recebe a pergunta e acerta
  ajudaDaPergunta: 5,          // quem mandou, quando o outro acerta
};

const limpo = (t) => String(t ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();

/** O recado: entre 3 e 500 letras. Devolve { ok, texto } ou { ok: false, erro }. */
export function conferirRecado(texto) {
  const t = limpo(texto);
  if (t.length < CORREIO.recadoMinimo) return { ok: false, erro: "escreva o recado (pelo menos algumas palavras)" };
  if (t.length > CORREIO.recadoMaximo) return { ok: false, erro: `o recado tem ${t.length} letras — o limite é ${CORREIO.recadoMaximo}` };
  return { ok: true, texto: t };
}

// O recado que a Lisa robô escreve (05/11/2026): os 7 primeiros chegaram cortados no meio da frase ("Oi, God!
// 1665 pontos em") — o raciocínio do modelo gastava o limite de tamanho e sobrava um pedaço do texto.
const RECADO_DO_ROBO_MINIMO = 40;
const TERMINA_A_FRASE = /(?:[.!?…)"”']|\p{Extended_Pictographic}️?)$/u;

/**
 * O recado da Lisa robô, pronto para ir — ou null quando não dá para mandar: veio cortado pelo limite do
 * modelo (`cortado`), é curto demais ou não termina a frase. Comprido demais, fica até a última frase inteira.
 */
export function recadoDoRobo(texto, { cortado = false } = {}) {
  if (cortado) return null;
  let t = limpo(texto).replace(/^["“'«]+|["”'»]+$/g, "").trim();
  if (t.length > CORREIO.recadoMaximo) {
    const cabe = t.slice(0, CORREIO.recadoMaximo);
    const fim = Math.max(...[". ", "! ", "? ", "… "].map((s) => cabe.lastIndexOf(s)));
    t = fim > 0 ? cabe.slice(0, fim + 1) : "";
  }
  if (t.length < RECADO_DO_ROBO_MINIMO || !TERMINA_A_FRASE.test(t)) return null;
  return t;
}

/** O que a Lisa robô respondeu sobre um recado que recebeu: true (útil), false (não) ou null (não deu para ler). */
export function vereditoDoRecado(resposta) {
  const t = limpo(resposta).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/^\W*sim\b/.test(t)) return true;
  if (/^\W*nao\b/.test(t)) return false;
  return null;
}

/**
 * A conta do quiz com as perguntas mandadas por correio (`enviadas`, os índices): elas saem do placar —
 * mesmo a que tinha sido respondida errada. O quiz termina quando toda pergunta foi respondida ou mandada.
 * A nota é sobre as que ficaram; com correio, os pontos são só dos acertos, vezes o fator, sem o bônus de
 * gabaritar (`pontosDoQuiz` é o de sempre, de src/dominio/pratica.js).
 */
export function contaDoQuiz(perguntas, escolhas = {}, enviadas = [], pontosDoQuiz, pontosPorAcerto) {
  const total = (perguntas || []).length;
  const fora = new Set((enviadas || []).map(Number));
  const valem = Object.entries(escolhas || {}).filter(([k, v]) => !fora.has(Number(k)) && v !== null && v !== undefined);
  const acertos = valem.filter(([k, v]) => perguntas[Number(k)]?.correta === Number(v)).length;
  const conta = total - fora.size;
  const terminou = total > 0 && Array.from({ length: total }, (_, i) => fora.has(i) || (escolhas || {})[i] !== undefined).every(Boolean);
  const nota = conta > 0 ? Math.round((acertos / conta) * 100) : 0;
  const comCorreio = fora.size > 0;
  const pontos = !terminou ? 0 : comCorreio
    ? Math.round(acertos * pontosPorAcerto * CORREIO.fatorDoQuizComCorreio)
    : pontosDoQuiz(acertos, total);
  return { total, respondidas: valem.length, acertos, conta, terminou, nota, comCorreio, pontos, enviadas: fora.size };
}

/** Dá para mandar a pergunta `indice` deste quiz pelo correio? (aberta, sem acerto, dentro dos limites) */
export function podeMandarPergunta({ perguntas, escolhas = {}, enviadas = [], indice, status }) {
  const i = Number(indice);
  if (status === "concluido") return { ok: false, motivo: "este quiz já terminou" };
  if (!Number.isInteger(i) || i < 0 || i >= (perguntas || []).length) return { ok: false, motivo: "pergunta inválida" };
  if ((enviadas || []).map(Number).includes(i)) return { ok: false, motivo: "esta pergunta já foi pelo correio" };
  if ((enviadas || []).length >= CORREIO.perguntasPorQuiz) return { ok: false, motivo: `cada quiz manda até ${CORREIO.perguntasPorQuiz} perguntas pelo correio` };
  if ((perguntas.length - (enviadas || []).length - 1) < CORREIO.respondidasNoMinimo) return { ok: false, motivo: `responda pelo menos ${CORREIO.respondidasNoMinimo} perguntas` };
  const escolha = escolhas?.[i];
  if (escolha !== undefined && escolha !== null && perguntas[i].correta === Number(escolha)) return { ok: false, motivo: "esta você acertou — não precisa mandar" };
  return { ok: true };
}

/** A pergunta como vai na carta: sem a resposta certa (que fica guardada para conferir quando o outro responder). */
export function perguntaNaCarta(p, { mostrarResposta = false } = {}) {
  const base = { pergunta: p.pergunta, codigo: p.codigo || "", linguagem: p.linguagem || "", opcoes: p.opcoes };
  return mostrarResposta ? { ...base, correta: p.correta, explicacao: p.explicacao || "" } : base;
}

/**
 * Quanto cada um ganha quando quem recebe avalia o recado. Útil: os dois ganham — mas quem manda só ganha
 * de alguns recados úteis por dia, e um par só rende uma vez por dia (dois amigos trocando "valeu" não
 * viram uma mina de moedas). Não útil: ninguém ganha.
 */
export function recompensaDoRecado({ util, pagosHojeAoRemetente = 0, parJaPagouHoje = false }) {
  if (!util || parJaPagouHoje) return { remetente: 0, destinatario: 0 };
  return {
    remetente: pagosHojeAoRemetente < CORREIO.recadosPagosPorDia ? CORREIO.recompensaDoRecado : 0,
    destinatario: CORREIO.recompensaDoRecado,
  };
}

/** Quanto cada um ganha quando quem recebeu a pergunta responde. */
export function recompensaDaPergunta(acertou) {
  return acertou ? { destinatario: CORREIO.recompensaDaPergunta, remetente: CORREIO.ajudaDaPergunta } : { destinatario: 0, remetente: 0 };
}

/** Ninguém manda pergunta para a Lisa (ela é robô); recado pode. E ninguém escreve para si mesmo. */
export function podeEscreverPara({ de, para, tipo, paraEhRobo }) {
  if (!para) return { ok: false, motivo: "escolha para quem vai" };
  if (de === para) return { ok: false, motivo: "não dá para mandar para você mesmo" };
  if (tipo === "pergunta" && paraEhRobo) return { ok: false, motivo: "a Lisa manda perguntas, mas não recebe" };
  return { ok: true };
}
