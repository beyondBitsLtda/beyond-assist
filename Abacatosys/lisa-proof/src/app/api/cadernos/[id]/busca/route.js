import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { buscarNoCaderno } from "@/lib/cadernos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cadernos/:id/busca?q= — procura em todas as páginas do caderno. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const q = new URL(req.url).searchParams.get("q") || "";
    return json({ ok: true, resultados: await buscarNoCaderno(usuario.id, id, q) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
