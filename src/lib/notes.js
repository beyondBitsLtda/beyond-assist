import { supabase } from "./supabase.js";
import { shorten, relTime } from "./rag.js";

const USER_ID = (process.env.BRAIN_USER_ID || "").trim();

// palavras curtas/genéricas demais pra valer como termo de busca ("lê minha nota sobre...")
const STOPWORDS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "que", "e", "é", "um", "uma",
  "pra", "para", "com", "sobre", "minha", "meu", "minhas", "meus", "essa", "esse",
  "essas", "esses", "aquela", "aquele", "nota", "notas", "pensamento", "pensamentos",
  "procura", "procure", "busca", "busque", "leia", "ler", "lê", "me", "mostra", "mostre",
  "fala", "fale", "diz", "diga", "qual", "quais", "tem", "tenho", "registrei", "registrada",
  "registrado", "vc", "você", "beyond",
]);

/**
 * Lista os "pensamentos registrados" (tabela `notes` do Beyond Brain) direto do banco,
 * sem passar pelo pipeline de ingestão/chunking (diferente de loadBrain, que é pra indexação).
 * Por isso o painel Pensamentos está sempre em dia, mesmo sem rodar SYNC.
 */
export async function listThoughts({ limit = 50, offset = 0 } = {}) {
  let query = supabase
    .from("notes")
    .select("id, subject, moment, body, ref, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (USER_ID) query = query.eq("user_id", USER_ID);

  const { data, error, count } = await query;
  if (error) throw new Error(`listThoughts: ${error.message}`);

  const thoughts = (data || []).map((n) => ({
    id: n.id,
    subject: n.subject || "(sem assunto)",
    moment: n.moment || null,
    body: n.body || "",
    ref: n.ref || null,
    created_at: n.created_at,
  }));

  const total = count ?? thoughts.length;
  const next_offset = offset + thoughts.length < total ? offset + thoughts.length : null;

  return { thoughts, count: total, next_offset };
}

/** Cria um novo "pensamento" (nota do Beyond Brain) direto na tabela `notes`. */
export async function createThought({ subject, moment = null, body = "", ref = null }) {
  const clean = (subject || "").trim();
  if (!clean) throw new Error("subject é obrigatório");

  const row = { subject: clean, moment: moment || null, body: body || "", ref: ref || null };
  if (USER_ID) row.user_id = USER_ID;

  const { data, error } = await supabase.from("notes").insert(row).select("id, subject, moment, body, ref, created_at").single();
  if (error) throw new Error(`createThought: ${error.message}`);
  return data;
}

/** Extrai palavras significativas de uma pergunta pra usar como termo de busca. */
function tokenize(query) {
  return (query || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/**
 * Busca textual (ILIKE) em subject/body/ref — direto na tabela `notes`, sem depender de
 * embeddings nem do SYNC. É o caminho confiável pra "leia minha nota sobre X": encontra
 * a nota mesmo que ela tenha sido criada depois da última reindexação, e mesmo que a
 * pergunta não seja parecida o bastante pra bater na busca semântica.
 */
export async function searchThoughts(query, { limit = 10 } = {}) {
  const terms = tokenize(query);
  if (!terms.length) return [];

  let q = supabase
    .from("notes")
    .select("id, subject, moment, body, ref, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (USER_ID) q = q.eq("user_id", USER_ID);

  const orClauses = terms
    .flatMap((t) => [`subject.ilike.%${t}%`, `body.ilike.%${t}%`, `ref.ilike.%${t}%`])
    .join(",");
  const { data, error } = await q.or(orClauses);
  if (error) throw new Error(`searchThoughts: ${error.message}`);

  return (data || []).map((n) => ({
    id: n.id,
    subject: n.subject || "(sem assunto)",
    moment: n.moment || null,
    body: n.body || "",
    ref: n.ref || null,
    created_at: n.created_at,
  }));
}

/** Converte uma nota pro mesmo formato de card usado pelo RAG (source/title/content/sim/modified…). */
export function toMatchFormat(note) {
  return {
    source: "BRAIN",
    board: note.ref || "nota",
    title: note.subject || "(sem assunto)",
    snippet: shorten(note.body, 180),
    content: [note.subject, note.moment, note.body].filter(Boolean).join("\n"), // corpo inteiro, sem cortar
    sim: "—",
    pct: 100,
    last_modified: note.created_at,
    modified: relTime(note.created_at),
  };
}
