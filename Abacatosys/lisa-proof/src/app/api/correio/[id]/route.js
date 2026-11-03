import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { avaliarRecado, responderPergunta } from "@/lib/correio.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/correio/:id — { acao: "avaliar", util } num recado, ou { acao: "responder", escolha } numa pergunta. */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    if (corpo?.acao === "avaliar") return json({ ok: true, ...(await avaliarRecado(usuario.id, id, Boolean(corpo.util))) });
    if (corpo?.acao === "responder") return json({ ok: true, ...(await responderPergunta(usuario.id, id, corpo.escolha)) });
    throw new ErroDeAcesso(400, "ação inválida");
  } catch (e) {
    return respostaDeErro(e);
  }
}
