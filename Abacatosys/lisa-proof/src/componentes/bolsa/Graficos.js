"use client";

// Os gráficos da Bolsa do Reino, em SVG desenhado no tamanho de verdade do quadro (o texto não
// estica). Linha de 2 px, grade discreta, a cor diz se subiu ou caiu E a dica diz o número — a cor
// nunca é o único jeito de saber. Passar o dedo ou o mouse mostra a mira e o valor daquele ponto.

import { useEffect, useId, useRef, useState } from "react";
import { preco, pct, horaCurta, diaCurto, rumo } from "./formatos.js";

/** A largura do quadro, acompanhando a tela. */
function useLargura(minimo = 280) {
  const ref = useRef(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => setLargura(Math.max(minimo, Math.floor(el.clientWidth)));
    medir();
    const o = new ResizeObserver(medir);
    o.observe(el);
    return () => o.disconnect();
  }, [minimo]);
  return [ref, largura];
}

/** Quatro marcas "redondas" no eixo dos preços. */
function marcas(min, max, n = 4) {
  if (max <= min) return [min];
  const passo = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => min + passo * i);
}

/**
 * O dia hora a hora: a linha do preço desde a abertura (0 h) até agora, sobre o eixo do dia todo
 * (0 h a 24 h), com a abertura tracejada e o ponto de agora pulsando.
 */
export function GraficoDoDia({ horas, abertura, altura = 260, rotulo }) {
  const [ref, L] = useLargura();
  const [foco, setFoco] = useState(null);
  const idDaArea = `bx-area-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const A = altura;
  const m = { esq: 8, dir: 56, cima: 14, baixo: 26 };
  const precos = horas.map((h) => h.preco);
  let min = Math.min(abertura, ...precos), max = Math.max(abertura, ...precos);
  const folga = (max - min || max * 0.02 || 1) * 0.15;
  min -= folga; max += folga;
  const x = (h) => m.esq + (h / 24) * (L - m.esq - m.dir);
  const y = (p) => m.cima + ((max - p) / (max - min)) * (A - m.cima - m.baixo);
  const ultimo = horas[horas.length - 1];
  const tom = rumo(ultimo.preco - abertura);
  const linha = horas.map((h) => `${x(h.hora).toFixed(1)},${y(h.preco).toFixed(1)}`).join(" ");
  const area = `${x(horas[0].hora)},${A - m.baixo} ${linha} ${x(ultimo.hora)},${A - m.baixo}`;
  const f = foco != null ? horas[foco] : null;
  const mover = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const h = ((ev.clientX - r.left - m.esq) / (L - m.esq - m.dir)) * 24;
    setFoco(Math.max(0, Math.min(horas.length - 1, Math.round(h))));
  };
  return (
    <div ref={ref} className="bx-grafico">
      {L > 0 && (
        <svg width={L} height={A} className={`bx-grafico__svg bx-tom--${tom}`} role="img" aria-label={rotulo}
          onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setFoco(null)}>
          <defs>
            <linearGradient id={idDaArea} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {marcas(min + folga, max - folga).map((v) => (
            <g key={v}>
              <line className="bx-grade" x1={m.esq} x2={L - m.dir} y1={y(v)} y2={y(v)} />
              <text className="bx-eixo" x={L - m.dir + 6} y={y(v) + 4}>{preco(v)}</text>
            </g>
          ))}
          {(L < 520 ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24]).map((h) => (
            <text key={h} className="bx-eixo" x={x(h)} y={A - 8} textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"}>{horaCurta(h)}</text>
          ))}
          <line className="bx-abertura" x1={m.esq} x2={L - m.dir} y1={y(abertura)} y2={y(abertura)} />
          <text className="bx-eixo bx-eixo--abertura" x={m.esq + 4} y={y(abertura) - 5}>abertura {preco(abertura)}</text>
          <polygon points={area} fill={`url(#${idDaArea})`} />
          <polyline className="bx-linha" points={linha} />
          <circle className="bx-agora" cx={x(ultimo.hora)} cy={y(ultimo.preco)} r="9" />
          <circle className="bx-ponto" cx={x(ultimo.hora)} cy={y(ultimo.preco)} r="4.5" />
          {f && (
            <g>
              <line className="bx-mira" x1={x(f.hora)} x2={x(f.hora)} y1={m.cima} y2={A - m.baixo} />
              <circle className="bx-ponto bx-ponto--foco" cx={x(f.hora)} cy={y(f.preco)} r="5" />
            </g>
          )}
        </svg>
      )}
      {f && (
        <div className="bx-dica" style={{ left: Math.max(0, Math.min(L - 170, x(f.hora) - 70)) }}>
          <strong>{horaCurta(f.hora)}</strong> · 🪙 {preco(f.preco)} · <span className={`bx-txt--${rumo(f.preco - abertura)}`}>{pct(Math.round(((f.preco - abertura) / abertura) * 1000) / 10)}</span>
        </div>
      )}
    </div>
  );
}

