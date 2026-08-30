import { listCodeTasks, runCodeTask } from "@/lib/codeTasks.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/code-tasks — histórico (tela /code-tasks). */
export async function GET() {
  try {
    const tasks = await listCodeTasks();
    return jsonResponse({ ok: true, tasks });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

/**
 * POST /api/code-tasks   body: { repo, baseBranch, instruction }
 *
 * Roda a tarefa de ponta a ponta (contexto → Gemini propõe → branch nova → commit → PR) e
 * só devolve quando terminar (ou falhar) — sem fila em segundo plano por enquanto, então
 * tarefas grandes podem esbarrar no teto de 60s da função (ver maxDuration acima).
 */
export async function POST(req) {
  try {
    const { repo, baseBranch, instruction } = await req.json();
    if (!repo || !baseBranch || !instruction?.trim()) {
      return jsonResponse({ ok: false, error: "repo, baseBranch e instruction são obrigatórios" }, 400);
    }
    const result = await runCodeTask({ repo, baseBranch, instruction: instruction.trim() });
    return jsonResponse(result, result.ok ? 200 : 500);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
