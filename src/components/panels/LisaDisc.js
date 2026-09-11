"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { recordGame } from "@/lib/gameHistory.js";
import { sendDiscSignal, pollDiscSignals } from "@/lib/discSignals.js";
import {
  FW, FH, GROUND, NALA_H,
  clampX, gestureOf, launchOf, mouthOf, moveNala, newNala, primeNala, stepDisc, stepJump, stepRally,
} from "@/lib/discPhysics.js";

// "Lançar Disco pra Nala" — o único jogo daqui que usa DUAS telas.
//
// Numa você faz o movimento de lançar (a direção e a força saem do gesto). O lance viaja pela
// fila de sinais (ver src/lib/discSignals.js) e cai na outra tela, onde mora a Nala — uma
// cachorrinha desenhada no mesmo painel de LED da carinha da Lisa. Ela corre, calcula onde o
// disco vai passar e pula pra pegar no ar.
//
// Por que o atraso da fila não estraga o jogo: o disco LEVA tempo pra atravessar o campo. O
// intervalo entre lançar e a Nala começar a correr é justamente o tempo de voo — em vez de
// parecer travamento, parece distância.
//
// A Nala é autônoma: quem joga é você, lançando. O que decide se ela pega é a QUALIDADE do
// lance — fraco demais o disco cai antes dela, forte demais passa por cima. A física toda mora
// em src/lib/discPhysics.js, fora do laço de desenho, pra poder ser testada.

const THROWS_PER_ROUND = 5;
const POLL_MS = 700;
const HELLO_MS = 6000;
const PEER_TTL_MS = 16000;

// ---- desenhos, em "#" e "." — mesma linguagem da carinha: um pixel aceso por célula ----
// ---- desenhos, em "#" e "." — mesma linguagem da carinha: um pixel aceso por célula.
// Cada pose tem 22x15 células. A primeira versão tinha 15x10 e a Nala saía um borrão: nesse
// tamanho não cabem focinho, orelha caída, olho e vão entre as patas ao mesmo tempo, que é
// justamente o que faz a silhueta ser lida como cachorro. Como aqui tudo acende na MESMA cor,
// a leitura vem só do contorno e dos buracos apagados — daí a coluna apagada separando a
// orelha da bochecha, e o olho vazado.
const NALA = {
  // parada: orelha caída, focinho pra frente, rabo levantado
  idle: [
    "......................",
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..###.....###.###.####",
    "..##.....####.########",
    "..##.....####.#######.",
    "...##.....###.#####...",
    "...################...",
    "...################...",
    "...###############....",
    "....#############.....",
    "....###......###......",
    "....###......###......",
    "...#####....#####.....",
  ],
  // rabo mais alto — alterna com a idle e vira abanada
  wag: [
    "......................",
    "..............#####...",
    "..###.......########..",
    "..##.......######.###.",
    "..##......###.###.####",
    "...##....####.########",
    "...##....####.#######.",
    "....#.....###.#####...",
    "...################...",
    "...################...",
    "...###############....",
    "....#############.....",
    "....###......###......",
    "....###......###......",
    "...#####....#####.....",
  ],
  // passada aberta
  runA: [
    "......................",
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..###.....###.###.####",
    "..##.....####.########",
    "..##.....####.#######.",
    "...##.....###.#####...",
    "...################...",
    "...################...",
    "...###############....",
    "....#############.....",
    "...###.......###......",
    "..###.........###.....",
    ".####..........####...",
  ],
  // patas recolhidas
  runB: [
    "......................",
    "..............#####...",
    "..###.......########..",
    "..##.......######.###.",
    "..##......###.###.####",
    "...##....####.########",
    "...##....####.#######.",
    "....#.....###.#####...",
    "...################...",
    "...################...",
    "...###############....",
    "....#############.....",
    ".....###...###........",
    ".....###...###........",
    "....#####.#####.......",
  ],
  // no ar: corpo esticado, patas dobradas, linhas de baixo vazias pra ela descolar do chão
  jump: [
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..........###.###.####",
    "..###....####.########",
    "...##....####.#######.",
    "....#.....###.#####...",
    "...################...",
    "...################...",
    "..###############.....",
    "..#############.......",
    "...####....####.......",
    "...###......##........",
    "......................",
    "......................",
  ],
  // sentada comemorando, com o disco na boca
  happy: [
    "......................",
    "..............#####...",
    "..###.......########..",
    "..##.......######.###.",
    "..##......###.###.####",
    "...##....####.########",
    "...##....####.#######.",
    "....#.....###.#####...",
    "...################...",
    "..#################...",
    "..#################...",
    "..################....",
    "..##########..###.....",
    "..##########..###.....",
    ".############.#####...",
  ],
  // cabeça baixa e rabo entre as pernas — precisa dar pra ver de longe que ela errou
  sad: [
    "......................",
    "......................",
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..........###.###.####",
    "..........###.########",
    "..........###.#######.",
    "..........###.#####...",
    ".##################...",
    ".#################....",
    ".##.#############.....",
    ".##.###......###......",
    "..#.###......###......",
    "...#####....#####.....",
  ],
};

