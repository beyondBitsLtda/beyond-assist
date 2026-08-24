"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, PU, mono } from "@/lib/theme.js";
import { CHART } from "@/lib/chartPalette.js";
import SentinelTicketDetail from "./SentinelTicketDetail.js";

const PRIORITY_COLOR = {
  "Baixa": CHART.status.good,
  "Média": CHART.status.warning,
  "Alta": CHART.status.serious,
  "Crítica": CHART.status.critical,
};

/** Kanban de chamados de suporte, somente leitura: colunas = status, na ordem do fluxo. */
export default function SentinelKanban({ project }) {
  const [columns, setColumns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sentinel/kanban?project=${encodeURIComponent(project || "all")}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setColumns(data.columns || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => { load(); }, [load]);

  const totalTickets = columns ? columns.reduce((n, c) => n + c.tickets.length, 0) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 24px" }}>
        <div style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.4)" }}>
          {columns ? `${totalTickets} chamados · ${columns.length} status` : "carregando…"}
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(56,225,255,0.06)", color: "#eafcff", cursor: loading ? "wait" : "pointer" }}
        >
          {loading ? "…" : "↻ ATUALIZAR"}
        </button>
      </div>

      {error && <div style={{ ...mono, fontSize: 11, color: OR, padding: "0 24px 12px" }}>⚠ {error}</div>}

      <div style={{ flex: 1, minHeight: 0, overflowX: "auto", overflowY: "hidden", padding: "0 24px 18px", display: "flex", gap: 16, alignItems: "flex-start" }}>
        {(columns || []).map((col) => (
          <div key={col.status} className="bb-kanban-col" style={{ flex: "none", height: "100%", display: "flex", flexDirection: "column", border: "1px solid rgba(56,225,255,0.14)", borderRadius: 8, background: "rgba(56,225,255,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(56,225,255,0.1)" }}>
              <span style={{ ...mono, fontSize: 10.5, letterSpacing: 1.5, color: "#eafcff" }}>{col.status}</span>
              <span style={{ ...mono, fontSize: 9, color: "rgba(56,225,255,0.5)" }}>{col.tickets.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {col.tickets.map((t) => {
                const breached = t.response_breached || t.resolution_breached;
                const priorityColor = PRIORITY_COLOR[t.priority] || "rgba(207,239,251,0.5)";
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    title="Clique pra ver o chamado completo"
                    style={{ border: `1px solid ${breached ? "rgba(255,157,61,0.4)" : "rgba(56,225,255,0.18)"}`, borderRadius: 6, padding: "10px 12px", background: "rgba(0,0,0,0.25)", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ ...mono, fontSize: 8.5, color: "rgba(207,239,251,0.4)" }}>#{t.display_id}</span>
                      {t.priority && (
                        <span style={{ ...mono, fontSize: 8, padding: "1px 6px", borderRadius: 3, color: priorityColor, border: `1px solid ${priorityColor}` }}>{t.priority}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#eafcff", lineHeight: 1.3 }}>{t.title}</div>
                    {t.project && (
                      <div style={{ ...mono, fontSize: 8.5, color: PU, marginTop: 6 }}>{t.project}</div>
                    )}
                    {t.assignee && (
                      <div style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.5)", marginTop: 4 }}>@ {t.assignee}</div>
                    )}
                    {breached && (
                      <div style={{ ...mono, fontSize: 9, marginTop: 6, color: OR }}>
                        ⚠ SLA{t.response_breached ? " de resposta" : ""}{t.response_breached && t.resolution_breached ? " e" : ""}{t.resolution_breached ? " de resolução" : ""} estourado
                      </div>
                    )}
                  </div>
                );
              })}
              {col.tickets.length === 0 && (
                <div style={{ ...mono, fontSize: 9.5, color: "rgba(207,239,251,0.3)", padding: "8px 4px" }}>vazio</div>
              )}
            </div>
          </div>
        ))}
        {!loading && columns && columns.length === 0 && !error && (
          <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)" }}>nenhum chamado encontrado.</div>
        )}
      </div>

      {selectedId && (
        <SentinelTicketDetail ticketId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
