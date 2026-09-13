import { describeAudioIfNotable, MIC_WATCH_INSTRUCTION } from "@/lib/gemini.js";
import { withPersona } from "@/lib/rag.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/mic-comment   body: { audio: {mimeType, data}, personaMode? } — Modo Escuta (ver
 * src/app/(panels)/assistant/page.js): microfone realmente aberto, grava pedacinhos curtos, a
 * Lisa comenta se achar algo digno de nota (ex.: cantando). Mesmo formato de screen-comment/
 * camera-comment — nada de áudio fica salvo, só é analisado e descartado. */
export async function POST(req) {
  try {
    const { audio, personaMode = false } = await req.json();
    if (!audio?.data || !audio?.mimeType) {
      return jsonResponse({ ok: false, error: "audio é obrigatório" }, 400);
    }
    const instruction = withPersona(MIC_WATCH_INSTRUCTION, personaMode);
    const comment = await describeAudioIfNotable(audio, instruction);
    return jsonResponse({ ok: true, comment });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
