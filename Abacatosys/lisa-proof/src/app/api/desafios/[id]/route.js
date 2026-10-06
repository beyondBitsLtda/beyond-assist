import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { trilhaDoUsuario } from "@/lib/estudo.js";
import { desafioDoUsuario, desafioParaTela } from "@/lib/pratica.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/desafios/:id */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const d = await desafioDoUsuario(id, usuario.id);
    const trilha = await trilhaDoUsuario(d.trilha_id, usuario.id);
    return json({ ok: true, desafio: desafioParaTela(d, trilha.tema) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
