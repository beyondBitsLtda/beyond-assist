import { supabase } from "@/lib/supabase.js";
import { getDateBoundaries } from "@/lib/dateRanges.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tasks-summary
 *
 * Contagem de tarefas do Trello por bucket de prazo (mesmos buckets/critérios
 * de /api/tasks?range=...), numa única query — usado pelo gráfico de barras do /dashboard,
 * pra não precisar de 5 round-trips (um por range).
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("documents")
      .select("external_id, metadata")
      .eq("source", "trello")
      .not("metadata->>due", "is", null);
    if (error) throw new Error(error.message);

    // dedup por card (chunks têm external_id "id#0", "id#1"…)
    const seen = new Map();
    for (const row of data || []) {
      const cardId = String(row.external_id).split("#")[0];
      if (seen.has(cardId)) continue;
      seen.set(cardId, row.metadata || {});
    }

    const { startOfToday, endOfToday, endOfTomorrow, endOfWeek } = getDateBoundaries();
    const counts = { overdue: 0, today: 0, tomorrow: 0, week: 0, upcoming: 0 };

    for (const meta of seen.values()) {
      const due = meta.due ? new Date(meta.due) : null;
      if (!due || Number.isNaN(due.getTime())) continue;
      const done = meta.due_complete === true;

      if (!done && due < startOfToday) counts.overdue++;
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
