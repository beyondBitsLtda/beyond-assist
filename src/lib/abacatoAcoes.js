// O que a Lisa grava nos cards do Abacato. Mesmo banco (tabelas abacato_*), pela chave de
// serviço — o mesmo caminho que a leitura (src/lib/ingest/abacato.js) já usa.
//
// As regras de data e de recorrência são as DO PRÓPRIO Abacato, importadas dos arquivos puros
// dele (sem dependências): uma tarefa recorrente concluída pela Lisa é reprogramada exatamente
// como seria pela tela do Abacato, e "dia 16" vira 16 às 23:59 em Brasília, não 15 às 21h.

import { supabase } from "./supabase.js";
import { esquecerCache } from "./liveQuadros.js";
import { paraInstante } from "../../Abacatosys/abacato/src/dominio/datas.js";
import { proximaOcorrencia } from "../../Abacatosys/abacato/src/dominio/recorrencia.js";

const PASSO = 1024; // o mesmo espaçamento de posição do Abacato (dominio/Quadro.js)

/** Quadros e colunas ativos — para o modelo escolher onde criar ou para onde mover. */
export async function quadrosEColunas() {
  const [{ data: quadros }, { data: colunas }] = await Promise.all([
    supabase.from("abacato_quadros").select("id, nome").eq("arquivado", false).order("nome"),
    supabase.from("abacato_colunas").select("id, quadro_id, nome, posicao").eq("arquivada", false).order("posicao"),
  ]);
  return (quadros || []).map((q) => ({
    id: q.id,
    nome: q.nome,
    colunas: (colunas || []).filter((c) => c.quadro_id === q.id).map((c) => ({ id: c.id, nome: c.nome })),
  }));
}

/** O card com o quadro e a coluna dele, ou null (inexistente ou arquivado). */
export async function cardDoAbacato(id) {
  const { data } = await supabase
    .from("abacato_cards")
    .select("id, titulo, descricao, fim_em, inicio_em, concluido, arquivado, coluna_id, recorrencia_regra, abacato_colunas ( id, nome, quadro_id, abacato_quadros ( id, nome ) )")
    .eq("id", id).maybeSingle();
  if (!data || data.arquivado) return null;
  return {
    ...data,
    coluna: data.abacato_colunas?.nome,
    quadro_id: data.abacato_colunas?.quadro_id,
    quadro: data.abacato_colunas?.abacato_quadros?.nome,
  };
}

/** A coluna com o quadro dela, ou null. */
export async function colunaDoAbacato(id) {
  const { data } = await supabase
    .from("abacato_colunas").select("id, nome, quadro_id, arquivada, abacato_quadros ( id, nome, arquivado )")
    .eq("id", id).maybeSingle();
  if (!data || data.arquivada || data.abacato_quadros?.arquivado) return null;
  return { id: data.id, nome: data.nome, quadro_id: data.quadro_id, quadro: data.abacato_quadros?.nome };
}

async function tocarQuadro(quadroId) {
  if (quadroId) await supabase.from("abacato_quadros").update({ atualizado_em: new Date().toISOString() }).eq("id", quadroId);
}

const instante = (prazo) => (prazo === "remover" ? null : paraInstante(prazo));

