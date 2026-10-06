// A parte prática: quiz e exercício do dia, projeto da semana e do mês.
//
// Puro, como o resto de src/dominio: períodos, pontuação, conferência do que a IA devolve e o
// desenho do mapa da trilha. Tudo testado por `npm run dominio-check`.

import { somarDias, inicioDaSemana, fimDaSemana, inicioDoMes, fimDoMes, diaValido, diaDaSemana } from "./datas.js";

export const TIPOS_DE_DESAFIO = ["quiz", "exercicio", "projeto_semanal", "projeto_mensal"];

export const NOMES_DOS_DESAFIOS = {
  quiz: "Quiz do dia",
  exercicio: "Exercício do dia",
  projeto_semanal: "Projeto da semana",
  projeto_mensal: "Projeto do mês",
};

/** Pontuação da prática. A parte prática vale mais que a teórica de propósito: dá mais trabalho. */
export const PONTOS_DA_PRATICA = {
  acertoNoQuiz: 5,
  quizPerfeito: 10,       // bônus por acertar todas
  exercicio: 40,          // nota 100 = 40 pontos
  projeto_semanal: 150,
  projeto_mensal: 400,
};

export const NOTA_DE_APROVACAO = 60;
export const TENTATIVAS = { exercicio: 3, projeto_semanal: 5, projeto_mensal: 5 };

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));

function texto(valor, limite) {
  const t = String(valor ?? "").trim();
  return t.length > limite ? `${t.slice(0, limite).trim()}…` : t;
}

function listaDeTextos(valor, limite, maximo) {
  return (Array.isArray(valor) ? valor : []).map((v) => texto(v, limite)).filter(Boolean).slice(0, maximo);
}

// ---------------------------------------------------------------- períodos

/** O período de um desafio que começa em `dia`: o próprio dia, a segunda da semana ou o dia 1. */
export function periodoDe(tipo, dia) {
  if (tipo === "projeto_semanal") return inicioDaSemana(dia);
  if (tipo === "projeto_mensal") return inicioDoMes(dia);
  return dia;
}

export function fimDoPeriodo(tipo, periodo) {
  if (tipo === "projeto_semanal") return fimDaSemana(periodo);
  if (tipo === "projeto_mensal") return fimDoMes(periodo);
  return periodo;
}

/** O período pedido existe e não está no futuro? Projeto de semana que ainda não chegou fica
 *  trancado — senão o mapa inteiro viraria uma lista de projetos para fazer de uma vez. */
export function periodoPermitido(tipo, periodo, hoje) {
  if (!TIPOS_DE_DESAFIO.includes(tipo) || !diaValido(periodo)) return false;
  if (tipo === "projeto_semanal" && diaDaSemana(periodo) !== 1) return false;
  if (tipo === "projeto_mensal" && !periodo.endsWith("-01")) return false;
  if (tipo === "quiz" || tipo === "exercicio") return periodo === hoje;
  return periodo <= periodoDe(tipo, hoje);
}

// ---------------------------------------------------------------- pontos

export function pontosDoQuiz(acertos, total) {
  return acertos * PONTOS_DA_PRATICA.acertoNoQuiz + (total > 0 && acertos === total ? PONTOS_DA_PRATICA.quizPerfeito : 0);
}

export function pontosDaNota(tipo, nota) {
  return Math.round((limitar(Number(nota) || 0, 0, 100) / 100) * (PONTOS_DA_PRATICA[tipo] || 0));
}

// ---------------------------------------------------------------- o que a IA devolve

/** Quiz de múltipla escolha: 3 a 6 perguntas, 4 opções, uma certa. Pergunta torta é descartada,
 *  e menos de 3 boas derruba o quiz inteiro (melhor pedir de novo que dar um quiz de uma pergunta). */
export function validarQuiz(bruto) {
  const perguntas = (Array.isArray(bruto?.perguntas) ? bruto.perguntas : [])
    .map((p) => {
      const opcoes = listaDeTextos(p?.opcoes, 300, 4);
      const correta = Number.parseInt(p?.correta, 10);
      if (opcoes.length !== 4 || !(correta >= 0 && correta <= 3) || new Set(opcoes).size !== 4) return null;
      const pergunta = texto(p?.pergunta, 1200);
      return pergunta ? { pergunta, opcoes, correta, explicacao: texto(p?.explicacao, 800) } : null;
    })
    .filter(Boolean)
    .slice(0, 6);
  if (perguntas.length < 3) throw new Error("a IA não montou perguntas suficientes — tente de novo");
  return { perguntas };
}

