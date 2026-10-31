// Os cartões com repetição espaçada no banco (31/10/2026): a revisão do dia, criar (pela Lisa ou pela
// pessoa), revisar e apagar. As regras moram em src/dominio/cartoes.js; a migração é
// db/023-cartoes-turma-e-torres-de-tema.sql.
//
// Revisar pontua: cada cartão diferente revisado no dia vale um pouco, até um teto, numa chave só do
// dia ("cartoes:AAAA-MM-DD") — os pontos viram moedas, ranking e ofensiva, como o resto.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { registrarOuMelhorar, estudouHoje, depoisDePontuar, resultadoDaPontuacao, buscarTodas, trilhaDoUsuario } from "./estudo.js";
import { avancoDaTrilhaDoUsuario } from "./avanco.js";
import { trechoDoAssunto, blocoDoTrecho } from "./leituras.js";
import { temModelo } from "./ia.js";
import { gerarCartoes } from "./iaPratica.js";
import { diaDe } from "@/dominio/datas.js";
import {
  agendaNova, revisarCartao, cartoesDoDia, resumoDosCartoes, pontosDaRevisao, validarCartao,
  LIMITES_DOS_CARTOES, RESPOSTAS_DO_CARTAO,
} from "@/dominio/cartoes.js";

const CAMPOS = "id, trilha_id, card_id, frente, verso, exemplo, origem, intervalo, facilidade, repeticoes, lapsos, proxima_em, revisado_em, criado_em";
/** Quantos cartões a Lisa cria por dia, somando todas as trilhas (cada geração gasta IA). */
const CARTOES_DA_LISA_POR_DIA = 60;

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

const ehId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""));
/** O começo do dia de hoje em Brasília (sem horário de verão desde 2019). */
const inicioDeHoje = () => new Date(`${diaDe()}T00:00:00-03:00`).toISOString();

const cartaoParaTela = (c, hoje, temas) => ({
  id: c.id, trilhaId: c.trilha_id, tema: temas?.get(c.trilha_id) || "", frente: c.frente, verso: c.verso, exemplo: c.exemplo,
  origem: c.origem, intervalo: c.intervalo, facilidade: Number(c.facilidade), repeticoes: c.repeticoes, lapsos: c.lapsos,
  proximaEm: c.proxima_em, revisadoEm: c.revisado_em, novo: !c.revisado_em,
});

async function trilhasAtivas(usuarioId) {
  const { data, error } = await supabase.from("proof_trilhas").select("id, tema, perfil")
    .eq("usuario_id", usuarioId).eq("status", "ativa").order("tema");
  falhou(error, "trilhas");
  return data || [];
}

async function revisadosHoje(usuarioId) {
  const { count, error } = await supabase.from("proof_cartoes").select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId).gte("revisado_em", inicioDeHoje());
  falhou(error, "cartões");
  return count || 0;
}

/** O painel: a revisão de hoje (de todas as trilhas ativas) e o resumo da pilha de cada trilha. */
export async function painelDosCartoes(usuarioId) {
  const hoje = diaDe();
  const [trilhas, cartoes, feitos] = await Promise.all([
    trilhasAtivas(usuarioId),
    buscarTodas(() => supabase.from("proof_cartoes").select(CAMPOS).eq("usuario_id", usuarioId).order("criado_em")),
    revisadosHoje(usuarioId),
  ]);
  const ativas = new Set(trilhas.map((t) => t.id));
  const temas = new Map(trilhas.map((t) => [t.id, t.tema]));
  const dasAtivas = cartoes.filter((c) => ativas.has(c.trilha_id));
  return {
    hoje,
    revisadosHoje: feitos,
    pontosHoje: pontosDaRevisao(feitos),
    revisao: cartoesDoDia(dasAtivas, hoje).map((c) => cartaoParaTela(c, hoje, temas)),
    trilhas: trilhas.map((t) => ({ id: t.id, tema: t.tema, perfil: t.perfil, ...resumoDosCartoes(dasAtivas.filter((c) => c.trilha_id === t.id), hoje) })),
    iaDisponivel: temModelo(),
  };
}

/** Todos os cartões de uma trilha (para ver e apagar). */
export async function cartoesDaTrilha(usuarioId, trilhaId) {
  if (!ehId(trilhaId)) throw new ErroDeAcesso(404, "trilha não encontrada");
  const trilha = await trilhaDoUsuario(trilhaId, usuarioId);
  const hoje = diaDe();
  const cartoes = await buscarTodas(() => supabase.from("proof_cartoes").select(CAMPOS).eq("usuario_id", usuarioId).eq("trilha_id", trilha.id).order("criado_em", { ascending: false }));
  return { trilha: { id: trilha.id, tema: trilha.tema, perfil: trilha.perfil }, cartoes: cartoes.map((c) => cartaoParaTela(c, hoje)) };
}

async function frentesDa(usuarioId, trilhaId) {
  const { data, error } = await supabase.from("proof_cartoes").select("frente").eq("usuario_id", usuarioId).eq("trilha_id", trilhaId).limit(LIMITES_DOS_CARTOES.porTrilha + 10);
  falhou(error, "cartões");
  return (data || []).map((c) => c.frente);
}

function exigirEspaco(frentes, quantos = 1) {
  if (frentes.length + quantos > LIMITES_DOS_CARTOES.porTrilha) {
    throw new ErroDeAcesso(409, `a trilha já tem ${frentes.length} cartões (o máximo é ${LIMITES_DOS_CARTOES.porTrilha}) — apague os que já estão firmes`);
  }
}

