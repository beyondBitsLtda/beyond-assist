// Uso: npm run ingest
// Carrega Trello + Beyond Brain → chunk → embeddings → upsert no pgvector.
import { supabase } from "../src/lib/supabase.js";
import { embed } from "../src/lib/gemini.js";
import { chunkText } from "../src/lib/ingest/chunk.js";
import { loadTrello } from "../src/lib/ingest/trello.js";
import { loadBrain } from "../src/lib/ingest/brain.js";

const EMBED_BATCH = 32;
const UPSERT_BATCH = 100;

async function main() {
  console.log("→ carregando fontes…");
  const [trello, brain] = await Promise.all([loadTrello(), loadBrain()]);
  const sources = [...trello, ...brain];
  console.log(`→ ${sources.length} itens brutos (trello=${trello.length}, brain=${brain.length})`);

  // 1) explode em chunks
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
  console.log(`→ ${records.length} chunks para embeddar`);
  if (!records.length) {
    console.log("nada a indexar. verifique as chaves/boards no .env.");
    return;
  }

  // 2) embeddings em lotes
  for (let i = 0; i < records.length; i += EMBED_BATCH) {
    const batch = records.slice(i, i + EMBED_BATCH);
    const vectors = await embed(batch.map((r) => r.content), "RETRIEVAL_DOCUMENT");
    batch.forEach((r, j) => (r.embedding = vectors[j]));
    process.stdout.write(`\r  embeddings ${Math.min(i + EMBED_BATCH, records.length)}/${records.length}`);
  }
  console.log("");

  // 3) upsert em lotes (idempotente por source+external_id)
  for (let i = 0; i < records.length; i += UPSERT_BATCH) {
    const batch = records.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase
      .from("documents")
      .upsert(batch, { onConflict: "source,external_id" });
    if (error) throw new Error(`upsert: ${error.message}`);
    process.stdout.write(`\r  upsert ${Math.min(i + UPSERT_BATCH, records.length)}/${records.length}`);
  }
  console.log("\n✓ ingestão concluída.");
}

main().catch((err) => {
  console.error("\n✗ erro na ingestão:", err.message);
  process.exit(1);
});
