import { json } from "@/lib/http.js";
import { exigir, respostaDeErro } from "@/lib/acesso.js";
import { porNoWorkspace } from "@/lib/workspacesNoBanco.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/projetos/:id/workspace   body: { workspaceId }   (null tira de qualquer workspace)
 *
 * A mesma regra dos quadros: basta poder VER o projeto. Guardá-lo num workspace organiza a lista
 * de quem guardou, e não muda nada para mais ninguém.
 */
export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const { usuario } = await exigir(req, "projeto", id, "ver");
    const { workspaceId } = await req.json().catch(() => ({}));
    await porNoWorkspace(usuario.id, "projeto", id, workspaceId || null);
    return json({ ok: true, workspaceId: workspaceId || null });
  } catch (e) {
    return respostaDeErro(e);
  }
}
