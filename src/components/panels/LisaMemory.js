"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { recordGame } from "@/lib/gameHistory.js";

// Jogo da memória contra a Lisa, alternando a vez.
//
// A memória dela é IMPERFEITA de propósito: cada carta que aparece na mesa ela guarda com uma
// probabilidade (MEMORY_CHANCE) em vez de gravar tudo. É o botão de dificuldade mais natural que
// existe pra esse jogo — uma Lisa com memória perfeita acertaria todos os pares a partir da
// segunda rodada e o jogo não teria sentido.
const SYMBOLS = ["◆", "▲", "●", "■", "★", "✦", "⬢", "✚"];
const MEMORY_CHANCE = 0.72;
const FLIP_BACK_MS = 900; // tempo que o par errado fica virado antes de desvirar

function shuffled() {
  const deck = [...SYMBOLS, ...SYMBOLS].map((s, i) => ({ id: i, sym: s }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export default function LisaMemory({ onMood, onFinish }) {
  const [deck, setDeck] = useState(shuffled);
  const [found, setFound] = useState({}); // id -> "you" | "lisa"
  const [open, setOpen] = useState([]); // ids virados agora (no máx. 2)
  const [turn, setTurn] = useState("you");
  const [score, setScore] = useState({ you: 0, lisa: 0 });
  const [busy, setBusy] = useState(false); // trava cliques enquanto o par errado está exposto
  const [result, setResult] = useState(null);

  // o que ela "sabe": id -> símbolo, preenchido só às vezes (ver MEMORY_CHANCE)
  const known = useRef({});
  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const reset = useCallback(() => {
    setDeck(shuffled());
    setFound({});
    setOpen([]);
    setTurn("you");
    setScore({ you: 0, lisa: 0 });
    setBusy(false);
    setResult(null);
    known.current = {};
    onMoodRef.current?.("focused");
  }, []);

  /** Toda carta exposta passa pela memória dela — inclusive as que VOCÊ virou. */
  const remember = useCallback((ids) => {
    for (const id of ids) {
      if (Math.random() < MEMORY_CHANCE) {
        const card = deck.find((c) => c.id === id);
        if (card) known.current[id] = card.sym;
      }
    }
  }, [deck]);

  const flip = useCallback(
    (id) => {
      if (busy || result || found[id] || open.includes(id) || open.length >= 2) return;
      const next = [...open, id];
      setOpen(next);
      remember(next);
      if (next.length < 2) return;

      const [a, b] = next.map((i) => deck.find((c) => c.id === i));
      const who = turn;
      if (a.sym === b.sym) {
        setFound((prev) => ({ ...prev, [a.id]: who, [b.id]: who }));
        setScore((prev) => ({ ...prev, [who]: prev[who] + 1 }));
        setOpen([]);
        onMoodRef.current?.(who === "you" ? "surprised" : "proud");
        // quem acerta joga de novo — regra clássica, e dá ritmo à partida
      } else {
        setBusy(true);
        onMoodRef.current?.(who === "you" ? "giggle" : "annoyed");
        setTimeout(() => {
          setOpen([]);
          setBusy(false);
          setTurn(who === "you" ? "lisa" : "you");
        }, FLIP_BACK_MS);
      }
    },
    [busy, result, found, open, deck, turn, remember]
  );

  // vez dela
  useEffect(() => {
    if (result || turn !== "lisa" || busy || open.length) return;
    onMoodRef.current?.("thinking");
    const id = setTimeout(() => {
      const hidden = deck.filter((c) => !found[c.id]).map((c) => c.id);
      if (!hidden.length) return;

      // procura na memória um par que ela lembre de VERDADE
      const pair = (() => {
        const bySym = {};
        for (const cid of hidden) {
          const sym = known.current[cid];
          if (!sym) continue;
          if (bySym[sym] !== undefined) return [bySym[sym], cid];
          bySym[sym] = cid;
        }
        return null;
      })();

      if (pair) {
        flip(pair[0]);
        setTimeout(() => flip(pair[1]), 420);
        return;
      }
      // não lembra de par nenhum: vira uma que ainda não conhece (melhor que sortear no escuro)
      const unknown = hidden.filter((cid) => !known.current[cid]);
      const first = (unknown.length ? unknown : hidden)[Math.floor(Math.random() * (unknown.length || hidden.length))];
      flip(first);
      setTimeout(() => {
        // depois de ver a primeira, talvez ela agora lembre do par dela
        const sym = known.current[first];
        const match = hidden.find((cid) => cid !== first && known.current[cid] === sym);
        const other = hidden.filter((cid) => cid !== first);
        flip(match ?? other[Math.floor(Math.random() * other.length)]);
      }, 460);
    }, 700);
    return () => clearTimeout(id);
  }, [turn, result, busy, open.length, deck, found, flip]);

  // fim: todas encontradas
  useEffect(() => {
    if (result || Object.keys(found).length < deck.length) return;
    const outcome = score.you > score.lisa ? "win" : score.you < score.lisa ? "loss" : "draw";
    setResult(outcome);
    recordGame({ game: "memoria", result: outcome, detail: `${score.you}x${score.lisa}` });
    onMoodRef.current?.(outcome === "win" ? "sad" : outcome === "loss" ? "proud" : "confused");
    onFinishRef.current?.(outcome);
  }, [found, deck.length, score, result]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: 2, display: "flex", gap: 12 }}>
        <span style={{ color: turn === "you" && !result ? CY : "rgba(207,239,251,0.5)" }}>VOCÊ {score.you}</span>
        <span style={{ color: turn === "lisa" && !result ? OR : "rgba(207,239,251,0.5)" }}>{score.lisa} LISA</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, width: "min(92vw, 300px)" }}>
        {deck.map((c) => {
          const owner = found[c.id];
          const shown = owner || open.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => turn === "you" && flip(c.id)}
              disabled={!!result || turn !== "you" || busy || shown}
              style={{
                aspectRatio: "1", fontSize: 22, fontFamily: mono.fontFamily,
                color: owner === "you" ? CY : owner === "lisa" ? OR : "#eafcff",
                background: shown ? "rgba(var(--accent-rgb),0.12)" : "rgba(var(--accent-rgb),0.04)",
                border: `1px solid ${shown ? "rgba(var(--accent-rgb),0.4)" : "rgba(var(--accent-rgb),0.15)"}`,
                borderRadius: 8, cursor: !result && turn === "you" && !shown && !busy ? "pointer" : "default",
              }}
            >
              {shown ? c.sym : "?"}
            </button>
          );
        })}
      </div>

      <div style={{ ...mono, fontSize: 9.5, letterSpacing: 1, color: result ? (result === "win" ? GR : OR) : "rgba(207,239,251,0.4)" }}>
        {result === "win" ? "VOCÊ GANHOU" : result === "loss" ? "A LISA GANHOU" : result === "draw" ? "EMPATE" : turn === "you" ? "ACHE OS PARES" : "VEZ DELA…"}
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
