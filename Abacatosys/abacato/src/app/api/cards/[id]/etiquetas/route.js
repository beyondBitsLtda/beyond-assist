import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/cards/:id/etiquetas   body: { etiquetas: [id, ...] }
 *
 * PUT e não POST: o corpo é a lista COMPLETA de etiquetas do card, e o servidor faz o banco
 * parecer com ela. Um par de rotas "adicionar" e "remover" obrigaria a tela a calcular a
 * diferença, e uma tela que erra a diferença deixa etiqueta grudada em card sem que ninguém
 * descubra o porquê.
 */
export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const { quadroId } = await exigir(req, "card", id, "editar");
    const { etiquetas } = await req.json().catch(() => ({}));
    const pedidas = [...new Set((etiquetas || []).filter(Boolean))];

    // As etiquetas têm de ser DESTE quadro. Sem isto, um id de etiqueta de outro quadro
    // entraria aqui e o card exibiria uma cor cujo nome ninguém deste quadro consegue editar.
    if (pedidas.length) {
      const { data: validas } = await supabase.from("abacato_etiquetas")
        .select("id").eq("quadro_id", quadroId).in("id", pedidas);
      if ((validas || []).length !== pedidas.length) {
        throw new ErroDeAcesso(400, "alguma etiqueta não é deste quadro");
      }
    }

    await supabase.from("abacato_card_etiquetas").delete().eq("card_id", id);
    if (pedidas.length) {
      const { error } = await supabase.from("abacato_card_etiquetas")
        .insert(pedidas.map((etiqueta_id) => ({ card_id: id, etiqueta_id })));
      if (error) throw new ErroDeAcesso(500, error.message);
    }
    return json({ ok: true, etiquetas: pedidas });
  } catch (e) {
    return respostaDeErro(e);
  }
}
