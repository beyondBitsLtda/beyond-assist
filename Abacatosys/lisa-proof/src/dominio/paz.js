// A PAZ ENTRE OS REINOS, decidida por votação (pedido de 22/10/2026 — no lugar da aliança entre
// dois reinos). Puro, como o resto de src/dominio.
//
// Um jogador propõe a paz e escolhe quantos dias ela dura. Todos os reinos votam; o voto de quem
// propôs já conta como sim. A paz só começa com 100% dos votos a favor: um único "não" derruba a
// proposta, e ela expira se não fechar em HORAS_DE_VOTACAO. Uma proposta por vez.
//
// Enquanto a paz vale:
//   SEM GUERRA — ninguém invade ninguém (por isso não há defesa mútua: não há guerra);
//   VIZINHOS   — todos os reinos aparecem como vizinhos no mundo 3D;
//   MINA ×N    — a mina de cada reino rende vezes o número de reinos em paz;
//   EXPEDIÇÃO  — quando alguém saqueia uma expedição, cada um dos outros reinos ganha
//                PARTE_DA_EXPEDICAO do saque (moeda nova: ninguém perde o que saqueou).

export const DIAS_DE_PAZ = [3, 7, 14, 30];
export const HORAS_DE_VOTACAO = 72;
export const PARTE_DA_EXPEDICAO = 0.2;
const HORA = 3_600_000;

/** O que a paz traz, do jeito que aparece na proposta (para quem propõe e para quem vota). */
export function termosDaPaz(dias, totalDeReinos) {
  const n = Math.max(1, totalDeReinos || 1);
  return [
    { icone: "🕊️", titulo: `${dias} dias sem guerra`, texto: "Nenhum reino pode invadir outro enquanto a paz vale." },
    { icone: "🏝️", titulo: "Todos vizinhos", texto: "As ilhas de todos os reinos aparecem ao lado da sua no mundo 3D." },
    { icone: "⛏️", titulo: `Mina ×${n}`, texto: `A mina de cada reino rende ${n}× mais — uma vez para cada reino em paz.` },
    { icone: "🗺️", titulo: "Expedições repartem", texto: `Quando alguém saqueia uma expedição, cada um dos outros reinos ganha ${Math.round(PARTE_DA_EXPEDICAO * 100)}% do saque.` },
    { icone: "🗳️", titulo: "Só com 100% dos votos", texto: "A paz começa quando todos os reinos votarem sim. Um único não derruba a proposta." },
  ];
}

export const pazVigente = (p, agora = new Date()) => p?.status === "aprovada" && Boolean(p.fim) && new Date(p.fim).getTime() > agora.getTime();
export const votacaoAberta = (p, agora = new Date()) => p?.status === "votacao" && new Date(p.expira_em).getTime() > agora.getTime();

/** Dá para propor a paz agora? Só uma proposta por vez, e nunca durante uma paz. */
export function podeProporPaz({ dias, votacaoAtual, pazAtual, agora = new Date() }) {
  if (pazVigente(pazAtual, agora)) return { ok: false, motivo: "o mundo já está em paz" };
  if (votacaoAberta(votacaoAtual, agora)) return { ok: false, motivo: "já tem uma proposta de paz em votação" };
  if (dias != null && !DIAS_DE_PAZ.includes(Number(dias))) return { ok: false, motivo: `escolha ${DIAS_DE_PAZ.join(", ")} dias de paz` };
  return { ok: true };
}

/** Dá para votar? A votação precisa estar aberta, e cada reino vota uma vez. */
export function podeVotar({ paz, jaVotou, agora = new Date() }) {
  if (!votacaoAberta(paz, agora)) return { ok: false, motivo: "essa votação já terminou" };
  if (jaVotou) return { ok: false, motivo: "você já votou" };
  return { ok: true };
}

/**
 * Como está a votação: "rejeitada" com qualquer não; "aprovada" quando todos os reinos votaram
 * sim; senão "aberta". `votos`: os votos dados (true = sim).
 */
export function resultadoDaVotacao(votos, totalDeReinos) {
  if (votos.some((v) => v === false)) return "rejeitada";
  const sims = votos.filter((v) => v === true).length;
  return sims >= Math.max(1, totalDeReinos || 1) ? "aprovada" : "aberta";
}

export const fimDaVotacao = (agora = new Date()) => new Date(agora.getTime() + HORAS_DE_VOTACAO * HORA).toISOString();
export function periodoDaPaz(dias, agora = new Date()) {
  return { inicio: agora.toISOString(), fim: new Date(agora.getTime() + Number(dias) * 24 * HORA).toISOString() };
}

/** O fator da mina durante a paz: o número de reinos em paz (fora dela, 1). */
export const fatorDaMinaNaPaz = (paz, agora = new Date()) => (pazVigente(paz, agora) ? Math.max(1, paz.total_reinos || 1) : 1);

/** Quanto cada um dos outros reinos ganha quando alguém saqueia uma expedição durante a paz. */
export const parteDaExpedicao = (saque) => Math.floor(Math.max(0, saque || 0) * PARTE_DA_EXPEDICAO);
