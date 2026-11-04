import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { mandarPerguntaDoQuiz } from "@/lib/correio.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/desafios/:id/correio — { indice, paraId }: a pergunta do quiz vai pelo correio (BEYOND-0016). Devolve como o "responder": terminou, acertos, pontos… */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    return json({ ok: true, ...(await mandarPerguntaDoQuiz(usuario.id, id, { indice: corpo?.indice, paraId: corpo?.paraId })) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
