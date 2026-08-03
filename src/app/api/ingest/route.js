import { supabase } from "@/lib/supabase.js";
import { embedForIngest } from "@/lib/gemini.js";
import { chunkText } from "@/lib/ingest/chunk.js";
import { loadTrello } from "@/lib/ingest/trello.js";
import { loadBrain } from "@/lib/ingest/brain.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Gemini free tier: 100 requests/min de embedding.
const EMBED_BATCH = 10;
const BATCH_PAUSE_MS = 4000; // pausa menor: 10 chunks a cada ~5s = ~120/min (perto do limite mas com retry)
const UPSERT_BATCH = 100;

// Máximo de chunks por chamada HTTP. Menor = mais chamadas, mas cada uma cabe folgado em 60s.
const MAX_CHUNKS_PER_CALL = 20;

async function handle(req) {
  const need = (process.env.INGEST_SECRET || "").trim();
  if (need) {
    const u = new URL(req.url);
    const got = req.headers.get("x-ingest-secret") || u.searchParams.get("secret") || "";
    if (got !== need) return json({ ok: false, error: "unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const source = (url.searchParams.get("source") || "").toLowerCase();
  const boardIndex = url.searchParams.get("boardIndex");
  const offset = Number(url.searchParams.get("offset") || 0);

  const report = {
    source, boardIndex, offset,
    docs: 0, chunks_total: 0, chunks_processed: 0, upserted: 0,
    board: null, done: false, next_offset: null, errors: [],
  };

  try {
    // ---- carrega a fonte ----
    let sources = [];
    if (source === "trello") {
      const boardIds = (process.env.TRELLO_BOARD_IDS || "")
        .split(",").map(s => s.trim()).filter(Boolean);
      if (boardIndex === null || boardIndex === "") {
        return json({ ok: false, error: "boardIndex obrigatório p/ trello" }, 400);
      }
      const boardId = boardIds[Number(boardIndex)];
      if (!boardId) return json({ ok: false, error: `boardIndex fora do range` }, 400);
      sources = await loadTrello({ boardIds: [boardId] });
      report.board = sources[0]?.board || boardId;
    } else if (source === "brain") {
      sources = await loadBrain();
    } else {
      return json({ ok: false, error: "source obrigatório: trello|brain" }, 400);
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

    // fatia esta chamada
    const slice = allRecords.slice(offset, offset + MAX_CHUNKS_PER_CALL);
    if (!slice.length) {
      report.done = true;
      return json({ ok: true, ...report, note: "nada a processar nesta fatia" });
    }

    // ---- embeddings em mini-lotes com pausa ----
    for (let i = 0; i < slice.length; i += EMBED_BATCH) {
      const batch = slice.slice(i, i + EMBED_BATCH);
      const vectors = await embedForIngest(batch.map(r => r.content), "RETRIEVAL_DOCUMENT");
      batch.forEach((r, j) => (r.embedding = vectors[j]));
      if (i + EMBED_BATCH < slice.length) {
        await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
      }
    }

    // ---- upsert ----
    for (let i = 0; i < slice.length; i += UPSERT_BATCH) {
      const batch = slice.slice(i, i + UPSERT_BATCH);
      const { error } = await supabase
        .from("documents")
        .upsert(batch, { onConflict: "source,external_id" });
      if (error) throw new Error(`upsert: ${error.message}`);
      report.upserted += batch.length;
    }

    report.chunks_processed = slice.length;
    const nextOffset = offset + slice.length;
    if (nextOffset >= allRecords.length) {
      report.done = true;
    } else {
      report.next_offset = nextOffset;
    }

    return json({ ok: true, ...report });
  } catch (err) {
    report.errors.push(String(err?.message || err));
    return json({ ok: false, ...report }, 500);
  }
}

export const GET = handle;
export const POST = handle;

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
