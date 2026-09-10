// Histórico e placar dos jogos contra a Lisa (Modo Interativo).
//
// Fica no localStorage do navegador: persiste de verdade entre sessões, mas é POR DISPOSITIVO —
// jogo no PC não aparece no celular. Guardar no Supabase daria histórico compartilhado, mas
// exigiria criar tabela nova no banco (DDL), que não é algo pra fazer sem o usuário pedir.
// Se um dia quiser cross-device, a troca é só a implementação destas 3 funções.

const KEY = "lisaGames.v1";
const MAX_ENTRIES = 200; // histórico não precisa crescer pra sempre

/** Nunca lança: em janela privada / storage bloqueado, o jogo funciona sem histórico. */
function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* sem storage: segue o jogo, só não guarda */
  }
}

/** Registra uma partida. `game`: "velha" | "pong". `result`: "win" | "loss" | "draw"
 * (do ponto de vista do USUÁRIO). `detail` livre (ex.: placar do pong). */
export function recordGame({ game, result, detail = null }) {
  const entries = readAll();
  entries.push({ game, result, detail, at: new Date().toISOString() });
  writeAll(entries);
  return entries.length;
}

export function loadHistory({ game = null, limit = 12 } = {}) {
  const entries = readAll().filter((e) => !game || e.game === game);
  return entries.slice(-limit).reverse(); // mais recente primeiro
}

/** Placar acumulado: { wins, losses, draws, total } do ponto de vista do usuário. */
export function loadScore(game = null) {
  const entries = readAll().filter((e) => !game || e.game === game);
  return {
    wins: entries.filter((e) => e.result === "win").length,
    losses: entries.filter((e) => e.result === "loss").length,
    draws: entries.filter((e) => e.result === "draw").length,
    total: entries.length,
  };
}
