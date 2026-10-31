// OS CARTÕES COM REPETIÇÃO ESPAÇADA (pedido de 31/10/2026, o que tinha ficado para depois na proposta
// dos cursos que não são de programação). Frente e verso, por trilha: vocabulário de um idioma,
// fórmulas, termos e conceitos de qualquer tema (programação também). A Lisa cria os cartões do
// assunto da vez; a pessoa pode escrever os dela. Cada cartão volta no dia em que ia ser esquecido.
//
// A agenda é a do SM-2 (o algoritmo do SuperMemo, que o Anki popularizou), com quatro respostas:
// esqueci, difícil, lembrei e fácil. Esqueceu: o cartão volta amanhã e a facilidade cai. Lembrou: o
// intervalo cresce pela facilidade (1 dia, 3 dias, depois multiplicando). Puro: sem banco, sem rede.

import { somarDias, diasEntre } from "./datas.js";

export const RESPOSTAS_DO_CARTAO = {
  esqueci: { nome: "Esqueci", qualidade: 1 },
  dificil: { nome: "Difícil", qualidade: 3 },
  lembrei: { nome: "Lembrei", qualidade: 4 },
  facil: { nome: "Fácil", qualidade: 5 },
};
export const ORDEM_DAS_RESPOSTAS = ["esqueci", "dificil", "lembrei", "facil"];

export const FACILIDADE_INICIAL = 2.5;
export const FACILIDADE_MINIMA = 1.3;
export const INTERVALO_MAXIMO = 365;
/** Na revisão do dia: no máximo tantos cartões, dos quais tantos novos (a pilha não assusta). */
export const LIMITES_DA_REVISAO = { cartoes: 40, novos: 15 };
/** Quantos cartões a Lisa cria de uma vez, e quantos uma trilha pode ter. */
export const LIMITES_DOS_CARTOES = { porGeracao: 10, porTrilha: 400, frente: 200, verso: 400, exemplo: 300 };
/** Os pontos da revisão do dia: tantos por cartão revisado, até o teto (uma chave por dia). */
export const PONTOS_DOS_CARTOES = { porCartao: 2, tetoPorDia: 20 };

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const texto = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Um cartão novo (nunca revisado): estado inicial da agenda, para hoje. */
export const agendaNova = (hoje) => ({ intervalo: 0, facilidade: FACILIDADE_INICIAL, repeticoes: 0, lapsos: 0, proxima_em: hoje });

/**
 * A agenda depois de uma resposta. `cartao`: { intervalo, facilidade, repeticoes, lapsos }.
 * Devolve a agenda nova (mesmos campos, mais `proxima_em`).
 */
export function revisarCartao(cartao, resposta, hoje) {
  const r = RESPOSTAS_DO_CARTAO[resposta];
  if (!r) throw new Error("resposta inválida");
  const q = r.qualidade;
  const facilidadeAntes = Number(cartao?.facilidade) || FACILIDADE_INICIAL;
  const intervaloAntes = Math.max(0, Number(cartao?.intervalo) || 0);
  const repeticoesAntes = Math.max(0, Number(cartao?.repeticoes) || 0);
  const lapsos = Math.max(0, Number(cartao?.lapsos) || 0);
  // a fórmula do SM-2 para a facilidade
  const facilidade = Math.round(limitar(facilidadeAntes + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), FACILIDADE_MINIMA, 3.0) * 100) / 100;

  if (q < 3) {
    return { intervalo: 1, facilidade, repeticoes: 0, lapsos: lapsos + 1, proxima_em: somarDias(hoje, 1) };
  }
  const repeticoes = repeticoesAntes + 1;
  let intervalo;
  if (repeticoes === 1) intervalo = q === 5 ? 3 : 1;
  else if (repeticoes === 2) intervalo = q === 3 ? 2 : q === 5 ? 6 : 3;
  else intervalo = Math.round(intervaloAntes * (q === 3 ? 1.2 : q === 5 ? facilidade * 1.3 : facilidade));
  intervalo = limitar(Math.max(intervalo, intervaloAntes + (q === 3 ? 0 : 1)), 1, INTERVALO_MAXIMO);
  return { intervalo, facilidade, repeticoes, lapsos, proxima_em: somarDias(hoje, intervalo) };
}

