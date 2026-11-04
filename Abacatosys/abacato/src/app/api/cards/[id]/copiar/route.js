import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso, tocarQuadro } from "@/lib/acesso.js";
import { posicaoEntre } from "@/dominio/Quadro.js";
import { ajustarCardNoDestino } from "@/lib/mudarDeQuadro.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cards/:id/copiar   body: { colunaId?, titulo? }
 *
 * Copia o card com etiquetas, responsáveis, links e checklists — os itens das checklists vêm
 * juntos, mas todos DESMARCADOS. Um card copiado é trabalho a fazer de novo; trazer as marcas
 * faria a cópia nascer parecendo concluída, que é o erro mais caro dos dois.
 *
 * O que não é copiado é `origem`/`origem_id`: a cópia não veio do Trello nem de uma recorrência,
 * e herdar essa marca faria uma reimportação sobrescrever a cópia.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { quadroId } = await exigir(req, "card", id, "criar");
    const corpo = await req.json().catch(() => ({}));

    const { data: original } = await supabase
      .from("abacato_cards")
      .select("id, coluna_id, titulo, descricao, inicio_em, fim_em, capa")
      .eq("id", id).maybeSingle();
    if (!original) throw new ErroDeAcesso(404, "card não encontrado");

    // A cópia pode ir para QUALQUER coluna que você possa preencher — inclusive de outro
    // quadro. Diferente de mover, copiar não tira nada de lugar nenhum: o original continua
    // onde estava, e por isso a travessia de quadro aqui é bem menos perigosa do que lá.
    //
    // A exigência continua sendo poder CRIAR no destino, conferida no destino em si.
    let colunaDestino = original.coluna_id;
    let quadroDestino = quadroId;
    if (corpo.colunaId && corpo.colunaId !== original.coluna_id) {
      const { data: destino } = await supabase
        .from("abacato_colunas").select("id, quadro_id, arquivada").eq("id", corpo.colunaId).maybeSingle();
      if (!destino || destino.arquivada) throw new ErroDeAcesso(404, "coluna de destino não existe");
      await exigir(req, "coluna", destino.id, "criar");
      colunaDestino = destino.id;
      quadroDestino = destino.quadro_id;
    }
    const mesmoQuadro = quadroDestino === quadroId;

    const { data: ultimo } = await supabase
      .from("abacato_cards").select("posicao").eq("coluna_id", colunaDestino).eq("arquivado", false)
      .order("posicao", { ascending: false }).limit(1).maybeSingle();

    const { data: novo, error } = await supabase.from("abacato_cards").insert({
      coluna_id: colunaDestino,
      titulo: (corpo.titulo || `${original.titulo} (cópia)`).trim(),
      descricao: original.descricao,
      posicao: posicaoEntre(ultimo?.posicao ?? null, null),
      inicio_em: original.inicio_em,
      fim_em: original.fim_em,
      capa: original.capa,
    }).select("id").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    const [etiquetas, responsaveis, links, checklists] = await Promise.all([
      supabase.from("abacato_card_etiquetas").select("etiqueta_id").eq("card_id", id),
      supabase.from("abacato_card_responsaveis").select("usuario_id").eq("card_id", id),
      supabase.from("abacato_links").select("url, titulo").eq("card_id", id),
      supabase.from("abacato_checklists").select("id, titulo, posicao").eq("card_id", id).order("posicao"),
    ]);

    const tarefas = [];
    // Dentro do mesmo quadro, etiqueta e responsável vão como estão. Atravessando a fronteira,
    // eles precisam de tradução — o `etiqueta_id` do quadro de origem não existe no destino,
    // e um responsável de lá pode não alcançar este quadro. A tradução acontece depois, com o
    // card já criado.
    if (mesmoQuadro && etiquetas.data?.length) {
      tarefas.push(supabase.from("abacato_card_etiquetas")
        .insert(etiquetas.data.map((e) => ({ card_id: novo.id, etiqueta_id: e.etiqueta_id }))));
    }
    if (mesmoQuadro && responsaveis.data?.length) {
      tarefas.push(supabase.from("abacato_card_responsaveis")
        .insert(responsaveis.data.map((r) => ({ card_id: novo.id, usuario_id: r.usuario_id }))));
    }
    if (links.data?.length) {
      tarefas.push(supabase.from("abacato_links")
        .insert(links.data.map((l) => ({ card_id: novo.id, url: l.url, titulo: l.titulo }))));
    }
    await Promise.all(tarefas);

    for (const cl of checklists.data || []) {
      const { data: nova } = await supabase.from("abacato_checklists")
        .insert({ card_id: novo.id, titulo: cl.titulo, posicao: cl.posicao }).select("id").single();
      const { data: itens } = await supabase.from("abacato_checklist_itens")
        .select("texto, posicao").eq("checklist_id", cl.id).order("posicao");
      if (nova && itens?.length) {
        await supabase.from("abacato_checklist_itens")
          .insert(itens.map((i) => ({ checklist_id: nova.id, texto: i.texto, feito: false, posicao: i.posicao })));
      }
    }

    let ajuste = { etiquetasCriadas: [], responsaveisRemovidos: [] };
    if (!mesmoQuadro) {
      ajuste = await ajustarCardNoDestino(
        novo.id,
        (etiquetas.data || []).map((e) => e.etiqueta_id),
        (responsaveis.data || []).map((r) => r.usuario_id),
        quadroDestino
      );
    }

    await Promise.all([
      tocarQuadro(quadroId),
      mesmoQuadro ? Promise.resolve() : tocarQuadro(quadroDestino),
    ]);
    return json({
      ok: true,
      cardId: novo.id,
      colunaId: colunaDestino,
      quadroId: quadroDestino,
      mudouDeQuadro: !mesmoQuadro,
      ...ajuste,
    }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
