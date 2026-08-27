import { loadAllTrelloCards } from "@/lib/liveTrello.js";
import { getDateBoundaries } from "@/lib/dateRanges.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tasks?range=<today|tomorrow|week|overdue|upcoming>
 *
 * Filtra cards do Trello pela data de vencimento — direto do Trello (ao vivo, sem
 * SYNC/embeddings). Retorna tudo que casa com o intervalo — preciso e completo.
 */
export async function GET(req) {
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") || "today").toLowerCase();

  const { startOfToday, endOfToday, endOfTomorrow, endOfWeek } = getDateBoundaries();

  let lo = null, hi = null, onlyOpen = false, label = range;
  if (range === "today") { lo = startOfToday; hi = endOfToday; label = "hoje"; }
  else if (range === "tomorrow") { lo = endOfToday; hi = endOfTomorrow; label = "amanhã"; }
  else if (range === "week") { lo = startOfToday; hi = endOfWeek; label = "esta semana"; }
  else if (range === "overdue") { lo = null; hi = startOfToday; onlyOpen = true; label = "atrasadas"; }
  else if (range === "upcoming") { lo = startOfToday; hi = null; label = "próximas"; }

  try {
    const all = await loadAllTrelloCards();

    const tasks = all
      .filter((c) => c.due)
      .filter((c) => {
        if (onlyOpen && c.due_complete) return false;
        const due = new Date(c.due);
        if (lo && due < lo) return false;
        if (hi && due >= hi) return false;
        return true;
      })
      .map((c) => ({ title: c.title, board: c.board, due: c.due, list: c.list, done: c.due_complete, url: c.url }))
      .sort((a, b) => (a.due || "").localeCompare(b.due || ""));

    return jsonResponse({ ok: true, range: label, count: tasks.length, tasks });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
