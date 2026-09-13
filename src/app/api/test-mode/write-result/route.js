import { writeTestCaseResult } from "@/lib/sentinelTests.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/test-mode/write-result   body: { runId, caseKey, resultado, expectedUpdatedAt }
 * Grava o resultado de VOLTA no run de teste de verdade (cloud_runs). Nunca cria ticket, nunca
 * mexe em evidências — só o campo `resultado` + um registro no executionHistory do caso. */
export async function POST(req) {
  try {
    const { runId, caseKey, resultado, expectedUpdatedAt } = await req.json();
    if (!runId || !caseKey || !resultado) {
      return jsonResponse({ ok: false, error: "runId, caseKey e resultado são obrigatórios" }, 400);
    }
    const result = await writeTestCaseResult(runId, caseKey, resultado, { author: "Lisa", expectedUpdatedAt });
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 400);
  }
}
