// Leitura da planilha do PMO — roda no NAVEGADOR, não no servidor.
//
// Antes isto vivia em delpTasks.js e rodava na rota /api/delp-tasks/upload: o navegador mandava
// o .xlsx inteiro em base64 e o servidor interpretava. Mudou por dois motivos, nessa ordem:
//
//  1. O ExcelJS depende de streams do Node e não roda no Edge runtime do Cloudflare. Era a
//     única dependência do app que impedia a migração inteira.
//  2. Interpretar no navegador é melhor de qualquer jeito: trafega só as linhas em JSON em vez
//     do arquivo todo, e o trabalho pesado sai da função (que é o recurso racionado lá).
//
// O servidor deixou de confiar no que chega — ver sanearLinhasDelp em delpTasks.js.
import ExcelJS from "exceljs";

// Mapeia pelo NOME do cabeçalho (não pela posição da coluna) — assim um export futuro com
// colunas reordenadas ou um campo a mais/menos ainda funciona sem mexer em código.
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
