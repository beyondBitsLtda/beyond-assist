import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { entregarAndar } from "@/lib/dominio.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/dominio/:id/entregar — a Lisa avalia o commit novo da branch e o Neuro luta. */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, resultado: await entregarAndar(usuario.id, id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
