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
    .from("abacato_usuarios").select("id, admin, ativo").eq("id", usuario.id).maybeSingle();

  // Conta desativada derruba na hora, mesmo com sessão válida. É o que faz "desativar" querer
  // dizer alguma coisa antes de o cookie vencer.
  if (!data?.ativo) throw new ErroDeAcesso(401, "sua conta não está mais ativa");
  if (!data.admin) throw new ErroDeAcesso(403, "só quem administra o Abacato pode fazer isso");

  return usuario;
}

/** Quem está pedindo, e se administra — sem exigir nada. Para telas que mostram um botão a mais
 *  para administradores em vez de barrar a página inteira. */
export async function quemEhComAdmin(req) {
  const usuario = await quemEh(req);
  if (!usuario) return null;
  const { data } = await supabase
    .from("abacato_usuarios").select("admin, ativo").eq("id", usuario.id).maybeSingle();
  if (!data?.ativo) return null;
  return { ...usuario, admin: Boolean(data.admin) };
}
