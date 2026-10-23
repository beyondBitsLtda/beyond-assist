// A parte prática no banco: gerar (ou reaproveitar) o desafio do período, responder, entregar e
// pontuar. A regra de cada coisa mora em src/dominio/pratica.js; aqui é só o caminho até o banco,
// a IA e o GitHub.
//
// AMARRADA À TRILHA (23/10/2026, src/dominio/avanco.js): o quiz e o exercício são do assunto da vez
// (o das semanas abertas do plano); o quiz aprovado conclui o assunto; cada semana do plano tem o
// seu projeto, a última tem o projeto final, e o projeto aprovado abre a semana seguinte.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import {
  registrarEvento, registrarOuMelhorar, quadroDeEstudo, trilhaDoUsuario,
  estudouHoje, depoisDePontuar, resultadoDaPontuacao,
} from "./estudo.js";
import { temModelo } from "./ia.js";
import { gerarQuiz, gerarExercicio, gerarProjeto, gerarGuiaDoProjeto, ajustarComplexidadeDoProjeto, avaliarExercicio, avaliarProjeto } from "./iaPratica.js";
import { lerRepositorio, ErroDoGitHub } from "./github.js";
import { diaDe } from "@/dominio/datas.js";
import {
  TIPOS_DE_DESAFIO, NOMES_DOS_DESAFIOS, TENTATIVAS, NOTA_DE_APROVACAO, fimDoPeriodo,
  pontosDoQuiz, pontosDaNota, quizParaTela, podeReenviar, entregaConcluida, ehProjeto,
  RODADAS_POR_DIA, podeAbrirRodada, comFatorDaRodada,
  tabelaDePontos, cumpridosNaAvaliacao, juntarCumpridos, pontosDoProjeto, projetoCompleto,
  complexidadeDe, podeTrocarComplexidade, TROCAS_DE_COMPLEXIDADE,
} from "@/dominio/pratica.js";
import { semanaDoProjeto, podeGerarProjeto, valorDoProjetoFinal, PROJETOS_POR_SEMANA } from "@/dominio/avanco.js";
import { avancoDasTrilhas, avancoDaTrilhaDoUsuario } from "./avanco.js";

const CAMPOS = "id, usuario_id, trilha_id, tipo, periodo, rodada, card_ids, titulo, conteudo, status, resposta, avaliacao, nota, pontos, tentativas, criado_em, atualizado_em";

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

// ---------------------------------------------------------------- projetos: pontos por parte

const eProjeto = ehProjeto;
const NADA_CUMPRIDO = { requisitos: [], extras: [] };

/** O que o projeto já tem garantido. Projeto entregue antes da pontuação por parte (sem
 *  `resposta.cumpridos`) é lido da última avaliação, na ordem dos requisitos. */
function cumpridosDe(d) {
  return d.resposta?.cumpridos || (d.avaliacao ? cumpridosNaAvaliacao(d.avaliacao, d.conteudo) : NADA_CUMPRIDO);
}

/** A pontuação do projeto como a tela mostra: quanto vale cada parte e o que já foi garantido. */
function pontuacaoDoProjeto(d) {
  const tabela = tabelaDePontos(d.tipo, d.conteudo);
  const cumpridos = cumpridosDe(d);
  return {
    tabela,
    cumpridos,
    garantidos: pontosDoProjeto(tabela, cumpridos),
    completo: projetoCompleto(tabela, cumpridos),
    entregas: d.resposta?.entregas || [],
  };
}

/** O projeto da vez de uma trilha, como a tela mostra: a semana do plano (ou o final), se está
 *  liberado e o desafio dele (se já existe). */
function projetoDaVezParaTela(avanco) {
  const u = avanco.semanaDaVez || avanco.unidades.at(-1) || null;
  if (!u) return null;
  const d = u.projeto;
  return {
    tipo: u.tipo, periodo: u.periodo, numero: u.numero, final: u.final, semanas: avanco.unidades.length,
    de: u.de, ate: u.ate, aberta: u.aberta, liberado: u.projetoLiberado, aprovado: u.aprovado, passou: u.passou,
    podeOutro: u.podeOutroProjeto, rodadas: u.rodadas,
    ...(d ? { id: d.id, status: d.status, nota: d.nota, titulo: d.titulo } : { status: null }),
  };
}

