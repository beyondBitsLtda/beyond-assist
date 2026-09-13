import { answerAboutScreenHistory, VIGIA_ASK_INSTRUCTION } from "@/lib/gemini.js";
import { withPersona } from "@/lib/rag.js";
import { jsonResponse } from "@/lib/http.js";
import { getRecentScreenObservations } from "@/lib/screenWatch.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 40;

/**
 * POST /api/screen-watch/ask   body: { question, personaMode? }
 *
 * Modo Vigia (ver assistant/page.js): pergunta sob demanda sobre o HISTÓRICO de observações
 * do Modo Tela (não a tela ao vivo — funciona de QUALQUER dispositivo, inclusive celular, já
 * que só lê a tabela screen_observations na nuvem).
 */
export async function POST(req) {
  try {
    const { question, personaMode = false } = await req.json();
    if (!question?.trim()) return jsonResponse({ ok: false, error: "question é obrigatório" }, 400);
    const rows = await getRecentScreenObservations(HISTORY_LIMIT);
    const instruction = withPersona(VIGIA_ASK_INSTRUCTION, personaMode);
    const answer = await answerAboutScreenHistory(question, rows, instruction);
    return jsonResponse({ ok: true, answer });
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
