"use client";

import { useEffect, useRef, useState } from "react";
import { CY, mono } from "@/lib/theme.js";
import { LISA } from "./worldSprites.js";
import { NALA } from "./nalaSprites.js";
import { adereco, gesto } from "./lisaAnim.js";
import { barra, pincel, volume } from "./isoArt.js";

// O dentro da casa. Abre ao clicar nela enquanto a Lisa está lá — e ela está lá quando se
// abriga da chuva, da neve ou do vento, ou quando a rotina a leva pra dentro (café, almoço,
// dormir).
//
// É um corte isométrico do cômodo, no mesmo traço do terreno: piso, duas paredes de fundo e a
// mobília. As paredes da frente não existem de propósito — é assim que se olha pra dentro de um
// cômodo em isométrico sem precisar de transparência.
//
// O cômodo tem origem e escala próprias (ele preenche um painel, não o mundo), então projeta com
// o `iso` daqui e entrega os cantos já prontos pro `volume` do isoArt. Assim há um desenho de
// caixa isométrica só, e não dois que envelhecem em separado.
//
// Ela não fica parada aqui: anda entre uns poucos pontos e faz alguma coisa em cada um, com os
// mesmos gestos do terreno. A lareira só aparece se a chaminé já tiver sido construída lá fora —
// o dentro e o fora são o mesmo progresso.

const TW = 8;
const TH = 4;
const RW = 11; // cômodo, em tiles
const RD = 8;
// origem e área ajustadas pro cômodo PREENCHER o painel: com a área grande demais ele ficava
// perdido no meio de um vazio
const OX = 42;
const OY = 34;
const VW = 94; // área de desenho, em células
const VH = 80;
// pé-direito: a Lisa tem 23 células, então a parede precisa passar bem disso — com 26 ela
// encostava no teto e o cômodo parecia uma caixa de sapato
const PAREDE = 42;

const iso = (tx, ty, h = 0) => ({ x: OX + (tx - ty) * (TW / 2), y: OY + (tx + ty) * (TH / 2) - h });
const quad = (tx, ty, tw, td, h = 0) => [iso(tx, ty, h), iso(tx + tw, ty, h), iso(tx + tw, ty + td, h), iso(tx, ty + td, h)];

/** Os cantos onde ela para, e o que faz em cada um. */
const PONTOS = [
  { tx: 2.2, ty: 5.6, faz: "no sofá",             anim: "sentar",    ms: 9000 },
  { tx: 7.7, ty: 5.3, faz: "comendo na mesa",     anim: "comer",     ms: 8000 },
  { tx: 8.6, ty: 1.4, faz: "olhando pela janela", anim: "olharCima", ms: 7000 },
  { tx: 4.6, ty: 3.4, faz: "arrumando a casa",    anim: "varrer",    ms: 9000 },
  { tx: 1.6, ty: 1.6, faz: "na lareira",          anim: "sentar",    ms: 9000, needs: "chamine" },
];

