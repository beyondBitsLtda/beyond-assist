import { sentinelSupabase } from "./sentinelSupabase.js";

// Ordem lógica do fluxo de chamados — confirmada pelo usuário. Não existe coluna de
// posição em support_tickets (diferente das listas do Trello), então a ordem é fixa aqui.
export const STATUS_ORDER = ["Aberto", "Aguardando Cliente", "Resolvido", "Fechado"];

/** Projetos da plataforma de testes — pro seletor de filtro. */
export async function listProjects() {
  const { data, error } = await sentinelSupabase
    .from("support_projects")
    .select("id, name")
    .order("name");
  if (error) throw new Error(`listProjects: ${error.message}`);
  return data || [];
}

/**
 * Chamados de suporte, opcionalmente filtrados por projeto (somente leitura).
 * O SLA já vem pré-calculado nas colunas sla_response_due/sla_resolution_due — só
 * marcamos "estourado" comparando com o horário atual, sem cruzar com sla_policies.
 */
export async function listTickets({ projectId } = {}) {
  let q = sentinelSupabase
    .from("support_tickets")
    .select(
      "id, display_id, project_id, title, priority, status, assignee, created_at, updated_at, first_response_at, resolved_at, sla_response_due, sla_resolution_due"
    )
    .order("created_at", { ascending: false });

  if (projectId && projectId !== "all") q = q.eq("project_id", projectId);

  const { data, error } = await q;
  if (error) throw new Error(`listTickets: ${error.message}`);

  const now = Date.now();
  return (data || []).map((t) => ({
    id: t.id,
    display_id: t.display_id,
    project_id: t.project_id,
    title: t.title || "(sem título)",
    priority: t.priority || null,
    status: t.status || "(sem status)",
    assignee: t.assignee || null,
    created_at: t.created_at,
    updated_at: t.updated_at,
    sla_response_due: t.sla_response_due,
    sla_resolution_due: t.sla_resolution_due,
    // "estourado" = prazo já passou e a etapa correspondente ainda não aconteceu
    response_breached: !t.first_response_at && !!t.sla_response_due && new Date(t.sla_response_due).getTime() < now,
    resolution_breached: !t.resolved_at && !!t.sla_resolution_due && new Date(t.sla_resolution_due).getTime() < now,
  }));
}

/** Agrupa os chamados em colunas por status, na ordem lógica do fluxo (STATUS_ORDER). */
export function groupByStatus(tickets) {
  const columns = new Map();
  for (const t of tickets) {
    const key = t.status || "(sem status)";
    if (!columns.has(key)) columns.set(key, { status: key, tickets: [] });
    columns.get(key).tickets.push(t);
  }
  const orderOf = (status) => {
    const i = STATUS_ORDER.indexOf(status);
    return i === -1 ? STATUS_ORDER.length : i; // status desconhecido cai no fim
  };
  return [...columns.values()].sort((a, b) => orderOf(a.status) - orderOf(b.status));
}

/** Contadores pro dashboard: por status, por prioridade, e SLA estourado entre os ainda abertos. */
export function summarizeTickets(tickets) {
  const byStatus = {};
  const byPriority = {};
  let responseBreached = 0;
  let resolutionBreached = 0;

  for (const t of tickets) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    const p = t.priority || "(sem prioridade)";
    byPriority[p] = (byPriority[p] || 0) + 1;
    if (t.response_breached) responseBreached++;
    if (t.resolution_breached) resolutionBreached++;
  }

  return { byStatus, byPriority, sla: { responseBreached, resolutionBreached } };
}
