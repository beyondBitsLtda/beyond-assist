"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CY = "#38e1ff";
const OR = "#ff9d3d";
const GR = "#7bd88f";
const PU = "#c9a6ff";

const MODE_META = {
  idle: { label: "IDLE", sub: "awaiting command", color: CY },
  listening: { label: "LISTENING", sub: "retrieving context", color: GR },
  speaking: { label: "SPEAKING", sub: "streaming response", color: OR },
};

const pad = (n) => String(n).padStart(2, "0");
const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export default function Page() {
  const [mode, setMode] = useState("idle");
  const [clock, setClock] = useState(fmtClock(new Date()));
  const [uptime, setUptime] = useState("00:00:00");
  const [logs, setLogs] = useState([
    { id: 1, t: fmtClock(new Date()), tag: "[BOOT]", color: CY, msg: "core online · pgvector ready" },
    { id: 2, t: fmtClock(new Date()), tag: "[RAG]", color: CY, msg: "index warm · dim=768" },
  ]);
  const [cards, setCards] = useState([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conn, setConn] = useState({ supabase: null, trello: null, gemini: null });
  const [ingesting, setIngesting] = useState(false);

  const canvasRef = useRef(null);
  const modeRef = useRef(mode);
  const startRef = useRef(Date.now());
  const logIdRef = useRef(100);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  const addLog = useCallback((tag, color, msg) => {
    const line = { id: ++logIdRef.current, t: fmtClock(new Date()), tag, color, msg };
    setLogs((s) => [...s, line].slice(-11));
  }, []);

  // clock + uptime
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      const up = Math.floor((Date.now() - startRef.current) / 1000);
      setClock(fmtClock(d));
      setUptime(`${pad(Math.floor(up / 3600))}:${pad(Math.floor(up / 60) % 60)}:${pad(up % 60)}`);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // health check → bolinhas de conexão
  useEffect(() => {
    let alive = true;
    fetch("/api/health")
      .then((r) => r.json())
      .then((s) => { if (alive) setConn(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // canvas visualizer (porta do mockup)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let cw = 0, ch = 0, raf = 0, phase = 0;
    const NB = 96;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(1, r.width * dpr);
      cv.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cw = r.width; ch = r.height;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const draw = () => {
      const w = cw, h = ch, cx = w / 2, cy = h / 2;
      const base = Math.min(w, h) * 0.26;
      ctx.clearRect(0, 0, w, h);
      const m = modeRef.current;
      const now = performance.now() / 1000;

      let amp, speed, coreGlow;
      if (m === "idle") { amp = 0.1; speed = 0.6; coreGlow = 0.5 + 0.2 * Math.sin(now * 1.6); }
      else if (m === "listening") { amp = 0.42; speed = 2.2; coreGlow = 0.75 + 0.2 * Math.sin(now * 6); }
      else { amp = 0.72; speed = 3.6; coreGlow = 0.9; }
      phase += 0.016 * speed;

      for (let i = 0; i < NB; i++) {
        const ang = (i / NB) * Math.PI * 2;
        const seed = i * 0.35;
        let mag = Math.sin(seed * 1.3 + phase * 2.1) * 0.5
                + Math.sin(seed * 2.7 - phase * 1.4) * 0.3
                + Math.sin(seed * 0.7 + phase * 3.3) * 0.2;
        mag = (mag + 1) / 2;
        if (m === "idle") mag = 0.15 + mag * 0.12;
        const len = base * (0.14 + mag * amp);
        const x1 = cx + Math.cos(ang) * base, y1 = cy + Math.sin(ang) * base;
        const x2 = cx + Math.cos(ang) * (base + len), y2 = cy + Math.sin(ang) * (base + len);
        const g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, "rgba(56,225,255,0.85)");
        g.addColorStop(1, mag > 0.7 ? "rgba(255,157,61,0.95)" : "rgba(56,225,255,0.15)");
        ctx.strokeStyle = g; ctx.lineWidth = 2.2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }

      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 0.95);
      gr.addColorStop(0, `rgba(56,225,255,${0.3 * coreGlow})`);
      gr.addColorStop(0.5, `rgba(56,225,255,${0.1 * coreGlow})`);
      gr.addColorStop(1, "rgba(56,225,255,0)");
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(cx, cy, base * 0.95, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = `rgba(56,225,255,${0.55 + coreGlow * 0.4})`;
      ctx.lineWidth = 1.6; ctx.shadowBlur = 18; ctx.shadowColor = CY;
      ctx.beginPath(); ctx.arc(cx, cy, base * 0.7, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;

      if (m !== "idle") {
        const rings = m === "speaking" ? 3 : 2;
        for (let k = 0; k < rings; k++) {
          const prog = ((now * (m === "speaking" ? 1.1 : 0.7) + k / rings) % 1);
          const rr = base * (0.7 + prog * 1.5);
          ctx.strokeStyle = `rgba(56,225,255,${(1 - prog) * 0.35})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
        }
      }

      ctx.strokeStyle = "rgba(56,225,255,0.25)"; ctx.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 + now * 0.05;
        const r0 = base * 1.55, r1 = base * (i % 5 === 0 ? 1.66 : 1.6);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  // ---- reindexar via /api/ingest em fatias (cabe em 60s por chamada) ----
  const reindex = useCallback(async () => {
    if (ingesting) return;
    setIngesting(true);

    const secret = typeof window !== "undefined" ? (localStorage.getItem("ingestSecret") || "") : "";
    const headers = secret ? { "x-ingest-secret": secret } : {};
    const boardCount = 4; // TRELLO_BOARD_IDS tem 4 boards
    const steps = [
      ...Array.from({ length: boardCount }, (_, i) => ({ label: `trello board ${i + 1}/${boardCount}`, url: `/api/ingest?source=trello&boardIndex=${i}` })),
      { label: "brain (notas)", url: `/api/ingest?source=brain` },
    ];

    let totalChunks = 0;
    for (const step of steps) {
      addLog("[INGEST]", OR, `→ ${step.label}…`);
      try {
        const res = await fetch(step.url, { method: "POST", headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          addLog("[INGEST]", OR, `✗ ${step.label}: ${data.errors?.[0] || res.status}`);
          continue;
        }
        totalChunks += data.chunks || 0;
        addLog("[INGEST]", GR, `✓ ${step.label}: ${data.docs} docs · ${data.chunks} chunks`);
      } catch (err) {
        addLog("[INGEST]", OR, `✗ ${step.label}: ${err.message}`);
      }
    }
    addLog("[INGEST]", CY, `finalizado · total ${totalChunks} chunks indexados`);
    setIngesting(false);
  }, [ingesting, addLog]);

  // ---- pergunta real ao backend (SSE) ----
  const ask = useCallback(async (q) => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setQuestion(q);
    setAnswer("");
    setCards([]);
    setMode("listening");
    addLog("[EMBED]", GR, "query → vector [768d]");
    addLog("[RAG]", CY, "similarity search · top_k");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          let event = "message", data = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          let payload;
          try { payload = JSON.parse(data); } catch { payload = data; }

          if (event === "context") {
            setCards(payload || []);
            addLog("[MATCH]", GR, `${(payload || []).length} cards recuperados`);
            setMode("speaking");
            addLog("[GEMINI]", OR, "streaming tokens");
          } else if (event === "token") {
            setAnswer((a) => a + payload);
          } else if (event === "error") {
            addLog("[ERR]", OR, String(payload?.message || payload));
            setAnswer((a) => a + `\n[erro: ${payload?.message || payload}]`);
          } else if (event === "done") {
            addLog("[STATE]", CY, "core → IDLE · standby");
          }
        }
      }
    } catch (err) {
      addLog("[ERR]", OR, err.message);
      setAnswer(`Falha ao consultar o backend: ${err.message}`);
    } finally {
      setBusy(false);
      setMode("idle");
    }
  }, [busy, addLog]);

  const meterFor = (pct) => {
    const filled = Math.round((pct || 0) / 10);
    return "█".repeat(filled) + "░".repeat(10 - filled);
  };

  const meta = MODE_META[mode];
  const transcript =
    mode === "speaking" || answer
      ? answer || "…"
      : mode === "listening"
      ? `"${question}"`
      : 'Standby. Digite uma pergunta abaixo e pressione Enter. (voz "Beyond" chega na Fase 4)';

  const connList = [
    { label: "SUPABASE", ok: conn.supabase },
    { label: "TRELLO", ok: conn.trello },
    { label: "GEMINI", ok: conn.gemini },
  ];
  const dotColor = (ok) => (ok == null ? "rgba(207,239,251,0.35)" : ok ? GR : OR);

  const mono = { fontFamily: "'JetBrains Mono',monospace" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", fontFamily: "'Rajdhani',sans-serif", color: "#cfeffb", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* ambient grid + glow */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(56,225,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(56,225,255,0.035) 1px, transparent 1px)", backgroundSize: "44px 44px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "-25%", left: "50%", transform: "translateX(-50%)", width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,225,255,0.10), transparent 62%)", pointerEvents: "none" }} />

      {/* TOP BAR */}
      <header style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 26px", borderBottom: "1px solid rgba(56,225,255,0.16)", background: "linear-gradient(180deg, rgba(6,20,26,0.6), transparent)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 26, height: 26, border: "1.5px solid #38e1ff", borderRadius: "50%", boxShadow: "0 0 14px rgba(56,225,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 9, height: 9, background: CY, borderRadius: "50%", boxShadow: "0 0 8px #38e1ff" }} />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: 4, color: "#eafcff", lineHeight: 1 }}>BEYOND&nbsp;BITS</div>
            <div style={{ ...mono, fontSize: 9, letterSpacing: 3, color: "rgba(56,225,255,0.6)", marginTop: 3 }}>J.A.R.V.I.S. ASSISTANT INTERFACE</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, ...mono, fontSize: 10, letterSpacing: 1 }}>
          <div style={{ textAlign: "right", marginRight: 8 }}>
            <div style={{ color: "#eafcff", fontSize: 15, letterSpacing: 2 }}>{clock}</div>
            <div style={{ color: "rgba(56,225,255,0.5)", fontSize: 9, letterSpacing: 2 }}>SYS.UPTIME {uptime}</div>
          </div>
          {connList.map((c) => (
            <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", border: "1px solid rgba(56,225,255,0.18)", borderRadius: 3, background: "rgba(56,225,255,0.03)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor(c.ok), boxShadow: `0 0 8px ${dotColor(c.ok)}`, animation: "bb-dot 1.8s ease-in-out infinite" }} />
              <span style={{ color: "#bfe8f5" }}>{c.label}</span>
            </div>
          ))}
          <button
            onClick={reindex}
            disabled={ingesting}
            title="Reindexar Trello + Beyond Brain (roda na Vercel)"
            style={{ ...mono, display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", border: `1px solid ${ingesting ? OR : CY}`, borderRadius: 3, background: "rgba(56,225,255,0.06)", color: ingesting ? OR : "#eafcff", cursor: ingesting ? "wait" : "pointer", fontSize: 10, letterSpacing: 2 }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: ingesting ? OR : CY, boxShadow: `0 0 8px ${ingesting ? OR : CY}`, animation: ingesting ? "bb-dot 0.9s ease-in-out infinite" : "none" }} />
            {ingesting ? "SYNCING…" : "◈ SYNC"}
          </button>
        </div>
      </header>

      {/* MAIN GRID */}
      <main style={{ position: "relative", zIndex: 2, flex: 1, display: "grid", gridTemplateColumns: "minmax(220px,320px) minmax(0,1fr) minmax(280px,360px)", minHeight: 0 }}>
        {/* LEFT: LOGS */}
        <aside style={{ borderRight: "1px solid rgba(56,225,255,0.12)", display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, background: "linear-gradient(90deg, rgba(6,18,24,0.35), transparent)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(56,225,255,0.1)" }}>
            <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ SYSTEM_LOGS</div>
            <div style={{ ...mono, fontSize: 9, color: "rgba(255,157,61,0.85)", animation: "bb-flicker 2s infinite" }}>● LIVE</div>
          </div>
          <div style={{ flex: 1, overflow: "hidden", padding: "12px 14px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 7 }}>
            {logs.map((log) => (
              <div key={log.id} style={{ ...mono, fontSize: 10.5, lineHeight: 1.45, animation: "bb-slidein .35s ease" }}>
                <span style={{ color: "rgba(255,255,255,0.32)" }}>{log.t}</span>
                <span style={{ color: log.color, margin: "0 5px" }}>{log.tag}</span>
                <span style={{ color: "#a9cede" }}>{log.msg}</span>
              </div>
            ))}
            <div style={{ ...mono, fontSize: 10.5, color: CY }}>&gt;<span style={{ display: "inline-block", width: 7, height: 13, background: CY, marginLeft: 4, verticalAlign: "middle", animation: "bb-blink 1s step-end infinite" }} /></div>
          </div>
        </aside>

        {/* CENTER: VISUALIZER */}
        <section style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 0, minWidth: 0 }}>
          <div style={{ position: "relative", width: "min(52vh,520px)", height: "min(52vh,520px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", inset: "-6%", border: "1px solid rgba(56,225,255,0.12)", borderRadius: "50%", borderTopColor: "rgba(56,225,255,0.45)", borderRightColor: "rgba(56,225,255,0.28)", animation: "bb-sweep 14s linear infinite" }} />
            <div style={{ position: "absolute", inset: "4%", border: "1px dashed rgba(255,157,61,0.18)", borderRadius: "50%", animation: "bb-sweep 22s linear infinite reverse" }} />
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            <div style={{ position: "relative", textAlign: "center", pointerEvents: "none" }}>
              <div style={{ ...mono, fontSize: 11, letterSpacing: 5, color: meta.color }}>{meta.label}</div>
              <div style={{ fontSize: 13, letterSpacing: 2, color: "rgba(207,239,251,0.55)", marginTop: 6, ...mono }}>{meta.sub}</div>
            </div>
          </div>
          <div style={{ marginTop: 26, width: "min(80%,560px)", textAlign: "center" }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: 3, color: "rgba(56,225,255,0.5)", marginBottom: 8 }}>↳ INTENT INTERPRETATION</div>
            <div style={{ fontSize: 19, lineHeight: 1.4, color: "#eafcff", fontWeight: 500, letterSpacing: 0.4, whiteSpace: "pre-wrap" }}>{transcript}</div>
          </div>
        </section>

        {/* RIGHT: CONTEXT */}
        <aside style={{ borderLeft: "1px solid rgba(56,225,255,0.12)", display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, background: "linear-gradient(270deg, rgba(6,18,24,0.35), transparent)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(56,225,255,0.1)" }}>
            <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ RETRIEVED_CONTEXT</div>
            <div style={{ ...mono, fontSize: 9, color: "rgba(56,225,255,0.5)" }}>pgvector · {cards.length} matches</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {cards.length === 0 && (
              <div style={{ ...mono, fontSize: 10.5, color: "rgba(207,239,251,0.4)", padding: "6px 2px" }}>
                aguardando primeira consulta…
              </div>
            )}
            {cards.map((c, i) => {
              const brain = c.source === "BRAIN";
              const accent = brain ? PU : CY;
              const edge = brain ? "rgba(201,166,255,0.32)" : "rgba(56,225,255,0.3)";
              return (
                <div key={i} style={{ flex: "none", border: `1px solid ${edge}`, borderRadius: 6, padding: "13px 14px", background: "linear-gradient(160deg, rgba(56,225,255,0.05), rgba(0,0,0,0.2))", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accent, boxShadow: `0 0 10px ${accent}` }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ ...mono, fontSize: 8.5, letterSpacing: 2, padding: "3px 7px", border: `1px solid ${edge}`, borderRadius: 3, color: accent, background: "rgba(0,0,0,0.3)" }}>{c.source}</span>
                    <span style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.4)" }}>{c.board}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#eafcff", letterSpacing: 0.3, lineHeight: 1.25 }}>{c.title}</div>
                  <div style={{ fontSize: 12.5, color: "rgba(169,206,222,0.8)", marginTop: 5, lineHeight: 1.4 }}>{c.snippet}</div>
                  <div style={{ ...mono, fontSize: 9, color: "rgba(56,225,255,0.55)", marginTop: 9 }}>SIM {meterFor(c.pct)} {c.sim}</div>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 9, paddingTop: 9, borderTop: "1px dashed rgba(56,225,255,0.14)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: OR, boxShadow: "0 0 7px #ff9d3d" }} />
                    <span style={{ ...mono, fontSize: 9, letterSpacing: 1, color: "rgba(255,157,61,0.85)" }}>LAST_MODIFIED</span>
                    <span style={{ ...mono, fontSize: 10, color: "#ffbe7a", marginLeft: "auto", whiteSpace: "nowrap" }}>{c.modified}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </main>

      {/* BOTTOM COMMAND BAR */}
      <footer style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 18, padding: "14px 26px", borderTop: "1px solid rgba(56,225,255,0.16)", background: "linear-gradient(0deg, rgba(6,20,26,0.6), transparent)" }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: 3, color: "rgba(56,225,255,0.5)" }}>STATE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 5, border: `1px solid ${meta.color}`, color: meta.color }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
          <span style={{ fontWeight: 600, letterSpacing: 1.5, fontSize: 13 }}>{meta.label}</span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", border: "1px solid rgba(56,225,255,0.18)", borderRadius: 5, background: "rgba(56,225,255,0.03)", ...mono }}>
          <span style={{ color: CY, fontSize: 13 }}>&gt;_</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) { ask(input); setInput(""); }
            }}
            disabled={busy}
            placeholder={busy ? "processando…" : 'pergunte algo sobre seus quadros / notas…'}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#eafcff", fontSize: 12, letterSpacing: 0.5 }}
          />
        </div>
        <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(56,225,255,0.4)" }}>GEMINI · SUPABASE · TRELLO</div>
      </footer>
    </div>
  );
}
