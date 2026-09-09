"use client";

import { useEffect, useRef } from "react";

// Carinha da Lisa no Modo Interativo — estilo painel de LED daqueles robozinhos de mesa
// (Vector/Eilik): fundo escuro e só os "pixels acesos" desenhados, com glow. Nada de bitmap por
// expressão (10 bitmaps na mão seria muito código e nada flexível): olhos e boca são
// PARAMÉTRICOS, e cada expressão é só um conjunto de números. Trocas são secas de propósito —
// é o que dá a cara de robô, interpolar suave tiraria a graça.
//
// A cor sai de --accent-hex/--accent-rgb lidas do CSS em tempo real (mesma técnica do orbe de
// voz em assistant/page.js), então acompanha o tema escolhido no Topbar sem cor fixa no código.

const GRID = 30; // células no lado maior — resolução do "painel de LED"

// eyeH/eyeW em células; lidTop = quanto corta de cima (sono/desconfiança);
// curve = quanto arqueia embaixo (olho de sorriso); mouth = forma da boca.
const FACES = {
  idle: { eyeH: 7, eyeW: 6, lidTop: 0, curve: 0, mouth: "flat" },
  blink: { eyeH: 1, eyeW: 6, lidTop: 0, curve: 0, mouth: "flat" },
  happy: { eyeH: 5, eyeW: 6, lidTop: 0, curve: 2, mouth: "smile" },
  laugh: { eyeH: 2, eyeW: 7, lidTop: 0, curve: 1, mouth: "open" },
  curious: { eyeH: 8, eyeW: 6, lidTop: 0, curve: 0, mouth: "small" },
  surprised: { eyeH: 9, eyeW: 8, lidTop: 0, curve: 0, mouth: "open" },
  thinking: { eyeH: 5, eyeW: 6, lidTop: 2, curve: 0, mouth: "small" },
  sleepy: { eyeH: 3, eyeW: 6, lidTop: 2, curve: 0, mouth: "flat" },
  bored: { eyeH: 4, eyeW: 6, lidTop: 3, curve: 0, mouth: "flat" },
  speaking: { eyeH: 6, eyeW: 6, lidTop: 0, curve: 1, mouth: "wave" },
};

/** Comportamentos "de nada" que ela faz sozinha quando está parada — cada um é uma sequência de
 * [expressão, duração ms, olhar x, olhar y]. É isso que faz ela parecer viva em vez de um
 * ícone estático. */
const IDLE_ACTS = [
  [["blink", 110], ["idle", 0]],
  [["blink", 100], ["idle", 120], ["blink", 100], ["idle", 0]],
  [["idle", 500, -3], ["idle", 700, 3], ["idle", 0]],
  [["curious", 900, 2], ["idle", 0]],
  [["happy", 1100], ["idle", 0]],
  [["bored", 1400], ["sleepy", 900], ["blink", 120], ["idle", 0]],
  [["thinking", 1200, -2], ["idle", 0]],
  [["surprised", 450], ["blink", 110], ["idle", 0]],
  [["laugh", 320], ["happy", 500], ["laugh", 300], ["idle", 0]],
];