// ---------------------------------------------------------------- ler

/** O desafio como a tela pode ver (o quiz sem o gabarito das perguntas não respondidas). */
export function desafioParaTela(d, tema) {
  const base = {
    id: d.id,
    trilhaId: d.trilha_id,
    tema: tema || "",
    tipo: d.tipo,
    nome: d.tipo === "projeto_semanal" && d.conteudo?.semana ? `Projeto da semana ${d.conteudo.semana}` : NOMES_DOS_DESAFIOS[d.tipo],
    periodo: d.periodo,
    rodada: d.rodada || 1,
    maxRodadas: RODADAS_POR_DIA[d.tipo] || 1,
    ate: d.conteudo?.ate || fimDoPeriodo(d.tipo, d.periodo),
    titulo: d.titulo,
    // o projeto da semana do plano e o final guardam a semana e o prazo dela; os antigos, o do calendário
    semana: d.conteudo?.semana || null,
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
  if (eProjeto(d.tipo)) {
    const { original, ...conteudo } = d.conteudo || {}; // a versão padrão guardada não vai para a tela
    const pontuacao = pontuacaoDoProjeto(d);
    return {
      ...base, conteudo, resposta: d.resposta || {}, pontuacao, completo: pontuacao.completo,
      complexidade: complexidadeDe(d.conteudo),
      trocasRestantes: Math.max(0, TROCAS_DE_COMPLEXIDADE - (d.conteudo?.trocas || 0)),
    };
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
export async function resumoDaPratica(usuarioId, trilhas, hoje = diaDe(), avancosProntos = null) {
  if (!trilhas.length) return [];
  const [avancos, desafiosR] = await Promise.all([
    avancosProntos || avancoDasTrilhas(trilhas, hoje),
    supabase.from("proof_desafios")
      .select("id, trilha_id, tipo, periodo, rodada, status, nota, pontos, titulo, tentativas")
      .eq("usuario_id", usuarioId)
      .eq("periodo", hoje)
      .in("tipo", ["quiz", "exercicio"]),
  ]);
  falhou(desafiosR.error, "desafios");

  const doPeriodo = (trilhaId, tipo, periodo) =>
    (desafiosR.data || []).filter((d) => d.trilha_id === trilhaId && d.tipo === tipo && d.periodo === periodo);
  // a rodada mais recente é a que aparece; "feito" vale se QUALQUER rodada do dia foi concluída
  const achar = (trilhaId, tipo, periodo) =>
    doPeriodo(trilhaId, tipo, periodo).reduce((m, d) => (!m || (d.rodada || 1) > (m.rodada || 1) ? d : m), null);
  const curto = (d) => (d ? { id: d.id, status: d.status, nota: d.nota, pontos: d.pontos, titulo: d.titulo, tentativas: d.tentativas, rodada: d.rodada || 1 } : null);
  const diario = (trilhaId, tipo) => {
    const lista = doPeriodo(trilhaId, tipo, hoje);
    const atual = curto(achar(trilhaId, tipo, hoje));
    if (!atual) return null;
    return {
      ...atual,
      rodadas: lista.length,
      maxRodadas: RODADAS_POR_DIA[tipo],
      feito: lista.some((d) => d.status === "concluido"),
      podeMais: podeAbrirRodada(tipo, lista).ok,
      pontosDoDia: lista.reduce((s, d) => s + (d.pontos || 0), 0),
    };
  };

  return trilhas.map((t) => {
    const avanco = avancos.get(t.id);
    const atual = avanco?.assuntoDaPratica || null;
    const semana = avanco?.semanaDaVez;
    return {
      trilhaId: t.id,
      tema: t.tema,
      // o assunto da prática: o quiz aprovado dele conclui o assunto (se a teoria também estiver feita)
      assunto: atual ? { cardId: atual.cardId, titulo: atual.titulo, teoria: atual.teoria, concluido: atual.concluido, faltaQuiz: atual.faltaQuiz } : null,
      semana: semana ? { numero: semana.numero, total: avanco.unidades.length, final: semana.final } : null,
      progresso: avanco?.progresso || { feitos: 0, total: 0 },
      concluida: Boolean(avanco?.concluida),
      quiz: diario(t.id, "quiz"),
      exercicio: diario(t.id, "exercicio"),
      projeto: avanco ? projetoDaVezParaTela(avanco) : null,
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
export async function obterOuCriarDesafio({ usuarioId, trilhaId, tipo, periodo, novaRodada = false, cardId = null }) {
  if (!TIPOS_DE_DESAFIO.includes(tipo)) throw new ErroDeAcesso(400, "tipo de desafio inválido");
  if (tipo === "projeto_mensal") throw new ErroDeAcesso(400, "o projeto do mês deu lugar ao projeto final da trilha");
  const hoje = diaDe();
  const { trilha, avanco } = await avancoDaTrilhaDoUsuario(trilhaId, usuarioId, hoje);
  const projeto = eProjeto(tipo);

  // quiz e exercício: de hoje, sobre o assunto da vez. Projeto: a semana do plano pedida (ou a da vez).
  let alvo = hoje;
  let unidade = null;
  if (projeto) {
    alvo = periodo || (avanco.semanaDaVez?.tipo === tipo ? avanco.semanaDaVez.periodo : null);
    unidade = alvo ? semanaDoProjeto(avanco, tipo, alvo) : null;
    if (!unidade) throw new ErroDeAcesso(400, tipo === "projeto_final" ? "esta trilha não tem projeto final agora" : "esta semana do plano não existe");
  } else if (periodo && periodo !== hoje) {
    throw new ErroDeAcesso(400, "quiz e exercício são só de hoje");
  }

  const existentes = await supabase.from("proof_desafios").select(CAMPOS)
    .eq("usuario_id", usuarioId).eq("trilha_id", trilha.id).eq("tipo", tipo).eq("periodo", alvo).order("rodada");
  falhou(existentes.error, "desafio");
  const doDia = existentes.data || [];

  let rodada = 1;
  // o quiz de UM assunto (o painel do assunto: "fazer o quiz deste assunto"): o de hoje dele, ou uma
  // rodada nova — se o quiz de hoje foi de outro assunto, conta como mais uma rodada do dia
  let assuntoPedido = null;
  if (tipo === "quiz" && cardId) {
    assuntoPedido = avanco.etapas.find((e) => String(e.cardId) === String(cardId)) || null;
    if (!assuntoPedido) throw new ErroDeAcesso(404, "este assunto não está na trilha");
    if (assuntoPedido.bloqueada) throw new ErroDeAcesso(409, `este assunto ${assuntoPedido.motivo}`);
    const dele = doDia.filter((d) => (d.card_ids || []).map(String).includes(String(cardId)));
    if (dele.length && !novaRodada) return { desafio: dele[dele.length - 1], tema: trilha.tema, novo: false };
    if (doDia.length) {
      const pode = podeAbrirRodada(tipo, doDia);
      if (!pode.ok) throw new ErroDeAcesso(409, pode.motivo);
      rodada = pode.rodada;
    }
  } else if (projeto) {
    // o projeto da semana que já existe (inclusive um antigo, da semana do calendário, que vale para ela)
    const vale = unidade.projeto ? await desafioDoUsuario(unidade.projeto.id, usuarioId).catch(() => null) : doDia.at(-1) || null;
    if (vale && !novaRodada) return { desafio: vale, tema: trilha.tema, novo: false };
    if (novaRodada) {
      if (!unidade.podeOutroProjeto) throw new ErroDeAcesso(409, `só dá para um projeto novo quando o anterior acabou sem aprovação (até ${PROJETOS_POR_SEMANA} por semana)`);
      rodada = Math.max(0, ...doDia.map((d) => d.rodada || 1)) + 1;
    }
    const pode = podeGerarProjeto(unidade, hoje);
    if (!pode.ok) throw new ErroDeAcesso(409, pode.motivo);
  } else if (!novaRodada || !RODADAS_POR_DIA[tipo]) {
    // sem pedir rodada nova: devolve a mais recente (ou cria a primeira)
    if (doDia.length) return { desafio: doDia[doDia.length - 1], tema: trilha.tema, novo: false };
  } else {
    const pode = podeAbrirRodada(tipo, doDia);
    if (!pode.ok) throw new ErroDeAcesso(409, pode.motivo);
    rodada = pode.rodada;
  }

  await quadroDeEstudo(trilha.quadro_id, usuarioId); // o quadro ainda é desta pessoa e de estudo
  if (!temModelo()) throw new ErroDeAcesso(503, "a IA não está configurada neste servidor");

  const semanas = avanco.unidades.length;
  const assuntos = assuntoPedido
    ? [assuntoPedido]
    : !projeto
    ? (avanco.assuntoDaPratica ? [avanco.assuntoDaPratica] : [])
    : tipo === "projeto_final" && semanas > 1
      ? avanco.etapas.filter((e) => e.inicio).slice(0, 15) // o final junta a trilha inteira
      : unidade.etapas.slice(0, 12);
  if (!assuntos.length) throw new ErroDeAcesso(400, "a trilha não tem assuntos para praticar");

  // as rodadas de antes, para não repetir pergunta nem exercício (a IA é avisada E o código confere)
  const anteriores = tipo === "quiz"
    ? doDia.flatMap((d) => (d.conteudo?.perguntas || []).map((p) => ({ pergunta: p.pergunta, codigo: p.codigo })))
    : doDia.map((d) => ({ titulo: d.titulo, enunciado: d.conteudo?.enunciado }));
  const evitar = tipo === "quiz" ? [] : anteriores.map((a) => `${a.titulo}: ${String(a.enunciado || "").slice(0, 300)}`);

  let conteudo, titulo;
  try {
    if (tipo === "quiz") {
      conteudo = await gerarQuiz({ tema: trilha.tema, assunto: assuntos[0], anteriores, rodada });
      titulo = `Quiz${rodada > 1 ? ` ${rodada}` : ""}: ${assuntos[0].titulo}`;
    } else if (tipo === "exercicio") {
      conteudo = await gerarExercicio({ tema: trilha.tema, assunto: assuntos[0], evitar, anteriores, rodada });
      titulo = conteudo.titulo;
    } else {
      conteudo = await gerarProjeto({ tema: trilha.tema, tipo, assuntos, semanas, numero: unidade.numero });
      titulo = conteudo.titulo;
      // a semana do plano e o prazo dela (o fim do que foi agendado); o final guarda o valor dele
      conteudo = { ...conteudo, semana: unidade.numero, ate: unidade.ate, ...(tipo === "projeto_final" ? { valor: valorDoProjetoFinal(semanas), semanas } : {}) };
    }
  } catch (e) {
    throw new ErroDeAcesso(502, e.message);
  }

  const { data, error } = await supabase.from("proof_desafios").insert({
    usuario_id: usuarioId, trilha_id: trilha.id, tipo, periodo: alvo, rodada,
    card_ids: assuntos.map((a) => a.cardId), titulo: String(titulo).slice(0, 200), conteudo,
  }).select(CAMPOS).single();

  if (error?.code === "23505") {
    const { data: ganhou } = await supabase.from("proof_desafios").select(CAMPOS)
      .eq("usuario_id", usuarioId).eq("trilha_id", trilha.id).eq("tipo", tipo).eq("periodo", alvo).eq("rodada", rodada).single();
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

  const pontosDoDesafio = terminou ? comFatorDaRodada(pontosDoQuiz(acertos, perguntas.length), d.rodada) : 0;
  const estudavaAntes = terminou ? await estudouHoje(usuarioId) : true;
  await salvar(d.id, {
    resposta: { escolhas },
    status: terminou ? "concluido" : "em_andamento",
    ...(terminou ? { nota: Math.round((acertos / perguntas.length) * 100), pontos: pontosDoDesafio } : {}),
  });

  let pontuacao = resultadoDaPontuacao(0, { pontosExtras: 0, metaBatida: false, ofensivaAumentou: false, ofensiva: null, conquistas: [] });
  let assunto = null;
  if (terminou) {
    // o quiz aprovado conclui o assunto (se a teoria também estiver feita): a trilha pode ter acabado
    const nota = Math.round((acertos / perguntas.length) * 100);
    if (nota >= NOTA_DE_APROVACAO) {
      const { avanco } = await avancoDaTrilhaDoUsuario(d.trilha_id, usuarioId);
      const etapa = avanco.etapas.find((e) => (d.card_ids || []).map(String).includes(String(e.cardId)));
      if (etapa) assunto = { titulo: etapa.titulo, concluido: etapa.concluido, faltaTeoria: !etapa.teoria };
    } else assunto = { reprovado: true, precisa: NOTA_DE_APROVACAO };
    const pontos = await registrarEvento({
      usuarioId, trilhaId: d.trilha_id, tipo: "quiz", chave: `pratica:${d.id}`, pontos: pontosDoDesafio,
      detalhe: { titulo: d.titulo, acertos, total: perguntas.length },
    });
    pontuacao = resultadoDaPontuacao(pontos, await depoisDePontuar({ usuarioId, trilhaId: d.trilha_id, estudavaAntes, ganhou: pontos, verTrilha: Boolean(assunto?.concluido) }));
  }

  return {
    assunto,
    acertou: perguntas[i].correta === e,
    correta: perguntas[i].correta,
    explicacao: perguntas[i].explicacao,
    terminou,
    acertos,
    total: perguntas.length,
    ...pontuacao,
  };
}

function exigirReenvio(d) {
  const alvo = eProjeto(d.tipo) ? { ...d, completo: pontuacaoDoProjeto(d).completo } : d;
  if (podeReenviar(alvo)) return;
  if (d.tentativas >= TENTATIVAS[d.tipo]) throw new ErroDeAcesso(409, "as tentativas deste desafio acabaram");
  throw new ErroDeAcesso(409, eProjeto(d.tipo) ? "este projeto já está completo — tudo entregue!" : "este desafio já foi aprovado");
}

/** Fecha uma entrega avaliada: grava, pontua pela melhor nota e diz se ainda dá para reenviar. */
async function fecharEntrega({ usuarioId, d, avaliacao, resposta }) {
  const tentativas = d.tentativas + 1;
  const melhorNota = Math.max(d.nota ?? 0, avaliacao.nota);
  let pontosDoDesafio = comFatorDaRodada(pontosDaNota(d.tipo, melhorNota), d.rodada);
  let acabou = entregaConcluida({ tipo: d.tipo, melhorNota, tentativas });
  let pontuacao = null;

  // Projeto: pontos POR PARTE (21/10/2026). O que esta entrega cumpriu junta com o que já estava
  // garantido; a entrega registra só o que foi novo, para a tela mostrar "+60 nesta entrega".
  if (eProjeto(d.tipo)) {
    const tabela = tabelaDePontos(d.tipo, d.conteudo);
    const antes = cumpridosDe(d);
    const cumpridos = juntarCumpridos(antes, cumpridosNaAvaliacao(avaliacao, d.conteudo));
    pontosDoDesafio = pontosDoProjeto(tabela, cumpridos);
    const novos = {
      requisitos: cumpridos.requisitos.filter((i) => !antes.requisitos.includes(i)),
      extras: cumpridos.extras.filter((i) => !antes.extras.includes(i)),
    };
    const entregas = [...(d.resposta?.entregas || []), {
      em: new Date().toISOString(), tentativa: tentativas, ...novos, pontos: pontosDoDesafio - pontosDoProjeto(tabela, antes),
    }].slice(-TENTATIVAS[d.tipo]);
    resposta = { ...resposta, cumpridos, entregas };
    acabou = acabou || cumpridos.requisitos.length >= tabela.requisitos.length;
    pontuacao = pontuacaoDoProjeto({ ...d, resposta });
  }
  const estudavaAntes = await estudouHoje(usuarioId);

  await salvar(d.id, {
    resposta,
    avaliacao,
    nota: melhorNota,
    pontos: Math.max(d.pontos || 0, pontosDoDesafio),
    tentativas,
    status: acabou ? "concluido" : "em_andamento",
  });

  const pontos = await registrarOuMelhorar({
    usuarioId, trilhaId: d.trilha_id, tipo: d.tipo, chave: `pratica:${d.id}`, pontos: pontosDoDesafio,
    detalhe: { titulo: d.titulo, nota: melhorNota },
  });
  // o projeto da semana do plano aprovado abre a semana seguinte; o final, aprovado, fecha a trilha
  let semana = null;
  if (d.tipo === "projeto_semanal" || d.tipo === "projeto_final") {
    const { avanco } = await avancoDaTrilhaDoUsuario(d.trilha_id, usuarioId);
    const u = avanco.unidades.find((x) => x.projeto?.id === d.id);
    if (u) {
      const proxima = avanco.unidades.find((x) => x.numero === u.numero + 1);
      semana = {
        numero: u.numero, final: u.final, aprovado: u.aprovado, podeOutro: u.podeOutroProjeto,
        liberou: u.passou && proxima ? proxima.numero : null, trilhaConcluida: avanco.concluida,
      };
    }
  }
  const extra = await depoisDePontuar({ usuarioId, trilhaId: d.trilha_id, estudavaAntes, ganhou: pontos, verTrilha: Boolean(semana?.trilhaConcluida) });

  return {
    avaliacao,
    nota: melhorNota,
    tentativas,
    restantes: Math.max(0, TENTATIVAS[d.tipo] - tentativas),
    concluido: acabou,
    reenviar: podeReenviar({ tipo: d.tipo, tentativas, status: acabou ? "concluido" : "em_andamento", completo: pontuacao?.completo }),
    ...(pontuacao ? { pontuacao, completo: pontuacao.completo } : {}),
    semana,
    ...resultadoDaPontuacao(pontos, extra),
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

/**
 * Troca a complexidade do projeto (antes da primeira entrega). "Padrão" volta para a versão
 * original sem chamar a IA; as outras são reescritas a partir dela. As dicas da Lisa, que falavam
 * dos requisitos antigos, são descartadas.
 */
export async function mudarComplexidade({ usuarioId, id, nivel }) {
  const d = await desafioDoUsuario(id, usuarioId);
  const pode = podeTrocarComplexidade(d, nivel);
  if (!pode.ok) throw new ErroDeAcesso(409, pode.motivo);
  const trilha = await trilhaDoUsuario(d.trilha_id, usuarioId);

  const { guia, original, trocas = 0, complexidade, ...atual } = d.conteudo || {};
  // a semana do plano, o prazo e o valor do projeto final não mudam com a complexidade
  const meta = Object.fromEntries(["semana", "ate", "valor", "semanas"].filter((k) => atual[k] != null).map((k) => [k, atual[k]]));
  const padrao = original || atual;
  let novo = padrao;
  if (nivel !== "padrao") {
    if (!temModelo()) throw new ErroDeAcesso(503, "a IA não está configurada neste servidor");
    try {
      novo = await ajustarComplexidadeDoProjeto({ tema: trilha.tema, tipo: d.tipo, projeto: padrao, nivel });
    } catch (e) {
      throw new ErroDeAcesso(502, e.message);
    }
  }
  const conteudo = { ...novo, ...meta, complexidade: nivel, trocas: trocas + 1, original: padrao };
  const titulo = String(novo.titulo || d.titulo).slice(0, 200);
  await salvar(d.id, { conteudo, titulo });
  return desafioParaTela({ ...d, conteudo, titulo }, trilha.tema);
}

/**
 * As "Dicas da Lisa" de um projeto (semana ou mês). Geradas uma vez e guardadas no próprio desafio
 * (`conteudo.guia`): abrir de novo, ou clicar duas vezes, não gasta outra chamada da IA.
 */
export async function guiaDoProjeto({ usuarioId, id }) {
  const d = await desafioDoUsuario(id, usuarioId);
  if (!eProjeto(d.tipo)) throw new ErroDeAcesso(400, "as dicas da Lisa são para os projetos");
  if (d.conteudo?.guia) return d.conteudo.guia;
  if (!temModelo()) throw new ErroDeAcesso(503, "a IA não está configurada neste servidor");

  const trilha = await trilhaDoUsuario(d.trilha_id, usuarioId);
  let guia;
  try {
    guia = await gerarGuiaDoProjeto({ tema: trilha.tema, tipo: d.tipo, projeto: d.conteudo });
  } catch (e) {
    throw new ErroDeAcesso(502, e.message);
  }
  await salvar(d.id, { conteudo: { ...d.conteudo, guia } });
  return guia;
}

export async function enviarProjeto({ usuarioId, id, repo }) {
  const d = await desafioDoUsuario(id, usuarioId);
  if (!eProjeto(d.tipo)) throw new ErroDeAcesso(400, "este desafio não é um projeto");
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
