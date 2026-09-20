import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso, tocarQuadro } from "@/lib/acesso.js";
import { posicaoEntre } from "@/dominio/Quadro.js";
import { lerRegra } from "@/dominio/recorrencia.js";
import { reprogramarCard } from "@/lib/cardRecorrente.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Uma data vinda do navegador. String vazia significa "tirar a data", e é diferente de o
 *  campo não ter vindo — por isso o `in` no corpo, e não um `if (corpo.fimEm)`. */
function dataOuNulo(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new ErroDeAcesso(400, "data inválida");
  return d.toISOString();
}

/**
 * Onde o card fica ao ser solto no índice `indice` da coluna `colunaId`.
 *
 * O cálculo é AQUI, no servidor, e não no navegador que arrastou. A tela sabe as posições de
 * quando carregou; se outra pessoa mexeu na coluna nesse meio-tempo, uma posição calculada lá
 * cai no lugar errado. O servidor lê a coluna no instante da soltura e acerta.
 *
 * O próprio card sai da conta antes: arrastá-lo dois lugares para baixo dentro da mesma coluna,
 * com ele ainda na lista, calcularia a posição entre ele mesmo e o vizinho — e ele não sairia
 * do lugar.
 */
async function posicaoAoSoltar(cardId, colunaId, indice) {
  const { data: irmaos } = await supabase
    .from("abacato_cards").select("id, posicao")
    .eq("coluna_id", colunaId).eq("arquivado", false).order("posicao");

  const lista = (irmaos || []).filter((c) => c.id !== cardId);
  const i = Math.max(0, Math.min(Number(indice) || 0, lista.length));
  return posicaoEntre(i > 0 ? lista[i - 1].posicao : null, lista[i]?.posicao ?? null);
}

/** PATCH /api/cards/:id  body: { titulo?, descricao?, inicioEm?, fimEm?, capa?, mover? } */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const { quadroId } = await exigir(req, "card", id, "editar");
    const corpo = await req.json().catch(() => ({}));

    const mudancas = {};
    if (typeof corpo.titulo === "string" && corpo.titulo.trim()) mudancas.titulo = corpo.titulo.trim();
    if ("descricao" in corpo) mudancas.descricao = corpo.descricao || null;
    if ("inicioEm" in corpo) mudancas.inicio_em = dataOuNulo(corpo.inicioEm);
    if ("fimEm" in corpo) mudancas.fim_em = dataOuNulo(corpo.fimEm);
    if ("capa" in corpo) mudancas.capa = corpo.capa || null;
    if (typeof corpo.arquivado === "boolean") mudancas.arquivado = corpo.arquivado;
    if (typeof corpo.concluido === "boolean") mudancas.concluido = corpo.concluido;

    if ("recorrenciaRegra" in corpo) {
      const regra = corpo.recorrenciaRegra || null;
      // Uma regra inválida gravada vira uma tarefa que nunca se repete — e o pior é que a tela
      // continua dizendo que ela se repete.
      if (regra && !lerRegra(regra)) throw new ErroDeAcesso(400, "regra de repetição inválida");
      mudancas.recorrencia_regra = regra ? String(regra).trim().toLowerCase() : null;
    }

    if (corpo.mover?.colunaId) {
      // A coluna de destino tem de ser do MESMO quadro. Sem esta checagem, um `colunaId` de
      // outro quadro mudaria o dono do card na prática: ele sairia de um quadro e apareceria
      // em outro, levando junto o direito de quem lê aquele outro quadro.
      const { data: destino } = await supabase
        .from("abacato_colunas").select("id, quadro_id").eq("id", corpo.mover.colunaId).maybeSingle();
      if (!destino) throw new ErroDeAcesso(404, "coluna de destino não existe");
      if (destino.quadro_id !== quadroId) throw new ErroDeAcesso(403, "essa coluna é de outro quadro");

      mudancas.coluna_id = destino.id;
      mudancas.posicao = await posicaoAoSoltar(id, destino.id, corpo.mover.indice);
    }

    if (!Object.keys(mudancas).length) throw new ErroDeAcesso(400, "nada para mudar");

    const { data, error } = await supabase.from("abacato_cards").update(mudancas).eq("id", id)
      .select("id, coluna_id, titulo, descricao, posicao, inicio_em, fim_em, capa, arquivado, concluido, recorrencia_regra").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    // CONCLUIR UMA TAREFA QUE SE REPETE REPROGRAMA O PRÓPRIO CARD.
    //
    // Ele volta a ficar aberto, com a data seguinte e as checklists desmarcadas. Acontece aqui,
    // e não num relógio: é no instante em que você marca "concluído" que a próxima data faz
    // sentido, e é nesse instante que você está olhando a tela.
    let reprogramado = null;
    if (mudancas.concluido === true) {
      reprogramado = await reprogramarCard(id).catch(() => null);
      // O `select` acima rodou ANTES da reprogramação. Sem isto, a resposta diria que o card
      // está concluído com a data velha — e a tela voltaria a marcá-lo riscado por um instante.
      if (reprogramado) {
        data.concluido = false;
        data.fim_em = reprogramado.fim_em;
        data.inicio_em = reprogramado.inicio_em;
      }
    }

    await tocarQuadro(quadroId);
    return json({
      ok: true,
      card: {
        id: data.id, colunaId: data.coluna_id, titulo: data.titulo, descricao: data.descricao,
        posicao: data.posicao, inicioEm: data.inicio_em, fimEm: data.fim_em, capa: data.capa,
        arquivado: data.arquivado, concluido: data.concluido,
        recorrenciaRegra: data.recorrencia_regra,
      },
      reprogramado,
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/cards/:id — arquiva. Some da tela, continua no banco; o esquema tem `arquivado`
 *  justamente para "tirei da frente" não significar "perdi para sempre". */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const { quadroId } = await exigir(req, "card", id, "apagar");
    const { error } = await supabase.from("abacato_cards").update({ arquivado: true }).eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);
    await tocarQuadro(quadroId);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
