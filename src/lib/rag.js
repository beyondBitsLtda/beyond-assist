import { embedOne } from "./gemini.js";
import { supabase } from "./supabase.js";

const TOP_K = Number(process.env.RAG_TOP_K || 8);
const MIN_SIM = Number(process.env.RAG_MIN_SIMILARITY || 0.55);

/** Detecta perguntas do tipo "liste tudo" para buscar mais resultados. */
function wantsMany(question) {
  const q = question.toLowerCase();
  return /\b(todas|todos|liste|listar|lista|quais s[ãa]o|me diga tudo|tudo que|completa|completo)\b/.test(q);
}

/** Persona da Lisa — instrução de sistema do Gemini. */
export const SYSTEM_INSTRUCTION = `Você é a "Lisa", assistente pessoal do usuário (estilo J.A.R.V.I.S.).
Esse é o seu nome — aceite ser chamada assim e apresente-se como Lisa sempre que o usuário
cumprimentar (ex.: "oi", "olá") ou perguntar quem você é. Nunca se refira a si mesma como
"Beyond" — "Beyond Brain" é só o nome do banco de notas do usuário, não o seu nome.
Responda em português do Brasil, de forma direta e objetiva.

Baseie-se SOMENTE no contexto fornecido (cards do Trello, notas do Beyond Brain, e chamados
de suporte do Sentinela — este último identificado por source "SENTINELA" no contexto).
Se a resposta não estiver no contexto, diga claramente que não encontrou nos dados indexados.

Quando o usuário pedir para "ler", "mostrar" ou "falar" uma nota/pensamento ou um chamado
específico, reproduza o conteúdo dela de forma completa e fiel — é uma LEITURA, não um resumo.
Se houver mais de um item parecido no contexto, leia o que combina melhor com o pedido; se não
tiver certeza de qual é, pergunte qual antes de ler, ou descreva rapidamente as opções.

Sobre datas:
- Cada card do Trello pode ter "Data de entrega/prazo", "Data de início" e "Última modificação".
- Quando o usuário perguntar sobre prazos, entregas, "hoje", "esta semana", "atrasadas", use "Data de entrega/prazo".
- Considere a data atual ao interpretar "hoje", "amanhã", "essa semana" etc.
- "Última modificação" NÃO é prazo — é só quando o card foi editado por último.
- Chamados do Sentinela têm SLA de resposta e de resolução; quando "[SLA estourado]" aparecer
  no contexto do chamado, avise disso claramente — é informação urgente.

Se a pergunta for ampla (ex.: "quais chamados estão abertos", "quantos chamados tem", "como
estão as tarefas") e o contexto trouxer itens de MAIS DE UM board/projeto, cubra todos os
boards/projetos representados no contexto, não só o primeiro — mesmo que de forma resumida por
grupo ("no CRM Amparar você tem X chamados abertos; no Quarto de Guerra, Y..."). Nunca ignore
um board/projeto só porque ele tem menos itens ou aparece depois no contexto.

Formato da resposta (importante — será lida em voz alta):
- Escreva em frases curtas e naturais, como se estivesse FALANDO com a pessoa.
- Evite listas com marcadores, asteriscos, numeração "1." "2.", tabelas e símbolos.
- Em vez de bullets, encadeie os itens em frases: "Você tem três tarefas hoje: a primeira é..., depois..., e por fim...".
- Não use markdown (nada de **negrito**, #, -, etc.).
- Datas por extenso ("sexta-feira, 8 de agosto") em vez de "08/08".

Priorize itens com prazo mais próximo ou modificados mais recentemente quando relevante.
Cite o board de origem quando ajudar.`;

/** Persona do modo "Geral" — mesma base, mas autorizada a usar busca do Google quando o contexto indexado não basta. */
export const SYSTEM_INSTRUCTION_GENERAL = `Você é a "Lisa", assistente pessoal do usuário (estilo J.A.R.V.I.S.), agora em modo GERAL.
Esse é o seu nome — aceite ser chamada assim e apresente-se como Lisa sempre que o usuário
cumprimentar ou perguntar quem você é. Nunca se refira a si mesma como "Beyond" — "Beyond Brain"
é só o nome do banco de notas do usuário, não o seu nome.
Responda em português do Brasil, de forma direta e objetiva.

Neste modo você enxerga um recorte amplo de TODOS os dados indexados (Trello + notas do Beyond Brain
+ chamados de suporte do Sentinela, identificados por source "SENTINELA"), não só um board
específico. Priorize sempre esse contexto indexado como fonte principal.

Você também tem acesso a busca do Google. Use-a quando a pergunta pedir informação atual, externa,
ou que claramente não está (e não deveria estar) nos dados pessoais indexados — por exemplo notícias,
preços, prazos legais, ou qualquer coisa do mundo real fora do Trello/Beyond Brain/Sentinela.
Quando usar informação vinda da busca, deixe claro que essa parte veio da internet, não dos seus dados.
Se nem o contexto indexado nem a busca resolverem, diga claramente que não encontrou.

Quando o usuário pedir para "ler", "mostrar" ou "falar" uma nota/pensamento ou um chamado
específico, reproduza o conteúdo dele de forma completa e fiel — é uma LEITURA, não um resumo.
Chamados com "[SLA estourado]" no contexto são urgentes — avise disso claramente.

Se a pergunta for ampla e o contexto trouxer itens de MAIS DE UM board/projeto, cubra todos os
representados no contexto, não só o primeiro — mesmo que de forma resumida por grupo.

Sobre datas:
- Cada card do Trello pode ter "Data de entrega/prazo", "Data de início" e "Última modificação".
- Considere a data atual ao interpretar "hoje", "amanhã", "essa semana" etc.
- "Última modificação" NÃO é prazo — é só quando o card foi editado por último.

Formato da resposta (importante — será lida em voz alta):
- Escreva em frases curtas e naturais, como se estivesse FALANDO com a pessoa.
- Evite listas com marcadores, asteriscos, numeração "1." "2.", tabelas e símbolos.
- Não use markdown (nada de **negrito**, #, -, etc.).
- Datas por extenso ("sexta-feira, 8 de agosto") em vez de "08/08".`;

