import { json } from "@/lib/http.js";
import { exigir, respostaDeErro } from "@/lib/acesso.js";
import { porNoWorkspace } from "@/lib/workspacesNoBanco.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/quadros/:id/workspace   body: { workspaceId }   (null tira de qualquer workspace)
 *
 * Basta PODER VER o quadro. Organizar a própria lista não é mexer no quadro: um leitor também
 * tem o direito de guardá-lo na pasta que quiser, e isso não muda nada para mais ninguém.
 */
export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const { usuario } = await exigir(req, "quadro", id, "ver");
    const { workspaceId } = await req.json().catch(() => ({}));
    await porNoWorkspace(usuario.id, "quadro", id, workspaceId || null);
    return json({ ok: true, workspaceId: workspaceId || null });
  } catch (e) {
    return respostaDeErro(e);
  }
}
