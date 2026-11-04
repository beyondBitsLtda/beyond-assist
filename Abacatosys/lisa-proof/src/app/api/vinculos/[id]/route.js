import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { desvincular } from "@/lib/vinculos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/vinculos/:id — desfaz o vínculo (o caderno e o alvo ficam). */
export async function DELETE(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    await desvincular(usuario.id, id);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
