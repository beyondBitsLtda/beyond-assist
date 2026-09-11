"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import { loadGames } from "@/lib/gameHistory.js";
import {
  BUILD_ACTIVITY, CASA, GRID, PATH_TILES, WORLD_ITEMS,
  availableActivities, houseLevel, nextItem, unlockedItems, worldXp,
} from "@/lib/lisaWorld.js";
import { ARMA, LADRAO, LISA, NOTE, SACO, STEVE, TOOLS, ZUMBI } from "./worldSprites.js";
import { NALA } from "./nalaSprites.js";
import * as A from "./isoArt.js";
import CasaInterior from "./CasaInterior.js";
import { pollWorldSignals, sendWorldSignal } from "@/lib/worldSignals.js";
import {
  GOD_EVENTS, HORDA, MORDIDA_ALCANCE, TIRO_ALCANCE, TIRO_INTERVALO,
  criarInimigos, criarSorteador, passoInimigo, planoDe,
} from "@/lib/worldEvents.js";

// "Mundo da Lisa": o terreno dela, em ISOMÉTRICO, ocupando a tela inteira e rolável. Ela leva a
// vida ali — rega a horta, varre, brinca com a Nala, ouve música, acende a fogueira, recebe o
// Steve. O terreno ganha construções conforme VOCÊ interage com ela nos outros modos (regras e
// mapa em src/lib/lisaWorld.js; desenho em isoArt.js).
//
// Quatro decisões que sustentam isso:
//
// 1. O mundo inteiro é rasterizado UMA VEZ num canvas fora da tela, do tamanho do terreno todo,
//    e a câmera só recorta um pedaço com drawImage. São dezenas de milhares de células acesas,
//    cada uma um roundRect com sombra — refazer isso a cada quadro seria impossível.
//
// 2. Esse canvas é rasterizado num tamanho de célula FIXO (BASE), e o zoom é só uma escala na
//    hora de recortar. Se o zoom mudasse o tamanho da célula, cada passo de pinça obrigaria a
//    redesenhar o terreno inteiro e o gesto travaria no celular. Assim o cache só é refeito
//    quando aparece construção nova, o dia vira noite, ou o estilo muda.
//
// 3. Em isométrico a ordem de desenho é tudo. O cache sai ordenado por profundidade (tx+ty); e
//    como os personagens vão POR CIMA dele, o que estiver na frente deles é redesenhado depois —
//    senão a Lisa aparece em cima da casa ao passar atrás.
//
// 4. A hora é a de verdade do aparelho. De madrugada o terreno fica escuro, com estrelas, o
//    poste aceso e a fogueira acesa — e ela vai olhar as estrelas, que é atividade só da noite.

const BASE = 7;          // tamanho da célula no canvas do mundo (o zoom é escala em cima disso)
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.4;
const LISA_SPEED = 2.6;  // tiles por segundo
const NALA_SPEED = 3.4;
const STEP_MS = 150;
const GAP_MIN_MS = 1600;
const GAP_VAR_MS = 3200;
const SEEN_KEY = "lisaWorld.seenXp";
const ESTILO_KEY = "lisaWorld.estilo";
const POLL_MS = 900;          // o Modo Deus escuta o outro aparelho nesse ritmo
const SPAWN = [5, 28.5];      // por onde as ameaças entram: o portão

