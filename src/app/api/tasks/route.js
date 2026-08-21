import { supabase } from "@/lib/supabase.js";
import { getDateBoundaries } from "@/lib/dateRanges.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tasks?range=<today|tomorrow|week|overdue|upcoming>
 *
 * Filtra documents do Trello pela data de vencimento (metadata->>'due'),
 * SEM busca vetorial. Retorna tudo que casa com o intervalo — preciso e completo.
 *
 * A data de vencimento vem de metadata.due (ISO), gravada na ingestão do Trello.
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
    // pega todos os cards de Trello que têm 'due'
    let q = supabase
      .from("documents")
      .select("external_id, board, title, content, metadata, last_modified")
      .eq("source", "trello")
      .not("metadata->>due", "is", null);

    if (lo) q = q.gte("metadata->>due", lo.toISOString());
    if (hi) q = q.lt("metadata->>due", hi.toISOString());

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    // dedup por card (chunks têm external_id "id#0", "id#1"…)
    const seen = new Map();
    for (const row of data || []) {
      const cardId = String(row.external_id).split("#")[0];
      if (seen.has(cardId)) continue;
      const done = row.metadata?.due_complete === true;
      if (onlyOpen && done) continue; // atrasadas: ignora concluídas
      seen.set(cardId, {
        title: row.title,
        board: row.board,
        due: row.metadata?.due || null,
        list: row.metadata?.list || null,
        done,
        url: row.metadata?.url || null,
      });
    }

    const tasks = [...seen.values()].sort((a, b) => (a.due || "").localeCompare(b.due || ""));
    return json({ ok: true, range: label, count: tasks.length, tasks });
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
