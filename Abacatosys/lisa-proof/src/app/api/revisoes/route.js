import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { filaDaTurma } from "@/lib/revisoes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/revisoes — a fila da turma (os pedidos dos outros, sem nome) e os meus pedidos. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await filaDaTurma(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
