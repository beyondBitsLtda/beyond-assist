import { supabase } from "./supabase.js";
import { quemEh, ErroDeAcesso } from "./acesso.js";

/**
 * Quem está pedindo é administrador do Abacato?
 *
 * A RESPOSTA VEM DO BANCO, E NÃO DO COOKIE.
 *
 * O cookie é assinado e confiável para dizer QUEM é a pessoa. Ele não serve para dizer o que
 * ela pode: foi emitido antes, e vale uma semana. Alguém que perdeu a permissão de administrar
 * continuaria carregando um cookie dizendo que a tem, até ele vencer — e desligar um acesso
 * que só vale daqui a sete dias não é desligar acesso nenhum.
 *
 * Uma consulta a mais por operação de administração é barata demais para valer esse risco.
 */
export async function exigirAdmin(req) {
  const usuario = await quemEh(req);
  if (!usuario) throw new ErroDeAcesso(401, "sem sessão");

  const { data } = await supabase
    .from("abacato_usuarios").select("id, admin, ativo, aprovado").eq("id", usuario.id).maybeSingle();

  // Conta desativada derruba na hora, mesmo com sessão válida. É o que faz "desativar" querer
  // dizer alguma coisa antes de o cookie vencer.
  if (!data?.ativo || data.aprovado === false) throw new ErroDeAcesso(401, "sua conta não está mais ativa");
  if (!data.admin) throw new ErroDeAcesso(403, "só quem administra o Abacato pode fazer isso");

  return usuario;
}

/** Quem está pedindo, e se administra — sem exigir nada. Para telas que mostram um botão a mais
 *  para administradores em vez de barrar a página inteira. */
export async function quemEhComAdmin(req) {
  const usuario = await quemEh(req);
  if (!usuario) return null;
  const { data } = await supabase
    .from("abacato_usuarios").select("admin, ativo, aprovado, tipo").eq("id", usuario.id).maybeSingle();
  if (!data?.ativo || data.aprovado === false) return null;
  return { ...usuario, admin: Boolean(data.admin), tipo: data.tipo };
}

/** Esta pessoa pode falar com a assistente?
 *
 *  Lido do BANCO a cada pedido, como o sinalizador de administrador e pelo mesmo motivo: o
 *  cookie vale uma semana, e tirar o acesso de alguém precisa valer no mesmo instante. */
export async function podeUsarLisa(req) {
  const usuario = await quemEh(req);
  if (!usuario) return { usuario: null, pode: false };
  const { data } = await supabase
    .from("abacato_usuarios").select("ativo, lisa, tipo, aprovado").eq("id", usuario.id).maybeSingle();
  if (!data?.ativo || data.aprovado === false) return { usuario: null, pode: false };
  // Duas condições, e a do tipo não é redundante: o sinalizador `lisa` é uma coluna que alguém
  // pode ligar por engano numa tela futura, e o tipo da conta é a regra. A constraint do banco
  // é a terceira barreira. Uma trava dessas custa uma linha; o vazamento custa a conversa
  // inteira de outra empresa.
  return { usuario, pode: Boolean(data.lisa) && data.tipo !== "cliente" };
}

/** A mesma pergunta, mas barrando. Para as rotas que só existem se a resposta for sim. */
export async function exigirLisa(req) {
  const { usuario, pode } = await podeUsarLisa(req);
  if (!usuario) throw new ErroDeAcesso(401, "sem sessão");
  if (!pode) {
    throw new ErroDeAcesso(403, "a assistente não está liberada para a sua conta — peça a quem administra o Abacato");
  }
  return usuario;
}
