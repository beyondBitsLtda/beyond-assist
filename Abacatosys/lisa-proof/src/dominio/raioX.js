// O RAIO-X do estudante: tudo o que o Proof sabe de uma pessoa, num lugar só (pedido de 20/10/2026).
//
// Puro: recebe as linhas do banco (eventos de ponto, desafios, trilhas com as etapas) e devolve os
// números prontos para a tela. Cada número tem UMA fonte — os pontos vêm só de proof_eventos, as
// notas só de proof_desafios —, para o raio-x nunca discordar da tela de Progresso.

import { diaDe, somarDias, inicioDaSemana } from "./datas.js";
import { calcularOfensiva } from "./ofensiva.js";
import { nivelPorPontos, NOMES_DOS_EVENTOS } from "./pontos.js";
import { NOMES_DOS_DESAFIOS, NOTA_DE_APROVACAO, TENTATIVAS } from "./pratica.js";

export const SEMANAS_DO_RAIO_X = 12;
const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const ORIGENS = ["item", "card", "meta_diaria", "quiz", "exercicio", "projeto_semanal", "projeto_final", "projeto_mensal", "conquista"];

const media = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const umaCasa = (x) => (x == null ? null : Math.round(x * 10) / 10);
const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : null);

/** A hora do dia em São Paulo (0–23) de um instante gravado em UTC. */
export function horaEmSaoPaulo(instante) {
  const h = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date(instante));
  return Number.parseInt(h, 10) || 0;
}

/** Acertos de um quiz respondido: compara as escolhas com o gabarito guardado. */
export function acertosDoQuiz(desafio) {
  const perguntas = desafio?.conteudo?.perguntas || [];
  const escolhas = desafio?.resposta?.escolhas || {};
  let respondidas = 0;
  let acertos = 0;
  perguntas.forEach((p, i) => {
    const e = escolhas[i];
    if (e === undefined || e === null) return;
    respondidas++;
    if (Number(e) === Number(p.correta)) acertos++;
  });
  return { total: perguntas.length, respondidas, acertos };
}

/**
 * @param eventos   proof_eventos do usuário: { tipo, pontos, dia, detalhe, criado_em, trilha_id }
 * @param desafios  proof_desafios do usuário: { tipo, periodo, status, nota, pontos, tentativas, titulo, trilha_id, conteudo, resposta }
 * @param trilhas   proof_trilhas com `etapas`: [{ concluido }] e `tema`, `status`, `inicio_em`
 */
