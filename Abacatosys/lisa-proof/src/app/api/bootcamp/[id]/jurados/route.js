import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { juradosParaTela } from "@/lib/bootcamp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/bootcamp/:id/jurados — o painel dos 3 jurados: cada rodada avaliada, com notas e feedbacks, e a classificação. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, ...(await juradosParaTela(usuario.id, id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
