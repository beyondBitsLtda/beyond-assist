"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, PU, GR, mono } from "@/lib/theme.js";
import { CHART } from "@/lib/chartPalette.js";

const PRIORITY_COLOR = {
  "Baixa": CHART.status.good,
  "Média": CHART.status.warning,
  "Alta": CHART.status.serious,
  "Crítica": CHART.status.critical,
};

// mesma ordem de src/lib/sentinel.js (STATUS_ORDER) — duplicado aqui de propósito: esse
// arquivo é client-side e não pode importar sentinel.js (que puxa o cliente service_role).
const STATUS_ORDER = ["Aberto", "Aguardando Cliente", "Resolvido", "Fechado"];

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(d);
}

/** Modal de detalhe de um chamado: descrição completa, mudança de status e histórico de comentários. */
export default function SentinelTicketDetail({ ticketId, onClose, onStatusChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setLoading(true);
    setError(null);
    fetch(`/api/sentinel/ticket?id=${encodeURIComponent(ticketId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (!d.ok) throw new Error(d.error || "falha ao carregar");
        setData(d);
      })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ticketId]);

  const ticket = data?.ticket;
  const comments = data?.comments || [];
  const priorityColor = ticket ? (PRIORITY_COLOR[ticket.priority] || "rgba(207,239,251,0.5)") : CY;

  const changeStatus = useCallback(async (newStatus) => {
    if (statusBusy || !ticket || newStatus === ticket.status) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      const res = await fetch("/api/sentinel/ticket", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ticket.id, status: newStatus }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setData((prev) => ({ ...prev, ticket: { ...prev.ticket, ...d.ticket } }));
      onStatusChanged?.(ticket.id, newStatus);
    } catch (err) {
      setStatusError(err.message);
    } finally {
      setStatusBusy(false);
    }
  }, [statusBusy, ticket, onStatusChanged]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(680px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column", border: "1px solid rgba(56,225,255,0.25)", borderRadius: 10, background: "#08131a", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(56,225,255,0.14)" }}>
          <div style={{ ...mono, fontSize: 10.5, letterSpacing: 2, color: CY }}>◈ CHAMADO {ticket ? `#${ticket.display_id}` : ""}</div>
          <button
            onClick={onClose}
            style={{ ...mono, fontSize: 10, padding: "5px 10px", border: "1px solid rgba(56,225,255,0.2)", borderRadius: 4, background: "transparent", color: "rgba(207,239,251,0.6)", cursor: "pointer" }}
          >
            ✕ fechar
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {loading && <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.5)" }}>carregando…</div>}
          {error && <div style={{ ...mono, fontSize: 11, color: OR }}>⚠ {error}</div>}

          {ticket && (
            <>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#eafcff", lineHeight: 1.3 }}>{ticket.title}</div>

              <div style={{ ...mono, fontSize: 9, letterSpacing: 1.5, color: "rgba(56,225,255,0.5)", marginTop: 14, marginBottom: 6 }}>STATUS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {STATUS_ORDER.map((s) => {
                  const active = s === ticket.status;
                  return (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      disabled={statusBusy || active}
                      style={{
                        ...mono, fontSize: 9.5, letterSpacing: 1, padding: "6px 11px", borderRadius: 4,
                        border: `1px solid ${active ? CY : "rgba(56,225,255,0.22)"}`,
                        background: active ? "rgba(56,225,255,0.14)" : "transparent",
                        color: active ? "#eafcff" : "rgba(207,239,251,0.6)",
                        cursor: statusBusy ? "wait" : active ? "default" : "pointer",
                      }}
                    >
                      {statusBusy && !active ? "…" : s}
                    </button>
                  );
                })}
              </div>
              {statusError && <div style={{ ...mono, fontSize: 10, color: OR, marginTop: 6 }}>⚠ {statusError}</div>}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                {ticket.priority && (
                  <span style={{ ...mono, fontSize: 9, padding: "3px 8px", borderRadius: 3, border: `1px solid ${priorityColor}`, color: priorityColor }}>{ticket.priority}</span>
                )}
                {ticket.project && (
                  <span style={{ ...mono, fontSize: 9, padding: "3px 8px", borderRadius: 3, border: "1px solid rgba(201,166,255,0.3)", color: PU }}>{ticket.project}</span>
                )}
                {ticket.assignee && (
                  <span style={{ ...mono, fontSize: 9, padding: "3px 8px", borderRadius: 3, border: "1px solid rgba(207,239,251,0.2)", color: "rgba(207,239,251,0.7)" }}>@ {ticket.assignee}</span>
                )}
              </div>

              {(ticket.response_breached || ticket.resolution_breached) && (
                <div style={{ ...mono, fontSize: 10, color: OR, marginTop: 10 }}>
                  ⚠ SLA{ticket.response_breached ? " de resposta" : ""}{ticket.response_breached && ticket.resolution_breached ? " e" : ""}{ticket.resolution_breached ? " de resolução" : ""} estourado
                </div>
              )}

              <div style={{ fontSize: 13.5, color: "rgba(207,239,251,0.85)", lineHeight: 1.55, marginTop: 16, whiteSpace: "pre-wrap" }}>
                {ticket.description || "(sem descrição)"}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18, paddingTop: 14, borderTop: "1px dashed rgba(56,225,255,0.14)", ...mono, fontSize: 9.5, color: "rgba(207,239,251,0.5)" }}>
                <div>Aberto em<br /><span style={{ color: "#cfeffb" }}>{fmtDate(ticket.created_at)}</span></div>
                <div>Última atualização<br /><span style={{ color: "#cfeffb" }}>{fmtDate(ticket.updated_at)}</span></div>
                <div>Prazo de resposta<br /><span style={{ color: ticket.response_breached ? OR : "#cfeffb" }}>{fmtDate(ticket.sla_response_due)}</span></div>
                <div>Prazo de resolução<br /><span style={{ color: ticket.resolution_breached ? OR : "#cfeffb" }}>{fmtDate(ticket.sla_resolution_due)}</span></div>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(56,225,255,0.5)", marginBottom: 10 }}>COMENTÁRIOS ({comments.length})</div>
                {comments.length === 0 && (
                  <div style={{ ...mono, fontSize: 10, color: "rgba(207,239,251,0.35)" }}>nenhum comentário.</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {comments.map((c) => (
                    <div key={c.id} style={{ border: "1px solid rgba(56,225,255,0.12)", borderRadius: 6, padding: "10px 12px", background: "rgba(56,225,255,0.02)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ ...mono, fontSize: 9.5, color: "#eafcff" }}>{c.author_name || "—"}{c.author_role ? ` · ${c.author_role}` : ""}</span>
                        <span style={{ ...mono, fontSize: 8.5, color: "rgba(207,239,251,0.4)" }}>{fmtDate(c.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "rgba(207,239,251,0.85)", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{c.body}</div>
                      {(c.internal_note || c.is_resolution) && (
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          {c.internal_note && <span style={{ ...mono, fontSize: 8, color: PU }}>nota interna</span>}
                          {c.is_resolution && <span style={{ ...mono, fontSize: 8, color: GR }}>resolução</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
