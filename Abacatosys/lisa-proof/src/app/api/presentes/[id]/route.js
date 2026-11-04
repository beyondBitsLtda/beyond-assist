import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { abrirPresente } from "@/lib/presentes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/presentes/:id — abre o presente (o personagem entra na coleção, sem cobrar). */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, presente: await abrirPresente(usuario.id, id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
