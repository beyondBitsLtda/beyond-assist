"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";
import { drawDonut, drawLegend, drawLine, drawHBars } from "@/lib/arCanvasCharts.js";
import { CHART } from "@/lib/chartPalette.js";

const POLL_MS = 20000;
const MODEL_LABELS = { chat: "CHAT", tts: "VOZ (TTS)", embed: "EMBEDDINGS" };
const REASON_LABELS = { rpd: "cota diária", rpm: "cota por minuto", overload: "sobrecarga", unsupported: "modelo indisponível" };
const MODEL_CHART_COLORS = { chat: CHART.categorical[0], tts: CHART.categorical[1], embed: CHART.categorical[2] };

/** Canvas que se redesenha sozinho quando o container muda de tamanho (ResizeObserver) ou
 * quando `deps` muda — escala pro devicePixelRatio pra não ficar borrado em tela de alta
 * densidade (as primitivas de src/lib/arCanvasCharts.js foram feitas pra textura WebGL, sem
 * DPR nenhum, então essa escala fica por conta de quem desenha na TELA de verdade, aqui). */
function UsageChart({ height, draw, deps }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const render = () => {
      const w = container.clientWidth || 1;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);
      draw(ctx, w, height);
    };
    render();
    const ro = new ResizeObserver(render);
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

