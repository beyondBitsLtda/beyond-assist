import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { lerApostila } from "@/lib/apostilas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/apostilas/:id — a apostila inteira para ler: o caderno, as páginas com o conteúdo e o assunto de origem. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, ...(await lerApostila(usuario.id, id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
