import { supabase } from "@/lib/supabase.js";
import { embed } from "@/lib/gemini.js";
import { chunkText } from "@/lib/ingest/chunk.js";
import { loadTrello } from "@/lib/ingest/trello.js";
import { loadBrain } from "@/lib/ingest/brain.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EMBED_BATCH = 32;
const UPSERT_BATCH = 100;

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
  const report = { source, boardIndex, docs: 0, chunks: 0, upserted: 0, board: null, errors: [] };

  try {
    let sources = [];
    if (source === "trello") {
      const boardIds = (process.env.TRELLO_BOARD_IDS || "")
        .split(",").map(s => s.trim()).filter(Boolean);
      if (boardIndex === null || boardIndex === undefined || boardIndex === "") {
        return json({ ok: false, error: "boardIndex é obrigatório p/ source=trello" }, 400);
      }
      const idx = Number(boardIndex);
      const boardId = boardIds[idx];
      if (!boardId) return json({ ok: false, error: `boardIndex ${idx} fora do range` }, 400);
      sources = await loadTrello({ boardIds: [boardId] });
      report.board = sources[0]?.board || boardId;
    } else if (source === "brain") {
      sources = await loadBrain();
    } else {
      const [t, b] = await Promise.all([loadTrello(), loadBrain()]);
      sources = [...t, ...b];
    }
    report.docs = sources.length;

    const records = [];
    for (const doc of sources) {
      const chunks = chunkText(doc.content);
      chunks.forEach((chunk, i) => {
        records.push({
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
    report.chunks = records.length;
    if (!records.length) return json({ ok: true, ...report, note: "nada a indexar" });

    for (let i = 0; i < records.length; i += EMBED_BATCH) {
      const batch = records.slice(i, i + EMBED_BATCH);
      const vectors = await embed(batch.map(r => r.content), "RETRIEVAL_DOCUMENT");
      batch.forEach((r, j) => (r.embedding = vectors[j]));
    }

    for (let i = 0; i < records.length; i += UPSERT_BATCH) {
      const batch = records.slice(i, i + UPSERT_BATCH);
      const { error } = await supabase
        .from("documents")
        .upsert(batch, { onConflict: "source,external_id" });
      if (error) throw new Error(`upsert: ${error.message}`);
      report.upserted += batch.length;
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
