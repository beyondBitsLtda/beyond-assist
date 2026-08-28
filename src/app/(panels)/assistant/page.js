"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { cleanForSpeech } from "@/lib/cleanForSpeech.js";
import { useLog } from "@/components/shell/LogProvider.js";
import { CY, OR, GR, PU, mono, meterFor, dotColor } from "@/lib/theme.js";
import { TTS_VOICES } from "@/lib/ttsVoices.js";
import { pickBrowserVoice } from "@/lib/browserVoice.js";
import { useIsMobile } from "@/lib/useIsMobile.js";
import { ACCENT_THEMES, DEFAULT_ACCENT, applyAccentTheme } from "@/lib/accentThemes.js";
import { getDeviceId, matchNavCommand } from "@/lib/deviceId.js";
import { runFullSync } from "@/lib/sync.js";

// carregado sob demanda (three.js + o modelo glTF pesam ~12MB) — só baixa se a pessoa
// realmente ligar a Visão 3D; desktop-only por decisão do usuário, nunca entra no bundle mobile.
const LisaAvatar3D = dynamic(() => import("@/components/panels/LisaAvatar3D.js"), {
  ssr: false,
  loading: () => null,
});

const MODE_META = {
  idle: { label: "IDLE", sub: "awaiting command", color: CY },
  listening: { label: "LISTENING", sub: "retrieving context", color: GR },
  speaking: { label: "SPEAKING", sub: "streaming response", color: OR },
};

const TASKS_SCOPE = "__tasks__";
const THOUGHTS_SCOPE = "__thoughts__";
const SENTINEL_SCOPE = "__sentinel__";

// Tamanho mínimo (em caracteres) pro primeiro pedaço da resposta antes de mandar pro TTS.
// Ainda são só 2 chamadas de TTS por resposta no total (cabeça + resto) — baixar esse
// número não aumenta chamada nenhuma, só faz a cabeça sair mais cedo (a fala começa assim
// que a 1ª frase completa passar desse tamanho, em vez de esperar várias frases se juntarem).
const TTS_HEAD_CHARS = 40;

/** Corta um buffer de texto nas últimas frases completas (terminadas em . ! ? ou quebra de linha). */
function splitSentences(text) {
  const matches = text.match(/[^.!?\n]+[.!?\n]+/g);
  if (!matches) return { sentences: [], rest: text };
  const consumed = matches.join("").length;
  return { sentences: matches.map((s) => s.trim()).filter(Boolean), rest: text.slice(consumed) };
}


