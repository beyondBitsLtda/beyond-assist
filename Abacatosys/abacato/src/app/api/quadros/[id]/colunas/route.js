import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso, tocarQuadro } from "@/lib/acesso.js";
import { posicaoEntre } from "@/dominio/Quadro.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/quadros/:id/colunas   body: { nome } — acrescenta uma coluna no fim. */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "quadro", id, "criar");
    const { nome } = await req.json().catch(() => ({}));
    if (!nome?.trim()) throw new ErroDeAcesso(400, "a coluna precisa de um nome");

    const { data: ultima } = await supabase
      .from("abacato_colunas").select("posicao").eq("quadro_id", id).eq("arquivada", false)
      .order("posicao", { ascending: false }).limit(1).maybeSingle();

    const { data, error } = await supabase.from("abacato_colunas")
      .insert({ quadro_id: id, nome: nome.trim(), posicao: posicaoEntre(ultima?.posicao ?? null, null) })
      .select("id, nome, posicao, capa").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    await tocarQuadro(id);
    return json({ ok: true, coluna: { ...data, cards: [] } }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
