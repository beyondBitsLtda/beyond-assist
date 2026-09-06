import { interpretVigiaChatMessage, VIGIA_CAMERA_CHAT_INSTRUCTION } from "@/lib/gemini.js";
import { withPersona } from "@/lib/rag.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/screen-share/interpret   body: { text, personaMode? }
 *
 * Câmera de Vigia: interpreta uma mensagem mandada por quem assiste (não repete palavra por
 * palavra) — devolve o que a Lisa deve FALAR, pelo mesmo /api/speak de sempre (mesma voz).
 */
export async function POST(req) {
  try {
    const { text, personaMode = false } = await req.json();
    if (!text?.trim()) return jsonResponse({ ok: false, error: "text é obrigatório" }, 400);
    const instruction = withPersona(VIGIA_CAMERA_CHAT_INSTRUCTION, personaMode);
    const reply = await interpretVigiaChatMessage(text, instruction);
    return jsonResponse({ ok: true, reply });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
