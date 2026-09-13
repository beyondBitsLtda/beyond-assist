import { listTestCases } from "@/lib/sentinelTests.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/test-mode/cases?runId=<uuid> — lista enxuta dos casos de um run. */
export async function GET(req) {
  try {
    const runId = new URL(req.url).searchParams.get("runId");
    if (!runId) return jsonResponse({ ok: false, error: "runId é obrigatório" }, 400);
    const cases = await listTestCases(runId);
    return jsonResponse({ ok: true, cases });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