/** A Lisa cria os cartões do assunto da vez da trilha (ou do assunto `cardId`). */
export async function criarCartoesDaLisa(usuarioId, trilhaId, cardId = null) {
  if (!ehId(trilhaId)) throw new ErroDeAcesso(404, "trilha não encontrada");
  if (!temModelo()) throw new ErroDeAcesso(503, "a IA não está configurada neste servidor");
  const { count, error } = await supabase.from("proof_cartoes").select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId).eq("origem", "lisa").gte("criado_em", inicioDeHoje());
  falhou(error, "cartões");
  if ((count || 0) >= CARTOES_DA_LISA_POR_DIA) throw new ErroDeAcesso(429, `a Lisa já criou ${count} cartões hoje — amanhã tem mais (os seus, você cria quantos quiser)`);

  const { trilha, avanco } = await avancoDaTrilhaDoUsuario(trilhaId, usuarioId);
  let assunto = cardId ? avanco.etapas.find((e) => String(e.cardId) === String(cardId)) : avanco.assuntoDaPratica;
  if (!assunto) throw new ErroDeAcesso(400, "a trilha não tem assunto para virar cartão");
  const [frentes, trecho] = await Promise.all([frentesDa(usuarioId, trilha.id), trechoDoAssunto(assunto.cardId, 12_000)]);
  exigirEspaco(frentes, 3);
  if (trecho) assunto = { ...assunto, trecho: blocoDoTrecho(trecho) };

  let novos;
  try {
    novos = await gerarCartoes({ tema: trilha.tema, perfil: trilha.perfil, assunto, existentes: frentes });
  } catch (e) {
    throw new ErroDeAcesso(502, e.message);
  }
  novos = novos.slice(0, Math.max(0, LIMITES_DOS_CARTOES.porTrilha - frentes.length));
  const hoje = diaDe();
  const { data, error: e2 } = await supabase.from("proof_cartoes").insert(novos.map((c) => ({
    usuario_id: usuarioId, trilha_id: trilha.id, card_id: ehId(assunto.cardId) ? assunto.cardId : null, origem: "lisa", ...c, ...agendaNova(hoje),
  }))).select(CAMPOS);
  falhou(e2, "cartões");
  return { assunto: assunto.titulo, criados: (data || []).length };
}

/** Um cartão escrito pela pessoa. */
export async function criarCartaoDaPessoa(usuarioId, trilhaId, bruto) {
  if (!ehId(trilhaId)) throw new ErroDeAcesso(404, "trilha não encontrada");
  const trilha = await trilhaDoUsuario(trilhaId, usuarioId);
  let cartao;
  try { cartao = validarCartao(bruto); } catch (e) { throw new ErroDeAcesso(400, e.message); }
  exigirEspaco(await frentesDa(usuarioId, trilha.id));
  const { data, error } = await supabase.from("proof_cartoes").insert({
    usuario_id: usuarioId, trilha_id: trilha.id, origem: "pessoa", ...cartao, ...agendaNova(diaDe()),
  }).select(CAMPOS).single();
  falhou(error, "cartão");
  return cartaoParaTela(data, diaDe());
}

async function cartaoDoUsuario(id, usuarioId) {
  if (!ehId(id)) throw new ErroDeAcesso(404, "cartão não encontrado");
  const { data, error } = await supabase.from("proof_cartoes").select(`usuario_id, ${CAMPOS}`).eq("id", id).maybeSingle();
  falhou(error, "cartão");
  if (!data || data.usuario_id !== usuarioId) throw new ErroDeAcesso(404, "cartão não encontrado");
  return data;
}

/**
 * Revisar um cartão (esqueci, difícil, lembrei, fácil): a agenda anda e a revisão do dia pontua.
 * A trava é o estado que eu li: dois toques ao mesmo tempo, só um grava.
 */
export async function revisarUmCartao(usuarioId, id, resposta) {
  if (!RESPOSTAS_DO_CARTAO[resposta]) throw new ErroDeAcesso(400, "resposta inválida");
  const c = await cartaoDoUsuario(id, usuarioId);
  const hoje = diaDe();
  const agenda = revisarCartao(c, resposta, hoje);
  const antes = await revisadosHoje(usuarioId);
  let trava = supabase.from("proof_cartoes").update({ ...agenda, revisado_em: new Date().toISOString() })
    .eq("id", id).eq("repeticoes", c.repeticoes).eq("lapsos", c.lapsos);
  trava = c.revisado_em ? trava.eq("revisado_em", c.revisado_em) : trava.is("revisado_em", null);
  const { data: gravou, error } = await trava.select("id");
  falhou(error, "cartão");
  if (!gravou?.length) throw new ErroDeAcesso(409, "este cartão acabou de ser revisado");

  // revisado de novo hoje (esqueceu e voltou na mesma sessão) não conta duas vezes
  const jaContava = c.revisado_em && c.revisado_em >= inicioDeHoje();
  const feitos = jaContava ? antes : antes + 1;
  const estudavaAntes = await estudouHoje(usuarioId);
  const ganhou = await registrarOuMelhorar({
    usuarioId, trilhaId: c.trilha_id, tipo: "cartoes", chave: `cartoes:${hoje}`, pontos: pontosDaRevisao(feitos),
    detalhe: { titulo: "Revisão de cartões", cartoes: feitos },
  });
  const extra = ganhou > 0 ? await depoisDePontuar({ usuarioId, trilhaId: c.trilha_id, estudavaAntes, ganhou }) : null;
  return { proximaEm: agenda.proxima_em, intervalo: agenda.intervalo, revisadosHoje: feitos, ...(extra ? resultadoDaPontuacao(ganhou, extra) : { pontos: 0 }) };
}

export async function apagarCartao(usuarioId, id) {
  await cartaoDoUsuario(id, usuarioId);
  const { error } = await supabase.from("proof_cartoes").delete().eq("id", id).eq("usuario_id", usuarioId);
  falhou(error, "cartão");
}
