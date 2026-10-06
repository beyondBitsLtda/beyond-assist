// A parte prática no banco: gerar (ou reaproveitar) o desafio do período, responder, entregar e
// pontuar. A regra de cada coisa mora em src/dominio/pratica.js; aqui é só o caminho até o banco,
// a IA e o GitHub.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import {
  buscarEmLotes, registrarEvento, registrarOuMelhorar, conferirMetaDiaria, quadroDeEstudo, trilhaDoUsuario,
} from "./estudo.js";
import { temModelo } from "./ia.js";
import { gerarQuiz, gerarExercicio, gerarProjeto, avaliarExercicio, avaliarProjeto } from "./iaPratica.js";
import { lerRepositorio, ErroDoGitHub } from "./github.js";
import { diaDe, inicioDaSemana, inicioDoMes } from "@/dominio/datas.js";
import {
  TIPOS_DE_DESAFIO, NOMES_DOS_DESAFIOS, TENTATIVAS, NOTA_DE_APROVACAO, periodoDe, fimDoPeriodo, periodoPermitido,
  pontosDoQuiz, pontosDaNota, quizParaTela, assuntoAtual, assuntosDoPeriodo,
} from "@/dominio/pratica.js";

const CAMPOS = "id, usuario_id, trilha_id, tipo, periodo, card_ids, titulo, conteudo, status, resposta, avaliacao, nota, pontos, tentativas, criado_em, atualizado_em";

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

/** Etapas vivas de várias trilhas, com título e situação do card: `Map<trilhaId, etapa[]>`. */
export async function etapasDasTrilhas(trilhaIds) {
  const etapas = await buscarEmLotes(
    "proof_etapas", "trilha_id, card_id, ordem, semana, inicio, fim", "trilha_id", trilhaIds
  );
  const cards = await buscarEmLotes(
    "abacato_cards", "id, titulo, descricao, concluido, arquivado", "id", etapas.map((e) => e.card_id)
  );
  const cardPorId = new Map(cards.map((c) => [c.id, c]));
  const porTrilha = new Map(trilhaIds.map((id) => [id, []]));
  for (const e of etapas) {
    const c = cardPorId.get(e.card_id);
    if (!c || c.arquivado) continue;
    porTrilha.get(e.trilha_id)?.push({
      cardId: e.card_id, ordem: e.ordem, semana: e.semana, inicio: e.inicio, fim: e.fim,
      concluido: Boolean(c.concluido), titulo: c.titulo, descricao: c.descricao || "",
    });
  }
  return porTrilha;
}

/** Os assuntos que o desafio cobre. Projeto sem assunto planejado no período (trilha que começou
 *  depois, semana sem estudo) cai no assunto atual — melhor um projeto pequeno que nenhum. */
function assuntosPara(tipo, periodo, etapas, hoje) {
  const atual = assuntoAtual(etapas, hoje);
  if (tipo === "quiz" || tipo === "exercicio") return atual ? [atual] : [];
  const doPeriodo = assuntosDoPeriodo(etapas, periodo, fimDoPeriodo(tipo, periodo));
  if (doPeriodo.length) return doPeriodo.slice(0, 12);
  return atual ? [atual] : [];
}

// ---------------------------------------------------------------- ler

/** O desafio como a tela pode ver (o quiz sem o gabarito das perguntas não respondidas). */
export function desafioParaTela(d, tema) {
  const base = {
    id: d.id,
    trilhaId: d.trilha_id,
    tema: tema || "",
    tipo: d.tipo,
    nome: NOMES_DOS_DESAFIOS[d.tipo],
    periodo: d.periodo,
    ate: fimDoPeriodo(d.tipo, d.periodo),
    titulo: d.titulo,
    status: d.status,
    nota: d.nota,
    pontos: d.pontos,
    tentativas: d.tentativas,
    maxTentativas: TENTATIVAS[d.tipo] || null,
    avaliacao: d.avaliacao || null,
  };
  if (d.tipo === "quiz") {
    return { ...base, perguntas: quizParaTela(d.conteudo, d.resposta) };
  }
  return { ...base, conteudo: d.conteudo, resposta: d.resposta || {} };
}

