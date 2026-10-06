import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { enviarExercicio, enviarProjeto } from "@/lib/pratica.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/desafios/:id/enviar
 *   exercício: { codigo }
 *   projeto:   { repo }  — link de um repositório PÚBLICO do GitHub
 *
 * A Lisa avalia na hora e devolve nota, comentário e pontos. Pode demorar alguns segundos.
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    if (typeof corpo?.codigo === "string") {
      return json({ ok: true, ...(await enviarExercicio({ usuarioId: usuario.id, id, codigo: corpo.codigo })) });
    }
    if (typeof corpo?.repo === "string") {
      return json({ ok: true, ...(await enviarProjeto({ usuarioId: usuario.id, id, repo: corpo.repo })) });
    }
    throw new ErroDeAcesso(400, "envie o código (exercício) ou o link do repositório (projeto)");
  } catch (e) {
    return respostaDeErro(e);
  }
}
