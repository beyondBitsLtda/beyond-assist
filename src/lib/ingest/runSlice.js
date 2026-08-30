import { supabase } from "@/lib/supabase.js";
import { embedForIngest } from "@/lib/gemini.js";
import { chunkText } from "@/lib/ingest/chunk.js";
import { loadTrello } from "@/lib/ingest/trello.js";
import { loadBrain } from "@/lib/ingest/brain.js";
import { loadGithub, countEnabledRepos } from "@/lib/ingest/github.js";

// Esses números foram calibrados quando só existiam 2-3 chaves do Gemini (single-key rate
// limit ~100 req/min de embedding — daí a pausa de 4s a cada 10). Hoje embedForIngest já
// roda por baixo dos panos num pool de 35 chaves com rodízio automático (ver
// pickKeyIndex/withTransientRetry em geminiKeyHealth.js/gemini.js) — cada chamada de
// embedForIngest já sai numa chave DIFERENTE da anterior, então a pausa não protege mais
// nada de verdade (só deixa o sync mais lento à toa). Reduzida bem — se algum lote esbarrar
// em cota mesmo assim, o retry com troca de chave já resolve sozinho, sem perder progresso.
const EMBED_BATCH = 10;
const BATCH_PAUSE_MS = 400;
// Cada linha carrega um vetor de 768 números (~13-15KB só de embedding, em texto JSON) —
// com MAX_CHUNKS_PER_CALL alto, um upsert de 1 vez só (UPSERT_BATCH=100 nunca dividia,
// já que uma fatia inteira cabia num lote só) virou uma chamada bem pesada, e passou a
// aparecer "upsert: invalid input syntax for type json" logo depois desse aumento — indício
// de payload grande demais em algum ponto do caminho (não confirmado com certeza, mas
// reduzir o tamanho de cada upsert é seguro de qualquer jeito). Agora sempre quebra em
// lotes menores de verdade.
const UPSERT_BATCH = 20;

// Máximo de chunks por chamada. Menor = mais chamadas, mas cada uma cabe folgado em 60s
// (limite de função da Vercel no plano Hobby — ver src/app/api/cron/sync/route.js). Com a
// pausa acima bem menor, dá pra processar bem mais chunks por chamada sem estourar o tempo.
const MAX_CHUNKS_PER_CALL = 60;

/**
 * Lista de "passos" de uma sincronização completa: um por board do Trello (na ordem de
 * TRELLO_BOARD_IDS) + um pro Beyond Brain. Usada pelo tick automático (cron — ver
 * src/app/api/cron/sync/route.js) pra saber em que passo está, pelo índice.
 * (O botão SYNC manual, no navegador, não usa isto — itera do jeito dele em src/lib/sync.js,
 * porque roda no cliente e não tem acesso a TRELLO_BOARD_IDS.)
 */
export async function buildSyncSteps() {
  const boardIds = (process.env.TRELLO_BOARD_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const repoCount = await countEnabledRepos().catch(() => 0); // tabela pode nem existir ainda em deploys antigos — trata como "0 repos" em vez de quebrar o resto do sync
  return [
    ...boardIds.map((_, i) => ({ source: "trello", boardIndex: i, label: `board ${i + 1}/${boardIds.length}` })),
    { source: "brain", boardIndex: null, label: "brain (notas)" },
    ...Array.from({ length: repoCount }, (_, i) => ({ source: "github", boardIndex: null, repoIndex: i, label: `github ${i + 1}/${repoCount}` })),
  ];
}

/**
 * Processa UMA fatia (até MAX_CHUNKS_PER_CALL chunks) de uma fonte, a partir de `offset`:
 * carrega a fonte inteira, explode em chunks, embedda só a fatia pedida e faz upsert.
 * Compartilhado entre /api/ingest (botão SYNC manual) e /api/cron/sync (tick automático,
 * disparado pelo pg_cron do Supabase — ver db/cron.sql).
 *
 * Lança erro em vez de devolver `{ ok: false }` — quem chama decide como responder.
 */
export async function ingestSlice({ source, boardIndex = null, repoIndex = null, offset = 0 }) {
  const report = {
    source, boardIndex, offset,
    docs: 0, chunks_total: 0, chunks_processed: 0, upserted: 0,
    board: null, done: false, next_offset: null,
  };

  let sources = [];
  if (source === "trello") {
    const boardIds = (process.env.TRELLO_BOARD_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (boardIndex === null || boardIndex === undefined) throw new Error("boardIndex obrigatório p/ trello");
    const boardId = boardIds[Number(boardIndex)];
    if (!boardId) throw new Error("boardIndex fora do range");
    sources = await loadTrello({ boardIds: [boardId] });
    report.board = sources[0]?.board || boardId;
  } else if (source === "brain") {
    sources = await loadBrain();
  } else if (source === "github") {
    if (repoIndex === null || repoIndex === undefined) throw new Error("repoIndex obrigatório p/ github");
    sources = await loadGithub({ repoIndex });
    report.board = sources[0]?.board || null;
  } else {
    throw new Error("source obrigatório: trello|brain|github");
  }
  report.docs = sources.length;

  // ---- explode em chunks (todos, mas processa só uma fatia por chamada) ----
  const allRecords = [];
  for (const doc of sources) {
    const chunks = chunkText(doc.content);
    chunks.forEach((chunk, i) => {
      allRecords.push({
        source: doc.source,
        external_id: `${doc.external_id}#${i}`,
        board: doc.board,
        title: doc.title,
        content: chunk,
        last_modified: doc.last_modified,
        metadata: doc.metadata || {},
      });
    });
  }
  report.chunks_total = allRecords.length;

  const slice = allRecords.slice(offset, offset + MAX_CHUNKS_PER_CALL);
  if (!slice.length) {
    report.done = true;
    return report;
  }

  // ---- embeddings em mini-lotes com pausa ----
  for (let i = 0; i < slice.length; i += EMBED_BATCH) {
    const batch = slice.slice(i, i + EMBED_BATCH);
    const vectors = await embedForIngest(batch.map((r) => r.content), "RETRIEVAL_DOCUMENT");
    batch.forEach((r, j) => (r.embedding = vectors[j]));
    if (i + EMBED_BATCH < slice.length) {
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }
  }

  // ---- upsert ----
  for (let i = 0; i < slice.length; i += UPSERT_BATCH) {
    const batch = slice.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase.from("documents").upsert(batch, { onConflict: "source,external_id" });
    if (error) throw new Error(`upsert: ${error.message}`);
    report.upserted += batch.length;
  }

  report.chunks_processed = slice.length;
  const nextOffset = offset + slice.length;
  if (nextOffset >= allRecords.length) report.done = true;
  else report.next_offset = nextOffset;

  return report;
}
