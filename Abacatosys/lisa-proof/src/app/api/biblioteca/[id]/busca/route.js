import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { buscarNoLivro } from "@/lib/biblioteca.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/biblioteca/:id/busca?q= — as páginas onde o termo aparece, com o trecho em volta. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const q = new URL(req.url).searchParams.get("q") || "";
    return json({ ok: true, resultados: await buscarNoLivro(usuario.id, id, q) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