export function montarRaioX({ eventos = [], desafios = [], trilhas = [], metaDiaria = 30, hoje = diaDe() }) {
  const temaDa = new Map(trilhas.map((t) => [t.id, t.tema]));

  // ------------------------------------------------------------ resumo
  const total = eventos.reduce((s, e) => s + (e.pontos || 0), 0);
  const porDia = new Map();
  for (const e of eventos) porDia.set(e.dia, (porDia.get(e.dia) || 0) + (e.pontos || 0));
  const dias = [...porDia.keys()].sort();
  const desde = dias[0] || null;
  const diasDesdeOInicio = desde ? Math.round((Date.parse(hoje) - Date.parse(desde)) / 86_400_000) + 1 : 0;
  const metasBatidas = eventos.filter((e) => e.tipo === "meta_diaria").length;

  const resumo = {
    pontos: total,
    nivel: nivelPorPontos(total),
    ofensiva: calcularOfensiva(porDia.keys(), hoje),
    diasEstudados: porDia.size,
    desde,
    diasDesdeOInicio,
    // de cada 100 dias desde o primeiro estudo, em quantos houve estudo
    constancia: pct(porDia.size, diasDesdeOInicio),
    mediaPorDiaEstudado: porDia.size ? Math.round(total / porDia.size) : 0,
    metaDiaria,
    metasBatidas,
    taxaDeMeta: pct(metasBatidas, porDia.size),
    melhorDia: dias.reduce((m, d) => (!m || porDia.get(d) > m.pontos ? { dia: d, pontos: porDia.get(d) } : m), null),
  };

  // ------------------------------------------------------------ de onde vêm os pontos
  const porOrigem = ORIGENS.map((tipo) => {
    const doTipo = eventos.filter((e) => e.tipo === tipo);
    return { tipo, nome: NOMES_DOS_EVENTOS[tipo] || tipo, pontos: doTipo.reduce((s, e) => s + (e.pontos || 0), 0), vezes: doTipo.length };
  }).filter((o) => o.vezes > 0).sort((a, b) => b.pontos - a.pontos);

  // ------------------------------------------------------------ ritmo
  const segundaAtual = inicioDaSemana(hoje);
  const semanas = [];
  for (let i = SEMANAS_DO_RAIO_X - 1; i >= 0; i--) {
    const inicio = somarDias(segundaAtual, -7 * i);
    const fim = somarDias(inicio, 6);
    const daSemana = dias.filter((d) => d >= inicio && d <= fim);
    semanas.push({ inicio, pontos: daSemana.reduce((s, d) => s + porDia.get(d), 0), dias: daSemana.length, atual: i === 0 });
  }
  const diasDaSemana = DIAS_DA_SEMANA.map((nome, i) => {
    const doDia = dias.filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === i);
    return { nome, pontos: doDia.reduce((s, d) => s + porDia.get(d), 0), dias: doDia.length };
  });
  const porHora = Array.from({ length: 24 }, () => 0);
  for (const e of eventos) if (e.criado_em && e.tipo !== "meta_diaria" && e.tipo !== "conquista") porHora[horaEmSaoPaulo(e.criado_em)] += 1;
  const horaForte = porHora.some(Boolean) ? porHora.indexOf(Math.max(...porHora)) : null;

  // ------------------------------------------------------------ quiz
  const quizzes = desafios.filter((d) => d.tipo === "quiz").map((d) => ({ d, ...acertosDoQuiz(d) })).filter((q) => q.respondidas > 0);
  const perguntas = quizzes.reduce((s, q) => s + q.respondidas, 0);
  const acertos = quizzes.reduce((s, q) => s + q.acertos, 0);
  const quiz = {
    feitos: quizzes.length,
    perguntas,
    acertos,
    taxa: pct(acertos, perguntas),
    gabaritos: quizzes.filter((q) => q.respondidas === q.total && q.acertos === q.total).length,
  };

  // ------------------------------------------------------------ exercícios e projetos
  const entregues = (tipos) => desafios.filter((d) => tipos.includes(d.tipo) && (d.tentativas || 0) > 0);
  const linha = (d) => ({
    id: d.id,
    tipo: d.tipo,
    nome: NOMES_DOS_DESAFIOS[d.tipo],
    periodo: d.periodo,
    titulo: d.titulo || "",
    tema: temaDa.get(d.trilha_id) || "",
    nota: d.nota ?? null,
    tentativas: d.tentativas || 0,
    maxTentativas: TENTATIVAS[d.tipo] || null,
    aprovado: (d.nota ?? 0) >= NOTA_DE_APROVACAO,
    pontos: d.pontos || 0,
  });
  const resumoDe = (lista) => ({
    feitos: lista.length,
    aprovados: lista.filter((d) => (d.nota ?? 0) >= NOTA_DE_APROVACAO).length,
    notaMedia: umaCasa(media(lista.map((d) => d.nota ?? 0))),
    melhorNota: lista.length ? Math.max(...lista.map((d) => d.nota ?? 0)) : null,
    notasCem: lista.filter((d) => d.nota === 100).length,
    tentativasMedia: umaCasa(media(lista.map((d) => d.tentativas || 0))),
    lista: [...lista].sort((a, b) => String(b.periodo).localeCompare(String(a.periodo))).map(linha),
  });
  const exercicios = resumoDe(entregues(["exercicio"]));
  const projetos = resumoDe(entregues(["projeto_semanal", "projeto_final", "projeto_mensal"]));

  // ------------------------------------------------------------ por trilha
  const porTrilha = trilhas.map((t) => {
    const etapas = t.etapas || [];
    const dela = (lista) => lista.filter((d) => d.trilha_id === t.id);
    const qz = quizzes.filter((q) => q.d.trilha_id === t.id);
    const ex = dela(entregues(["exercicio"]));
    const pj = dela(entregues(["projeto_semanal", "projeto_final", "projeto_mensal"]));
    const pq = qz.reduce((s, q) => s + q.respondidas, 0);
    return {
      id: t.id,
      tema: t.tema,
      status: t.status,
      inicio: t.inicio_em,
      assuntos: etapas.length,
      concluidos: etapas.filter((e) => e.concluido).length,
      progresso: pct(etapas.filter((e) => e.concluido).length, etapas.length) ?? 0,
      pontos: eventos.filter((e) => e.trilha_id === t.id).reduce((s, e) => s + (e.pontos || 0), 0),
      quizzes: qz.length,
      acertoNoQuiz: pct(qz.reduce((s, q) => s + q.acertos, 0), pq),
      exercicios: ex.length,
      notaDosExercicios: umaCasa(media(ex.map((d) => d.nota ?? 0))),
      projetos: pj.length,
      notaDosProjetos: umaCasa(media(pj.map((d) => d.nota ?? 0))),
    };
  }).sort((a, b) => b.pontos - a.pontos);

  // ------------------------------------------------------------ todas as pontuações
  const historico = [...eventos]
    .sort((a, b) => String(b.criado_em || b.dia).localeCompare(String(a.criado_em || a.dia)))
    .map((e) => ({
      dia: e.dia,
      hora: e.criado_em ? horaEmSaoPaulo(e.criado_em) : null,
      tipo: e.tipo,
      nome: NOMES_DOS_EVENTOS[e.tipo] || e.tipo,
      texto: e.detalhe?.texto || e.detalhe?.titulo || e.detalhe?.nome || "",
      tema: temaDa.get(e.trilha_id) || "",
      pontos: e.pontos || 0,
    }));

  return { resumo, porOrigem, semanas, diasDaSemana, porHora, horaForte, quiz, exercicios, projetos, porTrilha, historico };
}
