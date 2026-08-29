import ExcelJS from "exceljs";
import { supabase } from "./supabase.js";

// Tarefas da Delp (empresa onde o usuário trabalha) — alimentadas por upload manual de uma
// planilha exportada do PMO (tela /delp-tasks). A fonte "de verdade" é esta tabela no
// Supabase, não o arquivo — cada upload SUBSTITUI tudo (ver replaceDelpTasks). Mapeia pelo
// NOME do cabeçalho (não pela posição da coluna) — assim um export futuro com colunas
// reordenadas ou um campo a mais/menos ainda funciona sem precisar mexer em código.
const FIELD_MAP = {
  "id": "id", "título": "titulo", "titulo": "titulo", "legenda": "legenda",
  "prioridade": "prioridade", "pontos": "pontos",
  "data de início": "data_inicio", "data de inicio": "data_inicio",
  "data limite": "data_limite", "etapa": "etapa",
  "relacionado a": "relacionado_a", "atribuído a": "atribuido_a", "atribuido a": "atribuido_a",
  "colaboradores": "colaboradores", "status": "status", "sprint": "sprint",
};

function normalizeHeader(h) {
  return String(h ?? "").trim().toLowerCase();
}

/** "24/08/2026" (como a planilha do PMO exporta datas) → "2026-08-24" (formato que o
 * Postgres aceita numa coluna `date`). Também cobre o caso de a célula já vir como Date
 * (quando a coluna tem formatação de data de verdade no Excel, não texto). */
function parseBrDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Lê o buffer de um .xlsx exportado do PMO e devolve as linhas já no formato da tabela
 * delp_tasks. A 1ª linha do export é um título mesclado repetido em toda coluna (sem uso);
 * a linha de cabeçalho de verdade é a primeira que tiver uma célula "ID".
 */
export async function parseDelpWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("planilha sem nenhuma aba");

  let headerRowIdx = null;
  for (let i = 1; i <= Math.min(5, sheet.rowCount); i++) {
    const values = sheet.getRow(i).values || [];
    if (values.some((v) => normalizeHeader(v) === "id")) { headerRowIdx = i; break; }
  }
  if (!headerRowIdx) throw new Error('não achei a linha de cabeçalho (esperava uma coluna "ID" nas primeiras linhas)');

  const headerValues = sheet.getRow(headerRowIdx).values || [];
  const colIndexByField = {}; // field (ver FIELD_MAP) -> índice da coluna (1-based)
  headerValues.forEach((h, i) => {
    const field = FIELD_MAP[normalizeHeader(h)];
    if (field) colIndexByField[field] = i;
  });
  if (!colIndexByField.id || !colIndexByField.titulo || !colIndexByField.status) {
    throw new Error("faltam colunas obrigatórias (ID, Título, Status) — confira o cabeçalho da planilha");
  }

  const rows = [];
  for (let i = headerRowIdx + 1; i <= sheet.rowCount; i++) {
    const values = sheet.getRow(i).values || [];
    const get = (field) => (colIndexByField[field] ? values[colIndexByField[field]] : undefined);
    const id = get("id");
    if (!id) continue; // linha em branco (comum no fim da exportação)
    const pontosRaw = get("pontos");
    rows.push({
      id: Number(id),
      titulo: String(get("titulo") || "").trim() || `(sem título #${id})`,
      legenda: get("legenda") ? String(get("legenda")).trim() : null,
      prioridade: get("prioridade") != null && get("prioridade") !== "" ? String(get("prioridade")).trim() : null,
      pontos: pontosRaw != null && pontosRaw !== "" ? Number(pontosRaw) : null,
      data_inicio: parseBrDate(get("data_inicio")),
      data_limite: parseBrDate(get("data_limite")),
      etapa: get("etapa") ? String(get("etapa")).trim() : null,
      relacionado_a: get("relacionado_a") ? String(get("relacionado_a")).trim() : null,
      atribuido_a: get("atribuido_a") ? String(get("atribuido_a")).trim() : null,
      colaboradores: get("colaboradores") ? String(get("colaboradores")).trim() : null,
      status: String(get("status") || "").trim() || "Sem status",
      sprint: get("sprint") ? String(get("sprint")).trim() : null,
      updated_at: new Date().toISOString(),
    });
  }
  if (!rows.length) throw new Error("nenhuma linha de tarefa encontrada na planilha");
  return rows;
}

/** Substitui TODAS as tarefas da Delp pelas da planilha recém enviada — cada upload é um
 * retrato atual, não um acréscimo (evita acumular tarefas antigas que já saíram do export). */
export async function replaceDelpTasks(rows) {
  // Supabase exige algum filtro num delete (trava de segurança contra "apagar a tabela
  // toda" por acidente) — os ids do PMO são sempre positivos, então isto cobre 100% das linhas.
  const { error: delErr } = await supabase.from("delp_tasks").delete().gte("id", 0);
  if (delErr) throw new Error(delErr.message);
  const { error: insErr } = await supabase.from("delp_tasks").insert(rows);
  if (insErr) throw new Error(insErr.message);
}

export async function listDelpTasks() {
  const { data, error } = await supabase
    .from("delp_tasks")
    .select("*")
    .order("data_limite", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/** Usado pra decidir se vale a pena perguntar "quer que eu leve em conta a Delp?" — nunca
 * lança (erro de rede/tabela ainda não criada só significa "não, não tem tarefas ainda"). */
export async function hasDelpTasks() {
  try {
    const { count, error } = await supabase.from("delp_tasks").select("id", { count: "exact", head: true });
    if (error) return false;
    return (count || 0) > 0;
  } catch {
    return false;
  }
}

/** Resumo compacto pro prompt da Lisa — só entra no contexto quando o usuário CONFIRMOU
 * explicitamente que quer (ver o fluxo de consentimento em /api/ask). */
export async function getDelpTasksForContext() {
  try {
    const tasks = await listDelpTasks();
    if (!tasks.length) return "";
    return tasks
      .slice(0, 60)
      .map((t) => `- [${t.status}] ${t.titulo} (responsável: ${t.atribuido_a || "—"}${t.data_limite ? `, prazo: ${t.data_limite}` : ""})`)
      .join("\n");
  } catch {
    return "";
  }
}
