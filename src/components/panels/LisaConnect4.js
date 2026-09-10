"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { recordGame } from "@/lib/gameHistory.js";

// Lig 4 contra a Lisa. Diferente da velha (que dá pra resolver inteira), aqui a árvore é grande
// demais pra minimax completo — então é minimax com PROFUNDIDADE LIMITADA + alfa-beta e uma
// função de avaliação que pontua "janelas" de 4 casas. É o que a deixa com skill de verdade
// sem travar o navegador.

const COLS = 7;
const ROWS = 6;
const DEPTH = 5; // 5 já joga bem e roda em poucos ms; 7+ começa a travar em celular
const YOU = "X";
const LISA = "O";

const idx = (c, r) => r * COLS + c;
const emptyBoard = () => Array(COLS * ROWS).fill(null);

/** Linha mais baixa livre da coluna, ou -1 se cheia. */
function dropRow(b, c) {
  for (let r = ROWS - 1; r >= 0; r--) if (!b[idx(c, r)]) return r;
  return -1;
}

/** Todas as janelas de 4 casas em linha (horizontal, vertical e as duas diagonais). Calculado
 * UMA vez no módulo: recalcular isso dentro do minimax seria o gargalo. */
const WINDOWS = (() => {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 3 < COLS) out.push([idx(c, r), idx(c + 1, r), idx(c + 2, r), idx(c + 3, r)]);
      if (r + 3 < ROWS) out.push([idx(c, r), idx(c, r + 1), idx(c, r + 2), idx(c, r + 3)]);
      if (c + 3 < COLS && r + 3 < ROWS) out.push([idx(c, r), idx(c + 1, r + 1), idx(c + 2, r + 2), idx(c + 3, r + 3)]);
      if (c - 3 >= 0 && r + 3 < ROWS) out.push([idx(c, r), idx(c - 1, r + 1), idx(c - 2, r + 2), idx(c - 3, r + 3)]);
    }
  }
  return out;
})();

export function winnerOf(b) {
  for (const w of WINDOWS) {
    const v = b[w[0]];
    if (v && v === b[w[1]] && v === b[w[2]] && v === b[w[3]]) return v;
  }
  return b.every(Boolean) ? "draw" : null;
}

/** Pontuação pela ótica da Lisa. Peças em janelas onde ainda cabe vitória valem mais; janela
 * com 3 dela e 1 vazia é quase-vitória, e 3 do usuário é ameaça (vale negativo mais forte, pra
 * ela preferir BLOQUEAR a montar). */
function evaluate(b) {
  let score = 0;
  for (const w of WINDOWS) {
    let mine = 0;
    let yours = 0;
    for (const i of w) {
      if (b[i] === LISA) mine++;
      else if (b[i] === YOU) yours++;
    }
    if (mine && yours) continue; // janela morta pros dois
    if (mine === 3) score += 50;
    else if (mine === 2) score += 8;
    else if (mine === 1) score += 1;
    if (yours === 3) score -= 60;
    else if (yours === 2) score -= 9;
    else if (yours === 1) score -= 1;
  }
  // centro vale mais: de lá saem mais janelas
  for (let r = 0; r < ROWS; r++) if (b[idx(3, r)] === LISA) score += 4;
  return score;
}

function minimax(b, depth, alpha, beta, isLisa) {
  const w = winnerOf(b);
  if (w === LISA) return { score: 100000 + depth };
  if (w === YOU) return { score: -100000 - depth };
  if (w === "draw") return { score: 0 };
  if (depth === 0) return { score: evaluate(b) };

  // ordem central-primeiro: melhora muito a poda alfa-beta
  const order = [3, 2, 4, 1, 5, 0, 6];
  let best = null;
  for (const c of order) {
    const r = dropRow(b, c);
    if (r < 0) continue;
    b[idx(c, r)] = isLisa ? LISA : YOU;
    const { score } = minimax(b, depth - 1, alpha, beta, !isLisa);
    b[idx(c, r)] = null;
    if (!best || (isLisa ? score > best.score : score < best.score)) best = { score, move: c };
    if (isLisa) alpha = Math.max(alpha, score);
    else beta = Math.min(beta, score);
    if (beta <= alpha) break; // poda
  }
  return best || { score: 0 };
}

