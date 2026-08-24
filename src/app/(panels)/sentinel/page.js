"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, mono } from "@/lib/theme.js";
import { CHART } from "@/lib/chartPalette.js";
import HBarChart from "@/components/panels/HBarChart.js";
import SentinelKanban from "@/components/panels/SentinelKanban.js";

const VIEWS = [{ key: "kanban", label: "KANBAN" }, { key: "dashboard", label: "DASHBOARD" }];

export default function SentinelPage() {
  const [view, setView] = useState("kanban");
  const [projectId, setProjectId] = useState("all");
  const [projects, setProjects] = useState([]);

  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // lista de projetos pro filtro — carrega uma vez
  useEffect(() => {
    let alive = true;
    fetch("/api/sentinel/projects")
      .then((r) => r.json())
      .then((d) => { if (alive && d.ok) setProjects(d.projects || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const res = await fetch(`/api/sentinel/dashboard?project=${encodeURIComponent(projectId)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSummary(data);
    } catch (err) {
      setSummaryError(err.message);
    } finally {
      setLoadingSummary(false);
    }
  }, [projectId]);

  // busca o dashboard quando ele fica visível, e de novo sempre que o projeto do filtro muda
  useEffect(() => {
    if (view === "dashboard") loadSummary();
  }, [view, loadSummary]);

  const statusRows = summary
    ? Object.entries(summary.byStatus).map(([status, count]) => ({ key: status, label: status, values: [count] }))
    : [];
  const priorityRows = summary
    ? Object.entries(summary.byPriority).map(([p, count]) => ({ key: p, label: p, values: [count] }))
    : [];
  const slaRows = summary
    ? [
        { key: "response", label: "SLA de resposta estourado", values: [summary.sla.responseBreached], flag: "critical" },
        { key: "resolution", label: "SLA de resolução estourado", values: [summary.sla.resolutionBreached], flag: "critical" },
      ]
    : [];
  const oneSeries = [{ key: "count", name: "Chamados", color: CHART.categorical[0] }];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 26px", borderBottom: "1px solid rgba(56,225,255,0.1)", flexWrap: "wrap" }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ SENTINELA</div>
        <div style={{ display: "flex", gap: 4, marginLeft: 12 }}>
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              style={{
                ...mono, fontSize: 9.5, letterSpacing: 1, padding: "5px 10px", borderRadius: 3,
                border: `1px solid ${view === v.key ? CY : "rgba(56,225,255,0.18)"}`,
                background: view === v.key ? "rgba(56,225,255,0.1)" : "transparent",
                color: view === v.key ? "#eafcff" : "rgba(207,239,251,0.55)",
                cursor: "pointer",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          style={{ ...mono, fontSize: 9.5, padding: "6px 8px", borderRadius: 3, border: "1px solid rgba(56,225,255,0.18)", background: "#08131a", color: "#eafcff", marginLeft: "auto" }}
        >
          <option value="all">Todos os projetos</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {view === "kanban" ? (
          <SentinelKanban project={projectId} />
        ) : (
          <div style={{ padding: "20px 24px", height: "100%", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button
                onClick={loadSummary}
                disabled={loadingSummary}
                style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(56,225,255,0.06)", color: "#eafcff", cursor: loadingSummary ? "wait" : "pointer" }}
              >
                {loadingSummary ? "…" : "↻ ATUALIZAR"}
              </button>
            </div>
            {summaryError && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 16 }}>⚠ {summaryError}</div>}
            <div className="bb-chart-grid">
              <HBarChart title="CHAMADOS POR STATUS" rows={statusRows} series={oneSeries} />
              <HBarChart title="CHAMADOS POR PRIORIDADE" rows={priorityRows} series={oneSeries} />
              <HBarChart title="SLA ESTOURADO (ABERTOS)" rows={slaRows} series={oneSeries} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
