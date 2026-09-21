/**
 * Os links de cadastro: quem abre um deles cria a própria conta — e ela nasce esperando.
 *
 * ==========================================================================================
 * O QUE UM CONVITE DÁ, E O QUE ELE NÃO DÁ
 *
 * Ele dá o direito de PEDIR uma conta. Não dá conta, não dá acesso a nada e não põe ninguém
 * dentro de nenhum quadro. Um link vazado no grupo errado produz, no pior caso, uma fila de
 * pedidos para quem administra recusar — e não um estranho dentro do sistema.
 *
 * Três coisas seguram esse limite, e é preciso as três:
 *   1. o token é sorteado com 32 bytes de aleatoriedade de verdade (`crypto.getRandomValues`);
 *   2. o convite tem VALIDADE e um TETO DE USOS, então um link antigo para de servir sozinho;
 *   3. a conta criada nasce com `aprovado = false`, e o login recusa quem não foi aprovado.
 * ==========================================================================================
 */

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./acesso.js";
import { tipoValido } from "@/dominio/planos.js";

/** Um token de convite: 32 bytes sorteados, em base32 sem caracteres ambíguos.
 *
 *  Sem `0/O` e `1/I/l` porque este endereço vai ser ditado por telefone e copiado à mão de um
 *  e-mail — um token que só falha quando alguém lê errado é um token que gera chamado. */
export function sortearToken() {
  const alfabeto = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

/**
 * O convite deste token, se ele ainda vale.
 *
 * Devolve `null` para TODOS os motivos de não valer — não existe, foi desligado, venceu, gastou
 * os usos. Quem chama não distingue, e a tela diz sempre a mesma coisa: "este link não vale
 * mais". Dizer "venceu ontem" a quem digitou um token no chute confirmaria que ele existiu.
 */
export async function convitePeloToken(token) {
  const limpo = String(token || "").trim().toLowerCase();
  if (limpo.length < 20) return null;

  const { data } = await supabase
    .from("abacato_convites")
    .select("id, token, rotulo, tipo, expira_em, max_usos, usos, ativo")
    .eq("token", limpo).maybeSingle();

  if (!data || !data.ativo) return null;
  if (data.expira_em && new Date(data.expira_em) < new Date()) return null;
  if (data.usos >= data.max_usos) return null;
  return data;
}

/** Cria um link. `dias` e `maxUsos` têm padrão curto de propósito: um convite eterno é um
 *  convite que ninguém lembra de desligar. */
export async function criarConvite({ criadoPor, rotulo, tipo = "cliente", dias = 14, maxUsos = 20 }) {
  if (!tipoValido(tipo)) throw new ErroDeAcesso(400, "tipo de conta desconhecido");

  const expira = new Date();
  expira.setDate(expira.getDate() + Math.max(1, Math.min(365, Number(dias) || 14)));

  const { data, error } = await supabase.from("abacato_convites").insert({
    token: sortearToken(),
    rotulo: rotulo?.trim() || null,
    tipo,
    criado_por: criadoPor,
    expira_em: expira.toISOString(),
    max_usos: Math.max(1, Math.min(500, Number(maxUsos) || 20)),
  }).select("id, token, rotulo, tipo, expira_em, max_usos, usos, ativo, criado_em").single();

  if (error) throw new ErroDeAcesso(500, error.message);
  return data;
}

/** Marca mais um uso. Soma no banco lendo antes — são poucos cadastros por link, e a corrida
 *  aqui custa, no pior caso, um cadastro a mais numa fila que alguém vai revisar de qualquer
 *  jeito. Bloquear a linha por isso seria caro por um risco que não existe. */
export async function gastarUso(conviteId) {
  const { data } = await supabase
    .from("abacato_convites").select("usos").eq("id", conviteId).maybeSingle();
  await supabase.from("abacato_convites")
    .update({ usos: (data?.usos || 0) + 1 }).eq("id", conviteId);
}

/** Todos os links, para a tela de quem administra. O token vem junto — é o que se copia. */
export async function listarConvites() {
  const { data } = await supabase
    .from("abacato_convites")
    .select("id, token, rotulo, tipo, expira_em, max_usos, usos, ativo, criado_em, criado_por")
    .order("criado_em", { ascending: false });
  return data || [];
}
