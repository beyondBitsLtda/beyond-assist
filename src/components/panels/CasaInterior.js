"use client";

import { useEffect, useRef, useState } from "react";
import { CY, mono } from "@/lib/theme.js";
import { LISA, LISA_H } from "./worldSprites.js";
import { NALA } from "./nalaSprites.js";

// O dentro da casa. Abre ao clicar nela enquanto a Lisa está lá — e ela está lá quando se
// abriga da chuva, da neve ou do vento, ou quando o terreno está sossegado à noite.
//
// É um corte isométrico do cômodo: piso, duas paredes e a mobília, tudo com as mesmas
// primitivas em traço do terreno. As paredes da frente não existem de propósito — é assim que
// se olha pra dentro de um cômodo em isométrico sem precisar de transparência.
//
// Ela não fica parada aqui: anda entre uns poucos pontos (sofá, mesa, lareira, janela) e faz
// alguma coisa em cada um. A lareira só aparece se a chaminé já tiver sido construída lá fora —
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

const iso = (tx, ty, h = 0) => ({ x: OX + (tx - ty) * (TW / 2), y: OY + (tx + ty) * (TH / 2) - h });

/** Os cantos onde ela para, e o que faz em cada um. */
const PONTOS = [
  { tx: 2.2, ty: 5.6, faz: "no sofá", pose: "sit", ms: 9000 },
  { tx: 7.4, ty: 5.4, faz: "na mesa", pose: "work", ms: 8000 },
  { tx: 8.6, ty: 1.4, faz: "olhando pela janela", pose: "idle", ms: 7000 },
  { tx: 1.6, ty: 1.6, faz: "na lareira", pose: "idle", ms: 9000, needs: "chamine" },
];

