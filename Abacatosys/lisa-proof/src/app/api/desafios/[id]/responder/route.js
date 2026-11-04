import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { responderQuiz } from "@/lib/pratica.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/desafios/:id/responder   body: { indice, escolha } — uma pergunta do quiz. */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    return json({ ok: true, ...(await responderQuiz({ usuarioId: usuario.id, id, indice: corpo?.indice, escolha: corpo?.escolha })) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
