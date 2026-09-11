"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { recordGame } from "@/lib/gameHistory.js";

// Jogo da memória contra a Lisa, alternando a vez.
//
// A memória dela é IMPERFEITA de propósito: cada carta exposta ela guarda com MEMORY_CHANCE em
// vez de gravar tudo. É o botão de dificuldade mais natural do jogo — com memória perfeita ela
// acertaria todos os pares a partir da 2ª rodada.
//
// ARQUITETURA (foi aqui que morava o bug de "ela não faz nada na vez dela"): virar carta e
// RESOLVER o par são coisas separadas. `flip` só empilha em `open` (com atualização funcional),
// e a resolução vive num efeito que observa `open.length === 2`. Antes, a vez dela virava a 2ª
// carta chamando o MESMO `flip` capturado no closure anterior — que ainda via `open` vazio, então
// tratava a 2ª carta como se fosse a 1ª, nunca resolvia o par e a vez travava pra sempre.
const SYMBOLS = ["◆", "▲", "●", "■", "★", "✦", "⬢", "✚"];
const MEMORY_CHANCE = 0.72;
const FLIP_BACK_MS = 900;

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
  const [open, setOpen] = useState([]); // ids virados agora (máx. 2)
  const [turn, setTurn] = useState("you");
  const [score, setScore] = useState({ you: 0, lisa: 0 });
  const [busy, setBusy] = useState(false); // par errado exposto: trava cliques
  const [result, setResult] = useState(null);

  const known = useRef({}); // id -> símbolo, preenchido só às vezes (MEMORY_CHANCE)
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

  // `flip` é ESTÁVEL (deps []) e só empilha — nada de decidir par aqui dentro
  const flip = useCallback((id) => {
    setOpen((prev) => (prev.length >= 2 || prev.includes(id) ? prev : [...prev, id]));
  }, []);

  // toda carta exposta passa pela memória dela — inclusive as que VOCÊ virou
  useEffect(() => {
    for (const id of open) {
      if (known.current[id]) continue;
      if (Math.random() < MEMORY_CHANCE) {
        const card = deck.find((c) => c.id === id);
        if (card) known.current[id] = card.sym;
      }
    }
  }, [open, deck]);

  // ---- resolução do par ----
  // SEM timer aqui dentro, de propósito. Na versão anterior este efeito chamava setBusy(true) E
  // agendava o setTimeout, com `busy` nas dependências: o setBusy disparava uma reexecução, o
  // cleanup rodava clearTimeout e MATAVA o timer recém-agendado — as cartas nunca desviravam e
  // a vez nunca passava pra Lisa (era esse o "ela não joga na vez dela").
  // `resolvingRef` garante que cada par seja processado uma vez só, mesmo com reexecuções.
  const resolvingRef = useRef(false);
  const pendingTurnRef = useRef(null); // de quem era a vez quando o par errado foi virado

  useEffect(() => {
    if (open.length === 0) resolvingRef.current = false; // liberado pro próximo par
    if (open.length !== 2 || result || resolvingRef.current) return;
    const [a, b] = open.map((i) => deck.find((c) => c.id === i));
    if (!a || !b) return;
    resolvingRef.current = true;
    const who = turn;

    if (a.sym === b.sym) {
      setFound((prev) => ({ ...prev, [a.id]: who, [b.id]: who }));
      setScore((prev) => ({ ...prev, [who]: prev[who] + 1 }));
      setOpen([]);
      onMoodRef.current?.(who === "you" ? "surprised" : "proud");
      // quem acerta joga de novo (regra clássica) — a vez NÃO passa
      return;
    }

    pendingTurnRef.current = who;
    setBusy(true);
    onMoodRef.current?.(who === "you" ? "giggle" : "annoyed");
  }, [open, result, deck, turn]);

  // ---- desvirar o par errado: efeito SÓ com `busy` na dependência ----
  // Isolado assim, nenhuma outra mudança de estado cancela este timer.
  useEffect(() => {
    if (!busy) return;
    const id = setTimeout(() => {
      const who = pendingTurnRef.current;
      setOpen([]);
      setBusy(false);
      setTurn(who === "you" ? "lisa" : "you");
    }, FLIP_BACK_MS);
    return () => clearTimeout(id);
  }, [busy]);

  // ---- vez dela, em dois passos guiados por ESTADO (sem timeout aninhado com closure velho) ----
  // passo 1: escolhe a primeira carta
  useEffect(() => {
    if (result || turn !== "lisa" || busy || open.length !== 0) return;
    onMoodRef.current?.("thinking");
    const t = setTimeout(() => {
      const hidden = deck.filter((c) => !found[c.id]).map((c) => c.id);
      if (!hidden.length) return;
      // se lembra de um par inteiro, começa por ele
      const bySym = {};
      for (const cid of hidden) {
        const sym = known.current[cid];
        if (!sym) continue;
        if (bySym[sym] !== undefined) return flip(bySym[sym]);
        bySym[sym] = cid;
      }
      // senão, vira uma que ainda não conhece (melhor que sortear no escuro)
      const unknown = hidden.filter((cid) => !known.current[cid]);
      const pool = unknown.length ? unknown : hidden;
      flip(pool[Math.floor(Math.random() * pool.length)]);
    }, 650);
    return () => clearTimeout(t);
  }, [turn, result, busy, open.length, deck, found, flip]);

  // passo 2: com uma carta virada, escolhe a segunda (agora com o estado ATUAL em mãos)
  useEffect(() => {
    if (result || turn !== "lisa" || busy || open.length !== 1) return;
    const t = setTimeout(() => {
      const first = open[0];
      const firstSym = deck.find((c) => c.id === first)?.sym;
      const hidden = deck.filter((c) => !found[c.id] && c.id !== first).map((c) => c.id);
      if (!hidden.length) return;
      // ela acabou de VER a primeira, então sabe o símbolo: procura o par na memória
      const match = hidden.find((cid) => known.current[cid] === firstSym);
      flip(match ?? hidden[Math.floor(Math.random() * hidden.length)]);
    }, 520);
    return () => clearTimeout(t);
  }, [turn, result, busy, open, deck, found, flip]);

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
          const canClick = !result && turn === "you" && !busy && !shown && open.length < 2;
          return (
            <button
              key={c.id}
              onClick={() => canClick && flip(c.id)}
              disabled={!canClick}
              style={{
                aspectRatio: "1", fontSize: 22, fontFamily: mono.fontFamily,
                color: owner === "you" ? CY : owner === "lisa" ? OR : "#eafcff",
                background: shown ? "rgba(var(--accent-rgb),0.12)" : "rgba(var(--accent-rgb),0.04)",
                border: `1px solid ${shown ? "rgba(var(--accent-rgb),0.4)" : "rgba(var(--accent-rgb),0.15)"}`,
                borderRadius: 8, cursor: canClick ? "pointer" : "default",
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