const DISC = [".#####.", "#######", ".#####."];

/** Canvas com laço de animação, dpr e cor de destaque em cache — mesmo padrão do LisaPixelFace
 * (ler getComputedStyle a cada quadro força layout à toa). */
function useFieldCanvas(draw) {
  const ref = useRef(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let raf = 0;
    let last = performance.now();
    let accent = "56,225,255";
    let hex = "#38e1ff";
    let readAt = 0;

    const loop = (now) => {
      // trava o passo: aba em segundo plano volta com um dt gigante e teleportaria tudo
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const rect = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (now - readAt > 500) {
        readAt = now;
        const rs = getComputedStyle(document.documentElement);
        accent = rs.getPropertyValue("--accent-rgb").trim() || accent;
        hex = rs.getPropertyValue("--accent-hex").trim() || hex;
      }

      const cell = w / FW;
      const pad = cell * 0.16;
      ctx.shadowBlur = cell * 1.1;
      ctx.shadowColor = hex;
      const round = typeof ctx.roundRect === "function";
      const paint = (gx, gy, alpha = 1) => {
        if (alpha <= 0.02 || gx < -1 || gx > FW || gy < -1 || gy > FH) return;
        ctx.fillStyle = `rgba(${accent},${alpha})`;
        const x = gx * cell + pad / 2;
        const y = gy * cell + pad / 2;
        const s = cell - pad;
        if (round) {
          ctx.beginPath();
          ctx.roundRect(x, y, s, s, s * 0.28);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, s, s);
        }
      };
      const sprite = (rows, ox, oy, alpha = 1) => {
        for (let r = 0; r < rows.length; r++) {
          for (let c = 0; c < rows[r].length; c++) {
            if (rows[r][c] === "#") paint(Math.round(ox) + c, Math.round(oy) + r, alpha);
          }
        }
      };

      drawRef.current?.({ paint, sprite, dt, now });
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return ref;
}

/** Chão: uma linha cheia e uns tufos esparsos — profundidade sem roubar atenção. */
function drawGround(paint, now) {
  for (let x = 0; x < FW; x++) paint(x, GROUND + 1, 0.3);
  for (let x = 1; x < FW; x += 7) paint(x, GROUND, 0.16 + 0.06 * Math.sin(now / 700 + x));
}

// ============================================================================
//  TELA DA NALA — recebe o lance e resolve se pegou
// ============================================================================
function NalaField({ throwReq, onResult, onMood }) {
  const [banner, setBanner] = useState(null);

  const discRef = useRef(null);
  const nalaRef = useRef(newNala(30));
  const reactAtRef = useRef(0);
  const resolvedRef = useRef(true);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;

  // um lance novo chegou da outra tela
  useEffect(() => {
    if (!throwReq) return;
    discRef.current = { ...launchOf(throwReq.angle, throwReq.power), id: throwReq.id };
    resolvedRef.current = false;
    // primeNala sorteia o errinho de leitura e o tempo de reação DESTE lance — é o que impede
    // ela de virar uma parede que pega 100% assim que você acha o gesto certo
    reactAtRef.current = performance.now() + primeNala(nalaRef.current);
    setBanner(null);
    onMoodRef.current?.("surprised");
  }, [throwReq]);

  const canvasRef = useFieldCanvas(({ paint, sprite, dt, now }) => {
    drawGround(paint, now);
    const n = nalaRef.current;
    const disc = discRef.current;

    if (disc && !resolvedRef.current) {
      const res = stepRally(disc, n, dt, now >= reactAtRef.current);
      if (res) {
        resolvedRef.current = true;
        discRef.current = null;
        n.phase = res.caught ? "happy" : "sad";
        n.until = now + (res.caught ? 2200 : 1800);
        setBanner(
          res.caught ? (res.air ? "PEGOU NO AR!" : "PEGOU!")
          : res.why === "curto" ? "CURTO DEMAIS"
          : res.why === "longo" ? "FORTE DEMAIS"
          : "NÃO ALCANÇOU"
        );
        onMoodRef.current?.(res.caught ? "star" : "sad");
        onResultRef.current?.({ id: disc.id, caught: res.caught, air: res.air, why: res.why });
      }
    } else if (!disc) {
      // sem disco ela passeia — ficar parada feito estátua matava a graça da tela
      if (now > n.wander) {
        n.wander = now + 2600 + Math.random() * 3200;
        n.target = clampX(27 + Math.random() * 36);
      }
      moveNala(n, dt, 0.35);
      stepJump(n, dt);
    }

    const mouth = mouthOf(n);

    // ---- qual desenho mostrar ----
    if ((n.phase === "happy" || n.phase === "sad") && now > n.until) n.phase = "idle";
    let rows;
    if (n.jh > 0.6) rows = NALA.jump;
    else if (n.phase === "happy") rows = NALA.happy;
    else if (n.phase === "sad") rows = NALA.sad;
    else if (Math.abs(n.vx) > 0.5) rows = Math.floor(now / 110) % 2 ? NALA.runA : NALA.runB;
    else rows = Math.floor(now / 420) % 2 ? NALA.wag : NALA.idle;

    sprite(rows, n.x, GROUND - (NALA_H - 1) - n.jh);

    if (n.phase === "happy") sprite(DISC, mouth.x - 3, mouth.y - 1, 0.9);
    // discRef (e não `disc`): se ele acabou de ser pego/perdido neste quadro, não desenha mais
    if (discRef.current) sprite(DISC, disc.x - 3, disc.y, Math.floor(disc.spin) % 2 ? 1 : 0.75);
  });

  const good = banner === "PEGOU!" || banner === "PEGOU NO AR!";
  return (
    <>
      <canvas ref={canvasRef} style={{ width: "100%", aspectRatio: `${FW} / ${FH}`, display: "block", touchAction: "none" }} />
      <div style={{ ...mono, fontSize: 11, letterSpacing: 2, padding: "6px 10px", minHeight: 16, color: good ? GR : banner ? OR : "rgba(207,239,251,0.35)" }}>
        {banner || "A NALA ESTÁ ESPERANDO O DISCO"}
      </div>
    </>
  );
}

// ============================================================================
//  TELA DO LANÇADOR — o gesto vira direção e força
// ============================================================================
// Sem a tela da Nala aberta o lance vira TREINO: o disco voa aqui mesmo e o gesto continua
// respondendo. Bloquear a tela inteira só porque o outro aparelho não chegou era pior — dá pra
// pegar o jeito do movimento sozinho antes de chamar alguém pra ligar a outra ponta.
function ThrowerField({ onThrow, status }) {
  const [aim, setAim] = useState(null); // { angle, power } enquanto o gesto acontece
  const dragRef = useRef(null);
  const flyingRef = useRef(null);
  const aimRef = useRef(null);
  aimRef.current = aim;

  const canvasRef = useFieldCanvas(({ paint, sprite, dt, now }) => {
    drawGround(paint, now);

    // marca mais ou menos até onde a Nala alcança — referência sem entregar o lance
    for (let y = GROUND - 3; y <= GROUND; y++) paint(FW - 9, y, 0.18);

    const a = aimRef.current;
    if (a) {
      // prévia: só o começo do voo. Mostrar a curva inteira resolveria o jogo pra você.
      const sim = launchOf(a.angle, a.power);
      for (let t = 0; t < 1.0; t += 0.05) {
        stepDisc(sim, 0.05);
        if (sim.y >= GROUND || sim.x > FW) break;
        paint(Math.round(sim.x), Math.round(sim.y), 0.34);
      }
    }

    const f = flyingRef.current;
    if (f) {
      stepDisc(f, dt);
      if (f.y >= GROUND || f.x > FW + 3) flyingRef.current = null;
      else sprite(DISC, f.x - 3, f.y, 1);
    } else if (!a) {
      sprite(DISC, 3, GROUND - 4, 0.9); // disco parado, esperando o gesto
    }
  });

  // força = MAIOR velocidade atingida durante o movimento (é literalmente "com que força você
  // lançou"); direção = o trecho final, que é pra onde o disco sai da mão
  const start = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }], peak: 0 };
  };

  const move = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const now = performance.now();
    const prev = d.pts[d.pts.length - 1];
    const dt = Math.max(1, now - prev.t);
    d.peak = Math.max(d.peak, Math.hypot(e.clientX - prev.x, e.clientY - prev.y) / dt); // px/ms
    d.pts.push({ x: e.clientX, y: e.clientY, t: now });
    if (d.pts.length > 40) d.pts.shift();
    const g = gestureOf(d, now);
    if (g) setAim(g);
  };

  const end = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setAim(null);
    if (!d) return;
    const g = gestureOf(d, performance.now());
    if (!g) return;
    flyingRef.current = launchOf(g.angle, g.power);
    onThrow(g);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        style={{ width: "100%", aspectRatio: `${FW} / ${FH}`, display: "block", touchAction: "none", cursor: "grab" }}
      />
      <div style={{ ...mono, fontSize: 10, letterSpacing: 1.5, padding: "6px 10px", minHeight: 16, color: aim ? CY : "rgba(207,239,251,0.4)" }}>
        {aim ? `ÂNGULO ${Math.round(aim.angle)}° · FORÇA ${Math.round(aim.power)}%` : status}
      </div>
    </>
  );
}