export function lisaMove(b) {
  const free = [];
  for (let c = 0; c < COLS; c++) if (dropRow(b, c) >= 0) free.push(c);
  if (!free.length) return null;
  const best = minimax([...b], DEPTH, -Infinity, Infinity, true);
  return best.move ?? free[0];
}

export default function LisaConnect4({ onMood, onFinish }) {
  const [board, setBoard] = useState(emptyBoard);
  const [turn, setTurn] = useState(YOU);
  const [result, setResult] = useState(null);
  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const reset = useCallback(() => {
    setBoard(emptyBoard());
    setTurn(YOU);
    setResult(null);
    onMoodRef.current?.("focused");
  }, []);

  const play = (c) => {
    if (result || turn !== YOU) return;
    const r = dropRow(board, c);
    if (r < 0) return;
    const next = [...board];
    next[idx(c, r)] = YOU;
    setBoard(next);
    setTurn(LISA);
  };

  // vez dela: espera curta de propósito, pra dar a sensação de que está pensando
  useEffect(() => {
    if (result || turn !== LISA) return;
    onMoodRef.current?.("thinking");
    const id = setTimeout(() => {
      setBoard((prev) => {
        if (winnerOf(prev)) return prev;
        const c = lisaMove(prev);
        if (c == null) return prev;
        const r = dropRow(prev, c);
        if (r < 0) return prev;
        const next = [...prev];
        next[idx(c, r)] = LISA;
        return next;
      });
      setTurn(YOU);
    }, 500 + Math.random() * 600);
    return () => clearTimeout(id);
  }, [turn, result]);

  useEffect(() => {
    if (result) return;
    const w = winnerOf(board);
    if (!w) return;
    const outcome = w === YOU ? "win" : w === LISA ? "loss" : "draw";
    setResult(outcome);
    recordGame({ game: "lig4", result: outcome });
    onMoodRef.current?.(outcome === "win" ? "sad" : outcome === "loss" ? "proud" : "confused");
    onFinishRef.current?.(outcome);
  }, [board, result]);

  const label = result === "win" ? "VOCÊ GANHOU" : result === "loss" ? "A LISA GANHOU" : result === "draw" ? "EMPATE" : turn === YOU ? "SUA VEZ" : "ELA ESTÁ PENSANDO…";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: result ? (result === "win" ? GR : OR) : "rgba(207,239,251,0.6)" }}>{label}</div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4, background: "rgba(var(--accent-rgb),0.06)", padding: 6, borderRadius: 8, width: "min(92vw, 340px)" }}>
        {Array.from({ length: ROWS * COLS }, (_, i) => {
          const c = i % COLS;
          const v = board[i];
          return (
            <button
              key={i}
              onClick={() => play(c)}
              disabled={!!result || turn !== YOU || dropRow(board, c) < 0}
              title={`coluna ${c + 1}`}
              style={{
                aspectRatio: "1", borderRadius: "50%", border: "1px solid rgba(var(--accent-rgb),0.18)",
                background: v === YOU ? CY : v === LISA ? OR : "rgba(0,0,0,0.45)",
                cursor: result || turn !== YOU ? "default" : "pointer", padding: 0,
              }}
            />
          );
        })}
      </div>

      {result && (
        <button
          onClick={reset}
          style={{ ...mono, fontSize: 10, letterSpacing: 1.5, padding: "8px 16px", borderRadius: 6, border: `1px solid ${CY}`, background: "rgba(var(--accent-rgb),0.08)", color: "#eafcff", cursor: "pointer" }}
        >
          JOGAR DE NOVO
        </button>
      )}
    </div>
  );
}
