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
