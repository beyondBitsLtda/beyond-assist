"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, GR, mono } from "@/lib/theme.js";

export default function BoardsOverviewPage() {
  const [boards, setBoards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/boards-overview");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setBoards(data.boards || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // atualiza sozinho de tempos em tempos — agora que lê direto do Trello (sem SYNC/embeddings),
  // é rápido e barato o bastante pra não precisar de clique manual.
  useEffect(() => {
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ VISÃO GERAL · OUTROS BOARDS</div>
        <button
          onClick={load}
          disabled={loading}
          title="Busca direto do Trello (ao vivo) — atualiza sozinho a cada 1 min também"
          style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(56,225,255,0.06)", color: "#eafcff", cursor: loading ? "wait" : "pointer" }}
        >
          {loading ? "…" : "↻ ATUALIZAR"}
        </button>
      </div>

      {error && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 16 }}>⚠ {error}</div>}

      <div className="bb-chart-grid">
        {(boards || []).map((b) => (
          <div key={b.board} style={{ border: "1px solid rgba(56,225,255,0.18)", borderRadius: 8, padding: "16px 18px", background: "linear-gradient(160deg, rgba(56,225,255,0.05), rgba(0,0,0,0.2))" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#eafcff" }}>{b.board}</div>
            <div style={{ ...mono, fontSize: 10, color: "rgba(207,239,251,0.5)", marginTop: 4 }}>
              {b.total} cards · <span style={{ color: GR }}>{b.open} abertos</span> · {b.done} concluídos
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {b.lists.map((l) => (
                <div key={l.list} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...mono, fontSize: 10 }}>
                  <span style={{ color: "rgba(207,239,251,0.7)" }}>{l.list}</span>
                  <span style={{ color: CY }}>{l.count}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!loading && boards && boards.length === 0 && !error && (
          <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)" }}>nenhum outro board indexado ainda.</div>
        )}
      </div>
    </div>
  );
}
