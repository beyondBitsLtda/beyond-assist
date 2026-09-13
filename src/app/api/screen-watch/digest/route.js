import { summarizeNewScreenActivity, VIGIA_DIGEST_INSTRUCTION } from "@/lib/gemini.js";
import { withPersona } from "@/lib/rag.js";
import { jsonResponse } from "@/lib/http.js";
import { getNewScreenObservations, getLatestScreenObservationId } from "@/lib/screenWatch.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/screen-watch/digest   body: { sinceId?, personaMode? }
 *
 * Modo Vigia PROATIVO (ver assistant/page.js): de tempos em tempos, de QUALQUER dispositivo
 * (não depende da tela estar sendo compartilhada NAQUELE aparelho), pergunta "o que há de
 * novo desde `sinceId`" — e só narra quando há algo novo E que valha a pena (`comment: null`
 * é o caso comum). `sinceId` ausente/0 = "acabei de ligar, só me diga o ponteiro atual sem
 * narrar o histórico inteiro que já existia antes".
 */
export async function POST(req) {
  try {
    const { sinceId = 0, personaMode = false } = await req.json();
    if (!sinceId) {
      const latestId = await getLatestScreenObservationId();
      return jsonResponse({ ok: true, comment: null, latestId });
    }
    const rows = await getNewScreenObservations(sinceId);
    if (!rows.length) return jsonResponse({ ok: true, comment: null, latestId: sinceId });
    const instruction = withPersona(VIGIA_DIGEST_INSTRUCTION, personaMode);
    const comment = await summarizeNewScreenActivity(rows, instruction);
    const latestId = rows[rows.length - 1].id;
    return jsonResponse({ ok: true, comment, latestId });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
