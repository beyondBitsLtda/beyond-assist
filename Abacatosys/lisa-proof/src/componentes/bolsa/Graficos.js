"use client";

// Os gráficos da Bolsa do Reino, em SVG desenhado no tamanho de verdade do quadro (o texto não
// estica). Linha de 2 px, grade discreta, a cor diz se subiu ou caiu E a dica diz o número — a cor
// nunca é o único jeito de saber. Passar o dedo ou o mouse mostra a mira e o valor daquele ponto.
//
// AS PREVISÕES DOS CONSULTORES (26/10/2026: "eles devem oferecer uma visão do gráfico da ação com
// as previsões de todos os pregões, de todas as ações, de todas as horas, igual ao gráfico, só que
// traçando uma previsão"): no dia, uma linha tracejada por consultor, da abertura às 17h, com o rosto
// dele na ponta; nas velas, o fechamento que cada um projetou em cada pregão. A linha de verdade
// continua cheia, por cima. Como as seis linhas se cruzam, a cor nunca está sozinha: o rosto na
// ponta, a legenda com os apelidos e a dica com os números.

import { useEffect, useId, useRef, useState } from "react";
import { preco, pct, horaCurta, diaCurto, rumo } from "./formatos.js";
import { ABRE_AS, FECHA_AS, PASSOS_DO_DIA } from "@/dominio/bolsa.js";
import { Rosto } from "./Consultores.js";

/** Onde fica a hora `h` no eixo do pregão (0 = abertura, 1 = fechamento). */
const noPregao = (h) => (h - ABRE_AS) / PASSOS_DO_DIA;
const variacao = (de, para) => (de ? Math.round(((para - de) / de) * 1000) / 10 : 0);

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

/** Os rostos na ponta das linhas, afastados para não ficarem um em cima do outro. */
function afastar(pontos, folga, topo, base) {
  const ordem = [...pontos].sort((a, b) => a.y - b.y);
  for (let i = 1; i < ordem.length; i++) ordem[i].y = Math.max(ordem[i].y, ordem[i - 1].y + folga);
  const passou = ordem.length ? ordem[ordem.length - 1].y - base : 0;
  if (passou > 0) for (const p of ordem) p.y -= passou;
  for (let i = ordem.length - 2; i >= 0; i--) ordem[i].y = Math.min(ordem[i].y, ordem[i + 1].y - folga);
  for (const p of ordem) p.y = Math.max(topo, p.y);
  return ordem;
}

/** A dica com a lista das previsões de um ponto (a de verdade primeiro). */
function ListaDaDica({ titulo, real, itens, base }) {
  return (
    <>
      <strong>{titulo}</strong>
      {real && <span className="bx-dica__linha"><span className="bx-dica__real" aria-hidden="true" />{real.rotulo} <b>🪙 {preco(real.valor)}</b> <span className={`bx-txt--${rumo(real.valor - base)}`}>{pct(variacao(base, real.valor))}</span></span>}
      {itens.map((it) => (
        <span key={it.id} className="bx-dica__linha">
          <span className="bx-dica__cor" style={{ background: it.cor }} aria-hidden="true" />{it.apelido} <b>🪙 {preco(it.valor)}</b> <span className={`bx-txt--${rumo(it.valor - base)}`}>{pct(variacao(base, it.valor))}</span>
        </span>
      ))}
    </>
  );
}

/**
 * O dia hora a hora: a linha do preço desde a abertura (07h) até agora, sobre o eixo do pregão
 * todo (07h a 17h), com a abertura tracejada e o ponto de agora pulsando — e, se vierem
 * `previsoes` ([{ id, apelido, cor, horas }]), a previsão de cada consultor para todas as horas.
 */
