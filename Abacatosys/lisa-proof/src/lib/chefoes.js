// Os Chefões da Procrastinação no banco (03/11/2026). As regras moram em src/dominio/chefoes.js; a tabela é
// proof_chefoes (db/029). O chefão nasce quando a pessoa abre o Reino com atraso (assuntos da trilha vencidos
// e cartões de revisão vencidos); o dano é calculado na hora, a partir dos estudos desde que ele nasceu; e
// quando a vida acaba ele cai e paga a recompensa uma vez (derrotado_em marcado antes de pagar).

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { buscarTodas } from "./estudo.js";
import { avancoDasTrilhas } from "./avanco.js";
import { creditarMoedas } from "./reino.js";
import { diaDe } from "@/dominio/datas.js";
import {
  chefaoPorId, podeNascer, danoDosEstudos, danoDosCadernos, situacaoDoChefao, pesoDoAtraso, HORAS_ATE_O_PROXIMO,
} from "@/dominio/chefoes.js";

const falhou = (error, onde) => { if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`); };
const CAMPOS = "id, tipo, vida, recompensa, atraso, nasceu_em, derrotado_em, pago_em";

/** O atraso de agora: assuntos das trilhas ativas com o prazo vencido e cartões de revisão vencidos. */
export async function atrasoDe(usuarioId, hoje = diaDe()) {
  const { data: trilhas, error } = await supabase.from("proof_trilhas").select("id, quadro_id, tema, inicio_em, dias_de_estudo, perfil")
    .eq("usuario_id", usuarioId).eq("status", "ativa");
  falhou(error, "trilhas");
  const ativas = trilhas || [];
  const [avancos, cartoes] = await Promise.all([
    avancoDasTrilhas(ativas, hoje),
    ativas.length
      ? buscarTodas(() => supabase.from("proof_cartoes").select("trilha_id, proxima_em, repeticoes").eq("usuario_id", usuarioId).in("trilha_id", ativas.map((t) => t.id)).lt("proxima_em", hoje).order("criado_em"))
      : [],
  ]);
  const atrasados = ativas.flatMap((t) => avancos.get(t.id)?.etapas || []).filter((e) => e.fim && e.fim < hoje && !e.concluido).length;
  // vencido é o cartão que já foi revisado uma vez e passou da data (o novo, nunca visto, não é atraso)
  const revisoesVencidas = cartoes.filter((c) => Number(c.repeticoes) > 0).length;
  return { atrasados, revisoesVencidas };
}

async function danoDe(usuarioId, chefao) {
  const [eventos, paginas] = await Promise.all([
    buscarTodas(() => supabase.from("proof_eventos").select("tipo, pontos").eq("usuario_id", usuarioId).gte("criado_em", chefao.nasceu_em).order("criado_em")),
    supabase.from("proof_caderno_paginas").select("id, proof_cadernos!inner(usuario_id)", { count: "exact", head: true })
      .eq("proof_cadernos.usuario_id", usuarioId).gte("atualizado_em", chefao.nasceu_em),
  ]);
  const estudos = danoDosEstudos(eventos);
  const cadernos = danoDosCadernos(paginas.count || 0, chefao.vida);
  return { estudos, cadernos, total: estudos + cadernos };
}

function paraTela(c, dano, extra = {}) {
  const def = chefaoPorId(c.tipo);
  return {
    id: c.id, tipo: c.tipo, nome: def.nome, emoji: def.emoji, monstro: def.monstro, recompensa: c.recompensa,
    nasceuEm: c.nasceu_em, derrotadoEm: c.derrotado_em, atraso: c.atraso,
    ...situacaoDoChefao({ vida: c.vida, dano: dano.total }), golpes: { estudos: dano.estudos, cadernos: dano.cadernos },
    ...extra,
  };
}

/** Derruba o chefão (uma vez só) e paga a recompensa; se o pagamento falhar, ele volta a ficar de pé. */
async function derrubar(usuarioId, c) {
  const marca = new Date().toISOString();
  const { data: marcado, error } = await supabase.from("proof_chefoes").update({ derrotado_em: marca }).eq("id", c.id).is("derrotado_em", null).select("id");
  falhou(error, "chefão");
  if (!marcado?.length) return false;
  try {
    if (c.recompensa > 0) await creditarMoedas(usuarioId, "chefao", c.recompensa, { chefao: c.id, tipo: c.tipo });
    await supabase.from("proof_chefoes").update({ pago_em: new Date().toISOString() }).eq("id", c.id);
  } catch (e) {
    await supabase.from("proof_chefoes").update({ derrotado_em: null }).eq("id", c.id);
    throw e;
  }
  c.derrotado_em = marca;
  return true;
}

/**
 * O chefão da pessoa agora: o vivo (com o dano de agora; se a vida acabou, ele cai e paga aqui), ou um novo
 * que nasce do atraso, ou nenhum. `caiuAgora` vem com o que acabou de cair, para a tela comemorar.
 */
export async function chefaoDe(usuarioId) {
  const agora = new Date();
  const { data: lista, error } = await supabase.from("proof_chefoes").select(CAMPOS).eq("usuario_id", usuarioId).order("nasceu_em", { ascending: false }).limit(10);
  falhou(error, "chefões");
  const vivo = (lista || []).find((c) => !c.derrotado_em) || null;
  const derrotados = (lista || []).filter((c) => c.derrotado_em).length;
  if (vivo) {
    const dano = await danoDe(usuarioId, vivo);
    if (dano.total >= vivo.vida && (await derrubar(usuarioId, vivo))) {
      return { chefao: null, caiuAgora: paraTela(vivo, dano), derrotados: derrotados + 1 };
    }
    return { chefao: paraTela(vivo, dano), derrotados };
  }
  const ultimo = (lista || []).find((c) => c.derrotado_em) || null;
  const atraso = await atrasoDe(usuarioId);
  const pode = podeNascer({ vivo: null, ultimoDerrotadoEm: ultimo?.derrotado_em, atraso, agora });
  if (!pode.ok) {
    const descanso = ultimo ? new Date(new Date(ultimo.derrotado_em).getTime() + HORAS_ATE_O_PROXIMO * 3_600_000).toISOString() : null;
    return { chefao: null, derrotados, atraso, descansoAte: descanso && descanso > agora.toISOString() ? descanso : null };
  }
  const def = pode.chefao;
  const { data: novo, error: e2 } = await supabase.from("proof_chefoes")
    .insert({ usuario_id: usuarioId, tipo: def.id, vida: def.vida, recompensa: def.recompensa, atraso: pesoDoAtraso(atraso) })
    .select(CAMPOS).single();
  if (e2) {
    // outra aba fez nascer ao mesmo tempo (o índice só deixa um vivo): lê o que ficou
    if (e2.code === "23505") return chefaoDe(usuarioId);
    falhou(e2, "chefão");
  }
  return { chefao: paraTela(novo, { estudos: 0, cadernos: 0, total: 0 }, { nasceuAgora: true }), derrotados };
}
