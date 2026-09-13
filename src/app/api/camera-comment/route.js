import { describeScreenIfNotable, CAMERA_WATCH_INSTRUCTION } from "@/lib/gemini.js";
import { withPersona } from "@/lib/rag.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/camera-comment   body: { image: {mimeType, data}, personaMode? }
 *
 * Saudação PROATIVA do Modo Observância (ver assistant/page.js): a pessoa não perguntou
 * nada — o cliente manda uma foto da câmera periódica e esta rota decide se há algo digno de
 * comentário (comportamento pré-configurado: cumprimenta a esposa do usuário, Alice Lopes, e
 * a cachorra da família, Nala, quando aparecem — ver CAMERA_WATCH_INSTRUCTION).
 * `comment: null` é o caso comum (nada relevante); só quando não-nulo o cliente mostra/fala.
 */
export async function POST(req) {
  try {
    const { image, personaMode = false } = await req.json();
    if (!image?.data || !image?.mimeType) {
      return jsonResponse({ ok: false, error: "image é obrigatório" }, 400);
    }
    const instruction = withPersona(CAMERA_WATCH_INSTRUCTION, personaMode);
    const comment = await describeScreenIfNotable(image, instruction, "Aqui está a foto da câmera agora.");
    return jsonResponse({ ok: true, comment });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
