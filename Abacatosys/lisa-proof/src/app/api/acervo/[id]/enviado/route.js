import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { confirmarEnvio } from "@/lib/acervo.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/acervo/:id/enviado — o PDF chegou ao armazenamento: o material entra na fila. */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, material: await confirmarEnvio(usuario.id, id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
