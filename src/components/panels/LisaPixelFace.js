"use client";

import { useEffect, useRef } from "react";

// Carinha da Lisa no Modo Interativo — painel de LED daqueles robozinhos de mesa.
//
// Olhos/sobrancelhas/boca são PARAMÉTRICOS (uns números por expressão) em vez de um bitmap por
// cara: com ~37 expressões, desenhar cada uma na mão seria impossível de ajustar. Só as formas
// que não dão pra parametrizar viram bitmap pequeno (coração, estrela, X, espiral) — EYE_PATTERNS.
//
// FLUIDEZ: os parâmetros são INTERPOLADOS a cada frame (suavização exponencial, independente de
// taxa de quadros), mas os pixels continuam presos à grade — é isso que mantém a cara de painel
// de LED. A suavidade "sub-pixel" vem de acender a última fileira com alpha proporcional à parte
// fracionária, e de fazer crossfade entre bocas/olhos especiais. Sem isso, ou a troca é seca
// (robótica demais pro que o usuário pediu) ou os pixels escorregam entre células (vira mingau).

const GRID = 30; // células no lado maior — resolução do painel

// Constante de tempo da suavização (ms). Menor = mais seco, maior = mais derretido.
const SMOOTH_MS = 90;
// crossfade de boca e de olho especial (coração/estrela/X)
const XFADE_MS = 130;

