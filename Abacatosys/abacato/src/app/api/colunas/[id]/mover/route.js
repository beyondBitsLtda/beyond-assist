import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso, tocarQuadro } from "@/lib/acesso.js";
import { ajustarCardNoDestino, comoEstaOCard } from "@/lib/mudarDeQuadro.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/colunas/:id/mover   body: { quadroId }
 *
 * Leva uma coluna inteira para outro quadro, com os cards dentro.
 *
 * ------------------------------------------------------------------------------------------
 * A COLUNA VAI COM TUDO, E É POR ISSO QUE ISTO NÃO É UM UPDATE DE UMA LINHA
 *
 * Trocar o `quadro_id` da coluna seria uma linha de SQL e deixaria o quadro de destino cheio
 * de cards com etiquetas de um quadro que não é o dele e responsáveis que não o alcançam. O
 * banco aceitaria; a tela mostraria etiquetas invisíveis e tarefas atribuídas a quem nunca
 * vai vê-las.
 *
 * Cada card passa pela mesma tradução do "mover card": etiqueta casada por nome e cor (criada
 * no destino quando não existe), responsável que não alcança o quadro sai da lista. O que se
 * perdeu volta na resposta, somado, para a tela poder dizer.
 *
 * DUAS PERMISSÕES: editar no quadro de origem e criar no de destino.
 * ------------------------------------------------------------------------------------------
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { quadroId: quadroOrigem } = await exigir(req, "coluna", id, "editar");

    const { quadroId: destinoId } = await req.json().catch(() => ({}));
    if (!destinoId) throw new ErroDeAcesso(400, "faltou o quadro de destino");
    if (destinoId === quadroOrigem) return json({ ok: true, semMudanca: true });

    // A segunda permissão. `exigir` com tipo "quadro" já devolve 404 para quadro alheio, que é
    // o certo: não confirma nem a existência dele.
    await exigir(req, "quadro", destinoId, "criar");

    const { data: coluna } = await supabase
      .from("abacato_colunas").select("id, nome, quadro_id").eq("id", id).maybeSingle();
    if (!coluna) throw new ErroDeAcesso(404, "coluna não encontrada");

    const { data: cards } = await supabase
      .from("abacato_cards").select("id").eq("coluna_id", id);

    // O que cada card carrega HOJE, lido ANTES de a coluna trocar de dono: depois da mudança
    // as etiquetas dele já pertencem a um quadro que não é mais o seu.
    const antes = new Map();
    for (const c of cards || []) antes.set(c.id, await comoEstaOCard(c.id));

    const { data: ultima } = await supabase
      .from("abacato_colunas").select("posicao").eq("quadro_id", destinoId)
      .order("posicao", { ascending: false }).limit(1).maybeSingle();

    const { error } = await supabase.from("abacato_colunas")
      .update({ quadro_id: destinoId, posicao: (ultima?.posicao || 0) + 1024 })
      .eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);

    // Agora cada card é traduzido. Em série, e não em paralelo: as traduções CRIAM etiquetas
    // no destino, e duas ao mesmo tempo com o mesmo nome criariam a etiqueta duas vezes.
    const criadas = new Set();
    const removidos = new Set();
    for (const c of cards || []) {
      const dados = antes.get(c.id);
      const r = await ajustarCardNoDestino(c.id, dados.etiquetaIds, dados.responsavelIds, destinoId);
      r.etiquetasCriadas.forEach((n) => criadas.add(n));
      r.responsaveisRemovidos.forEach((n) => removidos.add(n));
    }

    await Promise.all([tocarQuadro(quadroOrigem), tocarQuadro(destinoId)]);

    return json({
      ok: true,
      colunaId: id,
      quadroId: destinoId,
      cards: (cards || []).length,
      etiquetasCriadas: [...criadas],
      responsaveisRemovidos: [...removidos],
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
