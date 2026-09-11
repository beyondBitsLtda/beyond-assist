"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { loadGames } from "@/lib/gameHistory.js";
import { WORLD_ITEMS, availableActivities, houseLevel, nextItem, unlockedItems, worldXp, BUILD_ACTIVITY } from "@/lib/lisaWorld.js";
import { LISA, LISA_H, LISA_W, STEVE, TOOLS, NOTE } from "./worldSprites.js";
import { NALA } from "./nalaSprites.js";
import { BACK, GROUND, SPOTS, WALK_MAX, WALK_MIN, WH, WW, drawWorld, painter } from "./worldScene.js";

// "Mundo da Lisa": o quintal e a casinha dela, em pixel, onde ela leva a vida dela — rega as
// plantas, varre o quintal, brinca com a Nala, ouve música, recebe o Steve. O quintal ganha
// construções conforme VOCÊ interage com ela nos modos interativos (as regras e a escada de
// construções estão em src/lib/lisaWorld.js; o desenho do cenário, em worldScene.js).
//
// Duas decisões que valem registro:
//
// 1. O cenário vai pra uma camada em CACHE (um canvas fora da tela) e só é redesenhado quando
//    aparece construção nova, quando o dia vira noite ou quando a tela muda de tamanho. Casa,
//    árvore e cerca somam mais de mil células acesas, e cada célula aqui é um roundRect COM
//    sombra — redesenhar tudo isso 60 vezes por segundo derrubaria o quadro. Só os seres vivos
//    e as partículas são redesenhados a cada quadro.
//
// 2. A hora é a de verdade do aparelho. Abrir isso de madrugada mostra o quintal escuro, com
//    estrelas e o poste aceso — faz parecer que ela estava ali o tempo todo, que é o ponto.

const NALA_H = 15;
const LISA_SPEED = 11;     // células/s
const NALA_SPEED = 16;
const STEP_MS = 170;       // troca de perna
const GAP_MIN_MS = 1800;   // respiro entre uma atividade e outra
const GAP_VAR_MS = 3000;
const SEEN_KEY = "lisaWorld.seenXp";

const isNight = (h) => h < 6 || h >= 19;

