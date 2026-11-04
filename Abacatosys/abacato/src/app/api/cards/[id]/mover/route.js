import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso, tocarQuadro } from "@/lib/acesso.js";
import { posicaoEntre } from "@/dominio/Quadro.js";
import { ajustarCardNoDestino, comoEstaOCard } from "@/lib/mudarDeQuadro.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cards/:id/mover   body: { colunaId }
 *
 * Leva um card para outra coluna, INCLUSIVE de outro quadro.
 *
 * ------------------------------------------------------------------------------------------
 * POR QUE ISTO É UMA ROTA SEPARADA, E NÃO UM CAMPO DO PATCH
 *
 * O PATCH do card também move, e continua recusando coluna de outro quadro. Isso não é
 * duplicação: é a diferença entre um gesto e uma decisão.
 *
 * Arrastar é o gesto, e acontece dezenas de vezes por dia, às vezes sem querer. Se o PATCH
 * aceitasse atravessar quadros, bastaria um `colunaId` errado — vindo de uma tela com dados
 * velhos, de um clique torto, de um teste — para um card sumir de um quadro e reaparecer em
 * outro, levando junto quem pode lê-lo.
 *
 * Mudar de quadro é a decisão, e pede um pedido próprio, com nome próprio.
 *
 * DUAS PERMISSÕES, NÃO UMA. Você precisa poder EDITAR o card de onde ele está e CRIAR no
 * quadro para onde ele vai. Conferir só a origem deixaria qualquer pessoa despejar cards num
 * quadro alheio; conferir só o destino deixaria roubar card de quadro dos outros.
 * ------------------------------------------------------------------------------------------
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { quadroId: quadroOrigem } = await exigir(req, "card", id, "editar");

    const { colunaId } = await req.json().catch(() => ({}));
    if (!colunaId) throw new ErroDeAcesso(400, "faltou a coluna de destino");

    const { data: destino } = await supabase
      .from("abacato_colunas").select("id, nome, quadro_id, arquivada").eq("id", colunaId).maybeSingle();
    if (!destino || destino.arquivada) throw new ErroDeAcesso(404, "coluna de destino não existe");

    // A segunda permissão: criar no destino.
    await exigir(req, "coluna", destino.id, "criar");

    const { data: card } = await supabase
      .from("abacato_cards").select("id, coluna_id").eq("id", id).maybeSingle();
    if (!card) throw new ErroDeAcesso(404, "card não encontrado");
    if (card.coluna_id === destino.id) return json({ ok: true, semMudanca: true });

    const mesmoQuadro = destino.quadro_id === quadroOrigem;

    // Vai para o fim da coluna de destino. Escolher posição no meio é coisa de arrasto, que
    // tem a tela para apontar onde; aqui ninguém está apontando nada.
    const { data: ultimo } = await supabase
      .from("abacato_cards").select("posicao").eq("coluna_id", destino.id).eq("arquivado", false)
      .order("posicao", { ascending: false }).limit(1).maybeSingle();

    // O que o card carrega HOJE precisa ser lido ANTES da mudança: depois de trocar de quadro,
    // as etiquetas dele já são de um quadro que não é mais o dele.
    const antes = mesmoQuadro ? null : await comoEstaOCard(id);

    const { error } = await supabase.from("abacato_cards")
      .update({ coluna_id: destino.id, posicao: posicaoEntre(ultimo?.posicao ?? null, null) })
      .eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);

    let ajuste = { etiquetasCriadas: [], responsaveisRemovidos: [] };
    if (!mesmoQuadro) {
      ajuste = await ajustarCardNoDestino(id, antes.etiquetaIds, antes.responsavelIds, destino.quadro_id);
    }

    // Os dois quadros ficam "tocados": o de origem perdeu um card, o de destino ganhou.
    await Promise.all([
      tocarQuadro(quadroOrigem),
      mesmoQuadro ? Promise.resolve() : tocarQuadro(destino.quadro_id),
    ]);

    return json({
      ok: true,
      colunaId: destino.id,
      quadroId: destino.quadro_id,
      mudouDeQuadro: !mesmoQuadro,
      ...ajuste,
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
