"use client";

import { useRef, useState } from "react";
import { CY, mono } from "@/lib/theme.js";

const W = 600, H = 220, PAD_L = 30, PAD_R = 10, PAD_T = 14, PAD_B = 22;
const PLOT_W = W - PAD_L - PAD_R, PLOT_H = H - PAD_T - PAD_B;

/**
 * Gráfico de linha, somente-leitura — a forma certa pra "tendência ao longo do tempo"
 * (o único caso onde a skill de dataviz recomenda linha antes de qualquer outra coisa).
 * Multi-série, crosshair com tooltip no hover, legenda quando há ≥2 séries, área leve
 * quando é só uma série.
 *
 * points: [{ x: string, values: { [seriesKey]: number } }] — mesmo eixo X pra todas as séries.
 * series: [{ key, name, color }]
 */
export default function LineChart({ title, points, series, formatValue = (n) => String(n) }) {
  const [showTable, setShowTable] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  const maxY = Math.max(1, ...points.flatMap((p) => series.map((s) => p.values[s.key] || 0)));
  const stepX = points.length > 1 ? PLOT_W / (points.length - 1) : 0;
  const xAt = (i) => PAD_L + i * stepX;
  const yAt = (v) => PAD_T + PLOT_H - (v / maxY) * PLOT_H;

  const linePath = (s) => points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.values[s.key] || 0).toFixed(1)}`).join(" ");
  const areaPath = (s) => `${linePath(s)} L ${xAt(points.length - 1).toFixed(1)} ${yAt(0)} L ${xAt(0).toFixed(1)} ${yAt(0)} Z`;

  const handleMove = (e) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let idx = stepX > 0 ? Math.round((relX - PAD_L) / stepX) : 0;
    idx = Math.max(0, Math.min(points.length - 1, idx));
    setHoverIdx(idx);
  };

  // no máximo ~6 rótulos no eixo X, senão lota de texto ilegível
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const yTicks = [0, 0.5, 1];

  return (
    <div style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: "16px 18px", background: "linear-gradient(160deg, rgba(var(--accent-rgb),0.04), rgba(0,0,0,0.2))" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ ...mono, fontSize: 10.5, letterSpacing: 2, color: CY }}>{title}</div>
        <button
          onClick={() => setShowTable((s) => !s)}
          style={{ ...mono, fontSize: 8.5, letterSpacing: 1, padding: "4px 9px", border: "1px solid rgba(var(--accent-rgb),0.2)", borderRadius: 3, background: "transparent", color: "rgba(207,239,251,0.6)", cursor: "pointer" }}
        >
          {showTable ? "◈ gráfico" : "▤ tabela"}
        </button>
      </div>

      {series.length >= 2 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
          {series.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 2, borderRadius: 1, background: s.color, display: "inline-block" }} />
              <span style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.7)" }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}

      {points.length === 0 ? (
        <div style={{ ...mono, fontSize: 10.5, color: "rgba(207,239,251,0.4)" }}>sem dados ainda.</div>
      ) : showTable ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", ...mono, fontSize: 10.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "rgba(207,239,251,0.5)", borderBottom: "1px solid rgba(var(--accent-rgb),0.14)", fontWeight: 400 }}>data</th>
                {series.map((s) => (
                  <th key={s.key} style={{ textAlign: "right", padding: "4px 6px", color: "rgba(207,239,251,0.5)", borderBottom: "1px solid rgba(var(--accent-rgb),0.14)", fontWeight: 400 }}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.x}>
                  <td style={{ padding: "5px 6px", color: "#eafcff" }}>{p.x}</td>
                  {series.map((s) => (
                    <td key={s.key} style={{ padding: "5px 6px", textAlign: "right", color: "rgba(207,239,251,0.8)" }}>{formatValue(p.values[s.key] || 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {yTicks.map((f) => (
              <line key={f} x1={PAD_L} x2={W - PAD_R} y1={PAD_T + PLOT_H * (1 - f)} y2={PAD_T + PLOT_H * (1 - f)} stroke="rgba(207,239,251,0.08)" strokeWidth={1} />
            ))}
            <text x={PAD_L - 4} y={PAD_T + 4} textAnchor="end" style={{ fill: "rgba(207,239,251,0.4)", fontSize: 8, fontFamily: "'JetBrains Mono',monospace" }}>{formatValue(maxY)}</text>
            <text x={PAD_L - 4} y={PAD_T + PLOT_H} textAnchor="end" style={{ fill: "rgba(207,239,251,0.4)", fontSize: 8, fontFamily: "'JetBrains Mono',monospace" }}>0</text>

            {series.length === 1 && <path d={areaPath(series[0])} fill={series[0].color} opacity={0.1} />}

            {series.map((s) => (
              <path key={s.key} d={linePath(s)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}

            {hoverIdx != null && (
              <>
                <line x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={PAD_T} y2={PAD_T + PLOT_H} stroke="rgba(207,239,251,0.25)" strokeWidth={1} />
                {series.map((s) => (
                  <circle key={s.key} cx={xAt(hoverIdx)} cy={yAt(points[hoverIdx].values[s.key] || 0)} r={4} fill={s.color} stroke="#0a0f12" strokeWidth={2} />
                ))}
              </>
            )}

            {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (
              <text key={i} x={xAt(i)} y={H - 6} textAnchor="middle" style={{ fill: "rgba(207,239,251,0.4)", fontSize: 8, fontFamily: "'JetBrains Mono',monospace" }}>{p.x}</text>
            ))}
          </svg>

          {hoverIdx != null && (
            <div
              style={{
                position: "absolute", left: `${(xAt(hoverIdx) / W) * 100}%`, top: 4, transform: "translateX(-50%)",
                ...mono, fontSize: 9, padding: "6px 10px", borderRadius: 4, background: "#0a1216",
                border: "1px solid rgba(var(--accent-rgb),0.3)", whiteSpace: "nowrap", pointerEvents: "none", zIndex: 5,
              }}
            >
              <div style={{ color: "#eafcff", marginBottom: 3 }}>{points[hoverIdx].x}</div>
              {series.map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 8, height: 2, background: s.color, display: "inline-block" }} />
                  <span style={{ color: "rgba(207,239,251,0.7)" }}>{s.name}:</span>
                  <strong style={{ color: "#eafcff" }}>{formatValue(points[hoverIdx].values[s.key] || 0)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
