import { runCodeTaskStreaming } from "@/lib/codeTasks.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/code-tasks/stream   body: { repo, baseBranch, instruction, filePaths?: string[] }
 *
 * Versão SSE do /api/code-tasks — usada pelo "Modo Código" do Assistente, pra narrar cada
 * fase (Lisa "comentando" o que está fazendo) e mostrar o código de cada arquivo sendo
 * escrito ao vivo, em vez de só devolver o PR pronto no final. Ver runCodeTaskStreaming em
 * src/lib/codeTasks.js.
 *
 * Eventos SSE: "narration" (texto pra mostrar/falar), "file_start"/"file_chunk"/"file_end"
 * (código sendo escrito, por arquivo), "done" (sempre o último).
 */
export async function POST(req) {
  const { repo, baseBranch, instruction, filePaths } = await req.json();
  if (!repo || !baseBranch || !instruction?.trim()) {
    return new Response(JSON.stringify({ error: "repo, baseBranch e instruction são obrigatórios" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const send = (controller, event, data) =>
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of runCodeTaskStreaming({
          repo, baseBranch, instruction: instruction.trim(),
          filePaths: Array.isArray(filePaths) ? filePaths.filter(Boolean) : [],
        })) {
          send(controller, ev.type, ev);
        }
      } catch (err) {
        send(controller, "done", { ok: false, error: String(err?.message || err) });
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
