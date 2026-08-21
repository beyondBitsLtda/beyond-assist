"use client";

import { useState } from "react";
import { CY, mono } from "@/lib/theme.js";
import { CHART } from "@/lib/chartPalette.js";

const BAR_H = 20; // ≤24px por spec da skill dataviz

/**
 * Gráfico de barras horizontais, somente-leitura: 1 ou 2 séries por linha,
 * legenda quando há ≥2 séries, valor direto na ponta de cada barra, tooltip
 * de hover/foco, e alternância pra visão em tabela (par de acessibilidade
 * de todo gráfico, por instrução da skill dataviz).
 *
 * rows: [{ key, label, values: number[], flag?: "critical" }]
 * series: [{ key, name, color }] — mesmo comprimento de values em cada row.
 */
export default function HBarChart({ title, rows, series, formatValue = (n) => String(n) }) {
  const [showTable, setShowTable] = useState(false);
  const [hoverKey, setHoverKey] = useState(null);

  const maxValue = Math.max(1, ...rows.flatMap((r) => r.values));

  return (
    <div style={{ border: "1px solid rgba(56,225,255,0.16)", borderRadius: 8, padding: "16px 18px", background: "linear-gradient(160deg, rgba(56,225,255,0.04), rgba(0,0,0,0.2))" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ ...mono, fontSize: 10.5, letterSpacing: 2, color: CY }}>{title}</div>
        <button
          onClick={() => setShowTable((s) => !s)}
          style={{ ...mono, fontSize: 8.5, letterSpacing: 1, padding: "4px 9px", border: "1px solid rgba(56,225,255,0.2)", borderRadius: 3, background: "transparent", color: "rgba(207,239,251,0.6)", cursor: "pointer" }}
        >
          {showTable ? "◈ gráfico" : "▤ tabela"}
        </button>
      </div>

      {series.length >= 2 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
          {series.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 3, borderRadius: 2, background: s.color, display: "inline-block" }} />
              <span style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.7)" }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ ...mono, fontSize: 10.5, color: "rgba(207,239,251,0.4)" }}>sem dados ainda.</div>
      ) : showTable ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", ...mono, fontSize: 10.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "rgba(207,239,251,0.5)", borderBottom: "1px solid rgba(56,225,255,0.14)", fontWeight: 400 }}>painel</th>
                {series.map((s) => (
                  <th key={s.key} style={{ textAlign: "right", padding: "4px 6px", color: "rgba(207,239,251,0.5)", borderBottom: "1px solid rgba(56,225,255,0.14)", fontWeight: 400 }}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={{ padding: "5px 6px", color: "#eafcff" }}>{r.label}</td>
                  {r.values.map((v, i) => (
                    <td key={i} style={{ padding: "5px 6px", textAlign: "right", color: "rgba(207,239,251,0.8)" }}>{formatValue(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {rows.map((row) => (
            <div key={row.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                {row.flag === "critical" && (
                  <span title="Atrasada" style={{ color: CHART.status.critical, fontSize: 11, lineHeight: 1 }}>⚠</span>
                )}
                <span style={{ ...mono, fontSize: 10, color: "rgba(207,239,251,0.75)" }}>{row.label}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {row.values.map((v, i) => {
                  const s = series[i];
                  const color = row.flag === "critical" && i === 0 ? CHART.status.critical : s.color;
                  const pct = v > 0 ? Math.max(3, (v / maxValue) * 100) : 0;
                  const hkey = `${row.key}:${i}`;
                  const hovered = hoverKey === hkey;
                  return (
                    <div
                      key={s.key}
                      tabIndex={0}
                      role="img"
                      aria-label={`${row.label}, ${s.name}: ${formatValue(v)}`}
                      onMouseEnter={() => setHoverKey(hkey)}
                      onMouseLeave={() => setHoverKey(null)}
                      onFocus={() => setHoverKey(hkey)}
                      onBlur={() => setHoverKey(null)}
                      style={{ position: "relative", display: "flex", alignItems: "center", height: BAR_H, outline: "none" }}
                    >
                      <div
                        style={{
                          height: BAR_H, width: `${pct}%`, minWidth: v > 0 ? 4 : 0, background: color,
                          borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 4, borderBottomRightRadius: 4,
                          filter: hovered ? "brightness(1.3)" : "none", transition: "filter .15s, width .4s ease",
                        }}
                      />
                      <span style={{ ...mono, fontSize: 9.5, marginLeft: 8, color: "rgba(207,239,251,0.6)", whiteSpace: "nowrap" }}>{formatValue(v)}</span>
                      {hovered && (
                        <div
                          style={{
                            position: "absolute", left: 0, bottom: "100%", marginBottom: 4, zIndex: 5,
                            ...mono, fontSize: 9, padding: "5px 9px", borderRadius: 4,
                            background: "#0a1216", border: "1px solid rgba(56,225,255,0.3)", whiteSpace: "nowrap",
                          }}
                        >
                          <strong style={{ color: "#eafcff" }}>{formatValue(v)}</strong>{" "}
                          <span style={{ color: "rgba(207,239,251,0.6)" }}>{s.name} · {row.label}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
