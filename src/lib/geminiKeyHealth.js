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

function isAvailableNow(keyIndex, model) {
  const entry = cache.get(`${keyIndex}:${model}`);
  return !entry || Date.now() >= entry.until;
}

/** Escolhe o índice de chave a usar pra este MODELO, evitando as em `exclude` (já tentadas
 * nesta MESMA chamada lógica) e preferindo as que não estão de cooldown — rodízio simples
 * entre as candidatas restantes. Se todas estiverem de cooldown, ainda assim devolve uma
 * (melhor tentar e deixar o próprio Gemini confirmar do que travar o app). */
let rrPointer = 0;
export async function pickKeyIndex(n, model, exclude = new Set()) {
  await ensureFreshCache();
  const notExcluded = [];
  for (let i = 0; i < n; i++) if (!exclude.has(i)) notExcluded.push(i);
  const pool = notExcluded.length ? notExcluded : Array.from({ length: n }, (_, i) => i); // esgotou exclusão — libera geral
  const available = pool.filter((i) => isAvailableNow(i, model));
  const finalPool = available.length ? available : pool;
  for (let step = 0; step < n; step++) {
    const idx = (rrPointer + step) % n;
    if (finalPool.includes(idx)) { rrPointer = (idx + 1) % n; return idx; }
  }
  return finalPool[0];
}

/** Marca (chave × modelo) de cooldown até `untilMs`, por `reason` ('rpd'|'rpm'|'overload'|
 * 'unsupported'). Atualiza o cache na hora (efeito imediato nesta invocação) e persiste no
 * Supabase em segundo plano (efeito nas PRÓXIMAS invocações/instâncias). */
export async function markCooldown(keyIndex, model, { untilMs, reason, error }) {
  cache.set(`${keyIndex}:${model}`, { until: untilMs, reason });
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
