// Agrupamento de cards (já achatados por retrieveByBoard) em colunas de Kanban por lista.

/** Compara duas entradas {list, list_pos} pela ordem real das listas no Trello (nulls por último, fallback alfabético). */
export function compareByListPos(a, b) {
  if (a.list_pos == null && b.list_pos == null) return (a.list || "").localeCompare(b.list || "");
  if (a.list_pos == null) return 1;
  if (b.list_pos == null) return -1;
  return a.list_pos - b.list_pos;
}

/**
 * Agrupa o array plano de cards (formato de retrieveByBoard) em colunas por `list`,
 * ordenadas por `list_pos`. Cards sem `list_pos` (ainda não resincronizados) caem
 * no fim, ordenados alfabeticamente pelo nome da lista.
 */
export function groupByList(cards) {
  const columns = new Map();
  for (const card of cards) {
    const key = card.list || "(sem lista)";
    if (!columns.has(key)) {
      columns.set(key, { list: key, list_pos: card.list_pos ?? null, cards: [] });
    }
    const col = columns.get(key);
    if (col.list_pos == null && card.list_pos != null) col.list_pos = card.list_pos;
    col.cards.push(card);
  }
  return [...columns.values()].sort(compareByListPos);
}
