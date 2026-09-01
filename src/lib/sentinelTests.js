import { sentinelSupabase } from "./sentinelSupabase.js";

// Modo Assistente de Testes: lê/escreve na MESMA tabela `cloud_runs` que a aplicação de
// controle de testes do usuário usa (ver pasta Controle-e-gest-o-de-testes-main na raiz do
// repo — investigada a fundo antes de escrever isto). Cada linha de `cloud_runs` é um "run" de
// teste; `state.data` é um mapa de CASO de teste, `state.ticketData` é um mapa de TICKET
// (interno daquele app, NÃO a tabela support_tickets do Portal de Chamados — são dois sistemas
// diferentes que só coincidem de estar no mesmo projeto Supabase).
//
// Valores válidos de `resultado` — exatamente os do dropdown real do app (js/01-core-state.js
// de Controle-e-gest-o-de-testes-main), nunca inventar outro:
export const TEST_RESULT_VALUES = ["Selecione um resultado", "Aprovado", "Reprovado", "Inválido"];

/** Todos os nomes de projeto de teste distintos (coluna `project_name`, texto livre — não é
 * FK pra `support_projects`, que é de outro sistema). */
export async function listTestProjects() {
  const { data, error } = await sentinelSupabase.from("cloud_runs").select("project_name").not("project_name", "is", null);
  if (error) throw new Error(`listTestProjects: ${error.message}`);
  return [...new Set((data || []).map((r) => r.project_name))].filter(Boolean).sort();
}

/** Runs de um projeto (ou todos, se `projectName` for null/"all") — só os metadados, sem o
 * `state` inteiro (que pode ser grande, com evidências em base64 embutidas). */
export async function listTestRuns(projectName) {
  let query = sentinelSupabase.from("cloud_runs").select("id, run_name, author, status, project_name, media_count, created_at, updated_at").order("created_at", { ascending: false });
  if (projectName && projectName !== "all") query = query.eq("project_name", projectName);
  const { data, error } = await query;
  if (error) throw new Error(`listTestRuns: ${error.message}`);
  return data || [];
}

async function fetchRun(runId) {
  const { data, error } = await sentinelSupabase.from("cloud_runs").select("*").eq("id", runId).single();
  if (error || !data) throw new Error("run de teste não encontrado");
  return data;
}

/** Status de fluxo de trabalho de um caso — mesma lógica EXATA de getTestCaseWorkflowStatus no
 * app original (js/08-filters-history-modals.js): um ticket aberto vinculado ao caso pesa mais
 * que o `resultado` gravado nele (o app nunca reescreve `resultado` só por abrir ticket — só
 * ao FECHAR o último ticket pendente, ele volta pra "Aprovado" sozinho). Replicado aqui pra
 * mostrar o mesmo status que a pessoa veria na tela de verdade do app de testes. */
export function computeWorkflowStatus(testCase, ticketData = {}) {
  const tickets = testCase?.tickets || [];
  if (tickets.length > 0) {
    const total = tickets.length;
    const closed = tickets.filter((id) => ticketData?.[id]?.status === "Fechado").length;
    if (closed < total) return "Em Andamento (DEV)";
    if (testCase.resultado !== "Aprovado") return "Pronto para Re-teste (QA)";
  }
  switch (testCase?.resultado) {
    case "Aprovado": return "Aprovado e Concluído";
    case "Reprovado": return "Falha Nova (Aguardando Ticket)";
    case "Inválido": return "Inválido";
    default: return "Pendente";
  }
}

/** Lista enxuta dos casos de um run (pra popular o seletor) — sem evidências (podem ter
 * imagens base64 grandes), só o que cabe numa lista. */
export async function listTestCases(runId) {
  const run = await fetchRun(runId);
  const cases = run.state?.data || {};
  const ticketData = run.state?.ticketData || {};
  return Object.entries(cases).map(([caseKey, c]) => ({
    caseKey,
    displayId: c.displayId,
    itemTestado: c.itemTestado,
    resultado: c.resultado,
    workflowStatus: computeWorkflowStatus(c, ticketData),
  }));
}

/** UM caso completo (descrição/critério/resultado/tickets) — o que o Modo Assistente de Testes
 * precisa pra saber o que verificar. */
export async function getTestCase(runId, caseKey) {
  const run = await fetchRun(runId);
  const testCase = run.state?.data?.[caseKey];
  if (!testCase) throw new Error("caso de teste não encontrado neste run");
  const ticketData = run.state?.ticketData || {};
  return {
    run: { id: run.id, run_name: run.run_name, project_name: run.project_name, updated_at: run.updated_at },
    caseKey,
    testCase,
    workflowStatus: computeWorkflowStatus(testCase, ticketData),
    tickets: (testCase.tickets || []).map((id) => ({ id, ...ticketData[id] })),
  };
}

/**
 * Grava um resultado novo em `resultado` do caso — SÓ isso (nunca cria ticket sozinha, nunca
 * mexe em evidências; abrir ticket é uma ação com efeito colateral maior — reseta o resultado
 * e move evidências no app original — melhor deixar pra pessoa decidir isso na mão).
 *
 * Concorrência: relê o run NA HORA de escrever (não usa um `state` antigo já carregado antes)
 * e confere se `updated_at` não mudou desde `expectedUpdatedAt` (passado por quem chama, do
 * momento em que os dados foram exibidos pro usuário) — evita sobrescrever uma edição feita
 * nesse meio-tempo direto no app de testes de verdade.
 */
export async function writeTestCaseResult(runId, caseKey, newResultado, { author = "Lisa", expectedUpdatedAt } = {}) {
  if (!TEST_RESULT_VALUES.includes(newResultado)) {
    throw new Error(`valor de resultado inválido: "${newResultado}" (válidos: ${TEST_RESULT_VALUES.join(", ")})`);
  }
  const run = await fetchRun(runId);
  if (expectedUpdatedAt && run.updated_at !== expectedUpdatedAt) {
    throw new Error("o run foi alterado em outro lugar enquanto isso — recarregue o caso antes de gravar, pra não sobrescrever por cima.");
  }
  const state = run.state && typeof run.state === "object" ? run.state : { data: {} };
  const testCase = state.data?.[caseKey];
  if (!testCase) throw new Error("caso de teste não encontrado neste run");

  const oldResult = testCase.resultado;
  const nextCase = {
    ...testCase,
    resultado: newResultado,
    executionHistory: [
      ...(testCase.executionHistory || []),
      { author, oldResult, newResult: newResultado, timestamp: new Date().toISOString() },
    ],
  };
  const nextState = { ...state, data: { ...state.data, [caseKey]: nextCase } };

  const { error } = await sentinelSupabase.from("cloud_runs").update({ state: nextState, updated_at: new Date().toISOString() }).eq("id", runId);
  if (error) throw new Error(`writeTestCaseResult: ${error.message}`);
  return { ok: true, oldResult, newResult: newResultado };
}
