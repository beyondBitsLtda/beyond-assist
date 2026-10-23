// O AVANÇO NA TRILHA (23/10/2026): a teoria, a prática e os projetos amarrados.
//
// Pedido: "as tarefas semanais têm que ser critério para passar de trilha — hoje as trilhas e a
// prática estão muito desvinculadas uma da outra, a mesma coisa do projeto semanal; e se a pessoa
// tem um plano de estudo que vai durar 5 dias, isso tem que ser adaptado". As regras escolhidas:
//
//   1. ASSUNTO concluído = a teoria (a checklist do card no Abacato) E um quiz dele aprovado (60%+).
//      A ordem não importa: dá para fazer o quiz antes de terminar a checklist.
//   2. A trilha anda em SEMANAS DO PLANO: blocos de uma semana de estudo (a soma dos dias de cada
//      assunto cabe nos dias de estudo da semana), na ordem da trilha — não a semana do calendário.
//      Cada semana termina num PROJETO, e a semana seguinte só abre com ele aprovado (nota 60+).
//   3. O projeto da última semana é o PROJETO FINAL, do tamanho da trilha inteira. Um plano de uma
//      semana (5 dias, por exemplo) tem só ele. O projeto do mês deixou de existir.
//
// Para ninguém ficar preso: projeto reprovado (as tentativas acabaram) dá lugar a um novo, até
// PROJETOS_POR_SEMANA; reprovado em todos, a semana libera assim mesmo.
//
// O que já estava concluído antes destas regras continua concluído: o assunto concluído até
// 23/10/2026 fica dispensado do quiz (`dispensa`, gravado pela db/017), a semana inteira concluída
// antes não pede projeto, e um projeto da semana antigo (da semana do calendário) vale para a semana
// do plano que tem os mesmos assuntos. Puro, como o resto de src/dominio.

import { somarDias, diasEntre, formatarDia } from "./datas.js";
import { NOTA_DE_APROVACAO } from "./pratica.js";

export const PROJETOS_POR_SEMANA = 3;

/** Aprovado: a melhor nota (quiz ou projeto) chegou à nota de aprovação. */
export const aprovado = (d) => (Number(d?.nota) || 0) >= NOTA_DE_APROVACAO && (d?.tipo !== "quiz" || d?.status === "concluido");

/** Quantos dias de estudo cabem numa semana do plano: os dias da semana escolhidos para estudar. */
export const diasPorSemana = (diasDeEstudo) => Math.max(1, Math.min(7, (Array.isArray(diasDeEstudo) ? diasDeEstudo.length : 0) || 5));

/** A chave (período) do projeto da semana N do plano, e a do projeto final: datas fixas a partir do início da trilha. */
export const periodoDaSemana = (base, numero) => somarDias(base, 7 * (numero - 1));
export const periodoDoFinal = (base) => base;

/** O projeto final vale mais quanto maior a trilha: 250 pontos numa semana, até 600. */
export const valorDoProjetoFinal = (semanas) => Math.min(600, 150 + 100 * Math.max(1, semanas || 1));

/** Os assuntos (cards) com algum quiz aprovado. */
export function assuntosComQuizAprovado(quizzes) {
  const ok = new Set();
  for (const q of quizzes || []) if (aprovado({ ...q, tipo: "quiz" })) for (const id of q.card_ids || q.cardIds || []) ok.add(String(id));
  return ok;
}

/**
 * As semanas do plano: os assuntos agendados, na ordem da trilha, em blocos que cabem numa semana de
 * estudo (pela soma dos dias de cada um). Assunto maior que a semana fica sozinho na dele.
 */
export function semanasDoPlano(etapas, diasDeEstudo) {
  const cabe = diasPorSemana(diasDeEstudo);
  const semanas = [];
  let atual = null;
  let soma = 0;
  for (const e of [...etapas].filter((x) => x.inicio).sort((a, b) => a.ordem - b.ordem)) {
    const d = Math.max(1, Number(e.dias) || 1);
    if (!atual || (soma + d > cabe && atual.length)) {
      atual = [];
      semanas.push(atual);
      soma = 0;
    }
    atual.push(e);
    soma += d;
  }
  return semanas;
}

/** Os projetos de uma semana: os da chave dela; sem nenhum, o projeto antigo (da semana do calendário)
 *  que mais cobre os assuntos dela. */
function projetosDaSemana(lista, cardIds, periodo, usados) {
  const daChave = lista.filter((p) => p.periodo === periodo);
  if (daChave.length) return daChave;
  let melhor = null;
  let comum = 0;
  for (const p of lista) {
    if (usados.has(p.id)) continue;
    const n = (p.card_ids || []).filter((id) => cardIds.has(String(id))).length;
    if (n > comum) { melhor = p; comum = n; }
  }
  return melhor ? [melhor] : [];
}

