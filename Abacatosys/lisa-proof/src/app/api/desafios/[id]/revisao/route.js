import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { revisaoDoDesafio, pedirRevisao } from "@/lib/revisoes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/desafios/:id/revisao — o pedido de revisão da turma deste desafio (se houver) e se dá para pedir. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, ...(await revisaoDoDesafio(usuario.id, id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/desafios/:id/revisao { contestados: [{ indice, justificativa }], consentiu } — pedir a revisão da turma. */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    return json({ ok: true, pedido: await pedirRevisao(usuario.id, id, { contestados: corpo?.contestados, consentiu: corpo?.consentiu === true }) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
