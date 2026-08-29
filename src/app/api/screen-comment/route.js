import { describeScreenIfNotable, SCREEN_WATCH_INSTRUCTION } from "@/lib/gemini.js";
import { withPersona } from "@/lib/rag.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/screen-comment   body: { image: {mimeType, data}, personaMode? }
 *
 * Modo Tela PROATIVO do Assistente (ver assistant/page.js): a pessoa não perguntou nada — o
 * cliente manda uma captura de tela periódica (a cada poucos minutos, de propósito espaçado
 * pra não gastar cota à toa) e esta rota decide se há algo digno de nota. `comment: null`
 * é o caso comum (nada relevante); só quando não-nulo o cliente mostra/fala alguma coisa.
 */
export async function POST(req) {
  try {
    const { image, personaMode = false } = await req.json();
    if (!image?.data || !image?.mimeType) {
      return jsonResponse({ ok: false, error: "image é obrigatório" }, 400);
    }
    const comment = await describeScreenIfNotable(image, withPersona(SCREEN_WATCH_INSTRUCTION, personaMode));
    return jsonResponse({ ok: true, comment });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
