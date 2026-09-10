// Histórico e placar dos jogos contra a Lisa (Modo Interativo), do lado do NAVEGADOR.
//
// A fonte de verdade é o servidor (/api/games → tabela lisa_games no Supabase), pra o placar ser
// o mesmo no PC e no celular. O localStorage ficou como RESERVA: se a rede/tabela falhar na hora
// de registrar, a partida é guardada aqui e reenviada na próxima leitura que der certo — assim
// uma falha momentânea não engole o resultado da partida em silêncio.

const PENDING_KEY = "lisaGames.pending.v1";

function readPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePending(entries) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(entries.slice(-100)));
  } catch {
    /* sem storage (janela privada): o jogo segue, só não dá pra guardar a reserva */
  }
}

async function postGame(entry) {
  const res = await fetch("/api/games", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entry),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
}

/** Registra uma partida. `result` é do ponto de vista do USUÁRIO ("win" | "loss" | "draw").
 * Nunca lança: se o servidor não aceitar, guarda pra reenviar depois. */
export async function recordGame({ game, result, detail = null }) {
  const entry = { game, result, detail, at: new Date().toISOString() };
  try {
    await postGame(entry);
  } catch {
    writePending([...readPending(), entry]);
  }
}

/** Tenta reenviar o que ficou pendente. Só remove da reserva o que o servidor aceitou. */
async function flushPending() {
  const pending = readPending();
  if (!pending.length) return;
  const stillPending = [];
  for (const entry of pending) {
    try {
      await postGame(entry);
    } catch {
      stillPending.push(entry);
    }
  }
  writePending(stillPending);
}

/**
 * Histórico + placar. Devolve `source: "servidor"` quando veio do banco, ou `"local"` quando
 * caiu na reserva — a interface mostra isso, pra você não achar que o placar está errado
 * quando na verdade é a rede/tabela que não respondeu.
 */
export async function loadGames({ game = null, limit = 12 } = {}) {
  try {
    await flushPending();
    const qs = new URLSearchParams({ limit: String(limit) });
    if (game) qs.set("game", game);
    const res = await fetch(`/api/games?${qs}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return { ...data, source: "servidor" };
  } catch {
    const local = readPending().filter((e) => !game || e.game === game);
    return {
      history: local.slice(-limit).reverse(),
      score: {
        wins: local.filter((e) => e.result === "win").length,
        losses: local.filter((e) => e.result === "loss").length,
        draws: local.filter((e) => e.result === "draw").length,
        total: local.length,
      },
      source: "local",
    };
  }
}