/** A situação dos projetos de uma semana: o que vale (o aprovado, ou o mais recente), se passou e se dá para gerar outro. */
function situacaoDosProjetos(lista) {
  const ordenados = [...lista].sort((a, b) => (a.rodada || 1) - (b.rodada || 1) || String(a.criado_em || "").localeCompare(String(b.criado_em || "")));
  const aprovadoAlgum = ordenados.find((p) => aprovado(p)) || null;
  const ultimo = ordenados.at(-1) || null;
  const reprovados = ordenados.filter((p) => p.status === "concluido" && !aprovado(p)).length;
  return {
    projeto: aprovadoAlgum || ultimo,
    aprovado: Boolean(aprovadoAlgum),
    rodadas: ordenados.length,
    esgotou: !aprovadoAlgum && reprovados >= PROJETOS_POR_SEMANA,
    podeOutro: !aprovadoAlgum && ultimo?.status === "concluido" && ordenados.length < PROJETOS_POR_SEMANA,
  };
}

/**
 * O avanço da trilha inteira.
 *
 * @param etapas    `{ cardId, ordem, dias, inicio, fim, teoria (o card concluído no Abacato), dispensa, ... }`
 * @param quizzes   os quizzes da trilha: `{ card_ids, status, nota }`
 * @param projetos  os projetos da trilha: `{ id, tipo, periodo, rodada, status, nota, card_ids, titulo }`
 * @param base      o início da trilha (as chaves dos projetos saem dele)
 */
export function avancoDaTrilha({ etapas, diasDeEstudo, base, hoje, quizzes = [], projetos = [] }) {
  const comQuiz = assuntosComQuizAprovado(quizzes);
  const todas = etapas.map((e) => {
    const teoria = Boolean(e.teoria ?? e.concluido);
    const quiz = comQuiz.has(String(e.cardId));
    // sem data = concluído antes de a trilha existir; `dispensa` = concluído antes das regras novas
    const dispensa = Boolean(e.dispensa) || !e.inicio;
    const concluido = teoria && (quiz || dispensa);
    return { ...e, teoria, quiz, dispensa, concluido, faltaQuiz: teoria && !concluido, bloqueada: false, unidade: null, motivo: "" };
  }).sort((a, b) => a.ordem - b.ordem);

  const blocos = semanasDoPlano(todas, diasDeEstudo);
  const semanais = projetos.filter((p) => p.tipo === "projeto_semanal");
  const finais = projetos.filter((p) => p.tipo === "projeto_final" && p.periodo === periodoDoFinal(base));
  const usados = new Set();
  const unidades = [];
  let aberta = true; // a semana 1 sempre abre
  blocos.forEach((lista, i) => {
    const numero = i + 1;
    const final = numero === blocos.length;
    const tipo = final ? "projeto_final" : "projeto_semanal";
    const periodo = final ? periodoDoFinal(base) : periodoDaSemana(base, numero);
    const ids = new Set(lista.map((e) => String(e.cardId)));
    const doProjeto = final ? finais : projetosDaSemana(semanais, ids, periodo, usados);
    for (const p of doProjeto) usados.add(p.id);
    const s = situacaoDosProjetos(doProjeto);
    const feitos = lista.filter((e) => e.concluido).length;
    const tudoFeito = feitos === lista.length;
    const dispensada = lista.every((e) => e.concluido && e.dispensa);
    const passou = s.aprovado || dispensada || s.esgotou;
    const de = lista.reduce((m, e) => (e.inicio < m ? e.inicio : m), lista[0].inicio);
    const ate = lista.reduce((m, e) => ((e.fim || e.inicio) > m ? (e.fim || e.inicio) : m), lista[0].fim || lista[0].inicio);
    for (const e of lista) {
      e.unidade = numero;
      e.bloqueada = !aberta;
      e.motivo = aberta ? "" : `abre quando o projeto da semana ${numero - 1} for aprovado`;
    }
    unidades.push({
      numero, final, tipo, periodo, de, ate, etapas: lista, cardIds: [...ids], feitos, total: lista.length, tudoFeito,
      aberta, dispensada, passou, aprovado: s.aprovado, esgotou: s.esgotou,
      projeto: s.projeto, rodadas: s.rodadas, podeOutroProjeto: aberta && s.podeOutro,
      // o projeto libera quando a semana está aberta e começou (ou já teve todos os assuntos concluídos)
      projetoLiberado: aberta && !dispensada && (de <= hoje || tudoFeito),
    });
    aberta = aberta && passou;
  });

  // o assunto de agora: o primeiro pendente das semanas abertas (o que já começou, antes)
  const pendentes = unidades.filter((u) => u.aberta).flatMap((u) => u.etapas).filter((e) => !e.concluido);
  const assuntoAtual = pendentes.find((e) => e.inicio <= hoje) || pendentes[0] || null;
  // a semana que falta fechar: a primeira aberta sem o projeto
  const daVez = unidades.find((u) => u.aberta && !u.passou) || null;
  // a prática do dia fica nos assuntos da semana aberta: sem assunto pendente, revisa um dela por dia
  let assuntoDaPratica = assuntoAtual;
  if (!assuntoDaPratica && daVez) assuntoDaPratica = daVez.etapas[Math.abs(diasEntre("2026-01-01", hoje)) % daVez.etapas.length];
  if (!assuntoDaPratica) assuntoDaPratica = todas.at(-1) || null;

  const ultima = unidades.at(-1);
  const concluida = todas.length > 0 && todas.every((e) => e.concluido) && (!ultima || ultima.passou);
  return {
    etapas: todas,
    antes: todas.filter((e) => !e.inicio),
    unidades,
    assuntoAtual,
    assuntoDaPratica,
    semanaDaVez: daVez,
    concluida,
    progresso: { feitos: todas.filter((e) => e.concluido).length, total: todas.length },
  };
}

