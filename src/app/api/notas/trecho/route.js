import { transcreverTrechoDeNota } from "@/lib/gemini.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 35 s de WAV mono 16 kHz em base64 dá ~1,5 MB; o dobro cobre um aparelho que mandou 48 kHz.
const MAX_BASE64 = 4_000_000;

/** POST /api/notas/trecho   body: { tema?, anterior?, audio: { mimeType, data } } — Modo Tomar
 * nota (ver src/components/panels/TomarNota.js): transcreve um trecho de ~30 s ao pé da letra.
 * O áudio não fica salvo em lugar nenhum; só o texto volta para o aparelho. */
export async function POST(req) {
  try {
    const { tema = "", anterior = "", audio } = await req.json();
    if (!audio?.data || audio.mimeType !== "audio/wav") {
      return jsonResponse({ ok: false, error: "audio (audio/wav) é obrigatório" }, 400);
    }
    if (audio.data.length > MAX_BASE64) return jsonResponse({ ok: false, error: "trecho grande demais" }, 413);
    const texto = await transcreverTrechoDeNota(audio, {
      tema: String(tema).slice(0, 200),
      anterior: String(anterior).slice(-240),
    });
    return jsonResponse({ ok: true, texto });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
