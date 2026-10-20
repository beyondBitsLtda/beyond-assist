// Vales de moedas: presentes que a pessoa resgata uma vez (db/006-vales.sql). Vale vira moeda do
// Reino (livro-caixa), nunca ponto de estudo — não conta como dia estudado nem bate meta.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { saldoDoUsuario } from "./reino.js";

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

/** Os vales ativos que a pessoa ainda não resgatou. */
export async function valesPendentes(usuarioId) {
  const [vales, resgates] = await Promise.all([
    supabase.from("proof_vales").select("id, titulo, descricao, moedas").eq("ativo", true).order("criado_em"),
    supabase.from("proof_vales_resgates").select("vale_id").eq("usuario_id", usuarioId),
  ]);
  falhou(vales.error, "vales");
  falhou(resgates.error, "resgates");
  const ja = new Set((resgates.data || []).map((r) => r.vale_id));
  return (vales.data || []).filter((v) => !ja.has(v.id));
}

/**
 * Resgata um vale: marca o resgate (a chave primária barra o segundo clique) e lança as moedas no
 * livro-caixa. Se o lançamento falhar, desfaz a marca, para a pessoa poder tentar de novo.
 */
export async function resgatarVale(usuarioId, valeId) {
  if (!valeId || typeof valeId !== "string") throw new ErroDeAcesso(400, "qual vale?");
  const { data: vale, error } = await supabase.from("proof_vales").select("id, titulo, moedas, ativo").eq("id", valeId).maybeSingle();
  falhou(error, "vale");
  if (!vale || !vale.ativo) throw new ErroDeAcesso(404, "esse vale não existe mais");

  const marca = await supabase.from("proof_vales_resgates").insert({ vale_id: vale.id, usuario_id: usuarioId });
  if (marca.error?.code === "23505") throw new ErroDeAcesso(409, "você já resgatou esse vale");
  falhou(marca.error, "resgate");

  const lancamento = await supabase.from("proof_reino_movimentos")
    .insert({ usuario_id: usuarioId, tipo: "vale", valor: vale.moedas, detalhe: { vale: vale.id } });
  if (lancamento.error) {
    await supabase.from("proof_vales_resgates").delete().eq("vale_id", vale.id).eq("usuario_id", usuarioId);
    falhou(lancamento.error, "moedas do vale");
  }
  return { vale: vale.id, titulo: vale.titulo, moedas: vale.moedas, saldo: await saldoDoUsuario(usuarioId) };
}
