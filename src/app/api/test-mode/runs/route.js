import { listTestRuns } from "@/lib/sentinelTests.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/test-mode/runs?project=<nome|all> — runs de um projeto de teste. */
export async function GET(req) {
  try {
    const project = new URL(req.url).searchParams.get("project");
    const runs = await listTestRuns(project);
    return jsonResponse({ ok: true, runs });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
