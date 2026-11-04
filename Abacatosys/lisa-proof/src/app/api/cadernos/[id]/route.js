import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { lerCaderno, editarCaderno, apagarCaderno } from "@/lib/cadernos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cadernos/:id — o caderno e a árvore de módulos e páginas (sem o conteúdo). */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, ...(await lerCaderno(usuario.id, id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** PATCH /api/cadernos/:id { titulo?, descricao?, cor?, icone? } */
export async function PATCH(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, caderno: await editarCaderno(usuario.id, id, await corpoDe(req)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/cadernos/:id — o caderno, as páginas e os vínculos dele. */
export async function DELETE(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    await apagarCaderno(usuario.id, id);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
