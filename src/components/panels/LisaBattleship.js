"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { recordGame } from "@/lib/gameHistory.js";

// Batalha naval contra a Lisa. Frotas posicionadas automaticamente nos dois lados (colocar na
// mão pediria uma tela inteira de arrastar-e-girar navio; tem um botão de reposicionar).
//
// A IA dela é "caçar e perseguir": atira aleatório em PARIDADE de tabuleiro (só casas onde
// (x+y) é par — nenhum navio de 2+ casas escapa dessa malha, e isso corta metade dos tiros
// desperdiçados) e, ao acertar, empilha os vizinhos pra terminar de afundar. É simples e joga
// parecido com gente.

const N = 8;
const FLEET = [4, 3, 3, 2, 2];
const ix = (x, y) => y * N + x;

/** Espalha a frota sem sobreposição. Devolve Int8Array com 0=água e id do navio (1..n). */
function placeFleet() {
  const grid = new Int8Array(N * N);
  FLEET.forEach((size, i) => {
    const id = i + 1;
    for (let tries = 0; tries < 500; tries++) {
      const horiz = Math.random() < 0.5;
      const x = Math.floor(Math.random() * (horiz ? N - size + 1 : N));
      const y = Math.floor(Math.random() * (horiz ? N : N - size + 1));
      const cells = Array.from({ length: size }, (_, k) => (horiz ? ix(x + k, y) : ix(x, y + k)));
      if (cells.some((c) => grid[c])) continue;
      cells.forEach((c) => { grid[c] = id; });
      return;
    }
  });
  return grid;
}

const shipCells = (grid, id) => [...grid.keys()].filter((i) => grid[i] === id);
const isSunk = (grid, shots, id) => shipCells(grid, id).every((c) => shots[c] === "hit");
const allSunk = (grid, shots) => FLEET.every((_, i) => isSunk(grid, shots, i + 1));

