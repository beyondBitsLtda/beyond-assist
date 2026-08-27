import { loadAllTrelloCards } from "./liveTrello.js";
import { updateTrelloCard, getBoardLists } from "./ingest/trello.js";

/**
 * Ações que o Assistente pode propor e (depois de confirmadas) executar de verdade em
 * cards do Trello — por enquanto: mudar prazo, mover de lista, marcar concluído/reabrir.
 * Ver detectTrelloAction (src/lib/gemini.js) pra como a intenção é detectada, e
 * src/app/api/ask/route.js pra como isso entra no fluxo de conversa (sempre com um passo
 * de confirmação explícita antes de executar).
 */

function fmtDatePt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", weekday: "long", timeZone: "America/Sao_Paulo" }).format(d);
}

/**
 * A partir do que o Gemini detectou, monta uma proposta de ação completa e legível —
 * NÃO executa nada ainda. Lança erro se o card não existir mais (pode ter sido
 * movido/arquivado/apagado desde a última leitura ao vivo).
 */
export async function buildActionProposal({ card_id, field, new_value }) {
  const all = await loadAllTrelloCards();
  const card = all.find((c) => c.id === card_id);
  if (!card) throw new Error("não encontrei mais esse card (pode ter sido movido ou arquivado)");

  let humanChange;
  if (field === "due") {
    humanChange = new_value ? `mudar o prazo pra ${fmtDatePt(new_value)}` : "remover o prazo";
  } else if (field === "due_complete") {
    humanChange = new_value === "true" ? "marcar como concluído" : "reabrir (marcar como não concluído)";
  } else if (field === "list") {
    humanChange = `mover pra lista "${new_value}"`;
  } else {
    throw new Error(`campo de ação desconhecido: "${field}"`);
  }

  return {
    type: "confirm",
    card_id: card.id,
    card_title: card.title,
    board: card.board,
    field,
    new_value,
    summary: `Vou ${humanChange} no card "${card.title}" (${card.board}). Confirma?`,
  };
}

/**
 * Quando há mais de um card candidato pro mesmo pedido, monta a pergunta numerada — ainda
 * NÃO decide nada, só apresenta as opções pro usuário escolher (ver intent "select_candidate"
 * em detectTrelloAction, src/lib/gemini.js).
 */
export function buildClarifyPrompt({ field, new_value, candidates }) {
  const numbered = candidates
    .map((c, i) => `${i + 1}. "${c.title}" (${c.board}${c.list ? " · " + c.list : ""})`)
    .join("\n");
  return {
    type: "clarify",
    field,
    new_value,
    candidates: candidates.map((c) => ({ card_id: c.id, title: c.title, board: c.board })),
    summary: `Encontrei mais de uma tarefa parecida:\n${numbered}\nQual delas? Pode responder com o número.`,
  };
}

/** Executa de verdade uma ação já confirmada pelo usuário. Retorna uma frase de resultado. */
export async function executeAction(pending) {
  const { card_id, card_title, field, new_value } = pending;

  if (field === "due") {
    await updateTrelloCard(card_id, { due: new_value || null });
    return `Prontinho — ${new_value ? `mudei o prazo de "${card_title}" pra ${fmtDatePt(new_value)}` : `removi o prazo de "${card_title}"`}.`;
  }

  if (field === "due_complete") {
    const done = new_value === "true";
    await updateTrelloCard(card_id, { dueComplete: done });
    return `Prontinho — "${card_title}" ${done ? "marcado como concluído" : "reaberto"}.`;
  }

  if (field === "list") {
    const all = await loadAllTrelloCards();
    const card = all.find((c) => c.id === card_id);
    if (!card?.board_id) throw new Error("não achei o board desse card pra resolver a lista de destino");

    const lists = await getBoardLists(card.board_id);
    const wanted = new_value.toLowerCase();
    const target =
      lists.find((l) => l.name.toLowerCase() === wanted) ||
      lists.find((l) => l.name.toLowerCase().includes(wanted) || wanted.includes(l.name.toLowerCase()));
    if (!target) {
      throw new Error(`não encontrei uma lista parecida com "${new_value}" nesse board (listas existentes: ${lists.map((l) => l.name).join(", ")})`);
    }

    await updateTrelloCard(card_id, { idList: target.id });
    return `Prontinho — movi "${card_title}" pra "${target.name}".`;
  }

  throw new Error(`campo de ação desconhecido: "${field}"`);
}
