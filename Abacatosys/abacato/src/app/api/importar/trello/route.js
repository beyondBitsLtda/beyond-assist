import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { quemEh, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { lerExportacaoDoTrello } from "@/dominio/trello.js";
import { corValida } from "@/dominio/cores.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Em lotes, e não tudo de uma vez: um quadro do Trello com mil cards vira uma instrução SQL de
// alguns megabytes, e o PostgREST tem limite de corpo. Quinhentas linhas por vez cabe em tudo
// e continua sendo uma ida ao banco por lote, não uma por linha.
const LOTE = 500;

async function inserirEmLotes(tabela, linhas, conflito) {
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await supabase
      .from(tabela)
      // `ignoreDuplicates` é o que torna a importação repetível: vira `on conflict do nothing`.
      // Rodar de novo completa o que faltou e não toca no que já está aqui.
      .upsert(linhas.slice(i, i + LOTE), { onConflict: conflito, ignoreDuplicates: true });
    if (error) throw new ErroDeAcesso(500, `${tabela}: ${error.message}`);
  }
}

/**
 * POST /api/importar/trello
 *
 * Corpo: `{ trello: <exportação enxuta>, confirmar: true }`.
 *
 * ---------------------------------------------------------------------------------------
 * A regra da reimportação, em uma frase: **cria o que falta e não mexe no que já entrou.**
 *
 * A alternativa — sincronizar nos dois sentidos — parece melhor e é pior. Um card que você
 * moveu de coluna aqui voltaria para onde está no Trello; um item de checklist que você marcou
 * aqui voltaria desmarcado. Quem importa está ABANDONANDO o Trello, e o Abacato passa a ser a
 * verdade no instante da primeira importação. Reimportar serve para terminar uma importação
 * que falhou no meio, ou para buscar os cards que entraram no Trello depois — não para
 * ressuscitar o Trello por cima do trabalho de cá.
 * ---------------------------------------------------------------------------------------
 */
