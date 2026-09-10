"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { recordGame } from "@/lib/gameHistory.js";

// Duelo de reflexo: espera o sinal e clica antes dela.
//
// O tempo de reação dela é sorteado numa faixa humana (LISA_MS) — reação instantânea de
// computador tornaria o jogo impossível e sem graça. Clicar ANTES do sinal é queima de
// partida: perde a rodada na hora, que é o que dá tensão à espera.
const ROUNDS = 5;
const LISA_MS = [190, 340]; // faixa de reação dela, em ms
const WAIT_MS = [900, 2600]; // espera até o sinal — irregular, senão dá pra cronometrar

export default function LisaReflex({ onMood, onFinish }) {
  const [phase, setPhase] = useState("idle"); // "idle" | "waiting" | "go" | "shown"
  const [round, setRound] = useState(0);
  const [score, setScore] = useState({ you: 0, lisa: 0 });
  const [msg, setMsg] = useState(null);
  const [yourMs, setYourMs] = useState(null);
  const [result, setResult] = useState(null);

  const goAt = useRef(0);
  const lisaMs = useRef(0);
  const timers = useRef([]);
  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const scoreRound = useCallback((who, text, mood) => {
    setMsg(text);
    setPhase("shown");
    onMoodRef.current?.(mood);
    setScore((prev) => {
      const next = { ...prev, [who]: prev[who] + 1 };
      setRound((r) => {
        const nr = r + 1;
        if (nr >= ROUNDS) {
          const outcome = next.you > next.lisa ? "win" : next.you < next.lisa ? "loss" : "draw";
          setResult(outcome);
          recordGame({ game: "reflexo", result: outcome, detail: `${next.you}x${next.lisa}` });
          onFinishRef.current?.(outcome);
        }
        return nr;
      });
      return next;
    });
  }, []);

  const startRound = useCallback(() => {
    clearTimers();
    setMsg(null);
    setYourMs(null);
    setPhase("waiting");
    onMoodRef.current?.("focused");
    const wait = WAIT_MS[0] + Math.random() * (WAIT_MS[1] - WAIT_MS[0]);
    lisaMs.current = LISA_MS[0] + Math.random() * (LISA_MS[1] - LISA_MS[0]);
    timers.current.push(
      setTimeout(() => {
        goAt.current = performance.now();
        setPhase("go");
        // se você não clicar antes disso, ela clica
        timers.current.push(
          setTimeout(() => scoreRound("lisa", `ELA FOI MAIS RÁPIDA (${Math.round(lisaMs.current)}ms)`, "smug"), lisaMs.current)
        );
      }, wait)
    );
  }, [scoreRound]);

  const click = () => {
    if (result) return;
    if (phase === "idle" || phase === "shown") return startRound();
    if (phase === "waiting") {
      clearTimers();
      return scoreRound("lisa", "QUEIMOU! CLICOU ANTES DO SINAL", "laugh");
    }
    if (phase === "go") {
      clearTimers();
      const ms = performance.now() - goAt.current;
      setYourMs(Math.round(ms));
      return scoreRound("you", `VOCÊ: ${Math.round(ms)}ms · ELA: ${Math.round(lisaMs.current)}ms`, "surprised");
    }
  };

  const restart = () => {
    clearTimers();
    setRound(0);
    setScore({ you: 0, lisa: 0 });
    setResult(null);
    setMsg(null);
    setYourMs(null);
    setPhase("idle");
  };

  const bg = phase === "go" ? "rgba(123,216,143,0.22)" : phase === "waiting" ? "rgba(255,157,61,0.10)" : "rgba(var(--accent-rgb),0.05)";
  const big = phase === "go" ? "JÁ!" : phase === "waiting" ? "ESPERE…" : phase === "idle" ? "TOQUE PRA COMEÇAR" : "TOQUE PRA CONTINUAR";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: 2, display: "flex", gap: 12 }}>
        <span style={{ color: CY }}>VOCÊ {score.you}</span>
        <span style={{ color: "rgba(207,239,251,0.35)" }}>{Math.min(round + 1, ROUNDS)}/{ROUNDS}</span>
        <span style={{ color: OR }}>{score.lisa} LISA</span>
      </div>

      <button
        onClick={click}
        disabled={!!result}
        style={{
          width: "min(92vw, 340px)", height: 150, borderRadius: 12, cursor: result ? "default" : "pointer",
          border: `2px solid ${phase === "go" ? GR : "rgba(var(--accent-rgb),0.25)"}`,
          background: bg, color: "#eafcff", ...mono, fontSize: phase === "go" ? 34 : 12, letterSpacing: 3,
        }}
      >
        {result ? (result === "win" ? "VOCÊ VENCEU" : result === "loss" ? "A LISA VENCEU" : "EMPATE") : big}
      </button>

      <div style={{ ...mono, fontSize: 9.5, letterSpacing: 1, color: msg?.startsWith("QUEIMOU") ? OR : yourMs ? GR : "rgba(207,239,251,0.45)", textAlign: "center", minHeight: 14 }}>
        {msg || "CLIQUE ASSIM QUE A CAIXA FICAR VERDE — CLICAR ANTES PERDE A RODADA"}
      </div>

      {result && (
        <button
          onClick={restart}
          style={{ ...mono, fontSize: 10, letterSpacing: 1.5, padding: "8px 16px", borderRadius: 6, border: `1px solid ${CY}`, background: "rgba(var(--accent-rgb),0.08)", color: "#eafcff", cursor: "pointer" }}
        >
          JOGAR DE NOVO
        </button>
      )}
    </div>
  );
}