export function validarExercicio(bruto) {
  const enunciado = texto(bruto?.enunciado, 4000);
  if (!enunciado) throw new Error("a IA não devolveu o enunciado — tente de novo");
  return {
    titulo: texto(bruto?.titulo, 120) || "Exercício do dia",
    enunciado,
    linguagem: texto(bruto?.linguagem, 40) || "",
    exemplo: texto(bruto?.exemplo, 1500),
    dicas: listaDeTextos(bruto?.dicas, 240, 4),
    criterios: listaDeTextos(bruto?.criterios, 240, 6),
  };
}

export function validarProjeto(bruto) {
  const requisitos = listaDeTextos(bruto?.requisitos, 300, 10);
  if (requisitos.length < 2) throw new Error("a IA não devolveu requisitos suficientes — tente de novo");
  return {
    titulo: texto(bruto?.titulo, 120) || "Projeto",
    contexto: texto(bruto?.contexto, 2000),
    requisitos,
    extras: listaDeTextos(bruto?.extras, 300, 5),
    entrega: texto(bruto?.entrega, 600),
    criterios: listaDeTextos(bruto?.criterios, 240, 6),
  };
}

/**
 * A avaliação da IA, conferida. `aprovado` sai da NOTA, não do que o modelo disse: um "aprovado"
 * com nota 40 (ou o contrário) é contradição que a tela não teria como explicar.
 */
export function validarAvaliacao(bruto) {
  const nota = limitar(Math.round(Number(bruto?.nota) || 0), 0, 100);
  return {
    nota,
    aprovado: nota >= NOTA_DE_APROVACAO,
    comentario: texto(bruto?.comentario, 2000),
    pontosFortes: listaDeTextos(bruto?.pontosFortes, 300, 6),
    melhorias: listaDeTextos(bruto?.melhorias, 300, 6),
    requisitos: (Array.isArray(bruto?.requisitos) ? bruto.requisitos : []).slice(0, 12).map((r) => ({
      requisito: texto(r?.requisito, 300),
      atendido: Boolean(r?.atendido),
      observacao: texto(r?.observacao, 400),
    })).filter((r) => r.requisito),
  };
}

/**
 * O quiz como a tela pode ver: a resposta certa e a explicação só aparecem depois que a pergunta
 * foi respondida. Mandar o gabarito junto seria deixar a resposta no código-fonte da página.
 */
export function quizParaTela(conteudo, resposta) {
  const escolhas = resposta?.escolhas || {};
  return conteudo.perguntas.map((p, i) => {
    const escolha = escolhas[i];
    const respondida = escolha !== undefined && escolha !== null;
    return {
      pergunta: p.pergunta,
      opcoes: p.opcoes,
      respondida,
      escolha: respondida ? escolha : null,
      correta: respondida ? p.correta : null,
      explicacao: respondida ? p.explicacao : null,
    };
  });
}

// ---------------------------------------------------------------- assuntos de referência

/**
 * O assunto da prática de hoje: o primeiro pendente que já começou (atrasado antes); se nada
 * começou, o próximo; se a trilha acabou, o último — praticar o que já se estudou ainda vale.
 *
 * @param etapas  `{ cardId, ordem, inicio, fim, concluido }`
 */
export function assuntoAtual(etapas, hoje) {
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const pendentes = ordenadas.filter((e) => !e.concluido);
  return (
    pendentes.find((e) => e.inicio && e.inicio <= hoje) ||
    pendentes.find((e) => e.inicio) ||
    pendentes[0] ||
    ordenadas.at(-1) ||
    null
  );
}

/** Os assuntos planejados que encostam no período [de, ate]. */
export function assuntosDoPeriodo(etapas, de, ate) {
  return [...etapas]
    .filter((e) => e.inicio && e.inicio <= ate && e.fim >= de)
    .sort((a, b) => a.ordem - b.ordem);
}

