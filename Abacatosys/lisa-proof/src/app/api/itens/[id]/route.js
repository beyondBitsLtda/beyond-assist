import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { marcarItem } from "@/lib/estudo.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/itens/:id   body: { feito }
 *
 * Marca o item NO QUADRO DO ABACATO (é o mesmo item que aparece lá) e devolve os pontos ganhos
 * ou perdidos com isso, já contando o bônus de assunto concluído e o de meta do dia.
 */
export async function PATCH(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    if (typeof corpo?.feito !== "boolean") throw new ErroDeAcesso(400, "informe feito: true ou false");
    return json({ ok: true, ...(await marcarItem({ usuarioId: usuario.id, itemId: id, feito: corpo.feito })) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
