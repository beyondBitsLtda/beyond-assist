import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { desafioParaAbrir } from "@/lib/pratica.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/desafios/:id — o projeto vem com a semana do curso dele e os assuntos que pratica. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, desafio: await desafioParaAbrir(id, usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
