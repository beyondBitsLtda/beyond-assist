import { supabase } from "@/lib/supabase.js";

// ---- saúde das chaves do Gemini, por (chave × MODELO), com persistência real ----
// Cada MODELO tem cota própria — uma chave pode estar ótima pro chat e zerada pra voz ao
// mesmo tempo (foi exatamente o que aconteceu: TTS free tier = 10/dia, chat/embeddings
// bem mais folgados, na MESMA chave). E como a Vercel não garante que a função continue
// rodando/"lembrando" nada entre invocações (cada requisição pode cair numa instância
// fria, sem memória nenhuma do que já sabia), o estado de verdade mora na tabela
// gemini_key_health (ver db/schema.sql) — a memória local aqui é só um cache rápido pra
// não bater no banco em toda chamada, resincronizado a cada 30s.

const cache = new Map(); // `${keyIndex}:${model}` -> { until: epoch ms, reason }
const REHYDRATE_INTERVAL_MS = 30_000;
let lastHydratedAt = 0;
let hydratingPromise = null;

async function ensureFreshCache() {
  if (Date.now() - lastHydratedAt < REHYDRATE_INTERVAL_MS) return;
  if (hydratingPromise) return hydratingPromise;
  hydratingPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("gemini_key_health")
        .select("key_index, model, cooldown_until, reason");
      if (!error && data) {
        for (const row of data) {
          const key = `${row.key_index}:${row.model}`;
          const untilMs = row.cooldown_until ? new Date(row.cooldown_until).getTime() : 0;
          if (untilMs > Date.now()) cache.set(key, { until: untilMs, reason: row.reason });
          else cache.delete(key); // já expirou, ou outra invocação já limpou
        }
      }
    } catch {
      // sem Supabase configurado, ou erro de rede — segue só com o que já tinha em memória
      // (pior caso: pode repetir uma chave que outra invocação já sabe que está ruim, mas
      // o próprio Gemini vai recusar de novo e o cooldown se recalcula igual)
    } finally {
      lastHydratedAt = Date.now();
      hydratingPromise = null;
    }
  })();
  return hydratingPromise;
}

// ---- a reserva interativa -----------------------------------------------------------------
//
// Quantas chaves a INDEXAÇÃO nunca pode tocar. Sem isso, indexar e conversar bebem do mesmo
// poço, e quem bebe rápido ganha.
//
// Medido em 15/09/2026: depois que o relógio saiu da Cloudflare (onde os limites do plano
// gratuito o continham em ~300 pedaços por hora) e passou a rodar em casa sem teto, o sync
// consumiu a cota DIÁRIA das 35 chaves do modelo de embedding numa manhã. As 35 ficaram em
// cooldown de 12 h com motivo `rpd`, e uma pergunta no chat passou a levar 98 segundos —
// esperando por uma chave livre que não existia. O Worker gastava 14 ms de CPU nesses 98
// segundos: não estava calculando, estava na fila.
//
// A reserva vale só onde há disputa de verdade. Cota do Gemini é por (chave × MODELO), e o
// modelo de embedding é o ÚNICO que a indexação e a conversa compartilham — chat e voz têm
// cota própria, e nenhuma indexação jamais as consome. Por isso a reserva não precisa saber
// de modelo: basta que a indexação fique longe do fim do pool.
//
// Não é preciso "preferir" a reserva no lado interativo: pickKeyIndex já filtra por
// disponibilidade, então quando o sync esgota a parte dele, as únicas livres são as
// reservadas — e é nelas que a conversa cai naturalmente.
const RESERVA_INTERATIVA = Math.max(0, Number(process.env.GEMINI_RESERVA_INTERATIVA ?? 8));

function isAvailableNow(keyIndex, model) {
  const entry = cache.get(`${keyIndex}:${model}`);
  return !entry || Date.now() >= entry.until;
}

/** Escolhe o índice de chave a usar pra este MODELO, evitando as em `exclude` (já tentadas
 * nesta MESMA chamada lógica) e preferindo as que não estão de cooldown — rodízio simples
 * entre as candidatas restantes. Se todas estiverem de cooldown, ainda assim devolve uma
 * (melhor tentar e deixar o próprio Gemini confirmar do que travar o app). */
