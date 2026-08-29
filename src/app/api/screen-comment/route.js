import { describeScreenIfNotable, SCREEN_WATCH_INSTRUCTION } from "@/lib/gemini.js";
import { withPersona } from "@/lib/rag.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/screen-comment   body: { image: {mimeType, data}, personaMode?, focus? }
 *
 * Modo Tela PROATIVO do Assistente (ver assistant/page.js): a pessoa não perguntou nada — o
 * cliente manda uma captura de tela periódica (intervalo escolhido no seletor do Assistente)
 * e esta rota decide se há algo digno de nota. `comment: null` é o caso comum (nada
 * relevante); só quando não-nulo o cliente mostra/fala alguma coisa.
 *
 * `focus` (opcional) — direcionamento livre digitado pela pessoa (ex.: "avise se o build
 * quebrar") — sobrescreve o critério padrão de "o que vale a pena notar" só pra ESTA vigília.
 */
export async function POST(req) {
  try {
    const { image, personaMode = false, focus = null } = await req.json();
    if (!image?.data || !image?.mimeType) {
      return jsonResponse({ ok: false, error: "image é obrigatório" }, 400);
    }
    const focusBlock = focus?.trim()
      ? `\n\nDIRECIONAMENTO DADO PELO USUÁRIO — priorize isso acima do critério padrão acima (mas ainda pode notar algo MUITO óbvio fora disso, tipo um erro na tela): "${focus.trim()}"`
      : "";
    const instruction = withPersona(SCREEN_WATCH_INSTRUCTION + focusBlock, personaMode);
    const comment = await describeScreenIfNotable(image, instruction);
    return jsonResponse({ ok: true, comment });
  } catch (err) {
    // err.keyLabel (ver rewriteError em gemini.js) diz qual chave do pool falhou —
    // informação essencial pra diagnosticar erro de cota.
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
