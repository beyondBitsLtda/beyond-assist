// A memória curta da conversa com a Lisa (BEYOND-0006).
//
// Antes, cada pergunta ia para /api/ask sozinha: "me fala do card X" e, na sequência, "e o
// prazo dele?" chegava ao modelo sem o card X — e a Lisa recomeçava o assunto do zero. Agora o
// Assistente guarda as últimas trocas e manda junto; o servidor põe no prompt como "conversa
// até agora". Puro, sem rede nem navegador: testado em scripts/conversa-check.mjs.

import { detectarAcordar, normalizar } from "./escutaPorPalavra.js";

export const MAXIMO_DE_TURNOS = 10; // 5 trocas (você + Lisa)
export const TETO_POR_TURNO = 700; // caracteres de cada fala no prompt
export const TETO_DO_BLOCO = 4500; // caracteres da conversa inteira no prompt
export const VALIDADE_MS = 30 * 60 * 1000; // depois de 30 min parada, a conversa recomeça

const limpar = (t) => String(t ?? "").replace(/\s+/g, " ").trim();

/** Acrescenta uma fala (papel "voce" ou "lisa") e devolve a lista nova, já cortada. */
export function adicionarTurno(turnos, papel, texto, agora = Date.now()) {
  const limpo = limpar(texto);
  if (!limpo || (papel !== "voce" && papel !== "lisa")) return turnos;
  return [...turnos, { papel, texto: limpo, em: agora }].slice(-MAXIMO_DE_TURNOS);
}

/** A conversa que ainda vale: some inteira se a última fala tiver mais de 30 minutos. */
export function conversaVigente(turnos, agora = Date.now()) {
  if (!turnos?.length) return [];
  const ultima = turnos[turnos.length - 1];
  return agora - (ultima.em || 0) > VALIDADE_MS ? [] : turnos;
}

/** O que vem do navegador não é confiável: só papéis conhecidos, só texto, com teto. */
export function turnosValidos(entrada) {
  if (!Array.isArray(entrada)) return [];
  return entrada
    .filter((t) => t && (t.papel === "voce" || t.papel === "lisa") && typeof t.texto === "string" && limpar(t.texto))
    .slice(-MAXIMO_DE_TURNOS)
    .map((t) => ({ papel: t.papel, texto: limpar(t.texto).slice(0, TETO_POR_TURNO) }));
}

/** O bloco que entra no prompt. As falas mais antigas saem primeiro se passar do teto. */
export function blocoDaConversa(turnos) {
  const linhas = turnosValidos(turnos).map((t) => `${t.papel === "voce" ? "Usuário" : "Lisa"}: ${t.texto}`);
  while (linhas.length && linhas.join("\n").length > TETO_DO_BLOCO) linhas.shift();
  return linhas.join("\n");
}

/** A seção do prompt com a conversa — vazia quando não há conversa (o prompt fica como antes). */
export function secaoDaConversa(bloco) {
  if (!bloco) return "";
  return `

CONVERSA ATÉ AGORA (a pergunta abaixo continua esta conversa: mantenha o assunto, use o que já foi dito e não recomece do zero nem se apresente de novo):
${bloco}`;
}

// Começos típicos de quem continua o assunto em vez de abrir outro.
const CONTINUACAO = /^(e|e o|e a|e os|e as|e se|e sobre|mas|então|entao|isso|esse|essa|esses|essas|ele|ela|eles|elas|dele|dela|nele|nela|também|tambem|por que|porque|por quê|como assim|e aí|e ai|continua|continue|mais|outro|outra|o resto|e depois|aquele|aquela|desse|dessa|disso)\b/i;

/**
 * O texto usado para BUSCAR o contexto (cards, notas). Uma continuação curta ("e o prazo
 * dele?") não acha nada sozinha; junto com a pergunta anterior, acha o mesmo card de antes.
 * A pergunta enviada ao modelo continua sendo a original — isto é só para a busca.
 */
export function consultaDeBusca(pergunta, turnos) {
  const p = limpar(pergunta);
  const anteriores = turnosValidos(turnos).filter((t) => t.papel === "voce");
  const anterior = anteriores[anteriores.length - 1]?.texto;
  if (!anterior) return p;
  const curta = p.split(" ").length <= 6;
  return curta || CONTINUACAO.test(p) ? `${anterior} ${p}` : p;
}

/** Ruído que o reconhecimento de voz às vezes devolve ("ã", "é") não vira pergunta. */
export function falaQueValePergunta(dito) {
  const limpo = limpar(dito).replace(/[^\p{L}\p{N}\s]/gu, "");
  if (limpo.replace(/\s/g, "").length < 3) return false;
  return !/^(ã+|é+|hm+|uhum|aham|ah+|eh+|oh+)$/i.test(limpo);
}

/**
 * Interromper a Lisa no meio da fala (Modo conversa): o que o microfone ouviu enquanto ela
 * falava tem "Lisa"? Devolve { interrompe, resto } — resto é o que veio depois ("Lisa, não é
 * esse, é o de vendas" → "nao e esse e o de vendas").
 *
 * O microfone também ouve a VOZ DELA pelas caixas de som. Se ela mesma estiver dizendo uma frase
 * com "Lisa", o reconhecimento devolve um trecho da fala dela — e isso é eco, não você. A regra:
 * quando o que foi ouvido é um pedaço do texto que ela está falando, ignora — só "Lisa" sozinho
 * passa sempre (o parcial "a Lisa" de "eu sou a Lisa" já conta como eco).
 */
export function interrupcaoNaFala(transcricao, textoDela = "") {
  const { acordou, resto } = detectarAcordar(transcricao);
  if (!acordou) return { interrompe: false, resto: "" };
  const ouvido = normalizar(transcricao);
  const fala = normalizar(textoDela);
  if (fala.includes("lisa") && ouvido.split(" ").length >= 2 && fala.includes(ouvido)) return { interrompe: false, resto: "" };
  return { interrompe: true, resto };
}

/** Marca a última fala dela como interrompida — o modelo precisa saber que você não ouviu o resto. */
export function marcarInterrompida(turnos) {
  const i = turnos.map((t) => t.papel).lastIndexOf("lisa");
  if (i < 0 || turnos[i].texto.endsWith("[o usuário interrompeu esta fala]")) return turnos;
  const novo = [...turnos];
  novo[i] = { ...novo[i], texto: `${novo[i].texto} [o usuário interrompeu esta fala]` };
  return novo;
}