// Ponteiros separados por escopo: o rodízio da indexação não deve empurrar o da conversa,
// senão o sync (que faz milhares de chamadas) decide sozinho onde a próxima pergunta começa.
const ponteiros = { interativo: 0, ingestao: 0 };
export async function pickKeyIndex(n, model, exclude = new Set(), { paraIngestao = false } = {}) {
  await ensureFreshCache();
  // A indexação enxerga só o começo do pool; o fim é a reserva interativa. O `max(1, ...)`
  // garante que ela sempre tenha ao menos uma chave, mesmo se alguém configurar uma reserva
  // maior que o pool — melhor indexar devagar que não indexar.
  const limite = paraIngestao ? Math.max(1, n - RESERVA_INTERATIVA) : n;
  const notExcluded = [];
  for (let i = 0; i < limite; i++) if (!exclude.has(i)) notExcluded.push(i);
  const pool = notExcluded.length ? notExcluded : Array.from({ length: limite }, (_, i) => i); // esgotou exclusão — libera geral
  const available = pool.filter((i) => isAvailableNow(i, model));
  const finalPool = available.length ? available : pool;
  const escopo = paraIngestao ? "ingestao" : "interativo";
  for (let step = 0; step < limite; step++) {
    const idx = (ponteiros[escopo] + step) % limite;
    if (finalPool.includes(idx)) { ponteiros[escopo] = (idx + 1) % limite; return idx; }
  }
  return finalPool[0];
}

/** Quantas chaves a indexação pode usar, para quem precisa relatar (painel e diagnóstico). */
export function tamanhoDaReserva() { return RESERVA_INTERATIVA; }

/** Registra uma tentativa de chamada (sucesso ou falha) pro painel de uso (/gemini-keys) —
 * agregado por dia via a função increment_gemini_usage (ver db/schema.sql), nunca uma linha
 * por chamada. Nunca deixa uma falha de log derrubar o fluxo real do Gemini — só registra
 * e ignora erro. */
async function logUsage(keyIndex, model, success) {
  try {
    await supabase.rpc("increment_gemini_usage", {
      p_day: new Date().toISOString().slice(0, 10),
      p_key_index: keyIndex,
      p_model: model,
      p_success: success,
    });
  } catch {
    // Supabase/RPC indisponível — só perde a estatística deste tick, não é crítico
  }
}

/** Marca (chave × modelo) de cooldown até `untilMs`, por `reason` ('rpd'|'rpm'|'overload'|
 * 'unsupported'). Atualiza o cache na hora (efeito imediato nesta invocação) e persiste no
 * Supabase em segundo plano (efeito nas PRÓXIMAS invocações/instâncias). */
export async function markCooldown(keyIndex, model, { untilMs, reason, error }) {
  cache.set(`${keyIndex}:${model}`, { until: untilMs, reason });
  logUsage(keyIndex, model, false); // fire-and-forget — não trava o retorno desta função por causa da estatística
  try {
    await supabase.from("gemini_key_health").upsert(
      {
        key_index: keyIndex, model,
        cooldown_until: new Date(untilMs).toISOString(),
        reason, last_error: String(error || "").slice(0, 500),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key_index,model" }
    );
  } catch {
    // Supabase indisponível — o cache em memória (já atualizado acima) ainda vale pro
    // resto desta invocação, só não persiste pras próximas.
  }
}

/** Limpa o cooldown de (chave × modelo) — chamado num sucesso, pra ela voltar a ser
 * escolhida imediatamente (não precisa esperar o cooldown expirar sozinho). */
export async function markOk(keyIndex, model) {
  logUsage(keyIndex, model, true); // fire-and-forget, igual acima — todo sucesso conta pro painel de uso
  const key = `${keyIndex}:${model}`;
  if (!cache.has(key)) return; // nunca esteve em cooldown — nada a limpar, evita escrita à toa
  cache.delete(key);
  try {
    await supabase.from("gemini_key_health").upsert(
      { key_index: keyIndex, model, cooldown_until: null, reason: null, last_error: null, updated_at: new Date().toISOString() },
      { onConflict: "key_index,model" }
    );
  } catch {
    // idem — cache local já limpo, só não persiste
  }
}
