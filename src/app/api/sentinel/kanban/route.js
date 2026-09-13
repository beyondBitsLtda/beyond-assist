import { listProjects, listTickets, groupByStatus, attachProjectNames } from "@/lib/sentinel.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sentinel/kanban?project=<id|all>
 * Chamados de suporte agrupados por status (colunas na ordem lógica do fluxo). Somente leitura.
 */
export async function GET(req) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("project") || "all";

  try {
    const [projects, tickets] = await Promise.all([
      listProjects(),
      listTickets({ projectId }),
    ]);
    const withProject = attachProjectNames(tickets, projects);
    const columns = groupByStatus(withProject);
    return jsonResponse({ ok: true, columns });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