/** As velas dos últimos dias: corpo da abertura ao fechamento, pavio da mínima à máxima. */
export function GraficoDeVelas({ velas, altura = 260, rotulo }) {
  const [ref, L] = useLargura();
  const [foco, setFoco] = useState(null);
  const A = altura;
  const m = { esq: 8, dir: 56, cima: 14, baixo: 26 };
  let min = Math.min(...velas.map((v) => v.minima)), max = Math.max(...velas.map((v) => v.maxima));
  const folga = (max - min || max * 0.02 || 1) * 0.12;
  min -= folga; max += folga;
  const n = Math.max(velas.length, 7);
  const vao = (L - m.esq - m.dir) / n;
  const x = (i) => m.esq + vao * (i + 0.5);
  const y = (p) => m.cima + ((max - p) / (max - min)) * (A - m.cima - m.baixo);
  const corpo = Math.max(4, Math.min(22, vao * 0.6));
  const f = foco != null ? velas[foco] : null;
  const mover = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    setFoco(Math.max(0, Math.min(velas.length - 1, Math.floor((ev.clientX - r.left - m.esq) / vao))));
  };
  return (
    <div ref={ref} className="bx-grafico">
      {L > 0 && (
        <svg width={L} height={A} className="bx-grafico__svg" role="img" aria-label={rotulo}
          onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setFoco(null)}>
          {marcas(min + folga, max - folga).map((v) => (
            <g key={v}>
              <line className="bx-grade" x1={m.esq} x2={L - m.dir} y1={y(v)} y2={y(v)} />
              <text className="bx-eixo" x={L - m.dir + 6} y={y(v) + 4}>{preco(v)}</text>
            </g>
          ))}
          {velas.map((v, i) => {
            const tom = rumo(v.fechamento - v.abertura);
            const topo = y(Math.max(v.abertura, v.fechamento)), base = y(Math.min(v.abertura, v.fechamento));
            return (
              <g key={v.dia} className={`bx-vela bx-tom--${tom}${foco === i ? " bx-vela--foco" : ""}`}>
                <line x1={x(i)} x2={x(i)} y1={y(v.maxima)} y2={y(v.minima)} />
                <rect x={x(i) - corpo / 2} y={topo} width={corpo} height={Math.max(2, base - topo)} rx="2" />
                {/* as datas contam a partir da última vela (a de hoje sempre aparece, sem encavalar) */}
                {(velas.length - 1 - i) % Math.ceil(velas.length / 7) === 0 && (
                  <text className="bx-eixo" x={x(i)} y={A - 8} textAnchor="middle">{diaCurto(v.dia)}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {f && (
        <div className="bx-dica" style={{ left: Math.max(0, Math.min(L - 250, x(foco) - 110)) }}>
          <strong>{diaCurto(f.dia)}</strong> · abriu {preco(f.abertura)} · máx {preco(f.maxima)} · mín {preco(f.minima)} · {foco === velas.length - 1 ? "agora" : "fechou"} {preco(f.fechamento)}{" "}
          <span className={`bx-txt--${rumo(f.fechamento - f.abertura)}`}>{pct(Math.round(((f.fechamento - f.abertura) / f.abertura) * 1000) / 10)}</span>
        </div>
      )}
    </div>
  );
}

/** O minigráfico da lista: só a linha do dia, sem eixo (o número está do lado). */
export function Mini({ horas, abertura, largura = 84, altura = 30 }) {
  const precos = horas.map((h) => h.preco);
  const min = Math.min(abertura, ...precos), max = Math.max(abertura, ...precos);
  const x = (h) => 2 + (h / 24) * (largura - 4);
  const y = (p) => 2 + (max === min ? (altura - 4) / 2 : ((max - p) / (max - min)) * (altura - 4));
  const tom = rumo(precos[precos.length - 1] - abertura);
  return (
    <svg width={largura} height={altura} className={`bx-mini bx-tom--${tom}`} aria-hidden="true">
      <line className="bx-abertura" x1="2" x2={largura - 2} y1={y(abertura)} y2={y(abertura)} />
      <polyline className="bx-linha" points={horas.map((h) => `${x(h.hora).toFixed(1)},${y(h.preco).toFixed(1)}`).join(" ")} />
    </svg>
  );
}
