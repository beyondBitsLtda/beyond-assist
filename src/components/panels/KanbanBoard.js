"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";

function fmtDue(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(d);
}

function isOverdue(card) {
  if (!card.due || card.due_complete) return false;
  return new Date(card.due).getTime() < Date.now();
}

/**
 * Kanban somente-leitura de um board do Trello: colunas = listas, na ordem real do board.
 * Auto-contido (busca os próprios dados) — dá pra reaproveitar passando outro `board`.
 */
export default function KanbanBoard({ board }) {
  const [columns, setColumns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/kanban?board=${encodeURIComponent(board)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setColumns(data.columns || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [board]);

  useEffect(() => { load(); }, [load]);

  const totalCards = columns ? columns.reduce((n, c) => n + c.cards.length, 0) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid rgba(56,225,255,0.1)" }}>
        <div>
          <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ {board.toUpperCase()}</div>
          <div style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.4)", marginTop: 4 }}>
            {columns ? `${totalCards} cards · ${columns.length} listas` : "carregando…"}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          title="Recarrega esta tela com o que já está indexado (não busca no Trello agora — pra isso, use o SYNC no topo)"
          style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(56,225,255,0.06)", color: "#eafcff", cursor: loading ? "wait" : "pointer" }}
        >
          {loading ? "…" : "↻ ATUALIZAR"}
        </button>
      </div>

      {error && <div style={{ ...mono, fontSize: 11, color: OR, padding: "16px 24px" }}>⚠ {error}</div>}

      <div style={{ flex: 1, minHeight: 0, overflowX: "auto", overflowY: "hidden", padding: "18px 24px", display: "flex", gap: 16, alignItems: "flex-start" }}>
        {(columns || []).map((col) => (
          <div key={col.list} className="bb-kanban-col" style={{ flex: "none", height: "100%", display: "flex", flexDirection: "column", border: "1px solid rgba(56,225,255,0.14)", borderRadius: 8, background: "rgba(56,225,255,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(56,225,255,0.1)" }}>
              <span style={{ ...mono, fontSize: 10.5, letterSpacing: 1.5, color: "#eafcff" }}>{col.list}</span>
              <span style={{ ...mono, fontSize: 9, color: "rgba(56,225,255,0.5)" }}>{col.cards.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {col.cards.map((card) => {
                const overdue = isOverdue(card);
                const due = fmtDue(card.due);
                return (
                  <a
                    key={card.id}
                    href={card.url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "block", border: `1px solid ${overdue ? "rgba(255,157,61,0.4)" : "rgba(56,225,255,0.18)"}`, borderRadius: 6, padding: "10px 12px", background: "rgba(0,0,0,0.25)", textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#eafcff", lineHeight: 1.3 }}>{card.title}</div>
                    {card.labels && (
                      <div style={{ ...mono, fontSize: 8.5, color: PU, marginTop: 6 }}>{card.labels}</div>
                    )}
                    {due && (
                      <div style={{ ...mono, fontSize: 9, marginTop: 6, color: card.due_complete ? GR : overdue ? OR : "rgba(56,225,255,0.6)" }}>
                        {card.due_complete ? "✓ concluído" : overdue ? `⚠ venceu ${due}` : `prazo ${due}`}
                      </div>
                    )}
                  </a>
                );
              })}
              {col.cards.length === 0 && (
                <div style={{ ...mono, fontSize: 9.5, color: "rgba(207,239,251,0.3)", padding: "8px 4px" }}>vazio</div>
              )}
            </div>
          </div>
        ))}
        {!loading && columns && columns.length === 0 && !error && (
          <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)" }}>nenhum card encontrado nesse board.</div>
        )}
      </div>
    </div>
  );
}