export default function LisaWorld({ onMood }) {
  const [world, setWorld] = useState(null); // { xp, unlocked, level, next, source, erro }
  const [novas, setNovas] = useState([]);   // construções que apareceram desde a última visita
  const [label, setLabel] = useState("chegando no quintal…");

  const canvasRef = useRef(null);
  const sceneRef = useRef({ unlocked: [], level: 1, night: isNight(new Date().getHours()), hour: new Date().getHours(), temCarta: false });
  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;

  // atores
  const lisaRef = useRef({ x: 30, target: 30, flip: false, pose: "idle", step: 0 });
  const nalaRef = useRef({ x: 52, target: 52, moving: false, jh: 0, jv: 0 });
  const steveRef = useRef(null);
  const discRef = useRef(null);
  const actRef = useRef(null);
  const nextAtRef = useRef(0);
  const bagRef = useRef([]);
  const buildQueueRef = useRef([]);

  // ---- de onde vem o progresso: o que você já fez de verdade ----
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [games, acts] = await Promise.all([
        loadGames({ limit: 1 }).catch(() => null),
        fetch("/api/activities").then((r) => r.json()).catch(() => null),
      ]);
      if (!vivo) return;
      const erro = acts && !acts.ok ? acts.error : null;
      const xp = worldXp({ games: games?.score, quiz: acts?.quiz, pair: acts?.pair });
      const unlocked = unlockedItems(xp);
      const level = houseLevel(xp);

      // o que ela construiu desde a última vez que você apareceu
      let seen = 0;
      try { seen = Number(localStorage.getItem(SEEN_KEY)) || 0; } catch {}
      const antes = new Set(unlockedItems(seen));
      const recem = WORLD_ITEMS.filter((i) => unlocked.includes(i.key) && !antes.has(i.key));
      try { localStorage.setItem(SEEN_KEY, String(xp)); } catch {}

      setWorld({ xp, unlocked, level, next: nextItem(xp), source: games?.source, erro });
      setNovas(recem);
      buildQueueRef.current = recem.slice(0, 2);
      sceneRef.current = { unlocked, level, night: isNight(new Date().getHours()), hour: new Date().getHours(), temCarta: recem.length > 0 };
      if (recem.length) onMoodRef.current?.("proud");
    })();
    return () => { vivo = false; };
  }, []);

  const pickActivity = useCallback((now) => {
    // obra primeiro: se ela construiu algo desde a sua última visita, mostra isso antes
    if (buildQueueRef.current.length) {
      const item = buildQueueRef.current.shift();
      return { ...BUILD_ACTIVITY, label: `construindo: ${item.label.toLowerCase()}`, until: 0, startedAt: now, phase: "indo" };
    }
    const opts = availableActivities(sceneRef.current.unlocked);
    if (!bagRef.current.length) {
      const pool = [...opts];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      bagRef.current = pool;
    }
    // o saco pode ter sido montado antes de uma construção nova entrar: filtra na saída
    let a = bagRef.current.pop();
    while (a && a.needs && !sceneRef.current.unlocked.includes(a.needs)) a = bagRef.current.pop();
    return a ? { ...a, until: 0, startedAt: now, phase: "indo" } : null;
  }, []);

  // ---- laço de desenho ----
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d");
    let raf = 0;
    let last = performance.now();
    let accent = "56,225,255";
    let hex = "#38e1ff";
    let readAt = 0;
    let staticKey = "";

    const makePaint = (c, cell) => {
      const pad = cell * 0.16;
      const round = typeof c.roundRect === "function";
      return (gx, gy, alpha = 1) => {
        if (alpha <= 0.02 || gx < -1 || gx > WW || gy < -1 || gy > WH) return;
        c.fillStyle = `rgba(${accent},${alpha})`;
        const x = gx * cell + pad / 2;
        const y = gy * cell + pad / 2;
        const s = cell - pad;
        if (round) { c.beginPath(); c.roundRect(x, y, s, s, s * 0.28); c.fill(); }
        else c.fillRect(x, y, s, s);
      };
    };

    const loop = (now) => {
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
      const cell = w / WW;
      const sc = sceneRef.current;

      // ---- camada do cenário, em cache ----
      const key = `${w}x${h}|${dpr}|${accent}|${sc.unlocked.join(",")}|${sc.level}|${sc.night}|${Math.floor(sc.hour * 4)}|${sc.temCarta}`;
      if (key !== staticKey) {
        staticKey = key;
        off.width = Math.round(w * dpr);
        off.height = Math.round(h * dpr);
        offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        offCtx.shadowBlur = cell * 1.1;
        offCtx.shadowColor = hex;
        drawWorld(painter(makePaint(offCtx, cell)), sc);
        offCtx.shadowBlur = 0;
      }
      ctx.drawImage(off, 0, 0, w, h);

      // ---- atores ----
      ctx.shadowBlur = cell * 1.1;
      ctx.shadowColor = hex;
      const P = painter(makePaint(ctx, cell));
      const lisa = lisaRef.current;
      const nala = nalaRef.current;

      // escolhe o que fazer
      let a = actRef.current;
      if (!a && now > nextAtRef.current) {
        a = pickActivity(now);
        if (a) {
          actRef.current = a;
          lisa.target = a.at ?? Math.round(WALK_MIN + Math.random() * (WALK_MAX - WALK_MIN));
          setLabel(a.label);
        }
      }

      // caminhada até o lugar
      const dx = (lisa.target ?? lisa.x) - lisa.x;
      if (Math.abs(dx) > 0.6) {
        const step = LISA_SPEED * dt;
        lisa.x += Math.sign(dx) * Math.min(step, Math.abs(dx));
        lisa.flip = dx < 0;
        lisa.step = Math.floor(now / STEP_MS) % 2;
        lisa.pose = lisa.step ? "walkA" : "walkB";
      } else if (a) {
        if (a.phase === "indo") {
          a.phase = "fazendo";
          a.until = now + a.ms;
          a.startedAt = now;
          if (a.key === "steve") steveRef.current = { x: SPOTS.casa + 6, phase: "chegando" };
        }
        lisa.pose = a.sit ? "sit" : a.tool ? "work" : a.key === "steve" || a.key === "nala" ? "armUp" : "idle";
        if (now > a.until) {
          actRef.current = null;
          nextAtRef.current = now + GAP_MIN_MS + Math.random() * GAP_VAR_MS;
          discRef.current = null;
          if (a.key === "steve") steveRef.current = null;
          setLabel("dando uma volta pelo quintal");
        }
      } else {
        lisa.pose = "idle";
      }

      // ---- Nala: anda atrás dela, menos quando estão brincando ----
      const brincando = a?.key === "nala" && a.phase === "fazendo";
      if (brincando) {
        if (!discRef.current && (now - a.startedAt) % 4200 < 40) {
          discRef.current = { x: lisa.x + 6, y: GROUND - 18, vx: 26, vy: -14 };
        }
        const d = discRef.current;
        if (d) {
          d.vy += 40 * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          nala.target = Math.min(WALK_MAX, d.x - 14);
          if (d.y >= GROUND - 2 || Math.abs(nala.x + 14 - d.x) < 3) discRef.current = null;
          else P.rect(Math.round(d.x), Math.round(d.y), 3, 2, 1);
        } else {
          nala.target = lisa.x + 20;
        }
      } else {
        nala.target = lisa.x - 30;
      }
      nala.target = Math.max(0, Math.min(WW - 24, nala.target));
      const ndx = nala.target - nala.x;
      nala.moving = Math.abs(ndx) > 1;
      if (nala.moving) nala.x += Math.sign(ndx) * Math.min(NALA_SPEED * dt, Math.abs(ndx));
      // pulinho quando o disco passa por cima dela
      if (brincando && discRef.current && nala.jh === 0 && Math.abs(discRef.current.x - (nala.x + 14)) < 5) nala.jv = -26;
      if (nala.jv !== 0 || nala.jh > 0) {
        nala.jv += 70 * dt;
        nala.jh -= nala.jv * dt;
        if (nala.jh <= 0) { nala.jh = 0; nala.jv = 0; }
      }

      const nalaRows = nala.jh > 0.6 ? NALA.jump : nala.moving ? (Math.floor(now / 110) % 2 ? NALA.runA : NALA.runB) : Math.floor(now / 420) % 2 ? NALA.wag : NALA.idle;
      P.sprite(nalaRows, nala.x, GROUND - (NALA_H - 1) - nala.jh);

      // ---- Lisa ----
      // sentada, ela aparece EM CIMA do banco, que fica na linha de trás
      const sentada = a?.sit && a.phase === "fazendo";
      const lisaY = sentada ? BACK - (LISA_H - 1) - 4 : GROUND - (LISA_H - 1);
      drawFigure(P, LISA[lisa.pose] || LISA.idle, lisa.x, lisaY, lisa.flip);

      // ferramenta na mão
      if (a?.tool && a.phase === "fazendo") {
        const rows = TOOLS[a.tool];
        const hx = lisa.flip ? lisa.x + 1 : lisa.x + 11;
        P.sprite(rows, hx, GROUND - 7);
        if (a.key === "regar") {
          for (let i = 0; i < 4; i++) {
            const t = ((now / 500) + i / 4) % 1;
            P.paint(Math.round(hx - 1 + t * 2), Math.round(GROUND - 3 + t * 3), 0.9 - t * 0.4);
          }
        }
      }

      // notas de música
      if (a?.key === "musica" && a.phase === "fazendo") {
        for (let i = 0; i < 3; i++) {
          const t = ((now / 1700) + i / 3) % 1;
          P.sprite(NOTE, SPOTS.radio + 2 + t * 5, GROUND - 12 - t * 14, Math.sin(t * Math.PI) * 0.9);
        }
      }

      // fumaça da chaminé
      if (sc.unlocked.includes("chamine")) {
        for (let i = 0; i < 3; i++) {
          const t = ((now / 2600) + i / 3) % 1;
          const y = GROUND - (sc.level >= 3 ? 45 : 38) - t * 10;
          P.rect(Math.round(SPOTS.casa + 25 + Math.sin(t * 4) * 2), Math.round(y), 2, 2, Math.sin(t * Math.PI) * 0.55);
        }
      }

      // ---- Steve: chega da porta, fica um tempo e vai embora ----
      const st = steveRef.current;
      if (st && a) {
        const vindo = now - a.startedAt < a.ms * 0.7;
        const alvo = vindo ? lisa.x + 16 : SPOTS.casa + 6;
        const sdx = alvo - st.x;
        if (Math.abs(sdx) > 0.6) st.x += Math.sign(sdx) * Math.min(9 * dt, Math.abs(sdx));
        const parado = Math.abs(sdx) <= 0.6;
        drawFigure(P, parado ? STEVE.armUp : STEVE.idle, st.x, GROUND - (LISA_H - 1), sdx < 0);
      }

      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pickActivity]);

  const next = world?.next;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "min(96vw, 940px)" }}>
      <div style={{ width: "100%", border: "1px solid rgba(var(--accent-rgb),0.18)", borderRadius: 10, overflow: "hidden", background: "rgba(var(--accent-rgb),0.03)" }}>
        <canvas ref={canvasRef} style={{ width: "100%", aspectRatio: `${WW} / ${WH}`, display: "block" }} />
      </div>

      <div style={{ ...mono, fontSize: 11, letterSpacing: 1.5, color: CY, minHeight: 15, textAlign: "center" }}>
        {world ? `A LISA ESTÁ ${label.toUpperCase()}` : "CARREGANDO O QUINTAL…"}
      </div>

      {novas.length > 0 && (
        <div style={{ ...mono, fontSize: 10, letterSpacing: 1, color: GR, textAlign: "center", lineHeight: 1.6 }}>
          ✦ DESDE A SUA ÚLTIMA VISITA ELA CONSTRUIU: {novas.map((n) => n.label).join(", ")}
        </div>
      )}

      {world && (
        <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: 1.5, display: "flex", justifyContent: "space-between", color: "rgba(207,239,251,0.55)" }}>
            <span>{world.xp} pts de convivência</span>
            {next ? <span>falta {next.falta} pra {next.label.toLowerCase()}</span> : <span style={{ color: GR }}>quintal completo</span>}
          </div>
          {next && (
            <div style={{ height: 5, borderRadius: 3, background: "rgba(var(--accent-rgb),0.12)", overflow: "hidden" }}>
              <div style={{ width: `${Math.round(next.progresso * 100)}%`, height: "100%", background: CY }} />
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {WORLD_ITEMS.map((i) => {
              const tem = world.unlocked.includes(i.key);
              return (
                <span
                  key={i.key}
                  title={tem ? i.note : `${i.note} · ${i.xp} pts`}
                  style={{ ...mono, fontSize: 8.5, letterSpacing: 0.5, padding: "3px 7px", borderRadius: 12, border: `1px solid ${tem ? "rgba(123,216,143,0.5)" : "rgba(var(--accent-rgb),0.16)"}`, color: tem ? GR : "rgba(207,239,251,0.35)" }}
                >
                  {tem ? "✓ " : ""}{i.label}
                </span>
              );
            })}
          </div>
          {world.erro && (
            <div style={{ ...mono, fontSize: 8.5, color: OR }} title={world.erro}>
              ⚠ as tabelas de quiz/pair ainda não existem no banco — o quintal só está contando as partidas
            </div>
          )}
          <div style={{ ...mono, fontSize: 8.5, color: "rgba(207,239,251,0.35)", lineHeight: 1.6 }}>
            o quintal cresce com o que você já joga e estuda com ela nos outros modos — não tem moeda separada aqui
          </div>
        </div>
      )}
    </div>
  );
}

/** Desenha uma figura podendo espelhar — as poses são todas viradas pra direita, e sem isso ela
 * andaria pra esquerda de costas. */
function drawFigure(P, rows, ox, oy, flip) {
  if (!flip) return P.sprite(rows, ox, oy);
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++)
      if (rows[r][c] === "#") P.paint(Math.round(ox) + (LISA_W - 1 - c), Math.round(oy) + r, 1);
}
