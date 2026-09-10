"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { recordGame } from "@/lib/gameHistory.js";

// Pong contra a Lisa.
//
// A física roda em unidades LÓGICAS fixas (W×H) com passo de tempo real (dt), não "por frame":
// assim o jogo tem a mesma velocidade num monitor de 60Hz e num de 144Hz, e a tela cheia é só
// uma escala visual — nada de re-tunar a IA por causa do tamanho.
//
// A raquete dela persegue a bola com velocidade limitada e um erro de leitura que ela recalcula
// a cada troca de bola: é isso que a deixa boa mas batível. IA perfeita de pong é imbatível e o
// jogo morre na primeira partida.

const W = 420;
const H = 260;
const PADDLE_H = 56;
const PADDLE_W = 8;
const BALL = 7;
const WIN_SCORE = 5;
const LISA_MAX_SPEED = 210;
const LISA_ERROR_PX = 26;

// pancada forte: não tem botão novo, é "dar o golpe" — bater com a raquete EM MOVIMENTO.
const SMASH_MIN_SPEED = 420; // px/s de raquete pra contar como pancada
const SMASH_BALL_BOOST = 1.4;
const BALL_MAX_SPEED = 900; // teto, senão a bola atravessa a raquete entre dois frames

export default function LisaPong({ onMood, onFinish }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState({ you: 0, lisa: 0 });
  const [result, setResult] = useState(null);
  const [full, setFull] = useState(false);
  const [lastSmash, setLastSmash] = useState(0); // só pra mostrar o aviso de "PANCADA!"

  // onMood/onFinish chegam como arrow function nova a cada render do pai, e `result` muda no
  // fim da partida: se qualquer um deles ficar nas dependências do laço de física, o efeito
  // se desmonta e remonta (reatribuindo cv.width, o que LIMPA o canvas) sem necessidade.
  // Por ref, o laço nasce uma vez e vive enquanto o componente existir.
  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const resultRef = useRef(result);
  resultRef.current = result;

  const g = useRef({
    ball: { x: W / 2, y: H / 2, vx: 190, vy: 120 },
    you: H / 2 - PADDLE_H / 2,
    youVel: 0,
    lisa: H / 2 - PADDLE_H / 2,
    lisaBias: 0,
    scored: null,
    shake: 0,
    flash: 0,
    sparks: [],
    trail: [],
  });

  const reset = useCallback((toward = 1) => {
    g.current.ball = { x: W / 2, y: H / 2, vx: 190 * toward, vy: (Math.random() * 2 - 1) * 130 };
    g.current.lisaBias = (Math.random() * 2 - 1) * LISA_ERROR_PX;
    g.current.trail = [];
  }, []);

  const restart = () => {
    setScore({ you: 0, lisa: 0 });
    setResult(null);
    reset(1);
    onMood?.("focused");
  };

  // Controle da raquete: mouse/dedo. Passado como PROP do React no <canvas> (e não com
  // addEventListener dentro de um efeito) de propósito — foi exatamente isso que quebrou: ao
  // alternar tela cheia o canvas era recriado e o listener ficava preso no elemento morto, e a
  // raquete parava de responder. Como prop, o React reatacha sozinho em qualquer remontagem.
  const lastMoveRef = useRef({ y: null, t: 0 });
  const handlePaddle = (e) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const now = performance.now();
    const target = Math.max(0, Math.min(H - PADDLE_H, y - PADDLE_H / 2));
    const prev = lastMoveRef.current;
    if (prev.y !== null && now > prev.t) {
      const inst = ((target - prev.y) / (now - prev.t)) * 1000; // px/s em unidades lógicas
      // média com o valor anterior: suaviza o serrilhado dos eventos de ponteiro
      g.current.youVel = g.current.youVel * 0.4 + inst * 0.6;
    }
    lastMoveRef.current = { y: target, t: now };
    g.current.you = target;
  };

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

    const spark = (x, y, strong) => {
      const n = strong ? 16 : 6;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (strong ? 140 : 70) * (0.4 + Math.random());
        g.current.sparks.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1 });
      }
    };

    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = g.current;

      if (!resultRef.current) {
        s.ball.x += s.ball.vx * dt;
        s.ball.y += s.ball.vy * dt;

        s.trail.push({ x: s.ball.x, y: s.ball.y });
        if (s.trail.length > 14) s.trail.shift();

        if (s.ball.y < BALL) { s.ball.y = BALL; s.ball.vy *= -1; spark(s.ball.x, BALL, false); }
        if (s.ball.y > H - BALL) { s.ball.y = H - BALL; s.ball.vy *= -1; spark(s.ball.x, H - BALL, false); }

        const target = s.ball.y + s.lisaBias - PADDLE_H / 2;
        const delta = Math.max(-LISA_MAX_SPEED * dt, Math.min(LISA_MAX_SPEED * dt, target - s.lisa));
        s.lisa = Math.max(0, Math.min(H - PADDLE_H, s.lisa + delta));

        // rebatida do jogador: o ponto de contato muda o ângulo, e raquete em movimento = pancada
        if (s.ball.vx < 0 && s.ball.x - BALL < PADDLE_W + 6 && s.ball.y > s.you && s.ball.y < s.you + PADDLE_H) {
          s.ball.x = PADDLE_W + 6 + BALL;
          const smash = Math.abs(s.youVel) > SMASH_MIN_SPEED;
          s.ball.vx = Math.abs(s.ball.vx) * (smash ? SMASH_BALL_BOOST : 1.05);
          s.ball.vy += ((s.ball.y - (s.you + PADDLE_H / 2)) / PADDLE_H) * 220;
          if (smash) {
            s.ball.vy += Math.sign(s.youVel) * 160; // o golpe também "puxa" a bola pro lado do movimento
            s.shake = 1;
            s.flash = 1;
            setLastSmash(now);
            onMoodRef.current?.("shocked"); // ela se assusta com a pancada
          }
          // teto de velocidade: sem isso a bola começa a atravessar a raquete entre frames
          const sp = Math.hypot(s.ball.vx, s.ball.vy);
          if (sp > BALL_MAX_SPEED) { s.ball.vx *= BALL_MAX_SPEED / sp; s.ball.vy *= BALL_MAX_SPEED / sp; }
          spark(s.ball.x, s.ball.y, smash);
          s.lisaBias = (Math.random() * 2 - 1) * LISA_ERROR_PX;
        }

        if (s.ball.vx > 0 && s.ball.x + BALL > W - PADDLE_W - 6 && s.ball.y > s.lisa && s.ball.y < s.lisa + PADDLE_H) {
          s.ball.x = W - PADDLE_W - 6 - BALL;
          s.ball.vx = -Math.abs(s.ball.vx) * 1.05;
          s.ball.vy += ((s.ball.y - (s.lisa + PADDLE_H / 2)) / PADDLE_H) * 220;
          spark(s.ball.x, s.ball.y, false);
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
              onMoodRef.current?.(outcome === "win" ? "sad" : "proud");
              onFinishRef.current?.(outcome);
            } else {
              onMoodRef.current?.(who === "you" ? "surprised" : "smug");
            }
            return next;
          });
          reset(who === "you" ? -1 : 1);
        }
      }

      // efeitos decaem com o tempo, não por frame
      s.shake = Math.max(0, s.shake - dt * 4);
      s.flash = Math.max(0, s.flash - dt * 3);
      s.sparks = s.sparks.filter((p) => p.life > 0);
      for (const p of s.sparks) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 1.8;
      }

      // ---- desenho ----
      const rgb = getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb").trim() || "56,225,255";
      ctx.save();
      if (s.shake > 0) ctx.translate((Math.random() - 0.5) * 8 * s.shake, (Math.random() - 0.5) * 8 * s.shake);
      ctx.clearRect(-10, -10, W + 20, H + 20);

      ctx.strokeStyle = `rgba(${rgb},0.18)`;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      // rastro da bola: quanto mais rápida, mais visível o efeito de velocidade
      s.trail.forEach((t, i) => {
        const a = (i / s.trail.length) * 0.35;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, BALL * (0.3 + (i / s.trail.length) * 0.7), 0, Math.PI * 2);
        ctx.fill();
      });

      for (const p of s.sparks) {
        ctx.fillStyle = `rgba(255,157,61,${Math.max(0, p.life)})`;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }

      ctx.fillStyle = `rgba(${rgb},0.9)`;
      ctx.fillRect(6, s.you, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "rgba(255,157,61,0.9)"; // laranja = ela
      ctx.fillRect(W - 6 - PADDLE_W, s.lisa, PADDLE_W, PADDLE_H);

      ctx.fillStyle = "#eafcff";
      ctx.beginPath();
      ctx.arc(s.ball.x, s.ball.y, BALL, 0, Math.PI * 2);
      ctx.fill();

      if (s.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.28})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reset]); // `reset` é useCallback estável; result/onMood/onFinish vêm por ref (ver acima)

  const smashRecent = performance.now() - lastSmash < 700;

  // ATENÇÃO: um ÚNICO elemento raiz, com o estilo trocando entre normal e tela cheia.
  // Antes isto era `if (!full) return body` e um wrapper por fora quando cheio — duas ESTRUTURAS
  // diferentes de árvore, então o React destruía e recriava o <canvas> ao alternar. Os
  // listeners de ponteiro (efeito com deps []) e o contexto de desenho ficavam presos no
  // elemento morto: a raquete simplesmente parava de responder. Mantendo o mesmo elemento e só
  // trocando o estilo, o canvas nunca é recriado.
  return (
    <div
      style={
        full
          ? { position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 16 }
          : { display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }
      }
    >
      <div style={{ ...mono, fontSize: 11, letterSpacing: 2, display: "flex", gap: 14, alignItems: "center" }}>
        <span style={{ color: CY }}>VOCÊ {score.you}</span>
        <span style={{ color: "rgba(207,239,251,0.35)" }}>até {WIN_SCORE}</span>
        <span style={{ color: OR }}>{score.lisa} LISA</span>
        <button
          onClick={() => setFull((v) => !v)}
          style={{ ...mono, fontSize: 9, letterSpacing: 1, padding: "4px 9px", borderRadius: 5, border: "1px solid rgba(var(--accent-rgb),0.3)", background: "transparent", color: "#eafcff", cursor: "pointer" }}
        >
          {full ? "✕ SAIR" : "⛶ TELA CHEIA"}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onPointerMove={handlePaddle}
        onPointerDown={handlePaddle}
        style={{
          width: full ? `min(96vw, ${(96 * W) / H}vh)` : "min(92vw, 420px)",
          aspectRatio: `${W}/${H}`,
          borderRadius: 8,
          border: `1px solid ${smashRecent ? "rgba(255,157,61,0.9)" : "rgba(var(--accent-rgb),0.22)"}`,
          background: "rgba(0,0,0,0.4)",
          touchAction: "none",
          cursor: "none",
        }}
      />

      <div style={{ ...mono, fontSize: 9.5, letterSpacing: 1, color: result ? (result === "win" ? GR : OR) : smashRecent ? OR : "rgba(207,239,251,0.4)" }}>
        {result === "win" ? "VOCÊ GANHOU" : result === "loss" ? "A LISA GANHOU" : smashRecent ? "PANCADA!" : "MOVA PRA CONTROLAR · BATA COM A RAQUETE EM MOVIMENTO PRA DAR PANCADA"}
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