export default function CasaInterior({ unlocked = [], night = false, onClose }) {
  const canvasRef = useRef(null);
  const [faz, setFaz] = useState("chegando");
  const lisaRef = useRef({ tx: 5, ty: 6.5, targ: [5, 6.5], pose: "idle", flip: false, moving: false, until: 0, i: -1 });

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
      if (now - readAt > 500) {
        readAt = now;
        const rs = getComputedStyle(document.documentElement);
        accent = rs.getPropertyValue("--accent-rgb").trim() || accent;
        hex = rs.getPropertyValue("--accent-hex").trim() || hex;
      }

      const cell = Math.min(w / VW, h / VH);
      const offX = (w - VW * cell) / 2;
      const offY = (h - VH * cell) / 2;
      const pad = cell * 0.18;
      const round = typeof ctx.roundRect === "function";
      ctx.shadowBlur = cell * 1.1;
      ctx.shadowColor = hex;
      const paint = (gx, gy, a = 1) => {
        if (a <= 0.02) return;
        ctx.fillStyle = `rgba(${accent},${a})`;
        const x = offX + gx * cell + pad / 2;
        const y = offY + gy * cell + pad / 2;
        if (round) { ctx.beginPath(); ctx.roundRect(x, y, cell - pad, cell - pad, (cell - pad) * 0.3); ctx.fill(); }
        else ctx.fillRect(x, y, cell - pad, cell - pad);
      };
      const line = (a, b, al) => {
        const n = Math.max(1, Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))) * 2);
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          paint(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t), al);
        }
      };
      const chao = (tx, ty, tw, td, a, hh = 0, mod = 0) => {
        for (let i = 0; i <= tw * TW; i++)
          for (let j = 0; j <= td * TW; j++) {
            const p = iso(tx + i / TW, ty + j / TW, hh);
            const gx = Math.round(p.x);
            const gy = Math.round(p.y);
            if (mod && (gx * 2 + gy) % mod === 0) continue;
            paint(gx, gy, a);
          }
      };
      const borda = (tx, ty, tw, td, a, hh = 0) => {
        const N = iso(tx, ty, hh), E = iso(tx + tw, ty, hh), S = iso(tx + tw, ty + td, hh), W = iso(tx, ty + td, hh);
        line(N, E, a); line(E, S, a); line(S, W, a); line(W, N, a);
      };
      const caixa = (tx, ty, tw, td, hh, { top = 0.55, left = 0.24, right = 0.4 } = {}) => {
        const E = iso(tx + tw, ty), S = iso(tx + tw, ty + td), W = iso(tx, ty + td);
        const face = (p1, p2, a) => {
          const n = Math.max(1, Math.round(Math.abs(p2.x - p1.x)) * 2);
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            const x = Math.round(p1.x + (p2.x - p1.x) * t);
            const yb = Math.round(p1.y + (p2.y - p1.y) * t);
            for (let k = 0; k < hh; k++) paint(x, yb - k, a);
          }
        };
        face(W, S, left); face(S, E, right);
        chao(tx, ty, tw, td, top, hh);
        borda(tx, ty, tw, td, 1, hh);
        line(W, { x: W.x, y: W.y - hh }, 1);
        line(S, { x: S.x, y: S.y - hh }, 1);
        line(E, { x: E.x, y: E.y - hh }, 1);
      };
      const bloco = (x, y, bw, bh, a) => {
        for (let i = 0; i < bw; i++) for (let j = 0; j < bh; j++) paint(Math.round(x + i), Math.round(y + j), a);
      };

      // ---- piso e as duas paredes do fundo ----
      chao(0, 0, RW, RD, 0.16, 0, 3);
      for (let i = 0; i <= RW; i += 1) line(iso(i, 0), iso(i, RD), 0.06);
      for (let i = 0; i <= RD; i += 1) line(iso(0, i), iso(RW, i), 0.06);
      borda(0, 0, RW, RD, 0.6);
      const PAREDE = 26;
      // parede de trás-esquerda e trás-direita, em traço (cheia viraria um bloco)
      for (const [a, b] of [[iso(0, 0), iso(RW, 0)], [iso(0, 0), iso(0, RD)]]) {
        line(a, b, 0.8);
        line({ x: a.x, y: a.y - PAREDE }, { x: b.x, y: b.y - PAREDE }, 0.8);
        line(a, { x: a.x, y: a.y - PAREDE }, 0.8);
        line(b, { x: b.x, y: b.y - PAREDE }, 0.8);
        for (let k = 6; k < PAREDE; k += 6) line({ x: a.x, y: a.y - k }, { x: b.x, y: b.y - k }, 0.12);
      }

      // ---- mobília ----
      // sofá
      caixa(1.2, 4.6, 2.6, 2, 5);
      caixa(1.2, 4.6, 2.6, 0.5, 11, { top: 0.4, left: 0.2, right: 0.34 });
      // tapete
      borda(3.4, 3.6, 3.4, 2.6, 0.35);
      chao(3.4, 3.6, 3.4, 2.6, 0.12, 0, 2);
      // mesa e duas cadeiras
      caixa(6.6, 4.4, 2.2, 1.8, 8);
      caixa(6.3, 4.7, 0.5, 1.2, 5, { top: 0.4 });
      caixa(8.8, 4.7, 0.5, 1.2, 5, { top: 0.4 });
      // estante de livros na parede do fundo
      caixa(4.6, 0.2, 2.4, 0.6, 20, { top: 0.3, left: 0.18, right: 0.3 });
      for (let k = 5; k < 20; k += 5) {
        const p = iso(4.6, 0.8, k);
        const q = iso(7, 0.8, k);
        line(p, q, 0.75);
      }
      // janela na parede da direita, acesa se for noite
      {
        const p = iso(9.6, 0.15);
        bloco(p.x - 3, p.y - 20, 7, 9, night ? 0.9 : 0.35);
        for (let j = 0; j < 9; j++) paint(Math.round(p.x), Math.round(p.y - 20 + j), 1);
      }
      // lareira, só se a chaminé existir lá fora
      if (unlocked.includes("chamine")) {
        caixa(0.2, 0.2, 1.8, 0.8, 14, { top: 0.3, left: 0.2, right: 0.32 });
        const f = iso(1.1, 1.0);
        for (let i = 0; i < 5; i++) {
          const t = ((now / 620) + i / 5) % 1;
          paint(Math.round(f.x - 2 + Math.sin(t * 8 + i) * 2), Math.round(f.y - 3 - t * 7), (1 - t) * 0.95);
        }
        bloco(f.x - 3, f.y - 4, 6, 3, 0.5);
      }
      // abajur
      caixa(4.2, 6.6, 0.5, 0.5, 12, { top: 0.5 });
      {
        const p = iso(4.45, 6.85, 12);
        bloco(p.x - 3, p.y - 5, 6, 4, night ? 0.95 : 0.45);
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
        L.proxPose = alvo.pose;
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
        L.flip = dx - dy < 0;
        L.pose = Math.floor(now / 160) % 2 ? "walkA" : "walkB";
      } else if (L.moving) {
        L.moving = false;
        L.pose = L.proxPose || "idle";
        L.until = now + (L.proxMs || 7000);
      }

      const p = iso(L.tx, L.ty);
      const rows = LISA[L.pose] || LISA.idle;
      const ox = Math.round(p.x - rows[0].length / 2);
      const oy = Math.round(p.y - (LISA_H - 1)) + (L.pose === "sit" ? 4 : 0);
      for (let r = 0; r < rows.length; r++)
        for (let c = 0; c < rows[r].length; c++)
          if (rows[r][c] === "#") paint(ox + (L.flip ? rows[r].length - 1 - c : c), oy + r, 1);

      // a Nala dorme num canto
      const np = iso(8.4, 6.8);
      const nrows = Math.floor(now / 2200) % 2 ? NALA.sleep : NALA.idle;
      for (let r = 0; r < nrows.length; r++)
        for (let c = 0; c < nrows[r].length; c++)
          if (nrows[r][c] === "#") paint(Math.round(np.x - nrows[r].length / 2) + c, Math.round(np.y - (nrows.length - 1)) + r, 0.9);

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
