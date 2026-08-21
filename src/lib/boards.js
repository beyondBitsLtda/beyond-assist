import { supabase } from "./supabase.js";
import { compareByListPos } from "./kanban.js";

// Nome canônico do board principal — o painel Kanban padrão ("/") aponta pra ele.
export const QUARTO_DE_GUERRA = "Quarto de Guerra";

/**
 * Descobre os boards do Trello já indexados (exceto Quarto de Guerra, que tem painel próprio),
 * direto da coluna `board` de `documents` — sem hardcodar nomes, já que nem todos os boards
 * têm apelido conhecido em rag.js (BOARD_ALIASES).
 */
export async function listBoards() {
  const { data, error } = await supabase
    .from("documents")
    .select("board")
    .eq("source", "trello")
    .not("board", "is", null);
  if (error) throw new Error(`listBoards: ${error.message}`);

  const seen = new Set();
  for (const row of data || []) {
    const name = (row.board || "").trim();
    if (!name) continue;
    if (name.toLowerCase() === QUARTO_DE_GUERRA.toLowerCase()) continue;
    seen.add(name);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Contadores de um board, sem trazer `content`/`title` (só pro painel de visão geral —
 * consulta enxuta, diferente de retrieveByBoard que é pensada pro RAG).
 * Dedup por card (chunks têm external_id "id#0", "id#1"…), mesmo padrão de rag.js/api/tasks.
 */
export async function summarizeBoard(boardName) {
  const { data, error } = await supabase
    .from("documents")
    .select("external_id, metadata")
    .eq("source", "trello")
    .ilike("board", boardName);
  if (error) throw new Error(`summarizeBoard: ${error.message}`);

  const seen = new Map();
  for (const row of data || []) {
    const cardId = String(row.external_id).split("#")[0];
    if (seen.has(cardId)) continue;
    seen.set(cardId, row.metadata || {});
  }

  const lists = new Map();
  let open = 0, done = 0;
  for (const meta of seen.values()) {
    if (meta.due_complete === true) done++; else open++;

    const listName = meta.list || "(sem lista)";
    if (!lists.has(listName)) {
      lists.set(listName, { list: listName, list_pos: meta.list_pos ?? null, count: 0 });
    }
    const entry = lists.get(listName);
    if (entry.list_pos == null && meta.list_pos != null) entry.list_pos = meta.list_pos;
    entry.count += 1;
  }

  return {
    board: boardName,
    total: seen.size,
    open,
    done,
    lists: [...lists.values()].sort(compareByListPos),
  };
}
