"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, mono } from "@/lib/theme.js";
import { CHART } from "@/lib/chartPalette.js";
import HBarChart from "@/components/panels/HBarChart.js";

const RANGE_LABELS = { overdue: "Atrasadas", today: "Hoje", tomorrow: "Amanhã", week: "Esta semana", upcoming: "Próximas" };

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [boards, setBoards] = useState(null);
  const [kanban, setKanban] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, boardsRes, kanbanRes] = await Promise.all([
        fetch("/api/tasks-summary").then((r) => r.json()),
        fetch("/api/boards-overview").then((r) => r.json()),
        fetch("/api/kanban?board=" + encodeURIComponent("Quarto de Guerra")).then((r) => r.json()),
      ]);
      if (!summaryRes.ok) throw new Error(summaryRes.error || "falha ao ler /api/tasks-summary");
      if (!boardsRes.ok) throw new Error(boardsRes.error || "falha ao ler /api/boards-overview");
      if (!kanbanRes.ok) throw new Error(kanbanRes.error || "falha ao ler /api/kanban");
      setSummary(summaryRes.counts);
      setBoards(boardsRes.boards || []);
      setKanban(kanbanRes.columns || []);
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

  const tasksRows = summary
    ? ["overdue", "today", "tomorrow", "week", "upcoming"].map((k) => ({
        key: k,
        label: RANGE_LABELS[k],
        values: [summary[k] || 0],
        flag: k === "overdue" ? "critical" : undefined,
      }))
    : [];
  const tasksSeries = [{ key: "count", name: "Tarefas", color: CHART.categorical[0] }];

  const boardsRows = (boards || []).map((b) => ({ key: b.board, label: b.board, values: [b.open, b.done] }));
  const boardsSeries = [
    { key: "open", name: "Abertos", color: CHART.categorical[0] },
    { key: "done", name: "Concluídos", color: CHART.categorical[1] },
  ];

  const listRows = (kanban || [])
    .map((c) => ({ key: c.list, label: c.list, values: [c.cards.length] }))
    .sort((a, b) => b.values[0] - a.values[0]);
  const listSeries = [{ key: "count", name: "Cards", color: CHART.categorical[0] }];

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ DASHBOARD</div>
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
        <HBarChart title="TAREFAS POR PRAZO" rows={tasksRows} series={tasksSeries} />
        <HBarChart title="BOARDS · ABERTOS × CONCLUÍDOS" rows={boardsRows} series={boardsSeries} />
        <HBarChart title="QUARTO DE GUERRA · CARDS POR LISTA" rows={listRows} series={listSeries} />
      </div>
    </div>
  );
}
