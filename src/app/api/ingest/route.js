import { supabase } from "@/lib/supabase.js";
import { embed } from "@/lib/gemini.js";
import { chunkText } from "@/lib/ingest/chunk.js";
import { loadTrello } from "@/lib/ingest/trello.js";
import { loadBrain } from "@/lib/ingest/brain.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // até 5 min (planos pagos) — Hobby limita a 60s

const EMBED_BATCH = 32;
const UPSERT_BATCH = 100;

/**
 * POST /api/ingest   (também aceita GET, pra facilitar disparo pelo navegador)
 * Header: x-ingest-secret: <INGEST_SECRET>   OU   ?secret=<INGEST_SECRET>
 *
 * Se INGEST_SECRET estiver vazio no .env, a rota fica aberta (útil só em teste).
 * Em produção: preencha INGEST_SECRET e sempre envie o segredo.
 */
async function handle(req) {
  // ---- autorização ----
  const need = (process.env.INGEST_SECRET || "").trim();
  if (need) {
    const url = new URL(req.url);
    const got = req.headers.get("x-ingest-secret") || url.searchParams.get("secret") || "";
    if (got !== need) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
  }

  const report = { trello: 0, brain: 0, chunks: 0, upserted: 0, errors: [] };

  try {
    const [trello, brain] = await Promise.all([loadTrello(), loadBrain()]);
    report.trello = trello.length;
    report.brain = brain.length;

    const records = [];
    for (const doc of [...trello, ...brain]) {
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

    if (!records.length) {
      return json({ ok: true, ...report, note: "nada a indexar" });
    }

    // embeddings em lote
    for (let i = 0; i < records.length; i += EMBED_BATCH) {
      const batch = records.slice(i, i + EMBED_BATCH);
      const vectors = await embed(batch.map((r) => r.content), "RETRIEVAL_DOCUMENT");
      batch.forEach((r, j) => (r.embedding = vectors[j]));
    }

    // upsert em lote (idempotente por source+external_id)
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
