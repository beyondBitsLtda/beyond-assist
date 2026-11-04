import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/checklists/:id   body: { titulo } */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "checklist", id, "editar");
    const { titulo } = await req.json().catch(() => ({}));
    if (!titulo?.trim()) throw new ErroDeAcesso(400, "a checklist precisa de um título");

    const { data, error } = await supabase.from("abacato_checklists")
      .update({ titulo: titulo.trim() }).eq("id", id).select("id, titulo, posicao").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, checklist: data });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/checklists/:id — apaga a checklist e os itens dela, pelo cascade do esquema.
 *  Aqui apagar de verdade é certo: uma checklist descartada não é histórico de nada, e mantê-la
 *  arquivada só encheria o card de listas invisíveis. */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "checklist", id, "apagar");
    const { error } = await supabase.from("abacato_checklists").delete().eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
