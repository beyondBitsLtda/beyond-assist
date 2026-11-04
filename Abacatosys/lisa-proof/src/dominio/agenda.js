// A agenda: todos os compromissos de todas as trilhas num calendário só.
//
// Não há tabela de agenda. Tudo sai do que já existe — as etapas (quando estudar cada assunto),
// os desafios (quiz, exercício, projetos) e os dias com estudo. Uma agenda guardada à parte
// ficaria velha no primeiro replanejamento.
//
// Puro: sem banco, sem rede.

import { somarDias, inicioDaSemana, fimDaSemana, inicioDoMes, fimDoMes } from "./datas.js";
import { NOTA_DE_APROVACAO, NOMES_DOS_DESAFIOS } from "./pratica.js";

/** Uma cor por trilha, na ordem em que as trilhas aparecem. As mesmas cores das etiquetas do
 *  Abacato, para o mesmo tema não mudar de cor entre os dois sistemas sem motivo. */
export const CORES_DAS_TRILHAS = ["#22C55E", "#2362D3", "#A855F7", "#F97316", "#EC4899", "#EAB308", "#10B981", "#6366F1"];
export const corDaTrilha = (indice) => CORES_DAS_TRILHAS[indice % CORES_DAS_TRILHAS.length];

export const ROTULOS_DA_AGENDA = {
  assunto: "Assunto",
  quiz: NOMES_DOS_DESAFIOS.quiz,
  exercicio: NOMES_DOS_DESAFIOS.exercicio,
  projeto_semanal: "Entrega do projeto da semana",
  projeto_final: "Entrega do projeto final",
  projeto_mensal: "Entrega do projeto do mês",
};

export const ROTULOS_DA_SITUACAO = {
  feito: "Feito",
  entregue: "Entregue (abaixo da nota)",
  agora: "Para agora",
  futuro: "Agendado",
  atrasado: "Atrasado",
  perdido: "Não feito",
};

/** A entrega do projeto de uma semana do plano (src/dominio/avanco.js): feita, entregue abaixo da nota,
 *  ainda trancada (futuro), atrasada ou para agora. */
function situacaoDaEntrega(u, hoje) {
  if (u.aprovado || u.esgotou) return "feito";
  if (u.projeto?.status === "concluido") return (u.projeto.nota ?? 0) >= NOTA_DE_APROVACAO ? "feito" : "entregue";
  if (!u.aberta || !u.projetoLiberado) return "futuro";
  if (u.ate < hoje) return "atrasado";
  return "agora";
}

/**
 * Os compromissos que encostam em [de, ate] — mais os atrasados de antes, que continuam sendo
 * compromisso até serem feitos.
 *
 * Cada item diz como aparece no calendário:
 *   `exibir: "intervalo"`  em todos os dias de `inicio` a `fim` (um assunto de 3 dias);
 *   `exibir: "prazo"`      só no dia da entrega (`fim`) — o projeto é da semana toda, mas o que a
 *                          pessoa precisa ver na agenda é o dia em que ele vence.
 *
 * @param trilhas   `{ id, tema }`, na ordem das cores
 * @param etapas    `Map<trilhaId, { cardId, titulo, inicio, fim, concluido }[]>`
 * @param semanas   `Map<trilhaId, semanas do plano>` (src/dominio/avanco.js): cada uma com o projeto dela
 * @param desafios  `{ id, trilhaId, tipo, periodo, status, nota, titulo }` (quiz e exercício)
 */
