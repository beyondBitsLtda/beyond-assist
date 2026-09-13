import { listRepoBranches } from "@/lib/codeTasks.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/code-repos/branches?repo=owner/name — branches do repositório, pro seletor
 * "branch base" da tela /code-tasks. */
export async function GET(req) {
  const repo = new URL(req.url).searchParams.get("repo");
  if (!repo) return jsonResponse({ ok: false, error: "repo é obrigatório" }, 400);
  try {
    const branches = await listRepoBranches(repo);
    return jsonResponse({ ok: true, branches });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
