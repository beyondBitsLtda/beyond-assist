import { embedOne } from "./gemini.js";
import { supabase } from "./supabase.js";

const TOP_K = Number(process.env.RAG_TOP_K || 5);
const MIN_SIM = Number(process.env.RAG_MIN_SIMILARITY || 0.55);

/** Persona do Beyond — instrução de sistema do Gemini. */
export const SYSTEM_INSTRUCTION = `Você é o "Beyond", assistente pessoal do usuário (estilo J.A.R.V.I.S.).
Responda em português do Brasil, de forma direta e objetiva.

Baseie-se SOMENTE no contexto fornecido (cards do Trello e notas do Beyond Brain).
Se a resposta não estiver no contexto, diga claramente que não encontrou nos dados indexados.

Sobre datas:
- Cada card do Trello pode ter "Data de entrega/prazo", "Data de início" e "Última modificação".
- Quando o usuário perguntar sobre prazos, entregas, "hoje", "esta semana", "atrasadas", use "Data de entrega/prazo".
- Considere a data atual ao interpretar "hoje", "amanhã", "essa semana" etc.
- "Última modificação" NÃO é prazo — é só quando o card foi editado por último.

Priorize itens com prazo mais próximo ou modificados mais recentemente quando relevante.
Cite o board de origem quando ajudar.`;

/**
 * Recupera os trechos mais parecidos com a pergunta.
 * Retorna um array já no formato dos cards do HUD.
 */
export async function retrieve(question, { filterSource = null } = {}) {
  const queryEmbedding = await embedOne(question, "RETRIEVAL_QUERY");

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: TOP_K,
    min_similarity: MIN_SIM,
    filter_source: filterSource,
  });
  if (error) throw new Error(`match_documents: ${error.message}`);

  return (data || []).map((row) => ({
    source: (row.source || "").toUpperCase(),
    board: row.board || "",
    title: row.title || "(sem título)",
    snippet: shorten(row.content, 180),
    content: row.content,
    sim: Number(row.similarity || 0).toFixed(2),
    pct: Math.round((row.similarity || 0) * 100),
    last_modified: row.last_modified,
    modified: relTime(row.last_modified),
  }));
}

/** Monta o prompt final: bloco de contexto + pergunta + data de hoje. */
export function buildPrompt(question, matches) {
  const hoje = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const context = matches.length
    ? matches
        .map(
          (m, i) =>
            `[#${i + 1} · ${m.source} · ${m.board} · sim ${m.sim} · ${m.modified}]\n${m.title}\n${m.content}`
        )
        .join("\n\n---\n\n")
    : "(nenhum contexto relevante encontrado)";

  return `DATA DE HOJE: ${hoje}\n\nCONTEXTO RECUPERADO:\n${context}\n\nPERGUNTA DO USUÁRIO:\n${question}\n\nResponda usando o contexto acima.`;
}

// ---------- helpers ----------
function shorten(text, n) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function relTime(iso) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}
