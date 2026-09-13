import { generateCompanionRemark } from "@/lib/gemini.js";
import { jsonResponse } from "@/lib/http.js";
import { getCategoryData } from "@/lib/pendingWork.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/companion/remark   body: { category, excludeKeys? }
 *
 * Modo Interativo — uma fala espontânea curta da Lisa sobre algo REAL (ver
 * COMPANION_INSTRUCTION em src/lib/gemini.js). Mesma lógica de dados e de anti-repetição do
 * Modo Rádio (src/lib/pendingWork.js): `excludeKeys` são os itens que ela já comentou nesta
 * sessão, e a resposta devolve `usedKeys` pro cliente ir acumulando — sem isso ela repetiria as
 * mesmas 2 tarefas a cada 2 minutos.
 */
export async function POST(req) {
  try {
    const { category, excludeKeys } = await req.json();
    if (!category) return jsonResponse({ ok: false, error: "category é obrigatório" }, 400);

    const data = await getCategoryData(category, excludeKeys || []);
    if (!data.text?.trim()) return jsonResponse({ ok: true, text: null, usedKeys: [] }); // nada real pra comentar — cliente só ignora essa rodada

    const text = await generateCompanionRemark({ category, data: data.text });
    return jsonResponse({ ok: true, text: text || null, usedKeys: data.usedKeys });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
