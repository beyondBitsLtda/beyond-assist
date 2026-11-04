// A PAZ ENTRE OS REINOS, decidida por votação (pedido de 22/10/2026 — no lugar da aliança entre
// dois reinos). Puro, como o resto de src/dominio.
//
// Um jogador propõe a paz e escolhe quantos dias ela dura; o voto de quem propôs já conta como sim.
// Só vota (e só propõe) quem tem OFENSIVA_PARA_VOTAR dias seguidos de estudo — conferido na hora
// do voto. A paz só começa com 100% dos eleitores a favor (os aptos agora mais quem já votou): um
// único "não" derruba a proposta, e ela expira se não fechar em HORAS_DE_VOTACAO. Uma por vez.
//
// Enquanto a paz vale (para TODOS os reinos, inclusive os que não votaram):
//   SEM GUERRA — ninguém invade ninguém (por isso não há defesa mútua: não há guerra);
//   VIZINHOS   — todos os reinos aparecem como vizinhos no mundo 3D;
//   MINA ×N    — a mina de cada reino rende vezes o número de reinos em paz;
//   EXPEDIÇÃO  — quando alguém saqueia uma expedição, cada um dos outros reinos ganha
//                PARTE_DA_EXPEDICAO do saque (moeda nova: ninguém perde o que saqueou).

export const DIAS_DE_PAZ = [3, 7, 14, 30];
export const HORAS_DE_VOTACAO = 72;
export const PARTE_DA_EXPEDICAO = 0.2;
export const OFENSIVA_PARA_VOTAR = 3;
const HORA = 3_600_000;

const emDias = (n) => `${n} dia${n === 1 ? "" : "s"}`;
const faltaOfensiva = (ofensiva) => (ofensiva || 0) < OFENSIVA_PARA_VOTAR;

/** O que a paz traz, do jeito que aparece na proposta (para quem propõe e para quem vota). */
export function termosDaPaz(dias, totalDeReinos) {
  const n = Math.max(1, totalDeReinos || 1);
  return [
    { icone: "🕊️", titulo: `${dias} dias sem guerra`, texto: "Nenhum reino pode invadir outro enquanto a paz vale." },
    { icone: "🏝️", titulo: "Todos vizinhos", texto: "As ilhas de todos os reinos aparecem ao lado da sua no mundo 3D." },
    { icone: "⛏️", titulo: `Mina ×${n}`, texto: `A mina de cada reino rende ${n}× mais — uma vez para cada reino em paz.` },
    { icone: "🗺️", titulo: "Expedições repartem", texto: `Quando alguém saqueia uma expedição, cada um dos outros reinos ganha ${Math.round(PARTE_DA_EXPEDICAO * 100)}% do saque.` },
    { icone: "🗳️", titulo: "Só com 100% dos votos", texto: `Votam os reinos com ${OFENSIVA_PARA_VOTAR}+ dias de ofensiva de estudo; a paz começa quando todos eles votarem sim. Um único não derruba a proposta. Quem não vota ganha a paz do mesmo jeito.` },
  ];
}

/** Dá para votar com essa ofensiva? (A mesma regra vale para propor: o voto de quem propõe é sim.) */
export const podeVotarComOfensiva = (ofensiva) => !faltaOfensiva(ofensiva);

/** Quem decide a votação: os reinos aptos agora (ofensiva em dia) mais quem já votou. */
export function eleitoresDaVotacao({ aptos = [], votantes = [] }) {
  return [...new Set([...aptos, ...votantes])];
}

export const pazVigente = (p, agora = new Date()) => p?.status === "aprovada" && Boolean(p.fim) && new Date(p.fim).getTime() > agora.getTime();
export const votacaoAberta = (p, agora = new Date()) => p?.status === "votacao" && new Date(p.expira_em).getTime() > agora.getTime();

/** Dá para propor a paz agora? Só uma proposta por vez, nunca durante uma paz, e com a ofensiva em dia. */
export function podeProporPaz({ dias, votacaoAtual, pazAtual, ofensiva, agora = new Date() }) {
  if (pazVigente(pazAtual, agora)) return { ok: false, motivo: "o mundo já está em paz" };
  if (votacaoAberta(votacaoAtual, agora)) return { ok: false, motivo: "já tem uma proposta de paz em votação" };
  if (faltaOfensiva(ofensiva)) return { ok: false, motivo: `para propor a paz, estude ${emDias(OFENSIVA_PARA_VOTAR)} seguidos (sua ofensiva: ${emDias(ofensiva || 0)})` };
  if (dias != null && !DIAS_DE_PAZ.includes(Number(dias))) return { ok: false, motivo: `escolha ${DIAS_DE_PAZ.join(", ")} dias de paz` };
  return { ok: true };
}

/** Dá para votar? A votação precisa estar aberta, cada reino vota uma vez, e só com a ofensiva em dia. */
export function podeVotar({ paz, jaVotou, ofensiva, agora = new Date() }) {
  if (!votacaoAberta(paz, agora)) return { ok: false, motivo: "essa votação já terminou" };
  if (jaVotou) return { ok: false, motivo: "você já votou" };
  if (faltaOfensiva(ofensiva)) return { ok: false, motivo: `para votar, estude ${emDias(OFENSIVA_PARA_VOTAR)} seguidos (sua ofensiva: ${emDias(ofensiva || 0)}) — a paz vale para você do mesmo jeito` };
  return { ok: true };
}

/**
 * Como está a votação: "rejeitada" com qualquer não; "aprovada" quando todos os eleitores votaram
 * sim; senão "aberta". `votos`: os votos dados (true = sim); `totalDeEleitores`: o tamanho de
 * eleitoresDaVotacao().
 */
export function resultadoDaVotacao(votos, totalDeEleitores) {
  if (votos.some((v) => v === false)) return "rejeitada";
  const sims = votos.filter((v) => v === true).length;
  return sims >= Math.max(1, totalDeEleitores || 1) ? "aprovada" : "aberta";
}

export const fimDaVotacao = (agora = new Date()) => new Date(agora.getTime() + HORAS_DE_VOTACAO * HORA).toISOString();
export function periodoDaPaz(dias, agora = new Date()) {
  return { inicio: agora.toISOString(), fim: new Date(agora.getTime() + Number(dias) * 24 * HORA).toISOString() };
}

/** O fator da mina durante a paz: o número de reinos em paz (fora dela, 1). */
export const fatorDaMinaNaPaz = (paz, agora = new Date()) => (pazVigente(paz, agora) ? Math.max(1, paz.total_reinos || 1) : 1);

/** Quanto cada um dos outros reinos ganha quando alguém saqueia uma expedição durante a paz. */
export const parteDaExpedicao = (saque) => Math.floor(Math.max(0, saque || 0) * PARTE_DA_EXPEDICAO);
