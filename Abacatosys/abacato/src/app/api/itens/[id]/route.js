import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/itens/:id   body: { feito?, texto? } — marcar e renomear um item de checklist. */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "item", id, "editar");
    const corpo = await req.json().catch(() => ({}));

    const mudancas = {};
    if (typeof corpo.feito === "boolean") mudancas.feito = corpo.feito;
    if (typeof corpo.texto === "string" && corpo.texto.trim()) mudancas.texto = corpo.texto.trim();
    if (!Object.keys(mudancas).length) throw new ErroDeAcesso(400, "nada para mudar");

    const { data, error } = await supabase.from("abacato_checklist_itens")
      .update(mudancas).eq("id", id).select("id, texto, feito, posicao").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, item: data });
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "item", id, "apagar");
    const { error } = await supabase.from("abacato_checklist_itens").delete().eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
