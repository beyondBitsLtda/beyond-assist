import { listBoards, summarizeBoard } from "@/lib/boards.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/boards-overview
 *
 * Contadores por board/lista de todos os boards do Trello já indexados,
 * exceto "Quarto de Guerra" (tem painel Kanban dedicado em "/").
 */
export async function GET() {
  try {
    const names = await listBoards();
    const boards = await Promise.all(names.map((name) => summarizeBoard(name)));
    return jsonResponse({ ok: true, boards });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