export function montarAgenda({ trilhas, etapas, semanas = new Map(), desafios, hoje, de, ate }) {
  const itens = [];
  const achar = (trilhaId, tipo, periodo) =>
    desafios.find((d) => d.trilhaId === trilhaId && d.tipo === tipo && d.periodo === periodo) || null;

  trilhas.forEach((t, i) => {
    const base = { trilhaId: t.id, tema: t.tema, cor: corDaTrilha(i) };
    const lista = (etapas.get(t.id) || []).filter((e) => e.inicio);

    // ---- assuntos
    let temPendente = false;
    for (const e of lista) {
      const situacao = e.concluido ? "feito" : e.fim < hoje ? "atrasado" : e.inicio <= hoje ? "agora" : "futuro";
      if (!e.concluido) temPendente = true;
      const noPeriodo = e.inicio <= ate && e.fim >= de;
      if (!noPeriodo && situacao !== "atrasado") continue;
      itens.push({
        ...base, chave: `a-${e.cardId}`, tipo: "assunto", titulo: e.titulo,
        inicio: e.inicio, fim: e.fim, exibir: "intervalo", situacao, href: `/trilhas/${t.id}`,
      });
    }
    if (!lista.length) return;

    // ---- projetos: uma entrega por semana do plano (a da última é o projeto final), no fim dela
    for (const u of semanas.get(t.id) || []) {
      if (u.dispensada) continue;
      const situacao = situacaoDaEntrega(u, hoje);
      if ((u.ate < de || u.ate > ate) && situacao !== "atrasado") continue;
      const d = u.projeto;
      itens.push({
        ...base, chave: `${u.tipo}-${t.id}-${u.periodo}`, tipo: u.tipo,
        titulo: d?.titulo || (u.final ? ROTULOS_DA_AGENDA.projeto_final : `${ROTULOS_DA_AGENDA.projeto_semanal} ${u.numero}`),
        inicio: u.de, fim: u.ate, exibir: "prazo", situacao, href: d ? `/pratica/${d.id}` : `/trilhas/${t.id}`,
      });
    }

    // ---- prática do dia: o que já existiu no período, e o de hoje (mesmo se ainda não gerado)
    for (const tipo of ["quiz", "exercicio"]) {
      // até 3 rodadas no mesmo dia viram UM item: o concluído, se houver, senão o mais recente
      const porDia = new Map();
      for (const x of desafios.filter((x) => x.trilhaId === t.id && x.tipo === tipo && x.periodo >= de && x.periodo <= ate)) {
        const atual = porDia.get(x.periodo);
        const melhor = !atual
          || (x.status === "concluido" && atual.status !== "concluido")
          || (x.status === atual.status && (x.rodada || 1) > (atual.rodada || 1));
        if (melhor) porDia.set(x.periodo, x);
      }
      for (const d of porDia.values()) {
        itens.push({
          ...base, chave: `${tipo}-${d.id}`, tipo, titulo: ROTULOS_DA_AGENDA[tipo], inicio: d.periodo, fim: d.periodo,
          exibir: "prazo", situacao: d.status === "concluido" ? "feito" : d.periodo < hoje ? "perdido" : "agora",
          href: `/pratica/${d.id}`,
        });
      }
      if (temPendente && hoje >= de && hoje <= ate && !achar(t.id, tipo, hoje)) {
        itens.push({
          ...base, chave: `${tipo}-${t.id}-hoje`, tipo, titulo: ROTULOS_DA_AGENDA[tipo], inicio: hoje, fim: hoje,
          exibir: "prazo", situacao: "agora", href: "/pratica",
        });
      }
    }
  });

  return itens;
}

const PESO = { atrasado: 0, agora: 1, perdido: 2, futuro: 3, entregue: 4, feito: 5 };
const PESO_DO_TIPO = { projeto_final: 0, projeto_mensal: 0, projeto_semanal: 1, assunto: 2, quiz: 3, exercicio: 4 };

/** Os itens que aparecem num dia do calendário, mais urgentes primeiro. */
export function itensDoDia(itens, dia) {
  return itens
    .filter((x) => (x.exibir === "prazo" ? x.fim === dia : x.inicio <= dia && x.fim >= dia))
    .sort((a, b) => PESO[a.situacao] - PESO[b.situacao] || PESO_DO_TIPO[a.tipo] - PESO_DO_TIPO[b.tipo]);
}

/** As semanas (de segunda a domingo) que a grade do mês mostra: do começo da semana do dia 1
 *  ao fim da semana do último dia. */
export function gradeDoMes(diaQualquer) {
  const de = inicioDaSemana(inicioDoMes(diaQualquer));
  const ate = fimDaSemana(fimDoMes(diaQualquer));
  const dias = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d);
  return { de, ate, dias };
}

export function mesVizinho(diaQualquer, passo) {
  return passo > 0 ? inicioDoMes(somarDias(fimDoMes(diaQualquer), 1)) : inicioDoMes(somarDias(inicioDoMes(diaQualquer), -1));
}

export const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "Outubro de 2026" — maiúscula só na primeira letra (o `capitalize` do CSS faria "De"). */
export function nomeDoMes(dia) {
  const mes = NOMES_DOS_MESES[Number(dia.slice(5, 7)) - 1];
  return `${mes[0].toUpperCase()}${mes.slice(1)} de ${dia.slice(0, 4)}`;
}

/** O texto da etiqueta no calendário: curto, porque a célula é estreita. */
export function textoDaEtiqueta(item) {
  return { assunto: item.titulo, projeto_semanal: "Entrega", projeto_final: "Projeto final", projeto_mensal: "Entrega do mês", quiz: "Quiz", exercicio: "Exercício" }[item.tipo] || item.titulo;
}
