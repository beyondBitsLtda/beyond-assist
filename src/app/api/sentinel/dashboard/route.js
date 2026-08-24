import { listTickets, summarizeTickets } from "@/lib/sentinel.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sentinel/dashboard?project=<id|all>
 * Contadores pro dashboard de chamados/SLA: por status, por prioridade, SLA estourado.
 */
export async function GET(req) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("project") || "all";

  try {
    const tickets = await listTickets({ projectId });
    const summary = summarizeTickets(tickets);
    return jsonResponse({ ok: true, ...summary });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
