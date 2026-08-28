import { CHART } from "@/lib/chartPalette.js";

// Dados ao vivo pro modo AR do Dashboard (mesmas fontes do Dashboard normal, sem
// SYNC/embeddings) — separado em módulo próprio porque é usado tanto pelo painel completo
// (src/app/(panels)/dashboard/ar/page.js) quanto pela prévia rápida de KPIs do scanner
// (src/components/panels/ArScanner.js).

async function fetchKpis() {
  const [overdueRes, sentinelRes] = await Promise.all([
    fetch("/api/tasks?range=overdue").then((r) => r.json()).catch(() => ({ ok: false })),
    fetch("/api/sentinel/dashboard?project=all").then((r) => r.json()).catch(() => ({ ok: false })),
  ]);
  const overdueTasks = overdueRes.ok ? overdueRes.tasks || [] : [];
  const sentinel = sentinelRes.ok ? sentinelRes : null;

  const kpis = [{ label: "TAREFAS ATRASADAS", value: overdueTasks.length, critical: overdueTasks.length > 0 }];
  if (sentinel) {
    const breached = (sentinel.sla?.responseBreached || 0) + (sentinel.sla?.resolutionBreached || 0);
    const closedLike = (sentinel.byStatus?.["Resolvido"] || 0) + (sentinel.byStatus?.["Fechado"] || 0);
    const total = Object.values(sentinel.byStatus || {}).reduce((s, n) => s + n, 0);
    kpis.push({ label: "SLA ESTOURADO", value: breached, critical: breached > 0 });
    kpis.push({ label: "TICKETS ABERTOS", value: Math.max(0, total - closedLike), critical: false });
  }
  return { kpis, sentinel };
}

/** Só os KPIs — usado na pré-visualização de câmera (fase de escaneamento), leve de propósito. */
export async function loadArKpis() {
  const { kpis } = await fetchKpis();
  return kpis;
}

/** Painel completo — usado pra textura do dashboard fixado no AR de verdade. */
export async function loadArData() {
  const [boardsRes, { kpis, sentinel }] = await Promise.all([
    fetch("/api/boards-overview").then((r) => r.json()).catch(() => ({ ok: false })),
    fetchKpis(),
  ]);
  const boards = boardsRes.ok ? boardsRes.boards || [] : [];

  const pieRows = boards.map((b) => ({ key: b.board, label: b.board, value: b.total || 0 }));

  const boardsBarRows = boards
    .map((b) => ({
      key: b.board, label: b.board,
      values: [Math.max(0, (b.open || 0) - (b.overdue || 0)), b.overdue || 0, b.done || 0],
    }))
    .sort((a, b) => (b.values[0] + b.values[1] + b.values[2]) - (a.values[0] + a.values[1] + a.values[2]));
  const barsSeries = [
    { key: "ontime", name: "No prazo", color: CHART.categorical[0] },
    { key: "overdue", name: "Atrasado", color: CHART.status.critical },
    { key: "done", name: "Concluído", color: CHART.categorical[2] },
  ];

  const line = sentinel && sentinel.trend
    ? {
        title: "SENTINELA · ABERTOS × RESOLVIDOS (21D)",
        points: sentinel.trend,
        series: [
          { key: "opened", name: "Abertos", color: CHART.categorical[0] },
          { key: "resolved", name: "Resolvidos", color: CHART.categorical[2] },
        ],
      }
    : null;

  return {
    updatedLabel: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date()),
    kpis,
    pie: { title: "CARDS POR BOARD", rows: pieRows },
    line,
    bars: { title: "CARGA POR BOARD · NO PRAZO × ATRASADO × CONCLUÍDO", rows: boardsBarRows, series: barsSeries },
  };
}

// ---- listas das outras abas do painel AR (ver src/lib/arNav.js / arPanelRenderer.js) —
// mesma ideia do dashboard: dados reais, ao vivo, sem SYNC/embeddings, só que em formato de
// lista genérica em vez de gráfico. ----

async function loadArBoardsList() {
  const res = await fetch("/api/boards-overview").then((r) => r.json()).catch(() => ({ ok: false }));
  const boards = res.ok ? res.boards || [] : [];
  const rows = boards.map((b) => ({
    title: b.board,
    subtitle: `${b.open || 0} abertos · ${b.done || 0} concluídos`,
    meta: b.overdue ? `${b.overdue} atrasado${b.overdue > 1 ? "s" : ""}` : "em dia",
    critical: (b.overdue || 0) > 0,
  }));
  return { title: "BOARDS", rows, emptyMsg: "nenhum board encontrado." };
}

async function loadArTasksList() {
  const res = await fetch("/api/tasks?range=overdue").then((r) => r.json()).catch(() => ({ ok: false }));
  const tasks = res.ok ? res.tasks || [] : [];
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
  const rows = tasks.map((t) => ({
    title: t.title,
    subtitle: t.board || "",
    meta: t.due ? `venceu ${fmt.format(new Date(t.due))}` : "",
    critical: true,
  }));
  return { title: "TAREFAS ATRASADAS", rows, emptyMsg: "nenhuma tarefa atrasada — tudo em dia." };
}

async function loadArSentinelList() {
  const res = await fetch("/api/sentinel/kanban?project=all").then((r) => r.json()).catch(() => ({ ok: false }));
  const tickets = res.ok ? (res.columns || []).flatMap((c) => c.tickets || []) : [];
  const rows = tickets
    .slice()
    .sort((a, b) => Number(!!(b.response_breached || b.resolution_breached)) - Number(!!(a.response_breached || a.resolution_breached)))
    .map((t) => ({
      title: `#${t.display_id} ${t.title}`,
      subtitle: t.project || t.status || "",
      meta: t.response_breached || t.resolution_breached ? "SLA estourado" : t.status,
      critical: !!(t.response_breached || t.resolution_breached),
    }));
  return { title: "SENTINELA · CHAMADOS", rows, emptyMsg: "nenhum chamado encontrado." };
}

async function loadArThoughtsList() {
  const res = await fetch("/api/thoughts?limit=15").then((r) => r.json()).catch(() => ({ ok: false }));
  const thoughts = res.ok ? res.thoughts || [] : [];
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const rows = thoughts.map((t) => ({
    title: t.subject,
    subtitle: t.created_at ? fmt.format(new Date(t.created_at)) : "",
    meta: "",
    critical: false,
  }));
  return { title: "PENSAMENTOS RECENTES", rows, emptyMsg: "nenhum pensamento registrado ainda." };
}

const LIST_LOADERS = { boards: loadArBoardsList, tasks: loadArTasksList, sentinel: loadArSentinelList, thoughts: loadArThoughtsList };

/** Despachante único usado pelo modo AR — carrega só o necessário pra aba ativa (ver
 * src/lib/arNav.js pra lista de abas), no formato que src/lib/arPanelRenderer.js espera. */
export async function loadArScreenPayload(screen) {
  const updatedLabel = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date());
  if (screen === "dashboard") {
    const dashboard = await loadArData();
    return { screen, updatedLabel, dashboard, list: null };
  }
  const loader = LIST_LOADERS[screen];
  const list = loader ? await loader() : { title: screen, rows: [], emptyMsg: "" };
  return { screen, updatedLabel, dashboard: null, list };
}
