import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { posicaoEntre } from "@/dominio/Quadro.js";
import { linhasDeItens } from "@/dominio/colar.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/checklists/:id/itens   body: { texto }
 *
 * Aceita VÁRIAS linhas de uma vez: colar um trecho de ata ou uma lista pronta vira um item por
 * linha, já sem os marcadores. Quem está transcrevendo uma reunião não vai digitar item por
 * item, e obrigar a isso é exatamente o motivo de a checklist acabar vazia.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "checklist", id, "criar");
    const { texto } = await req.json().catch(() => ({}));

    const linhas = linhasDeItens(texto);
    if (!linhas.length) throw new ErroDeAcesso(400, "o item precisa de um texto");

    const { data: ultimo } = await supabase
      .from("abacato_checklist_itens").select("posicao").eq("checklist_id", id)
      .order("posicao", { ascending: false }).limit(1).maybeSingle();

    let posicao = posicaoEntre(ultimo?.posicao ?? null, null);
    const novos = linhas.map((t) => {
      const linha = { checklist_id: id, texto: t, posicao };
      posicao += 1024;
      return linha;
    });

    const { data, error } = await supabase.from("abacato_checklist_itens")
      .insert(novos).select("id, texto, feito, posicao");
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, itens: data }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
