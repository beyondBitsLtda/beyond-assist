// O correio dos jogadores no banco (BEYOND-0016). As regras moram em src/dominio/correio.js; a tela é
// /correio, e a pergunta mandada sai do próprio quiz (src/componentes/Desafios.js).
//
// As moedas vão para o livro do Reino (tipo "correio"), no mundo de verdade, como as do Acervo. A carta
// é marcada ANTES de pagar, com a condição de ainda não ter sido avaliada/respondida: dois cliques
// juntos não pagam duas vezes.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { creditarMoedas, nomesPublicos } from "./reino.js";
import { desafioDoUsuario, gravarQuiz } from "./pratica.js";
import { diaDe } from "@/dominio/datas.js";
import {
  CORREIO, conferirRecado, podeMandarPergunta, perguntaNaCarta, recompensaDoRecado, recompensaDaPergunta, podeEscreverPara,
} from "@/dominio/correio.js";

const falhou = (error, onde) => { if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`); };
const uuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));
// meia-noite de hoje em Brasília (UTC−3)
const inicioDeHoje = () => new Date(`${diaDe()}T03:00:00.000Z`).toISOString();

async function perfilDe(id) {
  const [{ data: conta }, { data: perfil }] = await Promise.all([
    supabase.from("abacato_usuarios").select("id, ativo").eq("id", id).maybeSingle(),
    supabase.from("proof_perfis").select("robo, no_ranking").eq("usuario_id", id).maybeSingle(),
  ]);
  return conta && conta.ativo !== false ? { id, robo: Boolean(perfil?.robo), noRanking: perfil?.no_ranking !== false } : null;
}

/**
 * Para quem dá para escrever: quem aparece no ranking (quem saiu dele não entra na lista), menos a
 * própria pessoa. A Lisa aparece marcada (recebe recado, não pergunta).
 */
export async function destinatarios(usuarioId) {
  const { data: ranking, error } = await supabase.from("proof_ranking_total").select("usuario_id, pontos").order("pontos", { ascending: false }).limit(80);
  falhou(error, "ranking");
  const ids = (ranking || []).map((r) => r.usuario_id).filter((id) => id !== usuarioId);
  if (!ids.length) return [];
  const [{ data: perfis }, nomes] = await Promise.all([
    supabase.from("proof_perfis").select("usuario_id, robo, no_ranking").in("usuario_id", ids),
    nomesPublicos(ids),
  ]);
  const porId = new Map((perfis || []).map((p) => [p.usuario_id, p]));
  return ids.filter((id) => porId.get(id)?.no_ranking !== false)
    .map((id) => ({ id, nome: nomes.get(id) || "Estudante", robo: Boolean(porId.get(id)?.robo) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** A caixa: o que chegou e o que mandou (as últimas 60 de cada), e quantas não lidas. */
export async function caixaDoCorreio(usuarioId) {
  const campos = "id, de_id, para_id, tipo, texto, pergunta, lida, avaliacao, escolha, acertou, moedas_de, moedas_para, criado_em";
  const [rec, env] = await Promise.all([
    supabase.from("proof_correio").select(campos).eq("para_id", usuarioId).order("criado_em", { ascending: false }).limit(60),
    supabase.from("proof_correio").select(campos).eq("de_id", usuarioId).order("criado_em", { ascending: false }).limit(60),
  ]);
  falhou(rec.error, "correio");
  falhou(env.error, "correio");
  const nomes = await nomesPublicos([...(rec.data || []).map((c) => c.de_id), ...(env.data || []).map((c) => c.para_id)]);
  const respondida = (c) => c.escolha !== null && c.escolha !== undefined;
  return {
    mensageiro: CORREIO.mensageiro,
    regras: CORREIO,
    naoLidas: (rec.data || []).filter((c) => !c.lida).length,
    recebidas: (rec.data || []).map((c) => ({
      id: c.id, tipo: c.tipo, de: nomes.get(c.de_id) || "Estudante", texto: c.texto, lida: c.lida, criadoEm: c.criado_em,
      avaliacao: c.avaliacao, respondida: respondida(c), acertou: c.acertou, escolha: c.escolha, moedas: c.moedas_para,
      pergunta: c.pergunta ? perguntaNaCarta(c.pergunta, { mostrarResposta: respondida(c) }) : null,
    })),
    enviadas: (env.data || []).map((c) => ({
      id: c.id, tipo: c.tipo, para: nomes.get(c.para_id) || "Estudante", texto: c.texto, criadoEm: c.criado_em,
      avaliacao: c.avaliacao, respondida: respondida(c), acertou: c.acertou, moedas: c.moedas_de,
    })),
  };
}

/** Marca como lidas as cartas que chegaram (quando a pessoa abre a caixa). */
export async function lerCorreio(usuarioId) {
  const { error } = await supabase.from("proof_correio").update({ lida: true }).eq("para_id", usuarioId).eq("lida", false);
  falhou(error, "correio");
}

/** Um recado: até CORREIO.recadosPorDia por dia, para quem está na lista. */
export async function mandarRecado(usuarioId, { paraId, texto }) {
  const r = conferirRecado(texto);
  if (!r.ok) throw new ErroDeAcesso(400, r.erro);
  if (!uuid(paraId)) throw new ErroDeAcesso(400, "escolha para quem vai");
  const para = await perfilDe(paraId);
  if (!para) throw new ErroDeAcesso(404, "não achei esse jogador");
  const pode = podeEscreverPara({ de: usuarioId, para: paraId, tipo: "recado", paraEhRobo: para.robo });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const { count } = await supabase.from("proof_correio").select("id", { count: "exact", head: true })
    .eq("de_id", usuarioId).eq("tipo", "recado").gte("criado_em", inicioDeHoje());
  if ((count || 0) >= CORREIO.recadosPorDia) throw new ErroDeAcesso(429, `o mensageiro leva até ${CORREIO.recadosPorDia} recados por dia — amanhã tem mais`);
  const { data, error } = await supabase.from("proof_correio").insert({ de_id: usuarioId, para_id: paraId, tipo: "recado", texto: r.texto }).select("id").single();
  falhou(error, "recado");
  return { id: data.id };
}

/** Quem recebeu avalia o recado (uma vez). Útil: os dois ganham (com os tetos de recompensaDoRecado). */
export async function avaliarRecado(usuarioId, id, util) {
  const { data: c, error } = await supabase.from("proof_correio").select("id, de_id, para_id, tipo, avaliacao").eq("id", id).eq("para_id", usuarioId).maybeSingle();
  falhou(error, "recado");
  if (!c || c.tipo !== "recado") throw new ErroDeAcesso(404, "recado não encontrado");
  if (c.avaliacao) throw new ErroDeAcesso(409, "este recado já foi avaliado");
  const desde = inicioDeHoje();
  const [pagos, doPar] = await Promise.all([
    supabase.from("proof_correio").select("id", { count: "exact", head: true }).eq("de_id", c.de_id).eq("tipo", "recado").gt("moedas_de", 0).gte("respondido_em", desde),
    supabase.from("proof_correio").select("id", { count: "exact", head: true }).eq("de_id", c.de_id).eq("para_id", usuarioId).eq("tipo", "recado").gt("moedas_para", 0).gte("respondido_em", desde),
  ]);
  const ganho = recompensaDoRecado({ util: Boolean(util), pagosHojeAoRemetente: pagos.count || 0, parJaPagouHoje: (doPar.count || 0) > 0 });
  const { data: marcada, error: e2 } = await supabase.from("proof_correio")
    .update({ avaliacao: util ? "util" : "nao_util", moedas_de: ganho.remetente, moedas_para: ganho.destinatario, respondido_em: new Date().toISOString(), lida: true })
    .eq("id", c.id).is("avaliacao", null).select("id");
  falhou(e2, "recado");
  if (!marcada?.length) throw new ErroDeAcesso(409, "este recado já foi avaliado");
  if (ganho.destinatario > 0) await creditarMoedas(usuarioId, "correio", ganho.destinatario, { carta: c.id, recado: "útil (recebeu)" });
  if (ganho.remetente > 0) await creditarMoedas(c.de_id, "correio", ganho.remetente, { carta: c.id, recado: "útil (mandou)" });
  return { moedas: ganho.destinatario, remetenteGanhou: ganho.remetente };
}

/**
 * Do quiz do dia, uma pergunta vai pelo correio para outro jogador (até 2 por quiz; sobram pelo menos 3
 * para responder). Ela sai do placar; se era a última que faltava, o quiz termina aqui — com os pontos
 * reduzidos do correio (gravarQuiz).
 */
export async function mandarPerguntaDoQuiz(usuarioId, desafioId, { indice, paraId }) {
  const d = await desafioDoUsuario(desafioId, usuarioId);
  if (d.tipo !== "quiz") throw new ErroDeAcesso(400, "só pergunta de quiz vai pelo correio");
  if (d.periodo !== diaDe()) throw new ErroDeAcesso(400, "este quiz já passou");
  const perguntas = d.conteudo.perguntas;
  const escolhas = { ...(d.resposta?.escolhas || {}) };
  const enviadas = (d.resposta?.enviadas || []).map(Number);
  const pode = podeMandarPergunta({ perguntas, escolhas, enviadas, indice, status: d.status });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  if (!uuid(paraId)) throw new ErroDeAcesso(400, "escolha para quem vai");
  const para = await perfilDe(paraId);
  if (!para) throw new ErroDeAcesso(404, "não achei esse jogador");
  const destino = podeEscreverPara({ de: usuarioId, para: paraId, tipo: "pergunta", paraEhRobo: para.robo });
  if (!destino.ok) throw new ErroDeAcesso(400, destino.motivo);

  const i = Number(indice);
  const { error } = await supabase.from("proof_correio").insert({
    de_id: usuarioId, para_id: paraId, tipo: "pergunta", texto: `Uma pergunta do quiz "${String(d.titulo || "do dia").replace(/^Quiz:\s*/, "")}"`,
    pergunta: perguntas[i], desafio_id: d.id, indice: i,
  });
  if (error?.code === "23505") throw new ErroDeAcesso(409, "esta pergunta já foi pelo correio");
  falhou(error, "pergunta pelo correio");
  delete escolhas[i]; // a errada que foi pelo correio sai do placar
  return gravarQuiz({ usuarioId, d, escolhas, enviadas: [...enviadas, i] });
}

/** Quem recebeu a pergunta responde (uma vez). Acertou: os dois ganham. Devolve a certa e a explicação. */
export async function responderPergunta(usuarioId, id, escolha) {
  const e = Number(escolha);
  if (!Number.isInteger(e) || e < 0 || e > 3) throw new ErroDeAcesso(400, "opção inválida");
  const { data: c, error } = await supabase.from("proof_correio").select("id, de_id, tipo, pergunta, escolha").eq("id", id).eq("para_id", usuarioId).maybeSingle();
  falhou(error, "pergunta");
  if (!c || c.tipo !== "pergunta" || !c.pergunta) throw new ErroDeAcesso(404, "pergunta não encontrada");
  if (c.escolha !== null && c.escolha !== undefined) throw new ErroDeAcesso(409, "esta pergunta já foi respondida");
  const acertou = Number(c.pergunta.correta) === e;
  const ganho = recompensaDaPergunta(acertou);
  const { data: marcada, error: e2 } = await supabase.from("proof_correio")
    .update({ escolha: e, acertou, moedas_de: ganho.remetente, moedas_para: ganho.destinatario, respondido_em: new Date().toISOString(), lida: true })
    .eq("id", c.id).is("escolha", null).select("id");
  falhou(e2, "pergunta");
  if (!marcada?.length) throw new ErroDeAcesso(409, "esta pergunta já foi respondida");
  if (ganho.destinatario > 0) await creditarMoedas(usuarioId, "correio", ganho.destinatario, { carta: c.id, pergunta: "acertou" });
  if (ganho.remetente > 0) await creditarMoedas(c.de_id, "correio", ganho.remetente, { carta: c.id, pergunta: "ajudou" });
  return { acertou, correta: Number(c.pergunta.correta), explicacao: c.pergunta.explicacao || "", moedas: ganho.destinatario };
}
