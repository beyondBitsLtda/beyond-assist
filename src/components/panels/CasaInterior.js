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
// Duas coisas que este arquivo aprendeu, nesta ordem:
//
// 1. O cômodo era APERTADO. Onze por oito tiles com os móveis encostados uns nos outros: tudo se
//    sobrepunha e não dava pra entender o que era cada peça. Agora são 15x10, e cada móvel tem
//    folga em volta.
//
// 2. Não havia ORDEM DE PROFUNDIDADE. Os móveis saíam numa sequência fixa e os personagens
//    sempre por último, então a Lisa aparecia na frente da mesa mesmo estando atrás dela, e a
//    estante cobria o sofá. Agora tudo — móvel, Lisa e Nala — entra numa lista só, ordenada por
//    profundidade. É isso que faz a cena virar um cômodo em vez de uma pilha de caixas.
//
// A lareira só aparece se a chaminé já tiver sido construída lá fora: o dentro e o fora são o
// mesmo progresso.

const TW = 8;
const TH = 4;
const RW = 15; // cômodo, em tiles
const RD = 10;
const OX = 46;
const OY = 46;
const VW = 112; // área de desenho, em células
const VH = 102;
const PAREDE = 40; // pé-direito; a Lisa tem 23 células

const iso = (tx, ty, h = 0) => ({ x: OX + (tx - ty) * (TW / 2), y: OY + (tx + ty) * (TH / 2) - h });
const quad = (tx, ty, tw, td, h = 0) => [iso(tx, ty, h), iso(tx + tw, ty, h), iso(tx + tw, ty + td, h), iso(tx, ty + td, h)];

/**
 * Os cantos onde ela para, e o que faz em cada um. Ficam ao LADO do móvel correspondente, com
 * espaço pra ela caber sem entrar dentro dele.
 */
const PONTOS = [
  { tx: 3.4, ty: 8.4, faz: "no sofá",              anim: "sentar",    ms: 9000 },
  { tx: 11.4, ty: 6.3, faz: "comendo na mesa",     anim: "comer",     ms: 8000 },
  { tx: 12.6, ty: 1.8, faz: "olhando pela janela", anim: "olharCima", ms: 7000 },
  { tx: 7.5, ty: 8.6, faz: "arrumando a casa",     anim: "varrer",    ms: 9000 },
  { tx: 2.4, ty: 2.4, faz: "na lareira",           anim: "sentar",    ms: 9000, needs: "chamine" },
];

