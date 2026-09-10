"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { recordGame } from "@/lib/gameHistory.js";

// Pedra-papel-tesoura pela CÂMERA. Reaproveita o reconhecedor de gestos do MediaPipe que já
// estava no projeto (é o mesmo modelo do ✌️ que acorda a Lisa, em public/mediapipe/) — ele
// reconhece de fábrica Closed_Fist, Open_Palm e Victory, que mapeiam exatamente em
// pedra/papel/tesoura. Roda 100% local: nenhum quadro sai da máquina.
//
// ATENÇÃO (ver assistant/page.js): o gesto de acordar é justamente ✌️, então o disparo do
// "acordar" fica BLOQUEADO enquanto este jogo está aberto — senão mostrar tesoura abriria o
// microfone no meio da partida.

const GESTURE_TO_MOVE = { Closed_Fist: "pedra", Open_Palm: "papel", Victory: "tesoura" };
const MOVES = ["pedra", "papel", "tesoura"];
const BEATS = { pedra: "tesoura", papel: "pedra", tesoura: "papel" }; // chave vence valor
const EMOJI = { pedra: "✊", papel: "✋", tesoura: "✌️" };
const ROUNDS = 5;
const SAMPLE_MS = 900; // janela em que a mão é lida depois do "JÁ!"
const MIN_CONFIDENCE = 0.55;