const EYE_PATTERNS = {
  heart: [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."],
  star: ["...#...", "...#...", "#######", ".#####.", "..#.#..", ".#...#."],
  x: ["#.....#", ".#...#.", "..#.#..", "...#...", "..#.#..", ".#...#.", "#.....#"],
  spiral: [".#####.", "#......", "#.###..", "#.#.#..", "#.###..", "#......", ".#####."],
  money: ["..#.#..", ".#####.", "#.#.#..", ".#####.", "..#.#.#", ".#####.", "..#.#.."],
};

const Z_PATTERN = ["#####", "...#.", "..#..", ".#...", "#####"];
const Z_SPAWN_MS = 850;
const Z_LIFE_MS = 2600;

// notinhas que saem quando ela está de fone
const NOTE_PATTERNS = [
  ["..##", "..##", "..#.", "..#.", "..#.", "###.", "###."], // ♪
  [".#..#", ".####", ".#..#", ".#..#", "##.##", "##.##"], // ♫
];
const NOTE_SPAWN_MS = 620;
const NOTE_LIFE_MS = 2400;

const F = (o) => ({ eyeH: 7, eyeW: 6, lidTop: 0, lidBottom: 0, curve: 0, mouth: "flat", brow: 0, browAngle: 0, wink: 0, tilt: 0, special: null, ...o });

const FACES = {
  idle: F({}),
  blink: F({ eyeH: 1 }),
  alert: F({ eyeH: 8, eyeW: 7, mouth: "small", brow: 1, browAngle: 1 }),
  focused: F({ eyeH: 5, lidTop: 1, mouth: "flat", brow: 1 }),

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
  winkLeft: F({ eyeH: 6, curve: 1, mouth: "grin", wink: -1 }),
  shy: F({ eyeH: 4, curve: 2, lidTop: 1, mouth: "small", brow: 1, browAngle: 1 }),

  curious: F({ eyeH: 8, mouth: "small", brow: 1, browAngle: 1 }),
  thinking: F({ eyeH: 5, lidTop: 2, mouth: "small", brow: 1 }),
  confused: F({ eyeH: 6, tilt: 2, mouth: "squiggle", brow: 1, browAngle: 1 }),
  suspicious: F({ eyeH: 3, lidTop: 3, mouth: "flat", brow: 1, browAngle: -1 }),
  scan: F({ eyeH: 6, eyeW: 7, mouth: "tiny" }),

  surprised: F({ eyeH: 9, eyeW: 8, mouth: "o", brow: 1, browAngle: 1 }),
  shocked: F({ eyeH: 10, eyeW: 9, mouth: "open", brow: 1, browAngle: 1 }),

  angry: F({ eyeH: 5, lidTop: 2, mouth: "frown", brow: 1, browAngle: -1 }),
  grumpy: F({ eyeH: 4, lidTop: 2, mouth: "flat", brow: 1, browAngle: -1 }),
  sad: F({ eyeH: 5, curve: 1, mouth: "frown", brow: 1, browAngle: 1 }),
  worried: F({ eyeH: 7, mouth: "squiggle", brow: 1, browAngle: 1 }),
  annoyed: F({ eyeH: 3, lidTop: 3, mouth: "flat", brow: 1, browAngle: -1, wink: -1 }),

  sleepy: F({ eyeH: 3, lidTop: 2, mouth: "flat" }),
  yawn: F({ eyeH: 2, lidTop: 1, mouth: "open" }),
  sleeping: F({ eyeH: 1, mouth: "small" }),

  silly: F({ eyeH: 3, curve: 2, mouth: "open", wink: -1 }),
  kiss: F({ eyeH: 4, curve: 2, mouth: "o" }),
  puff: F({ eyeH: 3, lidTop: 1, mouth: "o", brow: 1, browAngle: -1 }),
  dizzy: F({ special: "spiral", mouth: "squiggle" }),
  dead: F({ special: "x", mouth: "flat" }),
  bored: F({ eyeH: 4, lidTop: 3, mouth: "flat" }),

  speaking: F({ eyeH: 6, curve: 1, mouth: "wave" }),
  // usadas pelo Modo Rádio (de fone) e pelos jogos
  vibing: F({ eyeH: 4, curve: 2, mouth: "grin" }),
  jam: F({ eyeH: 2, curve: 1, eyeW: 7, mouth: "open" }),
};

const ACTS = [
  [["blink", 110], ["idle", 0]],
  [["blink", 100], ["idle", 130], ["blink", 100], ["idle", 0]],
  [["idle", 500, -3], ["idle", 700, 3], ["idle", 0]],
  [["idle", 400, 4], ["blink", 110], ["idle", 0]],
  [["scan", 600, -4], ["scan", 600, 4], ["idle", 0]],
  [["idle", 900, -2], ["curious", 700, -2], ["idle", 0]],
  [["blink", 90], ["blink", 90], ["blink", 90], ["idle", 0]],
  [["idle", 300, 2], ["idle", 300, -2], ["idle", 300, 2], ["idle", 0]],

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

  [["curious", 900, 2], ["idle", 0]],
  [["thinking", 1200, -2], ["idle", 0]],
  [["thinking", 700, -3], ["thinking", 700, 3], ["curious", 500], ["idle", 0]],
  [["confused", 900], ["blink", 110], ["confused", 500], ["idle", 0]],
  [["scan", 500, -4], ["curious", 600], ["scan", 500, 4], ["idle", 0]],
  [["focused", 1300], ["blink", 100], ["idle", 0]],
  [["suspicious", 1000, 3], ["idle", 0]],
  [["suspicious", 700], ["confused", 600], ["idle", 0]],

  [["surprised", 450], ["blink", 110], ["idle", 0]],
  [["shocked", 400], ["surprised", 400], ["blink", 120], ["idle", 0]],
  [["surprised", 350], ["happy", 700], ["idle", 0]],
  [["alert", 600], ["scan", 500, -3], ["scan", 500, 3], ["idle", 0]],
  [["shocked", 300], ["dizzy", 800], ["blink", 130], ["idle", 0]],

  [["bored", 1400], ["sleepy", 900], ["blink", 120], ["idle", 0]],
  [["sleepy", 900], ["yawn", 700], ["blink", 150], ["idle", 0]],
  [["yawn", 800], ["sleepy", 1000], ["idle", 0]],
  [["sleepy", 700], ["sleeping", 1500], ["blink", 120], ["surprised", 300], ["idle", 0]],
  [["bored", 1000, -3], ["bored", 1000, 3], ["idle", 0]],
  [["sleeping", 2000], ["blink", 110], ["idle", 0]],

  [["grumpy", 1000], ["idle", 0]],
  [["annoyed", 900], ["grumpy", 500], ["idle", 0]],
  [["angry", 500], ["grumpy", 700], ["idle", 0]],
  [["worried", 900], ["sad", 600], ["idle", 0]],
  [["sad", 1000], ["blink", 120], ["idle", 0]],
  [["grumpy", 600], ["puff", 700], ["blink", 110], ["idle", 0]],

  [["silly", 600], ["laugh", 400], ["idle", 0]],
  [["puff", 800], ["silly", 500], ["idle", 0]],
  [["kiss", 600], ["shy", 600], ["idle", 0]],
  [["dizzy", 900], ["blink", 130], ["confused", 500], ["idle", 0]],
  [["dead", 700], ["blink", 140], ["surprised", 300], ["idle", 0]],
  [["money", 800], ["smug", 600], ["idle", 0]],
  [["silly", 300], ["blink", 100], ["silly", 300], ["giggle", 500], ["idle", 0]],
  [["shy", 900], ["blink", 110], ["happy", 500], ["idle", 0]],
];

// Espaçamento entre as graças espontâneas. Alto de propósito: com a reação à câmera + toque, um
// intervalo curto deixava ela trocando de cara sem parar (reclamação direta do usuário).
const ACT_GAP_MIN_MS = 5000;
const ACT_GAP_VAR_MS = 7000;

// ---- toque: REGIÃO × JEITO de tocar ----
// Cada combinação tem uma cena própria, então tocar o olho é diferente de tocar a boca, e um
// toque rápido é diferente de segurar. Cenas no mesmo formato das ações espontâneas.
const TOUCH_ACTS = {
  // olho: ela pisca DAQUELE lado (é o olho que você encostou)
  eyeLeftTap: [["winkLeft", 300], ["surprised", 250], ["giggle", 550], ["idle", 0]],
  eyeRightTap: [["wink", 300], ["surprised", 250], ["giggle", 550], ["idle", 0]],
  eyeHold: [["blink", 400], ["annoyed", 700], ["grumpy", 500], ["idle", 0]],
  mouthTap: [["kiss", 450], ["shy", 600], ["happy", 450], ["idle", 0]],
  mouthHold: [["puff", 700], ["annoyed", 600], ["idle", 0]],
  topTap: [["shy", 600], ["happy", 700], ["giggle", 400], ["idle", 0]], // tapinha na cabeça
  topHold: [["love", 900], ["shy", 700], ["idle", 0]], // mão na cabeça = carinho
  centerTap: [["surprised", 280], ["confused", 600], ["idle", 0]],
  cheekTap: [["shy", 700], ["giggle", 450], ["idle", 0]],
  hold: [["sleepy", 900], ["love", 800], ["shy", 500], ["idle", 0]], // segurar em qualquer lugar acalma
  pester: [["dizzy", 700], ["annoyed", 800], ["grumpy", 600], ["idle", 0]],
  pokeAgain: [["shocked", 240], ["annoyed", 700], ["grumpy", 500], ["idle", 0]],
  pet: [["love", 900], ["happy", 700], ["shy", 500], ["idle", 0]],
  wake: [["blink", 130], ["surprised", 350], ["curious", 700], ["idle", 0]],
  swipeAway: [["surprised", 250], ["sad", 700], ["idle", 0]], // deslizou pra fora dela
};

const HOLD_THRESHOLD_MS = 420; // acima disso não é toque, é "segurar"
const PET_DISTANCE_PX = 150; // arrastar mais que isso em cima dela = carinho

/** Em que região da cara caiu o toque, em coordenadas de célula a partir do centro. */
function regionAt(gx, gy) {
  if (Math.abs(gx) > 13 || gy < -13 || gy > 10) return "off";
  if (gy < -7) return "top"; // acima dos olhos/sobrancelha = "cabeça"
  if (gy > 3) return Math.abs(gx) <= 5 ? "mouth" : "cheek";
  if (gx <= -3) return "eyeLeft";
  if (gx >= 3) return "eyeRight";
  return "center";
}

export default function LisaPixelFace({
  expression = null,
  reaction = null,
  speaking = false,
  headphones = false,
  size = 320,
}) {
  const canvasRef = useRef(null);
  const forcedRef = useRef(expression);
  forcedRef.current = expression;
  const reactionRef = useRef(reaction);
  reactionRef.current = reaction;
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;
  const headphonesRef = useRef(headphones);
  headphonesRef.current = headphones;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let raf = 0;

    let act = null;
    let actStep = 0;
    let stepUntil = 0;
    let nextActAt = performance.now() + 1500;
    let current = "idle";
    let targetLookX = 0;
    let touchPriorityUntil = 0;
    let zs = [];
    let lastZ = 0;
    let notes = [];
    let lastNote = 0;

    // estado INTERPOLADO (é o que é desenhado); "target" vem da expressão vigente
    const cur = { eyeH: 7, eyeW: 6, lidTop: 0, lidBottom: 0, curve: 0, browOn: 0, browAngle: 0, tilt: 0, closeL: 0, closeR: 0, specialMix: 0, lookX: 0, bob: 0 };
    let curSpecial = null; // qual bitmap especial está (ou estava) em cena
    let curMouth = "flat";
    let prevMouth = "flat";
    let mouthMix = 1; // 1 = boca atual totalmente visível

    // geometria e cor em cache: ler getBoundingClientRect/getComputedStyle a cada frame força
    // recálculo de layout/estilo e derruba os 60fps
    let box = { w: size, h: size };
    let accentRgb = "56, 225, 255";
    let accentHex = "#38e1ff";
    let lastColorRead = 0;

    const startAct = (now, sequence = null) => {
      act = sequence || ACTS[Math.floor(Math.random() * ACTS.length)];
      actStep = 0;
      const [name, dur, lx = 0] = act[0];
      current = name;
      targetLookX = lx;
      stepUntil = now + dur;
    };

    const advanceAct = (now) => {
      if (!act) return;
      actStep++;
      if (actStep >= act.length) {
        act = null;
        current = "idle";
        targetLookX = 0;
        nextActAt = now + ACT_GAP_MIN_MS + Math.random() * ACT_GAP_VAR_MS;
        return;
      }
      const [name, dur, lx = 0] = act[actStep];
      current = name;
      targetLookX = lx;
      if (dur) {
        stepUntil = now + dur;
      } else {
        act = null;
        nextActAt = now + ACT_GAP_MIN_MS + Math.random() * ACT_GAP_VAR_MS;
      }
    };

    // ---- toque ----
    const recentTaps = [];
    let press = null; // { at, gx, gy, region, x, y, dist, petted }

    const startTouchAct = (sequence, now) => {
      const total = sequence.reduce((sum, [, d]) => sum + (d || 0), 0);
      touchPriorityUntil = now + total;
      startAct(now, sequence);
    };

    const cellsFromEvent = (e) => {
      const rect = cv.getBoundingClientRect();
      const cell = Math.min(rect.width, rect.height) / GRID;
      return {
        gx: (e.clientX - rect.left - rect.width / 2) / cell,
        gy: (e.clientY - rect.top - rect.height / 2) / cell,
      };
    };

    const onPointerDown = (e) => {
      const now = performance.now();
      const { gx, gy } = cellsFromEvent(e);
      press = { at: now, gx, gy, region: regionAt(gx, gy), x: e.clientX, y: e.clientY, dist: 0, petted: false };
      while (recentTaps.length && now - recentTaps[0] > 2500) recentTaps.shift();
    };

    const onPointerMove = (e) => {
      if (!press || press.petted) return;
      press.dist += Math.hypot(e.clientX - press.x, e.clientY - press.y);
      press.x = e.clientX;
      press.y = e.clientY;
      if (press.dist > PET_DISTANCE_PX) {
        const { gx, gy } = cellsFromEvent(e);
        // arrastar POR CIMA dela é carinho; arrastar pra fora é "tchau"
        startTouchAct(regionAt(gx, gy) === "off" ? TOUCH_ACTS.swipeAway : TOUCH_ACTS.pet, performance.now());
        press.petted = true;
      }
    };

    const onPointerUp = () => {
      if (!press) return;
      const now = performance.now();
      const held = now - press.at;
      const p = press;
      press = null;
      if (p.petted) return; // já reagiu com o carinho

      recentTaps.push(now);
      const wasSleeping = current === "sleeping" || current === "sleepy";
      if (wasSleeping) return startTouchAct(TOUCH_ACTS.wake, now);
      if (recentTaps.length >= 5) return startTouchAct(TOUCH_ACTS.pester, now);
      if (recentTaps.length >= 3) return startTouchAct(TOUCH_ACTS.pokeAgain, now);

      const isHold = held > HOLD_THRESHOLD_MS;
      const byRegion = {
        eyeLeft: isHold ? TOUCH_ACTS.eyeHold : TOUCH_ACTS.eyeLeftTap,
        eyeRight: isHold ? TOUCH_ACTS.eyeHold : TOUCH_ACTS.eyeRightTap,
        mouth: isHold ? TOUCH_ACTS.mouthHold : TOUCH_ACTS.mouthTap,
        top: isHold ? TOUCH_ACTS.topHold : TOUCH_ACTS.topTap,
        cheek: isHold ? TOUCH_ACTS.hold : TOUCH_ACTS.cheekTap,
        center: isHold ? TOUCH_ACTS.hold : TOUCH_ACTS.centerTap,
      };
      if (p.region === "off") {
        // tocou longe: ela só olha pra onde foi
        return startTouchAct([["curious", 900, Math.max(-4, Math.min(4, p.gx / 3))], ["idle", 0]], now);
      }
      startTouchAct(byRegion[p.region] || TOUCH_ACTS.centerTap, now);
    };

    cv.addEventListener("pointerdown", onPointerDown);
    cv.addEventListener("pointermove", onPointerMove);
    cv.addEventListener("pointerup", onPointerUp);
    cv.addEventListener("pointercancel", onPointerUp);
    cv.addEventListener("pointerleave", onPointerUp);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = cv.getBoundingClientRect();
      box = { w: r.width, h: r.height };
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    let lastFrame = performance.now();

    const draw = () => {
      const now = performance.now();
      const dt = Math.min(64, now - lastFrame); // trava o passo se a aba ficou congelada
      lastFrame = now;
      const w = box.w, h = box.h;
      ctx.clearRect(0, 0, w, h);

      if (now - lastColorRead > 500) {
        const rootStyle = getComputedStyle(document.documentElement);
        accentRgb = rootStyle.getPropertyValue("--accent-rgb").trim() || accentRgb;
        accentHex = rootStyle.getPropertyValue("--accent-hex").trim() || accentHex;
        lastColorRead = now;
      }

      // ordem: assunto trazido > falando > toque > reação da câmera > graça dela
      const touching = now < touchPriorityUntil;
      let name = forcedRef.current || (speakingRef.current ? "speaking" : null);
      if (!name && !touching) name = reactionRef.current;
      if (!name) {
        if (act && now >= stepUntil) advanceAct(now);
        else if (!act && now >= nextActAt) startAct(now);
        name = current;
      } else {
        act = null;
      }
      const face = FACES[name] || FACES.idle;

      // ---- interpolação (exponencial, independente de fps) ----
      const k = 1 - Math.exp(-dt / SMOOTH_MS);
      const ap = (key, target) => { cur[key] += (target - cur[key]) * k; };
      ap("eyeH", face.eyeH);
      ap("eyeW", face.eyeW);
      ap("lidTop", face.lidTop);
      ap("lidBottom", face.lidBottom);
      ap("curve", face.curve);
      ap("browOn", face.brow);
      ap("browAngle", face.browAngle);
      ap("tilt", face.tilt);
      ap("closeL", face.wink < 0 ? 1 : 0);
      ap("closeR", face.wink > 0 ? 1 : 0);
      ap("lookX", targetLookX);
      ap("specialMix", face.special ? 1 : 0);
      ap("bob", headphonesRef.current ? 1 : 0);
      if (face.special) curSpecial = face.special;

      if (face.mouth !== curMouth) {
        prevMouth = curMouth;
        curMouth = face.mouth;
        mouthMix = 0;
      }
      mouthMix = Math.min(1, mouthMix + dt / XFADE_MS);

      const cell = Math.min(w, h) / GRID;
      const pad = cell * 0.16;
      const cx = w / 2;
      // de fone, ela balança de leve no ritmo — só um seno lento, nada de análise de áudio
      const cy = h / 2 + cur.bob * Math.sin(now / 260) * cell * 0.5;

      const hasRoundRect = typeof ctx.roundRect === "function";
      const litPx = (x, y, s, alpha) => {
        if (alpha <= 0.02) return;
        ctx.fillStyle = `rgba(${accentRgb},${alpha})`;
        if (hasRoundRect) {
          ctx.beginPath();
          ctx.roundRect(x, y, s, s, s * 0.28);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, s, s);
        }
      };
      const lit = (gx, gy, alpha = 1) => litPx(cx + gx * cell - cell / 2 + pad / 2, cy + gy * cell - cell / 2 + pad / 2, cell - pad, alpha);

      ctx.shadowBlur = cell * 1.1;
      ctx.shadowColor = accentHex;

      const EYE_TOP = -2;
      const eyeGap = 4;

      for (const side of [-1, 1]) {
        const centerX = side * (eyeGap + cur.eyeW / 2) + cur.lookX * 0.6;
        const tilt = cur.tilt ? (side < 0 ? -cur.tilt : cur.tilt) / 2 : 0;
        const closure = side < 0 ? cur.closeL : cur.closeR;
        // olho fechado = altura 1; interpolar a altura é o que faz a piscada ficar fluida
        const eh = Math.max(1, cur.eyeH * (1 - closure) + 1 * closure);
        const eyeAlpha = 1 - cur.specialMix;

        if (eyeAlpha > 0.02) {
          const rows = Math.ceil(eh);
          for (let row = 0; row < rows; row++) {
            if (row < cur.lidTop - 0.5 || row >= eh - cur.lidBottom) continue;
            // parte fracionária da última fileira vira ALPHA: suavidade sub-pixel sem sair da grade
            const rowFill = Math.min(1, eh - row);
            const fromBottom = eh - 1 - row;
            const shrink = cur.curve && fromBottom < cur.curve ? cur.curve - fromBottom : 0;
            const rowW = Math.max(1, cur.eyeW - shrink * 2);
            const cols = Math.ceil(rowW);
            for (let col = 0; col < cols; col++) {
              const colFill = Math.min(1, rowW - col);
              lit(centerX + col - rowW / 2, EYE_TOP + row - eh / 2 + tilt, eyeAlpha * rowFill * colFill);
            }
          }
        }

        if (cur.specialMix > 0.02 && curSpecial) {
          const pat = EYE_PATTERNS[curSpecial];
          const pw = pat[0].length;
          for (let row = 0; row < pat.length; row++) {
            for (let col = 0; col < pw; col++) {
              if (pat[row][col] !== "#") continue;
              lit(centerX + col - pw / 2, EYE_TOP + row - pat.length / 2 + tilt, cur.specialMix);
            }
          }
        }

        if (cur.browOn > 0.02) {
          const browY = EYE_TOP - cur.eyeH / 2 - 2 + tilt;
          const bw = Math.ceil(cur.eyeW);
          for (let col = 0; col < bw; col++) {
            const inner = side < 0 ? col / (bw - 1 || 1) : 1 - col / (bw - 1 || 1);
            lit(centerX + col - cur.eyeW / 2, browY - inner * cur.browAngle, 0.9 * cur.browOn);
          }
        }
      }

      // ---- boca (crossfade entre a anterior e a atual) ----
      const drawMouth = (shape, a) => {
        if (a <= 0.02) return;
        const my = 5;
        if (shape === "flat") for (let i = -2; i <= 2; i++) lit(i, my, 0.75 * a);
        else if (shape === "tiny") lit(0, my, 0.8 * a);
        else if (shape === "small") for (let i = -1; i <= 1; i++) lit(i, my, 0.8 * a);
        else if (shape === "smile") for (let i = -3; i <= 3; i++) lit(i, my + (Math.abs(i) >= 3 ? -1 : 0), 0.85 * a);
        else if (shape === "grin") { for (let i = -3; i <= 3; i++) lit(i, my - (Math.abs(i) >= 3 ? 1 : 0), 0.85 * a); for (let i = -2; i <= 2; i++) lit(i, my + 1, 0.7 * a); }
        else if (shape === "frown") for (let i = -3; i <= 3; i++) lit(i, my + (Math.abs(i) >= 3 ? 0 : 1), 0.85 * a);
        else if (shape === "o") { for (let i = -1; i <= 1; i++) { lit(i, my - 1, 0.85 * a); lit(i, my + 1, 0.85 * a); } lit(-2, my, 0.85 * a); lit(2, my, 0.85 * a); }
        else if (shape === "open") for (let gy = my - 1; gy <= my + 1; gy++) for (let i = -2; i <= 2; i++) lit(i, gy, 0.85 * a);
        else if (shape === "squiggle") for (let i = -3; i <= 3; i++) lit(i, my + (i % 2 === 0 ? 0 : 1), 0.8 * a);
        else if (shape === "wave") {
          const t = now / 90;
          for (let i = -3; i <= 3; i++) {
            const amp = 1 + Math.round(Math.abs(Math.sin(t + i * 0.9)) * 2);
            for (let kk = 0; kk < amp; kk++) lit(i, my - kk + 1, (0.9 - kk * 0.12) * a);
          }
        }
      };
      drawMouth(prevMouth, 1 - mouthMix);
      drawMouth(curMouth, mouthMix);

      // ---- fone de ouvido (Modo Rádio) ----
      // Antes era um arco grande por cima da cabeça com duas caixas nas laterais: ficou
      // esquisito porque tapava o painel e não lia como fone nessa resolução. Agora é uma
      // cápsula tipo AirPod na "orelha" (do lado dos olhos, sem cobrir nada) com haste e um
      // cabo que balança pendurado — o cabo é o que faz ler na hora como fone, mesmo pequeno.
      if (cur.bob > 0.02) {
        const a = cur.bob;
        const earY = EYE_TOP;
        const earX = 11;
        for (const side of [-1, 1]) {
          for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) lit(side * (earX + dx), earY + dy, 0.95 * a);
          for (let dy = 2; dy <= 3; dy++) lit(side * earX, earY + dy, 0.85 * a); // haste
          for (let k = 0; k < 6; k++) {
            // cabo balançando, com os dois lados fora de fase pra não parecer espelhado
            const sway = Math.sin(now / 320 + k * 0.6 + (side > 0 ? 0 : Math.PI)) * 0.9;
            lit(side * earX + sway - side * k * 0.25, earY + 4 + k, (0.7 - k * 0.07) * a);
          }
        }
      }

      // ---- notinhas musicais saindo (de fone) ----
      if (cur.bob > 0.5) {
        if (now - lastNote > NOTE_SPAWN_MS) {
          notes.push({
            born: now,
            side: Math.random() < 0.5 ? -1 : 1,
            pat: NOTE_PATTERNS[Math.floor(Math.random() * NOTE_PATTERNS.length)],
            scale: 0.4 + Math.random() * 0.3,
            sway: 0.8 + Math.random() * 1.4,
          });
          lastNote = now;
        }
      } else {
        notes.length = 0;
      }
      notes = notes.filter((n) => now - n.born < NOTE_LIFE_MS);
      for (const n of notes) {
        const p = (now - n.born) / NOTE_LIFE_MS;
        const nc = cell * n.scale;
        // sai do lado do fone, sobe e vai abrindo pra fora
        const baseX = cx + n.side * (13 + p * 4) * cell + Math.sin(p * 6) * n.sway * cell * 0.4;
        const baseY = cy + (EYE_TOP - p * 9) * cell;
        const alpha = Math.sin(p * Math.PI) * 0.85; // aparece e desaparece suave
        for (let row = 0; row < n.pat.length; row++) {
          for (let col = 0; col < n.pat[row].length; col++) {
            if (n.pat[row][col] !== "#") continue;
            litPx(baseX + col * nc, baseY + row * nc, nc * 0.82, alpha);
          }
        }
      }

      // ---- "Z z z" do sono ----
      if (name === "sleeping") {
        if (now - lastZ > Z_SPAWN_MS) {
          zs.push({ born: now, scale: 0.45 + Math.random() * 0.35, sway: 0.6 + Math.random() * 1.2 });
          lastZ = now;
        }
      } else {
        zs.length = 0;
      }
      zs = zs.filter((z) => now - z.born < Z_LIFE_MS);
      for (const z of zs) {
        const p = (now - z.born) / Z_LIFE_MS;
        const zc = cell * z.scale;
        const baseX = cx + 7 * cell + p * z.sway * cell;
        const baseY = cy - 6 * cell - p * 9 * cell;
        const alpha = (1 - p) * 0.8;
        for (let row = 0; row < Z_PATTERN.length; row++) {
          for (let col = 0; col < Z_PATTERN[row].length; col++) {
            if (Z_PATTERN[row][col] !== "#") continue;
            litPx(baseX + col * zc, baseY + row * zc, zc * 0.82, alpha);
          }
        }
      }

      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("pointerdown", onPointerDown);
      cv.removeEventListener("pointermove", onPointerMove);
      cv.removeEventListener("pointerup", onPointerUp);
      cv.removeEventListener("pointercancel", onPointerUp);
      cv.removeEventListener("pointerleave", onPointerUp);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      // touchAction none: sem isso, arrastar o dedo pra fazer carinho rola a tela no celular
      style={{ width: size, height: size, maxWidth: "100%", display: "block", cursor: "pointer", touchAction: "none" }}
    />
  );
}
