import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { marcarCard } from "@/lib/estudo.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/cards/:id   body: { concluido } — só para assunto sem tarefas (ver marcarCard). */
export async function PATCH(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    if (typeof corpo?.concluido !== "boolean") throw new ErroDeAcesso(400, "informe concluido: true ou false");
    return json({ ok: true, ...(await marcarCard({ usuarioId: usuario.id, cardId: id, concluido: corpo.concluido })) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
