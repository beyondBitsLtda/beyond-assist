"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cleanForSpeech } from "@/lib/cleanForSpeech.js";
import { useLog } from "@/components/shell/LogProvider.js";
import { CY, OR, GR, PU, mono, meterFor, dotColor } from "@/lib/theme.js";
import { TTS_VOICES } from "@/lib/ttsVoices.js";

const MODE_META = {
  idle: { label: "IDLE", sub: "awaiting command", color: CY },
  listening: { label: "LISTENING", sub: "retrieving context", color: GR },
  speaking: { label: "SPEAKING", sub: "streaming response", color: OR },
};

const TASKS_SCOPE = "__tasks__";
const THOUGHTS_SCOPE = "__thoughts__";
const SENTINEL_SCOPE = "__sentinel__";

// Tamanho mínimo (em caracteres) pro primeiro pedaço da resposta antes de mandar pro TTS.
// Poucas chamadas maiores erram menos que muitas chamadas pequenas (uma por frase esgotava
// o limite de requisições da API do Gemini).
const TTS_HEAD_CHARS = 150;

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

  // lista de projetos do Sentinela pro seletor manual (mesma fonte que a aba Sentinela usa)
  useEffect(() => {
    let alive = true;
    fetch("/api/sentinel/projects")
      .then((r) => r.json())
      .then((d) => { if (alive && d.ok) setSentinelProjects(d.projects || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

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
          const voices = window.speechSynthesis.getVoices();
          const ptVoice = voices.find((v) => /pt-BR/i.test(v.lang)) || voices.find((v) => /pt/i.test(v.lang));
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
    setBusy(true);
    setQuestion(q);
    setAnswer("");
    answerRef.current = "";
    setCards([]);
    setMode("listening");

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
          question: q, scope: computeScope(),
          history: historyRef.current, pendingAction: pendingActionRef.current,
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
    } catch (err) {
      addLog("[ERR]", OR, err.message);
      setAnswer(`Falha ao consultar o backend: ${err.message}`);
    } finally {
      setBusy(false);
      setMode("idle");
      // fala o que sobrou (o "resto" se a cabeça já saiu, ou a resposta inteira se era curta)
      const remaining = speechBufferRef.current.trim();
      speechBufferRef.current = "";
      if (voiceEnabled && remaining) enqueueSpeech(remaining, gen);
    }
  }, [busy, addLog, voiceOn, computeScope, stopSpeaking, enqueueSpeech]);

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

  const meta = MODE_META[mode];
  const transcript =
    mode === "speaking" || answer
      ? answer || "…"
      : mode === "listening"
      ? `"${question}"`
      : 'Standby. Digite uma pergunta abaixo e pressione Enter. Eu sou a Lisa.';

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
          <div style={{ position: "relative", width: "min(52vh,520px)", height: "min(52vh,520px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", inset: "-6%", border: "1px solid rgba(var(--accent-rgb),0.12)", borderRadius: "50%", borderTopColor: "rgba(var(--accent-rgb),0.45)", borderRightColor: "rgba(var(--accent-rgb),0.28)", animation: "bb-sweep 14s linear infinite" }} />
            <div style={{ position: "absolute", inset: "4%", border: "1px dashed rgba(255,157,61,0.18)", borderRadius: "50%", animation: "bb-sweep 22s linear infinite reverse" }} />
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
            <div style={{ position: "relative", textAlign: "center", pointerEvents: "none" }}>
              <div style={{ ...mono, fontSize: 11, letterSpacing: 5, color: meta.color }}>{meta.label}</div>
              <div style={{ fontSize: 13, letterSpacing: 2, color: "rgba(207,239,251,0.55)", marginTop: 6, ...mono }}>{meta.sub}</div>
            </div>
          </div>
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