export default function CasaInterior({ unlocked = [], night = false, onClose }) {
  const canvasRef = useRef(null);
  const [faz, setFaz] = useState("chegando");
  const lisaRef = useRef({ tx: 5, ty: 6.5, targ: [5, 6.5], anim: null, flip: false, moving: false, until: 0, desde: 0, i: -1 });

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let raf = 0;
    let last = performance.now();
    let accent = "56,225,255";
    let hex = "#38e1ff";
    let readAt = 0;

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
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (now - readAt > 500) {
        readAt = now;
        const rs = getComputedStyle(document.documentElement);
        accent = rs.getPropertyValue("--accent-rgb").trim() || accent;
        hex = rs.getPropertyValue("--accent-hex").trim() || hex;
      }

      // a célula acompanha o tamanho do painel; a câmera negativa centraliza o cômodo nele
      const cell = Math.min(w / VW, h / VH);
      const camX = -((w / cell) - VW) / 2;
      const camY = -((h / cell) - VH) / 2;
      ctx.shadowBlur = cell * 0.8;
      ctx.shadowColor = hex;
      const P = pincel(ctx, { cell, camX, camY, accent });
      const caixa = (tx, ty, tw, td, alt, opts) => volume(P, quad(tx, ty, tw, td), alt, opts);

      // ---- piso e as duas paredes do fundo ----
      P.poli(quad(0, 0, RW, RD), { a: 0.6, fill: 0.03 });
      for (let i = 2; i < RW; i += 2) P.linha([iso(i, 0), iso(i, RD)], { a: 0.08, w: 0.7 });
      for (let i = 2; i < RD; i += 2) P.linha([iso(0, i), iso(RW, i)], { a: 0.08, w: 0.7 });
      for (const [a, b] of [[iso(0, 0), iso(RW, 0)], [iso(0, 0), iso(0, RD)]]) {
        const alto = (p) => ({ x: p.x, y: p.y - PAREDE });
        P.poli([a, b, alto(b), alto(a)], { a: 0.75, fill: 0.03, solido: true });
        for (let k = 8; k < PAREDE; k += 8) P.linha([{ x: a.x, y: a.y - k }, { x: b.x, y: b.y - k }], { a: 0.1, w: 0.7 });
      }

      // ---- mobília ----
      //
      // Tudo com pé: caixa pousada no chão vira caixote. É a perna à mostra que diz "móvel".
      const pes = (tx, ty, tw, td, alt, larg = 1.3) => {
        for (const [a, b] of [[0.18, 0.18], [tw - 0.18, 0.18], [0.18, td - 0.18], [tw - 0.18, td - 0.18]]) {
          const q = iso(tx + a, ty + b);
          barra(P, q, { x: q.x, y: q.y - alt }, larg);
        }
      };

      // sofá: base, encosto alto e dois braços
      pes(0.9, 4.4, 3.2, 2.2, 4, 1.1);
      caixa(0.9, 4.4, 3.2, 2.2, 3, { luz: 0.1, base: 4 });
      caixa(0.9, 4.4, 3.2, 0.5, 12, { luz: 0.06, base: 7 });
      caixa(0.9, 4.4, 0.45, 2.2, 6, { luz: 0.08, base: 7 });
      caixa(3.65, 4.4, 0.45, 2.2, 6, { luz: 0.08, base: 7 });

      P.poli(quad(3.8, 3.2, 3.2, 2.8), { a: 0.4, fill: 0.05 });        // tapete
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        const c = quad(3.8, 3.2, 3.2, 2.8);
        P.linha([
          { x: c[0].x + (c[3].x - c[0].x) * t, y: c[0].y + (c[3].y - c[0].y) * t },
          { x: c[1].x + (c[2].x - c[1].x) * t, y: c[1].y + (c[2].y - c[1].y) * t },
        ], { a: 0.18, w: 0.7 });
      }

      // mesa e duas cadeiras, com encosto — é o encosto que diferencia cadeira de banquinho
      pes(6.4, 4.2, 2.6, 2.2, 12);
      caixa(6.3, 4.1, 2.8, 2.4, 1.6, { luz: 0.14, base: 12 });
      for (const [cx, cy] of [[5.2, 4.6], [9.3, 4.6]]) {
        pes(cx, cy, 1, 1.4, 8, 1.1);
        caixa(cx, cy, 1, 1.4, 1.4, { luz: 0.1, base: 8 });
        caixa(cx, cy, 1, 0.3, 10, { luz: 0.06, base: 9.4 });
      }

      caixa(4.4, 0.2, 2.8, 0.7, 32, { luz: 0.05 });                    // estante
      for (let k = 7; k < 32; k += 7) {
        barra(P, iso(4.4, 0.9, k), iso(7.2, 0.9, k), 1.2, { a: 0.8 });
        // os livros: umas poucas lombadas em cada prateleira
        for (let i = 0; i < 5; i++) {
          const q = iso(4.7 + i * 0.5, 0.85, k);
          barra(P, q, { x: q.x, y: q.y - 4 - (i % 3) }, 1.1, { a: 0.5, fill: 0.1 });
        }
      }

      // janela na parede do fundo, acesa se for noite
      {
        const j = iso(9.6, 0.15);
        P.poli([
          { x: j.x - 4.5, y: j.y - 34 }, { x: j.x + 4.5, y: j.y - 34 },
          { x: j.x + 4.5, y: j.y - 20 }, { x: j.x - 4.5, y: j.y - 20 },
        ], { a: 0.95, fill: night ? 0.7 : 0.12, solido: true });
        P.linha([{ x: j.x, y: j.y - 34 }, { x: j.x, y: j.y - 20 }], { a: 0.8, w: 0.8 });
        P.linha([{ x: j.x - 4.5, y: j.y - 27 }, { x: j.x + 4.5, y: j.y - 27 }], { a: 0.8, w: 0.8 });
      }

      // lareira, só se a chaminé existir lá fora
      if (unlocked.includes("chamine")) {
        caixa(0.2, 0.2, 1.8, 0.8, 24, { luz: 0.05 });
        const f = iso(1.1, 1.0);
        P.poli([{ x: f.x - 3.6, y: f.y - 10 }, { x: f.x + 3.6, y: f.y - 10 }, { x: f.x + 3.6, y: f.y - 0.5 }, { x: f.x - 3.6, y: f.y - 0.5 }],
          { a: 0.9, fill: 0.3, solido: true });
        for (let i = 0; i < 5; i++) {
          const t = ((now / 620) + i / 5) % 1;
          P.ponto({ x: f.x - 2 + Math.sin(t * 8 + i) * 2, y: f.y - 3 - t * 7 }, { a: (1 - t) * 0.9, r: 0.5 });
        }
      }

      // abajur de chão: haste fina e cúpula cônica bem aberta, senão vira um pilar
      {
        const b = iso(4.3, 6.9);
        P.elipse(b.x, b.y, 2.6, 1.4, { a: 0.8, fill: 0.12, solido: true });
        barra(P, b, { x: b.x, y: b.y - 22 }, 1.1);
        P.poli([{ x: b.x - 5.5, y: b.y - 22 }, { x: b.x + 5.5, y: b.y - 22 }, { x: b.x + 3, y: b.y - 29 }, { x: b.x - 3, y: b.y - 29 }],
          { a: 0.95, fill: night ? 0.8 : 0.16, solido: true });
        if (night) P.elipse(b.x, b.y - 20, 11, 6, { a: 0.12, fill: 0.03 });
      }

      // ---- ela ----
      const L = lisaRef.current;
      if (now > L.until && !L.moving) {
        const opcoes = PONTOS.filter((x) => !x.needs || unlocked.includes(x.needs));
        let i = Math.floor(Math.random() * opcoes.length);
        if (opcoes.length > 1 && i === L.i) i = (i + 1) % opcoes.length;
        L.i = i;
        const alvo = opcoes[i];
        L.targ = [alvo.tx, alvo.ty];
        L.proxAnim = alvo.anim;
        L.proxMs = alvo.ms;
        setFaz(alvo.faz);
      }
      const dx = L.targ[0] - L.tx;
      const dy = L.targ[1] - L.ty;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.12) {
        const passo = Math.min(1.9 * dt, dist);
        L.tx += (dx / dist) * passo;
        L.ty += (dy / dist) * passo;
        L.moving = true;
        L.anim = null;
        L.flip = dx - dy < 0;
      } else if (L.moving) {
        L.moving = false;
        L.anim = L.proxAnim || null;
        L.desde = now;
        L.until = now + (L.proxMs || 7000);
      }

      const p = iso(L.tx, L.ty);
      const g = L.moving
        ? { pose: Math.floor(now / 160) % 2 ? "walkA" : "walkB", dx: 0, dy: 0, lean: 0, agacha: 0 }
        : gesto(L.anim || "andar", now - L.desde);
      const rows = LISA[g.pose] || LISA.idle;
      // sentada, ela sobe até o assento (7 células), descontadas as 3 fileiras vazias do desenho.
      // Descendo, como estava antes, ela ficava de pé em cima do sofá.
      const sentou = g.pose === "sit" ? -4 : 0;
      P.figura(rows, p.x - rows[0].length / 2 + g.dx, p.y - rows.length + g.dy + sentou, { flip: L.flip, lean: g.lean, agacha: g.agacha });
      if (!L.moving && L.anim) adereco(P, L.anim, now - L.desde, { x: p.x + g.dx, y: p.y + g.dy + sentou }, L.flip);

      // a Nala dorme num canto
      const np = iso(8.4, 6.8);
      const nrows = Math.floor(now / 2200) % 2 ? NALA.sleep : NALA.idle;
      P.figura(nrows, np.x - nrows[0].length / 2, np.y - nrows.length, {});

      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [unlocked, night]);

  return (
    <div
      onClick={onClose}
      style={{ position: "absolute", inset: 0, background: "rgba(2,6,9,0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, zIndex: 30, cursor: "pointer" }}
    >
      <div style={{ ...mono, fontSize: 10.5, letterSpacing: 2, color: CY }}>DENTRO DA CASA · A LISA ESTÁ {faz.toUpperCase()}</div>
      <canvas onClick={(e) => e.stopPropagation()} ref={canvasRef} style={{ width: "min(94%, 900px)", aspectRatio: `${VW} / ${VH}`, display: "block", cursor: "default" }} />
      <div style={{ ...mono, fontSize: 9, letterSpacing: 1, color: "rgba(207,239,251,0.45)" }}>toque fora pra voltar pro terreno</div>
    </div>
  );
}
