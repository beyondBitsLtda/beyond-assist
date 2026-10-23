// Criar, replanejar e ler trilhas. A lógica de ordem e agenda é do domínio (dominio/plano.js);
// aqui fica só o que fala com o banco e com a IA.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import {
  quadroDeEstudo, conteudoDoQuadro, trilhaDoUsuario, checklistsDosCards, contarItens, linkDoAbacato,
} from "./estudo.js";
import { avancoDaTrilhaDoUsuario } from "./avanco.js";
import { planejarTrilha, temModelo } from "./ia.js";
import { planoPadrao, planoDoReplanejamento, montarEtapas, normalizarDiasDeEstudo } from "@/dominio/plano.js";
import { diaDe, diaValido } from "@/dominio/datas.js";

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

/** Plano com IA quando dá; sem ela, a ordem do quadro — e o aviso diz qual dos dois saiu. */
async function planejar(tema, cards, usarIa) {
  if (usarIa && temModelo()) {
    try {
      const p = await planejarTrilha({ tema, cards });
      return {
        plano: p.etapas,
        resumo: p.resumo,
        geradaPor: "ia",
        aviso: p.esquecidos ? `${p.esquecidos} assunto(s) não vieram da IA e entraram no fim da trilha.` : null,
      };
    } catch (e) {
      return {
        plano: planoPadrao(cards).etapas,
        resumo: null,
        geradaPor: "ordem",
        aviso: `A IA não respondeu (${e.message}). A trilha seguiu a ordem do quadro; dá para refazer com a Lisa depois.`,
      };
    }
  }
  return {
    plano: planoPadrao(cards).etapas,
    resumo: null,
    geradaPor: "ordem",
    aviso: usarIa ? "A IA não está configurada neste servidor; a trilha seguiu a ordem do quadro." : null,
  };
}

function linhasDeEtapas(trilhaId, etapas) {
  return etapas.map((e) => ({
    trilha_id: trilhaId,
    card_id: e.cardId,
    ordem: e.ordem,
    semana: e.semana,
    inicio: e.inicio,
    fim: e.fim,
    dias: e.dias,
    nivel: e.nivel,
    objetivo: e.objetivo,
  }));
}

export async function criarTrilha({ usuarioId, quadroId, diasDeEstudo, inicio, usarIa = true }) {
  const quadro = await quadroDeEstudo(quadroId, usuarioId);

  const { data: existente } = await supabase
    .from("proof_trilhas").select("id").eq("quadro_id", quadro.id).eq("usuario_id", usuarioId).maybeSingle();
  if (existente) throw new ErroDeAcesso(409, "este quadro já tem trilha — use Replanejar na tela dela");

  const cards = await conteudoDoQuadro(quadro.id);
  if (!cards.length) throw new ErroDeAcesso(400, "o quadro não tem cards para estudar");

  const hoje = diaDe();
  const inicioEm = diaValido(inicio) ? inicio : hoje;
  const dias = normalizarDiasDeEstudo(diasDeEstudo);
  const { plano, resumo, geradaPor, aviso } = await planejar(quadro.tema, cards, usarIa);

  const { data: trilha, error } = await supabase
    .from("proof_trilhas")
    .insert({
      usuario_id: usuarioId, quadro_id: quadro.id, tema: quadro.tema, inicio_em: inicioEm,
      dias_de_estudo: dias, resumo, gerada_por: geradaPor,
    })
    .select("id")
    .single();
  if (error?.code === "23505") throw new ErroDeAcesso(409, "este quadro já tem trilha");
  falhou(error, "trilha");

  const etapas = montarEtapas({
    plano,
    concluidos: new Set(cards.filter((c) => c.concluido).map((c) => c.id)),
    aPartirDe: inicioEm,
    diasDeEstudo: dias,
    base: inicioEm,
  });
  const { error: e2 } = await supabase.from("proof_etapas").insert(linhasDeEtapas(trilha.id, etapas));
  if (e2) {
    // Trilha sem etapas é uma trilha quebrada que bloqueia criar outra (o quadro é único).
    await supabase.from("proof_trilhas").delete().eq("id", trilha.id);
    falhou(e2, "etapas");
  }
  return { trilhaId: trilha.id, aviso };
}

/**
 * Recalcula a agenda a partir de hoje.
 *
 * Sem IA: mantém a ordem, encaixa os cards novos do quadro no fim e tira os que sumiram. Com
 * IA: a Lisa reordena tudo de novo. Nos dois casos, o que já foi concluído não sai do lugar.
 */
