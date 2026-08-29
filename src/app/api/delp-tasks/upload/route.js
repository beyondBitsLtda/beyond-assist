import { parseDelpWorkbook, replaceDelpTasks } from "@/lib/delpTasks.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/delp-tasks/upload   body: { data: string }  (base64 do .xlsx, sem o prefixo
 * "data:...;base64,")
 *
 * Troca de arquivo pela tela /delp-tasks — cada upload SUBSTITUI todas as tarefas da Delp
 * (ver replaceDelpTasks em src/lib/delpTasks.js). O arquivo em si nunca é salvo em disco,
 * só as linhas já parseadas vão pro Supabase.
 */
export async function POST(req) {
  try {
    const { data } = await req.json();
    if (!data || typeof data !== "string") {
      return jsonResponse({ ok: false, error: "arquivo é obrigatório" }, 400);
    }
    const buffer = Buffer.from(data, "base64");
    const rows = await parseDelpWorkbook(buffer);
    await replaceDelpTasks(rows);
    return jsonResponse({ ok: true, count: rows.length });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
