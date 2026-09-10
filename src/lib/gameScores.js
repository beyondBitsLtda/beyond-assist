// Partidas contra a Lisa no Modo Interativo (jogo da velha e pong), guardadas no Supabase —
// tabela `lisa_games` (ver db/schema.sql, item 26). SERVER-ONLY: usa a service_role.
//
// Existe pra o histórico ser COMPARTILHADO entre dispositivos, o que o localStorage não dava
// (partida no PC não aparecia no celular). O navegador continua com o localStorage como
// reserva, pra o jogo não perder o placar se a rede/tabela falhar — ver src/lib/gameHistory.js.
import { supabase } from "./supabase.js";

const VALID_GAMES = new Set(["velha", "pong", "penalti"]);
const VALID_RESULTS = new Set(["win", "loss", "draw"]);

export async function recordGameServer({ game, result, detail = null, device = null }) {
  if (!VALID_GAMES.has(game)) throw new Error(`game inválido: ${game}`);
  if (!VALID_RESULTS.has(result)) throw new Error(`result inválido: ${result}`);
  const { error } = await supabase
    .from("lisa_games")
    .insert({ game, result, detail: detail ? String(detail).slice(0, 60) : null, device: device ? String(device).slice(0, 80) : null });
  if (error) throw new Error(`recordGameServer: ${error.message}`);
}

/** Histórico (mais recente primeiro) + placar acumulado, numa só ida ao banco. `limit` limita o
 * histórico devolvido, mas o PLACAR é contado sobre tudo (senão "10 vitórias" viraria "6"
 * só porque a tela mostra 6 linhas). */
export async function loadGamesServer({ game = null, limit = 12 } = {}) {
  let q = supabase.from("lisa_games").select("game, result, detail, created_at").order("created_at", { ascending: false });
  if (game) q = q.eq("game", game);
  const { data, error } = await q.limit(500);
  if (error) throw new Error(`loadGamesServer: ${error.message}`);

  const rows = data || [];
  return {
    history: rows.slice(0, limit).map((r) => ({ game: r.game, result: r.result, detail: r.detail, at: r.created_at })),
    score: {
      wins: rows.filter((r) => r.result === "win").length,
      losses: rows.filter((r) => r.result === "loss").length,
      draws: rows.filter((r) => r.result === "draw").length,
      total: rows.length,
    },
  };
}
