import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { posicaoEntre } from "@/dominio/Quadro.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cards/:id/checklists   body: { titulo } ou { copiarDe: <id de checklist> }
 *
 * O `copiarDe` é o "colar" do copiar-e-colar de checklists: a mesma lista de itens, em outro
 * card, todos DESMARCADOS. Quem copia uma checklist de conferência está começando a conferência
 * de novo — colar as marcas antigas faria o trabalho parecer feito antes de começar.
 *
 * A checklist de origem pode ser de qualquer card que a pessoa possa ver, inclusive de outro
 * quadro: é o caso que dá utilidade ao recurso, levar o roteiro de um projeto para o próximo.
 * Por isso a permissão é conferida duas vezes, no destino e na origem.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "card", id, "criar");
    const corpo = await req.json().catch(() => ({}));

    const { data: ultima } = await supabase
      .from("abacato_checklists").select("posicao").eq("card_id", id)
      .order("posicao", { ascending: false }).limit(1).maybeSingle();
    const posicao = posicaoEntre(ultima?.posicao ?? null, null);

    if (corpo.copiarDe) {
      await exigir(req, "checklist", corpo.copiarDe, "ver");
      const { data: origem } = await supabase
        .from("abacato_checklists").select("titulo").eq("id", corpo.copiarDe).maybeSingle();
      if (!origem) throw new ErroDeAcesso(404, "checklist de origem não encontrada");

      const { data: nova, error } = await supabase.from("abacato_checklists")
        .insert({ card_id: id, titulo: origem.titulo, posicao })
        .select("id, titulo, posicao").single();
      if (error) throw new ErroDeAcesso(500, error.message);

      const { data: itens } = await supabase.from("abacato_checklist_itens")
        .select("texto, posicao").eq("checklist_id", corpo.copiarDe).order("posicao");

      let criados = [];
      if (itens?.length) {
        const r = await supabase.from("abacato_checklist_itens")
          .insert(itens.map((i) => ({ checklist_id: nova.id, texto: i.texto, feito: false, posicao: i.posicao })))
          .select("id, texto, feito, posicao");
        criados = r.data || [];
      }
      return json({ ok: true, checklist: { ...nova, itens: criados } }, 201);
    }

    const { data, error } = await supabase.from("abacato_checklists")
      .insert({ card_id: id, titulo: (corpo.titulo || "Checklist").trim(), posicao })
      .select("id, titulo, posicao").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, checklist: { ...data, itens: [] } }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
