import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { corValida } from "@/dominio/cores.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/quadros/:id/etiquetas   body: { nome, cor } */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "quadro", id, "criar");
    const { nome, cor } = await req.json().catch(() => ({}));
    if (!corValida(cor)) throw new ErroDeAcesso(400, "cor fora da paleta");

    const { data, error } = await supabase.from("abacato_etiquetas")
      .insert({ quadro_id: id, nome: (nome || "").trim(), cor })
      .select("id, nome, cor").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, etiqueta: data }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
