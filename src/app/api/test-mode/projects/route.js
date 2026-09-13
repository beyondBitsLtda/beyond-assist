import { listTestProjects } from "@/lib/sentinelTests.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/test-mode/projects — nomes de projeto distintos em cloud_runs (Sentinela). */
export async function GET() {
  try {
    const projects = await listTestProjects();
    return jsonResponse({ ok: true, projects });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
