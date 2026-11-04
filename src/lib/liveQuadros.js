import { loadTrello } from "@/lib/ingest/trello.js";
import { loadAbacato } from "@/lib/ingest/abacato.js";
import { fonteDosQuadros } from "@/lib/configLisa.js";

/**
 * Leitura AO VIVO dos quadros — do Trello ou do Abacato, conforme o interruptor do painel.
 *
 * Sem passar pelo Supabase/embeddings (SYNC). Compartilhada por tudo que só precisa MOSTRAR os
 * cards na tela ou comparar estado (Kanban, Boards, Tarefas, Dashboard, detecção de card
 * novo/atrasado das notificações), em contraste com a busca semântica do Assistente
 * (retrieve() em rag.js), que é a ÚNICA coisa que realmente precisa dos embeddings — por isso
 * é a única que continua dependendo do SYNC.
 *
 * Este arquivo é o único lugar do sistema que sabe que existe mais de uma fonte possível. As
 * nove telas e rotas que leem quadros chamam `loadAllCards()` e recebem sempre a mesma forma
 * de card — foi o que permitiu trocar o Trello pelo Abacato sem tocar em nenhuma delas.
 */

const CACHE_MS = 15000;

/**
 * O cache é POR FONTE, e isso não é detalhe.
 *
 * Com um cache só, virar o interruptor serviria por quinze segundos os cards do sistema
 * ANTIGO — a tela mostraria o Trello enquanto o rodapé já diria "Abacato". Quinze segundos é
 * tempo de sobra para alguém concluir que a troca não funcionou e clicar de novo.
 */
const caches = new Map(); // fonte -> { at: number, cards: Array }

function paraCard(d) {
  return {
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
  };
}

/**
 * Todos os cards de todos os quadros da fonte configurada, num formato plano e normalizado.
 *
 * `fresh: true` ignora o cache (usado pelo cron de notificação, que precisa do estado mais
 * atual possível a cada tique).
 *
 * `fonte` força uma fonte específica, ignorando o interruptor — serve à tela de comparação,
 * que precisa mostrar os dois lados ao mesmo tempo para você decidir se pode virar a chave.
 */
export async function loadAllCards({ fresh = false, fonte = null } = {}) {
  const qual = fonte || (await fonteDosQuadros());

  const cache = caches.get(qual);
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.cards;

  const docs = qual === "abacato" ? await loadAbacato() : await loadTrello();
  const cards = docs.map(paraCard);

  caches.set(qual, { at: Date.now(), cards });
  return cards;
}

/** Qual fonte está valendo agora. As telas usam para dizer de onde os números vieram — um
 *  painel que mostra tarefas sem dizer de onde elas saíram é o que faz alguém duvidar delas. */
export { fonteDosQuadros };

/** Esquece o que está guardado. Chamado ao virar o interruptor, para a próxima tela já vir da
 *  fonte nova em vez de esperar os quinze segundos passarem. */
export function esquecerCache() {
  caches.clear();
}
