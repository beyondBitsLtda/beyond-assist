import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { editarMarcacao, apagarMarcacao } from "@/lib/biblioteca.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/marcacoes/:id { cor?, nota?, tipo? } */
export async function PATCH(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, marcacao: await editarMarcacao(usuario.id, id, await corpoDe(req)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/marcacoes/:id */
export async function DELETE(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    await apagarMarcacao(usuario.id, id);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