export default function AssistantPage() {
  const { logs, addLog } = useLog();
  const [mode, setMode] = useState("idle");
  const [cards, setCards] = useState([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);   // mic ativo (STT)
  const [voiceOn, setVoiceOn] = useState(true);         // ler respostas em voz alta (TTS)
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [geminiVoiceEnabled, setGeminiVoiceEnabled] = useState(true); // tentar a voz do Gemini? (desligado = só navegador)
  const [geminiVoiceStatus, setGeminiVoiceStatus] = useState(null);   // null=não testada ainda · true=ok · false=falhou (última tentativa real)
  // voz do Gemini escolhida — guardada no navegador (não temos como ouvir as 30 vozes daqui
  // pra saber quais soam femininas; teste e escolha a que preferir).
  const [voiceName, setVoiceName] = useState("Kore");
  const [mobileTab, setMobileTab] = useState("visualizer"); // só usado no mobile (ver globals.css): "logs" | "visualizer" | "context"

  // escopo do assistente: "painel" (board/tarefas/pensamentos específico) ou "geral" (tudo + web)
  const [scopeMode, setScopeMode] = useState("panel");
  const [scopePanel, setScopePanel] = useState("Quarto de Guerra");
  const [panelOptions, setPanelOptions] = useState(["Quarto de Guerra"]);

  // projeto do Sentinela selecionado manualmente (só usado quando o escopo é "Chamados (Sentinela)") —
  // sem isso o assistente não sabe dizer de qual projeto de teste está falando, a menos que o
  // nome do projeto apareça literalmente na pergunta.
  const [sentinelProjectId, setSentinelProjectId] = useState("all");
  const [sentinelProjects, setSentinelProjects] = useState([]);

  // Modo Persona: liga a personalidade descrita em persona.md (raiz do repo) por cima das
  // respostas — desligado por padrão (tom direto/neutro de sempre).
  const [personaMode, setPersonaMode] = useState(false);

  // Visão do avatar: "traditional" (visualizador de onda de sempre) ou "3d" (corpo/modelo 3D,
  // ver LisaAvatar3D.js) — DESKTOP-ONLY de propósito (o toggle só existe no branch desktop
  // deste componente, então nunca aparece nem carrega no mobile).
  const [avatarView, setAvatarView] = useState("traditional");

  // ---- mobile: tela própria, só o Assistente (ver Shell.js) ----
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState("chat"); // "chat" | "voice"
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  // no mobile o Assistente é tela cheia (sem Sidebar/Topbar — ver Shell.js), então essas são
  // as ÚNICAS abas que existem nesse modo: sem esse atalho, não tem como chegar nos outros
  // painéis (Dashboard, AR, Quarto de Guerra, etc.) a partir do celular.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [messages, setMessages] = useState([]); // histórico visível no modo chat (não é o mesmo que historyRef, que só guarda o último turno pra ações)
  const [accentName, setAccentName] = useState(DEFAULT_ACCENT.name);
  const [ingesting, setIngesting] = useState(false);
  const [autoSync, setAutoSync] = useState(null);
  const messagesEndRef = useRef(null);

  const recognitionRef = useRef(null);
  const answerRef = useRef("");
  // última pergunta+cards e ação proposta ainda não confirmada — mandados de volta pro
  // backend a cada pergunta nova, pra ele saber a que card "reprograme pra amanhã" se refere
  // e se a mensagem atual está confirmando/cancelando uma ação (ver /api/ask).
  const historyRef = useRef(null);
  const pendingActionRef = useRef(null);
  const audioRef = useRef(null);
  const currentAudioResolveRef = useRef(null);

  // fila de TTS em 2 pedaços (cabeça + resto): a cabeça sai assim que atinge um tamanho
  // mínimo, o resto sai quando a resposta termina — só 1-2 chamadas por resposta, tocadas em ordem.
  const speechBufferRef = useRef("");
  const speechQueueRef = useRef(Promise.resolve());
  const speechGenRef = useRef(0); // pergunta nova invalida pedaços pendentes de uma pergunta antiga
  // voz "travada" pra resposta atual: null = ainda não decidiu, "gemini" ou "browser".
  // A cabeça decide; se cair pro navegador, o resto desta MESMA resposta continua no
  // navegador (nunca alterna de novo dentro da mesma resposta) — só 2 pedaços agora,
  // então isso não tem mais o problema de corrida que tinha por frase.
  const speechEngineRef = useRef(null);

  const canvasRef = useRef(null);
  const modeRef = useRef(mode);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  // lista de boards pro seletor de escopo "Este painel" (Quarto de Guerra + os demais indexados)
  useEffect(() => {
    let alive = true;
    fetch("/api/boards-overview")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.ok) return;
        setPanelOptions(["Quarto de Guerra", ...(d.boards || []).map((b) => b.board)]);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // carrega a voz escolhida antes (se houver) — cada navegador guarda a sua
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("voiceName");
    if (saved) setVoiceName(saved);
  }, []);

  // carrega se o Modo Persona estava ligado — cada navegador guarda o seu
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPersonaMode(localStorage.getItem("personaMode") === "1");
  }, []);

  const togglePersonaMode = useCallback(() => {
    setPersonaMode((v) => {
      const next = !v;
      if (typeof window !== "undefined") localStorage.setItem("personaMode", next ? "1" : "0");
      return next;
    });
  }, []);

  // ---- Modo Observância: a Lisa "vê" pela câmera (getUserMedia) e pode descrever o que
  // enxerga — postura, cor de roupa, gesto com a mão, expressão — junto com a resposta de
  // texto normal (mesma pergunta ao Gemini, agora com uma foto anexada). DESLIGADO por
  // padrão e de propósito SEM localStorage: é câmera apontada pra você, então cada sessão
  // pede de novo — não fica "ligado sozinho" na próxima vez que abrir o app. Não manda vídeo
  // contínuo nem guarda nada — só tira 1 foto no instante de cada pergunta, manda pro Gemini
  // responder, e descarta (não é salva em lugar nenhum, nem local nem no Supabase).
  const [observanceMode, setObservanceMode] = useState(false);
  const [observanceError, setObservanceError] = useState(null);
  const observanceVideoRef = useRef(null);
  const observanceStreamRef = useRef(null);

  useEffect(() => {
    if (!observanceMode) {
      observanceStreamRef.current?.getTracks().forEach((t) => t.stop());
      observanceStreamRef.current = null;
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setObservanceError("este navegador não dá acesso à câmera");
      setObservanceMode(false);
      return;
    }
    let cancelled = false;
    setObservanceError(null);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        observanceStreamRef.current = stream;
        if (observanceVideoRef.current) {
          observanceVideoRef.current.srcObject = stream;
          observanceVideoRef.current.play().catch(() => {});
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setObservanceError(err?.name === "NotAllowedError" ? "permissão de câmera negada" : (err?.message || "não consegui acessar a câmera"));
        setObservanceMode(false);
      });
    return () => {
      cancelled = true;
      observanceStreamRef.current?.getTracks().forEach((t) => t.stop());
      observanceStreamRef.current = null;
    };
  }, [observanceMode]);

  // tira a foto ATUAL da câmera (só no instante da pergunta, nunca antes) — reduzida pra no
  // máx. 640px no lado maior, o bastante pra contar dedos/ver cor de roupa sem gastar token
  // à toa com resolução alta que o Gemini nem precisa.
  const captureObservanceFrame = useCallback(() => {
    const v = observanceVideoRef.current;
    if (!v || !v.videoWidth) return null;
    const maxSide = 640;
    const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(v, 0, 0, w, h);
    const base64 = canvas.toDataURL("image/jpeg", 0.82).split(",")[1];
    return base64 ? { mimeType: "image/jpeg", data: base64 } : null;
  }, []);

  // carrega a Visão do avatar escolhida antes — cada navegador guarda a sua (ver nota acima:
  // só tem efeito no desktop, mas não custa nada carregar a preferência sempre)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("avatarView");
    if (saved === "3d" || saved === "traditional") setAvatarView(saved);
  }, []);

  const chooseAvatarView = useCallback((view) => {
    setAvatarView(view);
    if (typeof window !== "undefined") localStorage.setItem("avatarView", view);
  }, []);

  // lista de projetos do Sentinela pro seletor manual (mesma fonte que a aba Sentinela usa)
  useEffect(() => {
    let alive = true;
    fetch("/api/sentinel/projects")
      .then((r) => r.json())
      .then((d) => { if (alive && d.ok) setSentinelProjects(d.projects || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // mobile: sem Topbar (ver Shell.js), então tema/auto-sync precisam de carregamento próprio aqui
  useEffect(() => {
    if (!isMobile || typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem("accentTheme") || "null");
      if (saved?.name) setAccentName(saved.name);
    } catch {}
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    let alive = true;
    const check = () => fetch("/api/sync-status").then((r) => r.json()).then((s) => { if (alive) setAutoSync(s); }).catch(() => {});
    check();
    const id = setInterval(check, 30000);
    return () => { alive = false; clearInterval(id); };
  }, [isMobile]);

  const chooseAccent = useCallback((theme) => {
    applyAccentTheme(theme);
    setAccentName(theme.name);
    if (typeof window !== "undefined") localStorage.setItem("accentTheme", JSON.stringify(theme));
  }, []);

  const manualSync = useCallback(async () => {
    if (ingesting) return;
    setIngesting(true);
    await runFullSync({
      onProgress: (ev) => {
        if (ev.type === "error") addLog("[INGEST]", OR, `✗ ${ev.label}: ${ev.message}`);
        else if (ev.type === "finished") addLog("[INGEST]", CY, `finalizado · ${ev.grandTotal} chunks indexados`);
      },
    });
    setIngesting(false);
  }, [ingesting, addLog]);

  // pré-carrega vozes do TTS de reserva (navegador) e verifica suporte a microfone
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setVoiceSupported(false);
  }, []);

  // canvas visualizer (porta do mockup)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let cw = 0, ch = 0, raf = 0, phase = 0;
    const NB = 96;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(1, r.width * dpr);
      cv.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cw = r.width; ch = r.height;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const draw = () => {
      const w = cw, h = ch, cx = w / 2, cy = h / 2;
      const base = Math.min(w, h) * 0.26;
      ctx.clearRect(0, 0, w, h);
      const m = modeRef.current;
      const now = performance.now() / 1000;

      // Canvas não entende var(--accent-rgb)/var(--accent-hex) (isso só funciona em CSS/DOM) —
      // por isso lê o valor JÁ resolvido da variável a cada frame, pra acompanhar o tema
      // escolhido no seletor sem travar numa cor fixa.
      const rootStyle = getComputedStyle(document.documentElement);
      const accentRgb = rootStyle.getPropertyValue("--accent-rgb").trim() || "56, 225, 255";
      const accentHex = rootStyle.getPropertyValue("--accent-hex").trim() || "#38e1ff";

      let amp, speed, coreGlow;
      if (m === "idle") { amp = 0.1; speed = 0.6; coreGlow = 0.5 + 0.2 * Math.sin(now * 1.6); }
      else if (m === "listening") { amp = 0.42; speed = 2.2; coreGlow = 0.75 + 0.2 * Math.sin(now * 6); }
      else { amp = 0.72; speed = 3.6; coreGlow = 0.9; }
      phase += 0.016 * speed;

      for (let i = 0; i < NB; i++) {
        const ang = (i / NB) * Math.PI * 2;
        const seed = i * 0.35;
        let mag = Math.sin(seed * 1.3 + phase * 2.1) * 0.5
                + Math.sin(seed * 2.7 - phase * 1.4) * 0.3
                + Math.sin(seed * 0.7 + phase * 3.3) * 0.2;
        mag = (mag + 1) / 2;
        if (m === "idle") mag = 0.15 + mag * 0.12;
        const len = base * (0.14 + mag * amp);
        const x1 = cx + Math.cos(ang) * base, y1 = cy + Math.sin(ang) * base;
        const x2 = cx + Math.cos(ang) * (base + len), y2 = cy + Math.sin(ang) * (base + len);
        const g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, `rgba(${accentRgb},0.85)`);
        g.addColorStop(1, mag > 0.7 ? "rgba(255,157,61,0.95)" : `rgba(${accentRgb},0.15)`);
        ctx.strokeStyle = g; ctx.lineWidth = 2.2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }

      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 0.95);
      gr.addColorStop(0, `rgba(${accentRgb},${0.3 * coreGlow})`);
      gr.addColorStop(0.5, `rgba(${accentRgb},${0.1 * coreGlow})`);
      gr.addColorStop(1, `rgba(${accentRgb},0)`);
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(cx, cy, base * 0.95, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = `rgba(${accentRgb},${0.55 + coreGlow * 0.4})`;
      ctx.lineWidth = 1.6; ctx.shadowBlur = 18; ctx.shadowColor = accentHex;
      ctx.beginPath(); ctx.arc(cx, cy, base * 0.7, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;

      if (m !== "idle") {
        const rings = m === "speaking" ? 3 : 2;
        for (let k = 0; k < rings; k++) {
          const prog = ((now * (m === "speaking" ? 1.1 : 0.7) + k / rings) % 1);
          const rr = base * (0.7 + prog * 1.5);
          ctx.strokeStyle = `rgba(${accentRgb},${(1 - prog) * 0.35})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
        }
      }

      ctx.strokeStyle = `rgba(${accentRgb},0.25)`; ctx.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 + now * 0.05;
        const r0 = base * 1.55, r1 = base * (i % 5 === 0 ? 1.66 : 1.6);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  // ---- TTS em 2 pedaços: voz do Gemini, com voz do navegador como reserva (nunca alterna no meio) ----

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (currentAudioResolveRef.current) {
      const resolve = currentAudioResolveRef.current;
      currentAudioResolveRef.current = null;
      resolve(); // libera a fila de reprodução, que senão ficaria travada esperando o onended
    }
  }, []);

  const synthesizeChunk = useCallback(async (text) => {
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, voice: voiceName }),
      });
      if (!res.ok) {
        // extrai a mensagem real do corpo (ex.: "UNAVAILABLE: ...") em vez de só o status —
        // ajuda a diagnosticar POR QUE o Gemini está falhando, não só QUE falhou.
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `speak HTTP ${res.status}`);
      }
      const blob = await res.blob();
      return { url: URL.createObjectURL(blob) };
    } catch (err) {
      return { url: null, error: err };
    }
  }, [voiceName]);

  const playChunk = useCallback((synthesisPromise, text, gen) => {
    return synthesisPromise.then((result) => {
      if (gen !== speechGenRef.current) {
        if (result?.url) URL.revokeObjectURL(result.url);
        return;
      }
      return new Promise((resolve) => {
        currentAudioResolveRef.current = resolve;
        const finish = () => { currentAudioResolveRef.current = null; resolve(); };

        if (result?.url) {
          speechEngineRef.current = "gemini";
          setGeminiVoiceStatus(true);
          const audio = new Audio(result.url);
          audioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(result.url); audioRef.current = null; addLog("[TTS]", GR, "voz Gemini"); finish(); };
          audio.onerror = () => { URL.revokeObjectURL(result.url); audioRef.current = null; finish(); };
          audio.play().catch(finish);
        } else {
          // sem áudio do Gemini pra este pedaço — cai pra voz do navegador. Se isso já
          // aconteceu na cabeça desta resposta, o resto nem tenta o Gemini de novo (evita
          // alternar de voz no meio da fala; ver enqueueSpeech).
          if (!result?.skipped) {
            const reason = String(result?.error?.message || "").slice(0, 90);
            addLog("[TTS]", OR, `Gemini indisponível${reason ? ` (${reason})` : ""} → voz do navegador`);
            setGeminiVoiceStatus(false); // só marca "falhou" numa tentativa real — não quando foi pulada de propósito
          }
          speechEngineRef.current = "browser";
          if (typeof window === "undefined" || !window.speechSynthesis) return finish();
          const clean = cleanForSpeech(text);
          if (!clean) return finish();
          const u = new SpeechSynthesisUtterance(clean);
          u.lang = "pt-BR";
          u.rate = 1.05;
          const ptVoice = pickBrowserVoice(window.speechSynthesis.getVoices());
          if (ptVoice) u.voice = ptVoice;
          u.onend = finish;
          u.onerror = finish;
          window.speechSynthesis.speak(u);
        }
      });
    });
  }, [addLog]);

  const enqueueSpeech = useCallback((text, gen) => {
    const clean = (text || "").trim();
    if (!clean) return;
    // tenta o Gemini só se o usuário deixou ligado E a cabeça desta resposta ainda não
    // caiu pro navegador (senão o resto nem tenta de novo — evita alternar no meio da fala).
    const tryGemini = geminiVoiceEnabled && speechEngineRef.current !== "browser";
    // síntese começa JÁ (não espera a vez de tocar) — roda em paralelo com o pedaço
    // anterior tocando, fechando o gap entre a cabeça e o resto da resposta.
    const synthesisPromise = tryGemini ? synthesizeChunk(clean) : Promise.resolve({ url: null, skipped: true });
    speechQueueRef.current = speechQueueRef.current.then(() => {
      if (gen !== speechGenRef.current) return;
      return playChunk(synthesisPromise, clean, gen);
    });
  }, [synthesizeChunk, playChunk, geminiVoiceEnabled]);

  // ---- escopo do assistente ----
  const computeScope = useCallback(() => {
    if (scopeMode === "general") return { mode: "general" };
    if (scopePanel === TASKS_SCOPE) return { mode: "panel", range: "auto" };
    if (scopePanel === THOUGHTS_SCOPE) return { mode: "panel", source: "brain" };
    if (scopePanel === SENTINEL_SCOPE) return { mode: "panel", source: "sentinel", projectId: sentinelProjectId };
    return { mode: "panel", board: scopePanel };
  }, [scopeMode, scopePanel, sentinelProjectId]);

  // ---- pergunta real ao backend (SSE) ----
  const ask = useCallback(async (q) => {
    if (!q.trim() || busy) return;

    // "abre o dashboard" etc. — comando local reconhecido sem gastar chamada nenhuma do
    // Gemini: não passa pelo fluxo normal de pergunta/resposta, só avisa os OUTROS
    // dispositivos abertos (ver RemoteCommandListener.js) e confirma na hora.
    const nav = matchNavCommand(q);
    if (nav) {
      stopSpeaking();
      const gen = ++speechGenRef.current;
      speechEngineRef.current = null;
      const confirmText = `Abrindo ${nav.label} nos outros dispositivos.`;
      setQuestion(q);
      setAnswer(confirmText);
      setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", text: q }, { id: `a${Date.now() + 1}`, role: "assistant", text: confirmText }]);
      addLog("[REMOTE]", PU, `→ ${nav.label} (${nav.target})`);
      fetch("/api/remote-command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: nav.target, originDevice: getDeviceId() }),
      }).catch((err) => addLog("[REMOTE]", OR, `falha: ${err.message}`));
      if (voiceOn) enqueueSpeech(confirmText, gen);
      return;
    }

    setBusy(true);
    setQuestion(q);
    setAnswer("");
    answerRef.current = "";
    setCards([]);
    setMode("listening");
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", text: q }]);

    stopSpeaking(); // corta qualquer fala de uma resposta anterior
    const gen = ++speechGenRef.current;
    speechBufferRef.current = "";
    speechEngineRef.current = null; // nova resposta → nova chance pro Gemini decidir a voz
    const voiceEnabled = voiceOn;
    let headSent = false; // cabeça (1º pedaço) já foi mandada pro TTS nesta resposta?

    addLog("[EMBED]", GR, "query → vector [768d]");
    addLog("[RAG]", CY, "similarity search · top_k");

    let latestCards = [];

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: q, scope: computeScope(), personaMode,
          history: historyRef.current, pendingAction: pendingActionRef.current,
          image: observanceMode ? captureObservanceFrame() : null,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          let event = "message", data = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          let payload;
          try { payload = JSON.parse(data); } catch { payload = data; }

          if (event === "context") {
            latestCards = payload || [];
            setCards(latestCards);
            addLog("[MATCH]", GR, `${latestCards.length} cards recuperados`);
            setMode("speaking");
            addLog("[GEMINI]", OR, "streaming tokens");
          } else if (event === "action") {
            pendingActionRef.current = payload?.pending || null;
            if (payload?.debug) addLog("[ACTION]", PU, `nenhuma ação detectada (intent=${payload.checkedIntent})`);
            else if (pendingActionRef.current) addLog("[ACTION]", PU, "aguardando confirmação…");
            else addLog("[ACTION]", PU, "resolvida");
          } else if (event === "token") {
            setAnswer((a) => { const na = a + payload; answerRef.current = na; return na; });
            // manda a "cabeça" (1º pedaço) assim que atinge um tamanho mínimo — depois disso
            // o restante só acumula, e sai inteiro no fim (evento "done"). No máx. 2 chamadas
            // de TTS por resposta, em vez de uma por frase (é o que esgotava o limite da API).
            if (voiceEnabled) {
              speechBufferRef.current += payload;
              if (!headSent && speechBufferRef.current.length >= TTS_HEAD_CHARS) {
                const { sentences, rest } = splitSentences(speechBufferRef.current);
                if (sentences.length) {
                  headSent = true;
                  enqueueSpeech(sentences.join(" "), gen);
                  speechBufferRef.current = rest;
                }
              }
            }
          } else if (event === "error") {
            addLog("[ERR]", OR, String(payload?.message || payload));
            setAnswer((a) => a + `\n[erro: ${payload?.message || payload}]`);
          } else if (event === "done") {
            addLog("[STATE]", CY, "core → IDLE · standby");
          }
        }
      }
      historyRef.current = { question: q, cards: latestCards };
      setMessages((m) => [...m, { id: `a${Date.now()}`, role: "assistant", text: answerRef.current }]);
    } catch (err) {
      addLog("[ERR]", OR, err.message);
      setAnswer(`Falha ao consultar o backend: ${err.message}`);
      setMessages((m) => [...m, { id: `a${Date.now()}`, role: "assistant", text: `Falha ao consultar o backend: ${err.message}` }]);
    } finally {
      setBusy(false);
      setMode("idle");
      // fala o que sobrou (o "resto" se a cabeça já saiu, ou a resposta inteira se era curta)
      const remaining = speechBufferRef.current.trim();
      speechBufferRef.current = "";
      if (voiceEnabled && remaining) enqueueSpeech(remaining, gen);
    }
  }, [busy, addLog, voiceOn, computeScope, stopSpeaking, enqueueSpeech, personaMode, observanceMode, captureObservanceFrame]);

  // ---- STT: ouvir microfone (Web Speech API) ----
  const toggleMic = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceSupported(false); addLog("[VOICE]", OR, "navegador sem suporte a microfone"); return; }

    // se já está ouvindo, para
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
      return;
    }

    stopSpeaking(); // não ouvir enquanto fala
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    recognitionRef.current = rec;

    let finalText = "";
    rec.onstart = () => { setListening(true); addLog("[VOICE]", GR, "ouvindo…"); };
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput(finalText || interim);
    };
    rec.onerror = (e) => { addLog("[VOICE]", OR, `mic: ${e.error}`); };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const q = (finalText || "").trim();
      if (q) { addLog("[VOICE]", CY, `→ "${q}"`); setInput(""); ask(q); }
      else addLog("[VOICE]", OR, "nada capturado");
    };
    rec.start();
  }, [addLog, ask, stopSpeaking]);

  // modo chat (mobile): rola pro fim sempre que a conversa cresce ou a resposta vai chegando
  useEffect(() => {
    if (!isMobile || mobileView !== "chat") return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isMobile, mobileView, messages, answer]);

  const meta = MODE_META[mode];
  const transcript =
    mode === "speaking" || answer
      ? answer || "…"
      : mode === "listening"
      ? `"${question}"`
      : 'Standby. Digite uma pergunta abaixo e pressione Enter. Eu sou a Lisa.';

  // ==========================================================================================
  // MOBILE — tela própria, só o Assistente (sem Topbar/Sidebar, ver Shell.js): escolhe entre
  // conversa por CHAT (bolhas, como um app de chat de IA) ou por VOZ (tela escura, só a onda
  // sonora no meio, como o modo de voz do ChatGPT). Reaproveita TODO o estado/lógica de cima
  // (ask, toggleMic, canvasRef, voz, escopo) — só a apresentação muda.
  // ==========================================================================================
  if (isMobile) {
    const autoSyncOk = autoSync?.ok && autoSync.status !== undefined;
    const autoSyncColor = !autoSync
      ? "rgba(207,239,251,0.35)"
      : !autoSync.ok
      ? OR
      : autoSync.last_error
      ? OR
      : autoSync.status === "running"
      ? CY
      : autoSync.started_at
      ? GR
      : "rgba(207,239,251,0.35)";

    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#000" }}>
        {/* barra superior mínima */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid rgba(var(--accent-rgb),0.12)", flex: "none" }}>
          <button
            onClick={() => setMobileSettingsOpen(true)}
            aria-label="Configurações"
            style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "rgba(var(--accent-rgb),0.05)", color: CY, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
          <div style={{ ...mono, fontSize: 12, letterSpacing: 3, color: CY }}>◈ LISA</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Outros painéis"
              title="Outros painéis (Dashboard, AR, Quarto de Guerra…)"
              style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "rgba(var(--accent-rgb),0.05)", color: CY, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
            </button>
            <button
              onClick={() => setMobileView("chat")}
              title="Modo chat"
              style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${mobileView === "chat" ? CY : "rgba(var(--accent-rgb),0.2)"}`, background: mobileView === "chat" ? "rgba(var(--accent-rgb),0.12)" : "transparent", color: mobileView === "chat" ? "#eafcff" : "rgba(207,239,251,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </button>
            <button
              onClick={() => setMobileView("voice")}
              title="Modo voz"
              style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${mobileView === "voice" ? CY : "rgba(var(--accent-rgb),0.2)"}`, background: mobileView === "voice" ? "rgba(var(--accent-rgb),0.12)" : "transparent", color: mobileView === "voice" ? "#eafcff" : "rgba(207,239,251,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
            </button>
          </div>
        </div>

        {mobileView === "voice" ? (
          // ---- MODO VOZ: tela escura, só a onda sonora, como o modo de voz do ChatGPT ----
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 0, padding: 20 }}>
            <div style={{ position: "relative", width: "min(80vw,320px)", height: "min(80vw,320px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "absolute", inset: "-6%", border: "1px solid rgba(var(--accent-rgb),0.12)", borderRadius: "50%", borderTopColor: "rgba(var(--accent-rgb),0.45)", borderRightColor: "rgba(var(--accent-rgb),0.28)", animation: "bb-sweep 14s linear infinite" }} />
              <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
              <div style={{ position: "relative", textAlign: "center", pointerEvents: "none" }}>
                <div style={{ ...mono, fontSize: 10, letterSpacing: 5, color: meta.color }}>{meta.label}</div>
              </div>
            </div>
            <button
              onClick={toggleMic}
              disabled={busy}
              style={{
                marginTop: 40, width: 76, height: 76, borderRadius: "50%",
                border: `2px solid ${listening ? OR : CY}`,
                background: listening ? "rgba(255,157,61,0.15)" : "rgba(var(--accent-rgb),0.08)",
                color: listening ? OR : CY, cursor: busy ? "not-allowed" : "pointer",
                boxShadow: listening ? `0 0 24px ${OR}` : `0 0 20px rgba(var(--accent-rgb),0.4)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
            <div style={{ ...mono, fontSize: 10, color: "rgba(207,239,251,0.4)", marginTop: 14, letterSpacing: 1, textAlign: "center", minHeight: 32, padding: "0 16px" }}>
              {mode === "listening" ? `"${question}"` : mode === "speaking" ? "falando…" : "toque no microfone pra falar"}
            </div>
          </div>
        ) : (
          // ---- MODO CHAT: bolhas de conversa, tipo Gemini/ChatGPT ----
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.length === 0 && !busy && (
                <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)", textAlign: "center", marginTop: 40 }}>
                  Oi! Eu sou a Lisa. Pergunte alguma coisa ou toque no microfone.
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "82%", padding: "10px 14px", borderRadius: m.role === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
                    background: m.role === "user" ? "rgba(var(--accent-rgb),0.16)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${m.role === "user" ? "rgba(var(--accent-rgb),0.3)" : "rgba(255,255,255,0.08)"}`,
                    fontSize: 14.5, lineHeight: 1.45, color: "#eafcff", whiteSpace: "pre-wrap", userSelect: "text",
                  }}
                >
                  {m.text}
                </div>
              ))}
              {busy && answer && (
                <div style={{ alignSelf: "flex-start", maxWidth: "82%", padding: "10px 14px", borderRadius: "14px 14px 14px 3px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 14.5, lineHeight: 1.45, color: "#eafcff", whiteSpace: "pre-wrap", userSelect: "text" }}>
                  {answer}
                </div>
              )}
              {busy && !answer && (
                <div style={{ alignSelf: "flex-start", ...mono, fontSize: 10, color: "rgba(207,239,251,0.4)", padding: "10px 14px" }}>pensando…</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* barra de entrada */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderTop: "1px solid rgba(var(--accent-rgb),0.12)" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "10px 14px", border: "1px solid rgba(var(--accent-rgb),0.2)", borderRadius: 22, background: "rgba(255,255,255,0.04)" }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !busy && input.trim()) { ask(input); setInput(""); } }}
                  disabled={busy}
                  placeholder={busy ? "processando…" : listening ? "ouvindo…" : "Mensagem…"}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#eafcff", fontSize: 15 }}
                />
              </div>
              <button
                onClick={toggleMic}
                disabled={busy}
                style={{ width: 42, height: 42, borderRadius: "50%", flex: "none", border: `1.5px solid ${listening ? OR : CY}`, background: listening ? "rgba(255,157,61,0.15)" : "rgba(var(--accent-rgb),0.06)", color: listening ? OR : CY, cursor: busy ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
              </button>
              {input.trim() && (
                <button
                  onClick={() => { if (!busy) { ask(input); setInput(""); } }}
                  disabled={busy}
                  style={{ width: 42, height: 42, borderRadius: "50%", flex: "none", border: `1.5px solid ${CY}`, background: "rgba(var(--accent-rgb),0.14)", color: CY, cursor: busy ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* configurações — escopo, tema, voz, sync */}
        {mobileSettingsOpen && (
          <div
            onClick={() => setMobileSettingsOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxHeight: "80vh", overflowY: "auto", background: "#08131a", borderTop: "1px solid rgba(var(--accent-rgb),0.25)", borderRadius: "16px 16px 0 0", padding: "18px 18px 28px" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ ...mono, fontSize: 11, letterSpacing: 2, color: CY }}>◈ CONFIGURAÇÕES</div>
                <button onClick={() => setMobileSettingsOpen(false)} style={{ ...mono, fontSize: 10, padding: "5px 10px", border: "1px solid rgba(var(--accent-rgb),0.2)", borderRadius: 4, background: "transparent", color: "rgba(207,239,251,0.6)", cursor: "pointer" }}>✕ fechar</button>
              </div>

              {/* escopo */}
              <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginBottom: 8 }}>ESCOPO</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[{ key: "panel", label: "ESTE PAINEL" }, { key: "general", label: "GERAL" }].map((m) => (
                  <button key={m.key} onClick={() => setScopeMode(m.key)} style={{ ...mono, fontSize: 10, padding: "8px 12px", borderRadius: 6, border: `1px solid ${scopeMode === m.key ? CY : "rgba(var(--accent-rgb),0.18)"}`, background: scopeMode === m.key ? "rgba(var(--accent-rgb),0.12)" : "transparent", color: scopeMode === m.key ? "#eafcff" : "rgba(207,239,251,0.55)", cursor: "pointer", flex: 1 }}>{m.label}</button>
                ))}
              </div>
              {scopeMode === "panel" && (
                <select value={scopePanel} onChange={(e) => setScopePanel(e.target.value)} style={{ ...mono, fontSize: 12, padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#000", color: "#eafcff", width: "100%", marginBottom: 10 }}>
                  {panelOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                  <option value={TASKS_SCOPE}>Tarefas (por prazo)</option>
                  <option value={THOUGHTS_SCOPE}>Pensamentos</option>
                  <option value={SENTINEL_SCOPE}>Chamados (Sentinela)</option>
                </select>
              )}
              {scopeMode === "panel" && scopePanel === SENTINEL_SCOPE && (
                <select value={sentinelProjectId} onChange={(e) => setSentinelProjectId(e.target.value)} style={{ ...mono, fontSize: 12, padding: "10px 12px", borderRadius: 6, border: `1px solid ${OR}55`, background: "#000", color: "#eafcff", width: "100%", marginBottom: 10 }}>
                  <option value="all">Todos os projetos</option>
                  {sentinelProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}

              {/* voz */}
              <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginTop: 14, marginBottom: 8 }}>VOZ</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button onClick={() => { if (voiceOn) stopSpeaking(); setVoiceOn((v) => !v); }} style={{ ...mono, fontSize: 10, padding: "8px 12px", borderRadius: 6, border: `1px solid ${voiceOn ? CY : "rgba(207,239,251,0.3)"}`, background: voiceOn ? "rgba(var(--accent-rgb),0.1)" : "transparent", color: voiceOn ? "#eafcff" : "rgba(207,239,251,0.5)", cursor: "pointer", flex: 1 }}>{voiceOn ? "🔊 falar respostas: ON" : "🔇 falar respostas: OFF"}</button>
              </div>
              <select value={voiceName} onChange={(e) => { setVoiceName(e.target.value); if (typeof window !== "undefined") localStorage.setItem("voiceName", e.target.value); }} style={{ ...mono, fontSize: 12, padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#000", color: "#eafcff", width: "100%", marginBottom: 10 }}>
                {TTS_VOICES.map((v) => <option key={v.name} value={v.name}>{v.name} · {v.trait}</option>)}
              </select>

              {/* tema */}
              <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginTop: 14, marginBottom: 8 }}>COR DE DESTAQUE</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                {ACCENT_THEMES.map((t) => (
                  <button key={t.name} onClick={() => chooseAccent(t)} title={t.name} style={{ width: 30, height: 30, borderRadius: "50%", background: t.hex, border: `2px solid ${accentName === t.name ? "#eafcff" : "transparent"}`, cursor: "pointer" }} />
                ))}
              </div>

              {/* persona */}
              <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginTop: 14, marginBottom: 8 }}>PERSONALIDADE</div>
              <button
                onClick={togglePersonaMode}
                style={{ ...mono, fontSize: 10.5, padding: "10px 14px", borderRadius: 6, border: `1px solid ${personaMode ? PU : "rgba(var(--accent-rgb),0.18)"}`, background: personaMode ? "rgba(201,166,255,0.12)" : "transparent", color: personaMode ? "#eafcff" : "rgba(207,239,251,0.55)", cursor: "pointer", width: "100%", marginBottom: 14 }}
              >
                🎭 Modo Persona: {personaMode ? "ON" : "OFF"}
              </button>

              {/* observância */}
              <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginTop: 14, marginBottom: 8 }}>OBSERVÂNCIA (CÂMERA)</div>
              <button
                onClick={() => setObservanceMode((v) => !v)}
                style={{ ...mono, fontSize: 10.5, padding: "10px 14px", borderRadius: 6, border: `1px solid ${observanceMode ? GR : "rgba(var(--accent-rgb),0.18)"}`, background: observanceMode ? "rgba(123,216,143,0.12)" : "transparent", color: observanceMode ? "#eafcff" : "rgba(207,239,251,0.55)", cursor: "pointer", width: "100%", marginBottom: 8 }}
              >
                👁 Modo Observância: {observanceMode ? "ON" : "OFF"}
              </button>
              {observanceMode && (
                <video ref={observanceVideoRef} autoPlay playsInline muted style={{ width: "100%", maxWidth: 160, aspectRatio: "4/3", borderRadius: 6, objectFit: "cover", border: `1px solid ${GR}55`, marginBottom: 6, display: "block" }} />
              )}
              {observanceError && <div style={{ ...mono, fontSize: 9.5, color: OR, marginBottom: 8 }}>⚠ {observanceError}</div>}
              <div style={{ fontSize: 11, color: "rgba(207,239,251,0.45)", marginBottom: 14, lineHeight: 1.4 }}>
                Tira 1 foto só no instante de cada pergunta pra Lisa poder ver o que você mostra — nada fica salvo.
              </div>

              {/* sync */}
              <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginTop: 14, marginBottom: 8 }}>SINCRONIZAÇÃO</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: autoSyncColor, boxShadow: `0 0 8px ${autoSyncColor}`, flex: "none" }} />
                <span style={{ ...mono, fontSize: 10.5, color: "rgba(207,239,251,0.7)" }}>
                  AUTO-SYNC {!autoSync ? "…" : !autoSync.ok ? "não configurado" : autoSync.status === "running" ? "em andamento" : autoSync.started_at ? "ok" : "nunca rodou"}
                </span>
              </div>
              <button
                onClick={manualSync}
                disabled={ingesting}
                style={{ ...mono, fontSize: 10.5, letterSpacing: 1.5, padding: "10px 14px", borderRadius: 6, border: `1px solid ${ingesting ? OR : CY}`, background: "rgba(var(--accent-rgb),0.08)", color: ingesting ? OR : "#eafcff", cursor: ingesting ? "wait" : "pointer", width: "100%" }}
              >
                {ingesting ? "SINCRONIZANDO…" : "◈ SYNC AGORA"}
              </button>
            </div>
          </div>
        )}

        {/* atalho pros outros painéis — no mobile o Assistente é tela cheia e não tem
            Sidebar/Topbar, então sem isso não teria como chegar em nenhum outro lugar do app */}
        {mobileNavOpen && (
          <div
            onClick={() => setMobileNavOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxHeight: "80vh", overflowY: "auto", background: "#08131a", borderTop: "1px solid rgba(var(--accent-rgb),0.25)", borderRadius: "16px 16px 0 0", padding: "18px 18px 28px" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ ...mono, fontSize: 11, letterSpacing: 2, color: CY }}>◈ OUTROS PAINÉIS</div>
                <button onClick={() => setMobileNavOpen(false)} style={{ ...mono, fontSize: 10, padding: "5px 10px", border: "1px solid rgba(var(--accent-rgb),0.2)", borderRadius: 4, background: "transparent", color: "rgba(207,239,251,0.6)", cursor: "pointer" }}>✕ fechar</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { href: "/dashboard", glyph: "▧", label: "DASHBOARD" },
                  { href: "/dashboard/ar", glyph: "◫", label: "DASHBOARD · MODO AR" },
                  { href: "/", glyph: "◈", label: "QUARTO DE GUERRA" },
                  { href: "/boards", glyph: "▦", label: "BOARDS" },
                  { href: "/tasks", glyph: "⏱", label: "TAREFAS" },
                  { href: "/thoughts", glyph: "✎", label: "PENSAMENTOS" },
                  { href: "/sentinel", glyph: "◆", label: "SENTINELA" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    style={{ ...mono, fontSize: 12, letterSpacing: 1.5, padding: "14px 16px", borderRadius: 8, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "rgba(var(--accent-rgb),0.05)", color: "#eafcff", textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <span style={{ color: CY }}>{item.glyph}</span> {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* ESCOPO DO ASSISTENTE */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 26px", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)", flexWrap: "wrap" }}>
        <span style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)" }}>ESCOPO</span>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ key: "panel", label: "ESTE PAINEL" }, { key: "general", label: "GERAL" }].map((m) => (
            <button
              key={m.key}
              onClick={() => setScopeMode(m.key)}
              style={{
                ...mono, fontSize: 9.5, letterSpacing: 1, padding: "5px 10px", borderRadius: 3,
                border: `1px solid ${scopeMode === m.key ? CY : "rgba(var(--accent-rgb),0.18)"}`,
                background: scopeMode === m.key ? "rgba(var(--accent-rgb),0.1)" : "transparent",
                color: scopeMode === m.key ? "#eafcff" : "rgba(207,239,251,0.55)",
                cursor: "pointer",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {scopeMode === "panel" ? (
          <select
            value={scopePanel}
            onChange={(e) => setScopePanel(e.target.value)}
            style={{ ...mono, fontSize: 9.5, padding: "6px 8px", borderRadius: 3, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#08131a", color: "#eafcff" }}
          >
            {panelOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            <option value={TASKS_SCOPE}>Tarefas (por prazo)</option>
            <option value={THOUGHTS_SCOPE}>Pensamentos</option>
            <option value={SENTINEL_SCOPE}>Chamados (Sentinela)</option>
          </select>
        ) : null}

        {/* projeto do Sentinela — só aparece com o escopo "Chamados (Sentinela)" selecionado,
            pra Lisa saber exatamente de qual projeto de teste está falando */}
        {scopeMode === "panel" && scopePanel === SENTINEL_SCOPE && (
          <select
            value={sentinelProjectId}
            onChange={(e) => setSentinelProjectId(e.target.value)}
            title="Projeto de teste (Sentinela) — força a resposta a considerar só esse projeto"
            style={{ ...mono, fontSize: 9.5, padding: "6px 8px", borderRadius: 3, border: `1px solid ${OR}55`, background: "#08131a", color: "#eafcff" }}
          >
            <option value="all">Todos os projetos</option>
            {sentinelProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        {scopeMode === "general" && (
          <span style={{ ...mono, fontSize: 9, color: PU }}>vê todos os painéis · pode buscar na web quando precisar</span>
        )}

        {/* Modo Persona — liga a personalidade de persona.md por cima das respostas */}
        <button
          onClick={togglePersonaMode}
          title={personaMode ? "Modo Persona ligado (persona.md) — clique pra desligar" : "Modo Persona desligado (tom direto de sempre) — clique pra ligar"}
          style={{
            ...mono, fontSize: 9, letterSpacing: 1, padding: "5px 10px", borderRadius: 3, marginLeft: "auto",
            border: `1px solid ${personaMode ? PU : "rgba(var(--accent-rgb),0.18)"}`,
            background: personaMode ? "rgba(201,166,255,0.12)" : "transparent",
            color: personaMode ? "#eafcff" : "rgba(207,239,251,0.55)",
            cursor: "pointer",
          }}
        >
          🎭 PERSONA {personaMode ? "ON" : "OFF"}
        </button>

        {/* Visão do avatar: visualizador de onda de sempre × corpo em modelo 3D — desktop-only */}
        <div style={{ display: "flex", gap: 4 }}>
          {[{ key: "traditional", label: "◈ VISÃO TRADICIONAL" }, { key: "3d", label: "🧑 VISÃO 3D" }].map((v) => (
            <button
              key={v.key}
              onClick={() => chooseAvatarView(v.key)}
              title={v.key === "3d" ? "Corpo em modelo 3D no lugar do visualizador — arraste/belisque pra ajustar o enquadramento" : "Visualizador de onda tradicional"}
              style={{
                ...mono, fontSize: 9, letterSpacing: 1, padding: "5px 10px", borderRadius: 3,
                border: `1px solid ${avatarView === v.key ? CY : "rgba(var(--accent-rgb),0.18)"}`,
                background: avatarView === v.key ? "rgba(var(--accent-rgb),0.1)" : "transparent",
                color: avatarView === v.key ? "#eafcff" : "rgba(207,239,251,0.55)",
                cursor: "pointer",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Modo Observância — liga a câmera, tira 1 foto no instante de cada pergunta e manda
            junto pro Gemini (multimodal); nunca fica ligado sozinho entre recarregamentos. */}
        <button
          onClick={() => setObservanceMode((v) => !v)}
          title={observanceMode ? "Modo Observância ligado — a câmera tira 1 foto por pergunta, nada fica salvo. Clique pra desligar" : "Ligar a câmera pra Lisa poder ver o que você mostra (postura, roupa, gestos) ao responder"}
          style={{
            ...mono, fontSize: 9, letterSpacing: 1, padding: "5px 10px", borderRadius: 3,
            border: `1px solid ${observanceMode ? GR : "rgba(var(--accent-rgb),0.18)"}`,
            background: observanceMode ? "rgba(123,216,143,0.12)" : "transparent",
            color: observanceMode ? "#eafcff" : "rgba(207,239,251,0.55)",
            cursor: "pointer",
          }}
        >
          👁 OBSERVÂNCIA {observanceMode ? "ON" : "OFF"}
        </button>
        {observanceMode && (
          <video ref={observanceVideoRef} autoPlay playsInline muted title="o que a câmera vê agora — só uma foto disso é enviada, no instante de cada pergunta" style={{ width: 54, height: 40, borderRadius: 4, objectFit: "cover", border: `1px solid ${GR}55` }} />
        )}
        {observanceError && <span style={{ ...mono, fontSize: 8.5, color: OR }}>⚠ {observanceError}</span>}
      </div>

      {/* abas — só aparecem no mobile (ver .bb-assistant-tabs em globals.css). No mobile o
          chat abre direto (sem a coluna de contexto — ela some de vez, nem vira aba) */}
      <div className="bb-assistant-tabs" style={{ gap: 4, padding: "8px 26px", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)" }}>
        {[{ key: "visualizer", label: "CHAT" }, { key: "logs", label: "LOGS" }].map((t) => (
          <button
            key={t.key}
            onClick={() => setMobileTab(t.key)}
            style={{
              ...mono, fontSize: 9.5, letterSpacing: 1, padding: "6px 12px", borderRadius: 3,
              border: `1px solid ${mobileTab === t.key ? CY : "rgba(var(--accent-rgb),0.18)"}`,
              background: mobileTab === t.key ? "rgba(var(--accent-rgb),0.1)" : "transparent",
              color: mobileTab === t.key ? "#eafcff" : "rgba(207,239,251,0.55)",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* MAIN GRID */}
      <main className="bb-assistant-grid" style={{ position: "relative", flex: 1, display: "grid", gridTemplateColumns: "minmax(220px,320px) minmax(0,1fr) minmax(280px,360px)", minHeight: 0 }}>
        {/* LEFT: LOGS */}
        <aside className={`bb-assistant-pane${mobileTab === "logs" ? " bb-active" : ""}`} style={{ borderRight: "1px solid rgba(var(--accent-rgb),0.12)", flexDirection: "column", minHeight: 0, minWidth: 0, background: "linear-gradient(90deg, rgba(6,18,24,0.35), transparent)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)" }}>
            <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ SYSTEM_LOGS</div>
            <div style={{ ...mono, fontSize: 9, color: "rgba(255,157,61,0.85)", animation: "bb-flicker 2s infinite" }}>● LIVE</div>
          </div>
          <div style={{ flex: 1, overflow: "hidden", padding: "12px 14px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 7 }}>
            {logs.map((log) => (
              <div key={log.id} style={{ ...mono, fontSize: 10.5, lineHeight: 1.45, animation: "bb-slidein .35s ease" }}>
                <span style={{ color: "rgba(255,255,255,0.32)" }}>{log.t}</span>
                <span style={{ color: log.color, margin: "0 5px" }}>{log.tag}</span>
                <span style={{ color: "#a9cede" }}>{log.msg}</span>
              </div>
            ))}
            <div style={{ ...mono, fontSize: 10.5, color: CY }}>&gt;<span style={{ display: "inline-block", width: 7, height: 13, background: CY, marginLeft: 4, verticalAlign: "middle", animation: "bb-blink 1s step-end infinite" }} /></div>
          </div>
        </aside>

        {/* CENTER: VISUALIZER */}
        <section className={`bb-assistant-pane${mobileTab === "visualizer" ? " bb-active" : ""}`} style={{ position: "relative", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 0, minWidth: 0 }}>
          {avatarView === "3d" ? (
            <div style={{ position: "relative", width: "min(70vh,680px)", height: "min(70vh,680px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LisaAvatar3D mode={mode} />
              <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
                <div style={{ ...mono, fontSize: 10, letterSpacing: 4, color: meta.color }}>{meta.label}</div>
              </div>
              <a
                href="https://sketchfab.com/3d-models/android-cyborg-anime-girl-5fda47ea8ca048f7939f78da94aea54f"
                target="_blank" rel="noreferrer"
                style={{ position: "absolute", bottom: -18, right: 0, ...mono, fontSize: 7.5, letterSpacing: 0.5, color: "rgba(207,239,251,0.3)", textDecoration: "none" }}
              >
                modelo: "Android Cyborg Anime Girl" por lawlietrecluze · CC-BY-4.0
              </a>
            </div>
          ) : (
            <div style={{ position: "relative", width: "min(52vh,520px)", height: "min(52vh,520px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "absolute", inset: "-6%", border: "1px solid rgba(var(--accent-rgb),0.12)", borderRadius: "50%", borderTopColor: "rgba(var(--accent-rgb),0.45)", borderRightColor: "rgba(var(--accent-rgb),0.28)", animation: "bb-sweep 14s linear infinite" }} />
              <div style={{ position: "absolute", inset: "4%", border: "1px dashed rgba(255,157,61,0.18)", borderRadius: "50%", animation: "bb-sweep 22s linear infinite reverse" }} />
              <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
              <div style={{ position: "relative", textAlign: "center", pointerEvents: "none" }}>
                <div style={{ ...mono, fontSize: 11, letterSpacing: 5, color: meta.color }}>{meta.label}</div>
                <div style={{ fontSize: 13, letterSpacing: 2, color: "rgba(207,239,251,0.55)", marginTop: 6, ...mono }}>{meta.sub}</div>
              </div>
            </div>
          )}
          <div style={{ marginTop: 26, width: "min(80%,560px)", textAlign: "center" }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: 3, color: "rgba(var(--accent-rgb),0.5)", marginBottom: 8 }}>↳ INTENT INTERPRETATION</div>
            <div style={{ fontSize: 19, lineHeight: 1.4, color: "#eafcff", fontWeight: 500, letterSpacing: 0.4, whiteSpace: "pre-wrap" }}>{transcript}</div>
          </div>
        </section>

        {/* RIGHT: CONTEXT — some de vez no mobile (não é aba, ver .bb-assistant-context em globals.css) */}
        <aside className="bb-assistant-pane bb-assistant-context" style={{ borderLeft: "1px solid rgba(var(--accent-rgb),0.12)", flexDirection: "column", minHeight: 0, minWidth: 0, background: "linear-gradient(270deg, rgba(6,18,24,0.35), transparent)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)" }}>
            <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ RETRIEVED_CONTEXT</div>
            <div style={{ ...mono, fontSize: 9, color: "rgba(var(--accent-rgb),0.5)" }}>pgvector · {cards.length} matches</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {cards.length === 0 && (
              <div style={{ ...mono, fontSize: 10.5, color: "rgba(207,239,251,0.4)", padding: "6px 2px" }}>
                aguardando primeira consulta…
              </div>
            )}
            {cards.map((c, i) => {
              const brain = c.source === "BRAIN";
              const sentinel = c.source === "SENTINELA";
              const accent = brain ? PU : sentinel ? OR : CY;
              const edge = brain ? "rgba(201,166,255,0.32)" : sentinel ? "rgba(255,157,61,0.32)" : "rgba(var(--accent-rgb),0.3)";
              return (
                <div key={i} style={{ flex: "none", border: `1px solid ${edge}`, borderRadius: 6, padding: "13px 14px", background: "linear-gradient(160deg, rgba(var(--accent-rgb),0.05), rgba(0,0,0,0.2))", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accent, boxShadow: `0 0 10px ${accent}` }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ ...mono, fontSize: 8.5, letterSpacing: 2, padding: "3px 7px", border: `1px solid ${edge}`, borderRadius: 3, color: accent, background: "rgba(0,0,0,0.3)" }}>{c.source}</span>
                    <span style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.4)" }}>{c.board}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#eafcff", letterSpacing: 0.3, lineHeight: 1.25 }}>{c.title}</div>
                  <div style={{ fontSize: 12.5, color: "rgba(169,206,222,0.8)", marginTop: 5, lineHeight: 1.4 }}>{c.snippet}</div>
                  <div style={{ ...mono, fontSize: 9, color: "rgba(var(--accent-rgb),0.55)", marginTop: 9 }}>SIM {meterFor(c.pct)} {c.sim}</div>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 9, paddingTop: 9, borderTop: "1px dashed rgba(var(--accent-rgb),0.14)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: OR, boxShadow: "0 0 7px #ff9d3d" }} />
                    <span style={{ ...mono, fontSize: 9, letterSpacing: 1, color: "rgba(255,157,61,0.85)" }}>LAST_MODIFIED</span>
                    <span style={{ ...mono, fontSize: 10, color: "#ffbe7a", marginLeft: "auto", whiteSpace: "nowrap" }}>{c.modified}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </main>

      {/* BOTTOM COMMAND BAR */}
      <footer className="bb-footer" style={{ position: "relative", display: "flex", alignItems: "center", gap: 18, padding: "14px 26px", borderTop: "1px solid rgba(var(--accent-rgb),0.16)", background: "linear-gradient(0deg, rgba(6,20,26,0.6), transparent)" }}>
        <div className="bb-footer-hide" style={{ ...mono, fontSize: 10, letterSpacing: 3, color: "rgba(var(--accent-rgb),0.5)" }}>STATE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 5, border: `1px solid ${meta.color}`, color: meta.color }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
          <span className="bb-footer-hide" style={{ fontWeight: 600, letterSpacing: 1.5, fontSize: 13 }}>{meta.label}</span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", border: "1px solid rgba(var(--accent-rgb),0.18)", borderRadius: 5, background: "rgba(var(--accent-rgb),0.03)", ...mono }}>
          <span style={{ color: CY, fontSize: 13 }}>&gt;_</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) { ask(input); setInput(""); }
            }}
            disabled={busy}
            placeholder={busy ? "processando…" : (listening ? "ouvindo… fale agora" : 'pergunte ou clique no microfone…')}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#eafcff", fontSize: 12, letterSpacing: 0.5 }}
          />
        </div>

        {/* botão de microfone (STT) */}
        <button
          onClick={toggleMic}
          disabled={busy}
          title={listening ? "Parar de ouvir" : "Falar (microfone)"}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 44, height: 44, borderRadius: "50%",
            border: `1.5px solid ${listening ? OR : CY}`,
            background: listening ? "rgba(255,157,61,0.15)" : "rgba(var(--accent-rgb),0.06)",
            color: listening ? OR : CY, cursor: busy ? "not-allowed" : "pointer",
            boxShadow: listening ? `0 0 16px ${OR}` : "none",
            animation: listening ? "bb-dot 1s ease-in-out infinite" : "none",
            transition: "all .2s",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        {/* toggle de voz (TTS) */}
        <button
          onClick={() => { if (voiceOn) stopSpeaking(); setVoiceOn(v => !v); }}
          title={voiceOn ? "Voz ligada (clique p/ mutar)" : "Voz desligada"}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, borderRadius: "50%",
            border: `1px solid ${voiceOn ? CY : "rgba(207,239,251,0.3)"}`,
            background: "rgba(var(--accent-rgb),0.04)", color: voiceOn ? CY : "rgba(207,239,251,0.4)",
            cursor: "pointer", transition: "all .2s",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {voiceOn
              ? <><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>
              : <><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>}
          </svg>
        </button>

        {/* liga/desliga a voz do Gemini especificamente + mostra se ela tá disponível */}
        <button
          onClick={() => setGeminiVoiceEnabled((v) => !v)}
          title={
            !geminiVoiceEnabled
              ? "Voz Gemini desativada — usando só a voz do navegador (clique pra reativar)"
              : geminiVoiceStatus === false
              ? "Voz Gemini ativada, mas a última tentativa falhou (clique pra desativar e usar só a voz do navegador)"
              : geminiVoiceStatus === true
              ? "Voz Gemini ativada e funcionando (clique pra desativar)"
              : "Voz Gemini ativada, ainda sem tentativa nesta sessão (clique pra desativar)"
          }
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "0 13px", height: 40, borderRadius: 20,
            border: `1px solid ${geminiVoiceEnabled ? CY : "rgba(207,239,251,0.25)"}`,
            background: geminiVoiceEnabled ? "rgba(var(--accent-rgb),0.04)" : "transparent",
            color: geminiVoiceEnabled ? "#eafcff" : "rgba(207,239,251,0.45)",
            cursor: "pointer", transition: "all .2s", ...mono, fontSize: 9.5, letterSpacing: 1.5,
          }}
        >
          <span
            style={{
              width: 7, height: 7, borderRadius: "50%",
              background: dotColor(geminiVoiceEnabled ? geminiVoiceStatus : null),
              boxShadow: geminiVoiceEnabled && geminiVoiceStatus != null ? `0 0 8px ${dotColor(geminiVoiceStatus)}` : "none",
            }}
          />
          <span className="bb-footer-hide">
            VOZ GEMINI{!geminiVoiceEnabled ? " · OFF" : geminiVoiceStatus === true ? " · OK" : geminiVoiceStatus === false ? " · FALHOU" : ""}
          </span>
        </button>

        {/* qual das 30 vozes do Gemini usar — a Google não documenta gênero, então teste e
            escolha a que soar certa; a escolha fica salva neste navegador. */}
        {geminiVoiceEnabled && (
          <select
            value={voiceName}
            onChange={(e) => {
              setVoiceName(e.target.value);
              if (typeof window !== "undefined") localStorage.setItem("voiceName", e.target.value);
            }}
            title="Voz do Gemini (a Google não documenta gênero — teste e escolha a que preferir)"
            style={{ ...mono, fontSize: 9.5, padding: "0 10px", height: 40, borderRadius: 20, border: "1px solid rgba(var(--accent-rgb),0.2)", background: "#08131a", color: "#eafcff" }}
          >
            {TTS_VOICES.map((v) => (
              <option key={v.name} value={v.name}>{v.name} · {v.trait}</option>
            ))}
          </select>
        )}
      </footer>
    </div>
  );
}
