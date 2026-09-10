// Atividades pontuadas do Modo Interativo: quiz de programação e pair programming.
// Tabelas `lisa_quiz` e `lisa_pair_sessions` (ver db/schema.sql, item 27). SERVER-ONLY.
import { supabase } from "./supabase.js";

export const QUIZ_CATEGORIES = ["python", "javascript", "java", "csharp", "cpp", "geral"];
export const LEVELS = ["facil", "medio", "dificil"];

// Pontuação: acertar difícil vale mais que acertar fácil, senão o incentivo é ficar no fácil
// pra inflar pontos. Errar não tira ponto — a ideia é estudar, não punir.
const QUIZ_POINTS = { facil: 10, medio: 25, dificil: 50 };
const PAIR_POINTS = { facil: 30, medio: 70, dificil: 150 };

export function quizPointsFor(difficulty, isCorrect) {
  return isCorrect ? QUIZ_POINTS[difficulty] ?? 0 : 0;
}
export function pairPointsFor(level) {
  return PAIR_POINTS[level] ?? 0;
}

export async function recordQuizAnswer({ category, difficulty, question, chosen, correct, isCorrect, recommendation }) {
  if (!QUIZ_CATEGORIES.includes(category)) throw new Error(`categoria inválida: ${category}`);
  if (!LEVELS.includes(difficulty)) throw new Error(`dificuldade inválida: ${difficulty}`);
  const points = quizPointsFor(difficulty, isCorrect);
  const { error } = await supabase.from("lisa_quiz").insert({
    category,
    difficulty,
    question: String(question).slice(0, 2000),
    chosen: chosen ? String(chosen).slice(0, 500) : null,
    correct: correct ? String(correct).slice(0, 500) : null,
    is_correct: !!isCorrect,
    points,
    recommendation: recommendation ? String(recommendation).slice(0, 1000) : null,
  });
  if (error) throw new Error(`recordQuizAnswer: ${error.message}`);
  return points;
}

/** Perguntas já feitas nessa categoria/dificuldade — mandadas de volta pro modelo pra ele não
 * repetir. Sem isso, as mesmas 3 perguntas voltavam toda hora. */
export async function recentQuizQuestions({ category, difficulty, limit = 25 }) {
  const { data, error } = await supabase
    .from("lisa_quiz")
    .select("question")
    .eq("category", category)
    .eq("difficulty", difficulty)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return []; // não vale derrubar o quiz por não conseguir ler o histórico
  return (data || []).map((r) => r.question);
}

/** Placar geral das atividades: pontos e acerto por categoria. */
export async function loadActivityStats() {
  const [quiz, pair] = await Promise.all([
    supabase.from("lisa_quiz").select("category, difficulty, is_correct, points").limit(2000),
    supabase.from("lisa_pair_sessions").select("level, status, points, repo, branch, feature, created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  if (quiz.error) throw new Error(`loadActivityStats(quiz): ${quiz.error.message}`);
  if (pair.error) throw new Error(`loadActivityStats(pair): ${pair.error.message}`);

  const rows = quiz.data || [];
  const byCategory = {};
  for (const r of rows) {
    const c = (byCategory[r.category] ||= { total: 0, correct: 0, points: 0 });
    c.total++;
    if (r.is_correct) c.correct++;
    c.points += r.points || 0;
  }

  const pairRows = pair.data || [];
  return {
    quiz: {
      total: rows.length,
      correct: rows.filter((r) => r.is_correct).length,
      points: rows.reduce((s, r) => s + (r.points || 0), 0),
      byCategory,
    },
    pair: {
      total: pairRows.length,
      done: pairRows.filter((r) => r.status === "concluida").length,
      points: pairRows.filter((r) => r.status === "concluida").reduce((s, r) => s + (r.points || 0), 0),
      sessions: pairRows.slice(0, 8),
    },
  };
}

export async function createPairSession({ repo, branch, level, feature, plan }) {
  if (!LEVELS.includes(level)) throw new Error(`nível inválido: ${level}`);
  const { data, error } = await supabase
    .from("lisa_pair_sessions")
    .insert({ repo, branch, level, feature: String(feature).slice(0, 500), plan: plan ? String(plan).slice(0, 4000) : null, points: pairPointsFor(level) })
    .select("id")
    .single();
  if (error) throw new Error(`createPairSession: ${error.message}`);
  return data.id;
}

/** Fecha a sessão. Os pontos só CONTAM quando concluída (ver loadActivityStats) — abrir sessão
 * e abandonar não deveria pontuar. */
export async function closePairSession({ id, status }) {
  if (!["concluida", "abandonada"].includes(status)) throw new Error(`status inválido: ${status}`);
  const { error } = await supabase.from("lisa_pair_sessions").update({ status }).eq("id", id);
  if (error) throw new Error(`closePairSession: ${error.message}`);
}
