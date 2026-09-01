import { evaluateTestCase } from "@/lib/gemini.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/test-mode/evaluate   body: { itemTestado, descricao, condicaoAprovacao, images }
 * Compara capturas de tela com os passos/critério de um caso de teste — não grava nada, só
 * devolve o veredito (ver evaluateTestCase em src/lib/gemini.js). */
export async function POST(req) {
  try {
    const { itemTestado, descricao, condicaoAprovacao, images } = await req.json();
    if (!Array.isArray(images) || !images.length) {
      return jsonResponse({ ok: false, error: "images é obrigatório (pelo menos 1 captura de tela)" }, 400);
    }
    const result = await evaluateTestCase({ itemTestado, descricao, condicaoAprovacao, images });
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
