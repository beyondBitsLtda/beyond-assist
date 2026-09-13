import { runLisaCodeTurn } from "@/lib/gemini.js";
import { jsonResponse } from "@/lib/http.js";
import { checkLisaCodeToken } from "@/lib/lisaCodeAuth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lisa-code/chat   headers: { "x-lisa-token": "..." }   body: { contents: Content[] }
 *
 * Um turno de conversa da Lisa Code (extensão do VS Code, uso PESSOAL — ver src/lib/gemini.js
 * pra detalhes de por que a execução das ferramentas fica sempre do lado do cliente). `contents`
 * é o histórico completo da conversa, já no formato do Gemini (a extensão é quem mantém esse
 * estado). Devolve o próximo turno cru do modelo — texto e/ou chamadas de função.
 */
export async function POST(req) {
  try {
    if (!checkLisaCodeToken(req)) return jsonResponse({ ok: false, error: "token inválido ou LISA_EXTENSION_TOKEN não configurado no servidor" }, 401);

    const { contents } = await req.json();
    if (!Array.isArray(contents) || !contents.length) return jsonResponse({ ok: false, error: "contents é obrigatório" }, 400);

    const content = await runLisaCodeTurn(contents);
    return jsonResponse({ ok: true, content });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
