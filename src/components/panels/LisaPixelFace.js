"use client";

import { useEffect, useRef } from "react";

// Carinha da Lisa no Modo Interativo — estilo painel de LED daqueles robozinhos de mesa
// (Vector/Eilik): fundo escuro e só os "pixels acesos" desenhados, com glow.
//
// Olhos/sobrancelhas/boca são PARAMÉTRICOS (um punhado de números por expressão) em vez de um
// bitmap por cara: com ~30 expressões, desenhar cada uma na mão seria muito código e impossível
// de ajustar depois. As únicas coisas desenhadas como bitmap são as formas que NÃO dão pra
// parametrizar (coração, estrela, X, espiral) — ver EYE_PATTERNS.
//
// Trocas de expressão são SECAS de propósito: interpolar suave tira a cara de robô.
// A cor sai de --accent-hex/--accent-rgb lidas do CSS em tempo real (mesma técnica do orbe de
// voz em assistant/page.js), então acompanha o tema escolhido no Topbar.

const GRID = 30; // células no lado maior — resolução do "painel de LED"

// Formas que não dão pra parametrizar. "#" = pixel aceso.
const EYE_PATTERNS = {
  heart: [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."],
  star: ["...#...", "...#...", "#######", ".#####.", "..#.#..", ".#...#."],
  x: ["#.....#", ".#...#.", "..#.#..", "...#...", "..#.#..", ".#...#.", "#.....#"],
  spiral: [".#####.", "#......", "#.###..", "#.#.#..", "#.###..", "#......", ".#####."],
  money: ["..#.#..", ".#####.", "#.#.#..", ".#####.", "..#.#.#", ".#####.", "..#.#.."],
};

// eyeH/eyeW: tamanho do olho em células. lidTop/lidBottom: quanto corta de cima/baixo (sono,
// raiva, desconfiança). curve: arqueia a base (olho de sorriso). brow/browAngle: sobrancelha e
// inclinação (-1 = interna pra baixo = bravo, +1 = interna pra cima = preocupado).
// wink: -1/+1 fecha um olho só. tilt: desalinha os olhos (confusão). special: EYE_PATTERNS.
const F = (o) => ({ eyeH: 7, eyeW: 6, lidTop: 0, lidBottom: 0, curve: 0, mouth: "flat", brow: 0, browAngle: 0, wink: 0, tilt: 0, special: null, ...o });

const FACES = {
  // --- base / neutras ---
  idle: F({}),
  blink: F({ eyeH: 1 }),
  alert: F({ eyeH: 8, eyeW: 7, mouth: "small", brow: 1, browAngle: 1 }),
  focused: F({ eyeH: 5, lidTop: 1, mouth: "flat", brow: 1 }),

  // --- felizes ---
  happy: F({ eyeH: 5, curve: 2, mouth: "smile" }),
  laugh: F({ eyeH: 2, eyeW: 7, curve: 1, mouth: "open" }),
  giggle: F({ eyeH: 3, curve: 2, mouth: "grin" }),
  proud: F({ eyeH: 4, curve: 1, lidTop: 1, mouth: "grin", brow: 1 }),
  love: F({ special: "heart", mouth: "smile" }),
  star: F({ special: "star", mouth: "grin" }),
  money: F({ special: "money", mouth: "grin" }),
  cool: F({ eyeH: 3, lidTop: 1, mouth: "grin", brow: 1 }),
  smug: F({ eyeH: 4, lidTop: 2, curve: 1, mouth: "grin", wink: 1 }),
  wink: F({ eyeH: 6, curve: 1, mouth: "grin", wink: 1 }),
  shy: F({ eyeH: 4, curve: 2, lidTop: 1, mouth: "small", brow: 1, browAngle: 1 }),

  // --- curiosas / pensativas ---
  curious: F({ eyeH: 8, mouth: "small", brow: 1, browAngle: 1 }),
  thinking: F({ eyeH: 5, lidTop: 2, mouth: "small", brow: 1 }),
  confused: F({ eyeH: 6, tilt: 2, mouth: "squiggle", brow: 1, browAngle: 1 }),
  suspicious: F({ eyeH: 3, lidTop: 3, mouth: "flat", brow: 1, browAngle: -1 }),
  scan: F({ eyeH: 6, eyeW: 7, mouth: "tiny" }),

  // --- surpresas ---
  surprised: F({ eyeH: 9, eyeW: 8, mouth: "o", brow: 1, browAngle: 1 }),
  shocked: F({ eyeH: 10, eyeW: 9, mouth: "open", brow: 1, browAngle: 1 }),

  // --- negativas ---
  angry: F({ eyeH: 5, lidTop: 2, mouth: "frown", brow: 1, browAngle: -1 }),
  grumpy: F({ eyeH: 4, lidTop: 2, mouth: "flat", brow: 1, browAngle: -1 }),
  sad: F({ eyeH: 5, curve: 1, mouth: "frown", brow: 1, browAngle: 1 }),
  worried: F({ eyeH: 7, mouth: "squiggle", brow: 1, browAngle: 1 }),
  annoyed: F({ eyeH: 3, lidTop: 3, mouth: "flat", brow: 1, browAngle: -1, wink: -1 }),

  // --- sono / cansaço ---
  sleepy: F({ eyeH: 3, lidTop: 2, mouth: "flat" }),
  yawn: F({ eyeH: 2, lidTop: 1, mouth: "open" }),
  sleeping: F({ eyeH: 1, mouth: "small" }),

  // --- bobas ---
  silly: F({ eyeH: 3, curve: 2, mouth: "open", wink: -1 }),
  kiss: F({ eyeH: 4, curve: 2, mouth: "o" }),
  puff: F({ eyeH: 3, lidTop: 1, mouth: "o", brow: 1, browAngle: -1 }),
  dizzy: F({ special: "spiral", mouth: "squiggle" }),
  dead: F({ special: "x", mouth: "flat" }),
  bored: F({ eyeH: 4, lidTop: 3, mouth: "flat" }),

  // --- fala (boca animada) ---
  speaking: F({ eyeH: 6, curve: 1, mouth: "wave" }),
};

// ~50 "ações": cada uma é uma pequena cena, [expressão, duração ms, olhar horizontal].
// Duração 0 = fica assim até a próxima ação. Misturar cenas curtas e longas é o que faz ela
// parecer viva em vez de um ícone trocando de figura.
const ACTS = [
  // piscadas e olhares (o "respirar" dela)
  [["blink", 110], ["idle", 0]],
  [["blink", 100], ["idle", 130], ["blink", 100], ["idle", 0]],
  [["idle", 500, -3], ["idle", 700, 3], ["idle", 0]],
  [["idle", 400, 4], ["blink", 110], ["idle", 0]],
  [["scan", 600, -4], ["scan", 600, 4], ["idle", 0]],
  [["idle", 900, -2], ["curious", 700, -2], ["idle", 0]],
  [["blink", 90], ["blink", 90], ["blink", 90], ["idle", 0]],
  [["idle", 300, 2], ["idle", 300, -2], ["idle", 300, 2], ["idle", 0]],

  // bom humor
  [["happy", 1100], ["idle", 0]],
  [["giggle", 500], ["happy", 600], ["idle", 0]],
  [["laugh", 320], ["happy", 500], ["laugh", 300], ["idle", 0]],
  [["wink", 450], ["happy", 500], ["idle", 0]],
  [["proud", 900], ["cool", 700], ["idle", 0]],
  [["happy", 400, -2], ["happy", 400, 2], ["giggle", 500], ["idle", 0]],
  [["love", 900], ["shy", 600], ["idle", 0]],
  [["star", 700], ["happy", 500], ["idle", 0]],
  [["cool", 1000], ["smug", 600], ["idle", 0]],
  [["smug", 800], ["wink", 350], ["idle", 0]],

  // curiosidade / pensar
  [["curious", 900, 2], ["idle", 0]],
  [["thinking", 1200, -2], ["idle", 0]],
  [["thinking", 700, -3], ["thinking", 700, 3], ["curious", 500], ["idle", 0]],
  [["confused", 900], ["blink", 110], ["confused", 500], ["idle", 0]],
  [["scan", 500, -4], ["curious", 600], ["scan", 500, 4], ["idle", 0]],
  [["focused", 1300], ["blink", 100], ["idle", 0]],
  [["suspicious", 1000, 3], ["idle", 0]],
  [["suspicious", 700], ["confused", 600], ["idle", 0]],

  // sustos
  [["surprised", 450], ["blink", 110], ["idle", 0]],
  [["shocked", 400], ["surprised", 400], ["blink", 120], ["idle", 0]],
  [["surprised", 350], ["happy", 700], ["idle", 0]],
  [["alert", 600], ["scan", 500, -3], ["scan", 500, 3], ["idle", 0]],
  [["shocked", 300], ["dizzy", 800], ["blink", 130], ["idle", 0]],

  // sono e tédio
  [["bored", 1400], ["sleepy", 900], ["blink", 120], ["idle", 0]],
  [["sleepy", 900], ["yawn", 700], ["blink", 150], ["idle", 0]],
  [["yawn", 800], ["sleepy", 1000], ["idle", 0]],
  [["sleepy", 700], ["sleeping", 1500], ["blink", 120], ["surprised", 300], ["idle", 0]],
  [["bored", 1000, -3], ["bored", 1000, 3], ["idle", 0]],
  [["sleeping", 2000], ["blink", 110], ["idle", 0]],

  // ranzinza / emburrada
  [["grumpy", 1000], ["idle", 0]],
  [["annoyed", 900], ["grumpy", 500], ["idle", 0]],
  [["angry", 500], ["grumpy", 700], ["idle", 0]],
  [["worried", 900], ["sad", 600], ["idle", 0]],
  [["sad", 1000], ["blink", 120], ["idle", 0]],
  [["grumpy", 600], ["puff", 700], ["blink", 110], ["idle", 0]],

  // palhaçadas
  [["silly", 600], ["laugh", 400], ["idle", 0]],
  [["puff", 800], ["silly", 500], ["idle", 0]],
  [["kiss", 600], ["shy", 600], ["idle", 0]],
  [["dizzy", 900], ["blink", 130], ["confused", 500], ["idle", 0]],
  [["dead", 700], ["blink", 140], ["surprised", 300], ["idle", 0]],
  [["money", 800], ["smug", 600], ["idle", 0]],
  [["silly", 300], ["blink", 100], ["silly", 300], ["giggle", 500], ["idle", 0]],
  [["shy", 900], ["blink", 110], ["happy", 500], ["idle", 0]],
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

    let act = null;
    let actStep = 0;
    let stepUntil = 0;
    let nextActAt = performance.now() + 1200;
    let current = "idle";
    let lookX = 0;

    const startAct = (now) => {
      act = ACTS[Math.floor(Math.random() * ACTS.length)];
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
        nextActAt = now + 2200 + Math.random() * 4200; // irregular de propósito
        return;
      }
      const [name, dur, lx = 0] = act[actStep];
      current = name;
      lookX = lx;
      if (dur) {
        stepUntil = now + dur;
      } else {
        act = null; // duração 0 encerra a cena e mantém essa cara até a próxima
        nextActAt = now + 2200 + Math.random() * 4200;
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

      // prioridade: cara vinda de fora (reação/fala) > falando > graça espontânea
      let name = forcedRef.current || (speakingRef.current ? "speaking" : null);
      if (!name) {
        if (act && now >= stepUntil) advanceAct(now);
        else if (!act && now >= nextActAt) startAct(now);
        name = current;
      } else {
        act = null; // reagir a você interrompe a graça em andamento
      }
      const face = FACES[name] || FACES.idle;

      const cell = Math.min(w, h) / GRID;
      const pad = cell * 0.16;
      const cx = w / 2, cy = h / 2;
      // roundRect não existe em navegador antigo (Chrome <99) e aqui é chamado centenas de
      // vezes POR FRAME — um throw apagaria a carinha inteira.
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

      const eyeGap = 4;
      const EYE_TOP = -2; // sobe os olhos pra sobrar espaço da boca

      for (const side of [-1, 1]) {
        const centerX = side * (eyeGap + face.eyeW / 2) + lookX * 0.6;
        const tilt = face.tilt ? (side < 0 ? -face.tilt : face.tilt) / 2 : 0;
        const closed = face.wink && ((face.wink < 0 && side < 0) || (face.wink > 0 && side > 0));

        if (face.special && !closed) {
          const pat = EYE_PATTERNS[face.special];
          const pw = pat[0].length;
          for (let row = 0; row < pat.length; row++) {
            for (let col = 0; col < pw; col++) {
              if (pat[row][col] !== "#") continue;
              lit(centerX + col - pw / 2, EYE_TOP + row - pat.length / 2 + tilt);
            }
          }
        } else {
          const eh = closed ? 1 : face.eyeH;
          for (let row = 0; row < eh; row++) {
            if (!closed && (row < face.lidTop || row >= eh - face.lidBottom)) continue;
            const fromBottom = eh - 1 - row;
            const shrink = face.curve && fromBottom < face.curve ? face.curve - fromBottom : 0;
            const rowW = face.eyeW - shrink * 2;
            for (let col = 0; col < rowW; col++) {
              lit(centerX + col - rowW / 2, EYE_TOP + row - eh / 2 + tilt);
            }
          }
        }

        // sobrancelha: o que mais muda a leitura da cara. Inclina puxando a ponta interna.
        if (face.brow) {
          const browY = EYE_TOP - face.eyeH / 2 - 2 + tilt;
          for (let col = 0; col < face.eyeW; col++) {
            const inner = side < 0 ? col / (face.eyeW - 1) : 1 - col / (face.eyeW - 1);
            const lift = Math.round(inner * face.browAngle);
            lit(centerX + col - face.eyeW / 2, browY - lift, 0.9);
          }
        }
      }

      // --- boca ---
      const my = 5;
      const m = face.mouth;
      if (m === "flat") for (let i = -2; i <= 2; i++) lit(i, my, 0.75);
      else if (m === "tiny") for (let i = 0; i <= 0; i++) lit(i, my, 0.8);
      else if (m === "small") for (let i = -1; i <= 1; i++) lit(i, my, 0.8);
      else if (m === "smile") for (let i = -3; i <= 3; i++) lit(i, my + (Math.abs(i) >= 3 ? -1 : 0), 0.85);
      else if (m === "grin") { for (let i = -3; i <= 3; i++) lit(i, my - (Math.abs(i) >= 3 ? 1 : 0), 0.85); for (let i = -2; i <= 2; i++) lit(i, my + 1, 0.7); }
      else if (m === "frown") for (let i = -3; i <= 3; i++) lit(i, my + (Math.abs(i) >= 3 ? -1 : 0) + (Math.abs(i) >= 3 ? 0 : 1), 0.85);
      else if (m === "o") { for (let i = -1; i <= 1; i++) { lit(i, my - 1, 0.85); lit(i, my + 1, 0.85); } lit(-2, my, 0.85); lit(2, my, 0.85); }
      else if (m === "open") for (let gy = my - 1; gy <= my + 1; gy++) for (let i = -2; i <= 2; i++) lit(i, gy, 0.85);
      else if (m === "squiggle") for (let i = -3; i <= 3; i++) lit(i, my + (i % 2 === 0 ? 0 : 1), 0.8);
      else if (m === "wave") {
        // "falando": barras subindo e descendo, tipo visualizador de áudio
        const t = now / 90;
        for (let i = -3; i <= 3; i++) {
          const amp = 1 + Math.round(Math.abs(Math.sin(t + i * 0.9)) * 2);
          for (let k = 0; k < amp; k++) lit(i, my - k + 1, 0.9 - k * 0.12);
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