/** Em quantos dias o cartão volta para cada resposta (os botões mostram: "Lembrei · 3 d"). */
export function previsoes(cartao, hoje) {
  return Object.fromEntries(ORDEM_DAS_RESPOSTAS.map((r) => [r, revisarCartao(cartao, r, hoje).intervalo]));
}

/** "hoje", "amanhã", "em 3 dias", "em 2 meses". */
export function quandoVolta(dias) {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias < 31) return `em ${dias} dias`;
  const meses = Math.round(dias / 30);
  return meses < 12 ? `em ${meses} ${meses === 1 ? "mês" : "meses"}` : "em 1 ano";
}

/** O cartão é novo (nunca foi revisado)? */
export const ehNovo = (c) => !c?.revisado_em && !(Number(c?.repeticoes) > 0) && !(Number(c?.lapsos) > 0);

/**
 * A revisão de hoje: os cartões vencidos (os mais atrasados primeiro), depois os novos (os mais
 * antigos primeiro), dentro dos limites. `cartoes`: [{ id, proxima_em, revisado_em, criado_em, ... }].
 */
export function cartoesDoDia(cartoes, hoje, limites = LIMITES_DA_REVISAO) {
  const vencidos = [], novos = [];
  for (const c of cartoes || []) {
    if (String(c.proxima_em) > hoje) continue;
    (ehNovo(c) ? novos : vencidos).push(c);
  }
  vencidos.sort((a, b) => String(a.proxima_em).localeCompare(String(b.proxima_em)) || String(a.criado_em).localeCompare(String(b.criado_em)));
  novos.sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
  const fila = [...vencidos.slice(0, limites.cartoes), ...novos.slice(0, limites.novos)];
  return fila.slice(0, limites.cartoes);
}

/** O resumo de uma pilha: quantos cartões, quantos para hoje, quantos novos, quantos já firmes (21+ dias). */
export function resumoDosCartoes(cartoes, hoje) {
  const lista = cartoes || [];
  const doDia = cartoesDoDia(lista, hoje);
  return {
    total: lista.length,
    hoje: doDia.length,
    novos: lista.filter(ehNovo).length,
    firmes: lista.filter((c) => Number(c.intervalo) >= 21).length,
    proxima: lista.filter((c) => String(c.proxima_em) > hoje).map((c) => String(c.proxima_em)).sort()[0] || null,
  };
}

/** Os pontos da revisão de hoje por quantos cartões diferentes a pessoa já revisou hoje. */
export const pontosDaRevisao = (revisadosHoje) => Math.min(PONTOS_DOS_CARTOES.tetoPorDia, Math.max(0, revisadosHoje) * PONTOS_DOS_CARTOES.porCartao);

const chaveDaFrente = (f) => texto(f, LIMITES_DOS_CARTOES.frente).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Um cartão escrito pela pessoa (ou um da IA), conferido. Lança erro com o motivo. */
export function validarCartao(bruto) {
  const frente = texto(bruto?.frente, LIMITES_DOS_CARTOES.frente);
  const verso = texto(bruto?.verso, LIMITES_DOS_CARTOES.verso);
  if (!frente) throw new Error("escreva a frente do cartão");
  if (!verso) throw new Error("escreva o verso do cartão");
  if (chaveDaFrente(frente) === chaveDaFrente(verso)) throw new Error("a frente e o verso estão iguais");
  return { frente, verso, exemplo: texto(bruto?.exemplo, LIMITES_DOS_CARTOES.exemplo) };
}

/**
 * Os cartões que a IA devolveu, conferidos: sem frente repetida (entre eles e com os que a trilha já
 * tem). Menos de 3 bons, não serve.
 */
export function validarCartoes(bruto, frentesExistentes = []) {
  const vistas = new Set(frentesExistentes.map(chaveDaFrente));
  const cartoes = [];
  for (const c of Array.isArray(bruto?.cartoes) ? bruto.cartoes : []) {
    if (cartoes.length >= LIMITES_DOS_CARTOES.porGeracao) break;
    let ok;
    try { ok = validarCartao(c); } catch { continue; }
    const chave = chaveDaFrente(ok.frente);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    cartoes.push(ok);
  }
  if (cartoes.length < 3) throw new Error("a IA não criou cartões novos suficientes — tente de novo (ou o assunto já está todo nos cartões)");
  return cartoes;
}

/** Dias de atraso de um cartão vencido (0 se é de hoje ou do futuro). */
export const atrasoDoCartao = (c, hoje) => Math.max(0, diasEntre(String(c.proxima_em), hoje));
