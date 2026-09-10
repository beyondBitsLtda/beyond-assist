"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { recordGame } from "@/lib/gameHistory.js";

// Pong contra a Lisa. Toda a física roda no canvas com passo de tempo REAL (dt), não "por
// frame" — assim a velocidade do jogo não muda entre um monitor de 60Hz e um de 144Hz.
//
// A raquete dela persegue a bola com velocidade limitada e uma margem de erro que cresce quanto
// mais longe a bola está: é isso que a torna boa mas batível. Uma IA perfeita de pong é
// imbatível e o jogo morre na primeira partida.

const W = 420;
const H = 260;
const PADDLE_H = 56;
const PADDLE_W = 8;
const BALL = 7;
const WIN_SCORE = 5;
const LISA_MAX_SPEED = 210; // px/s — abaixo da bola de propósito
const LISA_ERROR_PX = 26; // erro de leitura da posição da bola

export default function LisaPong({ onMood, onFinish }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState({ you: 0, lisa: 0 });
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(true);

  // estado mutável do jogo fora do React: mexer nisso via setState a 60fps seria desperdício
  const g = useRef({
    ball: { x: W / 2, y: H / 2, vx: 190, vy: 120 },
    you: H / 2 - PADDLE_H / 2,
    lisa: H / 2 - PADDLE_H / 2,
    lisaBias: 0,
    scored: null,
  });

  const reset = useCallback((toward = 1) => {
    g.current.ball = { x: W / 2, y: H / 2, vx: 190 * toward, vy: (Math.random() * 2 - 1) * 130 };
    g.current.lisaBias = (Math.random() * 2 - 1) * LISA_ERROR_PX;
  }, []);

  const restart = () => {
    setScore({ you: 0, lisa: 0 });
    setResult(null);
    setRunning(true);
    reset(1);
    onMood?.("focused");
  };

  // controle: mouse/dedo movendo a raquete da esquerda
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const move = (e) => {
      const rect = cv.getBoundingClientRect();
      const y = ((e.clientY - rect.top) / rect.height) * H;
      g.current.you = Math.max(0, Math.min(H - PADDLE_H, y - PADDLE_H / 2));
    };
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerdown", move);
    return () => {
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerdown", move);
    };
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    let last = performance.now();

    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); // trava o passo se a aba congelou
      last = now;
      const s = g.current;

      if (running && !result) {
        s.ball.x += s.ball.vx * dt;
        s.ball.y += s.ball.vy * dt;

        if (s.ball.y < BALL) { s.ball.y = BALL; s.ball.vy *= -1; }
        if (s.ball.y > H - BALL) { s.ball.y = H - BALL; s.ball.vy *= -1; }

        // raquete da Lisa persegue com erro e velocidade limitada
        const target = s.ball.y + s.lisaBias - PADDLE_H / 2;
        const delta = Math.max(-LISA_MAX_SPEED * dt, Math.min(LISA_MAX_SPEED * dt, target - s.lisa));
        s.lisa = Math.max(0, Math.min(H - PADDLE_H, s.lisa + delta));

        // rebatidas: o ponto de contato na raquete muda o ângulo (dá controle pro jogador)
        if (s.ball.vx < 0 && s.ball.x - BALL < PADDLE_W + 6 && s.ball.y > s.you && s.ball.y < s.you + PADDLE_H) {
          s.ball.x = PADDLE_W + 6 + BALL;
          s.ball.vx = Math.abs(s.ball.vx) * 1.05;
          s.ball.vy += ((s.ball.y - (s.you + PADDLE_H / 2)) / PADDLE_H) * 220;
          s.lisaBias = (Math.random() * 2 - 1) * LISA_ERROR_PX; // ela "relê" a bola a cada troca
        }
        if (s.ball.vx > 0 && s.ball.x + BALL > W - PADDLE_W - 6 && s.ball.y > s.lisa && s.ball.y < s.lisa + PADDLE_H) {
          s.ball.x = W - PADDLE_W - 6 - BALL;
          s.ball.vx = -Math.abs(s.ball.vx) * 1.05;
          s.ball.vy += ((s.ball.y - (s.lisa + PADDLE_H / 2)) / PADDLE_H) * 220;
        }

        if (s.ball.x < -BALL) s.scored = "lisa";
        if (s.ball.x > W + BALL) s.scored = "you";
        if (s.scored) {
          const who = s.scored;
          s.scored = null;
          setScore((prev) => {
            const next = { ...prev, [who]: prev[who] + 1 };
            if (next.you >= WIN_SCORE || next.lisa >= WIN_SCORE) {
              const outcome = next.you >= WIN_SCORE ? "win" : "loss";
              setResult(outcome);
              recordGame({ game: "pong", result: outcome, detail: `${next.you}x${next.lisa}` });
              onMood?.(outcome === "win" ? "sad" : "proud");
              onFinish?.(outcome);
            } else {
              onMood?.(who === "you" ? "surprised" : "smug");
            }
            return next;
          });
          reset(who === "you" ? -1 : 1);
        }
      }

      // ---- desenho ----
      const rootStyle = getComputedStyle(document.documentElement);
      const rgb = rootStyle.getPropertyValue("--accent-rgb").trim() || "56,225,255";
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = `rgba(${rgb},0.18)`;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${rgb},0.9)`;
      ctx.fillRect(6, g.current.you, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "rgba(255,157,61,0.9)"; // laranja = ela, pra não confundir de quem é a raquete
      ctx.fillRect(W - 6 - PADDLE_W, g.current.lisa, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "#eafcff";
      ctx.beginPath();
      ctx.arc(g.current.ball.x, g.current.ball.y, BALL, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, result, reset, onMood, onFinish]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ ...mono, fontSize: 11, letterSpacing: 2, display: "flex", gap: 14 }}>
        <span style={{ color: CY }}>VOCÊ {score.you}</span>
        <span style={{ color: "rgba(207,239,251,0.35)" }}>até {WIN_SCORE}</span>
        <span style={{ color: OR }}>{score.lisa} LISA</span>
      </div>

      <canvas
        ref={canvasRef}
        style={{ width: "min(92vw, 420px)", aspectRatio: `${W}/${H}`, borderRadius: 8, border: "1px solid rgba(var(--accent-rgb),0.22)", background: "rgba(0,0,0,0.4)", touchAction: "none", cursor: "none" }}
      />

      <div style={{ ...mono, fontSize: 9.5, letterSpacing: 1, color: result ? (result === "win" ? GR : OR) : "rgba(207,239,251,0.4)" }}>
        {result === "win" ? "VOCÊ GANHOU" : result === "loss" ? "A LISA GANHOU" : "MOVA O MOUSE / DEDO PRA CONTROLAR"}
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
