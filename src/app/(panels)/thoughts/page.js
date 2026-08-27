"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, PU, mono } from "@/lib/theme.js";

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).format(d);
}

const PAGE_SIZE = 30;

export default function ThoughtsPage() {
  const [thoughts, setThoughts] = useState([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (offset, replace) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/thoughts?limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setThoughts((prev) => (replace ? data.thoughts : [...prev, ...data.thoughts]));
      setNextOffset(data.next_offset);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0, true); }, [load]);

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ PENSAMENTOS REGISTRADOS</div>
        <button
          onClick={() => load(0, true)}
          disabled={loading}
          title="Recarrega esta tela (já é lida direto do banco, sempre atual)"
          style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(56,225,255,0.06)", color: "#eafcff", cursor: loading ? "wait" : "pointer" }}
        >
          {loading ? "…" : "↻ ATUALIZAR"}
        </button>
      </div>

      {error && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 16 }}>⚠ {error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {thoughts.map((t) => (
          <div key={t.id} style={{ border: "1px solid rgba(201,166,255,0.28)", borderRadius: 6, padding: "14px 16px", background: "linear-gradient(160deg, rgba(201,166,255,0.05), rgba(0,0,0,0.2))" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "#eafcff" }}>{t.subject}</div>
              <div style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.4)", flex: "none" }}>{fmtDate(t.created_at)}</div>
            </div>
            {t.moment && <div style={{ ...mono, fontSize: 9.5, color: PU, marginTop: 4 }}>{t.moment}</div>}
            {t.body && <div style={{ fontSize: 12.5, color: "rgba(207,239,251,0.8)", marginTop: 8, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{t.body}</div>}
            {t.ref && <div style={{ ...mono, fontSize: 9, color: "rgba(56,225,255,0.5)", marginTop: 8 }}>#{t.ref}</div>}
          </div>
        ))}
        {!loading && thoughts.length === 0 && !error && (
          <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)" }}>nenhum pensamento registrado ainda.</div>
        )}
      </div>

      {nextOffset != null && (
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button
            onClick={() => load(nextOffset, false)}
            disabled={loading}
            style={{ ...mono, fontSize: 9.5, letterSpacing: 1.5, padding: "8px 16px", border: "1px solid rgba(56,225,255,0.25)", borderRadius: 4, background: "transparent", color: "rgba(207,239,251,0.7)", cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "carregando…" : "carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}