// ---------------------------------------------------------------- o mapa da trilha

function estadoDoAssunto(e, atualId, hoje) {
  if (e.concluido) return "feito";
  if (e.cardId === atualId) return e.fim && e.fim < hoje ? "atrasado" : "atual";
  if (!e.inicio) return "bloqueado";
  if (e.fim < hoje) return "atrasado";
  if (e.inicio <= hoje) return "disponivel";
  return "bloqueado";
}

function estadoDoProjeto(desafio, tipo, periodo, hoje) {
  if (periodo > periodoDe(tipo, hoje)) return "bloqueado";
  if (!desafio) return "disponivel";
  if (desafio.status === "concluido") return desafio.nota >= NOTA_DE_APROVACAO ? "feito" : "entregue";
  return "em_andamento";
}

/**
 * Os nós do mapa, na ordem em que aparecem de cima para baixo.
 *
 * Cada semana da trilha vira uma "unidade": um cabeçalho, os assuntos dela e, no fim, o baú do
 * projeto da semana. Quando o mês vira, entra o troféu do projeto do mês. A bandeira de chegada
 * fecha o caminho. Assuntos já concluídos antes de a trilha existir abrem o mapa.
 *
 * @param etapas    `{ cardId, ordem, semana, inicio, fim, concluido, titulo }`
 * @param desafios  `{ tipo, periodo, status, nota, id }` (só projetos interessam aqui)
 * @param base      início da trilha (a semana 1 é a semana dele)
 */
export function mapaDaTrilha({ etapas, desafios = [], hoje, base }) {
  const atual = assuntoAtual(etapas, hoje);
  const atualId = atual && !atual.concluido ? atual.cardId : null;
  const projeto = new Map(desafios.map((d) => [`${d.tipo}@${d.periodo}`, d]));
  const nos = [];

  const antes = etapas.filter((e) => !e.inicio).sort((a, b) => a.ordem - b.ordem);
  if (antes.length) {
    nos.push({ tipo: "unidade", chave: "antes", titulo: "Já concluídos", de: null, ate: null });
    for (const e of antes) nos.push({ tipo: "assunto", chave: e.cardId, etapa: e, estado: estadoDoAssunto(e, atualId, hoje) });
  }

  const semanas = new Map();
  for (const e of etapas.filter((x) => x.inicio)) {
    if (!semanas.has(e.semana)) semanas.set(e.semana, []);
    semanas.get(e.semana).push(e);
  }
  const ordem = [...semanas.keys()].sort((a, b) => a - b);
  const semanaBase = inicioDaSemana(base);

  ordem.forEach((n, i) => {
    const de = somarDias(semanaBase, (n - 1) * 7);
    const ate = somarDias(de, 6);
    nos.push({ tipo: "unidade", chave: `semana-${n}`, titulo: `Semana ${n}`, numero: n, de, ate });
    for (const e of semanas.get(n).sort((a, b) => a.ordem - b.ordem)) {
      nos.push({ tipo: "assunto", chave: e.cardId, etapa: e, estado: estadoDoAssunto(e, atualId, hoje) });
    }
    const d = projeto.get(`projeto_semanal@${de}`);
    nos.push({ tipo: "projeto_semanal", chave: `ps-${de}`, periodo: de, desafio: d || null, estado: estadoDoProjeto(d, "projeto_semanal", de, hoje) });

    // O troféu do mês entra na última semana que termina naquele mês.
    const mes = inicioDoMes(ate);
    const proxima = ordem[i + 1];
    const mesDaProxima = proxima ? inicioDoMes(somarDias(semanaBase, (proxima - 1) * 7 + 6)) : null;
    if (mesDaProxima !== mes) {
      const m = projeto.get(`projeto_mensal@${mes}`);
      nos.push({ tipo: "projeto_mensal", chave: `pm-${mes}`, periodo: mes, desafio: m || null, estado: estadoDoProjeto(m, "projeto_mensal", mes, hoje) });
    }
  });

  const tudoFeito = etapas.length > 0 && etapas.every((e) => e.concluido);
  nos.push({ tipo: "chegada", chave: "chegada", estado: tudoFeito ? "feito" : "bloqueado" });
  return nos;
}