// ============================================================================
//  Junta as duas pontas: escolha de papel, sinalização e placar
// ============================================================================
export default function LisaDisc({ onMood }) {
  const [role, setRole] = useState(null); // null | "thrower" | "nala"
  const [peerAt, setPeerAt] = useState(0);
  const [, setTick] = useState(0); // só pra "outra tela conectada" expirar sozinho
  const [incoming, setIncoming] = useState(null); // lance recebido (tela da Nala)
  const [status, setStatus] = useState("ARRASTE E SOLTE PRA LANÇAR");
  const [round, setRound] = useState([]); // resultados dos lances (tela do lançador)
  const [error, setError] = useState(null);

  const roleRef = useRef(role);
  roleRef.current = role;
  const pendingRef = useRef(null); // id do lance esperando resposta
  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;

  const linked = Date.now() - peerAt < PEER_TTL_MS;
  const linkedRef = useRef(linked);
  linkedRef.current = linked;

  // ---- avisa que estou aqui, de tempos em tempos ----
  useEffect(() => {
    if (!role) return;
    const say = () => sendDiscSignal("hello", { role });
    say();
    const id = setInterval(say, HELLO_MS);
    return () => clearInterval(id);
  }, [role]);

  useEffect(() => {
    if (!role) return;
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [role]);

  // ---- escuta a outra tela ----
  useEffect(() => {
    if (!role) return;
    let stop = false;
    let timer = null;
    let since = null;
    let primed = false;

    const handle = (s) => {
      if (s.kind === "hello") {
        if (s.payload?.role && s.payload.role !== roleRef.current) setPeerAt(Date.now());
        return;
      }
      if (s.kind === "throw" && roleRef.current === "nala") {
        setPeerAt(Date.now());
        setIncoming({ id: s.payload?.id, angle: Number(s.payload?.angle) || 30, power: Number(s.payload?.power) || 50 });
        return;
      }
      if (s.kind === "result" && roleRef.current === "thrower") {
        setPeerAt(Date.now());
        if (!s.payload?.id || s.payload.id !== pendingRef.current) return; // resposta de outro lance
        pendingRef.current = null;
        const caught = Boolean(s.payload.caught);
        setStatus(caught ? (s.payload.air ? "PEGOU NO AR!" : "PEGOU!") : `ERROU — ${String(s.payload.why || "").toUpperCase()}`);
        onMoodRef.current?.(caught ? "star" : "sad");
        setRound((r) => [...r, caught]);
      }
    };

    const loop = async () => {
      try {
        const { now, signals } = await pollDiscSignals(since);
        since = now;
        // a primeira leitura traz o rabo da fila (sinais de antes de eu entrar) — descarta
        if (primed) signals.forEach(handle);
        primed = true;
        setError(null);
      } catch (err) {
        setError(String(err.message || err));
      }
      if (!stop) timer = setTimeout(loop, POLL_MS);
    };
    loop();

    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [role]);

  // ---- fim da rodada ----
  useEffect(() => {
    if (round.length < THROWS_PER_ROUND) return;
    const caught = round.filter(Boolean).length;
    recordGame({ game: "disco", result: caught >= 3 ? "win" : "loss", detail: `${caught}/${THROWS_PER_ROUND}` });
    setStatus(`RODADA: ${caught}/${THROWS_PER_ROUND} PEGADAS`);
    onMoodRef.current?.(caught >= 3 ? "proud" : "sad");
    setRound([]);
  }, [round]);

  const throwDisc = useCallback((g) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    pendingRef.current = id;
    setStatus(linkedRef.current ? "DISCO A CAMINHO…" : "TREINO — NINGUÉM DO OUTRO LADO PRA PEGAR");
    onMoodRef.current?.("focused");
    sendDiscSignal("throw", { id, angle: Math.round(g.angle), power: Math.round(g.power) });
  }, []);

  const reportResult = useCallback((r) => {
    sendDiscSignal("result", r);
  }, []);

  const card = {
    ...mono, fontSize: 10, letterSpacing: 1.5, padding: "12px 16px", borderRadius: 8, cursor: "pointer",
    border: "1px solid rgba(var(--accent-rgb),0.25)", background: "transparent",
    color: "#eafcff", textAlign: "left", lineHeight: 1.6,
  };

  if (!role) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "min(94vw, 460px)" }}>
        <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(207,239,251,0.45)" }}>ESTE JOGO USA DUAS TELAS</div>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(207,239,251,0.7)" }}>
          Abra o Modo Interativo nos dois aparelhos e escolha um papel em cada. Você lança de um lado; a Nala corre e pega do outro.
        </div>
        <button onClick={() => setRole("thrower")} style={card}>
          🥏 EU LANÇO DAQUI
          <div style={{ fontSize: 9, color: "rgba(207,239,251,0.5)" }}>arraste e solte: a direção e a força saem do seu movimento</div>
        </button>
        <button onClick={() => setRole("nala")} style={card}>
          🐕 ESTA TELA É A NALA
          <div style={{ fontSize: 9, color: "rgba(207,239,251,0.5)" }}>deixe este aparelho de lado — ela corre e pega sozinha</div>
        </button>
      </div>
    );
  }

  const caught = round.filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "min(96vw, 900px)" }}>
      <div style={{ ...mono, fontSize: 9, letterSpacing: 1.5, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ color: linked ? GR : OR }}>{linked ? "● OUTRA TELA CONECTADA" : "○ ESPERANDO A OUTRA TELA"}</span>
        {role === "thrower" && <span style={{ color: "rgba(207,239,251,0.5)" }}>LANCE {round.length + 1}/{THROWS_PER_ROUND} · {caught} PEGADA(S)</span>}
        <button
          onClick={() => setRole(null)}
          style={{ ...mono, fontSize: 9, letterSpacing: 1, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(var(--accent-rgb),0.2)", background: "transparent", color: "rgba(207,239,251,0.6)", cursor: "pointer" }}
        >
          trocar papel
        </button>
      </div>

      <div style={{ width: "100%", border: "1px solid rgba(var(--accent-rgb),0.18)", borderRadius: 10, overflow: "hidden", background: "rgba(var(--accent-rgb),0.03)" }}>
        {role === "thrower" ? (
          <ThrowerField onThrow={throwDisc} status={linked ? status : "TREINO — A TELA DA NALA AINDA NÃO APARECEU"} />
        ) : (
          <NalaField throwReq={incoming} onResult={reportResult} onMood={onMood} />
        )}
      </div>

      {error && <div style={{ ...mono, fontSize: 9, color: OR }}>⚠ {error}</div>}
    </div>
  );
}
