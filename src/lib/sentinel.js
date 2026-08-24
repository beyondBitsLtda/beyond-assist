import { sentinelSupabase } from "./sentinelSupabase.js";
import { shorten, relTime } from "./rag.js";

// Ordem lógica do fluxo de chamados — confirmada pelo usuário. Não existe coluna de
// posição em support_tickets (diferente das listas do Trello), então a ordem é fixa aqui.
export const STATUS_ORDER = ["Aberto", "Aguardando Cliente", "Resolvido", "Fechado"];
const PRIORITIES = ["Crítica", "Alta", "Média", "Baixa"];

const TICKET_FIELDS =
  "id, display_id, project_id, title, description, priority, status, assignee, created_at, updated_at, first_response_at, resolved_at, sla_response_due, sla_resolution_due";

/** "Estourado" = prazo já passou e a etapa correspondente (resposta/resolução) ainda não aconteceu. */
function withBreachFlags(row) {
  const now = Date.now();
  return {
    ...row,
    title: row.title || "(sem título)",
    status: row.status || "(sem status)",
    response_breached: !row.first_response_at && !!row.sla_response_due && new Date(row.sla_response_due).getTime() < now,
    resolution_breached: !row.resolved_at && !!row.sla_resolution_due && new Date(row.sla_resolution_due).getTime() < now,
  };
}

/** Projetos da plataforma de testes — pro seletor de filtro. */
export async function listProjects() {
  const { data, error } = await sentinelSupabase
    .from("support_projects")
    .select("id, name")
    .order("name");
  if (error) throw new Error(`listProjects: ${error.message}`);
  return data || [];
}

/** Anexa o nome do projeto (por project_id) a uma lista de chamados. */
export function attachProjectNames(tickets, projects) {
  const nameById = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  return tickets.map((t) => ({ ...t, project: nameById[t.project_id] || null }));
}

/**
 * Chamados de suporte, opcionalmente filtrados por projeto (somente leitura).
 * O SLA já vem pré-calculado nas colunas sla_response_due/sla_resolution_due — só
 * marcamos "estourado" comparando com o horário atual, sem cruzar com sla_policies.
 */
export async function listTickets({ projectId } = {}) {
  let q = sentinelSupabase.from("support_tickets").select(TICKET_FIELDS).order("created_at", { ascending: false });
  if (projectId && projectId !== "all") q = q.eq("project_id", projectId);

  const { data, error } = await q;
  if (error) throw new Error(`listTickets: ${error.message}`);
  return (data || []).map(withBreachFlags);
}

/** Um chamado específico, com descrição completa. */
export async function getTicket(id) {
  const { data, error } = await sentinelSupabase.from("support_tickets").select(TICKET_FIELDS).eq("id", id).single();
  if (error) throw new Error(`getTicket: ${error.message}`);
  return withBreachFlags(data);
}

