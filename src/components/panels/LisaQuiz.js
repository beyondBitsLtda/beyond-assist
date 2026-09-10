"use client";

import { useCallback, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";

// Modo Quiz: você escolhe categoria e dificuldade, ela gera a pergunta, corrige e diz POR QUE —
// além de recomendar o que estudar. A correção acontece no SERVIDOR (ver /api/quiz): o cliente
// manda só o que você marcou, nunca "acertei", senão a pontuação da tabela não valeria nada.

const CATEGORIES = [
  { key: "python", label: "Python" },
  { key: "javascript", label: "JavaScript" },
  { key: "java", label: "Java" },
  { key: "csharp", label: "C#" },
  { key: "cpp", label: "C++" },
  { key: "geral", label: "Geral" },
];
const LEVELS = [
  { key: "facil", label: "Fácil", pts: 10 },
  { key: "medio", label: "Médio", pts: 25 },
  { key: "dificil", label: "Difícil", pts: 50 },
];

export default function LisaQuiz({ onMood }) {
  const [category, setCategory] = useState("geral");
  const [difficulty, setDifficulty] = useState("medio");
  const [q, setQ] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [verdict, setVerdict] = useState(null); // { isCorrect, correctIndex, points, comment, saveError }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [session, setSession] = useState({ asked: 0, right: 0, points: 0 });

  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;

  const nextQuestion = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQ(null);
    setChosen(null);
    setVerdict(null);
    onMoodRef.current?.("thinking");
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "question", category, difficulty }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setQ(data.question);
      onMoodRef.current?.("focused");
    } catch (err) {
      setError(err.message);
      onMoodRef.current?.("worried");
    } finally {
      setLoading(false);
    }
  }, [category, difficulty]);

  const answer = async (i) => {
    if (!q || verdict || loading) return;
    setChosen(i);
    setLoading(true);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          category,
          difficulty,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          chosenIndex: i,
          explanation: q.explanation,
          recommendation: q.recommendation,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setVerdict(data);
      setSession((prev) => ({ asked: prev.asked + 1, right: prev.right + (data.isCorrect ? 1 : 0), points: prev.points + (data.points || 0) }));
      onMoodRef.current?.(data.isCorrect ? "proud" : "worried");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const chip = (active) => ({
    ...mono, fontSize: 9, letterSpacing: 0.5, padding: "5px 9px", borderRadius: 20, cursor: "pointer",
    border: `1px solid ${active ? CY : "rgba(var(--accent-rgb),0.2)"}`,
    background: active ? "rgba(var(--accent-rgb),0.12)" : "transparent",
    color: active ? "#eafcff" : "rgba(207,239,251,0.55)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "min(94vw, 460px)" }}>
      <div style={{ ...mono, fontSize: 9.5, letterSpacing: 1.5, display: "flex", gap: 10, color: "rgba(207,239,251,0.55)" }}>
        <span>RODADA: {session.right}/{session.asked}</span>
        <span style={{ color: GR }}>{session.points} pts</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCategory(c.key)} disabled={loading} style={chip(category === c.key)}>{c.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {LEVELS.map((l) => (
          <button key={l.key} onClick={() => setDifficulty(l.key)} disabled={loading} style={chip(difficulty === l.key)} title={`${l.pts} pontos por acerto`}>
            {l.label} · {l.pts}pts
          </button>
        ))}
      </div>

      {error && <div style={{ ...mono, fontSize: 9.5, color: OR, textAlign: "center" }}>⚠ {error}</div>}

      {!q && !loading && (
        <button
          onClick={nextQuestion}
          style={{ ...mono, fontSize: 10, letterSpacing: 1.5, padding: "10px 18px", borderRadius: 6, border: `1px solid ${CY}`, background: "rgba(var(--accent-rgb),0.08)", color: "#eafcff", cursor: "pointer" }}
        >
          COMEÇAR
        </button>
      )}
      {loading && !q && <div style={{ ...mono, fontSize: 9.5, color: "rgba(207,239,251,0.45)" }}>ela está montando a pergunta…</div>}

      {q && (
        <>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "#eafcff", whiteSpace: "pre-wrap", textAlign: "left", width: "100%" }}>{q.question}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
            {q.options.map((opt, i) => {
              const isCorrect = verdict && i === verdict.correctIndex;
              const isWrongPick = verdict && i === chosen && !verdict.isCorrect;
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={!!verdict || loading}
                  style={{
                    ...mono, fontSize: 11, lineHeight: 1.45, textAlign: "left", padding: "9px 11px", borderRadius: 6,
                    whiteSpace: "pre-wrap", cursor: verdict ? "default" : "pointer",
                    border: `1px solid ${isCorrect ? GR : isWrongPick ? OR : "rgba(var(--accent-rgb),0.2)"}`,
                    background: isCorrect ? "rgba(123,216,143,0.14)" : isWrongPick ? "rgba(255,157,61,0.12)" : "rgba(var(--accent-rgb),0.04)",
                    color: "#eafcff",
                  }}
                >
                  {String.fromCharCode(65 + i)}) {opt}
                </button>
              );
            })}
          </div>

          {verdict && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 8, border: `1px solid ${verdict.isCorrect ? GR : OR}44`, background: "rgba(var(--accent-rgb),0.04)" }}>
              <div style={{ ...mono, fontSize: 10, letterSpacing: 1.5, color: verdict.isCorrect ? GR : OR }}>
                {verdict.isCorrect ? `ACERTOU · +${verdict.points} pts` : "ERROU"}
              </div>
              {/* o comentário dela vem primeiro; a explicação técnica fica como respaldo */}
              {verdict.comment && <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#eafcff" }}>{verdict.comment}</div>}
              <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "rgba(207,239,251,0.7)" }}>{q.explanation}</div>
              <div style={{ ...mono, fontSize: 10, lineHeight: 1.5, color: CY }}>📚 ESTUDAR: {q.recommendation}</div>
              {verdict.saveError && (
                <div style={{ ...mono, fontSize: 9, color: OR }} title={verdict.saveError}>
                  ⚠ não consegui gravar na tabela (os pontos desta rodada contam só aqui na tela)
                </div>
              )}
            </div>
          )}

          <button
            onClick={nextQuestion}
            disabled={loading}
            style={{ ...mono, fontSize: 10, letterSpacing: 1.5, padding: "9px 16px", borderRadius: 6, border: `1px solid ${CY}`, background: "rgba(var(--accent-rgb),0.08)", color: "#eafcff", cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "…" : verdict ? "PRÓXIMA PERGUNTA" : "TROCAR PERGUNTA"}
          </button>
        </>
      )}
    </div>
  );
}
