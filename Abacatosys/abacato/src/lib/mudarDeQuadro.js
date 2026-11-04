/**
 * O que acontece com um card quando ele muda de quadro.
 *
 * ==========================================================================================
 * MOVER ENTRE QUADROS NÃO É MOVER ENTRE COLUNAS.
 *
 * Dentro de um quadro, um card leva tudo: as etiquetas são do quadro, os responsáveis têm
 * acesso ao quadro, e nada precisa ser traduzido. Atravessando a fronteira, duas coisas param
 * de valer:
 *
 *   AS ETIQUETAS SÃO DE OUTRO QUADRO. Um `etiqueta_id` do quadro A não existe no quadro B. Se
 *   fosse copiado assim, ou o banco recusaria, ou — pior — o card apareceria com uma etiqueta
 *   que ninguém do quadro B consegue ver ou editar.
 *
 *   OS RESPONSÁVEIS PODEM NÃO TER ACESSO. Pôr alguém como responsável num quadro que ela não
 *   alcança cria uma tarefa que a pessoa nunca vai ver. É o tipo de silêncio que só aparece
 *   na reunião, quando ninguém fez.
 *
 * As duas funções abaixo traduzem cada uma delas, e as duas DEVOLVEM O QUE PERDERAM, para a
 * tela poder dizer em vez de sumir com a informação.
 * ==========================================================================================
 */

import { supabase } from "./supabase.js";

/**
 * As etiquetas equivalentes no quadro de destino.
 *
 * Casa por nome+cor; na falta, por nome. O que não existir é CRIADO no destino.
 *
 * Criar é uma decisão, e ela tem um motivo: a alternativa é o card chegar sem classificação
 * nenhuma, e a classificação é justamente o que se perde de vista quando um card viaja. Uma
 * etiqueta a mais no quadro de destino é visível e se apaga num clique; uma etiqueta que
 * sumiu não deixa rastro de que existiu.
 */
export async function traduzirEtiquetas(etiquetaIds, quadroDestino) {
  if (!etiquetaIds?.length) return { ids: [], criadas: [] };

  const { data: origem } = await supabase
    .from("abacato_etiquetas").select("id, nome, cor").in("id", etiquetaIds);
  if (!origem?.length) return { ids: [], criadas: [] };

  const { data: destino } = await supabase
    .from("abacato_etiquetas").select("id, nome, cor").eq("quadro_id", quadroDestino);

  const porNomeECor = new Map();
  const porNome = new Map();
  for (const e of destino || []) {
    porNomeECor.set(`${(e.nome || "").toLowerCase()}\u0000${e.cor}`, e.id);
    if (!porNome.has((e.nome || "").toLowerCase())) porNome.set((e.nome || "").toLowerCase(), e.id);
  }

  const ids = [];
  const aCriar = [];
  for (const e of origem) {
    const nome = (e.nome || "").toLowerCase();
    const igual = porNomeECor.get(`${nome}\u0000${e.cor}`) || (nome ? porNome.get(nome) : null);
    if (igual) { ids.push(igual); continue; }
    aCriar.push({ quadro_id: quadroDestino, nome: e.nome, cor: e.cor });
  }

  let criadas = [];
  if (aCriar.length) {
    const { data } = await supabase.from("abacato_etiquetas").insert(aCriar).select("id, nome, cor");
    criadas = data || [];
    ids.push(...criadas.map((e) => e.id));
  }

  return { ids, criadas };
}

/**
 * Quem, destes responsáveis, alcança o quadro de destino.
 *
 * Devolve os que ficam E os que saíram, com nome — a tela precisa dizer "o Davi saiu porque
 * não participa daquele quadro", e não apagar o responsável em silêncio.
 */
export async function responsaveisQueAlcancam(usuarioIds, quadroDestino) {
  if (!usuarioIds?.length) return { ficam: [], saem: [] };

  const [{ data: quadro }, { data: membros }] = await Promise.all([
    supabase.from("abacato_quadros").select("dono_id").eq("id", quadroDestino).maybeSingle(),
    supabase.from("abacato_membros").select("usuario_id").eq("quadro_id", quadroDestino),
  ]);

  const podem = new Set((membros || []).map((m) => m.usuario_id));
  if (quadro?.dono_id) podem.add(quadro.dono_id);

  const ficam = usuarioIds.filter((u) => podem.has(u));
  const idsQueSaem = usuarioIds.filter((u) => !podem.has(u));

  let saem = [];
  if (idsQueSaem.length) {
    const { data } = await supabase
      .from("abacato_usuarios").select("id, nome, email").in("id", idsQueSaem);
    saem = (data || []).map((u) => ({ id: u.id, nome: u.nome || u.email }));
  }
  return { ficam, saem };
}

/**
 * Traduz as duas coisas de um card que já está no destino.
 *
 * Usada tanto ao MOVER (o card já mudou de coluna) quanto ao COPIAR (o card novo nasceu lá).
 * Nos dois casos o trabalho é o mesmo, e duas cópias disto divergiriam na primeira correção.
 */
export async function ajustarCardNoDestino(cardId, etiquetaIdsOriginais, responsavelIdsOriginais, quadroDestino) {
  const [etiquetas, pessoas] = await Promise.all([
    traduzirEtiquetas(etiquetaIdsOriginais, quadroDestino),
    responsaveisQueAlcancam(responsavelIdsOriginais, quadroDestino),
  ]);

  // Apaga o que estava e põe o traduzido. Apagar primeiro é o que impede um `etiqueta_id` de
  // outro quadro de sobrar grudado no card depois da viagem.
  await supabase.from("abacato_card_etiquetas").delete().eq("card_id", cardId);
  if (etiquetas.ids.length) {
    await supabase.from("abacato_card_etiquetas")
      .insert(etiquetas.ids.map((e) => ({ card_id: cardId, etiqueta_id: e })));
  }

  await supabase.from("abacato_card_responsaveis").delete().eq("card_id", cardId);
  if (pessoas.ficam.length) {
    await supabase.from("abacato_card_responsaveis")
      .insert(pessoas.ficam.map((u) => ({ card_id: cardId, usuario_id: u })));
  }

  return {
    etiquetasCriadas: etiquetas.criadas.map((e) => e.nome).filter(Boolean),
    responsaveisRemovidos: pessoas.saem.map((u) => u.nome),
  };
}

/** As etiquetas e os responsáveis que um card tem hoje. */
export async function comoEstaOCard(cardId) {
  const [{ data: etiquetas }, { data: responsaveis }] = await Promise.all([
    supabase.from("abacato_card_etiquetas").select("etiqueta_id").eq("card_id", cardId),
    supabase.from("abacato_card_responsaveis").select("usuario_id").eq("card_id", cardId),
  ]);
  return {
    etiquetaIds: (etiquetas || []).map((e) => e.etiqueta_id),
    responsavelIds: (responsaveis || []).map((r) => r.usuario_id),
  };
}
