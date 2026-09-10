"use client";

import { useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { recordGame } from "@/lib/gameHistory.js";

// Cobrança de pênalti: você escolhe ÂNGULO e FORÇA arrastando a partir da bola (a seta mostra
// os dois — direção e comprimento), solta e chuta. A Lisa é a goleira e voa pra um lado.
//
// Arrastar-pra-chutar em vez de duas barras oscilando: funciona igual no mouse e no dedo, e a
// mira fica visível o tempo todo em vez de você ter que cronometrar dois cliques.
//
// Unidades LÓGICAS fixas com passo de tempo real (mesmo padrão do pong): a tela cheia é só
// escala visual e o jogo não muda de velocidade entre 60Hz e 144Hz.

const W = 420;
const H = 280;
const GOAL = { x: 60, y: 24, w: 300, h: 120 }; // trave
const BALL_START = { x: W / 2, y: H - 40 };
const BALL_R = 7;
const KEEPER_W = 46;
const KEEPER_H = 34;
const SHOTS = 5;
const MAX_DRAG = 130; // arrasto além disso não aumenta mais a força
const SHOT_SPEED = 520; // px/s na força máxima

export default function LisaPenalty({ onMood, onFinish }) {
  const canvasRef = useRef(null);
  const [shot, setShot] = useState(0); // quantas cobranças já saíram
  const [goals, setGoals] = useState(0);
  const [saves, setSaves] = useState(0);
  const [phase, setPhase] = useState("aim"); // "aim" | "flying" | "done"
  const [last, setLast] = useState(null); // "gol" | "defendeu" | "fora"
  const [full, setFull] = useState(false);

  // mesmo cuidado do pong: onMood/onFinish chegam como arrow nova a cada render do pai e
  // `phase` muda a cada cobrança — se ficarem nas dependências, os efeitos desmontam/remontam e
  // os listeners de ponteiro se perdem junto com o canvas. Por ref, ligam uma vez só.
  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const g = useRef({
    ball: { ...BALL_START, vx: 0, vy: 0 },
    drag: null, // { x, y } enquanto você mira
    keeper: { x: W / 2 - KEEPER_W / 2, y: GOAL.y + GOAL.h - KEEPER_H, vx: 0, dived: false },
    sparks: [],
    shake: 0,
  });

  // Mira por arrasto. Handlers como PROP do React no <canvas>, não addEventListener num efeito:
  // ao alternar tela cheia o canvas pode ser recriado, e um listener manual ficaria preso no
  // elemento morto (foi assim que a raquete do pong parou de responder). Como prop, o React
  // reatacha sozinho.
  const toLogical = (e) => {
    const cv = canvasRef.current;
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onAimDown = (e) => {
    if (phaseRef.current !== "aim") return;
    g.current.drag = toLogical(e);
  };

  const onAimMove = (e) => {
    if (!g.current.drag || phaseRef.current !== "aim") return;
    g.current.drag = toLogical(e);
  };

  const onAimUp = () => {
    if (!g.current.drag || phaseRef.current !== "aim") return;
    const s = g.current;
    // vetor da bola até onde você arrastou: direção do chute e força pelo comprimento
    const dx = s.drag.x - s.ball.x;
    const dy = s.drag.y - s.ball.y;
    s.drag = null;
    const len = Math.hypot(dx, dy);
    if (len < 12) return; // toque solto sem arrastar: não chuta
    const power = Math.min(1, len / MAX_DRAG);
    const nx = dx / len;
    const ny = dy / len;
    s.ball.vx = nx * SHOT_SPEED * power;
    s.ball.vy = ny * SHOT_SPEED * power;

    // A goleira escolhe o lado com uma leitura IMPERFEITA da direção: acerta o lado com boa
    // frequência, mas erra o suficiente pra dar gol. Chute mais forte = menos tempo pra ela
    // reagir, então a chance dela cai — é o que faz a força valer a pena.
    const readError = (Math.random() * 2 - 1) * 0.55;
    const guessX = s.ball.x + (nx + readError) * 200;
    const reaction = 1 - power * 0.35;
    s.keeper.vx = Math.max(-1, Math.min(1, (guessX - (s.keeper.x + KEEPER_W / 2)) / 120)) * 420 * reaction;
    s.keeper.dived = true;
    setPhase("flying");
    onMoodRef.current?.("focused");
  };

  // ---- física + desenho ----
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    let lastT = performance.now();

    const spark = (x, y, n, color) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 90 * (0.4 + Math.random());
        g.current.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color });
      }
    };

    // "gol" | "defendeu" | "fora" — os dois últimos contam igual no placar (não foi gol), mas a
    // mensagem tem que ser diferente: dizer "ela pegou" num chute que foi pra fora é mentira.
    const finishShot = (outcome) => {
      setLast(outcome);
      if (outcome === "gol") {
        setGoals((v) => v + 1);
        onMoodRef.current?.("sad");
        g.current.shake = 1;
        spark(g.current.ball.x, g.current.ball.y, 18, "123,216,143");
      } else {
        setSaves((v) => v + 1);
        onMoodRef.current?.(outcome === "fora" ? "laugh" : "proud"); // ela ri se você mandar pra fora
        spark(g.current.ball.x, g.current.ball.y, 12, "255,157,61");
      }
      setShot((n) => {
        const next = n + 1;
        if (next >= SHOTS) setPhase("done");
        else {
          setPhase("aim");
          const s = g.current;
          s.ball = { ...BALL_START, vx: 0, vy: 0 };
          s.keeper = { x: W / 2 - KEEPER_W / 2, y: GOAL.y + GOAL.h - KEEPER_H, vx: 0, dived: false };
        }
        return next;
      });
    };

    const step = (now) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const s = g.current;

      if (phaseRef.current === "flying") {
        s.ball.x += s.ball.vx * dt;
        s.ball.y += s.ball.vy * dt;
        s.keeper.x = Math.max(GOAL.x - 10, Math.min(GOAL.x + GOAL.w - KEEPER_W + 10, s.keeper.x + s.keeper.vx * dt));

        const k = s.keeper;
        const hitKeeper =
          s.ball.x + BALL_R > k.x && s.ball.x - BALL_R < k.x + KEEPER_W &&
          s.ball.y + BALL_R > k.y && s.ball.y - BALL_R < k.y + KEEPER_H;

        if (hitKeeper) finishShot("defendeu");
        else if (s.ball.y - BALL_R < GOAL.y + GOAL.h && s.ball.x > GOAL.x && s.ball.x < GOAL.x + GOAL.w && s.ball.y < GOAL.y + GOAL.h) {
          // entrou na área do gol sem a goleira pegar
          if (s.ball.y - BALL_R < GOAL.y + 6) finishShot("gol");
        } else if (s.ball.y < -20 || s.ball.x < -20 || s.ball.x > W + 20) {
          finishShot("fora"); // errou o alvo: não é defesa dela, é chute pra fora
        }
      }

      s.shake = Math.max(0, s.shake - dt * 4);
      s.sparks = s.sparks.filter((p) => p.life > 0);
      for (const p of s.sparks) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 1.6;
      }

      // ---- desenho ----
      const rgb = getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb").trim() || "56,225,255";
      ctx.save();
      if (s.shake > 0) ctx.translate((Math.random() - 0.5) * 7 * s.shake, (Math.random() - 0.5) * 7 * s.shake);
      ctx.clearRect(-10, -10, W + 20, H + 20);

      // trave + rede
      ctx.strokeStyle = `rgba(${rgb},0.75)`;
      ctx.lineWidth = 3;
      ctx.strokeRect(GOAL.x, GOAL.y, GOAL.w, GOAL.h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${rgb},0.12)`;
      for (let x = GOAL.x + 12; x < GOAL.x + GOAL.w; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, GOAL.y);
        ctx.lineTo(x, GOAL.y + GOAL.h);
        ctx.stroke();
      }
      for (let y = GOAL.y + 12; y < GOAL.y + GOAL.h; y += 12) {
        ctx.beginPath();
        ctx.moveTo(GOAL.x, y);
        ctx.lineTo(GOAL.x + GOAL.w, y);
        ctx.stroke();
      }

      // marca do pênalti
      ctx.strokeStyle = `rgba(${rgb},0.25)`;
      ctx.beginPath();
      ctx.arc(BALL_START.x, BALL_START.y + 4, 16, 0, Math.PI * 2);
      ctx.stroke();

      // goleira (a Lisa): bloco laranja com dois "olhos" pra ficar claro que é ela
      const k = s.keeper;
      ctx.fillStyle = "rgba(255,157,61,0.9)";
      ctx.fillRect(k.x, k.y, KEEPER_W, KEEPER_H);
      ctx.fillStyle = "#04121a";
      ctx.fillRect(k.x + 10, k.y + 10, 7, 7);
      ctx.fillRect(k.x + KEEPER_W - 17, k.y + 10, 7, 7);

      for (const p of s.sparks) {
        ctx.fillStyle = `rgba(${p.color},${Math.max(0, p.life)})`;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }

      // seta de mira: direção E força (a cor esquenta conforme a força)
      if (s.drag && phaseRef.current === "aim") {
        const dx = s.drag.x - s.ball.x;
        const dy = s.drag.y - s.ball.y;
        const len = Math.min(MAX_DRAG, Math.hypot(dx, dy));
        const power = len / MAX_DRAG;
        const ang = Math.atan2(dy, dx);
        const ex = s.ball.x + Math.cos(ang) * len;
        const ey = s.ball.y + Math.sin(ang) * len;
        ctx.strokeStyle = `rgba(${power > 0.7 ? "255,157,61" : rgb},${0.5 + power * 0.5})`;
        ctx.lineWidth = 2 + power * 3;
        ctx.beginPath();
        ctx.moveTo(s.ball.x, s.ball.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        // ponta da seta
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - Math.cos(ang - 0.4) * 12, ey - Math.sin(ang - 0.4) * 12);
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - Math.cos(ang + 0.4) * 12, ey - Math.sin(ang + 0.4) * 12);
        ctx.stroke();
      }

      ctx.fillStyle = "#eafcff";
      ctx.beginPath();
      ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []); // idem: nada de prop/estado nas deps, senão o canvas é recriado

  // fim das 5 cobranças: registra UMA vez
  const recordedRef = useRef(false);
  useEffect(() => {
    if (phase !== "done" || recordedRef.current) return;
    recordedRef.current = true;
    const outcome = goals > saves ? "win" : goals < saves ? "loss" : "draw";
    recordGame({ game: "penalti", result: outcome, detail: `${goals}/${SHOTS}` });
    onMood?.(outcome === "win" ? "sad" : outcome === "loss" ? "proud" : "confused");
    onFinish?.(outcome);
  }, [phase, goals, saves, onMood, onFinish]);

  const restart = () => {
    recordedRef.current = false;
    setShot(0);
    setGoals(0);
    setSaves(0);
    setLast(null);
    setPhase("aim");
    g.current.ball = { ...BALL_START, vx: 0, vy: 0 };
    g.current.keeper = { x: W / 2 - KEEPER_W / 2, y: GOAL.y + GOAL.h - KEEPER_H, vx: 0, dived: false };
  };

  // ÚNICO elemento raiz, com o estilo alternando entre normal e tela cheia — duas estruturas
  // diferentes de árvore faziam o React recriar o <canvas> ao alternar, e a mira parava de
  // responder (mesmo bug que apareceu na raquete do pong).
  return (
    <div
      style={
        full
          ? { position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 16 }
          : { display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }
      }
    >
      <div style={{ ...mono, fontSize: 11, letterSpacing: 2, display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ color: GR }}>GOLS {goals}</span>
        <span style={{ color: OR }}>DEFESAS {saves}</span>
        <span style={{ color: "rgba(207,239,251,0.4)" }}>{Math.min(shot + (phase === "done" ? 0 : 1), SHOTS)}/{SHOTS}</span>
        <button
          onClick={() => setFull((v) => !v)}
          style={{ ...mono, fontSize: 9, letterSpacing: 1, padding: "4px 9px", borderRadius: 5, border: "1px solid rgba(var(--accent-rgb),0.3)", background: "transparent", color: "#eafcff", cursor: "pointer" }}
        >
          {full ? "✕ SAIR" : "⛶ TELA CHEIA"}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={onAimDown}
        onPointerMove={onAimMove}
        onPointerUp={onAimUp}
        onPointerCancel={onAimUp}
        style={{
          width: full ? `min(96vw, ${(94 * W) / H}vh)` : "min(92vw, 420px)",
          aspectRatio: `${W}/${H}`,
          borderRadius: 8,
          border: "1px solid rgba(var(--accent-rgb),0.22)",
          background: "rgba(0,0,0,0.4)",
          touchAction: "none",
          cursor: "crosshair",
        }}
      />

      <div style={{ ...mono, fontSize: 9.5, letterSpacing: 1, color: last === "gol" ? GR : last ? OR : "rgba(207,239,251,0.45)", textAlign: "center" }}>
        {phase === "done"
          ? goals > saves ? `VOCÊ VENCEU — ${goals} de ${SHOTS}` : goals < saves ? `A LISA LEVOU A MELHOR — ${goals} de ${SHOTS}` : `EMPATE — ${goals} de ${SHOTS}`
          : last === "gol" ? "GOL!" : last === "defendeu" ? "ELA PEGOU!" : last === "fora" ? "PRA FORA!" : "ARRASTE DA BOLA PRA MIRAR — QUANTO MAIS LONGE, MAIS FORTE"}
      </div>

      {phase === "done" && (
        <button
          onClick={restart}
          style={{ ...mono, fontSize: 10, letterSpacing: 1.5, padding: "8px 16px", borderRadius: 6, border: `1px solid ${CY}`, background: "rgba(var(--accent-rgb),0.08)", color: "#eafcff", cursor: "pointer" }}
        >
          COBRAR DE NOVO
        </button>
      )}
    </div>
  );
}
