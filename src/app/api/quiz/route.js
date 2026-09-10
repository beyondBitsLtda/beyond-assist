import { generateQuizQuestion, commentQuizAnswer } from "@/lib/gemini.js";
import { recordQuizAnswer, recentQuizQuestions, QUIZ_CATEGORIES, LEVELS, quizPointsFor } from "@/lib/activities.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/quiz
 *   { action: "question", category, difficulty }  → gera uma pergunta nova
 *   { action: "answer", category, difficulty, question, options, correctIndex, chosenIndex,
 *     explanation, recommendation }               → registra a resposta e devolve o comentário dela
 *
 * A CORREÇÃO é feita aqui no servidor comparando com o correctIndex que veio na pergunta — o
 * cliente manda o que marcou, não se acertou. Mesmo sendo um app pessoal, deixar o navegador
 * decidir "acertei" tornaria a pontuação da tabela sem sentido.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, category, difficulty } = body;

    if (!QUIZ_CATEGORIES.includes(category)) return jsonResponse({ ok: false, error: `categoria inválida: ${category}` }, 400);
    if (!LEVELS.includes(difficulty)) return jsonResponse({ ok: false, error: `dificuldade inválida: ${difficulty}` }, 400);

    if (action === "question") {
      // manda as perguntas recentes pro modelo não repetir; se o banco não responder, segue sem
      const avoid = await recentQuizQuestions({ category, difficulty }).catch(() => []);
      const q = await generateQuizQuestion({ category, difficulty, avoid });
      return jsonResponse({ ok: true, question: q });
    }

    if (action === "answer") {
      const { question, options, correctIndex, chosenIndex, explanation, recommendation } = body;
      if (!Array.isArray(options) || typeof correctIndex !== "number") {
        return jsonResponse({ ok: false, error: "options/correctIndex são obrigatórios" }, 400);
      }
      const isCorrect = chosenIndex === correctIndex;
      const chosen = options[chosenIndex] ?? null;
      const correct = options[correctIndex] ?? null;

      // registra ANTES de pedir o comentário: se o Gemini estiver fora do ar, a pontuação não
      // pode ser perdida por isso
      let points = 0;
      let saveError = null;
      try {
        points = await recordQuizAnswer({ category, difficulty, question, chosen, correct, isCorrect, recommendation });
      } catch (err) {
        saveError = String(err?.message || err);
        points = quizPointsFor(difficulty, isCorrect);
      }

      let comment = null;
      try {
        comment = await commentQuizAnswer({ question, chosen, correct, wasCorrect: isCorrect, explanation, recommendation });
      } catch {
        comment = null; // sem comentário dela, a tela mostra a explicação técnica que já tem
      }

      return jsonResponse({ ok: true, isCorrect, correctIndex, points, comment, saveError });
    }

    return jsonResponse({ ok: false, error: "action inválida — use question ou answer" }, 400);
  } catch (err) {
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return jsonResponse({ ok: false, error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}