export default function CasaInterior({ unlocked = [], night = false, onClose }) {
  const canvasRef = useRef(null);
  const [faz, setFaz] = useState("chegando");
  const lisaRef = useRef({ tx: 8, ty: 8, targ: [8, 8], anim: null, flip: false, moving: false, until: 0, desde: 0, i: -1 });

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
      /** Pés à mostra: caixa pousada no chão vira caixote. É a perna que diz "móvel". */
      const pes = (tx, ty, tw, td, alt, larg = 1.3) => {
        for (const [a, b] of [[0.18, 0.18], [tw - 0.18, 0.18], [0.18, td - 0.18], [tw - 0.18, td - 0.18]]) {
          const q = iso(tx + a, ty + b);
          barra(P, q, { x: q.x, y: q.y - alt }, larg);
        }
      };

      // ---- piso e as duas paredes do fundo ----
      P.poli(quad(0, 0, RW, RD), { a: 0.6, fill: 0.03 });
      for (let i = 3; i < RW; i += 3) P.linha([iso(i, 0), iso(i, RD)], { a: 0.07, w: 0.7 });
      for (let i = 3; i < RD; i += 3) P.linha([iso(0, i), iso(RW, i)], { a: 0.07, w: 0.7 });
      for (const [a, b] of [[iso(0, 0), iso(RW, 0)], [iso(0, 0), iso(0, RD)]]) {
        const alto = (p) => ({ x: p.x, y: p.y - PAREDE });
        P.poli([a, b, alto(b), alto(a)], { a: 0.75, fill: 0.03, solido: true });
        for (let k = 10; k < PAREDE; k += 10) P.linha([{ x: a.x, y: a.y - k }, { x: b.x, y: b.y - k }], { a: 0.09, w: 0.7 });
      }

      // a janela fica NA parede, então vem antes de tudo que está no chão
      {
        const j = iso(12.4, 0.15);
        P.poli([
          { x: j.x - 5, y: j.y - 34 }, { x: j.x + 5, y: j.y - 34 },
          { x: j.x + 5, y: j.y - 19 }, { x: j.x - 5, y: j.y - 19 },
        ], { a: 0.95, fill: night ? 0.7 : 0.12, solido: true });
        P.linha([{ x: j.x, y: j.y - 34 }, { x: j.x, y: j.y - 19 }], { a: 0.8, w: 0.8 });
        P.linha([{ x: j.x - 5, y: j.y - 26.5 }, { x: j.x + 5, y: j.y - 26.5 }], { a: 0.8, w: 0.8 });
      }

      /**
       * Tudo que tem lugar no chão entra aqui com a profundidade dele e sai desenhado em ordem.
       * Os personagens entram na MESMA lista — é o que impede a Lisa de aparecer na frente da
       * mesa quando ela está atrás dela.
       */
      const pecas = [];
      const peca = (tx, ty, tw, td, desenha) => pecas.push({ z: tx + tw / 2 + ty + td / 2, desenha });

      // estante encostada na parede do fundo, com livros nas prateleiras
      peca(4, 0.2, 3.2, 0.8, () => {
        caixa(4, 0.2, 3.2, 0.8, 32, { luz: 0.05 });
        for (let k = 7; k < 32; k += 7) {
          barra(P, iso(4, 1, k), iso(7.2, 1, k), 1.2, { a: 0.8 });
          for (let i = 0; i < 5; i++) {
            const q = iso(4.35 + i * 0.55, 0.95, k);
            barra(P, q, { x: q.x, y: q.y - 4 - (i % 3) }, 1.2, { a: 0.55, fill: 0.1 });
          }
        }
      });

      // lareira, só se a chaminé existir lá fora
      if (unlocked.includes("chamine"))
        peca(0.2, 0.2, 2.2, 1, () => {
          caixa(0.2, 0.2, 2.2, 1, 24, { luz: 0.05 });
          const f = iso(1.3, 1.2);
          P.poli([{ x: f.x - 4, y: f.y - 11 }, { x: f.x + 4, y: f.y - 11 }, { x: f.x + 4, y: f.y - 0.5 }, { x: f.x - 4, y: f.y - 0.5 }],
            { a: 0.9, fill: 0.3, solido: true });
          for (let i = 0; i < 6; i++) {
            const t = ((now / 620) + i / 6) % 1;
            P.ponto({ x: f.x - 2 + Math.sin(t * 8 + i) * 2.5, y: f.y - 3 - t * 8 }, { a: (1 - t) * 0.9, r: 0.55 });
          }
        });

      // tapete, no meio do cômodo
      peca(5.5, 4.5, 4, 3, () => {
        const c = quad(5.5, 4.5, 4, 3);
        P.poli(c, { a: 0.4, fill: 0.05 });
        for (let i = 1; i < 4; i++) {
          const t = i / 4;
          P.linha([
            { x: c[0].x + (c[3].x - c[0].x) * t, y: c[0].y + (c[3].y - c[0].y) * t },
            { x: c[1].x + (c[2].x - c[1].x) * t, y: c[1].y + (c[2].y - c[1].y) * t },
          ], { a: 0.16, w: 0.7 });
        }
      });

      // sofá: base sobre pés, encosto alto e dois braços
      peca(1.2, 6, 3.6, 2.6, () => {
        pes(1.2, 6, 3.6, 2.6, 4, 1.1);
        caixa(1.2, 6, 3.6, 2.6, 3, { luz: 0.1, base: 4 });
        caixa(1.2, 6, 3.6, 0.55, 12, { luz: 0.06, base: 7 });
        caixa(1.2, 6, 0.5, 2.6, 6, { luz: 0.08, base: 7 });
        caixa(4.3, 6, 0.5, 2.6, 6, { luz: 0.08, base: 7 });
      });

      // abajur de chão ao lado do sofá: haste fina e cúpula cônica bem aberta
      peca(0.6, 9.2, 0.8, 0.8, () => {
        const b = iso(1, 9.6);
        P.elipse(b.x, b.y, 2.8, 1.5, { a: 0.8, fill: 0.12, solido: true });
        barra(P, b, { x: b.x, y: b.y - 22 }, 1.1);
        P.poli([{ x: b.x - 6, y: b.y - 22 }, { x: b.x + 6, y: b.y - 22 }, { x: b.x + 3.2, y: b.y - 30 }, { x: b.x - 3.2, y: b.y - 30 }],
          { a: 0.95, fill: night ? 0.8 : 0.16, solido: true });
        if (night) P.elipse(b.x, b.y - 20, 12, 6.5, { a: 0.12, fill: 0.03 });
      });

      // mesa de jantar e duas cadeiras com encosto, do outro lado do cômodo
      peca(9.6, 4.6, 3, 2.6, () => {
        pes(9.6, 4.6, 3, 2.6, 12);
        caixa(9.4, 4.45, 3.4, 2.9, 1.8, { luz: 0.14, base: 12 });
      });
      for (const [cx, cy] of [[8.2, 5], [13, 5]])
        peca(cx, cy, 1.1, 1.6, () => {
          pes(cx, cy, 1.1, 1.6, 8, 1.1);
          caixa(cx, cy, 1.1, 1.6, 1.5, { luz: 0.1, base: 8 });
          caixa(cx, cy, 1.1, 0.35, 10, { luz: 0.06, base: 9.5 });
        });

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
        const passo = Math.min(2.3 * dt, dist);
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

      peca(L.tx, L.ty, 0, 0, () => {
        const p = iso(L.tx, L.ty);
        const g = L.moving
          ? { pose: Math.floor(now / 160) % 2 ? "walkA" : "walkB", dx: 0, dy: 0, lean: 0, agacha: 0 }
          : gesto(L.anim || "andar", now - L.desde);
        const rows = LISA[g.pose] || LISA.idle;
        // sentada, ela sobe até o assento (7 células), descontadas as 3 fileiras vazias do desenho
        const sentou = g.pose === "sit" ? -4 : 0;
        P.figura(rows, p.x - rows[0].length / 2 + g.dx, p.y - rows.length + g.dy + sentou, { flip: L.flip, lean: g.lean, agacha: g.agacha });
        if (!L.moving && L.anim) adereco(P, L.anim, now - L.desde, { x: p.x + g.dx, y: p.y + g.dy + sentou }, L.flip);
      });

      // a Nala dorme num canto
      peca(12.4, 8.6, 0, 0, () => {
        const np = iso(12.4, 8.6);
        const nrows = Math.floor(now / 2200) % 2 ? NALA.sleep : NALA.idle;
        P.figura(nrows, np.x - nrows[0].length / 2, np.y - nrows.length, {});
      });

      pecas.sort((a, b) => a.z - b.z);
      for (const p of pecas) p.desenha();

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
      <canvas onClick={(e) => e.stopPropagation()} ref={canvasRef} style={{ width: "min(94%, 980px)", aspectRatio: `${VW} / ${VH}`, maxHeight: "76vh", display: "block", cursor: "default" }} />
      <div style={{ ...mono, fontSize: 9, letterSpacing: 1, color: "rgba(207,239,251,0.45)" }}>toque fora pra voltar pro terreno</div>
    </div>
  );
}
