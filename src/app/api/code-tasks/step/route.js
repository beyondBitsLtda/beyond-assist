import { runCodeTaskStep } from "@/lib/codeTasks.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/code-tasks/step
 * body: { taskId?, repo, baseBranch, instruction, filePaths?, continueBranch?, existingPrUrl? }
 *
 * Avança UM PASSO de uma tarefa de código e devolve (via SSE). Quem chama repete a chamada
 * (passando o `taskId` devolvido) até o evento "step_done" vir com `done:true` — cada
 * chamada é um pedido HTTP PRÓPRIO, com seu próprio teto de 60s (plano Hobby da Vercel,
 * fixo, sem como aumentar), então a tarefa inteira não fica presa a uma única janela de 60s
 * mesmo quando toca vários arquivos ou o Gemini está mais lento que o normal.
 *
 * Sem `taskId`: cria uma tarefa nova e roda o 1º passo — se `continueBranch`/`existingPrUrl`
 * vierem preenchidos, a tarefa nova CONTINUA nessa branch/PR (ver runCodeTaskStep) em vez de
 * criar outra do zero. Com `taskId`: retoma do passo salvo em code_tasks.state (esses dois
 * campos são ignorados nesse caso, já que a tarefa já decidiu isso no 1º passo).
 */
export async function POST(req) {
  const { taskId, repo, baseBranch, instruction, filePaths, continueBranch, existingPrUrl } = await req.json();
  if (!taskId && (!repo || !baseBranch || !instruction?.trim())) {
    return new Response(JSON.stringify({ error: "repo, baseBranch e instruction são obrigatórios pra criar uma tarefa nova" }), {
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
        for await (const ev of runCodeTaskStep({
          taskId: taskId || undefined,
          repo, baseBranch, instruction: instruction?.trim(),
          filePaths: Array.isArray(filePaths) ? filePaths.filter(Boolean) : [],
          continueBranch: continueBranch || undefined,
          existingPrUrl: existingPrUrl || undefined,
        })) {
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
