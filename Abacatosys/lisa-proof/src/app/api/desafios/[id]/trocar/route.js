import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { trocarProjeto } from "@/lib/pratica.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/desafios/:id/trocar
 *
 * Gera outro projeto da mesma semana do curso (ou outro final), só dos assuntos dela. Só antes da
 * primeira entrega, até 3 vezes. Devolve o desafio atualizado.
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, desafio: await trocarProjeto({ usuarioId: usuario.id, id }) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
