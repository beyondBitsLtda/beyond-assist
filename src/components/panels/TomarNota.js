"use client";

// Modo Tomar nota: a Lisa escuta por até 10 minutos e, no fim, separa o que ouviu por assunto
// e anota no quadro "Notas" do Abacato (coluna = tema, card = nota).
//
// A gravação é feita para continuar com a tela apagada:
//  - o áudio é lido num AudioWorklet (src/lib/tomarNota.js), que anda no ritmo do microfone,
//    não dos timers da página — que o navegador segura quando a tela apaga;
//  - cada trecho de ~30 s vai para a transcrição assim que fecha (/api/notas/trecho), puxado
//    pela própria mensagem do gravador; no fim só falta o último trecho e a organização;
//  - o que já foi transcrito fica guardado no aparelho: se a página recarregar, dá para
//    organizar depois.
// No Android o microfone continua aberto com a tela apagada. No iPhone o Safari desliga o
// microfone das páginas quando a tela bloqueia: lá a tela fica ligada por padrão (Wake Lock),
// e se a gravação for interrompida a pessoa continua de onde parou.

import { useEffect, useRef, useState } from "react";
import {
  CODIGO_DO_GRAVADOR,
  LIMITE_DE_SEGUNDOS,
  TAXA_DA_GRAVACAO,
  base64DeBytes,
  minutoDe,
  wavDePcm16,
} from "@/lib/tomarNota.js";

const CHAVE = "lisa-tomar-nota"; // a gravação em andamento (só o texto já transcrito)
const ESPERAS_MS = [2000, 5000, 10000, 20000, 30000];
// Trecho cujo volume mais alto nem chega nisso é silêncio: nem vai para o Gemini.
const PICO_DE_SILENCIO = 0.01;
const OCUPADA = ["gravando", "interrompida", "finalizando", "organizando"];

const ehIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

function lerGuardada() {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE) || "null");
    return g?.id && Array.isArray(g.trechos) && g.trechos.some((t) => t.texto) ? g : null;
  } catch {
    return null;
  }
}
const guardar = (s) => { try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch { /* sem espaço: segue só na memória */ } };
const esquecer = () => { try { localStorage.removeItem(CHAVE); } catch { /* nada */ } };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const voltarARede = () => new Promise((r) => window.addEventListener("online", r, { once: true }));
const novoId = () => (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

// Bipe curto sintetizado: "comecei a ouvir" (um) e "terminei" (dois) — com a tela apagada é o
// único sinal que chega.
function bipe(vezes = 1) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    for (let i = 0; i < vezes; i++) {
      const t = ctx.currentTime + i * 0.22;
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.frequency.value = i ? 660 : 880;
      ganho.gain.setValueAtTime(0.15, t);
      ganho.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    }
    setTimeout(() => ctx.close().catch(() => {}), 300 + vezes * 250);
  } catch { /* sem áudio: segue sem bipe */ }
}

function mensagemDoMicrofone(e) {
  if (e?.name === "NotAllowedError" || e?.name === "SecurityError") return "O navegador não liberou o microfone. Permita o acesso ao microfone para este site e tente de novo.";
  if (e?.name === "NotFoundError") return "Não encontrei nenhum microfone neste aparelho.";
  if (e?.message === "sem-worklet") return "Este navegador não tem o recurso de áudio que o modo usa (AudioWorklet). Atualize o navegador.";
  return `Não consegui abrir o microfone: ${e?.message || e}`;
}

