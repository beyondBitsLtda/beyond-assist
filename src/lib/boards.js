import { loadAllTrelloCards } from "./liveTrello.js";
import { compareByListPos } from "./kanban.js";

// Nome canônico do board principal — o painel Kanban padrão ("/") aponta pra ele.
export const QUARTO_DE_GUERRA = "Quarto de Guerra";

/**
 * Descobre os boards do Trello configurados (exceto Quarto de Guerra, que tem painel próprio)
 * — direto do Trello (ao vivo, sem SYNC/embeddings).
 */
export async function listBoards() {
  const all = await loadAllTrelloCards();

  const seen = new Set();
  for (const card of all) {
    const name = (card.board || "").trim();
    if (!name) continue;
    if (name.toLowerCase() === QUARTO_DE_GUERRA.toLowerCase()) continue;
    seen.add(name);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Contadores de um board — direto do Trello (ao vivo, sem SYNC/embeddings), pro painel de
 * visão geral (consulta enxuta, diferente de retrieveByBoard que é pensada pro RAG).
 */
export async function summarizeBoard(boardName) {
  const all = await loadAllTrelloCards();
  const lowerName = boardName.toLowerCase();

  const lists = new Map();
  const now = Date.now();
  let total = 0, open = 0, done = 0, overdue = 0;
  for (const card of all) {
    if ((card.board || "").toLowerCase() !== lowerName) continue;
    total++;
    if (card.due_complete) {
      done++;
    } else {
      open++;
      if (card.due && new Date(card.due).getTime() < now) overdue++;
    }

    const listName = card.list || "(sem lista)";
    if (!lists.has(listName)) {
      lists.set(listName, { list: listName, list_pos: card.list_pos ?? null, count: 0 });
    }
    const entry = lists.get(listName);
    if (entry.list_pos == null && card.list_pos != null) entry.list_pos = card.list_pos;
    entry.count += 1;
  }

  return {
    board: boardName,
    total,
    open,
    done,
    overdue, // subconjunto de `open` — abertos que já venceram
    lists: [...lists.values()].sort(compareByListPos),
  };
}