export async function desafioDoUsuario(id, usuarioId) {
  const { data, error } = await supabase.from("proof_desafios").select(CAMPOS).eq("id", id).eq("usuario_id", usuarioId).maybeSingle();
  falhou(error, "desafio");
  if (!data) throw new ErroDeAcesso(404, "desafio não encontrado");
  return data;
}

/**
 * O resumo da prática de cada trilha ativa: o assunto atual e a situação do quiz e do exercício
 * de hoje e dos projetos da semana e do mês. É o que alimenta a cobrança na tela.
 */
export async function resumoDaPratica(usuarioId, trilhas, hoje = diaDe()) {
  if (!trilhas.length) return [];
  const ids = trilhas.map((t) => t.id);
  const semana = inicioDaSemana(hoje);
  const mes = inicioDoMes(hoje);
  const [etapas, desafiosR] = await Promise.all([
    etapasDasTrilhas(ids),
    supabase.from("proof_desafios")
      .select("id, trilha_id, tipo, periodo, status, nota, pontos, titulo")
      .eq("usuario_id", usuarioId)
      .in("periodo", [...new Set([hoje, semana, mes])]),
  ]);
  falhou(desafiosR.error, "desafios");

  const achar = (trilhaId, tipo, periodo) =>
    (desafiosR.data || []).find((d) => d.trilha_id === trilhaId && d.tipo === tipo && d.periodo === periodo) || null;
  const curto = (d) => (d ? { id: d.id, status: d.status, nota: d.nota, pontos: d.pontos, titulo: d.titulo } : null);

  return trilhas.map((t) => {
    const atual = assuntoAtual(etapas.get(t.id) || [], hoje);
    return {
      trilhaId: t.id,
      tema: t.tema,
      assunto: atual ? { cardId: atual.cardId, titulo: atual.titulo } : null,
      quiz: curto(achar(t.id, "quiz", hoje)),
      exercicio: curto(achar(t.id, "exercicio", hoje)),
      projetoSemanal: { periodo: semana, ...(curto(achar(t.id, "projeto_semanal", semana)) || { status: null }) },
      projetoMensal: { periodo: mes, ...(curto(achar(t.id, "projeto_mensal", mes)) || { status: null }) },
    };
  });
}

// ---------------------------------------------------------------- gerar

/**
 * O desafio do período: o que já existe, ou um novo gerado pela IA.
 *
 * A IA é chamada ANTES do insert, e o índice único (usuário, trilha, tipo, período) decide quem
 * fica se dois pedidos chegarem juntos: o segundo perde o insert e devolve o do primeiro. Gasta
 * uma chamada de IA à toa nesse caso raro, mas nunca cria dois quizzes do mesmo dia.
 */
