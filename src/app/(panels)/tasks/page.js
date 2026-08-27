"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, GR, mono } from "@/lib/theme.js";

const RANGES = [
  { key: "overdue", label: "ATRASADAS" },
  { key: "today", label: "HOJE" },
  { key: "tomorrow", label: "AMANHÃ" },
  { key: "week", label: "SEMANA" },
  { key: "upcoming", label: "PRÓXIMAS" },
];

function fmtDue(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", weekday: "short", timeZone: "America/Sao_Paulo" }).format(d);
}

export default function TasksPage() {
  const [range, setRange] = useState("today");
  const [tasks, setTasks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (r) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks?range=${r}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  // atualiza sozinho de tempos em tempos — agora que lê direto do Trello (sem SYNC/embeddings),
  // é rápido e barato o bastante pra não precisar de clique manual.
  useEffect(() => {
    const id = setInterval(() => load(range), 60000);
    return () => clearInterval(id);
  }, [load, range]);

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ TAREFAS POR PRAZO</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              style={{
                ...mono, fontSize: 9.5, letterSpacing: 1.5, padding: "6px 12px", borderRadius: 3,
                border: `1px solid ${range === r.key ? CY : "rgba(56,225,255,0.18)"}`,
                background: range === r.key ? "rgba(56,225,255,0.1)" : "transparent",
                color: range === r.key ? "#eafcff" : "rgba(207,239,251,0.55)",
                cursor: "pointer",
              }}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => load(range)}
            disabled={loading}
            title="Busca direto do Trello (ao vivo) — atualiza sozinho a cada 1 min também"
            style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", marginLeft: 6, border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(56,225,255,0.06)", color: "#eafcff", cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "…" : "↻ ATUALIZAR"}
          </button>
        </div>
      </div>

      {error && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 16 }}>⚠ {error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(tasks || []).map((t, i) => (
          <a
            key={i}
            href={t.url || undefined}
            target="_blank"
            rel="noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, border: "1px solid rgba(56,225,255,0.16)", borderRadius: 6, padding: "12px 16px", background: "rgba(56,225,255,0.02)", textDecoration: "none", color: "inherit" }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#eafcff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
              <div style={{ ...mono, fontSize: 9.5, color: "rgba(207,239,251,0.45)", marginTop: 4 }}>{t.board}{t.list ? ` · ${t.list}` : ""}</div>
            </div>
            <div style={{ ...mono, fontSize: 10, flex: "none", color: t.done ? GR : range === "overdue" ? OR : "rgba(56,225,255,0.7)" }}>
              {t.done ? "✓ concluída" : fmtDue(t.due)}
            </div>
          </a>
        ))}
        {!loading && tasks && tasks.length === 0 && !error && (
          <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)" }}>nenhuma tarefa nesse intervalo.</div>
        )}
      </div>
    </div>
  );
}
