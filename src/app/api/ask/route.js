import { retrieve, retrieveByDate, detectDateRange, buildPrompt, SYSTEM_INSTRUCTION } from "@/lib/rag.js";
import { chatStream } from "@/lib/gemini.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ask
 * body: { question: string, filterSource?: 'trello' | 'brain' }
 *
 * Responde via SSE com três eventos que mapeiam direto no HUD:
 *   - "context": cards recuperados  → coluna RETRIEVED_CONTEXT
 *   - "token":   pedaços da resposta → transcript (estado SPEAKING)
 *   - "done":    fim do stream
 */
export async function POST(req) {
  const { question, filterSource = null } = await req.json();

  if (!question || typeof question !== "string") {
    return new Response(JSON.stringify({ error: "question é obrigatório" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const send = (controller, event, data) =>
    controller.enqueue(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    );

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // roteia: pergunta de prazo/data → filtro SQL; senão → RAG vetorial
        const range = detectDateRange(question);
        const matches = range
          ? await retrieveByDate(range)
          : await retrieve(question, { filterSource });

        send(controller, "context", matches);

        const prompt = buildPrompt(question, matches);
        for await (const piece of chatStream(prompt, SYSTEM_INSTRUCTION)) {
          send(controller, "token", piece);
        }

        send(controller, "done", { ok: true });
      } catch (err) {
        const msg = String(err?.message || err);
        const friendly = err?.code === "QUOTA" || msg.includes("QUOTA_EXCEEDED") || msg.includes("RESOURCE_EXHAUSTED")
          ? "⚠️ Quota do Gemini cheia. Aguarde cerca de 1 minuto e pergunte de novo. (Dica: evite clicar em SYNC logo antes de perguntar.)"
          : msg;
        send(controller, "error", { message: friendly });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