/** A semana do plano a que um projeto pede (tipo e período), ou null. */
export function semanaDoProjeto(avanco, tipo, periodo) {
  return avanco.unidades.find((u) => u.tipo === tipo && u.periodo === periodo) || null;
}

/** Dá para gerar (ou abrir) o projeto desta semana agora? */
export function podeGerarProjeto(unidade, hoje) {
  if (!unidade) return { ok: false, motivo: "esta semana não existe na trilha" };
  if (unidade.dispensada) return { ok: false, motivo: "esta semana foi concluída antes das regras novas — não precisa de projeto" };
  if (!unidade.aberta) return { ok: false, motivo: `esta semana ${unidade.etapas[0]?.motivo || "ainda está trancada"}` };
  if (!unidade.projetoLiberado) return { ok: false, motivo: `o projeto libera em ${formatarDia(unidade.de)}, quando a semana começa (ou antes, concluindo todos os assuntos dela)` };
  return { ok: true, hoje };
}

// ---------------------------------------------------------------- o mapa da trilha

function estadoDoAssunto(e, atualId, hoje) {
  if (e.concluido) return "feito";
  if (e.bloqueada) return "bloqueado";
  if (e.faltaQuiz) return "quiz";
  if (e.cardId === atualId) return e.fim && e.fim < hoje ? "atrasado" : "atual";
  if (e.fim && e.fim < hoje) return "atrasado";
  if (e.inicio && e.inicio <= hoje) return "disponivel";
  return "futuro";
}

function estadoDoProjeto(u) {
  if (u.dispensada) return "dispensado";
  if (!u.aberta) return "bloqueado";
  if (u.aprovado) return "feito";
  if (u.esgotou) return "liberado";
  if (!u.projetoLiberado) return "futuro";
  if (!u.projeto) return "disponivel";
  if (u.projeto.status === "concluido") return "entregue";
  return "em_andamento";
}

/**
 * Os nós do mapa, de cima para baixo: "Já concluídos" (o que veio antes da trilha), cada semana do
 * plano com os assuntos e, no fim dela, o baú do projeto (a última, o troféu do projeto final) e a
 * bandeira de chegada.
 */
export function mapaDaTrilha(avanco, hoje) {
  const atualId = avanco.assuntoAtual?.cardId ?? null;
  const nos = [];
  if (avanco.antes.length) {
    nos.push({ tipo: "unidade", chave: "antes", titulo: "Já concluídos", de: null, ate: null });
    for (const e of avanco.antes) nos.push({ tipo: "assunto", chave: e.cardId, etapa: e, estado: "feito" });
  }
  const total = avanco.unidades.length;
  for (const u of avanco.unidades) {
    nos.push({
      tipo: "unidade", chave: `semana-${u.numero}`, numero: u.numero, de: u.de, ate: u.ate, bloqueada: !u.aberta,
      titulo: total === 1 ? "A trilha" : u.final ? `Semana ${u.numero} · reta final` : `Semana ${u.numero}`,
    });
    for (const e of u.etapas) nos.push({ tipo: "assunto", chave: e.cardId, etapa: e, estado: estadoDoAssunto(e, atualId, hoje) });
    nos.push({ tipo: u.tipo, chave: `${u.tipo}-${u.periodo}`, periodo: u.periodo, unidade: u, desafio: u.projeto, estado: estadoDoProjeto(u) });
  }
  nos.push({ tipo: "chegada", chave: "chegada", estado: avanco.concluida ? "feito" : "bloqueado" });
  return nos;
}
