import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { corValida } from "@/dominio/cores.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/etiquetas/:id   body: { nome?, cor? } */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "etiqueta", id, "editar");
    const corpo = await req.json().catch(() => ({}));

    const mudancas = {};
    if ("nome" in corpo) mudancas.nome = (corpo.nome || "").trim();
    if ("cor" in corpo) {
      if (!corValida(corpo.cor)) throw new ErroDeAcesso(400, "cor fora da paleta");
      mudancas.cor = corpo.cor;
    }
    if (!Object.keys(mudancas).length) throw new ErroDeAcesso(400, "nada para mudar");

    const { data, error } = await supabase.from("abacato_etiquetas").update(mudancas).eq("id", id)
      .select("id, nome, cor").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, etiqueta: data });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/etiquetas/:id — apaga de verdade, e sai dos cards junto pelo `on delete cascade`.
 *  Aqui apagar é seguro: uma etiqueta é um rótulo, não um dado. O texto dos cards fica. */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "etiqueta", id, "apagar");
    const { error } = await supabase.from("abacato_etiquetas").delete().eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
