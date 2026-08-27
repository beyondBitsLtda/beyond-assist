import { loadTrello } from "@/lib/ingest/trello.js";

/**
 * Leitura AO VIVO do Trello — sem passar pelo Supabase/embeddings (SYNC). Compartilhada por
 * tudo que só precisa MOSTRAR os cards na tela ou comparar estado (Kanban, Boards, Tarefas,
 * Dashboard, detecção de card novo/atrasado das notificações), em contraste com a busca
 * semântica do Assistente (retrieve() em rag.js), que é a ÚNICA coisa que realmente precisa
 * dos embeddings — por isso é a única que continua dependendo do SYNC.
 *
 * Cache em memória bem curto: evita bater várias vezes no Trello quando uma página só (ex.:
 * o Dashboard) dispara 2-3 fetches em paralelo que precisam do mesmo dado. Não é garantia de
 * consistência entre requisições (funções da Vercel podem não compartilhar memória) — é só
 * uma otimização best-effort, nunca a fonte da verdade.
 */
const CACHE_MS = 15000;
let _cache = null; // { at: number, cards: Array }

/**
 * Todos os cards de todos os boards configurados (TRELLO_BOARD_IDS), num formato plano e
 * normalizado. `fresh: true` ignora o cache (usado pelo cron de notificação, que precisa do
 * estado mais atual possível a cada tick).
 */
export async function loadAllTrelloCards({ fresh = false } = {}) {
  if (!fresh && _cache && Date.now() - _cache.at < CACHE_MS) return _cache.cards;

  const docs = await loadTrello();
  const cards = docs.map((d) => ({
    id: d.external_id,
    board: d.board || "",
    board_id: d.metadata?.board_id || null,
    title: d.title || "(sem título)",
    content: d.content,
    last_modified: d.last_modified || null,
    list: d.metadata?.list || null,
    list_pos: d.metadata?.list_pos ?? null,
    id_list: d.metadata?.id_list || null,
    url: d.metadata?.url || null,
    labels: d.metadata?.labels || "",
    due: d.metadata?.due || null,
    start: d.metadata?.start || null,
    due_complete: d.metadata?.due_complete === true,
  }));

  _cache = { at: Date.now(), cards };
  return cards;
}
