import { supabase } from "./supabase.js";
import { Quadro } from "@/dominio/Quadro.js";

/**
 * Vários quadros inteiros, em SETE consultas — não sete por quadro.
 *
 * A primeira versão do painel chamava `carregarQuadro` num laço, um quadro por vez. Funcionava
 * e levava VINTE E NOVE SEGUNDOS com seis quadros: cada quadro são umas oito idas ao Postgres
 * de casa, e cada ida custa uns trezentos milissegundos pelo túnel. Quarenta e oito viagens em
 * fila. Pior que lento, era frágil: um quadro que demorasse demais era engolido pelo `catch` e
 * simplesmente não aparecia no painel, sem nada dizendo que faltava.
 *
 * Aqui cada tabela é lida UMA vez, para todos os quadros de uma vez, com `in (...)`. Sete
 * viagens no total, seja para dois quadros ou vinte. O agrupamento é feito aqui, em memória,
 * que é onde ele custa microssegundos.
 */
export async function carregarQuadrosParaPainel(ids) {
  if (!ids?.length) return [];

  const { data: quadros } = await supabase
    .from("abacato_quadros")
    .select("id, nome, descricao, papel_de_parede, dono_id")
    .in("id", ids).eq("arquivado", false);
  if (!quadros?.length) return [];

  const idsDeQuadro = quadros.map((q) => q.id);

  const { data: colunas } = await supabase
    .from("abacato_colunas").select("id, quadro_id, nome, posicao, capa")
    .in("quadro_id", idsDeQuadro).eq("arquivada", false).order("posicao");

  const idsDeColuna = (colunas || []).map((c) => c.id);
  if (!idsDeColuna.length) return quadros.map((q) => new Quadro({ ...q, papelDeParede: q.papel_de_parede, donoId: q.dono_id, colunas: [] }));

  const [cards, etiquetas] = await Promise.all([
    supabase.from("abacato_cards")
      .select("id, coluna_id, titulo, posicao, inicio_em, fim_em, concluido, recorrencia_regra")
      .in("coluna_id", idsDeColuna).eq("arquivado", false),
    supabase.from("abacato_etiquetas").select("id, quadro_id, nome, cor").in("quadro_id", idsDeQuadro),
  ]);

  const idsDeCard = (cards.data || []).map((c) => c.id);

  // As checklists entram porque `estadoDoPrazo` considera "todas completas" como concluído. Sem
  // elas, o painel chamaria de atrasado um card cujo trabalho acabou — e o quadro, que carrega
  // as checklists, diria o contrário na tela ao lado.
  const [vinculos, responsaveis, checklists] = idsDeCard.length
    ? await Promise.all([
        supabase.from("abacato_card_etiquetas").select("card_id, etiqueta_id").in("card_id", idsDeCard),
        supabase.from("abacato_card_responsaveis")
          .select("card_id, abacato_usuarios ( id, nome, email )").in("card_id", idsDeCard),
        supabase.from("abacato_checklists").select("id, card_id").in("card_id", idsDeCard),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const idsDeChecklist = (checklists.data || []).map((c) => c.id);
  const itens = idsDeChecklist.length
    ? (await supabase.from("abacato_checklist_itens")
        .select("checklist_id, feito").in("checklist_id", idsDeChecklist)).data || []
    : [];

  const agrupar = (linhas, chave) => {
    const m = new Map();
    for (const l of linhas || []) {
      if (!m.has(l[chave])) m.set(l[chave], []);
      m.get(l[chave]).push(l);
    }
    return m;
  };

  const etiquetaPorId = new Map((etiquetas.data || []).map((e) => [e.id, e]));
  const etiquetasDoQuadro = agrupar(etiquetas.data, "quadro_id");
  const etiquetasDoCard = agrupar(vinculos.data, "card_id");
  const pessoasDoCard = agrupar(responsaveis.data, "card_id");
  const checklistsDoCard = agrupar(checklists.data, "card_id");
  const itensDaChecklist = agrupar(itens, "checklist_id");
  const cardsDaColuna = agrupar(cards.data, "coluna_id");
  const colunasDoQuadro = agrupar(colunas, "quadro_id");

  return quadros.map((q) => new Quadro({
    id: q.id,
    nome: q.nome,
    descricao: q.descricao,
    papelDeParede: q.papel_de_parede,
    donoId: q.dono_id,
    etiquetas: etiquetasDoQuadro.get(q.id) || [],
    colunas: (colunasDoQuadro.get(q.id) || []).map((col) => ({
      id: col.id,
      nome: col.nome,
      posicao: col.posicao,
      capa: col.capa,
      cards: (cardsDaColuna.get(col.id) || []).map((c) => ({
        id: c.id,
        colunaId: c.coluna_id,
        titulo: c.titulo,
        posicao: c.posicao,
        inicioEm: c.inicio_em,
        fimEm: c.fim_em,
        concluido: c.concluido,
        recorrenciaRegra: c.recorrencia_regra,
        etiquetas: (etiquetasDoCard.get(c.id) || []).map((x) => etiquetaPorId.get(x.etiqueta_id)).filter(Boolean),
        responsaveis: (pessoasDoCard.get(c.id) || []).map((x) => x.abacato_usuarios).filter(Boolean),
        // Só o ESTADO de cada item interessa ao painel — o texto não entra em conta nenhuma, e
        // trazê-lo dobraria o tamanho da resposta do banco sem mudar um único número.
        checklists: (checklistsDoCard.get(c.id) || []).map((cl) => ({
          id: cl.id,
          itens: (itensDaChecklist.get(cl.id) || []).map((i) => ({ id: `${cl.id}`, texto: "x", feito: i.feito })),
        })),
      })),
    })),
  }));
}
