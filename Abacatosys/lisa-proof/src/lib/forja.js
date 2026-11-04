// A Forja de Artefatos no banco (03/11/2026). As regras moram em src/dominio/forja.js; a tabela é
// proof_forja (db/029). A mana vem dos pontos de estudo desde a abertura da Forja; forjar grava o artefato
// (com a mana que custou) e aplica o efeito: o Escudo de Folga vai para o escudo_ate do reino de verdade; a
// Poção de Foco espera acabar e então paga o extra, uma vez só (liquidado_em, marcado antes de pagar).

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { buscarTodas } from "./estudo.js";
import { creditarMoedas, protegerReino, escudoDoReino } from "./reino.js";
import {
  ARTEFATOS, ORDEM_DOS_ARTEFATOS, INICIO_DA_FORJA, manaDe, pontosQueContam, podeForjar, efeitoDe, bonusDaPocao,
} from "@/dominio/forja.js";

const falhou = (error, onde) => { if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`); };
const CAMPOS = "id, item, mana, inicio, ate, bonus, liquidado_em, criado_em";

async function forjadosDe(usuarioId) {
  const { data, error } = await supabase.from("proof_forja").select(CAMPOS).eq("usuario_id", usuarioId).order("criado_em", { ascending: false }).limit(200);
  falhou(error, "forja");
  return data || [];
}

async function pontosDesde(usuarioId, de, ate = null) {
  const eventos = await buscarTodas(() => {
    let q = supabase.from("proof_eventos").select("tipo, pontos, criado_em").eq("usuario_id", usuarioId).gte("criado_em", de);
    if (ate) q = q.lte("criado_em", ate);
    return q.order("criado_em");
  });
  return pontosQueContam(eventos);
}

/** Paga o extra das poções que já acabaram (uma vez cada). Devolve as que pagou agora. */
async function liquidarPocoes(usuarioId, forjados, agora = new Date()) {
  const pagas = [];
  for (const f of forjados) {
    if (f.item !== "pocao" || f.liquidado_em || new Date(f.ate).getTime() > agora.getTime()) continue;
    const marca = new Date().toISOString();
    const { data: marcado, error } = await supabase.from("proof_forja").update({ liquidado_em: marca }).eq("id", f.id).is("liquidado_em", null).select("id");
    falhou(error, "poção");
    if (!marcado?.length) continue; // outra aba pagou
    try {
      const bonus = bonusDaPocao(await pontosDesde(usuarioId, f.inicio, f.ate));
      if (bonus > 0) await creditarMoedas(usuarioId, "forja", bonus, { artefato: "pocao", forja: f.id });
      await supabase.from("proof_forja").update({ bonus }).eq("id", f.id);
      Object.assign(f, { liquidado_em: marca, bonus });
      pagas.push({ id: f.id, bonus });
    } catch (e) {
      await supabase.from("proof_forja").update({ liquidado_em: null }).eq("id", f.id);
      throw e;
    }
  }
  return pagas;
}

const paraTela = (f, agora) => ({
  id: f.id, item: f.item, nome: ARTEFATOS[f.item]?.nome || f.item, emoji: ARTEFATOS[f.item]?.emoji || "✨",
  mana: f.mana, inicio: f.inicio, ate: f.ate, ativo: new Date(f.ate).getTime() > agora.getTime(), bonus: f.bonus ?? null,
});

/** A Forja da pessoa: a mana, o que dá para forjar, o que está fazendo efeito e o que já foi forjado. */
export async function forjaDe(usuarioId) {
  const agora = new Date();
  const forjados = await forjadosDe(usuarioId);
  const pagasAgora = await liquidarPocoes(usuarioId, forjados, agora);
  const [pontos, escudoAte] = await Promise.all([pontosDesde(usuarioId, `${INICIO_DA_FORJA}T00:00:00-03:00`), escudoDoReino(usuarioId)]);
  const mana = manaDe({ pontos, gasta: forjados.reduce((s, f) => s + f.mana, 0) });
  const pocaoAtiva = forjados.find((f) => f.item === "pocao" && new Date(f.ate).getTime() > agora.getTime());
  return {
    mana,
    escudoAte,
    pocao: pocaoAtiva ? { ...paraTela(pocaoAtiva, agora), juntando: bonusDaPocao(await pontosDesde(usuarioId, pocaoAtiva.inicio, agora.toISOString())) } : null,
    pagasAgora,
    artefatos: ORDEM_DOS_ARTEFATOS.map((id) => {
      const pode = podeForjar({ item: id, mana: mana.disponivel, forjados, escudoAte, agora });
      return { ...ARTEFATOS[id], pode: pode.ok, motivo: pode.ok ? "" : pode.motivo };
    }),
    historico: forjados.slice(0, 12).map((f) => paraTela(f, agora)),
  };
}

/** Forja um artefato: confere, grava (a mana sai na hora) e aplica o efeito. */
export async function forjar(usuarioId, item) {
  const def = ARTEFATOS[item];
  if (!def) throw new ErroDeAcesso(400, "esse artefato não existe");
  const agora = new Date();
  const forjados = await forjadosDe(usuarioId);
  await liquidarPocoes(usuarioId, forjados, agora);
  const [pontos, escudoAte] = await Promise.all([pontosDesde(usuarioId, `${INICIO_DA_FORJA}T00:00:00-03:00`), escudoDoReino(usuarioId)]);
  const mana = manaDe({ pontos, gasta: forjados.reduce((s, f) => s + f.mana, 0) });
  const pode = podeForjar({ item, mana: mana.disponivel, forjados, escudoAte, agora });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  const efeito = efeitoDe(item, agora, escudoAte);
  const { data: novo, error } = await supabase.from("proof_forja").insert({ usuario_id: usuarioId, item, mana: def.mana, ...efeito }).select(CAMPOS).single();
  falhou(error, "forja");
  // duas abas ao mesmo tempo: se a mana não dava para as duas, a segunda desfaz
  const depois = await forjadosDe(usuarioId);
  if (manaDe({ pontos, gasta: depois.reduce((s, f) => s + f.mana, 0) }).ganha < depois.reduce((s, f) => s + f.mana, 0)) {
    await supabase.from("proof_forja").delete().eq("id", novo.id);
    throw new ErroDeAcesso(409, "a mana não deu: outra forja usou antes");
  }
  try {
    if (item === "escudo") {
      const r = await protegerReino(usuarioId, efeito.ate);
      return { artefato: paraTela(novo, agora), escudoAte: r.escudoAte };
    }
  } catch (e) {
    await supabase.from("proof_forja").delete().eq("id", novo.id);
    throw e;
  }
  return { artefato: paraTela(novo, agora) };
}