export async function criarCard({ colunaId, titulo, descricao, prazo }) {
  const coluna = await colunaDoAbacato(colunaId);
  if (!coluna) throw new Error("essa coluna não existe mais no Abacato");
  const { data: ultimo } = await supabase
    .from("abacato_cards").select("posicao").eq("coluna_id", colunaId).eq("arquivado", false)
    .order("posicao", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from("abacato_cards").insert({
    coluna_id: colunaId,
    titulo: String(titulo).trim(),
    descricao: descricao?.trim() || null,
    fim_em: prazo ? instante(prazo) : null,
    posicao: (ultimo?.posicao ?? 0) + PASSO, // no fim da coluna, como o "+ Adicionar card"
    origem: "lisa",
  }).select("id, titulo, fim_em").single();
  if (error) throw new Error(error.message);
  await tocarQuadro(coluna.quadro_id);
  esquecerCache();
  return { ...data, quadro: coluna.quadro, coluna: coluna.nome };
}

export async function mudarCard(cardId, { titulo, descricao, prazo, concluido, colunaId }) {
  const card = await cardDoAbacato(cardId);
  if (!card) throw new Error("esse card não existe mais no Abacato");
  const mudancas = {};
  if (titulo) mudancas.titulo = String(titulo).trim();
  if (descricao !== undefined) mudancas.descricao = descricao?.trim() || null;
  if (prazo) mudancas.fim_em = instante(prazo);
  if (typeof concluido === "boolean") mudancas.concluido = concluido;
  if (colunaId) {
    const destino = await colunaDoAbacato(colunaId);
    if (!destino) throw new Error("essa coluna não existe mais no Abacato");
    if (destino.quadro_id !== card.quadro_id) throw new Error("essa coluna é de outro quadro");
    const { data: primeiro } = await supabase
      .from("abacato_cards").select("posicao").eq("coluna_id", colunaId).eq("arquivado", false)
      .order("posicao").limit(1).maybeSingle();
    mudancas.coluna_id = colunaId;
    mudancas.posicao = (primeiro?.posicao ?? PASSO) - PASSO; // no topo da coluna de destino
  }
  if (!Object.keys(mudancas).length) throw new Error("nada para mudar");
  const { data, error } = await supabase.from("abacato_cards").update(mudancas).eq("id", cardId)
    .select("id, titulo, fim_em, concluido").single();
  if (error) throw new Error(error.message);

  // Concluir uma tarefa que se repete a reprograma, como na tela do Abacato.
  let reprogramado = null;
  if (mudancas.concluido === true && card.recorrencia_regra) reprogramado = await reprogramar(card).catch(() => null);
  await tocarQuadro(card.quadro_id);
  esquecerCache();
  return reprogramado ? { ...data, ...reprogramado, reprogramado: true } : data;
}

export async function arquivarCard(cardId) {
  const card = await cardDoAbacato(cardId);
  if (!card) throw new Error("esse card não existe mais no Abacato");
  // Excluir no Abacato é ARQUIVAR: some do quadro e continua no banco (é o que o DELETE da
  // tela dele faz). Dá para recuperar; apagar de vez não é uma ação da Lisa.
  const { error } = await supabase.from("abacato_cards").update({ arquivado: true }).eq("id", cardId);
  if (error) throw new Error(error.message);
  await tocarQuadro(card.quadro_id);
  esquecerCache();
  return { id: card.id, titulo: card.titulo };
}

/**
 * Porta de src/lib/cardRecorrente.js do Abacato: o card volta aberto, com a próxima data e as
 * checklists desmarcadas; uma cópia arquivada guarda o ciclo que acabou.
 */
async function reprogramar(card) {
  const base = card.fim_em ? new Date(card.fim_em) : new Date();
  const proxima = proximaOcorrencia(card.recorrencia_regra, base);
  if (!proxima) return null;

  // o ciclo que acabou, arquivado (não aparece no quadro, mas responde "isso foi feito?")
  await supabase.from("abacato_cards").insert({
    coluna_id: card.coluna_id, titulo: card.titulo, descricao: card.descricao,
    posicao: 0, inicio_em: card.inicio_em, fim_em: card.fim_em,
    concluido: true, arquivado: true, origem: "ciclo",
  }).then(() => {}, () => {});

  const deslocamento = card.inicio_em && card.fim_em
    ? new Date(card.fim_em).getTime() - new Date(card.inicio_em).getTime()
    : null;
  const { data, error } = await supabase.from("abacato_cards").update({
    concluido: false,
    fim_em: proxima.toISOString(),
    inicio_em: deslocamento != null ? new Date(proxima.getTime() - deslocamento).toISOString() : card.inicio_em,
  }).eq("id", card.id).select("id, titulo, fim_em").single();
  if (error) throw new Error(error.message);

  const { data: checklists } = await supabase.from("abacato_checklists").select("id").eq("card_id", card.id);
  if (checklists?.length) {
    await supabase.from("abacato_checklist_itens").update({ feito: false }).in("checklist_id", checklists.map((c) => c.id));
  }
  return data;
}
