"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { loadGames } from "@/lib/gameHistory.js";
import {
  BUILD_ACTIVITY, CASA, GRID, PATH_TILES, WORLD_ITEMS,
  availableActivities, houseLevel, nextItem, unlockedItems, worldXp,
} from "@/lib/lisaWorld.js";
import { LISA, NOTE, STEVE, TOOLS } from "./worldSprites.js";
import { NALA } from "./nalaSprites.js";
import * as A from "./isoArt.js";

// "Mundo da Lisa": o terreno dela, em ISOMÉTRICO, ocupando a tela inteira e rolável. Ela leva a
// vida ali — rega a horta, varre, brinca com a Nala, ouve música, acende a fogueira, recebe o
// Steve. O terreno ganha construções conforme VOCÊ interage com ela nos outros modos (regras e
// mapa em src/lib/lisaWorld.js; desenho em isoArt.js).
//
// Quatro decisões que sustentam isso:
//
// 1. O mundo inteiro é rasterizado UMA VEZ num canvas fora da tela, do tamanho do terreno todo,
//    e a câmera só recorta um pedaço com drawImage. São dezenas de milhares de células acesas,
//    cada uma um roundRect com sombra — refazer isso a cada quadro seria impossível.
//
// 2. Esse canvas é rasterizado num tamanho de célula FIXO (BASE), e o zoom é só uma escala na
//    hora de recortar. Se o zoom mudasse o tamanho da célula, cada passo de pinça obrigaria a
//    redesenhar o terreno inteiro e o gesto travaria no celular. Assim o cache só é refeito
//    quando aparece construção nova, o dia vira noite, ou o estilo muda.
//
// 3. Em isométrico a ordem de desenho é tudo. O cache sai ordenado por profundidade (tx+ty); e
//    como os personagens vão POR CIMA dele, o que estiver na frente deles é redesenhado depois —
//    senão a Lisa aparece em cima da casa ao passar atrás.
//
// 4. A hora é a de verdade do aparelho. De madrugada o terreno fica escuro, com estrelas, o
//    poste aceso e a fogueira acesa — e ela vai olhar as estrelas, que é atividade só da noite.

const BASE = 7;          // tamanho da célula no canvas do mundo (o zoom é escala em cima disso)
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.4;
const LISA_SPEED = 2.6;  // tiles por segundo
const NALA_SPEED = 3.4;
const STEP_MS = 150;
const GAP_MIN_MS = 1600;
const GAP_VAR_MS = 3200;
const SEEN_KEY = "lisaWorld.seenXp";
const ESTILO_KEY = "lisaWorld.estilo";

