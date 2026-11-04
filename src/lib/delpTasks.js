import { supabase } from "./supabase.js";

// Tarefas da Delp (empresa onde o usuário trabalha) — alimentadas por upload manual de uma
// planilha exportada do PMO (tela /delp-tasks). A fonte "de verdade" é esta tabela no
// Supabase, não o arquivo — cada upload SUBSTITUI tudo (ver replaceDelpTasks).
//
// A LEITURA da planilha mudou de lugar: agora acontece no navegador (src/lib/delpWorkbook.js),
// e o que chega aqui já são linhas em JSON. Como quem monta essas linhas passou a ser o
// cliente, o servidor não confia nelas — `sanearLinhasDelp` valida e recorta cada campo antes
// de qualquer coisa ir pro banco.

/** Campos que a tabela delp_tasks aceita. Qualquer outra chave que venha do cliente é
 *  descartada em silêncio — não dá pra inserir coluna que não existe, e tentar seria um jeito
 *  fácil de alguém sujar a tabela. */
const CAMPOS_TEXTO = ["titulo", "legenda", "prioridade", "etapa", "relacionado_a", "atribuido_a", "colaboradores", "status", "sprint"];

const texto = (v, max = 500) => {
  if (v == null || v === "") return null;
  return String(v).trim().slice(0, max) || null;
};

/** Aceita só "AAAA-MM-DD" — o resto vira null em vez de deixar o Postgres recusar a inserção
 *  inteira por causa de uma célula estranha numa linha só. */
const dataIso = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/**
 * Valida e recorta o que veio do navegador. Devolve as linhas prontas pro banco.
 *
 * Lança quando não sobra nada de aproveitável: um upload que não inseriria nada precisa
 * aparecer como erro na tela, não como "sucesso, 0 tarefas".
 */
export function sanearLinhasDelp(entrada) {
  if (!Array.isArray(entrada)) throw new Error("formato inválido: esperava uma lista de linhas");
  const agora = new Date().toISOString();
  const linhas = [];
  for (const bruta of entrada) {
    if (!bruta || typeof bruta !== "object") continue;
    const id = Number(bruta.id);
    if (!Number.isInteger(id) || id < 0) continue; // sem id não há como identificar a tarefa
    const linha = { id, updated_at: agora };
    for (const campo of CAMPOS_TEXTO) linha[campo] = texto(bruta[campo]);
    linha.titulo = linha.titulo || `(sem título #${id})`;
    linha.status = linha.status || "Sem status";
    const pontos = Number(bruta.pontos);
    linha.pontos = Number.isFinite(pontos) ? pontos : null;
    linha.data_inicio = dataIso(bruta.data_inicio);
    linha.data_limite = dataIso(bruta.data_limite);
    linhas.push(linha);
  }
  if (!linhas.length) throw new Error("nenhuma linha de tarefa válida na planilha");
  return linhas;
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