export default function LisaBattleship({ onMood, onFinish }) {
  const [enemy, setEnemy] = useState(placeFleet); // frota DELA
  const [mine, setMine] = useState(placeFleet); // sua frota
  const [yourShots, setYourShots] = useState(() => Array(N * N).fill(null)); // seus tiros no tabuleiro dela
  const [herShots, setHerShots] = useState(() => Array(N * N).fill(null)); // tiros dela no seu
  const [turn, setTurn] = useState("you");
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState(null);

  const queue = useRef([]); // vizinhos a investigar depois de um acerto dela
  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const reset = useCallback(() => {
    setEnemy(placeFleet());
    setMine(placeFleet());
    setYourShots(Array(N * N).fill(null));
    setHerShots(Array(N * N).fill(null));
    setTurn("you");
    setResult(null);
    setMsg(null);
    queue.current = [];
    onMoodRef.current?.("focused");
  }, []);

  const fire = (i) => {
    if (result || turn !== "you" || yourShots[i]) return;
    const hit = enemy[i] > 0;
    const next = [...yourShots];
    next[i] = hit ? "hit" : "miss";
    setYourShots(next);
    if (hit) {
      const sunk = isSunk(enemy, next, enemy[i]);
      setMsg(sunk ? "AFUNDOU UM NAVIO DELA!" : "ACERTOU!");
      onMoodRef.current?.(sunk ? "shocked" : "surprised");
    } else {
      setMsg("água…");
      onMoodRef.current?.("smug");
    }
    setTurn("lisa");
  };

  // vez dela
  useEffect(() => {
    if (result || turn !== "lisa") return;
    onMoodRef.current?.("thinking");
    const id = setTimeout(() => {
      setHerShots((prev) => {
        const shots = [...prev];
        // 1) tem vizinho de acerto pendente? termina o serviço
        let target = null;
        while (queue.current.length && target === null) {
          const c = queue.current.shift();
          if (!shots[c]) target = c;
        }
        // 2) senão, tiro na malha de paridade (nenhum navio de 2+ casas escapa dela)
        if (target === null) {
          const free = [];
          const parity = [];
          for (let i = 0; i < N * N; i++) {
            if (shots[i]) continue;
            free.push(i);
            if (((i % N) + Math.floor(i / N)) % 2 === 0) parity.push(i);
          }
          const pool = parity.length ? parity : free;
          if (!pool.length) return prev;
          target = pool[Math.floor(Math.random() * pool.length)];
        }

        const hit = mine[target] > 0;
        shots[target] = hit ? "hit" : "miss";
        if (hit) {
          const x = target % N;
          const y = Math.floor(target / N);
          // empilha os 4 vizinhos válidos pra caçar o resto do navio
          if (x > 0) queue.current.push(ix(x - 1, y));
          if (x < N - 1) queue.current.push(ix(x + 1, y));
          if (y > 0) queue.current.push(ix(x, y - 1));
          if (y < N - 1) queue.current.push(ix(x, y + 1));
          const sunk = isSunk(mine, shots, mine[target]);
          setMsg(sunk ? "ELA AFUNDOU UM NAVIO SEU" : "ela acertou o seu");
          onMoodRef.current?.(sunk ? "proud" : "giggle");
        } else {
          setMsg("ela errou");
          onMoodRef.current?.("annoyed");
        }
        return shots;
      });
      setTurn("you");
    }, 700 + Math.random() * 500);
    return () => clearTimeout(id);
  }, [turn, result, mine]);

  // fim de jogo
  useEffect(() => {
    if (result) return;
    const youWon = allSunk(enemy, yourShots);
    const sheWon = allSunk(mine, herShots);
    if (!youWon && !sheWon) return;
    const outcome = youWon ? "win" : "loss";
    setResult(outcome);
    recordGame({ game: "naval", result: outcome });
    onMoodRef.current?.(youWon ? "sad" : "proud");
    onFinishRef.current?.(outcome);
  }, [enemy, mine, yourShots, herShots, result]);

  const Grid = ({ shots, grid, clickable, showShips }) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 2, width: "min(44vw, 150px)" }}>
      {Array.from({ length: N * N }, (_, i) => {
        const s = shots[i];
        const ship = showShips && grid[i] > 0;
        return (
          <button
            key={i}
            onClick={() => clickable && fire(i)}
            disabled={!clickable || !!s || !!result || turn !== "you"}
            style={{
              aspectRatio: "1", padding: 0, borderRadius: 2, fontSize: 8,
              border: "1px solid rgba(var(--accent-rgb),0.14)",
              background:
                s === "hit" ? "rgba(255,92,92,0.85)"
                : s === "miss" ? "rgba(207,239,251,0.18)"
                : ship ? "rgba(var(--accent-rgb),0.45)"
                : "rgba(0,0,0,0.4)",
              cursor: clickable && !s && !result && turn === "you" ? "pointer" : "default",
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ ...mono, fontSize: 9.5, letterSpacing: 1.5, color: result ? (result === "win" ? GR : OR) : "rgba(207,239,251,0.55)" }}>
        {result === "win" ? "VOCÊ AFUNDOU A FROTA DELA" : result === "loss" ? "ELA AFUNDOU A SUA FROTA" : turn === "you" ? "ATIRE NO TABULEIRO DELA" : "ELA ESTÁ MIRANDO…"}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ ...mono, fontSize: 8, letterSpacing: 1.5, color: OR }}>FROTA DELA</div>
          <Grid shots={yourShots} grid={enemy} clickable showShips={false} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ ...mono, fontSize: 8, letterSpacing: 1.5, color: CY }}>SUA FROTA</div>
          <Grid shots={herShots} grid={mine} clickable={false} showShips />
        </div>
      </div>

      <div style={{ ...mono, fontSize: 9, letterSpacing: 1, color: "rgba(207,239,251,0.5)", minHeight: 12 }}>{msg || " "}</div>

      <button
        onClick={reset}
        style={{ ...mono, fontSize: 9.5, letterSpacing: 1.5, padding: "7px 14px", borderRadius: 6, border: `1px solid ${result ? CY : "rgba(var(--accent-rgb),0.25)"}`, background: "rgba(var(--accent-rgb),0.06)", color: "#eafcff", cursor: "pointer" }}
      >
        {result ? "JOGAR DE NOVO" : "REPOSICIONAR FROTAS"}
      </button>
    </div>
  );
}