export async function POST(req) {
  try {
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");

    const corpo = await req.json().catch(() => null);
    if (!corpo?.trello) throw new ErroDeAcesso(400, "faltou o arquivo do Trello");

    // O mesmo leitor que o navegador usou para desenhar a prévia. Ele roda de novo AQUI porque
    // o que chega pela rede é o arquivo, não a decisão: se a conversão morasse só no
    // navegador, quem mandasse um corpo à mão escolheria as próprias cores e ids.
    let lido;
    try {
      lido = lerExportacaoDoTrello(corpo.trello);
    } catch (e) {
      throw new ErroDeAcesso(400, e.message);
    }
    const { quadro: vindo, avisos, resumo } = lido;

    if (!vindo.origemId) throw new ErroDeAcesso(400, "o arquivo não tem o id do quadro do Trello");
    if (!corpo.confirmar) return json({ ok: true, previa: true, quadro: { nome: vindo.nome }, resumo, avisos });

    // ---------------------------------------------------------------- quadro

    // Já importado antes? Então é o mesmo quadro, e a importação continua de onde parou.
    const { data: jaExiste } = await supabase
      .from("abacato_quadros").select("id, dono_id, nome, arquivado")
      .eq("origem", "trello").eq("origem_id", vindo.origemId).maybeSingle();

    if (jaExiste && jaExiste.dono_id !== usuario.id) {
      // O índice de origem é global, então o quadro pode estar na conta de outra pessoa.
      // Dizer isso é melhor que um erro de banco incompreensível.
      throw new ErroDeAcesso(409, "esse quadro do Trello já foi importado por outra pessoa aqui dentro");
    }

    let quadroId = jaExiste?.id;
    if (!quadroId) {
      const { data, error } = await supabase.from("abacato_quadros").insert({
        nome: vindo.nome,
        descricao: vindo.descricao,
        papel_de_parede: vindo.papelDeParede,
        dono_id: usuario.id,
        origem: "trello",
        origem_id: vindo.origemId,
      }).select("id").single();
      if (error) throw new ErroDeAcesso(500, error.message);
      quadroId = data.id;
    } else if (jaExiste.arquivado) {
      await supabase.from("abacato_quadros").update({ arquivado: false }).eq("id", quadroId);
    }

    // ---------------------------------------------------------------- colunas e etiquetas

    await inserirEmLotes("abacato_colunas", vindo.colunas.map((c) => ({
      quadro_id: quadroId,
      nome: c.nome,
      posicao: c.posicao,
      arquivada: c.arquivada,
      origem: "trello",
      origem_id: c.origemId,
    })), "origem,origem_id");

    await inserirEmLotes("abacato_etiquetas", vindo.etiquetas.map((e) => ({
      quadro_id: quadroId,
      nome: e.nome,
      // Recusar aqui seria perder a etiqueta por um detalhe de cor. O cinza é o padrão da
      // paleta e mantém o significado da etiqueta, que está no nome.
      cor: corValida(e.cor) ? e.cor : "#6B7280",
      origem: "trello",
      origem_id: e.origemId,
    })), "origem,origem_id");

    // Relê para descobrir os ids daqui. O `do nothing` não devolve as linhas que já existiam,
    // então não dá para montar o mapa a partir da resposta do insert.
    const [{ data: colunas }, { data: etiquetas }] = await Promise.all([
      supabase.from("abacato_colunas").select("id, origem_id").eq("quadro_id", quadroId),
      supabase.from("abacato_etiquetas").select("id, origem_id").eq("quadro_id", quadroId),
    ]);
    const idDaColuna = new Map((colunas || []).filter((c) => c.origem_id).map((c) => [c.origem_id, c.id]));
    const idDaEtiqueta = new Map((etiquetas || []).filter((e) => e.origem_id).map((e) => [e.origem_id, e.id]));

    // ---------------------------------------------------------------- cards

    const cards = vindo.colunas.flatMap((col) =>
      col.cards.map((c) => ({ ...c, colunaId: idDaColuna.get(col.origemId) }))
    ).filter((c) => c.colunaId);

    await inserirEmLotes("abacato_cards", cards.map((c) => ({
      coluna_id: c.colunaId,
      titulo: c.titulo,
      descricao: c.descricao,
      posicao: c.posicao,
      inicio_em: c.inicioEm,
      fim_em: c.fimEm,
      concluido: c.concluido,
      arquivado: c.arquivado,
      capa: corValida(c.capa) ? c.capa : null,
      origem: "trello",
      origem_id: c.origemId,
    })), "origem,origem_id");

    const { data: cardsNoBanco } = await supabase
      .from("abacato_cards").select("id, origem_id")
      .in("coluna_id", [...idDaColuna.values()])
      .eq("origem", "trello");
    const idDoCard = new Map((cardsNoBanco || []).filter((c) => c.origem_id).map((c) => [c.origem_id, c.id]));

    // ---------------------------------------------------------------- vínculos dos cards

    const vinculos = [];
    const links = [];
    const checklists = [];
    for (const c of cards) {
      const cardId = idDoCard.get(c.origemId);
      if (!cardId) continue;
      for (const etiquetaOrigem of c.etiquetas) {
        const etiquetaId = idDaEtiqueta.get(etiquetaOrigem);
        if (etiquetaId) vinculos.push({ card_id: cardId, etiqueta_id: etiquetaId });
      }
      for (const l of c.links) links.push({ card_id: cardId, url: l.url, titulo: l.titulo });
      for (const cl of c.checklists) {
        checklists.push({
          card_id: cardId, titulo: cl.titulo, posicao: cl.posicao,
          origem: "trello", origem_id: cl.origemId, _itens: cl.itens,
        });
      }
    }

    await inserirEmLotes("abacato_card_etiquetas", vinculos, "card_id,etiqueta_id");
    await inserirEmLotes("abacato_links", links, "card_id,url");
    await inserirEmLotes("abacato_checklists", checklists.map(({ _itens, ...c }) => c), "origem,origem_id");

    const { data: checklistsNoBanco } = checklists.length
      ? await supabase.from("abacato_checklists").select("id, origem_id")
          .in("card_id", [...idDoCard.values()]).eq("origem", "trello")
      : { data: [] };
    const idDaChecklist = new Map((checklistsNoBanco || []).filter((c) => c.origem_id).map((c) => [c.origem_id, c.id]));

    const itens = [];
    for (const cl of checklists) {
      const checklistId = idDaChecklist.get(cl.origem_id);
      if (!checklistId) continue;
      for (const i of cl._itens) {
        itens.push({
          checklist_id: checklistId, texto: i.texto, feito: i.feito, posicao: i.posicao,
          origem: "trello", origem_id: i.origemId,
        });
      }
    }
    await inserirEmLotes("abacato_checklist_itens", itens, "origem,origem_id");

    return json({
      ok: true,
      quadroId,
      jaExistia: Boolean(jaExiste),
      nome: vindo.nome,
      resumo,
      avisos,
    }, jaExiste ? 200 : 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
