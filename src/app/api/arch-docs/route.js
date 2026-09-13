import { listArchDocs } from "@/lib/archDocs.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/arch-docs — histórico (tela /arch-docs). Criar/avançar um mapa de arquitetura é em
 * /api/arch-docs/step (um pedido por PASSO, retomável — ver runArchDocStep em
 * src/lib/archDocs.js), mesmo padrão de /api/code-tasks/step.
 */
export async function GET() {
  try {
    const docs = await listArchDocs();
    return jsonResponse({ ok: true, docs });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