export default function LisaPixelFace({ expression = null, speaking = false, size = 320 }) {
  const canvasRef = useRef(null);
  // props lidas dentro do laço de animação sem recriar o laço a cada render
  const forcedRef = useRef(expression);
  forcedRef.current = expression;
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let raf = 0;

    // estado do comportamento espontâneo
    let act = null;
    let actStep = 0;
    let stepUntil = 0;
    let nextActAt = performance.now() + 1200;
    let current = "idle";
    let lookX = 0;

    const startAct = (now) => {
      act = IDLE_ACTS[Math.floor(Math.random() * IDLE_ACTS.length)];
      actStep = 0;
      const [name, dur, lx = 0] = act[0];
      current = name;
      lookX = lx;
      stepUntil = now + dur;
    };

    const advanceAct = (now) => {
      if (!act) return;
      actStep++;
      if (actStep >= act.length) {
        act = null;
        current = "idle";
        lookX = 0;
        // próxima "graça" entre 2,5s e 7s — irregular de propósito
        nextActAt = now + 2500 + Math.random() * 4500;
        return;
      }
      const [name, dur, lx = 0] = act[actStep];
      current = name;
      lookX = lx;
      stepUntil = dur ? now + dur : Infinity; // duração 0 = fica até a próxima vez
      if (!dur) {
        act = null;
        current = name;
        lookX = lx;
        nextActAt = now + 2500 + Math.random() * 4500;
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const draw = () => {
      const r = cv.getBoundingClientRect();
      const w = r.width, h = r.height;
      const now = performance.now();
      ctx.clearRect(0, 0, w, h);

      const rootStyle = getComputedStyle(document.documentElement);
      const accentRgb = rootStyle.getPropertyValue("--accent-rgb").trim() || "56, 225, 255";
      const accentHex = rootStyle.getPropertyValue("--accent-hex").trim() || "#38e1ff";

      // expressão vigente: prop forçada > falando > comportamento espontâneo
      let name = forcedRef.current || (speakingRef.current ? "speaking" : null);
      if (!name) {
        if (act && now >= stepUntil) advanceAct(now);
        else if (!act && now >= nextActAt) startAct(now);
        name = current;
      } else {
        act = null; // uma expressão vinda de fora interrompe a graça em andamento
      }
      const face = FACES[name] || FACES.idle;

      // --- painel de LED: célula quadrada com folga, só o que está aceso é desenhado ---
      const cell = Math.min(w, h) / GRID;
      const pad = cell * 0.16;
      const cx = w / 2, cy = h / 2;
      // roundRect não existe em navegador mais antigo (Chrome <99) — e aqui ele é chamado
      // centenas de vezes POR FRAME, então um throw viraria a carinha inteira em nada.
      const hasRoundRect = typeof ctx.roundRect === "function";
      const lit = (gx, gy, alpha = 1) => {
        const x = cx + gx * cell - cell / 2 + pad / 2;
        const y = cy + gy * cell - cell / 2 + pad / 2;
        const s = cell - pad;
        ctx.fillStyle = `rgba(${accentRgb},${alpha})`;
        if (hasRoundRect) {
          ctx.beginPath();
          ctx.roundRect(x, y, s, s, s * 0.28);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, s, s);
        }
      };

      ctx.shadowBlur = cell * 1.1;
      ctx.shadowColor = accentHex;

      // --- olhos ---
      const eyeGap = 4; // células entre os dois olhos (do centro pra borda de cada um)
      const halfW = face.eyeW / 2;
      for (const side of [-1, 1]) {
        const centerX = side * (eyeGap + halfW);
        for (let row = 0; row < face.eyeH; row++) {
          const gy = row - face.eyeH / 2 - 2; // -2 sobe os olhos pra sobrar espaço da boca
          if (row < face.lidTop) continue; // pálpebra caída
          // arqueia a base (olho de sorriso): as últimas linhas ficam mais estreitas
          const fromBottom = face.eyeH - 1 - row;
          const shrink = face.curve && fromBottom < face.curve ? face.curve - fromBottom : 0;
          for (let col = 0; col < face.eyeW - shrink * 2; col++) {
            const gx = centerX + col - (face.eyeW - shrink * 2) / 2 + lookX * 0.6;
            lit(gx, gy);
          }
        }
      }

      // --- boca ---
      const mouthY = 5;
      if (face.mouth === "flat") {
        for (let i = -2; i <= 2; i++) lit(i, mouthY, 0.75);
      } else if (face.mouth === "small") {
        for (let i = -1; i <= 1; i++) lit(i, mouthY, 0.8);
      } else if (face.mouth === "smile") {
        for (let i = -3; i <= 3; i++) lit(i, mouthY + (Math.abs(i) >= 3 ? -1 : 0), 0.85);
      } else if (face.mouth === "open") {
        for (let gy = mouthY - 1; gy <= mouthY + 1; gy++) for (let i = -2; i <= 2; i++) lit(i, gy, 0.85);
      } else if (face.mouth === "wave") {
        // "falando": barras que sobem e descem, tipo visualizador de áudio
        const t = now / 90;
        for (let i = -3; i <= 3; i++) {
          const amp = 1 + Math.round(Math.abs(Math.sin(t + i * 0.9)) * 2);
          for (let k = 0; k < amp; k++) lit(i, mouthY - k + 1, 0.9 - k * 0.12);
        }
      }

      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} style={{ width: size, height: size, maxWidth: "100%", display: "block" }} />;
}
