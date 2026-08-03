import { embedOne } from "./gemini.js";
import { supabase } from "./supabase.js";

const TOP_K = Number(process.env.RAG_TOP_K || 8);
const MIN_SIM = Number(process.env.RAG_MIN_SIMILARITY || 0.55);

/** Detecta perguntas do tipo "liste tudo" para buscar mais resultados. */
function wantsMany(question) {
  const q = question.toLowerCase();
  return /\b(todas|todos|liste|listar|lista|quais s[ãa]o|me diga tudo|tudo que|completa|completo)\b/.test(q);
}

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

  const matchCount = wantsMany(question) ? 30 : TOP_K;
  const minSim = wantsMany(question) ? 0.3 : MIN_SIM; // mais permissivo ao listar

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    min_similarity: minSim,
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

// ---------- roteamento por data ----------

/** Detecta se a pergunta é sobre PRAZO/DATA (hoje, semana, atrasadas…). */
export function detectDateRange(question) {
  const q = question.toLowerCase();
  if (/\b(atrasad|venceu|passou do prazo|em atraso|vencid)/.test(q)) return "overdue";
  if (/\b(amanh[ãa])/.test(q)) return "tomorrow";
  if (/\b(esta semana|essa semana|na semana|semana que|pr[óo]ximos dias|pr[óo]xima semana)/.test(q)) return "week";
  if (/\b(hoje|do dia|para o dia|de hoje)/.test(q)) return "today";
  return null; // não é pergunta de data → usa RAG normal
}

/**
 * Busca tarefas do Trello filtrando pela data de vencimento (SQL, sem vetores).
 * Retorna no MESMO formato dos matches do RAG, p/ o HUD renderizar igual.
 */
export async function retrieveByDate(range) {
  const now = new Date();
  const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = spNow.getFullYear(), mo = spNow.getMonth(), d = spNow.getDate();
  const startToday = new Date(Date.UTC(y, mo, d, 3, 0, 0)); // 00:00 BRT
  const endToday = new Date(startToday.getTime() + 864e5);
  const endTomorrow = new Date(endToday.getTime() + 864e5);
  const endWeek = new Date(startToday.getTime() + 7 * 864e5);

  let lo = null, hi = null, onlyOpen = false;
  if (range === "today") { lo = startToday; hi = endToday; }
  else if (range === "tomorrow") { lo = endToday; hi = endTomorrow; }
  else if (range === "week") { lo = startToday; hi = endWeek; }
  else if (range === "overdue") { hi = startToday; onlyOpen = true; }

  let q = supabase
    .from("documents")
    .select("external_id, board, title, content, metadata, last_modified")
    .eq("source", "trello")
    .not("metadata->>due", "is", null);
  if (lo) q = q.gte("metadata->>due", lo.toISOString());
  if (hi) q = q.lt("metadata->>due", hi.toISOString());

  const { data, error } = await q;
  if (error) throw new Error(`retrieveByDate: ${error.message}`);

  const seen = new Map();
  for (const row of data || []) {
    const cardId = String(row.external_id).split("#")[0];
    if (seen.has(cardId)) continue;
    const done = row.metadata?.due_complete === true;
    if (onlyOpen && done) continue;
    seen.set(cardId, {
      source: "TRELLO",
      board: row.board || "",
      title: row.title || "(sem título)",
      snippet: shorten(row.content, 180),
      content: row.content,
      sim: "—",
      pct: 100,
      last_modified: row.last_modified,
      modified: relTime(row.last_modified),
      due: row.metadata?.due || null,
    });
  }
  return [...seen.values()].sort((a, b) => (a.due || "").localeCompare(b.due || ""));
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