export function GraficoDoDia({ horas, abertura, altura = 260, rotulo, previsoes = [] }) {
  const [ref, L] = useLargura();
  const [foco, setFoco] = useState(null);
  const idDaArea = `bx-area-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const A = altura;
  const comPrevisoes = previsoes.length > 0;
  const m = { esq: 8, dir: comPrevisoes ? 74 : 56, cima: 14, baixo: 26 };
  const precos = [...horas.map((h) => h.preco), ...previsoes.flatMap((p) => p.horas)];
  let min = Math.min(abertura, ...precos), max = Math.max(abertura, ...precos);
  const folga = (max - min || max * 0.02 || 1) * 0.15;
  min -= folga; max += folga;
  const x = (h) => m.esq + noPregao(h) * (L - m.esq - m.dir);
  const y = (p) => m.cima + ((max - p) / (max - min)) * (A - m.cima - m.baixo);
  const ultimo = horas[horas.length - 1];
  const tom = rumo(ultimo.preco - abertura);
  const linha = horas.map((h) => `${x(h.hora).toFixed(1)},${y(h.preco).toFixed(1)}`).join(" ");
  const area = `${x(horas[0].hora)},${A - m.baixo} ${linha} ${x(ultimo.hora)},${A - m.baixo}`;
  const ultimoPasso = comPrevisoes ? PASSOS_DO_DIA : horas.length - 1;
  const f = foco != null ? { hora: ABRE_AS + foco, real: horas[foco] } : null;
  const mover = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const passo = ((ev.clientX - r.left - m.esq) / (L - m.esq - m.dir)) * PASSOS_DO_DIA;
    setFoco(Math.max(0, Math.min(ultimoPasso, Math.round(passo))));
  };
  const pontas = L > 0 ? afastar(previsoes.map((p) => ({ id: p.id, y: y(p.horas[p.horas.length - 1]) })), 22, m.cima, A - m.baixo) : [];
  return (
    <div ref={ref} className="bx-grafico">
      {L > 0 && (
        <svg width={L} height={A} className={`bx-grafico__svg bx-tom--${tom}`} role="img"
          aria-label={comPrevisoes ? `${rotulo}; com as previsões de ${previsoes.map((p) => p.apelido).join(", ")} até as ${horaCurta(FECHA_AS)}` : rotulo}
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
              <text className="bx-eixo" x={L - m.dir + (comPrevisoes ? 18 : 6)} y={y(v) + 4}>{preco(v)}</text>
            </g>
          ))}
          {(L < 520 ? [ABRE_AS, 12, FECHA_AS] : [ABRE_AS, 9, 11, 13, 15, FECHA_AS]).map((h) => (
            <text key={h} className="bx-eixo" x={x(h)} y={A - 8} textAnchor={h === ABRE_AS ? "start" : h === FECHA_AS ? "end" : "middle"}>{horaCurta(h)}</text>
          ))}
          <line className="bx-abertura" x1={m.esq} x2={L - m.dir} y1={y(abertura)} y2={y(abertura)} />
          <text className="bx-eixo bx-eixo--abertura" x={m.esq + 4} y={y(abertura) - 5}>abertura {preco(abertura)}</text>
          {previsoes.map((p) => (
            <polyline key={p.id} className="bx-previsao" style={{ stroke: p.cor }}
              points={p.horas.map((v, i) => `${x(ABRE_AS + i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} />
          ))}
          <polygon points={area} fill={`url(#${idDaArea})`} />
          <polyline className="bx-linha" points={linha} />
          <circle className="bx-agora" cx={x(ultimo.hora)} cy={y(ultimo.preco)} r="9" />
          <circle className="bx-ponto" cx={x(ultimo.hora)} cy={y(ultimo.preco)} r="4.5" />
          {f && (
            <g>
              <line className="bx-mira" x1={x(f.hora)} x2={x(f.hora)} y1={m.cima} y2={A - m.baixo} />
              {previsoes.map((p) => <circle key={p.id} className="bx-previsao__ponto" style={{ fill: p.cor }} cx={x(f.hora)} cy={y(p.horas[foco])} r="4" />)}
              {f.real && <circle className="bx-ponto bx-ponto--foco" cx={x(f.hora)} cy={y(f.real.preco)} r="5" />}
            </g>
          )}
        </svg>
      )}
      {pontas.map((pt) => (
        <span key={pt.id} className="bx-previsao__rosto" style={{ left: x(FECHA_AS), top: pt.y }}>
          <Rosto id={pt.id} tamanho={20} />
        </span>
      ))}
      {f && (comPrevisoes || f.real) && (
        <div className={`bx-dica${comPrevisoes ? " bx-dica--lista" : ""}`} style={{ left: Math.max(0, Math.min(L - (comPrevisoes ? 190 : 170), x(f.hora) - (comPrevisoes ? 95 : 70))) }}>
          {comPrevisoes ? (
            <ListaDaDica titulo={horaCurta(f.hora)} base={abertura}
              real={f.real ? { rotulo: f.real.hora === ultimo.hora && horas.length <= PASSOS_DO_DIA ? "agora" : "cotação", valor: f.real.preco } : null}
              itens={previsoes.map((p) => ({ id: p.id, apelido: p.apelido, cor: p.cor, valor: p.horas[foco] })).sort((a, b) => b.valor - a.valor)} />
          ) : (
            <><strong>{horaCurta(f.hora)}</strong> · 🪙 {preco(f.real.preco)} · <span className={`bx-txt--${rumo(f.real.preco - abertura)}`}>{pct(variacao(abertura, f.real.preco))}</span></>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * As velas dos últimos dias: corpo da abertura ao fechamento, pavio da mínima à máxima — e, se
 * vierem `previsoes` ([{ id, apelido, cor, porDia: { dia: preço } }]), o fechamento que cada
 * consultor projetou para cada pregão, numa coluna de pontos ao lado da vela.
 */
export function GraficoDeVelas({ velas, altura = 260, rotulo, previsoes = [] }) {
  const [ref, L] = useLargura();
  const [foco, setFoco] = useState(null);
  const A = altura;
  const m = { esq: 8, dir: 56, cima: 14, baixo: 26 };
  const projetados = previsoes.flatMap((p) => velas.map((v) => p.porDia[v.dia]).filter((v) => v != null));
  let min = Math.min(...velas.map((v) => v.minima), ...projetados), max = Math.max(...velas.map((v) => v.maxima), ...projetados);
  const folga = (max - min || max * 0.02 || 1) * 0.12;
  min -= folga; max += folga;
  const n = Math.max(velas.length, 7);
  const vao = (L - m.esq - m.dir) / n;
  const x = (i) => m.esq + vao * (i + 0.5);
  const y = (p) => m.cima + ((max - p) / (max - min)) * (A - m.cima - m.baixo);
  const corpo = Math.max(4, Math.min(22, vao * (previsoes.length ? 0.45 : 0.6)));
  // de quantas em quantas velas vai a data: até 7 datas, e só as que cabem (uns 44 px cada)
  const pulo = Math.ceil(velas.length / Math.max(1, Math.min(7, Math.floor((L - m.esq - m.dir) / (44 * Math.max(1, n / velas.length))))));
  const f = foco != null ? velas[foco] : null;
  const ehHoje = foco === velas.length - 1;
  const mover = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    setFoco(Math.max(0, Math.min(velas.length - 1, Math.floor((ev.clientX - r.left - m.esq) / vao))));
  };
  const daVela = (v) => previsoes.filter((p) => p.porDia[v.dia] != null);
  return (
    <div ref={ref} className="bx-grafico">
      {L > 0 && (
        <svg width={L} height={A} className="bx-grafico__svg" role="img"
          aria-label={previsoes.length ? `${rotulo}; com o fechamento que ${previsoes.map((p) => p.apelido).join(", ")} projetaram para cada pregão` : rotulo}
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
            const cx = previsoes.length ? x(i) - corpo / 2 - 1 : x(i);
            return (
              <g key={v.dia} className={`bx-vela bx-tom--${tom}${foco === i ? " bx-vela--foco" : ""}`}>
                <line x1={cx} x2={cx} y1={y(v.maxima)} y2={y(v.minima)} />
                <rect x={cx - corpo / 2} y={topo} width={corpo} height={Math.max(2, base - topo)} rx="2" />
                {/* as datas contam a partir da última vela (a de hoje sempre aparece, sem encavalar) */}
                {(velas.length - 1 - i) % pulo === 0 && (
                  <text className="bx-eixo" x={x(i)} y={A - 8} textAnchor="middle">{diaCurto(v.dia)}</text>
                )}
              </g>
            );
          })}
          {velas.map((v, i) => daVela(v).map((p) => (
            <circle key={`${v.dia}-${p.id}`} className="bx-previsao__ponto" style={{ fill: p.cor }} cx={x(i) + 4} cy={y(p.porDia[v.dia])} r={foco === i ? 4.5 : 3.5} />
          )))}
        </svg>
      )}
      {f && (
        <div className={`bx-dica${previsoes.length ? " bx-dica--lista" : ""}`} style={{ left: Math.max(0, Math.min(L - 250, x(foco) - 110)) }}>
          {previsoes.length ? (
            <ListaDaDica titulo={`${diaCurto(f.dia)} · abriu ${preco(f.abertura)} · máx ${preco(f.maxima)} · mín ${preco(f.minima)}`} base={f.abertura}
              real={{ rotulo: ehHoje ? "agora" : "fechou", valor: f.fechamento }}
              itens={daVela(f).map((p) => ({ id: p.id, apelido: p.apelido, cor: p.cor, valor: p.porDia[f.dia] })).sort((a, b) => b.valor - a.valor)} />
          ) : (
            <>
              <strong>{diaCurto(f.dia)}</strong> · abriu {preco(f.abertura)} · máx {preco(f.maxima)} · mín {preco(f.minima)} · {ehHoje ? "agora" : "fechou"} {preco(f.fechamento)}{" "}
              <span className={`bx-txt--${rumo(f.fechamento - f.abertura)}`}>{pct(variacao(f.abertura, f.fechamento))}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** O minigráfico da lista: só a linha do dia, sem eixo (o número está do lado). */
export function Mini({ horas, abertura, largura = 84, altura = 30 }) {
  const precos = horas.map((h) => h.preco);
  const min = Math.min(abertura, ...precos), max = Math.max(abertura, ...precos);
  const x = (h) => 2 + noPregao(h) * (largura - 4);
  const y = (p) => 2 + (max === min ? (altura - 4) / 2 : ((max - p) / (max - min)) * (altura - 4));
  const tom = rumo(precos[precos.length - 1] - abertura);
  return (
    <svg width={largura} height={altura} className={`bx-mini bx-tom--${tom}`} aria-hidden="true">
      <line className="bx-abertura" x1="2" x2={largura - 2} y1={y(abertura)} y2={y(abertura)} />
      <polyline className="bx-linha" points={horas.map((h) => `${x(h.hora).toFixed(1)},${y(h.preco).toFixed(1)}`).join(" ")} />
    </svg>
  );
}