/** O painel do modo (tela cheia no celular). `aoTerminar` recebe o que foi gravado no Abacato. */
export default function TomarNota({ temaInicial = "", aoFechar, aoTerminar }) {
  const [etapa, setEtapa] = useState("preparar"); // preparar | gravando | interrompida | finalizando | falhas | organizando | pronto | erro
  const [tema, setTema] = useState(temaInicial);
  const [segundos, setSegundos] = useState(0);
  const [nivel, setNivel] = useState(0);
  const [trechos, setTrechos] = useState([]);
  const [erro, setErro] = useState("");
  const [podeTentar, setPodeTentar] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [telaLigada, setTelaLigada] = useState(false);
  const [guardada, setGuardada] = useState(null);
  const [ditando, setDitando] = useState(false);
  const [temDitado, setTemDitado] = useState(false);

  const sessao = useRef(null); // { id, tema, iniciadaEm }
  const audio = useRef(null); // { ctx, stream, no, trilha }
  const ctxDoGesto = useRef(null);
  const taxa = useRef(TAXA_DA_GRAVACAO);
  const fila = useRef([]); // áudio esperando transcrição, em ordem
  const enviando = useRef(false);
  const textos = useRef(new Map()); // indice → { inicio, duracao, texto, estado }
  const falhos = useRef([]);
  const fim = useRef(false); // o gravador já mandou o último trecho
  const segundosRef = useRef(0);
  const proximoIndice = useRef(0);
  const trava = useRef(null);
  const montado = useRef(true);
  const etapaRef = useRef(etapa);
  const aoTerminarRef = useRef(aoTerminar);
  aoTerminarRef.current = aoTerminar;
  // A etapa vive também no ref, trocada NA HORA: o gravador e a fila decidem o próximo passo
  // dentro de callbacks, antes de o React renderizar a etapa nova.
  const irPara = (e) => { etapaRef.current = e; setEtapa(e); };

  useEffect(() => {
    montado.current = true;
    setTelaLigada(ehIOS());
    setGuardada(lerGuardada());
    setTemDitado(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      montado.current = false;
      soltarMicrofone();
      soltarTela();
      ctxDoGesto.current?.close().catch(() => {});
    };
  }, []);

  // ---- tela ligada (Wake Lock): o navegador solta a trava quando a página some, então ela
  // é pedida de novo quando a página volta ----
  async function travarTela() {
    if (trava.current || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try {
      trava.current = await navigator.wakeLock.request("screen");
      trava.current.addEventListener?.("release", () => { trava.current = null; });
    } catch { /* recusada (bateria fraca, aba sem foco): grava assim mesmo */ }
  }
  function soltarTela() {
    trava.current?.release?.().catch(() => {});
    trava.current = null;
  }
  const ocupada = OCUPADA.includes(etapa);
  useEffect(() => {
    if (ocupada && telaLigada) travarTela();
    else soltarTela();
  }, [ocupada, telaLigada]);

  // ---- voltou para a página: retoma o áudio (iOS suspende) e confere se o microfone sobreviveu ----
  useEffect(() => {
    if (!ocupada) return;
    const aoVoltar = async () => {
      if (document.visibilityState !== "visible") return;
      if (telaLigada) travarTela();
      const a = audio.current;
      if (!a || etapaRef.current !== "gravando") return;
      if (a.ctx.state !== "running") await a.ctx.resume().catch(() => {});
      if (a.trilha.readyState === "ended" || a.ctx.state !== "running") interromper();
    };
    const aoSair = (e) => { e.preventDefault(); e.returnValue = ""; };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("beforeunload", aoSair);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("beforeunload", aoSair);
    };
  }, [ocupada, telaLigada]);

  // ---- microfone ----
  function prepararAudio() {
    // O contexto de áudio nasce no toque (gesto): no iPhone, um contexto criado depois de um
    // await nasce suspenso e não grava nada.
    if (ctxDoGesto.current) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctxDoGesto.current = new AC({ latencyHint: "playback" });
    ctxDoGesto.current.resume?.().catch(() => {});
  }

  async function abrirMicrofone() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = ctxDoGesto.current || new AC({ latencyHint: "playback" });
    ctxDoGesto.current = null;
    let stream;
    try {
      if (!ctx.audioWorklet) throw new Error("sem-worklet");
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      const url = URL.createObjectURL(new Blob([CODIGO_DO_GRAVADOR], { type: "application/javascript" }));
      try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
      if (ctx.state !== "running") await ctx.resume().catch(() => {});
      taxa.current = Math.min(TAXA_DA_GRAVACAO, ctx.sampleRate);
      const no = new AudioWorkletNode(ctx, "gravador-de-nota", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        processorOptions: {
          taxa: TAXA_DA_GRAVACAO,
          limiteSegundos: LIMITE_DE_SEGUNDOS,
          jaGravadas: Math.round(segundosRef.current * taxa.current),
          proximoIndice: proximoIndice.current,
        },
      });
      no.port.onmessage = (e) => {
        const m = e.data;
        if (m.tipo === "nivel") {
          segundosRef.current = m.segundos;
          setNivel(m.rms);
          setSegundos(m.segundos);
        } else if (m.tipo === "trecho") {
          recebeuTrecho(m);
        }
      };
      // A saída do gravador é silêncio; ligada ao destino só para o navegador processá-lo.
      ctx.createMediaStreamSource(stream).connect(no);
      no.connect(ctx.destination);
      const [trilha] = stream.getAudioTracks();
      trilha.addEventListener("ended", () => { if (etapaRef.current === "gravando") interromper(); });
      audio.current = { ctx, stream, no, trilha };
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      throw e;
    }
  }

  function soltarMicrofone() {
    const a = audio.current;
    audio.current = null;
    if (!a) return;
    a.stream.getTracks().forEach((t) => t.stop());
    try { a.no.port.onmessage = null; a.no.disconnect(); } catch { /* já desligado */ }
    a.ctx.close().catch(() => {});
  }

  // ---- trechos ----
  function publicar() {
    const lista = [...textos.current.entries()].map(([indice, t]) => ({ indice, ...t })).sort((a, b) => a.indice - b.indice);
    if (montado.current) setTrechos(lista);
    const s = sessao.current;
    if (s) {
      guardar({
        ...s,
        segundos: segundosRef.current,
        trechos: lista.filter((t) => t.estado === "ok").map(({ indice, inicio, duracao, texto }) => ({ indice, inicio, duracao, texto })),
      });
    }
  }

  function recebeuTrecho(m) {
    if (m.duracao > 0) {
      proximoIndice.current = m.indice + 1;
      segundosRef.current = Math.max(segundosRef.current, m.inicio + m.duracao);
      if (m.pico < PICO_DE_SILENCIO) {
        textos.current.set(m.indice, { inicio: m.inicio, duracao: m.duracao, texto: "", estado: "silencio" });
      } else {
        const pcm = m.pcm instanceof Int16Array ? m.pcm : new Int16Array(m.pcm);
        fila.current.push({ indice: m.indice, inicio: m.inicio, duracao: m.duracao, data: base64DeBytes(wavDePcm16(pcm, taxa.current)) });
        textos.current.set(m.indice, { inicio: m.inicio, duracao: m.duracao, texto: "", estado: "fila" });
      }
      publicar();
      processarFila();
    }
    if (m.final) {
      fim.current = true;
      soltarMicrofone();
      if (m.motivo === "limite") bipe(2);
      irPara("finalizando");
      verSeTerminou();
    }
  }

  async function processarFila() {
    if (enviando.current) return;
    enviando.current = true;
    try {
      while (fila.current.length && montado.current) {
        const item = fila.current[0];
        const anterior = [...textos.current.entries()]
          .filter(([i, t]) => i < item.indice && t.texto)
          .sort((a, b) => b[0] - a[0])[0]?.[1].texto || "";
        textos.current.set(item.indice, { inicio: item.inicio, duracao: item.duracao, texto: "", estado: "enviando" });
        publicar();
        let texto = null;
        let ultimoErro = "";
        for (let tentativa = 0; tentativa <= ESPERAS_MS.length && montado.current; tentativa++) {
          if (tentativa) await esperar(ESPERAS_MS[tentativa - 1]);
          if (navigator.onLine === false) await voltarARede();
          try {
            const r = await fetch("/api/notas/trecho", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ tema: sessao.current?.tema || "", anterior: anterior.slice(-240), audio: { mimeType: "audio/wav", data: item.data } }),
            });
            const d = await r.json().catch(() => ({}));
            if (r.ok && d.ok) { texto = d.texto || ""; break; }
            ultimoErro = d.error || `HTTP ${r.status}`;
            if ([400, 401, 403, 413].includes(r.status)) break; // repetir não muda nada
          } catch (e) {
            ultimoErro = e?.message || String(e);
          }
        }
        fila.current.shift();
        if (texto === null) {
          falhos.current.push(item);
          textos.current.set(item.indice, { inicio: item.inicio, duracao: item.duracao, texto: "", estado: "falhou", erro: ultimoErro });
        } else {
          textos.current.set(item.indice, { inicio: item.inicio, duracao: item.duracao, texto, estado: texto ? "ok" : "silencio" });
        }
        publicar();
      }
    } finally {
      enviando.current = false;
    }
    verSeTerminou();
  }

  function verSeTerminou() {
    if (!fim.current || enviando.current || fila.current.length || !montado.current) return;
    if (etapaRef.current !== "finalizando") return;
    if (falhos.current.length) return irPara("falhas");
    organizar();
  }

  // ---- as ações ----
  async function comecar(temaEscolhido = tema) {
    prepararAudio();
    setErro("");
    setPodeTentar(false);
    const t = String(temaEscolhido || "").replace(/\s+/g, " ").trim();
    setTema(t);
    sessao.current = { id: novoId(), tema: t, iniciadaEm: new Date().toISOString() };
    textos.current = new Map();
    fila.current = [];
    falhos.current = [];
    fim.current = false;
    proximoIndice.current = 0;
    segundosRef.current = 0;
    setTrechos([]);
    setSegundos(0);
    setNivel(0);
    try {
      await abrirMicrofone();
      if (!montado.current) return soltarMicrofone();
      irPara("gravando");
      setGuardada(null);
      bipe();
    } catch (e) {
      sessao.current = null;
      setErro(mensagemDoMicrofone(e));
      irPara("preparar");
    }
  }

  function interromper() {
    // O microfone parou sozinho (tela bloqueada no iPhone, ligação, outro app pegou o
    // microfone). O pedaço que estava no gravador sai agora; a pessoa decide se continua.
    try { audio.current?.no.port.postMessage("despejar"); } catch { /* contexto já fechado */ }
    irPara("interrompida");
  }

  async function continuar() {
    prepararAudio();
    setErro("");
    soltarMicrofone();
    try {
      await abrirMicrofone();
      irPara("gravando");
      bipe();
    } catch (e) {
      setErro(mensagemDoMicrofone(e));
    }
  }

  function encerrar() {
    irPara("finalizando");
    const a = audio.current;
    if (a && a.ctx.state === "running") {
      a.no.port.postMessage("parar");
      // Se o gravador não responder (contexto suspenso), a página encerra por conta própria.
      setTimeout(() => {
        if (fim.current) return;
        fim.current = true;
        soltarMicrofone();
        verSeTerminou();
      }, 2500);
    } else {
      fim.current = true;
      soltarMicrofone();
      verSeTerminou();
    }
  }

  function descartar() {
    if (!window.confirm("Descartar esta gravação? Nada vai para o Abacato.")) return;
    soltarMicrofone();
    fila.current = [];
    falhos.current = [];
    sessao.current = null;
    esquecer();
    irPara("preparar");
  }

  function fechar() {
    if (OCUPADA.includes(etapaRef.current) && etapaRef.current !== "organizando") {
      if (!window.confirm("Parar de escutar? O que já foi transcrito fica guardado para você organizar depois.")) return;
    }
    soltarMicrofone();
    aoFechar?.();
  }

  function tentarDeNovo() {
    fila.current.push(...falhos.current);
    falhos.current = [];
    irPara("finalizando");
    processarFila();
  }

  function semOsFalhos() {
    falhos.current = [];
    organizar();
  }

  async function organizar() {
    const s = sessao.current;
    const trechosOk = [...textos.current.entries()]
      .filter(([, t]) => t.estado === "ok" && t.texto)
      .map(([indice, t]) => ({ indice, inicio: t.inicio, duracao: t.duracao, texto: t.texto }))
      .sort((a, b) => a.indice - b.indice);
    if (!s || !trechosOk.length) {
      esquecer();
      setPodeTentar(false);
      setErro("Não ouvi nenhuma fala nessa gravação — nada para anotar.");
      return irPara("erro");
    }
    irPara("organizando");
    setErro("");
    try {
      const r = await fetch("/api/notas/organizar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessao: s.id, tema: s.tema, iniciadaEm: s.iniciadaEm, duracaoSegundos: Math.round(segundosRef.current), trechos: trechosOk }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        const e = new Error(d.error || `HTTP ${r.status}`);
        e.definitivo = r.status === 403 || r.status === 422;
        throw e;
      }
      esquecer();
      aoTerminarRef.current?.(d);
      if (!montado.current) return;
      setResultado(d);
      irPara("pronto");
      bipe(2);
      avisarSeEscondida(d);
    } catch (e) {
      if (!montado.current) return;
      setErro(e?.message || String(e));
      setPodeTentar(!e?.definitivo);
      irPara("erro");
    }
  }

  function organizarGuardada() {
    const g = guardada;
    sessao.current = { id: g.id, tema: g.tema || "", iniciadaEm: g.iniciadaEm };
    textos.current = new Map(g.trechos.map((t) => [t.indice, { inicio: t.inicio, duracao: t.duracao, texto: t.texto, estado: "ok" }]));
    segundosRef.current = g.segundos || 0;
    setSegundos(segundosRef.current);
    setTema(g.tema || "");
    setGuardada(null);
    fim.current = true;
    organizar();
  }

  async function avisarSeEscondida(d) {
    if (document.visibilityState === "visible" || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const n = Math.max(0, (d.cards?.length || 1) - 1);
      await reg?.showNotification("Notas prontas no Abacato", {
        body: `${n} nota${n === 1 ? "" : "s"} sobre “${d.tema}” no quadro ${d.quadro?.nome || "Notas"}.`,
        tag: "lisa-tomar-nota",
        icon: "/icon.png",
        data: { url: window.location.pathname, focar: true },
      });
    } catch { /* sem notificação: o bipe e a tela já avisam */ }
  }

  function ditarTema() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || ditando) return;
    prepararAudio();
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    let final = "";
    rec.onresult = (e) => {
      const texto = [...e.results].map((r) => r[0].transcript).join("");
      setTema(texto);
      if (e.results[e.results.length - 1].isFinal) final = texto;
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setErro("O navegador não liberou o microfone para ditar o tema. Digite o tema, se preferir.");
    };
    rec.onend = () => {
      setDitando(false);
      const t = final.replace(/[.!?]+$/, "").trim();
      if (t && montado.current) comecar(t);
    };
    setErro("");
    setDitando(true);
    try { rec.start(); } catch { setDitando(false); }
  }

  // ---- tela ----
  const transcritos = trechos.filter((t) => t.estado === "ok");
  const naFila = trechos.filter((t) => t.estado === "fila" || t.estado === "enviando").length;
  const ultimos = transcritos.slice(-2);
  const progresso = Math.min(1, segundos / LIMITE_DE_SEGUNDOS);
  const notas = resultado ? resultado.cards.slice(0, -1) : [];

  return (
    <div className="tn-fundo" role="dialog" aria-modal="true" aria-labelledby="tn-titulo">
      <div className="tn-painel">
        <header className="tn-topo">
          <h2 id="tn-titulo"><span aria-hidden="true">📝</span> Tomar nota</h2>
          {etapa === "gravando" && <span className="tn-rec"><i aria-hidden="true" />gravando</span>}
          <button type="button" className="tn-fechar" onClick={fechar} aria-label="Fechar">✕</button>
        </header>

        {etapa === "preparar" && (
          <div className="tn-corpo">
            {guardada && (
              <div className="tn-guardada">
                <p>
                  Ficou uma gravação sem organizar
                  {guardada.tema ? <> sobre <b>{guardada.tema}</b></> : null} — {minutoDe(guardada.segundos)} de áudio, {guardada.trechos.length} trecho{guardada.trechos.length === 1 ? "" : "s"} transcrito{guardada.trechos.length === 1 ? "" : "s"}.
                </p>
                <div className="tn-acoes tn-acoes--linha">
                  <button type="button" className="tn-botao tn-botao--principal" onClick={organizarGuardada}>Organizar agora</button>
                  <button type="button" className="tn-botao" onClick={() => { esquecer(); setGuardada(null); }}>Descartar</button>
                </div>
              </div>
            )}
            <p className="tn-intro">
              Diga o tema e eu escuto por até <b>10 minutos</b>. No fim, separo o que ouvi por assunto e anoto no quadro <b>Notas</b> do Abacato: uma coluna para o tema e um card para cada assunto, com a minha interpretação e o que foi dito.
            </p>
            <label className="tn-rotulo" htmlFor="tn-tema">Tema</label>
            <div className="tn-linha">
              <input
                id="tn-tema"
                className="tn-campo"
                value={tema}
                maxLength={80}
                autoFocus
                autoComplete="off"
                placeholder={ditando ? "Pode falar…" : "Ex.: Reunião de planejamento"}
                onChange={(e) => setTema(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") comecar(); }}
              />
              {temDitado && (
                <button
                  type="button"
                  className={`tn-ditar${ditando ? " tn-ditar--ouvindo" : ""}`}
                  onClick={ditarTema}
                  aria-label="Dizer o tema em voz alta"
                  title="Dizer o tema — quando você terminar, eu já começo a escutar"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                </button>
              )}
            </div>
            <p className="tn-ajuda">Pode deixar em branco: eu deduzo o tema pelo que ouvir.</p>

            <label className="tn-chave">
              <input type="checkbox" checked={telaLigada} onChange={(e) => setTelaLigada(e.target.checked)} />
              <span>
                <b>Manter a tela ligada</b>
                <small>{ehIOS()
                  ? "Recomendado no iPhone: o Safari desliga o microfone quando a tela bloqueia."
                  : "Opcional. No Android e no computador a gravação continua com a tela apagada."}</small>
              </span>
            </label>

            {erro && <p className="tn-erro" role="alert">{erro}</p>}
            <button type="button" className="tn-botao tn-botao--principal tn-botao--grande" onClick={() => comecar()} disabled={ditando}>
              <i className="tn-ponto" aria-hidden="true" /> Começar a escutar
            </button>
          </div>
        )}

        {(etapa === "gravando" || etapa === "interrompida") && (
          <div className="tn-corpo tn-corpo--gravando">
            <p className="tn-tema">{tema || "Tema: eu deduzo no fim"}</p>
            <div className={`tn-medidor${etapa === "interrompida" ? " tn-medidor--parado" : ""}`} style={{ "--nivel": Math.min(1, nivel * 9).toFixed(3) }}>
              <span className="tn-tempo">{minutoDe(segundos)}</span>
              <small>de {minutoDe(LIMITE_DE_SEGUNDOS)}</small>
            </div>
            <div className="tn-progresso" role="progressbar" aria-valuemin={0} aria-valuemax={LIMITE_DE_SEGUNDOS} aria-valuenow={Math.round(segundos)} aria-label="Tempo de escuta">
              <span style={{ width: `${progresso * 100}%` }} />
            </div>
            {etapa === "interrompida" ? (
              <div className="tn-aviso" role="alert">
                <b>A gravação parou.</b> O navegador desligou o microfone (tela bloqueada, ligação ou outro app). Gravei {minutoDe(segundos)} até aqui.
                {erro && <span className="tn-erro"> {erro}</span>}
              </div>
            ) : (
              <p className="tn-estado">Ouvindo · faltam {minutoDe(LIMITE_DE_SEGUNDOS - segundos)}{naFila ? ` · transcrevendo ${naFila} trecho${naFila === 1 ? "" : "s"}` : ""}</p>
            )}

            <section className="tn-ouvido" aria-live="polite">
              <h3>O que já transcrevi <small>{transcritos.length} trecho{transcritos.length === 1 ? "" : "s"}</small></h3>
              {ultimos.length ? (
                ultimos.map((t) => <p key={t.indice}><time>{minutoDe(t.inicio)}</time> {t.texto}</p>)
              ) : (
                <p className="tn-vazio">O primeiro trecho aparece aqui uns 30 segundos depois de começar.</p>
              )}
            </section>

            <div className="tn-acoes">
              {etapa === "interrompida" ? (
                <>
                  <button type="button" className="tn-botao tn-botao--principal tn-botao--grande" onClick={continuar}>Continuar gravando</button>
                  <button type="button" className="tn-botao" onClick={encerrar}>Encerrar e organizar</button>
                </>
              ) : (
                <>
                  <button type="button" className="tn-botao tn-botao--principal tn-botao--grande" onClick={encerrar}>
                    <i className="tn-quadrado" aria-hidden="true" /> Encerrar e organizar
                  </button>
                  <button type="button" className="tn-botao tn-botao--discreto" onClick={descartar}>Descartar</button>
                </>
              )}
            </div>
            {etapa === "gravando" && (
              <p className="tn-ajuda tn-ajuda--centro">
                {telaLigada ? "A tela fica ligada enquanto eu escuto." : "Pode apagar a tela: eu continuo ouvindo e aviso com dois bipes quando terminar."}
              </p>
            )}
          </div>
        )}

        {(etapa === "finalizando" || etapa === "organizando") && (
          <div className="tn-corpo tn-corpo--espera" aria-live="polite">
            <div className="tn-girando" aria-hidden="true" />
            <p className="tn-estado-grande">
              {etapa === "finalizando"
                ? `Transcrevendo ${naFila > 1 ? `os últimos ${naFila} trechos` : "o último trecho"}…`
                : "Separando por assunto e anotando no Abacato…"}
            </p>
            <p className="tn-ajuda tn-ajuda--centro">{minutoDe(segundos)} de áudio · {transcritos.length} trecho{transcritos.length === 1 ? "" : "s"} transcrito{transcritos.length === 1 ? "" : "s"}</p>
            {etapa === "organizando" && (
              <p className="tn-ajuda tn-ajuda--centro">Costuma levar de 20 segundos a 2 minutos. Pode apagar a tela: eu aviso com dois bipes.</p>
            )}
          </div>
        )}

        {etapa === "falhas" && (
          <div className="tn-corpo">
            <div className="tn-aviso" role="alert">
              <b>{falhos.current.length} trecho{falhos.current.length === 1 ? "" : "s"} não {falhos.current.length === 1 ? "foi transcrito" : "foram transcritos"}.</b>{" "}
              {trechos.find((t) => t.estado === "falhou")?.erro || "A transcrição falhou."}
            </div>
            <div className="tn-acoes">
              <button type="button" className="tn-botao tn-botao--principal tn-botao--grande" onClick={tentarDeNovo}>Tentar de novo</button>
              <button type="button" className="tn-botao" onClick={semOsFalhos} disabled={!transcritos.length}>Organizar sem {falhos.current.length === 1 ? "ele" : "eles"}</button>
            </div>
          </div>
        )}

        {etapa === "pronto" && resultado && (
          <div className="tn-corpo">
            <p className="tn-pronto">
              Anotei <b>{notas.length} nota{notas.length === 1 ? "" : "s"}</b> na coluna <b>{resultado.coluna?.nome}</b> do quadro <b>{resultado.quadro?.nome}</b>
              {resultado.quadro?.novo ? " (criei o quadro agora)" : ""}.
            </p>
            {resultado.resumo && <p className="tn-resumo">{resultado.resumo}</p>}
            <ol className="tn-notas">
              {notas.map((c) => <li key={c.id}>{c.titulo}</li>)}
              <li className="tn-notas__transcricao">{resultado.cards.at(-1)?.titulo}</li>
            </ol>
            <div className="tn-acoes">
              <a className="tn-botao tn-botao--principal tn-botao--grande" href={resultado.quadro?.url} target="_blank" rel="noopener noreferrer">Abrir no Abacato</a>
              <div className="tn-acoes tn-acoes--linha">
                <button type="button" className="tn-botao" onClick={() => { setResultado(null); setTema(""); irPara("preparar"); }}>Tomar outra nota</button>
                <button type="button" className="tn-botao" onClick={() => aoFechar?.()}>Fechar</button>
              </div>
            </div>
          </div>
        )}

        {etapa === "erro" && (
          <div className="tn-corpo">
            <p className="tn-erro" role="alert">{erro}</p>
            <div className="tn-acoes">
              {podeTentar && <button type="button" className="tn-botao tn-botao--principal tn-botao--grande" onClick={organizar}>Tentar de novo</button>}
              <button type="button" className="tn-botao" onClick={() => { setErro(""); irPara("preparar"); setGuardada(lerGuardada()); }}>Voltar</button>
            </div>
            {podeTentar && <p className="tn-ajuda">O que já foi transcrito continua guardado neste aparelho.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