function fmtRemaining(ms) {
  if (ms <= 0) return "agora";
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Painel de gestão do pool de chaves do Gemini — "pra nunca mais ficar no escuro": mostra,
 * pra cada chave × modelo, se está disponível ou de cooldown (e por quanto tempo ainda),
 * lendo direto de gemini_key_health (ver /api/gemini-keys/status e src/lib/geminiKeyHealth.js).
 * NUNCA mostra as chaves em si — só a posição delas na lista (#1, #2...).
 */
export default function GeminiKeysPage() {
  const [data, setData] = useState(null);
  const [usage, setUsage] = useState(null); // consumo (gráficos) — separado do status/cooldown acima
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const [statusRes, usageRes] = await Promise.all([
        fetch("/api/gemini-keys/status").then((r) => r.json()),
        fetch("/api/gemini-keys/usage").then((r) => r.json()),
      ]);
      if (!statusRes.ok) throw new Error(statusRes.error || "falha ao carregar status");
      setData(statusRes);
      if (usageRes.ok) setUsage(usageRes); // consumo é só um extra visual — não trava o painel se falhar
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, POLL_MS); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []); // só pra recalcular os "volta em Xmin" ao vivo, sem rebuscar do servidor

  if (loading) {
    return <div style={{ padding: "24px 28px", ...mono, fontSize: 11, color: "rgba(207,239,251,0.5)" }}>carregando…</div>;
  }
  if (error) {
    return <div style={{ padding: "24px 28px", ...mono, fontSize: 11, color: OR }}>⚠ {error}</div>;
  }

  const { keyCount, models, health } = data;
  const modelKeys = Object.keys(models); // ["chat","tts","embed"]

  // saúde indexada por `${key_index}:${model}` pra lookup rápido na matriz
  const healthMap = new Map();
  for (const row of health) healthMap.set(`${row.key_index}:${row.model}`, row);

  const cellFor = (keyIndex, modelKey) => {
    const modelName = models[modelKey];
    const row = healthMap.get(`${keyIndex}:${modelName}`);
    if (!row || !row.cooldown_until) return { available: true };
    const untilMs = new Date(row.cooldown_until).getTime();
    if (untilMs <= now) return { available: true };
    return { available: false, remaining: untilMs - now, reason: row.reason, lastError: row.last_error, updatedAt: row.updated_at };
  };

  // resumo por modelo: quantas chaves disponíveis AGORA
  const summary = modelKeys.map((mk) => {
    let free = 0;
    for (let i = 0; i < keyCount; i++) if (cellFor(i, mk).available) free++;
    return { key: mk, label: MODEL_LABELS[mk] || mk, free, total: keyCount };
  });

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ CHAVES GEMINI · GESTÃO DO POOL</div>
        <button
          onClick={load}
          style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(var(--accent-rgb),0.06)", color: "#eafcff", cursor: "pointer" }}
        >
          ↻ ATUALIZAR
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        {summary.map((s) => (
          <div key={s.key} style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: "14px 16px", background: "linear-gradient(160deg, rgba(var(--accent-rgb),0.04), rgba(0,0,0,0.2))" }}>
            <div style={{ ...mono, fontSize: 9.5, letterSpacing: 2, color: "rgba(207,239,251,0.55)", marginBottom: 8 }}>{s.label}</div>
            <div style={{ ...mono, fontSize: 26, fontWeight: 700, color: s.free > 0 ? GR : OR }}>{s.free}<span style={{ fontSize: 14, color: "rgba(207,239,251,0.4)" }}>/{s.total}</span></div>
            <div style={{ fontSize: 11, color: "rgba(207,239,251,0.5)", marginTop: 4 }}>chaves disponíveis agora</div>
          </div>
        ))}
      </div>

      {usage && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(207,239,251,0.55)", marginBottom: 10 }}>
            ◈ CONSUMO · ÚLTIMOS 14 DIAS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(260px, 1.4fr)", gap: 14, marginBottom: 14 }}>
            <div style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: 14, background: "rgba(0,0,0,0.2)" }}>
              <div style={{ ...mono, fontSize: 9.5, letterSpacing: 1.5, color: "rgba(207,239,251,0.45)", marginBottom: 6 }}>POR MODELO</div>
              <UsageChart
                height={260}
                deps={[usage.byModel]}
                draw={(ctx, w, h) => {
                  const rows = usage.byModel
                    .filter((m) => m.total > 0)
                    .map((m) => ({ label: MODEL_LABELS[m.key] || m.key, value: m.total, color: MODEL_CHART_COLORS[m.key] || CHART.categorical[3] }));
                  drawDonut(ctx, Math.min(140, w * 0.35), h / 2, Math.min(95, w * 0.3), Math.min(58, w * 0.18), rows);
                  drawLegend(ctx, Math.min(140, w * 0.35) * 2 - 20, 40, h - 60, rows, (v) => String(v));
                }}
              />
            </div>
            <div style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: 14, background: "rgba(0,0,0,0.2)" }}>
              <div style={{ ...mono, fontSize: 9.5, letterSpacing: 1.5, color: "rgba(207,239,251,0.45)", marginBottom: 6 }}>NO TEMPO (sucesso × falha)</div>
              <UsageChart
                height={260}
                deps={[usage.daily]}
                draw={(ctx, w, h) => {
                  const points = usage.daily.map((d) => ({ x: d.day.slice(5), values: { success: d.success, fail: d.fail } }));
                  drawLine(ctx, 10, 20, w - 20, h - 30, points, [
                    { key: "success", name: "sucesso", color: CHART.status.good },
                    { key: "fail", name: "falha", color: CHART.status.critical },
                  ]);
                }}
              />
            </div>
          </div>
          <div style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: 14, background: "rgba(0,0,0,0.2)" }}>
            <div style={{ ...mono, fontSize: 9.5, letterSpacing: 1.5, color: "rgba(207,239,251,0.45)", marginBottom: 6 }}>POR CHAVE</div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <UsageChart
                height={Math.max(120, usage.byKey.filter((k) => k.total > 0).length * 28)}
                deps={[usage.byKey]}
                draw={(ctx, w, h) => {
                  const used = usage.byKey.filter((k) => k.total > 0).sort((a, b) => b.total - a.total);
                  const rows = used.map((k) => ({ label: `chave #${k.keyIndex + 1}`, values: [k.success, k.fail] }));
                  drawHBars(ctx, 10, 14, w - 20, h - 14, rows, [
                    { name: "sucesso", color: CHART.status.good },
                    { name: "falha", color: CHART.status.critical },
                  ]);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto", border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...mono, fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "10px 14px", color: "rgba(207,239,251,0.5)", borderBottom: "1px solid rgba(var(--accent-rgb),0.14)", fontWeight: 400, position: "sticky", left: 0, background: "#0a1216" }}>chave</th>
              {modelKeys.map((mk) => (
                <th key={mk} style={{ textAlign: "left", padding: "10px 14px", color: "rgba(207,239,251,0.5)", borderBottom: "1px solid rgba(var(--accent-rgb),0.14)", fontWeight: 400, whiteSpace: "nowrap" }}>
                  {MODEL_LABELS[mk] || mk}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: keyCount }, (_, i) => (
              <tr key={i}>
                <td style={{ padding: "10px 14px", color: "#eafcff", borderBottom: "1px solid rgba(var(--accent-rgb),0.08)", position: "sticky", left: 0, background: "#05080a" }}>
                  chave #{i + 1}
                </td>
                {modelKeys.map((mk) => {
                  const cell = cellFor(i, mk);
                  return (
                    <td key={mk} style={{ padding: "10px 14px", borderBottom: "1px solid rgba(var(--accent-rgb),0.08)", whiteSpace: "nowrap" }}>
                      {cell.available ? (
                        <span style={{ color: GR }}>✅ disponível</span>
                      ) : (
                        <span
                          title={cell.lastError || ""}
                          style={{ color: OR, cursor: cell.lastError ? "help" : "default" }}
                        >
                          🔴 volta em {fmtRemaining(cell.remaining)}
                          <span style={{ color: "rgba(207,239,251,0.45)" }}> · {REASON_LABELS[cell.reason] || cell.reason || "erro"}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ ...mono, fontSize: 9.5, color: "rgba(207,239,251,0.4)", marginTop: 14, lineHeight: 1.6 }}>
        "cota diária" fica de cooldown por ~12h (aproximação segura pro reset do Google); "cota por
        minuto" e "sobrecarga" voltam bem mais rápido; "modelo indisponível" significa que aquela
        chave/projeto não tem acesso a esse modelo específico (pode ser definitivo, não só cota).
        Chaves sem nenhuma falha registrada aparecem sempre como disponíveis — nunca tentadas
        ainda não é o mesmo que confirmadas boas.
      </div>
    </div>
  );
}
