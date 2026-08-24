import { getTicket, listComments, listProjects } from "@/lib/sentinel.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/sentinel/ticket?id=<uuid> — detalhe completo de um chamado + comentários. */
export async function GET(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonResponse({ ok: false, error: "id é obrigatório" }, 400);

  try {
    const [ticket, comments, projects] = await Promise.all([
      getTicket(id),
      listComments(id),
      listProjects(),
    ]);
    const project = projects.find((p) => p.id === ticket.project_id)?.name || null;
    return jsonResponse({ ok: true, ticket: { ...ticket, project }, comments });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
