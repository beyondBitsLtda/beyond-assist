"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";
import { CHART } from "@/lib/chartPalette.js";
import HBarChart from "@/components/panels/HBarChart.js";
import PieChart from "@/components/panels/PieChart.js";
import LineChart from "@/components/panels/LineChart.js";
import SentinelTicketDetail from "@/components/panels/SentinelTicketDetail.js";
import TvArMarker from "@/components/panels/TvArMarker.js";

const RANGE_LABELS = { overdue: "Atrasadas", today: "Hoje", tomorrow: "Amanhã", week: "Esta semana", upcoming: "Próximas" };
const AGING_BUCKETS = [
  { key: "0-2", label: "até 2 dias", max: 2 },
  { key: "3-7", label: "3–7 dias", max: 7 },
  { key: "8-14", label: "8–14 dias", max: 14 },
  { key: "15+", label: "15+ dias", max: Infinity },
];

function fmtDue(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(d);
}

function daysLate(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [boards, setBoards] = useState(null);
  const [kanban, setKanban] = useState(null);
  const [overdueTasks, setOverdueTasks] = useState(null);
  const [sentinelSummary, setSentinelSummary] = useState(null);
  const [breachedTickets, setBreachedTickets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [tvMode, setTvMode] = useState(false);
  const [tvSlide, setTvSlide] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, boardsRes, kanbanRes, overdueRes, sentinelRes, sentinelKanbanRes] = await Promise.all([
        fetch("/api/tasks-summary").then((r) => r.json()),
        fetch("/api/boards-overview").then((r) => r.json()),
        fetch("/api/kanban?board=" + encodeURIComponent("Quarto de Guerra")).then((r) => r.json()),
        fetch("/api/tasks?range=overdue").then((r) => r.json()),
        fetch("/api/sentinel/dashboard?project=all").then((r) => r.json()).catch(() => ({ ok: false })),
        fetch("/api/sentinel/kanban?project=all").then((r) => r.json()).catch(() => ({ ok: false })),
      ]);
      if (!summaryRes.ok) throw new Error(summaryRes.error || "falha ao ler /api/tasks-summary");
      if (!boardsRes.ok) throw new Error(boardsRes.error || "falha ao ler /api/boards-overview");
      if (!kanbanRes.ok) throw new Error(kanbanRes.error || "falha ao ler /api/kanban");
      if (!overdueRes.ok) throw new Error(overdueRes.error || "falha ao ler /api/tasks");
      setSummary(summaryRes.counts);
      setBoards(boardsRes.boards || []);
      setKanban(kanbanRes.columns || []);
      setOverdueTasks(overdueRes.tasks || []);
      // Sentinela é opcional (deploy pode não ter esse painel configurado) — não derruba
      // o resto do dashboard se não estiver disponível.
      setSentinelSummary(sentinelRes.ok ? sentinelRes : null);
      if (sentinelKanbanRes.ok) {
        const breached = (sentinelKanbanRes.columns || [])
          .flatMap((c) => c.tickets)
          .filter((t) => t.response_breached || t.resolution_breached)
          .sort((a, b) => (a.sla_response_due || a.sla_resolution_due || "").localeCompare(b.sla_response_due || b.sla_resolution_due || ""));
        setBreachedTickets(breached);
      } else {
        setBreachedTickets(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // atualiza sozinho de tempos em tempos — agora que lê direto do Trello/Sentinela (sem
  // SYNC/embeddings), é rápido e barato o bastante pra não precisar de clique manual.
  useEffect(() => {
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  // MODO TV: pensado pra deixar ligado numa tela grande — vai pra tela cheia e revezoa
  // sozinho entre grupos de gráficos (tudo de uma vez fica ilegível de longe). Sai sozinho
  // se a pessoa apertar Esc (fullscreenchange), não só pelo botão.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onFsChange = () => { if (!document.fullscreenElement) setTvMode(false); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleTvMode = useCallback(() => {
    if (tvMode) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setTvMode(false);
    } else {
      setTvSlide(0);
      setTvMode(true);
      document.documentElement.requestFullscreen?.().catch(() => {}); // funciona sem fullscreen também, só não fica "TV" de verdade
    }
  }, [tvMode]);

  const tasksRows = summary
    ? ["overdue", "today", "tomorrow", "week", "upcoming"].map((k) => ({
        key: k,
        label: RANGE_LABELS[k],
        values: [summary[k] || 0],
        flag: k === "overdue" ? "critical" : undefined,
      }))
    : [];
  const tasksSeries = [{ key: "count", name: "Tarefas", color: CHART.categorical[0] }];

  // carga por board: 3 séries (no prazo / atrasado / concluído) em vez de só aberto×concluído —
  // mostra ONDE o risco está concentrado, não só o volume total.
  const boardsRows = (boards || []).map((b) => ({
    key: b.board, label: b.board,
    values: [Math.max(0, (b.open || 0) - (b.overdue || 0)), b.overdue || 0, b.done || 0],
  }));
  const boardsSeries = [
    { key: "ontime", name: "No prazo", color: CHART.categorical[0] },
    { key: "overdue", name: "Atrasado", color: CHART.status.critical },
    { key: "done", name: "Concluído", color: CHART.categorical[2] },
  ];

  const listRows = (kanban || [])
    .map((c) => ({ key: c.list, label: c.list, values: [c.cards.length] }))
    .sort((a, b) => b.values[0] - a.values[0]);
  const listSeries = [{ key: "count", name: "Cards", color: CHART.categorical[0] }];

  // aging das atrasadas: NÃO é o mesmo insight que "quantas estão atrasadas" — mostra HÁ
  // QUANTO TEMPO, que é o que separa "esqueceu ontem" de "esqueceu faz duas semanas".
  const agingRows = overdueTasks
    ? AGING_BUCKETS.map((b, i) => {
        const min = i === 0 ? 0 : AGING_BUCKETS[i - 1].max + 1;
        const count = overdueTasks.filter((t) => { const d = daysLate(t.due); return d >= min && d <= b.max; }).length;
        return { key: b.key, label: b.label, values: [count], flag: i >= 2 ? "critical" : undefined };
      })
    : [];
  const agingSeries = [{ key: "count", name: "Tarefas atrasadas", color: CHART.categorical[0] }];

  const sentinelStatusPie = sentinelSummary
    ? Object.entries(sentinelSummary.byStatus).map(([status, count]) => ({ key: status, label: status, value: count }))
    : [];
  const sentinelPriorityRows = sentinelSummary
    ? Object.entries(sentinelSummary.byPriority).map(([p, count]) => ({ key: p, label: p, values: [count] }))
    : [];
  const oneSeries = [{ key: "count", name: "Chamados", color: CHART.categorical[0] }];

  // proporção de cards por board — parte-do-todo, cabe melhor numa pizza que numa barra
  const boardsPie = (boards || []).map((b) => ({ key: b.board, label: b.board, value: b.total || 0 }));

  const trendSeries = [
    { key: "opened", name: "Abertos", color: CHART.categorical[0] },
    { key: "resolved", name: "Resolvidos", color: CHART.categorical[2] },
  ];

  const topOverdue = (overdueTasks || []).slice(0, 5);
  const topBreached = (breachedTickets || []).slice(0, 5);

  const slideCount = sentinelSummary ? 4 : 3;
  useEffect(() => {
    if (!tvMode) return;
    const id = setInterval(() => setTvSlide((s) => (s + 1) % slideCount), 12000);
    return () => clearInterval(id);
  }, [tvMode, slideCount]);

  // precisa de atenção agora — a coisa mais acionável do dashboard: não é "quantos",
  // é "quais", pra já poder clicar e resolver
  const attentionPanel = (topOverdue.length > 0 || topBreached.length > 0) && (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
      {topOverdue.length > 0 && (
        <div style={{ border: `1px solid ${CHART.status.critical}55`, borderRadius: 8, padding: "14px 16px", background: "linear-gradient(160deg, rgba(230,103,103,0.08), rgba(0,0,0,0.2))" }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: CHART.status.critical, marginBottom: 10 }}>
            ⚠ TAREFAS MAIS ATRASADAS {overdueTasks && overdueTasks.length > 5 ? `(5 de ${overdueTasks.length})` : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topOverdue.map((t, i) => (
              <a key={i} href={t.url || undefined} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textDecoration: "none", color: "inherit" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#eafcff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                  <div style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.45)", marginTop: 2 }}>{t.board}</div>
                </div>
                <div style={{ ...mono, fontSize: 9.5, flex: "none", color: CHART.status.critical }}>venceu {fmtDue(t.due)} · {daysLate(t.due)}d</div>
              </a>
            ))}
          </div>
        </div>
      )}
      {topBreached.length > 0 && (
        <div style={{ border: `1px solid ${CHART.status.critical}55`, borderRadius: 8, padding: "14px 16px", background: "linear-gradient(160deg, rgba(230,103,103,0.08), rgba(0,0,0,0.2))" }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: CHART.status.critical, marginBottom: 10 }}>
            ⚠ SLA ESTOURADO — SENTINELA {breachedTickets && breachedTickets.length > 5 ? `(5 de ${breachedTickets.length})` : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topBreached.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTicketId(t.id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", width: "100%" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#eafcff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{t.display_id} {t.title}</div>
                  <div style={{ ...mono, fontSize: 9, color: PU, marginTop: 2 }}>{t.project || ""}</div>
                </div>
                <div style={{ ...mono, fontSize: 9.5, flex: "none", color: CHART.status.critical }}>
                  {t.response_breached ? "resposta" : ""}{t.response_breached && t.resolution_breached ? " + " : ""}{t.resolution_breached ? "resolução" : ""}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const chartTasksDeadline = <HBarChart title="TAREFAS POR PRAZO" rows={tasksRows} series={tasksSeries} />;
  const chartAging = <HBarChart title="ATRASADAS · HÁ QUANTO TEMPO" rows={agingRows} series={agingSeries} />;
  const chartBoardsLoad = <HBarChart title="CARGA POR BOARD · NO PRAZO × ATRASADO × CONCLUÍDO" rows={boardsRows} series={boardsSeries} />;
  const chartBoardsPie = <PieChart title="CARDS POR BOARD" rows={boardsPie} />;
  const chartListDist = <HBarChart title="QUARTO DE GUERRA · CARDS POR LISTA" rows={listRows} series={listSeries} />;
  const chartSentinelTrend = sentinelSummary && <LineChart title="SENTINELA · ABERTOS × RESOLVIDOS (21 DIAS)" points={sentinelSummary.trend || []} series={trendSeries} />;
  const chartSentinelStatus = sentinelSummary && <PieChart title="SENTINELA · CHAMADOS POR STATUS" rows={sentinelStatusPie} />;
  const chartSentinelPriority = sentinelSummary && <HBarChart title="SENTINELA · CHAMADOS POR PRIORIDADE" rows={sentinelPriorityRows} series={oneSeries} />;

  // slides do MODO TV — grupos pequenos o bastante pra ficarem legíveis de longe;
  // o slide do Sentinela só entra se o painel estiver disponível nesse deploy.
  const slides = [
    { title: "PRECISA DE ATENÇÃO AGORA", body: attentionPanel || <div style={{ ...mono, color: "rgba(207,239,251,0.4)" }}>nada pendente agora — tudo em dia.</div> },
    { title: "PRAZOS E ATRASOS", body: <div className="bb-chart-grid">{chartTasksDeadline}{chartAging}</div> },
    { title: "CARGA POR BOARD", body: <div className="bb-chart-grid">{chartBoardsLoad}{chartBoardsPie}{chartListDist}</div> },
    ...(sentinelSummary ? [{ title: "SENTINELA", body: <div className="bb-chart-grid">{chartSentinelTrend}{chartSentinelStatus}{chartSentinelPriority}</div> }] : []),
  ];

  if (tvMode) {
    return (
      <div style={{ padding: "32px 40px", height: "100%", overflowY: "auto", zoom: 1.5 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
          <div style={{ ...mono, fontSize: 15, letterSpacing: 3, color: CY }}>◈ {slides[tvSlide]?.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {slides.map((s, i) => (
                <span key={s.title} style={{ width: 8, height: 8, borderRadius: "50%", background: i === tvSlide ? CY : "rgba(var(--accent-rgb),0.25)" }} />
              ))}
            </div>
            <button
              onClick={toggleTvMode}
              style={{ ...mono, fontSize: 10, letterSpacing: 1.5, padding: "6px 12px", border: `1px solid ${GR}`, borderRadius: 3, background: "rgba(123,216,143,0.1)", color: GR, cursor: "pointer" }}
            >
              ✕ SAIR
            </button>
          </div>
        </div>
        <div key={tvSlide} style={{ animation: "bb-slidein .4s ease" }}>{slides[tvSlide]?.body}</div>
        {selectedTicketId && (
          <SentinelTicketDetail ticketId={selectedTicketId} onClose={() => setSelectedTicketId(null)} onStatusChanged={load} />
        )}
        <TvArMarker />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ DASHBOARD</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/dashboard/ar"
            title="Aponte a câmera do celular pra uma parede/mesa e fixe o painel do dashboard ali (WebXR — Chrome/Android)"
            style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: "1px solid rgba(var(--accent-rgb),0.3)", borderRadius: 3, background: "rgba(var(--accent-rgb),0.06)", color: "#eafcff", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            ◫ MODO AR
          </Link>
          <button
            onClick={toggleTvMode}
            title="Tela cheia, letras maiores, revezando sozinho entre os gráficos — pra deixar ligado numa TV/monitor"
            style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: "1px solid rgba(var(--accent-rgb),0.3)", borderRadius: 3, background: "rgba(var(--accent-rgb),0.06)", color: "#eafcff", cursor: "pointer" }}
          >
            ▣ MODO TV
          </button>
          <button
            onClick={load}
            disabled={loading}
            title="Busca direto do Trello + Sentinela (ao vivo) — atualiza sozinho a cada 1 min também"
            style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(var(--accent-rgb),0.06)", color: "#eafcff", cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "…" : "↻ ATUALIZAR"}
          </button>
        </div>
      </div>

      {error && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 16 }}>⚠ {error}</div>}

      {attentionPanel && <div style={{ marginBottom: 20 }}>{attentionPanel}</div>}

      <div className="bb-chart-grid">
        {chartTasksDeadline}
        {chartAging}
        {chartBoardsLoad}
        {chartBoardsPie}
        {chartListDist}
        {chartSentinelTrend}
        {chartSentinelStatus}
        {chartSentinelPriority}
      </div>

      {selectedTicketId && (
        <SentinelTicketDetail ticketId={selectedTicketId} onClose={() => setSelectedTicketId(null)} onStatusChanged={load} />
      )}
    </div>
  );
}
