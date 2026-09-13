import { listCodeTasks } from "@/lib/codeTasks.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/code-tasks — histórico (tela /code-tasks e o Modo Código do Assistente).
 *
 * Criar/avançar uma tarefa é em /api/code-tasks/step (um pedido por PASSO, retomável — ver
 * runCodeTaskStep em src/lib/codeTasks.js). Não existe mais um POST aqui que roda a tarefa
 * inteira numa chamada só: isso é o que estourava o teto fixo de 60s da função (Vercel,
 * plano Hobby) em pedidos que tocam mais de 1-2 arquivos.
 */
export async function GET() {
  try {
    const tasks = await listCodeTasks();
    return jsonResponse({ ok: true, tasks });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
