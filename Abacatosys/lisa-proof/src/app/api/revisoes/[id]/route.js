import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { revisarPedido } from "@/lib/revisoes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/revisoes/:id { vereditos: [{ indice, veredito, observacao }], comentario }
 * — revisar o pedido de um colega (cumpriu / não cumpriu / não dá para julgar).
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    return json({ ok: true, ...(await revisarPedido(usuario.id, id, { vereditos: corpo?.vereditos, comentario: corpo?.comentario })) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