const isNight = (h) => h < 6 || h >= 19;
const lerp = (a, b, t) => a + (b - a) * t;
const clampZoom = (z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

export default function LisaWorld({ fullscreen = false }) {
  const [world, setWorld] = useState(null);
  const [novas, setNovas] = useState([]);
  const [label, setLabel] = useState("chegando no terreno…");
  const [zoom, setZoom] = useState(1);
  const [estilo, setEstilo] = useState("bloco"); // "bloco" | "linha"
  const [seguir, setSeguir] = useState(true);
  const [lista, setLista] = useState(false);
  const [estreito, setEstreito] = useState(false);
  const [painel, setPainel] = useState(false);   // painel do Modo Deus
  const [interior, setInterior] = useState(false);
  const [ultimo, setUltimo] = useState(null);    // último evento recebido, pro aviso na tela

  const canvasRef = useRef(null);
  const sceneRef = useRef({ unlocked: [], level: 1, night: isNight(new Date().getHours()), temCarta: false });
  const camRef = useRef({ x: 40, y: 40 });
  const dragRef = useRef(null);
  const ptrsRef = useRef(new Map());
  const pinchRef = useRef(null);
  const seguirRef = useRef(seguir);
  seguirRef.current = seguir;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const estiloRef = useRef(estilo);
  estiloRef.current = estilo;

  const lisaRef = useRef({ tx: 6, ty: 20, targ: [6, 20], pose: "idle", flip: false, moving: false });
  const nalaRef = useRef({ tx: 7, ty: 22, targ: [7, 22], moving: false, flip: false });
  const steveRef = useRef(null);
  const actRef = useRef(null);
  const nextAtRef = useRef(0);
  const bagRef = useRef([]);
  const buildQueueRef = useRef([]);
  const labelRef = useRef("");

  // ---- Modo Deus ----
  const climaRef = useRef(null);     // { tipo, until }
  const horaRef = useRef(null);      // true = noite forçada, false = dia forçado, null = hora real
  const eventoRef = useRef(null);    // o plano de reação em curso
  const inimigosRef = useRef([]);
  const mortesRef = useRef([]);      // baforadas de quem caiu
  const falaRef = useRef(null);      // { texto, until }
  const dentroRef = useRef(false);   // ela está DENTRO da casa
  const armadaRef = useRef(false);
  const tiroRef = useRef(null);      // traçante do disparo
  const proxTiroRef = useRef(0);
  const sorteadoresRef = useRef({});

  // tela estreita: os botões perdem o texto e viram só o ícone. Antes a fileira quebrava em duas
  // linhas no celular e cobria o que a Lisa estava fazendo.
  useEffect(() => {
    const ver = () => setEstreito(window.innerWidth < 640);
    ver();
    // no celular, com zoom 1 só cabe um pedaço do terreno na tela: começa mais afastado, senão
    // a primeira impressão é de estar perdido no meio do mato
    if (window.innerWidth < 640) setZoom(0.72);
    window.addEventListener("resize", ver);
    return () => window.removeEventListener("resize", ver);
  }, []);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(ESTILO_KEY);
      if (salvo === "linha" || salvo === "bloco") setEstilo(salvo);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(ESTILO_KEY, estilo); } catch {}
  }, [estilo]);

  // ---- progresso: o que você já fez de verdade ----
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

      let seen = 0;
      try { seen = Number(localStorage.getItem(SEEN_KEY)) || 0; } catch {}
      const antes = new Set(unlockedItems(seen));
      const recem = WORLD_ITEMS.filter((i) => unlocked.includes(i.key) && !antes.has(i.key));
      try { localStorage.setItem(SEEN_KEY, String(xp)); } catch {}

      setWorld({ xp, unlocked, next: nextItem(xp), erro });
      setNovas(recem);
      buildQueueRef.current = recem.filter((i) => i.tx != null).slice(0, 3);
      sceneRef.current = { unlocked, level: houseLevel(xp), night: isNight(new Date().getHours()), temCarta: recem.length > 0 };
    })();
    return () => { vivo = false; };
  }, []);

  /** Sorteia a próxima coisa que ela vai fazer. Saco embaralhado: passa por todas antes de
   * repetir qualquer uma — mesmo padrão do rádio e das gracinhas da Nala. */
  const pickActivity = useCallback((now) => {
    if (buildQueueRef.current.length) {
      const item = buildQueueRef.current.shift();
      return { ...BUILD_ACTIVITY, label: `construindo: ${item.label.toLowerCase()}`, at: [item.tx + item.w, item.ty + item.d], startedAt: now, phase: "indo" };
    }
    const sc = sceneRef.current;
    if (!bagRef.current.length) {
      const pool = availableActivities(sc.unlocked, sc.night);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      bagRef.current = pool;
    }
    let a = bagRef.current.pop();
    // o saco pode ter sido montado antes de uma construção entrar, ou de o dia virar noite
    while (a && ((a.needs && !sc.unlocked.includes(a.needs)) || (a.night && !sc.night))) a = bagRef.current.pop();
    if (!a) return null;
    const at = a.at || [4 + Math.random() * (GRID - 8), 4 + Math.random() * (GRID - 8)];
    return { ...a, at, startedAt: now, phase: "indo" };
  }, []);

  /** Onde fica cada lugar citado pelos planos de reação. */
  const tileAlvo = useCallback((nome) => {
    if (nome === "casa" || nome === "porta") return [CASA.tx + CASA.w + 0.8, CASA.ty + CASA.d * 0.5];
    const it = WORLD_ITEMS.find((i) => i.key === nome);
    if (!it || it.tx == null || !sceneRef.current.unlocked.includes(nome)) return null;
    return [it.tx + (it.w || 1) + 0.8, it.ty + (it.d || 1) * 0.5];
  }, []);

  const fala = useCallback((grupo, now) => {
    if (!grupo) return;
    const s = (sorteadoresRef.current[grupo] ||= criarSorteador(grupo));
    const texto = s();
    if (texto) falaRef.current = { texto, until: now + 3400 };
  }, []);

  /**
   * Aplica um evento do Modo Deus. Ela LARGA na hora o que estava fazendo — a graça é
   * exatamente essa: você manda chover e ela abandona a horta no meio.
   */
  const aplicarEvento = useCallback((key) => {
    const now = performance.now();
    setUltimo({ key, at: Date.now() });
    if (key === "calma") {
      climaRef.current = null;
      horaRef.current = null;
      eventoRef.current = null;
      inimigosRef.current = [];
      dentroRef.current = false;
      armadaRef.current = false;
      setLabel("voltando ao normal");
      return;
    }
    const ev = GOD_EVENTS.find((e) => e.key === key);
    if (!ev) return;
    if (ev.tipo === "clima") climaRef.current = { tipo: key, until: now + ev.ms };
    if (ev.tipo === "hora") horaRef.current = key === "noite";
    if (ev.tipo === "ameaca") {
      inimigosRef.current = criarInimigos(key, SPAWN, HORDA[key] || 1).map((e) => ({ ...e, nasceEm: now + e.entraEm }));
      armadaRef.current = false;
    }
    actRef.current = null;
    dentroRef.current = false;
    eventoRef.current = { key, passos: planoDe(key), i: -1, passo: null, ate: 0, until: now + (ev.ms || 4000), indo: false };
  }, []);

  // ---- escuta o outro aparelho ----
  useEffect(() => {
    let stop = false;
    let timer = null;
    let since = null;
    let primed = false;
    const loop = async () => {
      try {
        const { now, signals } = await pollWorldSignals(since);
        since = now;
        // a primeira leitura traz o rabo da fila (eventos de antes de eu abrir) — descarta
        if (primed) for (const sig of signals) if (sig.kind === "evento") aplicarEvento(sig.payload?.evento);
        primed = true;
      } catch {
        /* sem rede ou sem tabela: o painel local continua funcionando */
      }
      if (!stop) timer = setTimeout(loop, POLL_MS);
    };
    loop();
    return () => { stop = true; clearTimeout(timer); };
  }, [aplicarEvento]);

  /** Manda pro outro aparelho E aplica aqui: assim funciona com duas telas ou com uma só. */
  const mandar = useCallback((key) => {
    sendWorldSignal("evento", { evento: key });
    aplicarEvento(key);
  }, [aplicarEvento]);

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
    let offScale = 1;

    const makePaint = (c, size, linha, ox = 0, oy = 0) => {
      // no estilo de linha a célula encolhe: o traço fica fino e a malha não vira mancha
      const pad = size * (linha ? 0.46 : 0.16);
      const round = typeof c.roundRect === "function";
      return (gx, gy, alpha = 1) => {
        if (alpha <= 0.02) return;
        const x = (gx - ox) * size + pad / 2;
        const y = (gy - oy) * size + pad / 2;
        c.fillStyle = `rgba(${accent},${alpha})`;
        if (round) { c.beginPath(); c.roundRect(x, y, size - pad, size - pad, (size - pad) * 0.3); c.fill(); }
        else c.fillRect(x, y, size - pad, size - pad);
      };
    };

    /** Tudo que fica parado no terreno, já em ordem de profundidade. */
    const placed = (sc) => {
      const out = [{ key: "casa", item: CASA }];
      for (const it of WORLD_ITEMS) if (sc.unlocked.includes(it.key) && it.tx != null) out.push({ key: it.key, item: it });
      return out.sort((a, b) => (a.item.tx + a.item.ty) - (b.item.tx + b.item.ty));
    };

    const drawObj = (P, key, item, sc, now) => {
      switch (key) {
        case "casa": A.drawCasa(P, item, sc.level, sc.night); break;
        case "horta": A.drawHorta(P, item); break;
        case "arvore1": case "arvore2": case "arvore3": A.drawArvore(P, item); break;
        case "casinha": A.drawCasinha(P, item); break;
        case "varal": A.drawVaral(P, item); break;
        case "banco": A.drawBanco(P, item); break;
        case "correio": A.drawCorreio(P, item, sc.temCarta); break;
        case "poste1": A.drawPoste(P, item, sc.night); break;
        case "radio": A.drawRadio(P, item); break;
        case "portao": A.drawPortao(P, item); break;
        case "flores": A.drawFlores(P, item); break;
        case "mesa": A.drawMesa(P, item); break;
        case "churras": A.drawChurras(P, item); break;
        case "balanco": A.drawBalanco(P, item); break;
        case "poco": A.drawPoco(P, item); break;
        case "fogueira": A.drawFogueira(P, item); break;
        case "oficina": A.drawOficina(P, item); break;
        case "estufa": A.drawEstufa(P, item); break;
        case "piscina": A.drawPiscina(P, item, now); break;
        case "lago": A.drawLago(P, item, now); break;
        case "mirante": A.drawMirante(P, item); break;
        default: break;
      }
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
      if (now - readAt > 500) {
        readAt = now;
        const rs = getComputedStyle(document.documentElement);
        accent = rs.getPropertyValue("--accent-rgb").trim() || accent;
        hex = rs.getPropertyValue("--accent-hex").trim() || hex;
      }
      const sc = sceneRef.current;
      // trocar o rótulo é setState: chamar a cada quadro rerenderizava o componente inteiro 60
      // vezes por segundo à toa
      const dizer = (t) => { if (t !== labelRef.current) { labelRef.current = t; setLabel(t); } };
      // o Modo Deus manda na hora do dia: null = hora de verdade do aparelho
      const noite = horaRef.current ?? sc.night;
      const cena = { ...sc, night: noite };
      const linha = estiloRef.current === "linha";
      const size = BASE * zoomRef.current; // célula na TELA
      ctx.fillStyle = "#03080c";
      ctx.fillRect(0, 0, w, h);

      // ---- o mundo inteiro, rasterizado uma vez só, em tamanho fixo ----
      const key = `${accent}|${sc.unlocked.join(",")}|${sc.level}|${noite}|${sc.temCarta}|${linha}`;
      if (key !== staticKey) {
        staticKey = key;
        offScale = A.WORLD_W * BASE * A.WORLD_H * BASE * 4 < 9e6 ? 2 : 1;
        off.width = Math.round(A.WORLD_W * BASE * offScale);
        off.height = Math.round(A.WORLD_H * BASE * offScale);
        offCtx.setTransform(offScale, 0, 0, offScale, 0, 0);
        offCtx.clearRect(0, 0, A.WORLD_W * BASE, A.WORLD_H * BASE);
        offCtx.shadowBlur = BASE * 1.1;
        offCtx.shadowColor = hex;
        const OP = { linha, paint: makePaint(offCtx, BASE, linha) };
        if (noite) for (let i = 0; i < 90; i++) OP.paint((i * 53) % A.WORLD_W, (i * 29) % 42, 0.3 + 0.2 * Math.sin(i));
        A.drawTerreno(OP, GRID);
        if (sc.unlocked.includes("caminho")) A.drawCaminho(OP, PATH_TILES);
        if (sc.unlocked.includes("cerca")) A.drawCerca(OP, GRID);
        for (const o of placed(sc)) drawObj(OP, o.key, o.item, cena, 0);
        if (sc.unlocked.includes("chamine")) A.drawChamine(OP, CASA, sc.level);
        if (sc.unlocked.includes("antena")) A.drawAntena(OP, CASA, sc.level);
        if (sc.unlocked.includes("solar") && sc.unlocked.includes("oficina")) A.drawSolar(OP, WORLD_ITEMS.find((i) => i.key === "oficina"));
        offCtx.shadowBlur = 0;
      }

      // ---- atividade ----
      const lisa = lisaRef.current;
      const nala = nalaRef.current;
      const ev = eventoRef.current;
      let a = actRef.current;
      if (!ev && !a && now > nextAtRef.current) {
        a = pickActivity(now);
        if (a) {
          actRef.current = a;
          if (a.dentro) lisa.targ = tileAlvo("casa");
          else lisa.targ = a.at;
          dizer(a.label);
        }
      }

      // ---- o plano de reação do Modo Deus ----
      if (ev) {
        const avancar = () => {
          ev.i++;
          let pas = ev.passos[ev.i];
          while (pas && pas.needs && !sc.unlocked.includes(pas.needs)) { ev.i++; pas = ev.passos[ev.i]; }
          ev.passo = pas || null;
          if (!pas) return;
          ev.ate = now + (pas.ms || 0);
          ev.indo = false;
          if (pas.fala) fala(pas.fala, now);
          if (pas.ir) {
            const t = tileAlvo(pas.ir);
            if (t) { lisa.targ = t; ev.indo = true; }
          }
          if (pas.faz === "dentro") dentroRef.current = true;
        };
        if (ev.i < 0) avancar();
        const pas = ev.passo;
        // ela só fica armada quando CHEGA na oficina. Armá-la ao sair fazia com que ela
        // fosse atirando pelo caminho e a horda acabasse antes de a luta começar.
        if (pas?.faz === "pegar-arma" && !lisa.moving) armadaRef.current = true;
        const vivos = inimigosRef.current.filter((e) => e.vivo).length;
        let terminou = false;
        if (!pas) terminou = false;
        else if (ev.indo && lisa.moving) terminou = false;
        else if (pas.faz === "lutar" || pas.faz === "perseguir") terminou = vivos === 0 || now > ev.ate;
        else if (pas.faz === "dentro") terminou = false; // fica lá até o evento acabar
        else terminou = now > ev.ate;
        if (terminou && ev.i < ev.passos.length) avancar();
        // o plano acabou e não sobrou ameaça: encerra na hora em vez de deixar o evento
        // pendurado até o tempo dele estourar (era isso que travava o rótulo em "reagindo")
        const acabou = !ev.passo && ev.i >= ev.passos.length;
        if (now > ev.until || (acabou && vivos === 0 && !climaRef.current)) {
          eventoRef.current = null;
          dentroRef.current = false;
          armadaRef.current = false;
          inimigosRef.current = [];
          nextAtRef.current = now + 1200;
          dizer("voltando ao normal");
        } else if (pas) {
          dizer(
            pas.faz === "lutar" ? `enfrentando os zumbis (${vivos} de pé)`
            : pas.faz === "perseguir" ? "correndo atrás do ladrão"
            : pas.faz === "recolher" ? "tirando a roupa do varal"
            : pas.faz === "segurar" ? "segurando o varal"
            : pas.faz === "dentro" ? "abrigada em casa"
            : pas.faz === "pegar-arma" ? "buscando alguma coisa na oficina"
            : pas.faz === "receber" ? "recebendo o Steve"
            : ev.key === "zumbis" || ev.key === "ladrao" ? "comemorando"
            : ev.key === "chuva" ? "tomando chuva"
            : ev.key === "neve" ? "no meio da neve"
            : ev.key === "vento" ? "no meio do vendaval"
            : "reagindo"
          );
        }
        if (pas?.faz === "receber" && !steveRef.current) {
          steveRef.current = { tx: CASA.tx + CASA.w, ty: CASA.ty + CASA.d, targ: [lisa.tx + 1.6, lisa.ty + 1.6], moving: true, flip: false };
        }
      }

      const walk = (ent, speed) => {
        const dx = ent.targ[0] - ent.tx;
        const dy = ent.targ[1] - ent.ty;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.15) { ent.moving = false; return true; }
        const step = Math.min(speed * dt, dist);
        ent.tx += (dx / dist) * step;
        ent.ty += (dy / dist) * step;
        ent.moving = true;
        ent.flip = dx - dy < 0; // no isométrico, +tx vai pra direita e +ty pra esquerda
        return false;
      };
      const chegou = walk(lisa, LISA_SPEED);
      if (a && chegou && a.phase === "indo") {
        a.phase = "fazendo";
        a.until = now + a.ms;
        a.startedAt = now;
        if (a.key === "steve") steveRef.current = { tx: CASA.tx + CASA.w, ty: CASA.ty + CASA.d, targ: [lisa.tx + 1.6, lisa.ty + 1.6], moving: true, flip: false };
        if (a.dentro) dentroRef.current = true; // chegou na porta: entrou
      }
      if (a?.phase === "fazendo" && now > a.until) {
        actRef.current = null;
        steveRef.current = null;
        dentroRef.current = false;
        nextAtRef.current = now + GAP_MIN_MS + Math.random() * GAP_VAR_MS;
        dizer("dando uma volta pelo terreno");
      }
      const fazEv = eventoRef.current?.passo?.faz;
      lisa.pose = lisa.moving
        ? (Math.floor(now / STEP_MS) % 2 ? "walkA" : "walkB")
        : fazEv === "lutar" && armadaRef.current
        ? "arma"
        : fazEv === "recolher" || fazEv === "segurar"
        ? "work"
        : fazEv === "receber"
        ? "armUp"
        : a?.phase === "fazendo"
        ? (a.sit ? "sit" : a.tool ? "work" : a.key === "steve" || a.key === "nala" ? "armUp" : "idle")
        : "idle";

      const brincando = a?.key === "nala" && a.phase === "fazendo";
      // com ameaça no terreno a Nala larga tudo e vai pra cima do mais próximo
      const ameaca = inimigosRef.current.find((e) => e.vivo && now >= e.nasceEm);
      nala.targ = ameaca
        ? [ameaca.tx, ameaca.ty]
        : brincando
        ? [lisa.tx + 2.5 + Math.sin(now / 1400) * 2.5, lisa.ty + 2.5 + Math.cos(now / 1100) * 2.5]
        : [lisa.tx - 1.6, lisa.ty + 1.6];
      // e ela persegue o ladrão de perto
      if (eventoRef.current?.passo?.faz === "perseguir" && ameaca) lisa.targ = [ameaca.tx, ameaca.ty];
      walk(nala, brincando ? NALA_SPEED * 1.4 : NALA_SPEED);

      // ---- as ameaças ----
      const inimigos = inimigosRef.current;
      if (inimigos.length) {
        const alvoLisa = [lisa.tx, lisa.ty];
        for (const e of inimigos) {
          if (!e.vivo || now < e.nasceEm) continue;
          if (e.tipo === "ladrao") {
            // vai até a casa, "leva" alguma coisa e foge pelo portão
            if (!e.fugindo) {
              const porta = tileAlvo("casa");
              if (passoInimigo(e, porta, dt, SPAWN)) { e.fugindo = true; e.levou = true; }
            } else {
              passoInimigo(e, alvoLisa, dt, SPAWN);
              if (Math.hypot(e.tx - SPAWN[0], e.ty - SPAWN[1]) < 1.2) e.vivo = false;
            }
            // quem pega o ladrão é quem chegar perto: ela ou a Nala
            const perto = Math.min(Math.hypot(e.tx - lisa.tx, e.ty - lisa.ty), Math.hypot(e.tx - nala.tx, e.ty - nala.ty));
            if (perto < 1.5) { e.vivo = false; mortesRef.current.push({ tx: e.tx, ty: e.ty, until: now + 800 }); }
          } else {
            passoInimigo(e, alvoLisa, dt, SPAWN);
          }
        }
        // ela atira, se tiver ido buscar a arma
        if (armadaRef.current && now > proxTiroRef.current) {
          let alvo = null;
          let melhor = TIRO_ALCANCE;
          for (const e of inimigos) {
            if (!e.vivo || now < e.nasceEm) continue;
            const d = Math.hypot(e.tx - lisa.tx, e.ty - lisa.ty);
            if (d < melhor) { melhor = d; alvo = e; }
          }
          if (alvo) {
            alvo.vida--;
            proxTiroRef.current = now + TIRO_INTERVALO;
            tiroRef.current = { de: [lisa.tx, lisa.ty], para: [alvo.tx, alvo.ty], until: now + 130 };
            if (alvo.vida <= 0) { alvo.vivo = false; mortesRef.current.push({ tx: alvo.tx, ty: alvo.ty, until: now + 800 }); }
          }
        }
        // a Nala morde quem chegar perto dela
        for (const e of inimigos) {
          if (!e.vivo || now < e.nasceEm) continue;
          if (Math.hypot(e.tx - nala.tx, e.ty - nala.ty) < MORDIDA_ALCANCE && now > (e.proxMordida || 0)) {
            e.proxMordida = now + 2000; // a Nala ajuda, mas não resolve sozinha
            e.vida--;
            if (e.vida <= 0) { e.vivo = false; mortesRef.current.push({ tx: e.tx, ty: e.ty, until: now + 800 }); }
          }
        }
      }

      const st = steveRef.current;
      if (st && a) {
        const indo = now - a.startedAt < a.ms * 0.75;
        st.targ = indo ? [lisa.tx + 1.6, lisa.ty + 1.6] : [CASA.tx + CASA.w, CASA.ty + CASA.d];
        walk(st, 2.2);
      }

      // ---- câmera ----
      const viewW = w / size;
      const viewH = h / size;
      const cam = camRef.current;
      if (seguirRef.current) {
        const p = A.iso(lisa.tx, lisa.ty);
        cam.x = lerp(cam.x, p.x - viewW / 2, 1 - Math.exp(-dt / 0.35));
        cam.y = lerp(cam.y, p.y - viewH / 2, 1 - Math.exp(-dt / 0.35));
      }
      cam.x = Math.max(0, Math.min(Math.max(0, A.WORLD_W - viewW), cam.x));
      cam.y = Math.max(0, Math.min(Math.max(0, A.WORLD_H - viewH), cam.y));

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        off,
        cam.x * BASE * offScale, cam.y * BASE * offScale,
        viewW * BASE * offScale, viewH * BASE * offScale,
        0, 0, w, h
      );

      // ---- atores e partículas, por cima ----
      ctx.shadowBlur = size * 1.1;
      ctx.shadowColor = hex;
      const P = { linha, paint: makePaint(ctx, size, linha, cam.x, cam.y) };
      /**
       * Sombra no chão antes do personagem. Não é enfeite: sem ela quem anda some no meio do
       * terreno, porque a silhueta tem o MESMO brilho das construções e a grama atrás é densa.
       * A mancha escura abre um buraco no fundo e ainda assenta a figura no chão.
       */
      const sombra = (p, raio) => {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(3,8,12,0.82)";
        ctx.beginPath();
        ctx.ellipse((p.x - cam.x) * size, (p.y - cam.y) * size, raio * size, raio * size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      /**
       * `contorno` desenha a MESMA silhueta em escuro, deslocada uma célula pros quatro lados,
       * antes da figura. Sem isso quem anda some quando passa na frente de uma construção clara:
       * a silhueta tem o mesmo brilho do cenário e some dentro dele. Fica só pros personagens —
       * a horda inteira com contorno custaria caro à toa.
       */
      const put = (rows, p, flip, contorno = false) => {
        sombra(p, rows[0].length * 0.42);
        const ox = Math.round(p.x - rows[0].length / 2);
        const oy = Math.round(p.y - (rows.length - 1));
        const col = (c, r) => ox + (flip ? rows[r].length - 1 - c : c);
        if (contorno) {
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(3,8,12,0.92)";
          for (let r = 0; r < rows.length; r++)
            for (let c = 0; c < rows[r].length; c++) {
              if (rows[r][c] !== "#") continue;
              const gx = col(c, r);
              const gy = oy + r;
              for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
                ctx.fillRect((gx + dx - cam.x) * size, (gy + dy - cam.y) * size, size, size);
            }
          ctx.restore();
        }
        for (let r = 0; r < rows.length; r++)
          for (let c = 0; c < rows[r].length; c++)
            if (rows[r][c] === "#") P.paint(col(c, r), oy + r, 1);
      };

      const pn = A.iso(nala.tx, nala.ty);
      put(nala.moving ? (Math.floor(now / 110) % 2 ? NALA.runA : NALA.runB) : Math.floor(now / 420) % 2 ? NALA.wag : NALA.idle, pn, nala.flip, true);

      const pl = A.iso(lisa.tx, lisa.ty);
      // dentro de casa ela não aparece no terreno — o que aparece é a janela acesa
      if (!dentroRef.current) put(LISA[lisa.pose] || LISA.idle, pl, lisa.flip, true);
      else {
        const w1 = A.iso(CASA.tx + CASA.w * 0.45, CASA.ty + CASA.d);
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) P.paint(Math.round(w1.x - 4 + i), Math.round(w1.y - 11 - j + Math.round(i / 2)), 1);
      }
      // a arminha na mão, enquanto está armada
      if (!dentroRef.current && armadaRef.current && !lisa.moving) {
        const hx = Math.round(pl.x + (lisa.flip ? -9 : 5));
        for (let r = 0; r < ARMA.length; r++)
          for (let c = 0; c < ARMA[r].length; c++)
            if (ARMA[r][c] === "#") P.paint(hx + c, Math.round(pl.y - 12 + r), 1);
      }
      if (a?.tool && a.phase === "fazendo") {
        const hx = Math.round(pl.x + (lisa.flip ? -8 : 4));
        const rows = TOOLS[a.tool];
        for (let r = 0; r < rows.length; r++)
          for (let c = 0; c < rows[r].length; c++)
            if (rows[r][c] === "#") P.paint(hx + c, Math.round(pl.y - 8 + r), 1);
        if (a.key === "regar" || a.key === "flores")
          for (let i = 0; i < 4; i++) {
            const t = ((now / 500) + i / 4) % 1;
            P.paint(Math.round(hx + 2 + t * 2), Math.round(pl.y - 4 + t * 4), 0.9 - t * 0.4);
          }
      }
      if (st) put(st.moving ? STEVE.idle : STEVE.armUp, A.iso(st.tx, st.ty), st.flip, true);

      // ---- ameaças, disparo e quem caiu ----
      for (const e of inimigosRef.current) {
        if (!e.vivo || now < e.nasceEm) continue;
        const pe = A.iso(e.tx, e.ty);
        const rows = e.tipo === "ladrao"
          ? LADRAO.walk
          : Math.floor(now / 220) % 2 ? ZUMBI.walkA : ZUMBI.walkB;
        put(rows, pe, e.flip, e.tipo === "ladrao");
        if (e.tipo === "ladrao" && e.levou)
          for (let r = 0; r < SACO.length; r++)
            for (let c = 0; c < SACO[r].length; c++)
              if (SACO[r][c] === "#") P.paint(Math.round(pe.x) + 6 + c, Math.round(pe.y) - 14 + r, 0.9);
      }
      if (tiroRef.current) {
        if (now > tiroRef.current.until) tiroRef.current = null;
        else {
          const a1 = A.iso(tiroRef.current.de[0], tiroRef.current.de[1]);
          const a2 = A.iso(tiroRef.current.para[0], tiroRef.current.para[1]);
          const n = Math.max(1, Math.round(Math.hypot(a2.x - a1.x, a2.y - a1.y)));
          for (let i = 0; i <= n; i += 2)
            P.paint(Math.round(a1.x + (a2.x - a1.x) * (i / n)), Math.round(a1.y - 12 + (a2.y - 12 - a1.y + 12) * (i / n)), 0.95);
        }
      }
      mortesRef.current = mortesRef.current.filter((m) => now < m.until);
      for (const m of mortesRef.current) {
        const pm = A.iso(m.tx, m.ty);
        const t = 1 - (m.until - now) / 800;
        for (let k = 0; k < 7; k++) {
          const ang = (k / 7) * Math.PI * 2;
          P.paint(Math.round(pm.x + Math.cos(ang) * t * 9), Math.round(pm.y - 6 + Math.sin(ang) * t * 5), 1 - t);
        }
      }

      // o que estiver NA FRENTE deles é redesenhado — senão ela aparece em cima da casa
      // Redesenhar quem está na frente deles custa caro: cada célula é um roundRect COM sombra,
      // e uma casa sozinha são centenas delas. Aqui o brilho sai (são só tapumes, ninguém olha
      // pra eles) e no máximo dois objetos entram — foi isso que devolveu o quadro a 60fps.
      const frente = Math.min(lisa.tx + lisa.ty, nala.tx + nala.ty);
      ctx.shadowBlur = 0;
      let tapumes = 0;
      for (const o of placed(sc)) {
        if (tapumes >= 2) break;
        if (o.item.tx + o.item.ty <= frente) continue;
        const p = A.iso(o.item.tx, o.item.ty + (o.item.d || 1));
        if (Math.abs(p.x - pl.x) > 46 || Math.abs(p.y - pl.y) > 40) continue;
        drawObj(P, o.key, o.item, cena, now);
        tapumes++;
      }
      ctx.shadowBlur = size * 1.1;

      // ---- partículas ----
      if (sc.unlocked.includes("fogueira")) {
        const f = WORLD_ITEMS.find((i) => i.key === "fogueira");
        const c = A.iso(f.tx + f.w / 2, f.ty + f.d / 2);
        for (let i = 0; i < 5; i++) {
          const t = ((now / 900) + i / 5) % 1;
          P.paint(Math.round(c.x + Math.sin(t * 9 + i) * 2), Math.round(c.y - 1 - t * 10), (1 - t) * (sc.night ? 1 : 0.45));
        }
      }
      if (sc.unlocked.includes("chamine")) {
        const cp = A.iso(CASA.tx + CASA.w - 1.2, CASA.ty + 0.8, A.casaAltura(sc.level) + 10);
        for (let i = 0; i < 4; i++) {
          const t = ((now / 2800) + i / 4) % 1;
          P.paint(Math.round(cp.x + Math.sin(t * 5) * 3), Math.round(cp.y - 2 - t * 14), Math.sin(t * Math.PI) * 0.5);
        }
      }
      if (a?.key === "musica" && a.phase === "fazendo" && sc.unlocked.includes("radio")) {
        const r = WORLD_ITEMS.find((i) => i.key === "radio");
        const c = A.iso(r.tx + 0.5, r.ty + 0.5);
        for (let i = 0; i < 3; i++) {
          const t = ((now / 1700) + i / 3) % 1;
          const oy = Math.round(c.y - 12 - t * 16);
          for (let rr = 0; rr < NOTE.length; rr++)
            for (let cc = 0; cc < NOTE[rr].length; cc++)
              if (NOTE[rr][cc] === "#") P.paint(Math.round(c.x + 3 + t * 4) + cc, oy + rr, Math.sin(t * Math.PI) * 0.9);
        }
      }

      // ---- clima: desenhado em coordenada de TELA, não do mundo. Chuva presa ao terreno
      // rolaria junto com a câmera, o que não é o que chuva faz. ----
      const clima = climaRef.current;
      if (clima && now > clima.until) climaRef.current = null;
      if (clima && now <= clima.until) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(${accent},0.55)`;
        const n = clima.tipo === "neve" ? 90 : 150;
        for (let i = 0; i < n; i++) {
          const seed = i * 97.13;
          if (clima.tipo === "chuva") {
            const x = (seed * 7 + now * 0.22) % (w + 60) - 30;
            const y = (seed * 13 + now * 1.25) % (h + 40);
            ctx.fillRect(x, y, 1.5, 7);
          } else if (clima.tipo === "neve") {
            const x = (seed * 11 + now * 0.05 + Math.sin(now / 900 + i) * 22) % (w + 40) - 20;
            const y = (seed * 17 + now * 0.16) % (h + 20);
            ctx.fillRect(x, y, 2.5, 2.5);
          } else {
            const x = (seed * 19 + now * 1.9) % (w + 120) - 60;
            const y = (seed * 23) % h;
            ctx.fillRect(x, y, 16, 1.2);
          }
        }
        ctx.shadowBlur = size * 1.1;
      }

      // ---- o que ela está dizendo, num balão em cima dela ----
      if (falaRef.current && now > falaRef.current.until) falaRef.current = null;
      if (falaRef.current && !dentroRef.current) {
        ctx.shadowBlur = 0;
        const texto = falaRef.current.texto;
        ctx.font = `${Math.max(10, Math.round(size * 1.7))}px 'JetBrains Mono',monospace`;
        const tw = ctx.measureText(texto).width;
        const bx = (pl.x - cam.x) * size - tw / 2 - 8;
        const by = (pl.y - cam.y) * size - 23 * size - 26;
        ctx.fillStyle = "rgba(4,10,14,0.92)";
        ctx.beginPath();
        ctx.roundRect(bx, by, tw + 16, 24, 6);
        ctx.fill();
        ctx.strokeStyle = `rgba(${accent},0.5)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#eafcff";
        ctx.fillText(texto, bx + 8, by + 16);
      }

      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pickActivity, tileAlvo, fala]);

  // ---- arrastar pra rolar, pinça pra aproximar ----
  const dist2 = () => {
    const [a, b] = [...ptrsRef.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const onDown = (e) => {
    // capturar o ponteiro pode lançar (ponteiro já solto, ou evento sintético): se lançar aqui,
    // o resto do handler não roda e o arrasto/clique nunca começa
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrsRef.current.size === 2) {
      pinchRef.current = { d: dist2(), zoom: zoomRef.current };
      dragRef.current = null; // arrastar e dar pinça ao mesmo tempo dá tranco
    } else {
      dragRef.current = { x: e.clientX, y: e.clientY, cam: { ...camRef.current } };
    }
  };
  const onMove = (e) => {
    if (!ptrsRef.current.has(e.pointerId)) return;
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrsRef.current.size >= 2 && pinchRef.current) {
      setZoom(clampZoom(pinchRef.current.zoom * (dist2() / pinchRef.current.d)));
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) setSeguir(false);
    camRef.current.x = d.cam.x - (e.clientX - d.x) / (BASE * zoomRef.current);
    camRef.current.y = d.cam.y - (e.clientY - d.y) / (BASE * zoomRef.current);
  };
  const onUp = (e) => {
    const d = dragRef.current;
    // clique curto (não arrasto) em cima da casa, com ela dentro: abre o interior
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && dentroRef.current) {
      const r = e.currentTarget.getBoundingClientRect();
      const size = BASE * zoomRef.current;
      const cx = camRef.current.x + (e.clientX - r.left) / size;
      const cy = camRef.current.y + (e.clientY - r.top) / size;
      const cantos = [
        A.iso(CASA.tx, CASA.ty), A.iso(CASA.tx + CASA.w, CASA.ty),
        A.iso(CASA.tx + CASA.w, CASA.ty + CASA.d), A.iso(CASA.tx, CASA.ty + CASA.d),
      ];
      const xs = cantos.map((c) => c.x);
      const ys = cantos.map((c) => c.y);
      const alto = A.casaAltura(sceneRef.current.level) + 10;
      if (cx >= Math.min(...xs) && cx <= Math.max(...xs) && cy >= Math.min(...ys) - alto && cy <= Math.max(...ys)) setInterior(true);
    }
    ptrsRef.current.delete(e.pointerId);
    if (ptrsRef.current.size < 2) pinchRef.current = null;
    if (ptrsRef.current.size === 0) dragRef.current = null;
  };
  const onWheel = (e) => {
    setSeguir(false);
    setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  };

  const next = world?.next;
  // botão com área de toque de verdade: os antigos tinham ~24px de altura e no celular não dava
  // pra acertar o zoom
  const btn = (ativo = false) => ({
    ...mono, fontSize: 9.5, letterSpacing: 1, minWidth: 38, height: 36, padding: estreito ? "0 9px" : "0 12px",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    borderRadius: 8, border: `1px solid ${ativo ? CY : "rgba(var(--accent-rgb),0.28)"}`,
    background: ativo ? "rgba(var(--accent-rgb),0.16)" : "rgba(4,10,14,0.82)", color: "#eafcff", cursor: "pointer",
  });
  const shadow = { textShadow: "0 0 8px rgba(0,0,0,0.95)" };

  return (
    <div
      style={{
        position: "relative", width: "100%", minHeight: 0, overflow: "hidden",
        flex: fullscreen ? 1 : "none",
        height: fullscreen ? undefined : "min(70vh, 560px)",
        borderRadius: fullscreen ? 0 : 10,
        border: fullscreen ? "none" : "1px solid rgba(var(--accent-rgb),0.18)",
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "grab" }}
      />

      {/* Barra de cima: rótulo e botões no MESMO flex. Antes eram duas caixas soltas em absolute
          e, no celular, a fileira de botões quebrava em duas linhas e cobria o texto. Com
          `flex:1, minWidth:0` o rótulo corta com reticências em vez de empurrar os botões. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", pointerEvents: "none" }}>
        <div style={{ ...mono, fontSize: estreito ? 9 : 10.5, letterSpacing: 1.2, color: CY, flex: 1, minWidth: 0, paddingTop: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...shadow }}>
          {world ? `A LISA ESTÁ ${label.toUpperCase()}` : "CARREGANDO O TERRENO…"}
        </div>
        <div style={{ display: "flex", gap: 5, flex: "none", pointerEvents: "auto" }}>
          <button onClick={() => setEstilo((v) => (v === "bloco" ? "linha" : "bloco"))} style={btn(estilo === "linha")} title="alterna entre volume preenchido e esquema de linhas">
            {estilo === "linha" ? "◱" : "◧"}{estreito ? "" : estilo === "linha" ? " LINHA" : " BLOCO"}
          </button>
          <button onClick={() => setSeguir((v) => !v)} style={btn(seguir)} title="a câmera acompanha a Lisa; arrastar solta a câmera">
            {seguir ? "◉" : "○"}{estreito ? "" : seguir ? " SEGUINDO" : " LIVRE"}
          </button>
          <button onClick={() => { setSeguir(false); setZoom((z) => clampZoom(z / 1.25)); }} style={btn()} title="afastar">−</button>
          <button onClick={() => { setSeguir(false); setZoom((z) => clampZoom(z * 1.25)); }} style={btn()} title="aproximar">+</button>
          <button onClick={() => { setPainel((v) => !v); setLista(false); }} style={btn(painel)} title="Modo Deus: manda chuva, zumbis e o Steve — de qualquer aparelho">
            ⚡{estreito ? "" : " MODO DEUS"}
          </button>
          <button onClick={() => { setLista((v) => !v); setPainel(false); }} style={btn(lista)} title="construções">{lista ? "✕" : "☰"}</button>
        </div>
      </div>

      {world && (
        <div style={{ position: "absolute", left: 12, bottom: 10, right: 12, display: "flex", flexDirection: "column", gap: 4, pointerEvents: "none" }}>
          {novas.length > 0 && (
            <div style={{ ...mono, fontSize: estreito ? 8.5 : 9.5, letterSpacing: 1, color: GR, maxHeight: 30, overflow: "hidden", ...shadow }}>
              ✦ DESDE A SUA ÚLTIMA VISITA ELA CONSTRUIU: {novas.map((n) => n.label).join(", ")}
            </div>
          )}
          {label.includes("casa") && (
            <div style={{ ...mono, fontSize: estreito ? 8.5 : 9.5, letterSpacing: 1, color: CY, ...shadow }}>
              🏠 ELA ESTÁ DENTRO — TOQUE NA CASA PRA VER
            </div>
          )}
          <div style={{ ...mono, fontSize: estreito ? 8.5 : 9, letterSpacing: 1, display: "flex", gap: 12, flexWrap: "wrap", color: "rgba(207,239,251,0.72)", ...shadow }}>
            <span>{world.xp} pts de convivência</span>
            {next ? <span>falta {next.falta} pra {next.label.toLowerCase()}</span> : <span style={{ color: GR }}>terreno completo</span>}
            <span style={{ color: "rgba(207,239,251,0.42)" }}>{world.unlocked.length}/{WORLD_ITEMS.length}</span>
          </div>
          {next && (
            <div style={{ height: 4, maxWidth: 420, borderRadius: 3, background: "rgba(0,0,0,0.6)", overflow: "hidden" }}>
              <div style={{ width: `${Math.round(next.progresso * 100)}%`, height: "100%", background: CY }} />
            </div>
          )}
          {world.erro && (
            <div style={{ ...mono, fontSize: 8.5, color: OR, ...shadow }} title={world.erro}>
              ⚠ as tabelas de quiz/pair ainda não existem no banco — o terreno só está contando as partidas
            </div>
          )}
        </div>
      )}

      {painel && (
        <div style={{ position: "absolute", top: 52, right: 10, width: estreito ? "min(86vw, 300px)" : 300, maxHeight: "74%", overflowY: "auto", padding: 12, borderRadius: 10, border: `1px solid ${CY}`, background: "rgba(4,10,14,0.97)", display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: CY }}>⚡ MODO DEUS</div>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: "rgba(207,239,251,0.7)" }}>
            Abra o mundo noutro aparelho e mande daqui — a ação acontece lá. Ela larga o que estiver
            fazendo e reage de verdade.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {GOD_EVENTS.map((e) => (
              <button
                key={e.key}
                onClick={() => mandar(e.key)}
                style={{
                  ...mono, fontSize: 9.5, letterSpacing: 0.5, padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                  textAlign: "left", lineHeight: 1.4, gridColumn: e.key === "calma" ? "span 2" : undefined,
                  border: `1px solid ${e.tipo === "ameaca" ? OR : e.key === "calma" ? "rgba(123,216,143,0.5)" : "rgba(var(--accent-rgb),0.3)"}`,
                  background: "rgba(var(--accent-rgb),0.06)", color: "#eafcff",
                }}
              >
                {e.icon} {e.label}
              </button>
            ))}
          </div>
          {ultimo && (
            <div style={{ ...mono, fontSize: 8.5, color: "rgba(207,239,251,0.5)" }}>
              último: {GOD_EVENTS.find((e) => e.key === ultimo.key)?.label || ultimo.key}
            </div>
          )}
          <div style={{ ...mono, fontSize: 8.5, color: "rgba(207,239,251,0.35)", lineHeight: 1.6 }}>
            os eventos viajam pela mesma fila do jogo do disco — não precisou de tabela nova
          </div>
        </div>
      )}

      {interior && (
        <CasaInterior unlocked={world?.unlocked || []} night={horaRef.current ?? sceneRef.current.night} onClose={() => setInterior(false)} />
      )}

      {lista && world && (
        <div style={{ position: "absolute", top: 52, right: 10, width: estreito ? "min(78vw, 240px)" : 240, maxHeight: "66%", overflowY: "auto", padding: 10, borderRadius: 8, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "rgba(4,10,14,0.96)", display: "flex", flexDirection: "column", gap: 3 }}>
          {WORLD_ITEMS.map((i) => {
            const tem = world.unlocked.includes(i.key);
            return (
              <div key={i.key} style={{ ...mono, fontSize: 8.5, display: "flex", justifyContent: "space-between", gap: 8, color: tem ? GR : "rgba(207,239,251,0.4)" }} title={i.note}>
                <span>{tem ? "✓ " : "· "}{i.label}</span>
                <span style={{ opacity: 0.6 }}>{i.xp}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
