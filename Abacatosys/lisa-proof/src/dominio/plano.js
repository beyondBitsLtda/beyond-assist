// A trilha: em que ordem estudar os cards de um quadro, e em que dias.
//
// As colunas do quadro NÃO decidem a ordem. Elas costumam ser de fluxo ("A fazer", "Estudando",
// "Feito") ou de agrupamento livre, e nenhuma das duas diz o que vem antes do quê. Quem decide é
// a IA, lendo o conteúdo — e, sem IA, a ordem visual do quadro, que é o melhor palpite que sobra.
//
// Puro: sem banco, sem rede. É o que deixa `npm run dominio-check` testar tudo sem subir nada.

import { somarDias, diaDaSemana, inicioDaSemana, diasEntre } from "./datas.js";

export const NIVEIS = ["basico", "intermediario", "avancado"];
export const NOMES_DOS_NIVEIS = { basico: "Básico", intermediario: "Intermediário", avancado: "Avançado" };
export const DIAS_PADRAO = [1, 2, 3, 4, 5];
export const MAXIMO_DE_DIAS_POR_ETAPA = 5;

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));

function texto(valor, limite) {
  const t = String(valor ?? "").trim();
  return t.length > limite ? `${t.slice(0, limite).trim()}…` : t;
}

/** Dias da semana válidos (0–6), sem repetição. Lista vazia vira segunda a sexta. */
export function normalizarDiasDeEstudo(lista) {
  const dias = [...new Set((Array.isArray(lista) ? lista : []).map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b);
  return dias.length ? dias : DIAS_PADRAO;
}

/** O próprio dia, se for de estudo; senão o próximo que for. */
export function proximoDiaDeEstudo(dia, diasDeEstudo) {
  for (let i = 0; i < 7; i++) {
    const d = somarDias(dia, i);
    if (diasDeEstudo.includes(diaDaSemana(d))) return d;
  }
  return dia;
}

/** Quantos dias de estudo um assunto pede, pelo tamanho da checklist: 1 dia a cada 4 itens. */
export function diasEstimados(card) {
  const itens = Number(card?.totalItens) || 0;
  return limitar(1 + Math.floor(itens / 4), 1, MAXIMO_DE_DIAS_POR_ETAPA);
}

/** A ordem visual do quadro: coluna da esquerda para a direita, card de cima para baixo. */
export function ordemPadrao(cards) {
  return [...cards].sort(
    (a, b) => (a.colunaPosicao ?? 0) - (b.colunaPosicao ?? 0) || (a.posicao ?? 0) - (b.posicao ?? 0)
  );
}

function nivelPelaPosicao(i, total) {
  const fracao = total <= 1 ? 0 : i / (total - 1);
  return fracao < 0.34 ? "basico" : fracao < 0.67 ? "intermediario" : "avancado";
}

/** Plano sem IA: a ordem do quadro, com o nível subindo ao longo da trilha. */
export function planoPadrao(cards) {
  const ordenados = ordemPadrao(cards);
  return {
    resumo: null,
    etapas: ordenados.map((c, i) => ({
      cardId: c.id,
      dias: diasEstimados(c),
      nivel: nivelPelaPosicao(i, ordenados.length),
      objetivo: null,
    })),
  };
}

/**
 * Confere o plano que a IA devolveu contra os cards que existem de verdade.
 *
 * A IA erra de três jeitos, e os três são tratados aqui em vez de derrubar a trilha:
 * inventa um id (descartado), repete um card (vale a primeira vez) e esquece cards (entram no
 * fim, na ordem do quadro). Uma trilha que perde assuntos em silêncio é pior que uma trilha
 * com a ordem um pouco pior.
 */
export function validarPlano(bruto, cards) {
  const porId = new Map(cards.map((c) => [String(c.id), c]));
  const vistos = new Set();
  const etapas = [];

  for (const e of Array.isArray(bruto?.etapas) ? bruto.etapas : []) {
    const id = String(e?.cardId ?? "");
    if (!porId.has(id) || vistos.has(id)) continue;
    vistos.add(id);
    const dias = Number.parseInt(e.dias, 10);
    etapas.push({
      cardId: id,
      dias: Number.isFinite(dias) ? limitar(dias, 1, MAXIMO_DE_DIAS_POR_ETAPA) : diasEstimados(porId.get(id)),
      nivel: NIVEIS.includes(e.nivel) ? e.nivel : "basico",
      objetivo: texto(e.objetivo, 240) || null,
    });
  }

  const esquecidos = ordemPadrao(cards.filter((c) => !vistos.has(String(c.id))));
  for (const c of esquecidos) {
    etapas.push({
      cardId: String(c.id),
      dias: diasEstimados(c),
      nivel: etapas.at(-1)?.nivel || "basico",
      objetivo: null,
    });
  }

  return { resumo: texto(bruto?.resumo, 1200) || null, etapas, esquecidos: esquecidos.length };
}

/**
 * O plano para replanejar sem IA: a ordem que a trilha já tinha, com os cards novos do quadro
 * no fim e os que sumiram do quadro de fora.
 */
export function planoDoReplanejamento(antigas, cards) {
  const porId = new Map(cards.map((c) => [String(c.id), c]));
  const vistos = new Set();
  const etapas = [];
  for (const e of [...antigas].sort((a, b) => a.ordem - b.ordem)) {
    const c = porId.get(String(e.cardId));
    if (!c || vistos.has(c.id)) continue;
    vistos.add(c.id);
    etapas.push({ cardId: c.id, dias: e.dias || diasEstimados(c), nivel: e.nivel || "basico", objetivo: e.objetivo || null });
  }
  for (const c of ordemPadrao(cards.filter((x) => !vistos.has(x.id)))) {
    etapas.push({ cardId: c.id, dias: diasEstimados(c), nivel: etapas.at(-1)?.nivel || "basico", objetivo: null });
  }
  return etapas;
}

/**
 * Distribui as etapas nos dias de estudo, uma depois da outra.
 *
 * `base` é o início da trilha: a semana 1 é a semana dele. Num replanejamento a agenda recomeça
 * de hoje, mas a numeração das semanas continua a mesma — senão "semana 1" mudaria de sentido a
 * cada replanejamento.
 */
export function agendar(etapas, { aPartirDe, diasDeEstudo, base = aPartirDe }) {
  const dias = normalizarDiasDeEstudo(diasDeEstudo);
  const semanaBase = inicioDaSemana(base);
  let dia = proximoDiaDeEstudo(aPartirDe, dias);

  return etapas.map((e) => {
    const n = limitar(Number(e.dias) || 1, 1, MAXIMO_DE_DIAS_POR_ETAPA);
    const inicio = dia;
    let fim = dia;
    for (let k = 1; k < n; k++) fim = proximoDiaDeEstudo(somarDias(fim, 1), dias);
    dia = proximoDiaDeEstudo(somarDias(fim, 1), dias);
    return {
      ...e,
      dias: n,
      inicio,
      fim,
      semana: Math.floor(diasEntre(semanaBase, inicioDaSemana(inicio)) / 7) + 1,
    };
  });
}

/**
 * As linhas finais de `proof_etapas`.
 *
 * Card já concluído não ocupa agenda: se ele já tinha datas numa trilha anterior, elas ficam
 * (são história); se não tinha, entra sem datas. Os pendentes são agendados a partir de
 * `aPartirDe`, na ordem do plano. A `ordem` é a posição no plano, para a tela mostrar a trilha
 * inteira na sequência de estudo.
 */
export function montarEtapas({ plano, concluidos, antigas = [], aPartirDe, diasDeEstudo, base }) {
  const antigaPorCard = new Map(antigas.map((e) => [String(e.cardId), e]));
  const pendentes = plano.filter((e) => !concluidos.has(String(e.cardId)));
  const agendadas = new Map(
    agendar(pendentes, { aPartirDe, diasDeEstudo, base }).map((e) => [String(e.cardId), e])
  );

  return plano.map((e, i) => {
    const id = String(e.cardId);
    const comum = { cardId: id, ordem: i + 1, nivel: e.nivel, objetivo: e.objetivo, dias: e.dias };
    if (agendadas.has(id)) {
      const a = agendadas.get(id);
      return { ...comum, dias: a.dias, inicio: a.inicio, fim: a.fim, semana: a.semana };
    }
    const antiga = antigaPorCard.get(id);
    return {
      ...comum,
      inicio: antiga?.inicio ?? null,
      fim: antiga?.fim ?? null,
      semana: antiga?.semana ?? null,
    };
  });
}
