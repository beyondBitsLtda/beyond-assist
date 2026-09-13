import { getTestCase } from "@/lib/sentinelTests.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/test-mode/case?runId=<uuid>&caseKey=<chave> — um caso de teste completo. */
export async function GET(req) {
  try {
    const params = new URL(req.url).searchParams;
    const runId = params.get("runId");
    const caseKey = params.get("caseKey");
    if (!runId || !caseKey) return jsonResponse({ ok: false, error: "runId e caseKey são obrigatórios" }, 400);
    const result = await getTestCase(runId, caseKey);
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
