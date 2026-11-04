// Os presentes (03/11/2026: "crie uma área de presentes e deixe lá a skin para o Viana"). Um presente é um
// item guardado para um jogador (hoje, um personagem) que espera na tela Presentes até ele abrir; abrir põe
// o personagem na coleção sem cobrar (darPersonagem, src/lib/reino.js). Quem dá é o administrador, direto
// no banco (proof_presentes, db/028).

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { darPersonagem } from "./reino.js";
import { PERSONAGENS } from "@/dominio/personagens.js";

const falhou = (error, onde) => { if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`); };
const CAMPOS = "id, tipo, item, titulo, mensagem, de, criado_em, aberto_em";

function paraTela(p) {
  const def = p.tipo === "personagem" ? PERSONAGENS[p.item] : null;
  return {
    id: p.id, tipo: p.tipo, titulo: p.titulo, mensagem: p.mensagem, de: p.de, criadoEm: p.criado_em, abertoEm: p.aberto_em,
    personagem: def ? { id: p.item, nome: def.nome, emoji: def.emoji, descricao: def.descricao, preco: def.preco } : null,
  };
}

/** Os presentes da pessoa (os fechados primeiro). */
export async function presentesDe(usuarioId) {
  const { data, error } = await supabase.from("proof_presentes").select(CAMPOS).eq("usuario_id", usuarioId).order("criado_em", { ascending: false }).limit(50);
  falhou(error, "presentes");
  const lista = (data || []).map(paraTela);
  return { presentes: [...lista.filter((p) => !p.abertoEm), ...lista.filter((p) => p.abertoEm)], fechados: lista.filter((p) => !p.abertoEm).length };
}

/** Abre o presente: marca como aberto (uma vez só) e entrega o item; se a entrega falhar, volta a ficar fechado. */
export async function abrirPresente(usuarioId, id) {
  const { data: p, error } = await supabase.from("proof_presentes").select(CAMPOS).eq("id", id).eq("usuario_id", usuarioId).maybeSingle();
  falhou(error, "presente");
  if (!p) throw new ErroDeAcesso(404, "presente não encontrado");
  if (p.aberto_em) throw new ErroDeAcesso(409, "este presente já foi aberto");
  const { data: marcado, error: e2 } = await supabase.from("proof_presentes").update({ aberto_em: new Date().toISOString() }).eq("id", id).is("aberto_em", null).select("id");
  falhou(e2, "presente");
  if (!marcado?.length) throw new ErroDeAcesso(409, "este presente já foi aberto");
  try {
    if (p.tipo === "personagem") await darPersonagem(usuarioId, p.item);
  } catch (e) {
    await supabase.from("proof_presentes").update({ aberto_em: null }).eq("id", id);
    throw e;
  }
  return paraTela({ ...p, aberto_em: new Date().toISOString() });
}
