// A ALIANÇA entre dois reinos (pedido de 22/10/2026). Puro, como o resto de src/dominio.
//
// Quem convida escolhe os DIAS DE PAZ. Se o outro aceitar, enquanto a aliança vale:
//   PAZ        — um não pode invadir o outro;
//   MINA ×2    — a mina de moedas dos dois rende o dobro;
//   AJUDA      — quando um é invadido, o aliado manda reforço de defesa; quando um invade, o aliado
//                manda reforço de ataque. O reforço é metade das tropas do aliado (ou, se ele não
//                tiver nenhuma, um reforço básico do tamanho da Torre dele) e NÃO custa nada a ele;
//   VER        — cada um vê o reino do outro (construções, tropas, Neuro) quando quiser;
//   VIZINHOS   — no 3D, a ilha do aliado aparece ao lado, ligada por uma ponte.
// Uma aliança por vez (a ilha vizinha é uma só). O convite espera HORAS_PARA_RESPONDER e mostra
// todos esses termos para quem recebe.

import { contagens, totalDeTropas, somarTropas, ORDEM_DAS_TROPAS } from "./tropas.js";
import { exercitoDeTreino, guarnicaoDeTreino, niveisDe } from "./reino.js";

export const DIAS_DE_PAZ = [3, 7, 14, 30];
export const HORAS_PARA_RESPONDER = 72;
export const FATOR_DA_MINA_NA_ALIANCA = 2;
export const FRACAO_DO_REFORCO = 0.5;
const HORA = 3_600_000;

/** Os termos da aliança, do jeito que aparecem no convite (para quem convida e para quem recebe). */
export function termosDaAlianca(dias) {
  return [
    { icone: "🕊️", titulo: `${dias} dias de paz`, texto: "Nenhum dos dois reinos pode invadir o outro enquanto a aliança vale." },
    { icone: "⛏️", titulo: "Mina em dobro", texto: `A mina de moedas dos dois rende ${FATOR_DA_MINA_NA_ALIANCA}× mais por hora.` },
    { icone: "🛡️", titulo: "Ajuda nas invasões", texto: "Quem for invadido recebe reforço de defesa do aliado; quem invadir leva reforço de ataque. O aliado não perde nada com isso." },
    { icone: "👀", titulo: "Ver o reino do outro", texto: "Cada um pode ver as construções, as tropas e o Neuro do aliado, sempre." },
    { icone: "🏝️", titulo: "Reinos vizinhos", texto: "A ilha do aliado aparece ao lado da sua no mundo 3D, ligada por uma ponte." },
  ];
}

export const aliancaVigente = (a, agora = new Date()) => a?.status === "aceita" && Boolean(a.fim) && new Date(a.fim).getTime() > agora.getTime();
export const convitePendente = (a, agora = new Date()) => a?.status === "pendente" && new Date(a.expira_em).getTime() > agora.getTime();
/** O outro lado da aliança, visto por `usuarioId`. */
export const outroDa = (a, usuarioId) => (a?.de_id === usuarioId ? a.para_id : a?.de_id);

/** Dá para convidar? `minhaAlianca` / `aliancaDele`: a vigente de cada um (ou null). */
export function podeConvidar({ deId, paraId, dias, minhaAlianca, aliancaDele, pendenteEntreNos, agora = new Date() }) {
  if (!paraId) return { ok: false, motivo: "esse reino não existe" };
  if (deId === paraId) return { ok: false, motivo: "não dá para se aliar ao próprio reino" };
  if (dias != null && !DIAS_DE_PAZ.includes(Number(dias))) return { ok: false, motivo: `escolha ${DIAS_DE_PAZ.join(", ")} dias de paz` };
  if (aliancaVigente(minhaAlianca, agora)) return { ok: false, motivo: "você já tem uma aliança — uma por vez" };
  if (aliancaVigente(aliancaDele, agora)) return { ok: false, motivo: "esse reino já tem um aliado" };
  if (convitePendente(pendenteEntreNos, agora)) return { ok: false, motivo: "já tem um convite entre vocês esperando resposta" };
  return { ok: true };
}

/** Quem recebeu pode responder? Para aceitar, nenhum dos dois pode ter outra aliança vigente. */
export function podeResponder({ convite, usuarioId, aceitar, minhaAlianca, aliancaDoOutro, agora = new Date() }) {
  if (!convite || convite.para_id !== usuarioId) return { ok: false, motivo: "esse convite não é para você" };
  if (!convitePendente(convite, agora)) return { ok: false, motivo: "esse convite expirou ou já foi respondido" };
  if (aceitar && aliancaVigente(minhaAlianca, agora)) return { ok: false, motivo: "você já tem uma aliança — uma por vez" };
  if (aceitar && aliancaVigente(aliancaDoOutro, agora)) return { ok: false, motivo: "esse reino já fechou outra aliança" };
  return { ok: true };
}

/** O convite novo: expira em HORAS_PARA_RESPONDER. */
export const expiracaoDoConvite = (agora = new Date()) => new Date(agora.getTime() + HORAS_PARA_RESPONDER * HORA).toISOString();
/** A aliança aceita agora vale até `dias` dias depois. */
export function periodoDaAlianca(dias, agora = new Date()) {
  return { inicio: agora.toISOString(), fim: new Date(agora.getTime() + Number(dias) * 24 * HORA).toISOString() };
}

const metade = (tropas) => {
  const c = contagens(tropas);
  for (const t of Object.keys(c)) c[t] = Math.max(1, Math.ceil(c[t] * FRACAO_DO_REFORCO));
  return c;
};

/** O reforço de defesa que o aliado manda: metade das tropas de defesa dele, ou um básico da Torre dele. */
export function reforcoDeDefesa(aliado) {
  if (!aliado) return {};
  if (totalDeTropas(aliado.guarnicao) > 0) return metade(aliado.guarnicao);
  return guarnicaoDeTreino(Math.max(1, niveisDe(aliado).castelo), FRACAO_DO_REFORCO);
}

/** O reforço de ataque que o aliado manda: metade do exército dele, ou um básico da Torre dele. */
export function reforcoDeAtaque(aliado) {
  if (!aliado) return {};
  if (totalDeTropas(aliado.exercito) > 0) return metade(aliado.exercito);
  return exercitoDeTreino(Math.max(1, niveisDe(aliado).castelo), 0.3);
}

export const juntarComReforco = (proprias, reforco) => somarTropas(proprias, reforco);

/**
 * Das tropas que caíram (as próprias e as do reforço juntas), quantas eram MINHAS: a parte de cada
 * tipo na mesma proporção em que ele foi para a batalha. As do aliado não custam nada a ele.
 */
export function perdasProprias(proprias, reforco, caidas) {
  const p = contagens(proprias), r = contagens(reforco), c = contagens(caidas);
  const minhas = {};
  for (const t of ORDEM_DAS_TROPAS) {
    if (!c[t] || !p[t]) continue;
    const parte = Math.min(p[t], Math.round((c[t] * p[t]) / (p[t] + (r[t] || 0))));
    if (parte > 0) minhas[t] = parte;
  }
  return minhas;
}

/** As tropas que caíram no ataque: as que foram, menos as que ficaram de pé. */
export function caidasNoAtaque(foram, sobreviventes) {
  const f = contagens(foram), s = contagens(sobreviventes);
  const c = {};
  for (const [t, n] of Object.entries(f)) if (n - (s[t] || 0) > 0) c[t] = n - (s[t] || 0);
  return c;
}
