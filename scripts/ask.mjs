// Uso: npm run ask "sua pergunta aqui"
import { retrieve, buildPrompt, SYSTEM_INSTRUCTION } from "../src/lib/rag.js";
import { chatStream } from "../src/lib/gemini.js";

async function main() {
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) {
    console.error('uso: npm run ask "quais clientes do CRM estão em negociação?"');
    process.exit(1);
  }

  console.log(`\n? ${question}\n`);
  const matches = await retrieve(question);

  console.log(`— contexto (${matches.length} matches) —`);
  for (const m of matches) {
    console.log(`  [${m.source} · ${m.board} · sim ${m.sim} · ${m.modified}] ${m.title}`);
  }
  console.log("\n— resposta —");

  const prompt = buildPrompt(question, matches);
  for await (const piece of chatStream(prompt, SYSTEM_INSTRUCTION)) {
    process.stdout.write(piece);
  }
  console.log("\n");
}

main().catch((err) => {
  console.error("✗ erro:", err.message);
  process.exit(1);
});
