import { retrieveByBoard } from "@/lib/rag.js";
import { groupByList } from "@/lib/kanban.js";
import { QUARTO_DE_GUERRA } from "@/lib/boards.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/kanban?board=<nome>  (default: "Quarto de Guerra")
 *
 * Somente leitura — reflete o estado da última sincronização (botão SYNC).
 * Colunas = listas do board, ordenadas pela posição real no Trello (list_pos).
 */
export async function GET(req) {
  const url = new URL(req.url);
  const board = url.searchParams.get("board") || QUARTO_DE_GUERRA;

  try {
    const cards = await retrieveByBoard(board);
    const columns = groupByList(cards);
    return jsonResponse({ ok: true, board, columns });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
