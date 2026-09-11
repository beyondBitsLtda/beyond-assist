"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { recordGame } from "@/lib/gameHistory.js";

// Air hockey contra a Lisa — primo do pong, mas com movimento nos DOIS eixos e disco com
// atrito. Mesmas escolhas que já se provaram no pong: unidades lógicas fixas, passo de tempo
// real (dt) e handlers de ponteiro como PROP do React (nunca addEventListener em efeito, senão
// o listener fica preso num canvas recriado — foi o bug da raquete).
//
// A colisão com o taco não é só "inverter a velocidade": aplica impulso ao longo da NORMAL do
// contato e soma parte da velocidade do taco. É isso que permite dar tabelas e pancadas de
// verdade, em vez de o disco sempre voltar pelo mesmo caminho.

const W = 300;
const H = 420;
const PUCK_R = 11;
const MALLET_R = 20;
const GOAL_W = 120; // largura da boca do gol (centralizada)
const FRICTION = 0.6; // por segundo
const PUCK_MAX = 780;
const WIN_SCORE = 5;
const LISA_SPEED = 260;

export default function LisaAirHockey({ onMood, onFinish }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState({ you: 0, lisa: 0 });
  const [result, setResult] = useState(null);

  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const resultRef = useRef(result);
  resultRef.current = result;

  const g = useRef({
    puck: { x: W / 2, y: H / 2, vx: 0, vy: 140 },
    you: { x: W / 2, y: H - 60, vx: 0, vy: 0 },
    lisa: { x: W / 2, y: 60 },
    sparks: [],
    shake: 0,
    // detecção de disco preso: acompanha o DESLOCAMENTO numa janela, não a velocidade — quando
    // o taco dela prensa o disco na parede, a velocidade fica alta mas ele não sai do lugar.
    stuckMs: 0,
    sampleMs: 0,
    backoffUntil: 0, // depois de destravar, ela RECUA por um instante (ver abaixo)
    lastSample: { x: W / 2, y: H / 2 },
  });

  const center = useCallback((toward = 1) => {
    g.current.puck = { x: W / 2, y: H / 2, vx: (Math.random() * 2 - 1) * 60, vy: 150 * toward };
  }, []);

  const restart = () => {
    setScore({ you: 0, lisa: 0 });
    setResult(null);
    center(1);
    onMoodRef.current?.("focused");
  };

  const lastRef = useRef({ x: 0, y: 0, t: 0 });
  const handleMallet = (e) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const now = performance.now();
    const s = g.current;
    // seu taco não passa da linha do meio (regra do jogo) nem sai da mesa
    const nx = Math.max(MALLET_R, Math.min(W - MALLET_R, x));
    const ny = Math.max(H / 2 + MALLET_R, Math.min(H - MALLET_R, y));
    const prev = lastRef.current;
    if (prev.t && now > prev.t) {
      const dt = (now - prev.t) / 1000;
      s.you.vx = (nx - prev.x) / dt;
      s.you.vy = (ny - prev.y) / dt;
    }
    lastRef.current = { x: nx, y: ny, t: now };
    s.you.x = nx;
    s.you.y = ny;
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

    const spark = (x, y, n) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 110 * (0.4 + Math.random());
        g.current.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
      }
    };

    /** Colisão disco × taco: empurra pra fora e aplica impulso na normal + arrasto do taco. */
    const hitMallet = (m, mvx, mvy) => {
      const s = g.current;
      const dx = s.puck.x - m.x;
      const dy = s.puck.y - m.y;
      const d = Math.hypot(dx, dy);
      const min = PUCK_R + MALLET_R;
      if (d >= min || d === 0) return false;
      const nx = dx / d;
      const ny = dy / d;
      s.puck.x = m.x + nx * min;
      s.puck.y = m.y + ny * min;
      const along = s.puck.vx * nx + s.puck.vy * ny;
      s.puck.vx += nx * (-2 * along + 90) + mvx * 0.45;
      s.puck.vy += ny * (-2 * along + 90) + mvy * 0.45;
      const sp = Math.hypot(s.puck.vx, s.puck.vy);
      if (sp > PUCK_MAX) { s.puck.vx *= PUCK_MAX / sp; s.puck.vy *= PUCK_MAX / sp; }
      spark(s.puck.x, s.puck.y, sp > 500 ? 12 : 5);
      if (sp > 500) s.shake = 0.8;
      return true;
    };

    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = g.current;

      if (!resultRef.current) {
        s.puck.x += s.puck.vx * dt;
        s.puck.y += s.puck.vy * dt;
        const decay = Math.exp(-FRICTION * dt);
        s.puck.vx *= decay;
        s.puck.vy *= decay;

        // paredes laterais
        if (s.puck.x < PUCK_R) { s.puck.x = PUCK_R; s.puck.vx *= -1; spark(PUCK_R, s.puck.y, 4); }
        if (s.puck.x > W - PUCK_R) { s.puck.x = W - PUCK_R; s.puck.vx *= -1; spark(W - PUCK_R, s.puck.y, 4); }

        // fundos: só é gol dentro da boca; fora dela, rebate
        const inGoal = Math.abs(s.puck.x - W / 2) < GOAL_W / 2;
        if (s.puck.y < PUCK_R) {
          if (inGoal) {
            setScore((prev) => {
              const next = { ...prev, you: prev.you + 1 };
              if (next.you >= WIN_SCORE) {
                setResult("win");
                recordGame({ game: "airhockey", result: "win", detail: `${next.you}x${next.lisa}` });
                onMoodRef.current?.("sad");
                onFinishRef.current?.("win");
              } else onMoodRef.current?.("surprised");
              return next;
            });
            s.shake = 1;
            center(1);
          } else { s.puck.y = PUCK_R; s.puck.vy *= -1; }
        }
        if (s.puck.y > H - PUCK_R) {
          if (inGoal) {
            setScore((prev) => {
              const next = { ...prev, lisa: prev.lisa + 1 };
              if (next.lisa >= WIN_SCORE) {
                setResult("loss");
                recordGame({ game: "airhockey", result: "loss", detail: `${next.you}x${next.lisa}` });
                onMoodRef.current?.("proud");
                onFinishRef.current?.("loss");
              } else onMoodRef.current?.("smug");
              return next;
            });
            center(-1);
          } else { s.puck.y = H - PUCK_R; s.puck.vy *= -1; }
        }

        // taco dela: persegue o disco na metade dela, senão volta pra frente do gol.
        // Durante o RECUO (logo após destravar o disco) ela vai pra casa mesmo com o disco no
        // campo dela — sem isso ela reprensava o disco no canto em menos de um segundo e o
        // empurrão de destravamento não adiantava nada.
        const goHome = s.puck.y > H / 2 || now < s.backoffUntil;
        // limita o alcance lateral dela: colada na parede, ela prensava o disco contra ela
        const tx = goHome ? W / 2 : Math.max(MALLET_R + 6, Math.min(W - MALLET_R - 6, s.puck.x));
        const ty = goHome ? 60 : Math.min(H / 2 - MALLET_R, s.puck.y - 6);
        const ang = Math.atan2(ty - s.lisa.y, tx - s.lisa.x);
        const dist = Math.hypot(tx - s.lisa.x, ty - s.lisa.y);
        const move = Math.min(LISA_SPEED * dt, dist);
        const lvx = Math.cos(ang) * (move / Math.max(dt, 0.001));
        const lvy = Math.sin(ang) * (move / Math.max(dt, 0.001));
        s.lisa.x = Math.max(MALLET_R, Math.min(W - MALLET_R, s.lisa.x + Math.cos(ang) * move));
        s.lisa.y = Math.max(MALLET_R, Math.min(H / 2 - MALLET_R, s.lisa.y + Math.sin(ang) * move));

        hitMallet(s.you, s.you.vx, s.you.vy);
        hitMallet(s.lisa, lvx, lvy);

        // ---- destrava o disco ----
        // Sem isto, ela prensava o disco num canto e a partida ficava parada pra sempre (bug
        // relatado). A janela de amostragem é o que pega TODOS os casos de travamento, inclusive
        // o "preso mas tremendo" — que um teste só de velocidade deixaria passar.
        s.sampleMs += dt * 1000;
        if (s.sampleMs >= 250) {
          const moved = Math.hypot(s.puck.x - s.lastSample.x, s.puck.y - s.lastSample.y);
          s.stuckMs = moved < 14 ? s.stuckMs + s.sampleMs : 0;
          s.lastSample = { x: s.puck.x, y: s.puck.y };
          s.sampleMs = 0;
        }
        if (s.stuckMs >= 700) {
          // Empurra pro CENTRO da mesa e, principalmente, MANDA ELA RECUAR. Só empurrar não
          // resolvia: o taco dela continuava em cima e reprensava o disco na hora.
          const ang = Math.atan2(H / 2 - s.puck.y, W / 2 - s.puck.x) + (Math.random() - 0.5) * 0.6;
          s.puck.vx = Math.cos(ang) * 420;
          s.puck.vy = Math.sin(ang) * 420;
          // afasta o disco da parede na marra, senão ele sai raspando e trava de novo
          s.puck.x = Math.max(PUCK_R + MALLET_R, Math.min(W - PUCK_R - MALLET_R, s.puck.x));
          s.backoffUntil = now + 800;
          s.stuckMs = 0;
          spark(s.puck.x, s.puck.y, 10);
        }
      }

      s.shake = Math.max(0, s.shake - dt * 4);
      s.sparks = s.sparks.filter((p) => p.life > 0);
      for (const p of s.sparks) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 1.8;
      }

      // ---- desenho ----
      const rgb = getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb").trim() || "56,225,255";
      ctx.save();
      if (s.shake > 0) ctx.translate((Math.random() - 0.5) * 7 * s.shake, (Math.random() - 0.5) * 7 * s.shake);
      ctx.clearRect(-10, -10, W + 20, H + 20);

      ctx.strokeStyle = `rgba(${rgb},0.18)`;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 40, 0, Math.PI * 2);
      ctx.stroke();

      // bocas de gol
      ctx.strokeStyle = `rgba(${rgb},0.75)`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(W / 2 - GOAL_W / 2, 2);
      ctx.lineTo(W / 2 + GOAL_W / 2, 2);
      ctx.moveTo(W / 2 - GOAL_W / 2, H - 2);
      ctx.lineTo(W / 2 + GOAL_W / 2, H - 2);
      ctx.stroke();
      ctx.lineWidth = 1;

      for (const p of s.sparks) {
        ctx.fillStyle = `rgba(255,157,61,${Math.max(0, p.life)})`;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }

      ctx.fillStyle = "rgba(255,157,61,0.9)"; // taco dela
      ctx.beginPath();
      ctx.arc(s.lisa.x, s.lisa.y, MALLET_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${rgb},0.9)`; // seu taco
      ctx.beginPath();
      ctx.arc(s.you.x, s.you.y, MALLET_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#eafcff";
      ctx.beginPath();
      ctx.arc(s.puck.x, s.puck.y, PUCK_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [center]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ ...mono, fontSize: 11, letterSpacing: 2, display: "flex", gap: 14 }}>
        <span style={{ color: OR }}>LISA {score.lisa}</span>
        <span style={{ color: "rgba(207,239,251,0.35)" }}>até {WIN_SCORE}</span>
        <span style={{ color: CY }}>{score.you} VOCÊ</span>
      </div>

      <canvas
        ref={canvasRef}
        onPointerMove={handleMallet}
        onPointerDown={handleMallet}
        style={{ width: "min(70vw, 240px)", aspectRatio: `${W}/${H}`, borderRadius: 8, border: "1px solid rgba(var(--accent-rgb),0.22)", background: "rgba(0,0,0,0.4)", touchAction: "none", cursor: "none" }}
      />

      <div style={{ ...mono, fontSize: 9.5, letterSpacing: 1, color: result ? (result === "win" ? GR : OR) : "rgba(207,239,251,0.4)", textAlign: "center" }}>
        {result === "win" ? "VOCÊ GANHOU" : result === "loss" ? "A LISA GANHOU" : "SEU TACO FICA NA METADE DE BAIXO"}
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
