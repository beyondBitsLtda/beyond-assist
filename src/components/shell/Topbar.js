"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLog } from "./LogProvider.js";
import { CY, OR, GR, mono, dotColor } from "@/lib/theme.js";

const pad = (n) => String(n).padStart(2, "0");
const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/**
 * Barra superior compartilhada por todos os painéis: relógio/uptime, bolinhas de conexão
 * (Supabase/Trello/Gemini) e o botão SYNC (reindexação completa) — migrados de page.js,
 * porque agora são relevantes pra todos os painéis, não só o Assistente.
 */
export default function Topbar() {
  const { addLog } = useLog();
  const [clock, setClock] = useState(fmtClock(new Date()));
  const [uptime, setUptime] = useState("00:00:00");
  const [conn, setConn] = useState({ supabase: null, trello: null, gemini: null });
  const [ingesting, setIngesting] = useState(false);
  const startRef = useRef(Date.now());

  // relógio + uptime
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

  // ---- reindexar via /api/ingest em fatias com paginação (respeita quota Gemini) ----
  const reindex = useCallback(async () => {
    if (ingesting) return;
    setIngesting(true);

    const secret = typeof window !== "undefined" ? (localStorage.getItem("ingestSecret") || "") : "";
    const headers = secret ? { "x-ingest-secret": secret } : {};
    const boardCount = 4;
    const sources = [
      ...Array.from({ length: boardCount }, (_, i) => ({ label: `board ${i + 1}/${boardCount}`, source: "trello", extra: `&boardIndex=${i}` })),
      { label: "brain (notas)", source: "brain", extra: "" },
    ];

    let grandTotal = 0;
    for (const src of sources) {
      let offset = 0;
      let pageNum = 1;
      while (true) {
        addLog("[INGEST]", OR, `→ ${src.label} · fatia ${pageNum} (offset ${offset})…`);
        try {
          const res = await fetch(`/api/ingest?source=${src.source}${src.extra}&offset=${offset}`, {
            method: "POST",
            headers,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            addLog("[INGEST]", OR, `✗ ${src.label}: ${data.errors?.[0]?.slice(0, 80) || res.status}`);
            break;
          }
          grandTotal += data.chunks_processed || 0;
          addLog("[INGEST]", GR, `✓ ${src.label} f${pageNum}: ${data.chunks_processed}/${data.chunks_total} chunks`);
          if (data.done) break;
          offset = data.next_offset;
          pageNum++;
        } catch (err) {
          addLog("[INGEST]", OR, `✗ ${src.label}: ${err.message}`);
          break;
        }
      }
    }
    addLog("[INGEST]", CY, `finalizado · ${grandTotal} chunks indexados`);
    setIngesting(false);
  }, [ingesting, addLog]);

  const connList = [
    { label: "SUPABASE", ok: conn.supabase },
    { label: "TRELLO", ok: conn.trello },
    { label: "GEMINI", ok: conn.gemini },
  ];

  return (
    <header
      style={{
        position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "flex-end",
        padding: "14px 26px", borderBottom: "1px solid rgba(56,225,255,0.16)",
        background: "linear-gradient(180deg, rgba(6,20,26,0.6), transparent)",
      }}
    >
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
  );
}
