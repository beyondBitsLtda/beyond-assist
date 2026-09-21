import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { quemEh, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { validarProposta } from "@/dominio/quadroGen.js";
import { paraInstante } from "@/dominio/datas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/quadro-gen/criar   body: { proposta, fusoMinutos }
 *
 * Monta o quadro que a pessoa aprovou.
 *
 * ------------------------------------------------------------------------------------------
 * A PROPOSTA É CONFERIDA DE NOVO AQUI, E ISSO NÃO É DESCONFIANÇA DO MODELO
 *
 * Ela já passou pela conferência quando foi proposta. Mas o que chega nesta rota vem do
 * NAVEGADOR, e o navegador é de quem está do outro lado: entre uma coisa e outra ela pode ter
 * sido trocada por qualquer JSON. Validar de novo custa microssegundos e é a diferença entre
 * "o modelo não inventa cor" e "ninguém inventa cor".
 *
 * NÃO EXIGE A LISA. Quem chega aqui já viu a proposta e clicou; a partir daqui é só criar um
 * quadro, que qualquer conta faz. Exigir a assistente de novo barraria alguém cuja liberação
 * tivesse sido tirada no meio da conversa — e o certo aí é o quadro nascer, não a decisão
 * dela se perder.
 * ------------------------------------------------------------------------------------------
 */
export async function POST(req) {
  try {
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");

    const corpo = await req.json().catch(() => ({}));
    const fuso = Number.isFinite(corpo.fusoMinutos) ? corpo.fusoMinutos : 180;

    const conferida = validarProposta(corpo.proposta);
    if (!conferida.ok) throw new ErroDeAcesso(400, conferida.erros.join("; "));
    const p = conferida.proposta;

    // ------------------------------------------------------------------ quadro
    const { data: quadro, error } = await supabase.from("abacato_quadros").insert({
      nome: p.nome,
      descricao: p.descricao,
      dono_id: usuario.id,
    }).select("id, nome").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    // A partir daqui, qualquer falha deixaria um quadro pela metade. Um quadro vazio é
    // recuperável (a pessoa apaga e refaz); meio quadro com cards nas colunas erradas, não.
    // Por isso o resto vai num try que desfaz.
    try {
      const { data: colunas, error: erroColunas } = await supabase.from("abacato_colunas")
        .insert(p.colunas.map((c, i) => ({ quadro_id: quadro.id, nome: c.nome, posicao: (i + 1) * 1024 })))
        .select("id, nome");
      if (erroColunas) throw new Error(erroColunas.message);

      let etiquetas = [];
      if (p.etiquetas.length) {
        const { data, error: erroEtiquetas } = await supabase.from("abacato_etiquetas")
          .insert(p.etiquetas.map((e) => ({ quadro_id: quadro.id, nome: e.nome, cor: e.cor })))
          .select("id, nome");
        if (erroEtiquetas) throw new Error(erroEtiquetas.message);
        etiquetas = data || [];
      }

      const idDaColuna = new Map((colunas || []).map((c) => [c.nome.toLowerCase(), c.id]));
      const idDaEtiqueta = new Map(etiquetas.map((e) => [e.nome.toLowerCase(), e.id]));

      if (p.cards.length) {
        // A posição é contada POR COLUNA. Um contador só faria os cards da segunda coluna
        // nascerem com posições altas e, na primeira reordenação, saltarem de lugar.
        const porColuna = new Map();
        const linhas = [];
        for (const c of p.cards) {
          const colunaId = idDaColuna.get(c.coluna.toLowerCase());
          if (!colunaId) continue;
          const n = (porColuna.get(colunaId) || 0) + 1;
          porColuna.set(colunaId, n);
          linhas.push({
            coluna_id: colunaId,
            titulo: c.titulo,
            descricao: c.descricao,
            posicao: n * 1024,
            // O prazo vem em DIAS porque o modelo não sabe que dia é hoje com confiança. A
            // conta do dia acontece aqui, com o fuso de quem está criando.
            fim_em: c.prazoEmDias == null
              ? null
              : paraInstante(
                  new Date(Date.now() + c.prazoEmDias * 86400000 - fuso * 60000).toISOString().slice(0, 10),
                  fuso
                ),
            _etiqueta: c.etiqueta,
          });
        }

        const paraInserir = linhas.map(({ _etiqueta, ...resto }) => resto);
        const { data: cards, error: erroCards } = await supabase.from("abacato_cards")
          .insert(paraInserir).select("id");
        if (erroCards) throw new Error(erroCards.message);

        const ligacoes = [];
        (cards || []).forEach((card, i) => {
          const nome = linhas[i]?._etiqueta;
          const etiquetaId = nome ? idDaEtiqueta.get(nome.toLowerCase()) : null;
          if (etiquetaId) ligacoes.push({ card_id: card.id, etiqueta_id: etiquetaId });
        });
        if (ligacoes.length) await supabase.from("abacato_card_etiquetas").insert(ligacoes);

        // ---------------------------------------------------------- checklists
        //
        // Uma checklist por card que tenha passos, com o nome do card como título — é o que
        // o painel do card mostra, e "Passos" em quinze cards não distingue nada.
        //
        // As listas entram todas de uma vez e os itens também: um card com seis passos e
        // dez cards com checklist dariam dezesseis idas ao banco, e o quadro nasceria devagar
        // justo no momento em que a pessoa está olhando a tela esperando.
        const comPassos = [];
        (cards || []).forEach((card, i) => {
          const passos = p.cards[i]?.checklist || [];
          if (passos.length) comPassos.push({ cardId: card.id, titulo: p.cards[i].titulo, passos });
        });

        if (comPassos.length) {
          const { data: listas, error: erroListas } = await supabase.from("abacato_checklists")
            .insert(comPassos.map((c) => ({ card_id: c.cardId, titulo: c.titulo, posicao: 1024 })))
            .select("id, card_id");
          if (erroListas) throw new Error(erroListas.message);

          const listaDoCard = new Map((listas || []).map((l) => [l.card_id, l.id]));
          const itens = [];
          for (const c of comPassos) {
            const listaId = listaDoCard.get(c.cardId);
            if (!listaId) continue;
            c.passos.forEach((texto, n) => {
              itens.push({ checklist_id: listaId, texto, feito: false, posicao: (n + 1) * 1024 });
            });
          }
          if (itens.length) {
            const { error: erroItens } = await supabase.from("abacato_checklist_itens").insert(itens);
            if (erroItens) throw new Error(erroItens.message);
          }
        }
      }

      return json({
        ok: true,
        quadroId: quadro.id,
        nome: quadro.nome,
        colunas: (colunas || []).length,
        cards: p.cards.length,
        etiquetas: etiquetas.length,
        checklists: p.cards.filter((c) => c.checklist?.length).length,
      }, 201);
    } catch (dentro) {
      // Desfaz. O `on delete cascade` leva colunas, cards e etiquetas junto — é uma linha só,
      // e é o que impede um erro no meio de virar um quadro quebrado que alguém encontra
      // semanas depois sem saber de onde veio.
      await supabase.from("abacato_quadros").delete().eq("id", quadro.id);
      throw new ErroDeAcesso(500, `não consegui montar o quadro: ${dentro.message}`);
    }
  } catch (e) {
    return respostaDeErro(e);
  }
}