export default function LisaRockPaper({ videoRef, onMood, onFinish }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState("idle"); // "idle" | "count" | "read" | "shown"
  const [count, setCount] = useState(3);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState({ you: 0, lisa: 0 });
  const [picks, setPicks] = useState(null); // { you, lisa, outcome }
  const [result, setResult] = useState(null);
  const [live, setLive] = useState(null); // o que a câmera está vendo agora (pra você conferir)

  const recognizer = useRef(null);
  const timers = useRef([]);
  const yourHistory = useRef([]); // suas últimas jogadas — ela usa pra te ler
  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // carrega o reconhecedor (mesmo WASM/modelo já vendorizados)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { GestureRecognizer, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        const rec = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/mediapipe/gesture_recognizer.task", delegate: "GPU" },
          runningMode: "VIDEO",
        });
        if (cancelled) return rec.close();
        recognizer.current = rec;
        setReady(true);
      } catch (err) {
        if (!cancelled) setError(err?.message || "não consegui carregar o reconhecimento de gestos");
      }
    })();
    return () => {
      cancelled = true;
      clearTimers();
      recognizer.current?.close?.();
      recognizer.current = null;
    };
  }, []);

  /** Lê a mão por SAMPLE_MS e devolve a jogada mais frequente (um quadro solto erra muito). */
  const readHand = useCallback(
    () =>
      new Promise((resolve) => {
        const votes = {};
        const t0 = performance.now();
        const tick = () => {
          const v = videoRef?.current;
          const rec = recognizer.current;
          if (v?.videoWidth && rec) {
            try {
              const res = rec.recognizeForVideo(v, performance.now());
              const top = res?.gestures?.[0]?.[0];
              const mv = top && top.score >= MIN_CONFIDENCE ? GESTURE_TO_MOVE[top.categoryName] : null;
              if (mv) {
                votes[mv] = (votes[mv] || 0) + 1;
                setLive(mv);
              }
            } catch {
              /* quadro ruim: ignora */
            }
          }
          if (performance.now() - t0 < SAMPLE_MS) requestAnimationFrame(tick);
          else {
            const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
            resolve(best ? best[0] : null);
          }
        };
        requestAnimationFrame(tick);
      }),
    [videoRef]
  );

  /** Ela escolhe: normalmente aleatório, mas se você repetiu a MESMA jogada duas vezes, ela
   * "te lê" e joga o que vence isso. É o que dá a sensação de estar jogando contra alguém. */
  const lisaPick = useCallback(() => {
    const h = yourHistory.current;
    if (h.length >= 2 && h[h.length - 1] === h[h.length - 2] && Math.random() < 0.7) {
      const yours = h[h.length - 1];
      return Object.keys(BEATS).find((m) => BEATS[m] === yours);
    }
    return MOVES[Math.floor(Math.random() * MOVES.length)];
  }, []);

  const playRound = useCallback(async () => {
    if (result || !ready) return;
    clearTimers();
    setPicks(null);
    setLive(null);
    setPhase("count");
    onMoodRef.current?.("focused");

    for (let n = 3; n >= 1; n--) {
      // eslint-disable-next-line no-loop-func
      timers.current.push(setTimeout(() => setCount(n), (3 - n) * 700));
    }
    timers.current.push(
      setTimeout(async () => {
        setPhase("read");
        const yours = await readHand();
        const hers = lisaPick();
        if (!yours) {
          setPicks({ you: null, lisa: hers, outcome: "nada" });
          setPhase("shown");
          onMoodRef.current?.("confused");
          return;
        }
        yourHistory.current.push(yours);
        const outcome = yours === hers ? "draw" : BEATS[yours] === hers ? "you" : "lisa";
        setPicks({ you: yours, lisa: hers, outcome });
        setPhase("shown");
        onMoodRef.current?.(outcome === "you" ? "sad" : outcome === "lisa" ? "smug" : "confused");

        setScore((prev) => {
          const next = { ...prev };
          if (outcome === "you") next.you++;
          else if (outcome === "lisa") next.lisa++;
          setRound((r) => {
            const nr = r + 1;
            if (nr >= ROUNDS) {
              const final = next.you > next.lisa ? "win" : next.you < next.lisa ? "loss" : "draw";
              setResult(final);
              recordGame({ game: "ppt", result: final, detail: `${next.you}x${next.lisa}` });
              onFinishRef.current?.(final);
            }
            return nr;
          });
          return next;
        });
      }, 2100)
    );
  }, [result, ready, readHand, lisaPick]);

  const restart = () => {
    clearTimers();
    setRound(0);
    setScore({ you: 0, lisa: 0 });
    setResult(null);
    setPicks(null);
    setPhase("idle");
    yourHistory.current = [];
  };

  const big =
    phase === "count" ? String(count)
    : phase === "read" ? "JÁ!"
    : picks ? `${EMOJI[picks.you] || "❔"}  vs  ${EMOJI[picks.lisa]}`
    : "PRONTO?";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: 2, display: "flex", gap: 12 }}>
        <span style={{ color: CY }}>VOCÊ {score.you}</span>
        <span style={{ color: "rgba(207,239,251,0.35)" }}>{Math.min(round + 1, ROUNDS)}/{ROUNDS}</span>
        <span style={{ color: OR }}>{score.lisa} LISA</span>
      </div>

      <div style={{ width: "min(92vw, 320px)", height: 96, borderRadius: 12, border: `2px solid ${phase === "read" ? GR : "rgba(var(--accent-rgb),0.25)"}`, background: "rgba(var(--accent-rgb),0.05)", display: "flex", alignItems: "center", justifyContent: "center", ...mono, fontSize: phase === "shown" ? 30 : 34, letterSpacing: 3, color: "#eafcff" }}>
        {big}
      </div>

      <div style={{ ...mono, fontSize: 9.5, letterSpacing: 1, textAlign: "center", minHeight: 26, color: picks?.outcome === "you" ? GR : picks?.outcome === "lisa" ? OR : "rgba(207,239,251,0.45)" }}>
        {error ? `⚠ ${error}` : !ready ? "carregando reconhecimento de gestos…"
          : picks?.outcome === "nada" ? "NÃO VI SUA MÃO — MOSTRE ✊ ✋ OU ✌️ PRA CÂMERA"
          : picks?.outcome === "you" ? "VOCÊ VENCEU A RODADA"
          : picks?.outcome === "lisa" ? "ELA VENCEU A RODADA"
          : picks?.outcome === "draw" ? "EMPATE NA RODADA"
          : phase === "read" ? `MOSTRE AGORA${live ? ` · vendo: ${live}` : ""}`
          : "✊ pedra · ✋ papel · ✌️ tesoura — tudo lido local"}
      </div>

      {result ? (
        <>
          <div style={{ ...mono, fontSize: 11, letterSpacing: 2, color: result === "win" ? GR : result === "loss" ? OR : "rgba(207,239,251,0.6)" }}>
            {result === "win" ? "VOCÊ VENCEU" : result === "loss" ? "A LISA VENCEU" : "EMPATE"}
          </div>
          <button onClick={restart} style={{ ...mono, fontSize: 10, letterSpacing: 1.5, padding: "8px 16px", borderRadius: 6, border: `1px solid ${CY}`, background: "rgba(var(--accent-rgb),0.08)", color: "#eafcff", cursor: "pointer" }}>
            JOGAR DE NOVO
          </button>
        </>
      ) : (
        <button
          onClick={playRound}
          disabled={!ready || phase === "count" || phase === "read"}
          style={{ ...mono, fontSize: 10, letterSpacing: 1.5, padding: "8px 16px", borderRadius: 6, border: `1px solid ${ready ? CY : "rgba(var(--accent-rgb),0.2)"}`, background: "rgba(var(--accent-rgb),0.08)", color: "#eafcff", cursor: ready ? "pointer" : "default" }}
        >
          {phase === "idle" ? "COMEÇAR" : phase === "shown" ? "PRÓXIMA RODADA" : "…"}
        </button>
      )}
    </div>
  );
}
