import { replaceDelpTasks, sanearLinhasDelp } from "@/lib/delpTasks.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/delp-tasks/upload   body: { rows: Array<linha> }
 *
 * Recebe as linhas JÁ INTERPRETADAS pelo navegador (ver src/lib/delpWorkbook.js) e substitui
 * todas as tarefas da Delp por elas — cada upload é um retrato atual, não um acréscimo.
 *
 * Antes esta rota recebia o .xlsx inteiro em base64 e interpretava aqui, com o ExcelJS. A
 * leitura mudou para o navegador porque o ExcelJS depende de streams do Node e não roda no Edge
 * runtime. Como consequência, quem monta as linhas agora é o cliente — então elas passam por
 * `sanearLinhasDelp` antes de chegar perto do banco.
 */
export async function POST(req) {
  try {
    const { rows } = await req.json();
    const linhas = sanearLinhasDelp(rows);
    await replaceDelpTasks(linhas);
    return jsonResponse({ ok: true, count: linhas.length });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