const isNight = (h) => h < 6 || h >= 19;
const lerp = (a, b, t) => a + (b - a) * t;
const clampZoom = (z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

export default function LisaWorld({ fullscreen = false }) {
  const [world, setWorld] = useState(null);
  const [novas, setNovas] = useState([]);
  const [label, setLabel] = useState("chegando no terreno…");
  const [zoom, setZoom] = useState(1);
  const [estilo, setEstilo] = useState("bloco"); // "bloco" | "linha"
  const [seguir, setSeguir] = useState(true);
  const [lista, setLista] = useState(false);
  const [estreito, setEstreito] = useState(false);

  const canvasRef = useRef(null);
  const sceneRef = useRef({ unlocked: [], level: 1, night: isNight(new Date().getHours()), temCarta: false });
  const camRef = useRef({ x: 40, y: 40 });
  const dragRef = useRef(null);
  const ptrsRef = useRef(new Map());
  const pinchRef = useRef(null);
  const seguirRef = useRef(seguir);
  seguirRef.current = seguir;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const estiloRef = useRef(estilo);
  estiloRef.current = estilo;

  const lisaRef = useRef({ tx: 6, ty: 20, targ: [6, 20], pose: "idle", flip: false, moving: false });
  const nalaRef = useRef({ tx: 7, ty: 22, targ: [7, 22], moving: false, flip: false });
  const steveRef = useRef(null);
  const actRef = useRef(null);
  const nextAtRef = useRef(0);
  const bagRef = useRef([]);
  const buildQueueRef = useRef([]);

  // tela estreita: os botões perdem o texto e viram só o ícone. Antes a fileira quebrava em duas
  // linhas no celular e cobria o que a Lisa estava fazendo.
  useEffect(() => {
    const ver = () => setEstreito(window.innerWidth < 640);
    ver();
    // no celular, com zoom 1 só cabe um pedaço do terreno na tela: começa mais afastado, senão
    // a primeira impressão é de estar perdido no meio do mato
    if (window.innerWidth < 640) setZoom(0.72);
    window.addEventListener("resize", ver);
    return () => window.removeEventListener("resize", ver);
  }, []);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(ESTILO_KEY);
      if (salvo === "linha" || salvo === "bloco") setEstilo(salvo);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(ESTILO_KEY, estilo); } catch {}
  }, [estilo]);

  // ---- progresso: o que você já fez de verdade ----
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [games, acts] = await Promise.all([
        loadGames({ limit: 1 }).catch(() => null),
        fetch("/api/activities").then((r) => r.json()).catch(() => null),
      ]);
      if (!vivo) return;
      const erro = acts && !acts.ok ? acts.error : null;
      const xp = worldXp({ games: games?.score, quiz: acts?.quiz, pair: acts?.pair });
      const unlocked = unlockedItems(xp);

      let seen = 0;
      try { seen = Number(localStorage.getItem(SEEN_KEY)) || 0; } catch {}
      const antes = new Set(unlockedItems(seen));
      const recem = WORLD_ITEMS.filter((i) => unlocked.includes(i.key) && !antes.has(i.key));
      try { localStorage.setItem(SEEN_KEY, String(xp)); } catch {}

      setWorld({ xp, unlocked, next: nextItem(xp), erro });
      setNovas(recem);
      buildQueueRef.current = recem.filter((i) => i.tx != null).slice(0, 3);
      sceneRef.current = { unlocked, level: houseLevel(xp), night: isNight(new Date().getHours()), temCarta: recem.length > 0 };
    })();
    return () => { vivo = false; };
  }, []);

  /** Sorteia a próxima coisa que ela vai fazer. Saco embaralhado: passa por todas antes de
   * repetir qualquer uma — mesmo padrão do rádio e das gracinhas da Nala. */
  const pickActivity = useCallback((now) => {
    if (buildQueueRef.current.length) {
      const item = buildQueueRef.current.shift();
      return { ...BUILD_ACTIVITY, label: `construindo: ${item.label.toLowerCase()}`, at: [item.tx + item.w, item.ty + item.d], startedAt: now, phase: "indo" };
    }
    const sc = sceneRef.current;
    if (!bagRef.current.length) {
      const pool = availableActivities(sc.unlocked, sc.night);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      bagRef.current = pool;
    }
    let a = bagRef.current.pop();
    // o saco pode ter sido montado antes de uma construção entrar, ou de o dia virar noite
    while (a && ((a.needs && !sc.unlocked.includes(a.needs)) || (a.night && !sc.night))) a = bagRef.current.pop();
    if (!a) return null;
    const at = a.at || [4 + Math.random() * (GRID - 8), 4 + Math.random() * (GRID - 8)];
    return { ...a, at, startedAt: now, phase: "indo" };
  }, []);

  // ---- laço de desenho ----
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d");
    let raf = 0;
    let last = performance.now();
    let accent = "56,225,255";
    let hex = "#38e1ff";
    let readAt = 0;
    let staticKey = "";
    let offScale = 1;

    const makePaint = (c, size, linha, ox = 0, oy = 0) => {
      // no estilo de linha a célula encolhe: o traço fica fino e a malha não vira mancha
      const pad = size * (linha ? 0.46 : 0.16);
      const round = typeof c.roundRect === "function";
      return (gx, gy, alpha = 1) => {
        if (alpha <= 0.02) return;
        const x = (gx - ox) * size + pad / 2;
        const y = (gy - oy) * size + pad / 2;
        c.fillStyle = `rgba(${accent},${alpha})`;
        if (round) { c.beginPath(); c.roundRect(x, y, size - pad, size - pad, (size - pad) * 0.3); c.fill(); }
        else c.fillRect(x, y, size - pad, size - pad);
      };
    };

    /** Tudo que fica parado no terreno, já em ordem de profundidade. */
    const placed = (sc) => {
      const out = [{ key: "casa", item: CASA }];
      for (const it of WORLD_ITEMS) if (sc.unlocked.includes(it.key) && it.tx != null) out.push({ key: it.key, item: it });
      return out.sort((a, b) => (a.item.tx + a.item.ty) - (b.item.tx + b.item.ty));
    };

    const drawObj = (P, key, item, sc, now) => {
      switch (key) {
        case "casa": A.drawCasa(P, item, sc.level, sc.night); break;
        case "horta": A.drawHorta(P, item); break;
        case "arvore1": case "arvore2": case "arvore3": A.drawArvore(P, item); break;
        case "casinha": A.drawCasinha(P, item); break;
        case "varal": A.drawVaral(P, item); break;
        case "banco": A.drawBanco(P, item); break;
        case "correio": A.drawCorreio(P, item, sc.temCarta); break;
        case "poste1": A.drawPoste(P, item, sc.night); break;
        case "radio": A.drawRadio(P, item); break;
        case "portao": A.drawPortao(P, item); break;
        case "flores": A.drawFlores(P, item); break;
        case "mesa": A.drawMesa(P, item); break;
        case "churras": A.drawChurras(P, item); break;
        case "balanco": A.drawBalanco(P, item); break;
        case "poco": A.drawPoco(P, item); break;
        case "fogueira": A.drawFogueira(P, item); break;
        case "oficina": A.drawOficina(P, item); break;
        case "estufa": A.drawEstufa(P, item); break;
        case "piscina": A.drawPiscina(P, item, now); break;
        case "lago": A.drawLago(P, item, now); break;
        case "mirante": A.drawMirante(P, item); break;
        default: break;
      }
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const rect = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (now - readAt > 500) {
        readAt = now;
        const rs = getComputedStyle(document.documentElement);
        accent = rs.getPropertyValue("--accent-rgb").trim() || accent;
        hex = rs.getPropertyValue("--accent-hex").trim() || hex;
      }
      const sc = sceneRef.current;
      const linha = estiloRef.current === "linha";
      const size = BASE * zoomRef.current; // célula na TELA
      ctx.fillStyle = "#03080c";
      ctx.fillRect(0, 0, w, h);

      // ---- o mundo inteiro, rasterizado uma vez só, em tamanho fixo ----
      const key = `${accent}|${sc.unlocked.join(",")}|${sc.level}|${sc.night}|${sc.temCarta}|${linha}`;
      if (key !== staticKey) {
        staticKey = key;
        offScale = A.WORLD_W * BASE * A.WORLD_H * BASE * 4 < 9e6 ? 2 : 1;
        off.width = Math.round(A.WORLD_W * BASE * offScale);
        off.height = Math.round(A.WORLD_H * BASE * offScale);
        offCtx.setTransform(offScale, 0, 0, offScale, 0, 0);
        offCtx.clearRect(0, 0, A.WORLD_W * BASE, A.WORLD_H * BASE);
        offCtx.shadowBlur = BASE * 1.1;
        offCtx.shadowColor = hex;
        const OP = { linha, paint: makePaint(offCtx, BASE, linha) };
        if (sc.night) for (let i = 0; i < 90; i++) OP.paint((i * 53) % A.WORLD_W, (i * 29) % 42, 0.3 + 0.2 * Math.sin(i));
        A.drawTerreno(OP, GRID);
        if (sc.unlocked.includes("caminho")) A.drawCaminho(OP, PATH_TILES);
        if (sc.unlocked.includes("cerca")) A.drawCerca(OP, GRID);
        for (const o of placed(sc)) drawObj(OP, o.key, o.item, sc, 0);
        if (sc.unlocked.includes("chamine")) A.drawChamine(OP, CASA, sc.level);
        if (sc.unlocked.includes("antena")) A.drawAntena(OP, CASA, sc.level);
        if (sc.unlocked.includes("solar") && sc.unlocked.includes("oficina")) A.drawSolar(OP, WORLD_ITEMS.find((i) => i.key === "oficina"));
        offCtx.shadowBlur = 0;
      }

      // ---- atividade ----
      const lisa = lisaRef.current;
      const nala = nalaRef.current;
      let a = actRef.current;
      if (!a && now > nextAtRef.current) {
        a = pickActivity(now);
        if (a) {
          actRef.current = a;
          lisa.targ = a.at;
          setLabel(a.label);
        }
      }

      const walk = (ent, speed) => {
        const dx = ent.targ[0] - ent.tx;
        const dy = ent.targ[1] - ent.ty;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.15) { ent.moving = false; return true; }
        const step = Math.min(speed * dt, dist);
        ent.tx += (dx / dist) * step;
        ent.ty += (dy / dist) * step;
        ent.moving = true;
        ent.flip = dx - dy < 0; // no isométrico, +tx vai pra direita e +ty pra esquerda
        return false;
      };
      const chegou = walk(lisa, LISA_SPEED);
      if (a && chegou && a.phase === "indo") {
        a.phase = "fazendo";
        a.until = now + a.ms;
        a.startedAt = now;
        if (a.key === "steve") steveRef.current = { tx: CASA.tx + CASA.w, ty: CASA.ty + CASA.d, targ: [lisa.tx + 1.6, lisa.ty + 1.6], moving: true, flip: false };
      }
      if (a?.phase === "fazendo" && now > a.until) {
        actRef.current = null;
        steveRef.current = null;
        nextAtRef.current = now + GAP_MIN_MS + Math.random() * GAP_VAR_MS;
        setLabel("dando uma volta pelo terreno");
      }
      lisa.pose = lisa.moving
        ? (Math.floor(now / STEP_MS) % 2 ? "walkA" : "walkB")
        : a?.phase === "fazendo"
        ? (a.sit ? "sit" : a.tool ? "work" : a.key === "steve" || a.key === "nala" ? "armUp" : "idle")
        : "idle";

      const brincando = a?.key === "nala" && a.phase === "fazendo";
      nala.targ = brincando
        ? [lisa.tx + 2.5 + Math.sin(now / 1400) * 2.5, lisa.ty + 2.5 + Math.cos(now / 1100) * 2.5]
        : [lisa.tx - 1.6, lisa.ty + 1.6];
      walk(nala, brincando ? NALA_SPEED * 1.4 : NALA_SPEED);

      const st = steveRef.current;
      if (st && a) {
        const indo = now - a.startedAt < a.ms * 0.75;
        st.targ = indo ? [lisa.tx + 1.6, lisa.ty + 1.6] : [CASA.tx + CASA.w, CASA.ty + CASA.d];
        walk(st, 2.2);
      }

      // ---- câmera ----
      const viewW = w / size;
      const viewH = h / size;
      const cam = camRef.current;
      if (seguirRef.current) {
        const p = A.iso(lisa.tx, lisa.ty);
        cam.x = lerp(cam.x, p.x - viewW / 2, 1 - Math.exp(-dt / 0.35));
        cam.y = lerp(cam.y, p.y - viewH / 2, 1 - Math.exp(-dt / 0.35));
      }
      cam.x = Math.max(0, Math.min(Math.max(0, A.WORLD_W - viewW), cam.x));
      cam.y = Math.max(0, Math.min(Math.max(0, A.WORLD_H - viewH), cam.y));

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        off,
        cam.x * BASE * offScale, cam.y * BASE * offScale,
        viewW * BASE * offScale, viewH * BASE * offScale,
        0, 0, w, h
      );

      // ---- atores e partículas, por cima ----
      ctx.shadowBlur = size * 1.1;
      ctx.shadowColor = hex;
      const P = { linha, paint: makePaint(ctx, size, linha, cam.x, cam.y) };
      const put = (rows, p, flip) => {
        const ox = Math.round(p.x - rows[0].length / 2);
        const oy = Math.round(p.y - (rows.length - 1));
        for (let r = 0; r < rows.length; r++)
          for (let c = 0; c < rows[r].length; c++)
            if (rows[r][c] === "#") P.paint(ox + (flip ? rows[r].length - 1 - c : c), oy + r, 1);
      };

      const pn = A.iso(nala.tx, nala.ty);
      put(nala.moving ? (Math.floor(now / 110) % 2 ? NALA.runA : NALA.runB) : Math.floor(now / 420) % 2 ? NALA.wag : NALA.idle, pn, nala.flip);

      const pl = A.iso(lisa.tx, lisa.ty);
      put(LISA[lisa.pose] || LISA.idle, pl, lisa.flip);
      if (a?.tool && a.phase === "fazendo") {
        const hx = Math.round(pl.x + (lisa.flip ? -8 : 4));
        const rows = TOOLS[a.tool];
        for (let r = 0; r < rows.length; r++)
          for (let c = 0; c < rows[r].length; c++)
            if (rows[r][c] === "#") P.paint(hx + c, Math.round(pl.y - 8 + r), 1);
        if (a.key === "regar" || a.key === "flores")
          for (let i = 0; i < 4; i++) {
            const t = ((now / 500) + i / 4) % 1;
            P.paint(Math.round(hx + 2 + t * 2), Math.round(pl.y - 4 + t * 4), 0.9 - t * 0.4);
          }
      }
      if (st) put(st.moving ? STEVE.idle : STEVE.armUp, A.iso(st.tx, st.ty), st.flip);

      // o que estiver NA FRENTE deles é redesenhado — senão ela aparece em cima da casa
      const frente = Math.min(lisa.tx + lisa.ty, nala.tx + nala.ty);
      for (const o of placed(sc)) {
        if (o.item.tx + o.item.ty <= frente) continue;
        const p = A.iso(o.item.tx, o.item.ty + (o.item.d || 1));
        if (Math.abs(p.x - pl.x) > 80 || Math.abs(p.y - pl.y) > 70) continue;
        drawObj(P, o.key, o.item, sc, now);
      }

      // ---- partículas ----
      if (sc.unlocked.includes("fogueira")) {
        const f = WORLD_ITEMS.find((i) => i.key === "fogueira");
        const c = A.iso(f.tx + f.w / 2, f.ty + f.d / 2);
        for (let i = 0; i < 5; i++) {
          const t = ((now / 900) + i / 5) % 1;
          P.paint(Math.round(c.x + Math.sin(t * 9 + i) * 2), Math.round(c.y - 1 - t * 10), (1 - t) * (sc.night ? 1 : 0.45));
        }
      }
      if (sc.unlocked.includes("chamine")) {
        const cp = A.iso(CASA.tx + CASA.w - 1.2, CASA.ty + 0.8, A.casaAltura(sc.level) + 10);
        for (let i = 0; i < 4; i++) {
          const t = ((now / 2800) + i / 4) % 1;
          P.paint(Math.round(cp.x + Math.sin(t * 5) * 3), Math.round(cp.y - 2 - t * 14), Math.sin(t * Math.PI) * 0.5);
        }
      }
      if (a?.key === "musica" && a.phase === "fazendo" && sc.unlocked.includes("radio")) {
        const r = WORLD_ITEMS.find((i) => i.key === "radio");
        const c = A.iso(r.tx + 0.5, r.ty + 0.5);
        for (let i = 0; i < 3; i++) {
          const t = ((now / 1700) + i / 3) % 1;
          const oy = Math.round(c.y - 12 - t * 16);
          for (let rr = 0; rr < NOTE.length; rr++)
            for (let cc = 0; cc < NOTE[rr].length; cc++)
              if (NOTE[rr][cc] === "#") P.paint(Math.round(c.x + 3 + t * 4) + cc, oy + rr, Math.sin(t * Math.PI) * 0.9);
        }
      }

      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pickActivity]);

  // ---- arrastar pra rolar, pinça pra aproximar ----
  const dist2 = () => {
    const [a, b] = [...ptrsRef.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrsRef.current.size === 2) {
      pinchRef.current = { d: dist2(), zoom: zoomRef.current };
      dragRef.current = null; // arrastar e dar pinça ao mesmo tempo dá tranco
    } else {
      dragRef.current = { x: e.clientX, y: e.clientY, cam: { ...camRef.current } };
    }
  };
  const onMove = (e) => {
    if (!ptrsRef.current.has(e.pointerId)) return;
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrsRef.current.size >= 2 && pinchRef.current) {
      setZoom(clampZoom(pinchRef.current.zoom * (dist2() / pinchRef.current.d)));
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) setSeguir(false);
    camRef.current.x = d.cam.x - (e.clientX - d.x) / (BASE * zoomRef.current);
    camRef.current.y = d.cam.y - (e.clientY - d.y) / (BASE * zoomRef.current);
  };
  const onUp = (e) => {
    ptrsRef.current.delete(e.pointerId);
    if (ptrsRef.current.size < 2) pinchRef.current = null;
    if (ptrsRef.current.size === 0) dragRef.current = null;
  };
  const onWheel = (e) => {
    setSeguir(false);
    setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  };

  const next = world?.next;
  // botão com área de toque de verdade: os antigos tinham ~24px de altura e no celular não dava
  // pra acertar o zoom
  const btn = (ativo = false) => ({
    ...mono, fontSize: 9.5, letterSpacing: 1, minWidth: 38, height: 36, padding: estreito ? "0 9px" : "0 12px",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    borderRadius: 8, border: `1px solid ${ativo ? CY : "rgba(var(--accent-rgb),0.28)"}`,
    background: ativo ? "rgba(var(--accent-rgb),0.16)" : "rgba(4,10,14,0.82)", color: "#eafcff", cursor: "pointer",
  });
  const shadow = { textShadow: "0 0 8px rgba(0,0,0,0.95)" };

  return (
    <div
      style={{
        position: "relative", width: "100%", minHeight: 0, overflow: "hidden",
        flex: fullscreen ? 1 : "none",
        height: fullscreen ? undefined : "min(70vh, 560px)",
        borderRadius: fullscreen ? 0 : 10,
        border: fullscreen ? "none" : "1px solid rgba(var(--accent-rgb),0.18)",
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "grab" }}
      />

      {/* Barra de cima: rótulo e botões no MESMO flex. Antes eram duas caixas soltas em absolute
          e, no celular, a fileira de botões quebrava em duas linhas e cobria o texto. Com
          `flex:1, minWidth:0` o rótulo corta com reticências em vez de empurrar os botões. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", pointerEvents: "none" }}>
        <div style={{ ...mono, fontSize: estreito ? 9 : 10.5, letterSpacing: 1.2, color: CY, flex: 1, minWidth: 0, paddingTop: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...shadow }}>
          {world ? `A LISA ESTÁ ${label.toUpperCase()}` : "CARREGANDO O TERRENO…"}
        </div>
        <div style={{ display: "flex", gap: 5, flex: "none", pointerEvents: "auto" }}>
          <button onClick={() => setEstilo((v) => (v === "bloco" ? "linha" : "bloco"))} style={btn(estilo === "linha")} title="alterna entre volume preenchido e esquema de linhas">
            {estilo === "linha" ? "◱" : "◧"}{estreito ? "" : estilo === "linha" ? " LINHA" : " BLOCO"}
          </button>
          <button onClick={() => setSeguir((v) => !v)} style={btn(seguir)} title="a câmera acompanha a Lisa; arrastar solta a câmera">
            {seguir ? "◉" : "○"}{estreito ? "" : seguir ? " SEGUINDO" : " LIVRE"}
          </button>
          <button onClick={() => { setSeguir(false); setZoom((z) => clampZoom(z / 1.25)); }} style={btn()} title="afastar">−</button>
          <button onClick={() => { setSeguir(false); setZoom((z) => clampZoom(z * 1.25)); }} style={btn()} title="aproximar">+</button>
          <button onClick={() => setLista((v) => !v)} style={btn(lista)} title="construções">{lista ? "✕" : "☰"}</button>
        </div>
      </div>

      {world && (
        <div style={{ position: "absolute", left: 12, bottom: 10, right: 12, display: "flex", flexDirection: "column", gap: 4, pointerEvents: "none" }}>
          {novas.length > 0 && (
            <div style={{ ...mono, fontSize: estreito ? 8.5 : 9.5, letterSpacing: 1, color: GR, maxHeight: 30, overflow: "hidden", ...shadow }}>
              ✦ DESDE A SUA ÚLTIMA VISITA ELA CONSTRUIU: {novas.map((n) => n.label).join(", ")}
            </div>
          )}
          <div style={{ ...mono, fontSize: estreito ? 8.5 : 9, letterSpacing: 1, display: "flex", gap: 12, flexWrap: "wrap", color: "rgba(207,239,251,0.72)", ...shadow }}>
            <span>{world.xp} pts de convivência</span>
            {next ? <span>falta {next.falta} pra {next.label.toLowerCase()}</span> : <span style={{ color: GR }}>terreno completo</span>}
            <span style={{ color: "rgba(207,239,251,0.42)" }}>{world.unlocked.length}/{WORLD_ITEMS.length}</span>
          </div>
          {next && (
            <div style={{ height: 4, maxWidth: 420, borderRadius: 3, background: "rgba(0,0,0,0.6)", overflow: "hidden" }}>
              <div style={{ width: `${Math.round(next.progresso * 100)}%`, height: "100%", background: CY }} />
            </div>
          )}
          {world.erro && (
            <div style={{ ...mono, fontSize: 8.5, color: OR, ...shadow }} title={world.erro}>
              ⚠ as tabelas de quiz/pair ainda não existem no banco — o terreno só está contando as partidas
            </div>
          )}
        </div>
      )}

      {lista && world && (
        <div style={{ position: "absolute", top: 52, right: 10, width: estreito ? "min(78vw, 240px)" : 240, maxHeight: "66%", overflowY: "auto", padding: 10, borderRadius: 8, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "rgba(4,10,14,0.96)", display: "flex", flexDirection: "column", gap: 3 }}>
          {WORLD_ITEMS.map((i) => {
            const tem = world.unlocked.includes(i.key);
            return (
              <div key={i.key} style={{ ...mono, fontSize: 8.5, display: "flex", justifyContent: "space-between", gap: 8, color: tem ? GR : "rgba(207,239,251,0.4)" }} title={i.note}>
                <span>{tem ? "✓ " : "· "}{i.label}</span>
                <span style={{ opacity: 0.6 }}>{i.xp}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
