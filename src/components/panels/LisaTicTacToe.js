"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { recordGame } from "@/lib/gameHistory.js";

// Jogo da velha contra a Lisa. Ela joga com minimax COMPLETO (o tabuleiro é 3x3, então dá pra
// resolver o jogo inteiro sem custo nenhum) — só que com uma chance de errar de propósito,
// senão seria literalmente impossível ganhar dela e o jogo perderia a graça.
const LISA_MISTAKE_CHANCE = 0.18;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** "X" | "O" | "draw" | null (jogo em andamento) */
function winnerOf(b) {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return b.every(Boolean) ? "draw" : null;
}

// O = Lisa, X = usuário. Pontuação pela ótica da Lisa, com profundidade pra ela preferir
// ganhar rápido e perder devagar.
function minimax(board, isLisa, depth = 0) {
  const w = winnerOf(board);
  if (w === "O") return { score: 10 - depth };
  if (w === "X") return { score: depth - 10 };
  if (w === "draw") return { score: 0 };

  let best = null;
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = isLisa ? "O" : "X";
    const { score } = minimax(board, !isLisa, depth + 1);
    board[i] = null;
    if (!best || (isLisa ? score > best.score : score < best.score)) best = { score, move: i };
  }
  return best;
}

function lisaMove(board) {
  const free = board.map((v, i) => (v ? null : i)).filter((i) => i !== null);
  if (!free.length) return null;
  if (Math.random() < LISA_MISTAKE_CHANCE) return free[Math.floor(Math.random() * free.length)];
  return minimax([...board], true).move ?? free[0];
}

/**
 * `onMood` avisa o painel qual cara a Lisa deve fazer conforme o jogo anda (pensando, ganhando,
 * perdendo) — é o que faz a partida parecer contra ALGUÉM e não contra um tabuleiro.
 */
export default function LisaTicTacToe({ onMood, onFinish }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X"); // usuário começa
  const [result, setResult] = useState(null);

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null));
    setTurn("X");
    setResult(null);
    onMood?.("focused");
  }, [onMood]);

  // vez da Lisa: pequena espera de propósito, pra dar a sensação de que ela está pensando
  useEffect(() => {
    if (result || turn !== "O") return;
    onMood?.("thinking");
    const id = setTimeout(() => {
      setBoard((prev) => {
        if (winnerOf(prev)) return prev;
        const mv = lisaMove(prev);
        if (mv == null) return prev;
        const next = [...prev];
        next[mv] = "O";
        return next;
      });
      setTurn("X");
    }, 600 + Math.random() * 700);
    return () => clearTimeout(id);
  }, [turn, result, onMood]);

  // fim de jogo: registra no histórico UMA vez e avisa a cara dela
  useEffect(() => {
    if (result) return;
    const w = winnerOf(board);
    if (!w) return;
    const outcome = w === "X" ? "win" : w === "O" ? "loss" : "draw";
    setResult(outcome);
    // registra no servidor sem travar a interface — recordGame nunca lança (guarda de reserva
    // no aparelho se a rede falhar, ver gameHistory.js)
    recordGame({ game: "velha", result: outcome });
    onMood?.(outcome === "win" ? "sad" : outcome === "loss" ? "proud" : "confused");
    onFinish?.(outcome);
  }, [board, result, onMood, onFinish]);

  const play = (i) => {
    if (result || turn !== "X" || board[i]) return;
    const next = [...board];
    next[i] = "X";
    setBoard(next);
    setTurn("O");
  };

  const label = result === "win" ? "VOCÊ GANHOU" : result === "loss" ? "A LISA GANHOU" : result === "draw" ? "EMPATE" : turn === "X" ? "SUA VEZ" : "ELA ESTÁ PENSANDO…";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: result ? (result === "win" ? GR : OR) : "rgba(207,239,251,0.6)" }}>{label}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 62px)", gridTemplateRows: "repeat(3, 62px)", gap: 6 }}>
        {board.map((v, i) => (
          <button
            key={i}
            onClick={() => play(i)}
            disabled={!!v || !!result || turn !== "X"}
            style={{
              fontSize: 28, fontFamily: mono.fontFamily, fontWeight: 700,
              color: v === "X" ? CY : v === "O" ? OR : "transparent",
              background: "rgba(var(--accent-rgb),0.05)",
              border: "1px solid rgba(var(--accent-rgb),0.22)",
              borderRadius: 8,
              cursor: v || result || turn !== "X" ? "default" : "pointer",
            }}
          >
            {v || "·"}
          </button>
        ))}
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
