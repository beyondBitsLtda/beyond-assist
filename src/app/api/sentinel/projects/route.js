import { listProjects } from "@/lib/sentinel.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/sentinel/projects — projetos da plataforma de testes, pro seletor de filtro. */
export async function GET() {
  try {
    const projects = await listProjects();
    return jsonResponse({ ok: true, projects });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