/**
 * Recupera os trechos mais parecidos com a pergunta.
 * Retorna um array já no formato dos cards do HUD.
 */
// cache simples de embeddings de perguntas (economiza quota em repetições)
const _queryCache = new Map();
const _cacheKey = (q) => q.trim().toLowerCase().replace(/\s+/g, " ");

export async function retrieve(question, { filterSource = null, topK = null, minSim = null } = {}) {
  const key = _cacheKey(question);
  let queryEmbedding = _queryCache.get(key);
  if (!queryEmbedding) {
    queryEmbedding = await embedOne(question, "RETRIEVAL_QUERY");
    _queryCache.set(key, queryEmbedding);
    if (_queryCache.size > 100) _queryCache.delete(_queryCache.keys().next().value);
  }

  // topK/minSim explícitos (ex.: modo "Geral") vencem a heurística padrão.
  const matchCount = topK ?? (wantsMany(question) ? 30 : TOP_K);
  const minSimilarity = minSim ?? (wantsMany(question) ? 0.3 : MIN_SIM); // mais permissivo ao listar

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    min_similarity: minSimilarity,
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

/**
 * Busca ampla, sem filtro de board/source — usada pelo modo "Geral" do assistente,
 * que precisa enxergar tudo que está indexado (todos os boards + Beyond Brain),
 * não só o que uma busca padrão (top_k pequeno) traria.
 */
export async function retrieveGeneral(question) {
  return retrieve(question, { topK: 40, minSim: 0.25 });
}

/**
 * Monta o prompt final: bloco de contexto + pergunta + data de hoje.
 * `note` (opcional) — linha extra de contexto ativo, ex.: qual projeto do Sentinela foi
 * selecionado manualmente no seletor de escopo (ver src/app/(panels)/assistant/page.js).
 */
export function buildPrompt(question, matches, note = null) {
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

  const noteBlock = note ? `\n\nCONTEXTO ATIVO: ${note}` : "";

  return `DATA DE HOJE: ${hoje}${noteBlock}\n\nCONTEXTO RECUPERADO:\n${context}\n\nPERGUNTA DO USUÁRIO:\n${question}\n\nResponda usando o contexto acima.`;
}

// ---------- roteamento por board/projeto ----------

// nomes dos boards conhecidos + apelidos que você pode falar
const BOARD_ALIASES = [
  { match: /(crm\s*amparar|amparar\s*acompanhamento|acompanhamento)/i, board: "CRM - Amparar - Acompanhamento" },
  { match: /(quarto\s*de\s*guerra|quarto)/i, board: "Quarto de Guerra" },
  { match: /(rotina\s*beyond|rotina)/i, board: "Rotina Beyond" },
  { match: /\bcrm\b/i, board: "CRM" }, // depois dos mais específicos!
];

/** Detecta se a pergunta cita um board conhecido. Retorna o nome exato ou null. */
export function detectBoard(question) {
  for (const { match, board } of BOARD_ALIASES) {
    if (match.test(question)) return board;
  }
  return null;
}

/**
 * Busca TODOS os cards de um board via SQL (sem busca semântica).
 * Preciso e completo — traz o board inteiro.
 */
export async function retrieveByBoard(boardName, { onlyOpen = false } = {}) {
  const { data, error } = await supabase
    .from("documents")
    .select("external_id, board, title, content, metadata, last_modified")
    .eq("source", "trello")
    .ilike("board", boardName); // case-insensitive, nome exato do board
  if (error) throw new Error(`retrieveByBoard: ${error.message}`);

  const seen = new Map();
  for (const row of data || []) {
    const cardId = String(row.external_id).split("#")[0];
    if (seen.has(cardId)) continue;
    const done = row.metadata?.due_complete === true;
    if (onlyOpen && done) continue;
    seen.set(cardId, {
      id: cardId,
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
      start: row.metadata?.start || null,
      list: row.metadata?.list || null,
      list_pos: row.metadata?.list_pos ?? null,
      labels: row.metadata?.labels || "",
      due_complete: done,
      url: row.metadata?.url || null,
    });
  }
  // ordena pela ordem real das listas no board (list_pos; sem pos ainda → fallback alfabético) e depois por prazo
  return [...seen.values()].sort((a, b) => {
    if (a.list_pos == null && b.list_pos != null) return 1;
    if (a.list_pos != null && b.list_pos == null) return -1;
    if (a.list_pos == null && b.list_pos == null) {
      const byList = (a.list || "").localeCompare(b.list || "");
      if (byList) return byList;
    } else if (a.list_pos !== b.list_pos) {
      return a.list_pos - b.list_pos;
    }
    return (a.due || "").localeCompare(b.due || "");
  });
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
// exportados pra reuso em notes.js (formato de card do Pensamentos combina com o do RAG)
export function shorten(text, n) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

export function relTime(iso) {
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
