import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";

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

    if (workspaceId) {
      const { data: ws } = await supabase.from("abacato_workspaces")
        .select("id").eq("id", workspaceId).eq("dono_id", usuario.id).maybeSingle();
      if (!ws) throw new ErroDeAcesso(404, "workspace não encontrado");
    }

    // Tira de onde estiver e põe no novo — em duas escritas, e não num upsert, porque a chave
    // única é (dono, quadro): trocar de workspace é trocar a linha, não acrescentar outra.
    const { error: erroAoTirar } = await supabase.from("abacato_workspace_quadros")
      .delete().eq("dono_id", usuario.id).eq("quadro_id", id);
    if (erroAoTirar) throw new ErroDeAcesso(500, erroAoTirar.message);

    if (workspaceId) {
      const { error } = await supabase.from("abacato_workspace_quadros")
        .insert({ workspace_id: workspaceId, quadro_id: id, dono_id: usuario.id });
      if (error) throw new ErroDeAcesso(500, error.message);
    }
    return json({ ok: true, workspaceId: workspaceId || null });
  } catch (e) {
    return respostaDeErro(e);
  }
}
