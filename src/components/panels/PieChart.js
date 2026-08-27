"use client";

import { useState } from "react";
import { CY, mono } from "@/lib/theme.js";
import { CHART } from "@/lib/chartPalette.js";

/**
 * Gráfico de pizza (donut), somente-leitura. A skill de dataviz recomenda barra
 * empilhada pra "parte do todo" (mais fácil de comparar por olho) e deprioriza donut —
 * mas aqui a variedade visual importa de propósito (painel pensado pra ficar ligado
 * numa TV, não pra análise fina), então incluído com o mesmo par de acessibilidade
 * (legenda + tabela) do HBarChart.
 *
 * rows: [{ key, label, value }] — cor atribuída em ordem fixa da paleta categórica.
 */
export default function PieChart({ title, rows, formatValue = (n) => String(n) }) {
  const [showTable, setShowTable] = useState(false);
  const [hoverKey, setHoverKey] = useState(null);

  const total = rows.reduce((s, r) => s + r.value, 0);
  const colored = rows.map((r, i) => ({ ...r, color: CHART.categorical[i % CHART.categorical.length] }));

  const R = 70, r = 42, cx = 90, cy = 90;
  const gapRad = colored.length > 1 ? 0.025 : 0;
  let angle = -Math.PI / 2;
  const slices = colored.map((row) => {
    const frac = total > 0 ? row.value / total : 0;
    const start = angle + gapRad / 2;
    const end = angle + frac * Math.PI * 2 - gapRad / 2;
    angle += frac * Math.PI * 2;
    return { ...row, start: Math.min(start, end), end: Math.max(start, end), frac };
  });

  const arcPath = (start, end) => {
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end), y2 = cy + R * Math.sin(end);
    const ix1 = cx + r * Math.cos(end), iy1 = cy + r * Math.sin(end);
    const ix2 = cx + r * Math.cos(start), iy2 = cy + r * Math.sin(start);
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2} Z`;
  };

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

      {rows.length === 0 || total === 0 ? (
        <div style={{ ...mono, fontSize: 10.5, color: "rgba(207,239,251,0.4)" }}>sem dados ainda.</div>
      ) : showTable ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", ...mono, fontSize: 10.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "rgba(207,239,251,0.5)", borderBottom: "1px solid rgba(var(--accent-rgb),0.14)", fontWeight: 400 }}>categoria</th>
                <th style={{ textAlign: "right", padding: "4px 6px", color: "rgba(207,239,251,0.5)", borderBottom: "1px solid rgba(var(--accent-rgb),0.14)", fontWeight: 400 }}>valor</th>
                <th style={{ textAlign: "right", padding: "4px 6px", color: "rgba(207,239,251,0.5)", borderBottom: "1px solid rgba(var(--accent-rgb),0.14)", fontWeight: 400 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((s) => (
                <tr key={s.key}>
                  <td style={{ padding: "5px 6px", color: "#eafcff" }}>{s.label}</td>
                  <td style={{ padding: "5px 6px", textAlign: "right", color: "rgba(207,239,251,0.8)" }}>{formatValue(s.value)}</td>
                  <td style={{ padding: "5px 6px", textAlign: "right", color: "rgba(207,239,251,0.8)" }}>{Math.round(s.frac * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <svg width="150" height="150" viewBox="0 0 180 180" style={{ flex: "none" }}>
            {slices.map((s) => (
              <path
                key={s.key}
                d={arcPath(s.start, s.end)}
                fill={s.color}
                opacity={hoverKey && hoverKey !== s.key ? 0.45 : 1}
                onMouseEnter={() => setHoverKey(s.key)}
                onMouseLeave={() => setHoverKey(null)}
                onFocus={() => setHoverKey(s.key)}
                onBlur={() => setHoverKey(null)}
                tabIndex={0}
                role="img"
                aria-label={`${s.label}: ${formatValue(s.value)}, ${Math.round(s.frac * 100)} por cento`}
                style={{ cursor: "pointer", transition: "opacity .15s", outline: "none" }}
              />
            ))}
            <text x={cx} y={cy - 3} textAnchor="middle" style={{ fill: "#eafcff", fontSize: 22, fontWeight: 700, fontFamily: "inherit" }}>{total}</text>
            <text x={cx} y={cy + 15} textAnchor="middle" style={{ fill: "rgba(207,239,251,0.5)", fontSize: 9, fontFamily: "'JetBrains Mono',monospace" }}>total</text>
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1, minWidth: 150 }}>
            {slices.map((s) => (
              <div
                key={s.key}
                onMouseEnter={() => setHoverKey(s.key)}
                onMouseLeave={() => setHoverKey(null)}
                style={{ display: "flex", alignItems: "center", gap: 8, opacity: hoverKey && hoverKey !== s.key ? 0.45 : 1, transition: "opacity .15s", cursor: "default" }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flex: "none" }} />
                <span style={{ ...mono, fontSize: 10, color: "rgba(207,239,251,0.8)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                <span style={{ ...mono, fontSize: 10, color: "#eafcff", flex: "none" }}>{formatValue(s.value)} · {Math.round(s.frac * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
