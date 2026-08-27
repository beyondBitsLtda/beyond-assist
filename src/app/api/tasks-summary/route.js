import { loadAllTrelloCards } from "@/lib/liveTrello.js";
import { getDateBoundaries } from "@/lib/dateRanges.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tasks-summary
 *
 * Contagem de tarefas do Trello por bucket de prazo (mesmos buckets/critérios de
 * /api/tasks?range=...), direto do Trello (ao vivo, sem SYNC/embeddings) — usado pelo
 * gráfico de barras do /dashboard, pra não precisar de 5 round-trips (um por range).
 */
export async function GET() {
  try {
    const all = await loadAllTrelloCards();
    const { startOfToday, endOfToday, endOfTomorrow, endOfWeek } = getDateBoundaries();
    const counts = { overdue: 0, today: 0, tomorrow: 0, week: 0, upcoming: 0 };

    for (const c of all) {
      if (!c.due) continue;
      const due = new Date(c.due);
      if (Number.isNaN(due.getTime())) continue;

      if (!c.due_complete && due < startOfToday) counts.overdue++;
      if (due >= startOfToday && due < endOfToday) counts.today++;
      if (due >= endOfToday && due < endOfTomorrow) counts.tomorrow++;
      if (due >= startOfToday && due < endOfWeek) counts.week++;
      if (due >= startOfToday) counts.upcoming++;
    }

    return jsonResponse({ ok: true, counts });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
