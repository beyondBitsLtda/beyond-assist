import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/cards/:id/responsaveis   body: { responsaveis: [usuarioId, ...] }
 *
 * Mesma ideia das etiquetas: a lista completa, não um par adicionar/remover.
 *
 * Só entra quem já tem acesso ao quadro. Pôr como responsável alguém que não enxerga o quadro
 * cria uma tarefa atribuída a quem nunca vai vê-la — o jeito silencioso de um trabalho
 * simplesmente não acontecer.
 */
export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const { quadroId } = await exigir(req, "card", id, "editar");
    const { responsaveis } = await req.json().catch(() => ({}));
    const pedidos = [...new Set((responsaveis || []).filter(Boolean))];

    if (pedidos.length) {
      const [{ data: quadro }, { data: membros }] = await Promise.all([
        supabase.from("abacato_quadros").select("dono_id").eq("id", quadroId).maybeSingle(),
        supabase.from("abacato_membros").select("usuario_id").eq("quadro_id", quadroId),
      ]);
      const podem = new Set([quadro?.dono_id, ...(membros || []).map((m) => m.usuario_id)].filter(Boolean));
      const forasteiro = pedidos.find((u) => !podem.has(u));
      if (forasteiro) throw new ErroDeAcesso(400, "essa pessoa não tem acesso a este quadro");
    }

    await supabase.from("abacato_card_responsaveis").delete().eq("card_id", id);
    if (pedidos.length) {
      const { error } = await supabase.from("abacato_card_responsaveis")
        .insert(pedidos.map((usuario_id) => ({ card_id: id, usuario_id })));
      if (error) throw new ErroDeAcesso(500, error.message);
    }
    return json({ ok: true, responsaveis: pedidos });
  } catch (e) {
    return respostaDeErro(e);
  }
}
