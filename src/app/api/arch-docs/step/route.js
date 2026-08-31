import { runArchDocStep } from "@/lib/archDocs.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/arch-docs/step   body: { docId?, repo }
 *
 * Avança UM PASSO da geração do mapa de arquitetura de um repositório (via SSE) — mesmo
 * padrão retomável de /api/code-tasks/step: quem chama repete a chamada (passando o `docId`
 * devolvido) até "step_done" vir com `done:true`, cada chamada com seu próprio teto de 60s.
 * Sem `docId`: cria um documento novo e roda o 1º passo. Ver runArchDocStep em
 * src/lib/archDocs.js.
 */
export async function POST(req) {
  const { docId, repo } = await req.json();
  if (!docId && !repo) {
    return new Response(JSON.stringify({ error: "repo é obrigatório pra gerar um mapa novo" }), {
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
        for await (const ev of runArchDocStep({ docId: docId || undefined, repo })) {
          send(controller, ev.type, ev);
        }
      } catch (err) {
        send(controller, "step_done", { done: true, ok: false, error: String(err?.message || err) });
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
