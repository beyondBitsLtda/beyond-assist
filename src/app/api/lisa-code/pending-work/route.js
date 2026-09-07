import { getCategoryData } from "@/lib/pendingWork.js";
import { jsonResponse } from "@/lib/http.js";
import { checkLisaCodeToken } from "@/lib/lisaCodeAuth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SOURCES = new Set(["trello", "delp", "sentinel", "thoughts"]);

/**
 * GET /api/lisa-code/pending-work?source=trello|delp|sentinel|thoughts   headers: { "x-lisa-token": "..." }
 *
 * Usada pela ferramenta list_pending_work da Lisa Code (extensão do VS Code) — mesmos dados
 * reais e mesmo filtro de "só pendente/em aberto" que o Modo Rádio já usa (ver
 * src/lib/pendingWork.js), pra não duplicar essa lógica em dois lugares.
 */
export async function GET(req) {
  try {
    if (!checkLisaCodeToken(req)) return jsonResponse({ ok: false, error: "token inválido ou LISA_EXTENSION_TOKEN não configurado no servidor" }, 401);

    const source = new URL(req.url).searchParams.get("source");
    if (!VALID_SOURCES.has(source)) return jsonResponse({ ok: false, error: "source inválido — use trello, delp, sentinel ou thoughts" }, 400);

    const data = await getCategoryData(source);
    return jsonResponse({ ok: true, data: data || "(nada pendente no momento)" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
