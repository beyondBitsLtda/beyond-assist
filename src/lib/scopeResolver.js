import {
  retrieve, retrieveByDate, detectDateRange, retrieveByBoard, detectBoard,
  retrieveGeneral, shorten, relTime, SYSTEM_INSTRUCTION, SYSTEM_INSTRUCTION_GENERAL,
} from "./rag.js";
import { searchThoughts, listThoughts, toMatchFormat } from "./notes.js";
import { retrieveSentinelTickets, listProjects } from "./sentinel.js";
import { listDelpTasks } from "./delpTasks.js";
import { supabase } from "./supabase.js";

// Extraído de /api/ask (mesma lógica, palavra por palavra) pra poder ser reaproveitado pelas
// falas AGENDADAS (ver src/lib/scheduledAnnouncements.js) — sem isso, o roteamento de escopo
// (Tarefas/Boards/Sentinela/Delp/Brain/Geral) teria que ser mantido em dois lugares
// separados, e um dia os dois iam divergir silenciosamente.

/** Converte tarefas da Delp pro mesmo formato de "card" usado pelo resto do RAG (ver
 * retrieveByBoard/retrieveByDate acima) — assim o HUD e o prompt tratam igual, não importa
 * a origem. Usado quando o escopo é "Tarefas Delp". */
function delpTasksToMatches(tasks) {
  return tasks.map((t) => {
    const content = `Status: ${t.status}\nResponsável: ${t.atribuido_a || "—"}\nColaboradores: ${t.colaboradores || "—"}\nPrazo: ${t.data_limite || "—"}\nInício: ${t.data_inicio || "—"}\nEtapa: ${t.etapa || "—"}\nSprint: ${t.sprint || "—"}\nRelacionado a: ${t.relacionado_a || "—"}${t.legenda ? `\nLegenda: ${t.legenda}` : ""}`;
    return {
      id: String(t.id), source: "DELP", board: "Tarefas Delp", title: t.titulo,
      snippet: shorten(content, 180), content, sim: "—", pct: 100,
      last_modified: t.updated_at, modified: relTime(t.updated_at), due: t.data_limite,
    };
  });
}

/** Lê um ARQUIVO específico já indexado por completo (todos os pedaços, na ordem certa) —
 * é uma LEITURA (igual "leia minha nota X"), não busca semântica: usado quando o usuário
 * escolhe um arquivo exato no seletor "Código" do Assistente. */
async function retrieveGithubFile(repo, path) {
  let q = supabase.from("documents").select("external_id, board, title, content, last_modified").eq("source", "github").eq("title", path);
  if (repo) q = q.eq("board", repo);
  const { data, error } = await q;
  if (error) throw new Error(`retrieveGithubFile: ${error.message}`);
  if (!data?.length) return [];

  const sorted = [...data].sort((a, b) => Number(a.external_id.split("#").pop()) - Number(b.external_id.split("#").pop()));
  const fullContent = sorted.map((r) => r.content).join("\n");
  const first = sorted[0];
  return [{
    id: first.external_id, source: "GITHUB", board: first.board, title: first.title,
    snippet: shorten(fullContent, 180), content: fullContent, sim: "—", pct: 100,
    last_modified: first.last_modified, modified: relTime(first.last_modified),
  }];
}

/**
 * Resolve um `scope` (mesmo formato usado pelo seletor do Assistente e por /api/ask) numa
 * pergunta/instrução, devolvendo os cards de contexto (`matches`) já prontos + a instrução de
 * sistema e ferramentas certas pra esse escopo. Não faz nenhuma chamada ao Gemini pra GERAR
 * resposta — só resolve QUAL contexto usar.
 */
export async function resolveScope(scope, question, { filterSource = null } = {}) {
  let matches;
  let systemInstruction = SYSTEM_INSTRUCTION;
  let tools;
  let promptNote = null; // linha extra de contexto (ex.: projeto do Sentinela selecionado à mão)

  if (scope?.mode === "general") {
    matches = await retrieveGeneral(question);
    try {
      const tickets = await retrieveSentinelTickets(question);
      matches = [...matches, ...tickets];
    } catch {}
    systemInstruction = SYSTEM_INSTRUCTION_GENERAL;
    tools = [{ googleSearch: {} }];
  } else if (scope?.mode === "panel" && scope.source === "sentinel") {
    const projectId = scope.projectId && scope.projectId !== "all" ? scope.projectId : null;
    matches = await retrieveSentinelTickets(question, { projectId });
    if (projectId) {
      try {
        const projects = await listProjects();
        const proj = projects.find((p) => p.id === projectId);
        if (proj) {
          promptNote = `O usuário selecionou manualmente o projeto de teste "${proj.name}" no seletor — ` +
            `todos os chamados do contexto abaixo são desse projeto. Deixe claro na resposta que você ` +
            `está falando do projeto "${proj.name}" (ex.: se perguntarem "qual projeto é esse?", responda com esse nome).`;
        }
      } catch {}
    }
  } else if (scope?.mode === "panel" && scope.source === "delp") {
    matches = delpTasksToMatches(await listDelpTasks());
  } else if (scope?.mode === "panel" && scope.source === "github") {
    if (scope.path) {
      // arquivo exato escolhido — lê ele inteiro, não busca semântica
      matches = await retrieveGithubFile(scope.repo, scope.path);
    } else {
      // busca semântica no código indexado (ver src/lib/ingest/github.js) — filtra por
      // repositório se um foi escolhido; minSim mais permissivo que o padrão porque nome de
      // função/variável raramente bate palavra por palavra com a pergunta em português.
      matches = await retrieve(question, { filterSource: "github", filterBoard: scope.repo || null, topK: 15, minSim: 0.35 });
    }
  } else if (scope?.mode === "panel" && scope.board) {
    matches = await retrieveByBoard(scope.board);
    if (matches.length > 40) matches = matches.slice(0, 40);
  } else if (scope?.mode === "panel" && scope.range) {
    const range = scope.range === "auto" ? (detectDateRange(question) || "upcoming") : scope.range;
    matches = await retrieveByDate(range);
  } else if (scope?.mode === "panel" && scope.source === "brain") {
    const found = await searchThoughts(question);
    const thoughts = found.length ? found : (await listThoughts({ limit: 5 })).thoughts;
    matches = thoughts.map(toMatchFormat);
  } else {
    const range = detectDateRange(question);
    const board = detectBoard(question);
    if (range) {
      matches = await retrieveByDate(range);
    } else if (board) {
      matches = await retrieveByBoard(board);
      if (matches.length > 40) matches = matches.slice(0, 40);
    } else {
      matches = await retrieve(question, { filterSource });
    }
  }

  return { matches, systemInstruction, tools, promptNote };
}