export async function replanejarTrilha({ usuarioId, trilhaId, usarIa = false, diasDeEstudo }) {
  const trilha = await trilhaDoUsuario(trilhaId, usuarioId);
  const quadro = await quadroDeEstudo(trilha.quadro_id, usuarioId);
  const cards = await conteudoDoQuadro(quadro.id);
  if (!cards.length) throw new ErroDeAcesso(400, "o quadro não tem mais cards");

  const { data: linhas, error } = await supabase
    .from("proof_etapas").select("id, card_id, ordem, dias, nivel, objetivo, inicio, fim, semana").eq("trilha_id", trilha.id);
  falhou(error, "etapas");
  const antigas = (linhas || []).map((e) => ({ ...e, cardId: e.card_id }));

  let plano;
  let resumo = trilha.resumo;
  let geradaPor = trilha.gerada_por;
  let aviso = null;
  if (usarIa) {
    const r = await planejar(quadro.tema, cards, true);
    plano = r.plano;
    aviso = r.aviso;
    if (r.geradaPor === "ia") {
      resumo = r.resumo;
      geradaPor = "ia";
    }
  } else {
    plano = planoDoReplanejamento(antigas, cards);
  }

  const dias = diasDeEstudo ? normalizarDiasDeEstudo(diasDeEstudo) : trilha.dias_de_estudo;
  const hoje = diaDe();
  const etapas = montarEtapas({
    plano,
    concluidos: new Set(cards.filter((c) => c.concluido).map((c) => c.id)),
    antigas,
    aPartirDe: trilha.inicio_em > hoje ? trilha.inicio_em : hoje,
    diasDeEstudo: dias,
    base: trilha.inicio_em,
  });

  // Grava o novo antes de apagar o velho: se a gravação falhar no meio, a trilha antiga
  // continua inteira em vez de sumir.
  const { error: e2 } = await supabase
    .from("proof_etapas")
    .upsert(linhasDeEtapas(trilha.id, etapas), { onConflict: "trilha_id,card_id" });
  falhou(e2, "etapas");

  const ficam = new Set(etapas.map((e) => e.cardId));
  const sobras = antigas.filter((e) => !ficam.has(e.cardId)).map((e) => e.id);
  for (let i = 0; i < sobras.length; i += 80) {
    await supabase.from("proof_etapas").delete().in("id", sobras.slice(i, i + 80));
  }

  await supabase.from("proof_trilhas").update({
    resumo, gerada_por: geradaPor, dias_de_estudo: dias, atualizada_em: new Date().toISOString(),
  }).eq("id", trilha.id);

  return { aviso };
}

export async function apagarTrilha({ usuarioId, trilhaId }) {
  const trilha = await trilhaDoUsuario(trilhaId, usuarioId);
  // Os pontos ficam: `proof_eventos.trilha_id` vira nulo. Apagar uma trilha não pode apagar a
  // ofensiva que a pessoa construiu com ela.
  const { error } = await supabase.from("proof_trilhas").delete().eq("id", trilha.id);
  falhou(error, "trilha");
}

/**
 * A trilha inteira para a tela: o avanço (src/dominio/avanco.js) — as semanas do plano, cada uma com
 * os assuntos e o projeto dela, o assunto de agora —, e cada assunto com as checklists para marcar.
 */
export async function detalheDaTrilha({ usuarioId, trilhaId }) {
  const { trilha, avanco } = await avancoDaTrilhaDoUsuario(trilhaId, usuarioId);
  const checklists = await checklistsDosCards(avanco.etapas.map((e) => e.cardId));
  // as etapas das semanas são os mesmos objetos: completar aqui completa lá também
  for (const e of avanco.etapas) {
    const lista = checklists.get(e.cardId) || [];
    const { total, feitos } = contarItens(lista);
    Object.assign(e, { checklists: lista, itens: total, itensFeitos: feitos, link: linkDoAbacato(trilha.quadro_id, e.cardId) });
  }
  return {
    trilha: {
      id: trilha.id, tema: trilha.tema, quadroId: trilha.quadro_id, inicioEm: trilha.inicio_em,
      diasDeEstudo: trilha.dias_de_estudo, resumo: trilha.resumo, geradaPor: trilha.gerada_por,
      link: linkDoAbacato(trilha.quadro_id),
    },
    avanco,
    progresso: avanco.progresso,
  };
}