export async function obterOuCriarDesafio({ usuarioId, trilhaId, tipo, periodo }) {
  if (!TIPOS_DE_DESAFIO.includes(tipo)) throw new ErroDeAcesso(400, "tipo de desafio inválido");
  const hoje = diaDe();
  const alvo = periodo || periodoDe(tipo, hoje);
  if (!periodoPermitido(tipo, alvo, hoje)) throw new ErroDeAcesso(400, "este período ainda não está liberado");

  const trilha = await trilhaDoUsuario(trilhaId, usuarioId);
  const existente = await supabase.from("proof_desafios").select(CAMPOS)
    .eq("usuario_id", usuarioId).eq("trilha_id", trilha.id).eq("tipo", tipo).eq("periodo", alvo).maybeSingle();
  falhou(existente.error, "desafio");
  if (existente.data) return { desafio: existente.data, tema: trilha.tema, novo: false };

  await quadroDeEstudo(trilha.quadro_id, usuarioId); // o quadro ainda é desta pessoa e de estudo
  if (!temModelo()) throw new ErroDeAcesso(503, "a IA não está configurada neste servidor");

  const etapas = (await etapasDasTrilhas([trilha.id])).get(trilha.id) || [];
  const assuntos = assuntosPara(tipo, alvo, etapas, hoje);
  if (!assuntos.length) throw new ErroDeAcesso(400, "a trilha não tem assuntos para praticar");

  let conteudo, titulo;
  try {
    if (tipo === "quiz") {
      conteudo = await gerarQuiz({ tema: trilha.tema, assunto: assuntos[0] });
      titulo = `Quiz: ${assuntos[0].titulo}`;
    } else if (tipo === "exercicio") {
      conteudo = await gerarExercicio({ tema: trilha.tema, assunto: assuntos[0] });
      titulo = conteudo.titulo;
    } else {
      conteudo = await gerarProjeto({ tema: trilha.tema, tipo, assuntos });
      titulo = conteudo.titulo;
    }
  } catch (e) {
    throw new ErroDeAcesso(502, e.message);
  }

  const { data, error } = await supabase.from("proof_desafios").insert({
    usuario_id: usuarioId, trilha_id: trilha.id, tipo, periodo: alvo,
    card_ids: assuntos.map((a) => a.cardId), titulo: String(titulo).slice(0, 200), conteudo,
  }).select(CAMPOS).single();

  if (error?.code === "23505") {
    const { data: ganhou } = await supabase.from("proof_desafios").select(CAMPOS)
      .eq("usuario_id", usuarioId).eq("trilha_id", trilha.id).eq("tipo", tipo).eq("periodo", alvo).single();
    return { desafio: ganhou, tema: trilha.tema, novo: false };
  }
  falhou(error, "desafio");
  return { desafio: data, tema: trilha.tema, novo: true };
}

// ---------------------------------------------------------------- responder e entregar

async function salvar(id, campos) {
  const { error } = await supabase.from("proof_desafios")
    .update({ ...campos, atualizado_em: new Date().toISOString() }).eq("id", id);
  falhou(error, "desafio");
}

/** Uma resposta do quiz. A correção é aqui, no servidor — a tela nunca recebe o gabarito antes. */
export async function responderQuiz({ usuarioId, id, indice, escolha }) {
  const d = await desafioDoUsuario(id, usuarioId);
  if (d.tipo !== "quiz") throw new ErroDeAcesso(400, "este desafio não é um quiz");
  if (d.periodo !== diaDe()) throw new ErroDeAcesso(400, "este quiz já passou — faça o de hoje");

  const perguntas = d.conteudo.perguntas;
  const i = Number(indice);
  const e = Number(escolha);
  if (!Number.isInteger(i) || i < 0 || i >= perguntas.length) throw new ErroDeAcesso(400, "pergunta inválida");
  if (!Number.isInteger(e) || e < 0 || e > 3) throw new ErroDeAcesso(400, "opção inválida");

  const escolhas = { ...(d.resposta?.escolhas || {}) };
  if (escolhas[i] !== undefined) throw new ErroDeAcesso(409, "esta pergunta já foi respondida");
  escolhas[i] = e;

  const respondidas = Object.keys(escolhas).length;
  const acertos = Object.entries(escolhas).filter(([k, v]) => perguntas[Number(k)].correta === v).length;
  const terminou = respondidas === perguntas.length;

  let pontos = 0;
  let bonus = 0;
  const pontosDoDesafio = terminou ? pontosDoQuiz(acertos, perguntas.length) : 0;
  await salvar(d.id, {
    resposta: { escolhas },
    status: terminou ? "concluido" : "em_andamento",
    ...(terminou ? { nota: Math.round((acertos / perguntas.length) * 100), pontos: pontosDoDesafio } : {}),
  });
  if (terminou) {
    pontos = await registrarEvento({
      usuarioId, trilhaId: d.trilha_id, tipo: "quiz", chave: `pratica:${d.id}`, pontos: pontosDoDesafio,
      detalhe: { titulo: d.titulo, acertos, total: perguntas.length },
    });
    bonus = await conferirMetaDiaria(usuarioId, d.trilha_id);
  }

  return {
    acertou: perguntas[i].correta === e,
    correta: perguntas[i].correta,
    explicacao: perguntas[i].explicacao,
    terminou,
    acertos,
    total: perguntas.length,
    pontos: pontos + bonus,
    metaBatida: bonus > 0,
  };
}