/** Comentários de um chamado, em ordem cronológica. */
export async function listComments(ticketId) {
  const { data, error } = await sentinelSupabase
    .from("support_ticket_comments")
    .select("id, author_name, author_role, body, internal_note, is_resolution, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listComments: ${error.message}`);
  return data || [];
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

/** Extrai palavras significativas de uma pergunta pra buscar no título/descrição do chamado. */
function tokenize(query) {
  // inclui verbos/palavras de endereçamento conversacional e termos genéricos do domínio
  // (ex.: "suporte" — todo chamado É de suporte, não filtra nada de verdade) — sem isso,
  // uma pergunta solta tipo "me fala sobre os chamados de suporte" vira busca por "suporte"
  // e estreita pra um punhado de chamados por acidente.
  const stop = new Set([
    "a", "o", "as", "os", "de", "da", "do", "das", "dos", "que", "e", "é", "um", "uma", "pra", "para", "com",
    "sobre", "chamado", "chamados", "ticket", "tickets", "leia", "ler", "lê", "me", "mostra", "mostre",
    "qual", "quais", "tem", "tenho", "sentinela", "fala", "fale", "falar", "diz", "diga", "conta", "conte",
    "informa", "informe", "suporte", "sistema", "status", "como", "estao", "estão", "esta", "está",
    "vc", "você", "beyond",
  ]);
  return (query || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stop.has(w));
}

/**
 * Busca chamados relevantes pra uma pergunta do Assistente — sem embeddings, direto na
 * leitura ao vivo do Sentinela. Detecta projeto/prioridade/status/SLA estourado citados
 * na pergunta; sem nenhum filtro reconhecido, busca por palavra no título/descrição; sem
 * nada disso, cai pros chamados mais relevantes (SLA estourado primeiro).
 */
export async function retrieveSentinelTickets(question, { projectId } = {}) {
  const [projects, rawTickets] = await Promise.all([listProjects(), listTickets({ projectId })]);
  const tickets = attachProjectNames(rawTickets, projects);
  const q = (question || "").toLowerCase();

  let filtered = tickets;

  const mentionedProject = projects.find((p) => q.includes(p.name.toLowerCase()));
  if (mentionedProject) filtered = filtered.filter((t) => t.project_id === mentionedProject.id);

  const mentionedPriority = PRIORITIES.find((p) => q.includes(p.toLowerCase()));
  if (mentionedPriority) filtered = filtered.filter((t) => t.priority === mentionedPriority);

  const mentionedStatus = STATUS_ORDER.find((s) => q.includes(s.toLowerCase()));
  if (mentionedStatus) filtered = filtered.filter((t) => t.status === mentionedStatus);

  if (/atrasad|estourad|vencid|\bsla\b/.test(q)) {
    filtered = filtered.filter((t) => t.response_breached || t.resolution_breached);
  }

  // termo livre no título/descrição — só se ainda sobrar muita coisa pra decidir, e só se o
  // resultado não ficar minúsculo (< 5): um match muito estreito é mais provável ser
  // coincidência de palavra genérica do que a intenção real de restringir a busca.
  const terms = tokenize(question);
  if (terms.length && filtered.length > 15) {
    const textMatch = filtered.filter((t) =>
      terms.some((term) => (t.title || "").toLowerCase().includes(term) || (t.description || "").toLowerCase().includes(term))
    );
    if (textMatch.length >= 5) filtered = textMatch;
  }

  // nenhum filtro bateu → round-robin entre projetos (SLA estourado primeiro dentro de cada
  // um), pra nenhum projeto sumir do contexto só porque outro tem mais chamados atrasados
  if (filtered.length === tickets.length) {
    filtered = diversifyByProject(tickets);
  }

  return filtered.slice(0, 40).map(toMatchFormat);
}

/** Intercala chamados de cada projeto (1 de cada por vez), priorizando SLA estourado dentro de cada um. */
function diversifyByProject(tickets) {
  const byProject = new Map();
  for (const t of tickets) {
    const key = t.project_id || "-";
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key).push(t);
  }
  const breachedFirst = (a, b) => {
    const bad = (t) => (t.response_breached || t.resolution_breached ? 0 : 1);
    return bad(a) - bad(b);
  };
  const queues = [...byProject.values()].map((list) => [...list].sort(breachedFirst));

  const result = [];
  for (let i = 0; queues.some((q) => i < q.length); i++) {
    for (const q of queues) {
      if (i < q.length) result.push(q[i]);
    }
  }
  return result;
}

/** Converte um chamado pro mesmo formato de card usado pelo RAG (source/title/content/sim/modified…). */
export function toMatchFormat(ticket) {
  const breachBits = [];
  if (ticket.response_breached) breachBits.push("resposta");
  if (ticket.resolution_breached) breachBits.push("resolução");
  const breach = breachBits.length ? ` [SLA estourado: ${breachBits.join(" e ")}]` : "";

  return {
    source: "SENTINELA",
    board: ticket.project || "chamado",
    title: `#${ticket.display_id} ${ticket.title}`,
    snippet: shorten(ticket.description || ticket.title, 180),
    content: [
      `#${ticket.display_id} — ${ticket.title}`,
      `Status: ${ticket.status} · Prioridade: ${ticket.priority || "—"}${breach}`,
      ticket.assignee ? `Responsável: ${ticket.assignee}` : "",
      ticket.description ? `\nDescrição:\n${ticket.description}` : "",
    ].filter(Boolean).join("\n"),
    sim: "—",
    pct: 100,
    last_modified: ticket.updated_at,
    modified: relTime(ticket.updated_at),
  };
}
