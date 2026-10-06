// Um curso criado pela Lisa: a proposta (o que a IA sugeriu) e como ela vira quadro e trilha.
//
// Mesmo princípio do gerador de quadros do Abacato (abacato/src/dominio/quadroGen.js): o modelo
// devolve uma ESTRUTURA, a pessoa vê antes, e o servidor confere de novo na hora de criar — o que
// chega na rota de criação vem do navegador, e ali pode ter virado qualquer JSON.
//
// Puro: sem banco, sem rede.

import { NIVEIS, MAXIMO_DE_DIAS_POR_ETAPA } from "./plano.js";

export const NIVEIS_DO_CURSO = {
  iniciante: "Iniciante — do zero, sem experiência no tema",
  intermediario: "Intermediário — já sabe o básico e quer aprofundar",
  avancado: "Avançado — já trabalha com o tema e quer dominar",
};
export const DURACOES_EM_SEMANAS = [2, 4, 8, 12];

/** Os mesmos tetos do gerador do Abacato: acima disso o quadro vira uma parede, não um plano. */
export const LIMITES_DO_CURSO = { modulos: 10, assuntos: 40, tarefas: 6, minimoDeAssuntos: 3 };

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));

function texto(valor, limite) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, limite);
}

/**
 * Quantos assuntos cabem no curso: os dias de estudo do período divididos pela média de ~1,6
 * dia por assunto (a IA distribui de 1 a 5 dias por assunto conforme o peso).
 */
export function assuntosParaODuracao(semanas, diasPorSemana) {
  const dias = limitar(Number(semanas) || 4, 1, 52) * limitar(Number(diasPorSemana) || 5, 1, 7);
  return limitar(Math.round(dias / 1.6), 4, LIMITES_DO_CURSO.assuntos);
}

/** O nome do quadro sempre começa com STUDY — é o que faz ele virar trilha. */
export function nomeDoQuadro(nomeBruto, tema) {
  const base = texto(nomeBruto, 80).replace(/^\s*study[\s:\-–—_|·.]*/i, "") || texto(tema, 70);
  return `STUDY ${base}`.slice(0, 80);
}

/**
 * Confere a proposta. Devolve `{ ok, erros, proposta }` e nunca lança: proposta torta é caso
 * comum (o modelo erra), e precisa virar mensagem, não exceção.
 *
 * Corrige o que dá (dias fora da faixa, nível inexistente, módulo vazio, excesso de assuntos) e
 * recusa só o que não dá (sem tema, quase nenhum assunto).
 */
export function validarCurso(bruto) {
  const erros = [];
  if (!bruto || typeof bruto !== "object") return { ok: false, erros: ["a proposta veio vazia"], proposta: null };

  const tema = texto(bruto.tema, 80);
  if (!tema) erros.push("o curso precisa de um tema");

  let total = 0;
  const modulos = [];
  for (const m of (Array.isArray(bruto.modulos) ? bruto.modulos : []).slice(0, LIMITES_DO_CURSO.modulos)) {
    const assuntos = [];
    for (const a of Array.isArray(m?.assuntos) ? m.assuntos : []) {
      if (total >= LIMITES_DO_CURSO.assuntos) break;
      const titulo = texto(a?.titulo, 200);
      if (!titulo) continue;
      const dias = Number.parseInt(a?.dias, 10);
      assuntos.push({
        titulo,
        descricao: texto(a?.descricao, 1500),
        objetivo: texto(a?.objetivo, 240),
        nivel: NIVEIS.includes(a?.nivel) ? a.nivel : "basico",
        dias: Number.isFinite(dias) ? limitar(dias, 1, MAXIMO_DE_DIAS_POR_ETAPA) : 1,
        tarefas: (Array.isArray(a?.tarefas) ? a.tarefas : [])
          .map((t) => texto(t, 200)).filter(Boolean).slice(0, LIMITES_DO_CURSO.tarefas),
      });
      total++;
    }
    if (assuntos.length) modulos.push({ nome: texto(m?.nome, 80) || `Módulo ${modulos.length + 1}`, assuntos });
  }

  if (total < LIMITES_DO_CURSO.minimoDeAssuntos) erros.push("a proposta tem assuntos de menos — gere outra");

  // Módulo com nome repetido viraria duas colunas iguais no quadro, sem como distinguir.
  const vistos = new Map();
  for (const m of modulos) {
    const chave = m.nome.toLowerCase();
    const n = (vistos.get(chave) || 0) + 1;
    vistos.set(chave, n);
    if (n > 1) m.nome = `${m.nome} (${n})`.slice(0, 80);
  }

  return {
    ok: erros.length === 0,
    erros,
    proposta: {
      tema,
      nome: nomeDoQuadro(bruto.nome, tema),
      descricao: texto(bruto.descricao, 1500),
      resumo: texto(bruto.resumo, 1200),
      nivel: NIVEIS_DO_CURSO[bruto.nivel] ? bruto.nivel : "iniciante",
      modulos,
    },
  };
}

/** Todos os assuntos, na ordem de estudo (módulo a módulo, de cima para baixo). */
export function assuntosEmOrdem(proposta) {
  return proposta.modulos.flatMap((m, i) => m.assuntos.map((a) => ({ ...a, modulo: m.nome, indiceDoModulo: i })));
}

export function resumoDoCurso(proposta) {
  const assuntos = assuntosEmOrdem(proposta);
  return {
    modulos: proposta.modulos.length,
    assuntos: assuntos.length,
    tarefas: assuntos.reduce((s, a) => s + a.tarefas.length, 0),
    dias: assuntos.reduce((s, a) => s + a.dias, 0),
  };
}