function exigirReenvio(d) {
  const maximo = TENTATIVAS[d.tipo];
  if (d.status === "concluido") {
    throw new ErroDeAcesso(409, d.nota >= NOTA_DE_APROVACAO ? "este desafio já foi aprovado" : "as tentativas deste desafio acabaram");
  }
  if (d.tentativas >= maximo) throw new ErroDeAcesso(409, "as tentativas deste desafio acabaram");
}

/** Fecha uma entrega avaliada: grava, pontua pela melhor nota e diz se ainda dá para reenviar. */
async function fecharEntrega({ usuarioId, d, avaliacao, resposta }) {
  const tentativas = d.tentativas + 1;
  const melhorNota = Math.max(d.nota ?? 0, avaliacao.nota);
  const pontosDoDesafio = pontosDaNota(d.tipo, melhorNota);
  const acabou = avaliacao.aprovado || tentativas >= TENTATIVAS[d.tipo];

  await salvar(d.id, {
    resposta,
    avaliacao,
    nota: melhorNota,
    pontos: pontosDoDesafio,
    tentativas,
    status: acabou ? "concluido" : "em_andamento",
  });

  const pontos = await registrarOuMelhorar({
    usuarioId, trilhaId: d.trilha_id, tipo: d.tipo, chave: `pratica:${d.id}`, pontos: pontosDoDesafio,
    detalhe: { titulo: d.titulo, nota: melhorNota },
  });
  const bonus = pontos > 0 ? await conferirMetaDiaria(usuarioId, d.trilha_id) : 0;

  return {
    avaliacao,
    nota: melhorNota,
    tentativas,
    restantes: Math.max(0, TENTATIVAS[d.tipo] - tentativas),
    concluido: acabou,
    pontos: pontos + bonus,
    metaBatida: bonus > 0,
  };
}

export async function enviarExercicio({ usuarioId, id, codigo }) {
  const d = await desafioDoUsuario(id, usuarioId);
  if (d.tipo !== "exercicio") throw new ErroDeAcesso(400, "este desafio não é um exercício");
  exigirReenvio(d);
  const texto = String(codigo || "");
  if (texto.trim().length < 10) throw new ErroDeAcesso(400, "escreva a sua solução antes de enviar");
  if (texto.length > 20_000) throw new ErroDeAcesso(400, "a solução passou de 20 mil caracteres");

  const trilha = await trilhaDoUsuario(d.trilha_id, usuarioId);
  let avaliacao;
  try {
    avaliacao = await avaliarExercicio({ tema: trilha.tema, exercicio: d.conteudo, codigo: texto });
  } catch (e) {
    throw new ErroDeAcesso(502, e.message);
  }
  return fecharEntrega({ usuarioId, d, avaliacao, resposta: { codigo: texto } });
}

export async function enviarProjeto({ usuarioId, id, repo }) {
  const d = await desafioDoUsuario(id, usuarioId);
  if (d.tipo !== "projeto_semanal" && d.tipo !== "projeto_mensal") throw new ErroDeAcesso(400, "este desafio não é um projeto");
  exigirReenvio(d);

  const trilha = await trilhaDoUsuario(d.trilha_id, usuarioId);
  let repositorio;
  try {
    repositorio = await lerRepositorio(repo);
  } catch (e) {
    throw new ErroDeAcesso(e instanceof ErroDoGitHub ? 400 : 502, e.message);
  }

  let avaliacao;
  try {
    avaliacao = await avaliarProjeto({ tema: trilha.tema, projeto: d.conteudo, repositorio });
  } catch (e) {
    throw new ErroDeAcesso(502, e.message);
  }
  return fecharEntrega({
    usuarioId, d, avaliacao,
    resposta: { repo: repositorio.url, branch: repositorio.branch, arquivos: repositorio.arquivos.map((a) => a.caminho) },
  });
}
