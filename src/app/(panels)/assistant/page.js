"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { cleanForSpeech } from "@/lib/cleanForSpeech.js";
import { useLog } from "@/components/shell/LogProvider.js";
import { CY, OR, GR, PU, mono, meterFor, dotColor } from "@/lib/theme.js";
import { langForPath } from "@/lib/highlightCode.js";
import { Highlight } from "prism-react-renderer";
import { TTS_VOICES } from "@/lib/ttsVoices.js";
import { pickBrowserVoice, speakText, stopBrowserVoiceAudio, isBrowserVoiceAudioPlaying } from "@/lib/browserVoice.js";
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
const DELP_SCOPE = "__delp__";
const CODE_SCOPE = "__code__";


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
  // "disjuntor": sem isso, CADA resposta nova testava o Gemini do zero — se ele estivesse
  // instável, uma resposta saía na voz dele e a próxima já caía pro navegador, sem padrão
  // nenhum (é o que dava a sensação de "ficar trocando"). Uma vez que falha de verdade,
  // para de tentar por um tempo (fica só na voz do navegador, de forma CONSISTENTE) em vez
  // de tentar de novo já na pergunta seguinte.
  const GEMINI_COOLDOWN_MS = 60000;
  const geminiDownUntilRef = useRef(0);
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
  // escopo "Código": qual repositório (like o seletor de projeto do Sentinela) e, dentro
  // dele, qual arquivo específico (opcional — sem arquivo, é busca semântica; com arquivo,
  // é leitura completa dele, ver resolveScope em scopeResolver.js).
  const [codeRepo, setCodeRepo] = useState("all");
  const [codeFile, setCodeFile] = useState("");
  const [codeRepos, setCodeRepos] = useState([]);
  const [codeFiles, setCodeFiles] = useState([]);

  // Modo Persona: liga a personalidade descrita em persona.md (raiz do repo) por cima das
  // respostas — desligado por padrão (tom direto/neutro de sempre).
  const [personaMode, setPersonaMode] = useState(false);

  // Modo Código: com isso ligado (e um repositório+branch escolhidos), toda pergunta vira um
  // PEDIDO DE MUDANÇA DE CÓDIGO em vez de uma conversa normal — ver askCodeMode/
  // /api/code-tasks/stream. Narra cada fase (Lisa "comenta" o que está fazendo, com voz) e
  // mostra o código de cada arquivo sendo escrito ao vivo (liveCode), não só o PR pronto no
  // final. Nunca commita na branch escolhida — sempre cria uma branch nova e abre um PR.
  const [codeMode, setCodeMode] = useState(false);
  const [codeModeRepo, setCodeModeRepo] = useState("");
  const [codeModeBranch, setCodeModeBranch] = useState("");
  const [codeModeRepos, setCodeModeRepos] = useState([]);
  const [codeModeBranches, setCodeModeBranches] = useState([]);
  // arquivos escolhidos à mão, garantidos no contexto de TODO pedido enquanto o Modo Código
  // ficar ligado (sem isso, só a busca semântica decide — e ela erra fácil em pedidos amplos
  // tipo "mude o tema", que não se parecem textualmente com os arquivos de config certos).
  const [codeModeFiles, setCodeModeFiles] = useState([]);
  const [codeModeAvailableFiles, setCodeModeAvailableFiles] = useState([]);
  const CODE_MODE_MAX_FILES = 6; // precisa bater com MAX_FILES_PER_TASK em src/lib/codeTasks.js
  const [liveCode, setLiveCode] = useState(null); // { path, content } — arquivo sendo escrito agora
  const [liveCodeDone, setLiveCodeDone] = useState([]); // arquivos já concluídos nesta tarefa
  const currentCodeFileRef = useRef(null);
  // sessão de CONTINUAÇÃO — enquanto existir (mesmo repo+branch base), o próximo pedido de
  // código não recomeça do zero: continua commitando na MESMA branch/PR já aberto, lendo o
  // conteúdo AO VIVO do GitHub (não do índice, que pode estar desatualizado) pros arquivos
  // já tocados. É o que permite "corrige esse erro" like conversa, sem abrir PR novo cada vez.
  const [codeSession, setCodeSession] = useState(null); // { repo, baseBranch, branchName, prUrl, files }
  const [codeModalInput, setCodeModalInput] = useState("");
  // janela flutuante e arrastável do Modo Código, com cara de editor (título + abas por
  // arquivo + área de código com número de linha) — abre sozinha quando uma tarefa começa,
  // mostra em que ESTÁGIO a Lisa está (não só a última frase dita) e o código sendo escrito.
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [codeModalPos, setCodeModalPos] = useState({ x: 60, y: 50 });
  // grande de propósito, tipo editor de verdade (VS Code aberto) — não uma janelinha de
  // chat. O usuário pode redimensionar/arrastar/minimizar à vontade depois de aberta.
  const [codeModalSize, setCodeModalSize] = useState({ width: 1040, height: 720 });
  const [codeModalMaximized, setCodeModalMaximized] = useState(false);
  const [codeModalMinimized, setCodeModalMinimized] = useState(false);
  const [codeActiveTab, setCodeActiveTab] = useState(null); // path da aba escolhida à mão; null = segue o arquivo sendo escrito agora
  const [codeStage, setCodeStage] = useState(null); // 'context'|'writing'|'branching'|'committing'|'pr'|'done'|'error'
  const CODE_STAGE_LABELS = {
    context: "🔍 buscando contexto",
    "context-select": "🧭 escolhendo os arquivos certos",
    "context-fetch": "📖 lendo o conteúdo dos arquivos",
    planning: "🧠 decidindo o que muda",
    writing: "✍️ escrevendo o código",
    fixing: "🔧 corrigindo um erro de sintaxe",
    branching: "🌿 criando branch",
    committing: "📝 aplicando arquivos",
    pr: "🔀 abrindo pull request",
    done: "✅ concluído",
    error: "⚠ erro",
  };
  const onCodeModalDragStart = useCallback((e) => {
    if (codeModalMaximized) return; // maximizada preenche a tela — arrastar não faz sentido
    const startX = e.clientX, startY = e.clientY;
    const origX = codeModalPos.x, origY = codeModalPos.y;
    const onMove = (ev) => setCodeModalPos({ x: origX + (ev.clientX - startX), y: origY + (ev.clientY - startY) });
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [codeModalPos, codeModalMaximized]);
  const onCodeModalResizeStart = useCallback((e) => {
    e.stopPropagation();
    if (codeModalMaximized) return;
    const startX = e.clientX, startY = e.clientY;
    const origW = codeModalSize.width, origH = codeModalSize.height;
    const onMove = (ev) => setCodeModalSize({
      width: Math.max(380, origW + (ev.clientX - startX)),
      height: Math.max(260, origH + (ev.clientY - startY)),
    });
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [codeModalSize, codeModalMaximized]);

  useEffect(() => {
    fetch("/api/code-repos").then((r) => r.json()).then((d) => { if (d.ok) setCodeModeRepos((d.repos || []).filter((r) => r.enabled)); }).catch(() => {});
  }, []);

  useEffect(() => {
    setCodeModeBranch("");
    setCodeModeBranches([]);
    setCodeModeFiles([]);
    setCodeModeAvailableFiles([]);
    setCodeSession(null); // trocou de repositório — a sessão de continuação (branch/PR em andamento) não faz mais sentido
    if (!codeModeRepo) return;
    fetch(`/api/code-repos/branches?repo=${encodeURIComponent(codeModeRepo)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setCodeModeBranches(d.branches || []);
          const found = codeModeRepos.find((r) => r.full_name === codeModeRepo);
          setCodeModeBranch(found?.default_branch && d.branches.includes(found.default_branch) ? found.default_branch : d.branches[0] || "");
        }
      })
      .catch(() => {});
    fetch(`/api/code-repos/files?repo=${encodeURIComponent(codeModeRepo)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCodeModeAvailableFiles(d.files || []); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeModeRepo]);

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

  // fila de TTS: 1 chamada só por resposta (o texto INTEIRO, mandado quando a resposta
  // termina de chegar) — de propósito, não mais "cabeça + resto" em 2 chamadas separadas.
  // O ganho de latência de começar a falar mais cedo (antes da resposta toda chegar) não
  // valia o preço: cabeça e resto eram decididos quase-independentemente, e se um desse
  // certo com o Gemini e o outro não, a MESMA resposta saía com duas vozes diferentes no
  // meio — nem o travamento de engenharia (engineDecisionRef abaixo) resolvia isso de
  // verdade, porque a falha podia vir DEPOIS da cabeça já ter decidido (e começado a tocar).
  const speechQueueRef = useRef(Promise.resolve()); // ordem de REPRODUÇÃO (espera o áudio anterior acabar de tocar)
  // ordem de DECISÃO do motor (gemini/navegador) entre RESPOSTAS diferentes — evita que uma
  // pergunta nova decida seu motor antes da anterior ainda estar sendo decidida.
  const engineDecisionRef = useRef(Promise.resolve());
  const speechGenRef = useRef(0); // pergunta nova invalida pedaços pendentes de uma pergunta antiga
  // voz "travada" pra resposta atual: null = ainda não decidiu, "gemini" ou "browser".
  // A cabeça decide; se cair pro navegador, o resto desta MESMA resposta continua no
  // navegador (nunca alterna de novo dentro da mesma resposta).
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
  // "user" = frontal, "environment" = traseira — só faz diferença de verdade no celular (a
  // maioria dos notebooks só tem uma câmera). Não persiste em localStorage de propósito,
  // mesmo motivo do resto do Modo Observância: cada sessão começa do mesmo jeito.
  const [cameraFacing, setCameraFacing] = useState("user");
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
    // "ideal" (não "exact") — em aparelho sem câmera traseira de verdade, cai pra qualquer
    // câmera disponível em vez de falhar com OverconstrainedError.
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: cameraFacing } }, audio: false })
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
  }, [observanceMode, cameraFacing]);

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

  // ---- Gesto de acordar (✌️ V de vitória) — com o Modo Observância ligado, mostrar esse
  // gesto pra câmera faz a Lisa perguntar "o que você precisa?" e já abrir o microfone
  // sozinha, sem precisar tocar em nada — pensado pra quando você NEM está olhando pra tela.
  // Usa @mediapipe/tasks-vision (reconhecimento de gestos pronto do Google, rodando local no
  // navegador via WASM — os arquivos ficam em public/mediapipe/, sem depender de nenhum CDN
  // externo em runtime) — não tenta reconhecer um gesto "customizado" (isso exigiria treinar
  // um modelo do zero, caro e nada garantido); usa um dos gestos JÁ reconhecidos de fábrica.
  const gestureRecognizerRef = useRef(null);
  const lastGestureTriggerRef = useRef(0);
  const GESTURE_COOLDOWN_MS = 4000; // evita disparar de novo enquanto ainda está segurando o gesto
  const GESTURE_CONFIDENCE_MIN = 0.6;
  // espelham estado que ainda não foi declarado neste ponto do arquivo (stopSpeaking/toggleMic
  // vêm depois) — sem isso, o efeito abaixo teria que depender deles e recarregaria o
  // reconhecedor de gestos (modelo de ~8MB) toda vez que qualquer coisa nem relacionada
  // mudasse. As atribuições reais ficam perto de onde cada um é declarado, mais abaixo.
  const stopSpeakingForGestureRef = useRef(null);
  const toggleMicForGestureRef = useRef(null);
  const listeningForGestureRef = useRef(listening);
  listeningForGestureRef.current = listening;
  const busyForGestureRef = useRef(busy);
  busyForGestureRef.current = busy;

  const triggerWake = useCallback(async () => {
    addLog("[GESTO]", PU, "✌️ detectado — acordando");
    stopSpeakingForGestureRef.current?.();
    try {
      await speakText("Oi! O que você precisa?", { voiceName: voiceNameForScreenRef.current });
    } catch {
      // segue e abre o mic mesmo se a fala falhar — o gesto não pode ficar "preso" por isso
    }
    toggleMicForGestureRef.current?.();
  }, [addLog]);

  useEffect(() => {
    if (!observanceMode) {
      gestureRecognizerRef.current?.close?.();
      gestureRecognizerRef.current = null;
      return;
    }
    let cancelled = false;
    let intervalId = null;
    (async () => {
      try {
        const { GestureRecognizer, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/mediapipe/gesture_recognizer.task", delegate: "GPU" },
          runningMode: "VIDEO",
        });
        if (cancelled) { recognizer.close(); return; }
        gestureRecognizerRef.current = recognizer;
        addLog("[GESTO]", GR, "reconhecimento pronto — mostra ✌️ pra câmera pra chamar a Lisa");

        intervalId = setInterval(() => {
          const v = observanceVideoRef.current;
          const rec = gestureRecognizerRef.current;
          if (!v || !rec || !v.videoWidth) return;
          try {
            const result = rec.recognizeForVideo(v, performance.now());
            const top = result?.gestures?.[0]?.[0];
            if (top?.categoryName === "Victory" && top.score >= GESTURE_CONFIDENCE_MIN) {
              const now = Date.now();
              if (
                now - lastGestureTriggerRef.current > GESTURE_COOLDOWN_MS &&
                !listeningForGestureRef.current &&
                !busyForGestureRef.current
              ) {
                lastGestureTriggerRef.current = now;
                triggerWake();
              }
            }
          } catch {
            // detecção falhou num frame isolado — ignora, tenta de novo no próximo tick
          }
        }, 400);
      } catch (err) {
        if (!cancelled) addLog("[GESTO]", OR, `não consegui iniciar reconhecimento de gestos: ${err?.message || err}`);
      }
    })();
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      gestureRecognizerRef.current?.close?.();
      gestureRecognizerRef.current = null;
    };
  }, [observanceMode, addLog, triggerWake]);

  // ---- Modo Tela: a Lisa "vê" a tela do computador (getDisplayMedia) — DESKTOP-ONLY (o
  // toggle só existe no branch desktop deste componente, "enquanto mexo no PC"), com 2
  // modos que se somam:
  //  - reativo: liga a captura, e cada pergunta manda um retrato ATUAL da tela junto (mesmo
  //    mecanismo do Modo Observância — ver captureObservanceFrame acima).
  //  - proativo (screenAutoComment): além disso, vigia sozinha num intervalo configurável
  //    (screenIntervalMs) e só fala alguma coisa quando o Gemini decide que há algo
  //    genuinamente digno de nota (ver /api/screen-comment) — na maioria das vezes fica
  //    quieta. Um direcionamento livre (screenFocus) pode ser dado pra pautar o que ela
  //    prioriza notar.
  // O navegador SEMPRE pede permissão nativa (escolher tela/janela/aba) — isso não dá pra
  // pular, é trava de segurança do próprio Chrome/Edge. Igual à câmera, sem localStorage de
  // propósito (não fica ligado sozinho na próxima vez que abrir o app).
  const SCREEN_INTERVAL_OPTIONS = [
    { value: 5000, label: "5 segundos" },
    { value: 15000, label: "15 segundos" },
    { value: 30000, label: "30 segundos" },
    { value: 60000, label: "1 minuto" },
    { value: 120000, label: "2 minutos" },
    { value: 300000, label: "5 minutos" },
  ];
  const [screenMode, setScreenMode] = useState(false);
  const [screenAutoComment, setScreenAutoComment] = useState(false);
  const [screenError, setScreenError] = useState(null);
  const [screenIntervalMs, setScreenIntervalMs] = useState(30000); // com o pool de 35 chaves, intervalos curtos deixaram de ser um problema de cota
  const [screenFocus, _setScreenFocus] = useState(""); // direcionamento livre: "preste atenção em X" — some no prompt da vigília
  const screenFocusRef = useRef(""); // lido fresco a cada tick, sem reiniciar o intervalo a cada tecla digitada
  screenFocusRef.current = screenFocus;
  const screenVideoRef = useRef(null);
  const screenStreamRef = useRef(null);

  // carrega intervalo/direcionamento salvos — preferências de fluxo de trabalho, não segredo
  // nenhum, então (ao contrário do próprio toggle da câmera/tela) tudo bem persistir entre sessões
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedMs = Number(localStorage.getItem("screenIntervalMs"));
    if (SCREEN_INTERVAL_OPTIONS.some((o) => o.value === savedMs)) setScreenIntervalMs(savedMs);
    const savedFocus = localStorage.getItem("screenFocus");
    if (savedFocus) _setScreenFocus(savedFocus);
  }, []);

  const chooseScreenInterval = useCallback((ms) => {
    setScreenIntervalMs(ms);
    if (typeof window !== "undefined") localStorage.setItem("screenIntervalMs", String(ms));
  }, []);

  const updateScreenFocus = useCallback((text) => {
    _setScreenFocus(text);
    if (typeof window !== "undefined") localStorage.setItem("screenFocus", text);
  }, []);

  useEffect(() => {
    if (!screenMode) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenAutoComment(false); // sem tela, comentário automático não tem o que analisar
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      setScreenError("este navegador não suporta compartilhamento de tela");
      setScreenMode(false);
      return;
    }
    let cancelled = false;
    setScreenError(null);
    navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        screenStreamRef.current = stream;
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
          screenVideoRef.current.play().catch(() => {});
        }
        // se a pessoa parar o compartilhamento pelo controle nativo do navegador (barra
        // "parar de compartilhar"), desliga o modo aqui também — senão o app acha que ainda tem tela
        const [track] = stream.getVideoTracks();
        track?.addEventListener("ended", () => setScreenMode(false));
      })
      .catch((err) => {
        if (cancelled) return;
        setScreenError(err?.name === "NotAllowedError" ? "permissão de compartilhamento de tela negada" : (err?.message || "não consegui iniciar o compartilhamento de tela"));
        setScreenMode(false);
      });
    return () => {
      cancelled = true;
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    };
  }, [screenMode]);

  // retrato ATUAL da tela — maior que a foto da câmera (1280px) porque precisa dar pra ler
  // texto/UI pequena, não só reconhecer forma/cor.
  const captureScreenFrame = useCallback(() => {
    const v = screenVideoRef.current;
    if (!v || !v.videoWidth) return null;
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(v, 0, 0, w, h);
    const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    return base64 ? { mimeType: "image/jpeg", data: base64 } : null;
  }, []);

  // espelham o valor mais recente em ref — de propósito NÃO entram nas deps do efeito de
  // vigília abaixo, senão ligar/desligar a voz no meio da sessão reiniciaria a vigília
  // (e dispararia uma checagem extra na hora, gastando cota à toa por causa de um toggle
  // que não tem nada a ver com o Modo Tela).
  const personaModeForScreenRef = useRef(personaMode);
  personaModeForScreenRef.current = personaMode;
  const voiceOnForScreenRef = useRef(voiceOn);
  voiceOnForScreenRef.current = voiceOn;
  const voiceNameForScreenRef = useRef(voiceName);
  voiceNameForScreenRef.current = voiceName;

  // vigília proativa: dispara já na hora de ligar (pra dar sinal de vida imediato, em vez de
  // ficar quieta os primeiros 4 min sem dar pra saber se está funcionando) e depois em
  // intervalos espaçados — SÓ fala quando /api/screen-comment devolve um comentário de
  // verdade; toda tentativa (com ou sem comentário, com ou sem erro) fica registrada no
  // log — sem isso, "nada digno de nota" e "falhou por cota" pareciam a mesma coisa: silêncio.
  // Usa a voz do NAVEGADOR (não a do Gemini) de propósito, igual ao NotificationToasts: evita
  // gastar cota de TTS extra numa fala que ninguém pediu, e não mexe na fila/geração de fala
  // da conversa principal (não interrompe uma resposta em andamento).
  useEffect(() => {
    if (!screenMode || !screenAutoComment) return;
    let cancelled = false;
    const tick = async () => {
      const frame = captureScreenFrame();
      if (!frame) { addLog("[TELA]", OR, "vigília: sem retrato da tela ainda (compartilhamento iniciando?)"); return; }
      try {
        const res = await fetch("/api/screen-comment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: frame, personaMode: personaModeForScreenRef.current, focus: screenFocusRef.current || null }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!data?.ok) { addLog("[TELA]", OR, `vigília falhou: ${data?.error || `HTTP ${res.status}`}`); return; }
        if (!data.comment) { addLog("[TELA]", CY, "vigília: nada digno de nota agora"); return; }
        addLog("[TELA]", PU, data.comment);
        setMessages((m) => [...m, { id: `screen${Date.now()}`, role: "assistant", text: data.comment }]);
        // tenta a voz do Gemini primeiro (com fallback automático pro navegador se falhar) —
        // antes era só navegador de propósito, pra poupar cota; agora que tem uma chave
        // prioritária com faturamento e folga de sobra, vale usar a voz de verdade aqui também.
        // Mas só fala se a Lisa NÃO estiver falando nada agora (resposta em andamento, ou
        // acabou de acordar com o gesto) — comentário passivo da vigília nunca deve entrar
        // por cima de uma fala explícita; o texto ainda aparece no chat/log de qualquer jeito.
        const jaFalando = !!audioRef.current || isBrowserVoiceAudioPlaying() || (typeof window !== "undefined" && window.speechSynthesis?.speaking);
        if (jaFalando) addLog("[TELA]", CY, "vigília: comentário achado, mas a Lisa já está falando — só no texto desta vez");
        else if (voiceOnForScreenRef.current) speakText(data.comment, { voiceName: voiceNameForScreenRef.current }).catch(() => {});
      } catch (err) {
        if (!cancelled) addLog("[TELA]", OR, `vigília falhou: ${err?.message || err}`);
      }
    };
    // pequeno atraso na 1ª chamada — dá tempo do <video> do compartilhamento (outro efeito,
    // ligado por screenMode) realmente começar a produzir frames antes da 1ª tentativa
    const kickoff = setTimeout(tick, 1000);
    const id = setInterval(tick, screenIntervalMs);
    return () => { cancelled = true; clearTimeout(kickoff); clearInterval(id); };
  }, [screenMode, screenAutoComment, screenIntervalMs, captureScreenFrame, addLog]);

  // ---- Modo Observância (proativo): saudação pré-configurada — enquanto a câmera estiver
  // ligada, a Lisa "de olho" sozinha (nenhuma pergunta precisa ser feita); se aparecer a
  // esposa do usuário (Alice) ou a cachorra da família (Nala), cumprimenta e puxa papo
  // sozinha (comportamento fixo, ver CAMERA_WATCH_INSTRUCTION em src/lib/gemini.js). Mesmo
  // padrão da vigília do Modo Tela acima — dispara logo ao ligar, depois em intervalos
  // espaçados, só fala quando /api/camera-comment devolver um comentário de verdade. Ao
  // contrário do Modo Tela, não tem toggle separado de "auto" — o usuário pediu que rode
  // sempre que a Observância estiver ligada.
  useEffect(() => {
    if (!observanceMode) return;
    let cancelled = false;
    const tick = async () => {
      const frame = captureObservanceFrame();
      if (!frame) { addLog("[OBS]", OR, "saudação: sem retrato da câmera ainda"); return; }
      try {
        const res = await fetch("/api/camera-comment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: frame, personaMode: personaModeForScreenRef.current }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!data?.ok) { addLog("[OBS]", OR, `saudação falhou: ${data?.error || `HTTP ${res.status}`}`); return; }
        if (!data.comment) { addLog("[OBS]", CY, "saudação: nada digno de nota agora"); return; }
        addLog("[OBS]", PU, data.comment);
        setMessages((m) => [...m, { id: `obsgreet${Date.now()}`, role: "assistant", text: data.comment }]);
        // mesma regra de prioridade de voz da vigília do Modo Tela — nunca fala por cima de
        // uma fala já em andamento (resposta normal, ou saudação do gesto de acordar).
        const jaFalando = !!audioRef.current || isBrowserVoiceAudioPlaying() || (typeof window !== "undefined" && window.speechSynthesis?.speaking);
        if (jaFalando) addLog("[OBS]", CY, "saudação: comentário achado, mas a Lisa já está falando — só no texto desta vez");
        else if (voiceOnForScreenRef.current) speakText(data.comment, { voiceName: voiceNameForScreenRef.current }).catch(() => {});
      } catch (err) {
        if (!cancelled) addLog("[OBS]", OR, `saudação falhou: ${err?.message || err}`);
      }
    };
    const kickoff = setTimeout(tick, 1500);
    const id = setInterval(tick, 30000); // sem seletor de intervalo (diferente do Modo Tela) — 30s é um meio-termo entre responsivo e não gastar cota à toa
    return () => { cancelled = true; clearTimeout(kickoff); clearInterval(id); };
  }, [observanceMode, captureObservanceFrame, addLog]);

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

  // lista de repositórios conhecidos pro seletor manual do escopo "Código"
  useEffect(() => {
    let alive = true;
    fetch("/api/code-repos")
      .then((r) => r.json())
      .then((d) => { if (alive && d.ok) setCodeRepos(d.repos || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // arquivos já indexados do repositório escolhido — refaz sempre que o repositório muda;
  // "all" (todos os repositórios) não tem lista de arquivo nenhuma (não dá pra ler "um
  // arquivo" sem saber de qual repo).
  useEffect(() => {
    setCodeFile(""); // troca de repositório invalida o arquivo escolhido antes
    if (codeRepo === "all") { setCodeFiles([]); return; }
    let alive = true;
    fetch(`/api/code-repos/files?repo=${encodeURIComponent(codeRepo)}`)
      .then((r) => r.json())
      .then((d) => { if (alive && d.ok) setCodeFiles(d.files || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [codeRepo]);

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
    // corta TAMBÉM qualquer áudio tocado via speakText() (vigília do Modo Tela, saudação do
    // gesto) — esse pipeline usa um <audio> próprio, fora do audioRef acima. Sem isto, "parar"
    // só cortava o pipeline principal e a vigília/gesto continuavam falando por cima.
    stopBrowserVoiceAudio();
  }, []);
  stopSpeakingForGestureRef.current = stopSpeaking;

  // teto de espera pela voz do Gemini — só uma rede de segurança pra uma chamada REALMENTE
  // travada (nunca volta), NÃO uma tentativa de "acelerar" a resposta. Já errei esse número
  // pra menos duas vezes: 3,2s matava toda chamada; depois 9s ainda cortava o servidor no
  // meio das PRÓPRIAS 3 tentativas dele (retry com espera do lado do servidor soma tempo
  // real, e o corte no navegador chegava antes do servidor terminar de tentar); depois 20s
  // ainda derrubava respostas que estavam pra dar certo (com as chaves TODAS saudáveis no
  // painel /gemini-keys — ou seja, não era cota, era só o Gemini demorando mais do que 20s
  // pra sintetizar áudio às vezes). A Vercel já tem um teto absoluto de 60s pra função (ver
  // maxDuration em /api/speak) — 45s dá bastante margem real sem deixar o navegador esperando
  // depois que o servidor já teria desistido sozinho.
  const SPEAK_TIMEOUT_MS = 45000;
  // contador visível NA CONVERSA (não só no log de debug) enquanto espera — null = não está
  // esperando voz nenhuma; número = segundos decorridos desde que a chamada começou. Existe
  // pra deixar claro que a Lisa ainda está tentando a voz do Gemini (não travou), com quanto
  // falta pro teto acima antes de cair pro navegador.
  const [ttsWaitSeconds, setTtsWaitSeconds] = useState(null);

  const synthesizeChunk = useCallback(async (text) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SPEAK_TIMEOUT_MS);
    const startedAt = Date.now();
    setTtsWaitSeconds(0);
    const tickId = setInterval(() => setTtsWaitSeconds(Math.round((Date.now() - startedAt) / 1000)), 1000);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, voice: voiceName }),
        signal: controller.signal,
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
      return { url: null, error: err?.name === "AbortError" ? new Error(`Gemini demorou mais de ${SPEAK_TIMEOUT_MS / 1000}s`) : err };
    } finally {
      clearInterval(tickId);
      setTtsWaitSeconds(null);
      clearTimeout(timeout);
    }
  }, [voiceName]);

  // Decide o motor (gemini/navegador) DESTE pedaço — chamado só depois que o pedaço anterior
  // já teve o motor dele decidido (ver enqueueSpeech), nunca antes. Fica de fora da fila de
  // REPRODUÇÃO de propósito: decidir é rápido (só espera a resposta do /api/speak, não o
  // áudio tocar até o fim), então o próximo pedaço já pode começar a sintetizar enquanto o
  // atual ainda está sendo ouvido — é isso que fecha o gap sem reabrir a corrida de voz.
  const resolveChunkEngine = useCallback(async (tryGemini, text) => {
    const result = tryGemini ? await synthesizeChunk(text) : { url: null, skipped: true };
    if (result?.url) {
      speechEngineRef.current = "gemini";
      setGeminiVoiceStatus(true);
      geminiDownUntilRef.current = 0; // deu certo — desarma o disjuntor, se estivesse armado
    } else {
      // sem áudio do Gemini pra este pedaço — cai pra voz do navegador. Se isso já
      // aconteceu na cabeça desta resposta, o resto nem tenta o Gemini de novo (evita
      // alternar de voz no meio da fala).
      if (!result?.skipped) {
        const reason = String(result?.error?.message || "").slice(0, 90);
        const cooldownSec = Math.round(GEMINI_COOLDOWN_MS / 1000);
        addLog("[TTS]", OR, `Gemini indisponível${reason ? ` (${reason})` : ""} → voz do navegador (sem tentar de novo por ${cooldownSec}s)`);
        setGeminiVoiceStatus(false); // só marca "falhou" numa tentativa real — não quando foi pulada de propósito
        // ARMA o disjuntor: falha de verdade → some tentar o Gemini de novo por um tempo,
        // em vez de já testar de novo na próxima pergunta (é isso que causava a alternância).
        geminiDownUntilRef.current = Date.now() + GEMINI_COOLDOWN_MS;
      }
      speechEngineRef.current = "browser";
    }
    return result;
  }, [synthesizeChunk, addLog]);

  const playResult = useCallback((result, text, gen) => {
    if (gen !== speechGenRef.current) {
      if (result?.url) URL.revokeObjectURL(result.url);
      return;
    }
    return new Promise((resolve) => {
      currentAudioResolveRef.current = resolve;
      const finish = () => { currentAudioResolveRef.current = null; resolve(); };

      if (result?.url) {
        const audio = new Audio(result.url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(result.url); audioRef.current = null; addLog("[TTS]", GR, "voz Gemini"); finish(); };
        audio.onerror = () => { URL.revokeObjectURL(result.url); audioRef.current = null; finish(); };
        audio.play().catch(finish);
      } else {
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
  }, [addLog]);

  const enqueueSpeech = useCallback((text, gen) => {
    const clean = (text || "").trim();
    if (!clean) return;

    // fila de DECISÃO: só decide se tenta o Gemini pra este pedaço depois que o pedaço
    // anterior já sabe o motor dele — fecha a corrida em que, numa resposta curta, o "resto"
    // decidia tentar o Gemini antes de saber se a "cabeça" tinha falhado (a chamada de TTS é
    // mais lenta que o streaming do texto, às vezes) — daí cabeça e resto saíam em vozes
    // diferentes. Rápido (não espera áudio tocar), então não reabre o gap que isso evita.
    const thisDecision = engineDecisionRef.current.then(() => {
      if (gen !== speechGenRef.current) return { url: null, skipped: true };
      const tryGemini = geminiVoiceEnabled && speechEngineRef.current !== "browser" && Date.now() >= geminiDownUntilRef.current;
      return resolveChunkEngine(tryGemini, clean);
    });
    engineDecisionRef.current = thisDecision.catch(() => ({ url: null, skipped: true }));

    // fila de REPRODUÇÃO: toca em ordem, esperando o pedaço anterior acabar de tocar — mas o
    // motor deste pedaço, acima, já pode estar decidido bem antes disso.
    speechQueueRef.current = speechQueueRef.current.then(async () => {
      const result = await thisDecision;
      if (gen !== speechGenRef.current) return;
      return playResult(result, clean, gen);
    });
  }, [resolveChunkEngine, playResult, geminiVoiceEnabled]);

  // ---- escopo do assistente ----
  const computeScope = useCallback(() => {
    if (scopeMode === "general") return { mode: "general" };
    if (scopePanel === TASKS_SCOPE) return { mode: "panel", range: "auto" };
    if (scopePanel === THOUGHTS_SCOPE) return { mode: "panel", source: "brain" };
    if (scopePanel === SENTINEL_SCOPE) return { mode: "panel", source: "sentinel", projectId: sentinelProjectId };
    // escolher este escopo explicitamente JÁ É o consentimento pra falar de tarefas da Delp —
    // não passa pelo "quer que eu leve em conta a Delp?" (ver /api/ask), que só existe pra
    // quando o assunto surge sem o usuário ter pedido isso de propósito.
    if (scopePanel === DELP_SCOPE) return { mode: "panel", source: "delp" };
    if (scopePanel === CODE_SCOPE) return { mode: "panel", source: "github", repo: codeRepo !== "all" ? codeRepo : null, path: codeFile || null };
    return { mode: "panel", board: scopePanel };
  }, [scopeMode, scopePanel, sentinelProjectId, codeRepo, codeFile]);

  // ---- Modo Código: em vez de conversar, PROPÕE uma mudança de código (branch nova + PR) —
  // narra cada fase (fala e mostra o texto) e mostra o código de cada arquivo sendo escrito
  // ao vivo, ver /api/code-tasks/stream e runCodeTaskStreaming em src/lib/codeTasks.js.
  // Roda UM passo (um pedido HTTP próprio, seu PRÓPRIO teto de 60s — ver /api/code-tasks/step)
  // e devolve o que aconteceu ({taskId, done, ok, error?, pr_url?}) — askCodeMode chama isso
  // em loop até `done`. Cada passo tem sua fresh janela de 60s, então a tarefa inteira nunca
  // mais fica presa a uma conexão única (era isso que estourava com pedidos maiores).
  const runCodeModeStep = useCallback(async ({ taskId, repo, baseBranch, instruction, filePaths, continueBranch, existingPrUrl, gen, narrationSoFarRef, voiceEnabled }) => {
    const res = await fetch("/api/code-tasks/step", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId, repo, baseBranch, instruction, filePaths, continueBranch, existingPrUrl }),
    });
    if (!res.ok || !res.body) { const e = new Error(`HTTP ${res.status}`); e.taskId = taskId; throw e; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let stepDone = null; // payload do evento "step_done" deste passo, se chegou
    let seenTaskId = taskId; // capturado do 1º evento que trouxer um (stage já traz, não só step_done) —
    // assim, mesmo se a conexão cair antes do step_done, dá pra RETOMAR pelo mesmo taskId em
    // vez de criar uma tarefa nova do zero.

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
        try { payload = JSON.parse(data); } catch { continue; }
        if (payload.taskId) seenTaskId = payload.taskId;

        if (event === "stage") {
          setCodeStage(payload.stage);
        } else if (event === "narration") {
          setMode("speaking");
          narrationSoFarRef.current += (narrationSoFarRef.current ? "\n\n" : "") + payload.text;
          setAnswer(narrationSoFarRef.current);
          answerRef.current = narrationSoFarRef.current;
          addLog("[CÓDIGO]", PU, payload.text);
          // fala CADA narração conforme chega — a fila de fala já criada pra respostas
          // normais (enqueueSpeech) toca cada uma em ordem sozinha, mesmo vindo de vários
          // pedidos HTTP separados (um por passo).
          if (voiceEnabled) enqueueSpeech(payload.text, gen);
        } else if (event === "file_start") {
          currentCodeFileRef.current = { path: payload.path, content: "" };
          setLiveCode({ path: payload.path, content: "" });
        } else if (event === "file_chunk") {
          if (currentCodeFileRef.current?.path === payload.path) {
            currentCodeFileRef.current.content += payload.text;
            setLiveCode({ path: payload.path, content: currentCodeFileRef.current.content });
          }
        } else if (event === "file_end") {
          if (currentCodeFileRef.current?.path === payload.path) {
            setLiveCodeDone((d) => [...d, currentCodeFileRef.current]);
          }
          currentCodeFileRef.current = null;
          setLiveCode(null);
        } else if (event === "step_done") {
          stepDone = payload;
        }
      }
    }

    // esse PASSO fechou sem "step_done" — o teto de 60s matou a função no meio dele. Como
    // cada passo agora é bem menor que a tarefa inteira, isso deve ser raro, mas ainda pode
    // acontecer com o Gemini mais lento que o normal. Não é motivo pra desistir — quem chama
    // (askCodeMode) tenta de novo automaticamente, retomando pelo MESMO taskId (o passo que
    // foi cortado simplesmente refaz do zero, já que nada foi salvo em code_tasks.state até
    // ele terminar).
    if (!stepDone) { const e = new Error("um passo da tarefa foi cortado no meio (estourou 60s) — tentando de novo sozinha"); e.taskId = seenTaskId; throw e; }
    return stepDone;
  }, [addLog, enqueueSpeech]);

  const askCodeMode = useCallback(async (q) => {
    if (!codeModeRepo || !codeModeBranch) {
      addLog("[CÓDIGO]", OR, "escolha um repositório e uma branch base antes de pedir uma mudança");
      return;
    }
    setBusy(true);
    setQuestion(q);
    setAnswer("");
    answerRef.current = "";
    setMode("listening");
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", text: q, codeMode: true }]);
    setLiveCode(null);
    setLiveCodeDone([]);
    currentCodeFileRef.current = null;
    setCodeStage(null);
    setCodeActiveTab(null);
    setCodeModalMinimized(false);
    setCodeModalOpen(true); // abre sozinha assim que a tarefa começa — não precisa procurar; fica aberta entre pedidos, não fecha sozinha

    stopSpeaking();
    const gen = ++speechGenRef.current;
    speechEngineRef.current = null;
    const voiceEnabled = voiceOn;
    const narrationSoFarRef = { current: "" };

    // continua na MESMA branch/PR de uma sessão anterior (mesmo repo+branch base) — assim
    // "corrige esse erro" vira um commit A MAIS na branch já aberta, não uma tarefa do zero.
    const continuing = codeSession && codeSession.repo === codeModeRepo && codeSession.baseBranch === codeModeBranch ? codeSession : null;

    try {
      let taskId = null;
      let stepResult = null;
      // chama /api/code-tasks/step repetidas vezes — cada chamada é UM PASSO (contexto,
      // planejamento, 1 arquivo escrito, criar branch, 1 arquivo commitado, ou abrir o PR) —
      // até a tarefa inteira terminar. Nunca mais uma única conexão carrega a tarefa toda.
      // Sem pressa nenhuma: se UM passo isolado falhar (rede, ou raramente estourar os 60s
      // mesmo já sendo pequeno), tenta de novo sozinha em vez de desistir e jogar o erro pro
      // usuário — só desiste de verdade depois de várias tentativas seguidas falhando.
      let retries = 0;
      const MAX_RETRIES = 20;
      do {
        try {
          stepResult = await runCodeModeStep({
            taskId, repo: codeModeRepo, baseBranch: codeModeBranch, instruction: q,
            filePaths: [...codeModeFiles, ...(continuing?.files || [])],
            continueBranch: continuing?.branchName, existingPrUrl: continuing?.prUrl,
            gen, narrationSoFarRef, voiceEnabled,
          });
          retries = 0; // um passo deu certo — zera a contagem, só desiste de vez em falhas SEGUIDAS
        } catch (stepErr) {
          taskId = stepErr.taskId ?? taskId;
          retries++;
          if (retries > MAX_RETRIES) throw stepErr;
          addLog("[CÓDIGO]", OR, `${stepErr.message} (tentativa ${retries}/${MAX_RETRIES})`);
          await new Promise((r) => setTimeout(r, Math.min(2000 * retries, 15000)));
          continue;
        }
        taskId = stepResult.taskId ?? taskId;
      } while (!stepResult?.done);

      setCodeStage(stepResult.ok ? "done" : "error");
      const finalText = stepResult.ok
        ? `${narrationSoFarRef.current}\n\nPR ${continuing ? "atualizado" : "aberto"}: ${stepResult.pr_url}`
        : `${narrationSoFarRef.current}${narrationSoFarRef.current ? "\n\n" : ""}⚠ ${stepResult.error || "não consegui completar a tarefa"}`;
      setAnswer(finalText);
      setMessages((m) => [...m, { id: `a${Date.now()}`, role: "assistant", text: finalText, codeMode: true }]);
      if (stepResult.ok) {
        addLog("[CÓDIGO]", GR, `PR ${continuing ? "atualizado" : "aberto"}: ${stepResult.pr_url}`);
        // guarda a sessão pro PRÓXIMO pedido continuar na mesma branch/PR em vez de recomeçar
        setCodeSession({
          repo: codeModeRepo, baseBranch: codeModeBranch,
          branchName: stepResult.branchName, prUrl: stepResult.pr_url,
          files: stepResult.files || [],
        });
      } else {
        addLog("[CÓDIGO]", OR, stepResult.error || "falhou");
      }
    } catch (err) {
      setCodeStage("error");
      addLog("[CÓDIGO]", OR, err.message);
      const finalText = `${narrationSoFarRef.current}${narrationSoFarRef.current ? "\n\n" : ""}⚠ ${err.message}`;
      setAnswer(finalText);
      setMessages((m) => [...m, { id: `a${Date.now()}`, role: "assistant", text: finalText, codeMode: true }]);
    } finally {
      setBusy(false);
      setMode("idle");
      currentCodeFileRef.current = null;
      setLiveCode(null);
    }
  }, [codeModeRepo, codeModeBranch, codeModeFiles, codeSession, addLog, voiceOn, stopSpeaking, enqueueSpeech, runCodeModeStep]);

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

    // Modo Código ligado: a pergunta vira um pedido de mudança de código, não uma conversa —
    // ver askCodeMode acima.
    if (codeMode) return askCodeMode(q);

    setBusy(true);
    setQuestion(q);
    setAnswer("");
    answerRef.current = "";
    setCards([]);
    setMode("listening");
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", text: q }]);

    stopSpeaking(); // corta qualquer fala de uma resposta anterior
    const gen = ++speechGenRef.current;
    speechEngineRef.current = null; // nova resposta → nova chance pro Gemini decidir a voz
    const voiceEnabled = voiceOn;

    addLog("[EMBED]", GR, "query → vector [768d]");
    addLog("[RAG]", CY, "similarity search · top_k");

    let latestCards = [];

    // câmera (Observância) e/ou tela (Modo Tela) — cada uma só entra se estiver ligada e
    // conseguir tirar o retrato; nenhuma das duas depende da outra.
    const images = [observanceMode && captureObservanceFrame(), screenMode && captureScreenFrame()].filter(Boolean);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: q, scope: computeScope(), personaMode,
          history: historyRef.current, pendingAction: pendingActionRef.current,
          images: images.length ? images : null,
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
            if (payload?.debug && payload?.detectError) addLog("[ACTION]", OR, `detecção FALHOU (não é "não entendi", é erro de verdade): ${payload.detectError}`);
            else if (payload?.debug) addLog("[ACTION]", PU, `nenhuma ação detectada (intent=${payload.checkedIntent})`);
            else if (pendingActionRef.current) addLog("[ACTION]", PU, "aguardando confirmação…");
            else addLog("[ACTION]", PU, "resolvida");
          } else if (event === "token") {
            setAnswer((a) => { const na = a + payload; answerRef.current = na; return na; });
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
      // fala a resposta INTEIRA de uma vez, só agora que terminou de chegar — 1 chamada de
      // TTS por resposta, nunca duas vozes diferentes na mesma fala (ver nota no topo do arquivo).
      const full = answerRef.current.trim();
      if (voiceEnabled && full) enqueueSpeech(full, gen);
    }
  }, [busy, addLog, voiceOn, computeScope, stopSpeaking, enqueueSpeech, personaMode, observanceMode, captureObservanceFrame, screenMode, captureScreenFrame, codeMode, askCodeMode]);

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
  toggleMicForGestureRef.current = toggleMic;

  // ---- microfone "segurar pra falar" (mobile) — igual WhatsApp: pressiona e segura o botão
  // pra falar, solta pra parar de ouvir e já mandar. toggleMic() já faz exatamente isso num
  // único disparo (liga se não estava ouvindo, desliga-e-envia se estava) — só precisa ser
  // chamado 1x no press e 1x no release, nunca os dois no mesmo evento (por isso NÃO usa
  // onClick aqui: um toque simples já dispara pointerdown+pointerup+click em sequência, e o
  // click extra chamaria toggleMic() uma 3ª vez, reabrindo o mic logo depois de soltar).
  const startMicHold = useCallback(() => {
    if (!listening && !busy) toggleMic();
  }, [listening, busy, toggleMic]);
  const stopMicHold = useCallback(() => {
    if (listening) toggleMic();
  }, [listening, toggleMic]);

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

  // Janela flutuante e arrastável do Modo Código — sobreposta, mostra o ESTÁGIO atual (não só
  // a última frase dita), o código sendo escrito e qualquer erro. Compartilhada entre o
  // layout mobile e desktop (os dois têm `return` próprios abaixo, então isso vira uma
  // variável renderizada nos dois em vez de duplicar o JSX inteiro duas vezes).
  const codeFilesOpen = [...liveCodeDone, ...(liveCode ? [liveCode] : [])];
  const codeActivePath = codeActiveTab && codeFilesOpen.some((f) => f.path === codeActiveTab)
    ? codeActiveTab
    : (liveCode ? liveCode.path : codeFilesOpen[codeFilesOpen.length - 1]?.path) || null;
  const codeActiveFile = codeFilesOpen.find((f) => f.path === codeActivePath) || null;
  const codeActiveTail = codeActiveFile ? codeActiveFile.content.slice(-6000) : "";
  const codeActiveLang = codeActiveFile ? langForPath(codeActiveFile.path) : null; // null = extensão sem gramática reconhecida, cai pro texto puro
  // paleta do realce de sintaxe — cores do próprio app (CY/PU/GR/OR + o texto
  // cyan-esbranquiçado de sempre), não a paleta padrão do Prism nem do VS Code.
  const BB_CODE_THEME = {
    plain: { color: "#cfeffb" },
    styles: [
      { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "rgba(207,239,251,0.35)", fontStyle: "italic" } },
      { types: ["string", "attr-value", "char", "inserted"], style: { color: GR } },
      { types: ["keyword", "tag", "important", "atrule", "deleted"], style: { color: PU } },
      { types: ["function", "class-name", "selector"], style: { color: CY } },
      { types: ["number", "boolean", "constant", "regex", "symbol"], style: { color: OR } },
      { types: ["punctuation", "operator"], style: { color: "rgba(207,239,251,0.55)" } },
      { types: ["property", "attr-name"], style: { color: "rgba(207,239,251,0.85)" } },
      { types: ["variable", "parameter", "builtin"], style: { color: "#eafcff" } },
    ],
  };
  const codeModeLog = messages.filter((m) => m.codeMode); // histórico só do Modo Código, pra caber inteiro na janela sem misturar com o chat normal
  const submitCodeModalInput = () => {
    const q = codeModalInput.trim();
    if (!q || busy) return;
    setCodeModalInput("");
    askCodeMode(q);
  };

  const codeTaskModal = codeModalOpen && (
    <div
      style={{
        position: "fixed", left: codeModalMaximized ? "3vw" : codeModalPos.x, top: codeModalMaximized ? "5vh" : codeModalPos.y,
        zIndex: 200, width: codeModalMaximized ? "94vw" : `min(92vw, ${codeModalSize.width}px)`,
        height: codeModalMinimized ? "auto" : (codeModalMaximized ? "88vh" : `min(80vh, ${codeModalSize.height}px)`),
        display: "flex", flexDirection: "column", overflow: "hidden",
        background: "#050b10", border: "1px solid rgba(var(--accent-rgb),0.28)", borderRadius: 10,
        boxShadow: "0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.4)",
        ...mono,
      }}
    >
      {/* barra de título — arrastável, com bolinhas de fechar/minimizar/maximizar (a função é
          universal; as cores ficam discretas pra não destoar do resto do app) */}
      <div
        onPointerDown={onCodeModalDragStart}
        onDoubleClick={() => setCodeModalMaximized((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
          background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(var(--accent-rgb),0.18)",
          cursor: codeModalMaximized ? "default" : "grab", userSelect: "none", flex: "none",
        }}
      >
        <div style={{ display: "flex", gap: 7, flex: "none" }}>
          <span
            onClick={(e) => { e.stopPropagation(); setCodeModalOpen(false); }}
            title="fechar" style={{ width: 11, height: 11, borderRadius: "50%", background: OR, cursor: "pointer", opacity: 0.75 }}
          />
          <span
            onClick={(e) => { e.stopPropagation(); setCodeModalMinimized((v) => !v); }}
            title="minimizar" style={{ width: 11, height: 11, borderRadius: "50%", background: "rgba(207,239,251,0.4)", cursor: "pointer" }}
          />
          <span
            onClick={(e) => { e.stopPropagation(); setCodeModalMaximized((v) => !v); }}
            title="maximizar" style={{ width: 11, height: 11, borderRadius: "50%", background: GR, cursor: "pointer", opacity: 0.75 }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, justifyContent: "center" }}>
          <span style={{ fontSize: 10.5, letterSpacing: 1.5, color: PU, flex: "none" }}>🛠️ MODO CÓDIGO</span>
          <span style={{ fontSize: 9.5, color: codeStage === "error" ? OR : codeStage === "done" ? GR : "rgba(207,239,251,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            — {codeStage ? CODE_STAGE_LABELS[codeStage] : "aguardando…"}
          </span>
        </div>
        <div style={{ width: 54, flex: "none", display: "flex", justifyContent: "flex-end" }}>
          {!!codeSession && (
            <span
              onClick={(e) => { e.stopPropagation(); setCodeSession(null); }}
              title="começar uma tarefa nova (branch e PR novos), em vez de continuar nesta"
              style={{ fontSize: 9, color: "rgba(207,239,251,0.5)", cursor: "pointer", textDecoration: "underline", whiteSpace: "nowrap" }}
            >
              nova tarefa
            </span>
          )}
        </div>
      </div>

      {!codeModalMinimized && (
        <>
          {/* conversa do Modo Código — fica ABERTA entre pedidos (não fecha nem esvazia
              sozinha), pra dar pra pedir "corrige esse erro" continuando o mesmo papo
              enquanto o código aparece do lado, sem precisar sair da janela */}
          <div style={{ padding: "8px 14px", background: "rgba(0,0,0,0.25)", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)", flex: "none", maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {codeModeLog.map((m) => (
              <div key={m.id} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
                <div
                  style={{
                    fontSize: 11.5, lineHeight: 1.5, whiteSpace: "pre-wrap", padding: "6px 10px", borderRadius: 6,
                    color: m.role === "user" ? "#eafcff" : "rgba(207,239,251,0.8)",
                    background: m.role === "user" ? "rgba(var(--accent-rgb),0.16)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${m.role === "user" ? "rgba(var(--accent-rgb),0.3)" : "rgba(255,255,255,0.08)"}`,
                    fontStyle: m.role === "user" ? "normal" : "italic",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div style={{ alignSelf: "flex-start", maxWidth: "88%" }}>
                <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "rgba(207,239,251,0.8)", fontStyle: "italic", whiteSpace: "pre-wrap", padding: "6px 10px" }}>
                  {answer || "…"}
                </div>
              </div>
            )}
            {!codeModeLog.length && !busy && (
              <div style={{ fontSize: 11, color: "rgba(207,239,251,0.35)" }}>peça uma mudança de código aqui embaixo, ou pela caixa principal do Assistente.</div>
            )}
          </div>

          {/* abas — um arquivo por aba, igual editor de código, clica pra ver outro já escrito */}
          {codeFilesOpen.length > 0 && (
            <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)", flex: "none", overflowX: "auto" }}>
              {codeFilesOpen.map((f) => {
                const isActive = f.path === codeActivePath;
                const isStreaming = liveCode && f.path === liveCode.path;
                const fileName = f.path.split("/").pop();
                return (
                  <div
                    key={f.path}
                    onClick={() => setCodeActiveTab(f.path)}
                    title={f.path}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                      fontSize: 11, whiteSpace: "nowrap", cursor: "pointer", flex: "none",
                      color: isActive ? "#eafcff" : "rgba(207,239,251,0.45)",
                      background: isActive ? "rgba(var(--accent-rgb),0.08)" : "transparent",
                      borderTop: `2px solid ${isActive ? PU : "transparent"}`,
                      borderRight: "1px solid rgba(var(--accent-rgb),0.08)",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: isStreaming ? OR : GR }} />
                    {fileName}
                  </div>
                );
              })}
            </div>
          )}

          {/* corpo do editor — número de linha + código com realce de sintaxe */}
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#050b10" }}>
            {codeActiveFile ? (
              codeActiveLang ? (
                <Highlight code={codeActiveTail} language={codeActiveLang} theme={BB_CODE_THEME}>
                  {({ tokens, getLineProps, getTokenProps }) => (
                    <div style={{ display: "flex", fontSize: 11.5, lineHeight: 1.55 }}>
                      <div style={{ flex: "none", padding: "8px 10px 8px 14px", textAlign: "right", color: "rgba(207,239,251,0.3)", userSelect: "none" }}>
                        {tokens.map((_, i) => <div key={i}>{i + 1}</div>)}
                      </div>
                      <pre style={{ margin: 0, padding: "8px 14px 8px 6px", whiteSpace: "pre-wrap", wordBreak: "break-all", flex: 1 }}>
                        {tokens.map((line, i) => (
                          <div key={i} {...getLineProps({ line })}>
                            {line.map((token, ti) => <span key={ti} {...getTokenProps({ token })} />)}
                          </div>
                        ))}
                      </pre>
                    </div>
                  )}
                </Highlight>
              ) : (
                <div style={{ display: "flex", fontSize: 11.5, lineHeight: 1.55 }}>
                  <div style={{ flex: "none", padding: "8px 10px 8px 14px", textAlign: "right", color: "rgba(207,239,251,0.3)", userSelect: "none" }}>
                    {codeActiveTail.split("\n").map((_, i) => <div key={i}>{i + 1}</div>)}
                  </div>
                  <pre style={{ margin: 0, padding: "8px 14px 8px 6px", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#cfeffb", flex: 1 }}>{codeActiveTail}</pre>
                </div>
              )
            ) : (
              <div style={{ padding: "16px 14px", fontSize: 11.5, color: "rgba(207,239,251,0.35)" }}>
                nenhum arquivo sendo editado ainda — a Lisa está {codeStage ? CODE_STAGE_LABELS[codeStage] : "começando"}…
              </div>
            )}
          </div>

          {/* barra de status inferior */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px", background: "rgba(0,0,0,0.4)", borderTop: "1px solid rgba(var(--accent-rgb),0.14)", flex: "none" }}>
            <span style={{ fontSize: 9.5, color: PU }}>{codeModeRepo || "—"} → {codeModeBranch || "—"}{codeSession?.branchName ? ` (${codeSession.branchName})` : ""}</span>
            <span style={{ fontSize: 9.5, color: "rgba(207,239,251,0.5)" }}>{liveCodeDone.length} arquivo(s) concluído(s)</span>
          </div>

          {/* caixa de mensagem própria da janela — dá pra continuar pedindo ajustes ("corrige
              esse erro") sem sair daqui nem voltar pra caixa principal do Assistente. Textarea
              grande de propósito (não uma linha só) — pedido mais detalhado (arquivo certo,
              texto exato do erro) dá resultado bem melhor do que uma frase curta, e precisa de
              espaço pra escrever isso com conforto. Enter envia, Shift+Enter quebra linha. */}
          <form
            onSubmit={(e) => { e.preventDefault(); submitCodeModalInput(); }}
            style={{ display: "flex", gap: 8, padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderTop: "1px solid rgba(var(--accent-rgb),0.1)", flex: "none", alignItems: "flex-end" }}
          >
            <textarea
              value={codeModalInput}
              onChange={(e) => setCodeModalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitCodeModalInput(); }
              }}
              disabled={busy}
              placeholder={busy ? "trabalhando…" : "peça outro ajuste — quanto mais detalhe (arquivo, texto exato do erro), melhor o resultado. Enter envia, Shift+Enter quebra linha."}
              rows={4}
              style={{
                flex: 1, fontSize: 11.5, lineHeight: 1.5, padding: "8px 10px", borderRadius: 5, border: "1px solid rgba(var(--accent-rgb),0.2)",
                background: "#000", color: "#eafcff", fontFamily: "inherit", resize: "vertical", minHeight: 70,
              }}
            />
            <button
              type="submit"
              disabled={busy || !codeModalInput.trim()}
              style={{
                fontSize: 10.5, padding: "8px 14px", borderRadius: 5, border: `1px solid ${PU}`,
                background: "rgba(201,166,255,0.15)", color: "#eafcff", cursor: busy ? "wait" : "pointer", flex: "none",
              }}
            >
              enviar
            </button>
          </form>

          {/* alça de redimensionar, canto inferior direito */}
          {!codeModalMaximized && (
            <div
              onPointerDown={onCodeModalResizeStart}
              title="arrastar para redimensionar"
              style={{ position: "absolute", right: 2, bottom: 2, width: 14, height: 14, cursor: "nwse-resize", opacity: 0.5 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M12 2 L2 12 M12 6 L6 12 M12 10 L10 12" stroke="rgba(207,239,251,0.5)" strokeWidth="1" /></svg>
            </div>
          )}
        </>
      )}
    </div>
  );

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
              onPointerDown={(e) => { e.preventDefault(); startMicHold(); }}
              onPointerUp={stopMicHold}
              onPointerLeave={stopMicHold}
              onPointerCancel={stopMicHold}
              onContextMenu={(e) => e.preventDefault()}
              disabled={busy}
              title="Segure pra falar, solte pra enviar"
              style={{
                marginTop: 40, width: 76, height: 76, borderRadius: "50%",
                border: `2px solid ${listening ? OR : CY}`,
                background: listening ? "rgba(255,157,61,0.15)" : "rgba(var(--accent-rgb),0.08)",
                color: listening ? OR : CY, cursor: busy ? "not-allowed" : "pointer",
                boxShadow: listening ? `0 0 24px ${OR}` : `0 0 20px rgba(var(--accent-rgb),0.4)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
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
              {ttsWaitSeconds !== null && (
                <div style={{ alignSelf: "flex-start", ...mono, fontSize: 10, color: CY, padding: "10px 14px" }}>
                  ⏳ aguardando voz do Gemini… {ttsWaitSeconds}s / {SPEAK_TIMEOUT_MS / 1000}s
                </div>
              )}
              {(liveCode || liveCodeDone.length > 0) && (
                <div style={{ alignSelf: "stretch", ...mono, fontSize: 10.5, background: "#08131a", border: `1px solid ${PU}55`, borderRadius: 8, padding: "10px 12px", maxHeight: 260, overflowY: "auto" }}>
                  {liveCodeDone.map((f) => (
                    <div key={f.path} style={{ marginBottom: 8 }}>
                      <div style={{ color: GR, marginBottom: 3 }}>✓ {f.path}</div>
                    </div>
                  ))}
                  {liveCode && (
                    <div>
                      <div style={{ color: PU, marginBottom: 3 }}>✎ {liveCode.path}</div>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "rgba(207,239,251,0.8)", fontSize: 9.5, lineHeight: 1.4 }}>{liveCode.content.slice(-2000)}</pre>
                    </div>
                  )}
                </div>
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
                onPointerDown={(e) => { e.preventDefault(); startMicHold(); }}
                onPointerUp={stopMicHold}
                onPointerLeave={stopMicHold}
                onPointerCancel={stopMicHold}
                onContextMenu={(e) => e.preventDefault()}
                disabled={busy}
                title="Segure pra falar, solte pra enviar"
                style={{ width: 42, height: 42, borderRadius: "50%", flex: "none", border: `1.5px solid ${listening ? OR : CY}`, background: listening ? "rgba(255,157,61,0.15)" : "rgba(var(--accent-rgb),0.06)", color: listening ? OR : CY, cursor: busy ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
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
                  <option value={DELP_SCOPE}>Tarefas Delp</option>
                  <option value={CODE_SCOPE}>Código</option>
                </select>
              )}
              {scopeMode === "panel" && scopePanel === SENTINEL_SCOPE && (
                <select value={sentinelProjectId} onChange={(e) => setSentinelProjectId(e.target.value)} style={{ ...mono, fontSize: 12, padding: "10px 12px", borderRadius: 6, border: `1px solid ${OR}55`, background: "#000", color: "#eafcff", width: "100%", marginBottom: 10 }}>
                  <option value="all">Todos os projetos</option>
                  {sentinelProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              {scopeMode === "panel" && scopePanel === CODE_SCOPE && (
                <>
                  <select value={codeRepo} onChange={(e) => setCodeRepo(e.target.value)} style={{ ...mono, fontSize: 12, padding: "10px 12px", borderRadius: 6, border: `1px solid ${PU}55`, background: "#000", color: "#eafcff", width: "100%", marginBottom: 10 }}>
                    <option value="all">Todos os repositórios</option>
                    {codeRepos.map((r) => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
                  </select>
                  {codeRepo !== "all" && (
                    <select value={codeFile} onChange={(e) => setCodeFile(e.target.value)} style={{ ...mono, fontSize: 12, padding: "10px 12px", borderRadius: 6, border: `1px solid ${PU}55`, background: "#000", color: "#eafcff", width: "100%", marginBottom: 10 }}>
                      <option value="">Busca no repositório inteiro</option>
                      {codeFiles.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  )}
                </>
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

              {/* modo código */}
              <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginTop: 14, marginBottom: 8 }}>MODO CÓDIGO</div>
              <button
                onClick={() => setCodeMode((v) => !v)}
                style={{ ...mono, fontSize: 10.5, padding: "10px 14px", borderRadius: 6, border: `1px solid ${codeMode ? PU : "rgba(var(--accent-rgb),0.18)"}`, background: codeMode ? "rgba(201,166,255,0.12)" : "transparent", color: codeMode ? "#eafcff" : "rgba(207,239,251,0.55)", cursor: "pointer", width: "100%", marginBottom: 8 }}
              >
                🛠️ Modo Código: {codeMode ? "ON" : "OFF"}
              </button>
              {codeMode && (
                <>
                  <select value={codeModeRepo} onChange={(e) => setCodeModeRepo(e.target.value)} style={{ ...mono, fontSize: 12, padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#000", color: "#eafcff", width: "100%", marginBottom: 8 }}>
                    <option value="">repositório…</option>
                    {codeModeRepos.map((r) => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
                  </select>
                  {codeModeRepo && (
                    <select value={codeModeBranch} onChange={(e) => setCodeModeBranch(e.target.value)} style={{ ...mono, fontSize: 12, padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#000", color: "#eafcff", width: "100%", marginBottom: 8 }}>
                      <option value="">branch base…</option>
                      {codeModeBranches.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  )}
                  {codeModeRepo && codeModeAvailableFiles.length > 0 && (
                    <>
                      <div style={{ ...mono, fontSize: 9, letterSpacing: 1, color: "rgba(207,239,251,0.45)", marginBottom: 4 }}>
                        ARQUIVOS FIXOS (opcional, até {CODE_MODE_MAX_FILES} — ctrl/cmd+clique pra marcar mais de um; garante que entrem no contexto de toda pergunta enquanto o Modo Código estiver ligado)
                      </div>
                      <select
                        multiple
                        value={codeModeFiles}
                        onChange={(e) => setCodeModeFiles(Array.from(e.target.selectedOptions).map((o) => o.value).slice(0, CODE_MODE_MAX_FILES))}
                        style={{ ...mono, fontSize: 11, padding: "6px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#000", color: "#eafcff", width: "100%", height: 100, marginBottom: 8 }}
                      >
                        {codeModeAvailableFiles.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </>
                  )}
                  <div style={{ fontSize: 10.5, color: "rgba(207,239,251,0.45)", marginBottom: 14, lineHeight: 1.4 }}>
                    Com isso ligado, toda mensagem vira um pedido de mudança de código nesse
                    repositório/branch — ela cria uma branch nova e abre um Pull Request, nunca
                    mescla sozinha.
                  </div>
                </>
              )}

              {/* observância */}
              <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginTop: 14, marginBottom: 8 }}>OBSERVÂNCIA (CÂMERA)</div>
              <button
                onClick={() => setObservanceMode((v) => !v)}
                style={{ ...mono, fontSize: 10.5, padding: "10px 14px", borderRadius: 6, border: `1px solid ${observanceMode ? GR : "rgba(var(--accent-rgb),0.18)"}`, background: observanceMode ? "rgba(123,216,143,0.12)" : "transparent", color: observanceMode ? "#eafcff" : "rgba(207,239,251,0.55)", cursor: "pointer", width: "100%", marginBottom: 8 }}
              >
                👁 Modo Observância: {observanceMode ? "ON" : "OFF"}
              </button>
              {observanceMode && (
                <>
                  <video ref={observanceVideoRef} autoPlay playsInline muted style={{ width: "100%", maxWidth: 160, aspectRatio: "4/3", borderRadius: 6, objectFit: "cover", border: `1px solid ${GR}55`, marginBottom: 6, display: "block" }} />
                  <button
                    onClick={() => setCameraFacing((f) => (f === "user" ? "environment" : "user"))}
                    style={{ ...mono, fontSize: 10, padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "transparent", color: "rgba(207,239,251,0.7)", cursor: "pointer", width: "100%", marginBottom: 8 }}
                  >
                    🔄 câmera: {cameraFacing === "user" ? "frontal" : "traseira"} (trocar)
                  </button>
                </>
              )}
              {observanceError && <div style={{ ...mono, fontSize: 9.5, color: OR, marginBottom: 8 }}>⚠ {observanceError}</div>}
              <div style={{ fontSize: 11, color: "rgba(207,239,251,0.45)", marginBottom: 14, lineHeight: 1.4 }}>
                Tira 1 foto só no instante de cada pergunta pra Lisa poder ver o que você mostra — nada fica salvo.
                Com o modo ligado, ela também cumprimenta sozinha se reconhecer a Alice ou a Nala na câmera.
              </div>

              {/* Modo Tela — compartilhar a tela do dispositivo. A maioria dos navegadores de
                  CELULAR não tem suporte a getDisplayMedia (compartilhamento de tela) — o botão
                  fica disponível, mas se o seu navegador não suportar, aparece o aviso de erro
                  abaixo em vez de travar/fingir que funcionou. */}
              <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginTop: 14, marginBottom: 8 }}>MODO TELA</div>
              <button
                onClick={() => setScreenMode((v) => !v)}
                style={{ ...mono, fontSize: 10.5, padding: "10px 14px", borderRadius: 6, border: `1px solid ${screenMode ? GR : "rgba(var(--accent-rgb),0.18)"}`, background: screenMode ? "rgba(123,216,143,0.12)" : "transparent", color: screenMode ? "#eafcff" : "rgba(207,239,251,0.55)", cursor: "pointer", width: "100%", marginBottom: 8 }}
              >
                🖵 Modo Tela: {screenMode ? "ON" : "OFF"}
              </button>
              {screenMode && (
                <>
                  <video ref={screenVideoRef} autoPlay playsInline muted title="o que está sendo compartilhado" style={{ width: "100%", maxWidth: 160, aspectRatio: "4/3", borderRadius: 6, objectFit: "cover", border: `1px solid ${GR}55`, marginBottom: 8, display: "block" }} />
                  <button
                    onClick={() => setScreenAutoComment((v) => !v)}
                    style={{ ...mono, fontSize: 10.5, padding: "10px 14px", borderRadius: 6, border: `1px solid ${screenAutoComment ? PU : "rgba(var(--accent-rgb),0.18)"}`, background: screenAutoComment ? "rgba(201,166,255,0.12)" : "transparent", color: screenAutoComment ? "#eafcff" : "rgba(207,239,251,0.55)", cursor: "pointer", width: "100%", marginBottom: 8 }}
                  >
                    💬 Vigiar sozinha: {screenAutoComment ? "ON" : "OFF"}
                  </button>
                  {screenAutoComment && (
                    <>
                      <select
                        value={screenIntervalMs}
                        onChange={(e) => chooseScreenInterval(Number(e.target.value))}
                        style={{ ...mono, fontSize: 12, padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#000", color: "#eafcff", width: "100%", marginBottom: 8 }}
                      >
                        {SCREEN_INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>a cada {o.label}</option>)}
                      </select>
                      <input
                        value={screenFocus}
                        onChange={(e) => updateScreenFocus(e.target.value)}
                        placeholder="direcionamento (ex.: avise se o build quebrar)"
                        style={{ ...mono, fontSize: 12, padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#000", color: "#eafcff", width: "100%", marginBottom: 8 }}
                      />
                    </>
                  )}
                </>
              )}
              {screenError && <div style={{ ...mono, fontSize: 9.5, color: OR, marginBottom: 8 }}>⚠ {screenError}</div>}
              <div style={{ fontSize: 11, color: "rgba(207,239,251,0.45)", marginBottom: 14, lineHeight: 1.4 }}>
                O navegador sempre pede permissão nativa pra escolher o que compartilhar. A maioria
                dos navegadores de CELULAR não suporta compartilhamento de tela por um site — se
                for o seu caso, o aviso acima vai dizer isso claramente.
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
                  { href: "/gemini-keys", glyph: "🔑", label: "CHAVES GEMINI" },
                  { href: "/delp-tasks", glyph: "🏢", label: "TAREFAS DELP" },
                  { href: "/scheduled-announcements", glyph: "⏰", label: "FALAS AGENDADAS" },
                  { href: "/code-repos", glyph: "🐙", label: "REPOSITÓRIOS" },
                  { href: "/code-tasks", glyph: "🛠️", label: "TAREFAS DE CÓDIGO" },
                  { href: "/arch-docs", glyph: "🗺️", label: "MAPA DE ARQUITETURA" },
                  { href: "/sync-status", glyph: "📊", label: "PROGRESSO DO SYNC" },
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
        {codeTaskModal}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {codeTaskModal}
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
            <option value={DELP_SCOPE}>Tarefas Delp</option>
            <option value={CODE_SCOPE}>Código</option>
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

        {/* repositório/arquivo — só aparecem com o escopo "Código" selecionado */}
        {scopeMode === "panel" && scopePanel === CODE_SCOPE && (
          <select
            value={codeRepo}
            onChange={(e) => setCodeRepo(e.target.value)}
            title="Repositório — força a resposta a considerar só esse repo"
            style={{ ...mono, fontSize: 9.5, padding: "6px 8px", borderRadius: 3, border: `1px solid ${PU}55`, background: "#08131a", color: "#eafcff" }}
          >
            <option value="all">Todos os repositórios</option>
            {codeRepos.map((r) => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
          </select>
        )}
        {scopeMode === "panel" && scopePanel === CODE_SCOPE && codeRepo !== "all" && (
          <select
            value={codeFile}
            onChange={(e) => setCodeFile(e.target.value)}
            title="Arquivo específico — sem escolher nenhum, busca no repositório inteiro"
            style={{ ...mono, fontSize: 9.5, padding: "6px 8px", borderRadius: 3, border: `1px solid ${PU}55`, background: "#08131a", color: "#eafcff", maxWidth: 220 }}
          >
            <option value="">repositório inteiro</option>
            {codeFiles.map((f) => <option key={f} value={f}>{f}</option>)}
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

        {/* Modo Código — toda mensagem vira pedido de mudança de código (branch nova + PR) */}
        <button
          onClick={() => setCodeMode((v) => !v)}
          title={codeMode ? "Modo Código ligado — toda mensagem vira pedido de mudança. Clique pra desligar" : "Ligar Modo Código — a Lisa passa a propor mudança de código (branch + PR) em vez de conversar"}
          style={{
            ...mono, fontSize: 9, letterSpacing: 1, padding: "5px 10px", borderRadius: 3,
            border: `1px solid ${codeMode ? PU : "rgba(var(--accent-rgb),0.18)"}`,
            background: codeMode ? "rgba(201,166,255,0.12)" : "transparent",
            color: codeMode ? "#eafcff" : "rgba(207,239,251,0.55)",
            cursor: "pointer",
          }}
        >
          🛠️ CÓDIGO {codeMode ? "ON" : "OFF"}
        </button>
        {codeMode && (
          <>
            <select
              value={codeModeRepo}
              onChange={(e) => setCodeModeRepo(e.target.value)}
              style={{ ...mono, fontSize: 9, padding: "5px 6px", borderRadius: 3, border: `1px solid ${PU}55`, background: "#08131a", color: "#eafcff" }}
            >
              <option value="">repositório…</option>
              {codeModeRepos.map((r) => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
            </select>
            {codeModeRepo && (
              <select
                value={codeModeBranch}
                onChange={(e) => setCodeModeBranch(e.target.value)}
                style={{ ...mono, fontSize: 9, padding: "5px 6px", borderRadius: 3, border: `1px solid ${PU}55`, background: "#08131a", color: "#eafcff" }}
              >
                <option value="">branch base…</option>
                {codeModeBranches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
            {codeModeRepo && codeModeAvailableFiles.length > 0 && (
              <select
                multiple
                value={codeModeFiles}
                onChange={(e) => setCodeModeFiles(Array.from(e.target.selectedOptions).map((o) => o.value).slice(0, CODE_MODE_MAX_FILES))}
                title={`arquivos fixos (até ${CODE_MODE_MAX_FILES}, ctrl/cmd+clique pra marcar mais de um) — garantidos no contexto de toda pergunta enquanto o Modo Código estiver ligado`}
                style={{ ...mono, fontSize: 9, padding: "4px", borderRadius: 3, border: `1px solid ${PU}55`, background: "#08131a", color: "#eafcff", width: 160, height: 60 }}
              >
                {codeModeAvailableFiles.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            )}
          </>
        )}

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

        {/* Modo Tela — desktop-only ("enquanto mexo no PC"). Reativo (cada pergunta manda um
            retrato da tela) + proativo opcional (vigia sozinha e só fala se achar algo digno de
            nota, ver o useEffect de screenAutoComment acima). O navegador SEMPRE pede permissão
            nativa pra escolher tela/janela/aba — isso não dá pra pular. */}
        <button
          onClick={() => setScreenMode((v) => !v)}
          title={screenMode ? "Modo Tela ligado — o navegador pede pra você escolher o que compartilhar. Clique pra desligar" : "Compartilhar a tela pra Lisa poder ver o que está acontecendo nela"}
          style={{
            ...mono, fontSize: 9, letterSpacing: 1, padding: "5px 10px", borderRadius: 3,
            border: `1px solid ${screenMode ? GR : "rgba(var(--accent-rgb),0.18)"}`,
            background: screenMode ? "rgba(123,216,143,0.12)" : "transparent",
            color: screenMode ? "#eafcff" : "rgba(207,239,251,0.55)",
            cursor: "pointer",
          }}
        >
          🖵 TELA {screenMode ? "ON" : "OFF"}
        </button>
        {screenMode && (
          <>
            <video ref={screenVideoRef} autoPlay playsInline muted title="o que está sendo compartilhado — só um retrato disso é enviado por vez" style={{ width: 72, height: 40, borderRadius: 4, objectFit: "cover", border: `1px solid ${GR}55` }} />
            <button
              onClick={() => setScreenAutoComment((v) => !v)}
              title={screenAutoComment ? "Vigiando sozinha — só fala se achar algo digno de nota. Clique pra desligar" : "Deixar a Lisa de olho na tela sozinha, comentando só quando achar algo relevante (sem você perguntar)"}
              style={{
                ...mono, fontSize: 9, letterSpacing: 1, padding: "5px 10px", borderRadius: 3,
                border: `1px solid ${screenAutoComment ? PU : "rgba(var(--accent-rgb),0.18)"}`,
                background: screenAutoComment ? "rgba(201,166,255,0.12)" : "transparent",
                color: screenAutoComment ? "#eafcff" : "rgba(207,239,251,0.55)",
                cursor: "pointer",
              }}
            >
              💬 AUTO {screenAutoComment ? "ON" : "OFF"}
            </button>
            {screenAutoComment && (
              <>
                <select
                  value={screenIntervalMs}
                  onChange={(e) => chooseScreenInterval(Number(e.target.value))}
                  title="De quanto em quanto tempo ela verifica a tela sozinha"
                  style={{ ...mono, fontSize: 9, padding: "5px 6px", borderRadius: 3, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#08131a", color: "#eafcff" }}
                >
                  {SCREEN_INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>a cada {o.label}</option>)}
                </select>
                <input
                  value={screenFocus}
                  onChange={(e) => updateScreenFocus(e.target.value)}
                  placeholder="direcionamento (ex.: avise se o build quebrar)"
                  title="O que ela deve priorizar notar na tela — fica em branco pra ela decidir sozinha o que é relevante"
                  style={{ ...mono, fontSize: 9, padding: "5px 8px", borderRadius: 3, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#08131a", color: "#eafcff", width: 220 }}
                />
              </>
            )}
          </>
        )}
        {screenError && <span style={{ ...mono, fontSize: 8.5, color: OR }}>⚠ {screenError}</span>}
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
            {ttsWaitSeconds !== null && (
              <div style={{ ...mono, fontSize: 10.5, letterSpacing: 1, color: CY, marginTop: 10 }}>
                ⏳ aguardando voz do Gemini… {ttsWaitSeconds}s / {SPEAK_TIMEOUT_MS / 1000}s
              </div>
            )}
            {(liveCode || liveCodeDone.length > 0) && (
              <div style={{ ...mono, fontSize: 10.5, textAlign: "left", background: "#08131a", border: `1px solid ${PU}55`, borderRadius: 8, padding: "12px 14px", maxHeight: 280, overflowY: "auto", marginTop: 14 }}>
                {liveCodeDone.map((f) => (
                  <div key={f.path} style={{ color: GR, marginBottom: 6 }}>✓ {f.path}</div>
                ))}
                {liveCode && (
                  <div>
                    <div style={{ color: PU, marginBottom: 4 }}>✎ {liveCode.path}</div>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "rgba(207,239,251,0.8)", fontSize: 10, lineHeight: 1.4 }}>{liveCode.content.slice(-2500)}</pre>
                  </div>
                )}
              </div>
            )}
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
          onClick={() => setGeminiVoiceEnabled((v) => {
            const next = !v;
            if (next) geminiDownUntilRef.current = 0; // reativou na mão → tenta de novo já na próxima, não espera o disjuntor
            return next;
          })}
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
