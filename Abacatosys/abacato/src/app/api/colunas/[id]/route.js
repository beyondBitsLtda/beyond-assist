import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso, tocarQuadro } from "@/lib/acesso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/colunas/:id   body: { nome?, posicao?, capa?, arquivada? } */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const { quadroId } = await exigir(req, "coluna", id, "editar");
    const corpo = await req.json().catch(() => ({}));

    const mudancas = {};
    if (typeof corpo.nome === "string" && corpo.nome.trim()) mudancas.nome = corpo.nome.trim();
    if (typeof corpo.posicao === "number" && Number.isFinite(corpo.posicao)) mudancas.posicao = corpo.posicao;
    if ("capa" in corpo) mudancas.capa = corpo.capa || null;
    if (typeof corpo.arquivada === "boolean") mudancas.arquivada = corpo.arquivada;
    if (!Object.keys(mudancas).length) throw new ErroDeAcesso(400, "nada para mudar");

    const { data, error } = await supabase.from("abacato_colunas").update(mudancas).eq("id", id)
      .select("id, nome, posicao, capa, arquivada").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    await tocarQuadro(quadroId);
    return json({ ok: true, coluna: data });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * DELETE /api/colunas/:id — arquiva a coluna e os cards dela.
 *
 * Os cards vão junto porque um card cuja coluna sumiu não tem onde aparecer: ele viraria uma
 * linha viva e invisível, ocupando lugar em toda consulta e em nenhuma tela. Arquivar os dois
 * mantém a conta fechada.
 */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const { quadroId } = await exigir(req, "coluna", id, "apagar");

    await supabase.from("abacato_cards").update({ arquivado: true }).eq("coluna_id", id);
    const { error } = await supabase.from("abacato_colunas").update({ arquivada: true }).eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);

    await tocarQuadro(quadroId);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
