// A gravação da fala do microfone "como o do WhatsApp" (as regras: src/lib/falaComoWhatsApp.js).
//
// Grava com o MediaRecorder (webm no Android, mp4 no iPhone): ele não depende do reconhecimento de
// voz do navegador nem de um gesto para começar. Depois, o OfflineAudioContext decodifica o
// arquivo (também sem gesto) e a fala vira WAV mono de 16 kHz — o formato que o Gemini aceita
// sempre — em pedaços de até 35 s, transcritos por /api/notas/trecho como pedido (o Whisper da Groq
// primeiro; se falhar, a transcrição do Tomar nota). O áudio não fica guardado: só o texto volta.

import {
  TAXA_DA_FALA, tipoDeGravacao, mixarEmMono, reamostrar, pcm16DeFloat, picoDaFala, cortesNaPausa, juntarTranscricoes,
} from "./falaComoWhatsApp.js";
import { wavDePcm16, base64DeBytes } from "./tomarNota.js";
import { medirMicrofone, fecharMicrofone } from "./vozAnalisador.js";

/** Abre o microfone e começa a gravar. Devolve { segundos(), parar() → Promise<Blob>, cancelar() }. */
export async function comecarGravacao() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw Object.assign(new Error("este navegador não grava áudio"), { name: "NotSupportedError" });
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const tipo = tipoDeGravacao((t) => MediaRecorder.isTypeSupported?.(t));
  let gravador;
  try {
    gravador = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  }
  const pedacos = [];
  gravador.ondataavailable = (e) => { if (e.data?.size) pedacos.push(e.data); };
  const inicio = performance.now();
  gravador.start(250);
  medirMicrofone(stream); // o volume para a esfera, do MESMO microfone
  const soltar = () => {
    stream.getTracks().forEach((t) => t.stop());
    fecharMicrofone();
  };
  return {
    segundos: () => (performance.now() - inicio) / 1000,
    parar: () => new Promise((ok) => {
      gravador.onstop = () => { soltar(); ok(new Blob(pedacos, { type: gravador.mimeType || tipo || "audio/webm" })); };
      try { gravador.stop(); } catch { soltar(); ok(new Blob(pedacos, { type: tipo || "audio/webm" })); }
    }),
    cancelar: () => {
      gravador.onstop = null;
      try { gravador.stop(); } catch { /* já parado */ }
      soltar();
    },
  };
}

/** A gravação → { segundos, pico, pedacos: [base64 de WAV mono 16 kHz] }. `desde` (segundos): o começo
 *  que fica de fora — na Conversa livre a gravação corre antes de a pessoa falar (conversaPorGravacao.js). */
export async function falaEmWav(blob, { desde = 0 } = {}) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  // 44,1 kHz é a taxa que todo navegador aceita num OfflineAudioContext; a redução para 16 kHz é nossa
  const ctx = new Offline(1, 1, 44_100);
  const bytes = await blob.arrayBuffer();
  const audio = await new Promise((ok, erro) => {
    const p = ctx.decodeAudioData(bytes, ok, erro); // o Safari antigo só conhece os callbacks
    if (p?.then) p.then(ok, erro);
  });
  const canais = [];
  for (let c = 0; c < audio.numberOfChannels; c++) canais.push(audio.getChannelData(c));
  const tudo = pcm16DeFloat(reamostrar(mixarEmMono(canais), audio.sampleRate, TAXA_DA_FALA));
  const pcm = desde > 0 ? tudo.subarray(Math.min(tudo.length, Math.floor(desde * TAXA_DA_FALA))) : tudo;
  return {
    segundos: pcm.length / TAXA_DA_FALA,
    pico: picoDaFala(pcm),
    pedacos: cortesNaPausa(pcm).map(([a, b]) => base64DeBytes(wavDePcm16(pcm.slice(a, b), TAXA_DA_FALA))),
  };
}

/** Um pedaço não espera mais que isto pela transcrição: sem resposta, vira erro (e não "transcrevendo…" para sempre). */
const TETO_DA_TRANSCRICAO_MS = 40_000;

/** Os pedaços → o texto (cada um leva o fim do anterior, para a emenda sair certa). Vão como `comando`:
 *  o Whisper da Groq primeiro, mais rápido (src/lib/transcricaoDaFala.js). `aoResultado` recebe
 *  { motor, aviso } de cada pedaço — quem transcreveu, para o registro. */
export async function transcreverFala(pedacos, { sinal, aoResultado } = {}) {
  const textos = [];
  for (const data of pedacos) {
    const teto = new AbortController();
    const relogio = setTimeout(() => teto.abort(), TETO_DA_TRANSCRICAO_MS);
    const desistir = () => teto.abort();
    sinal?.addEventListener?.("abort", desistir);
    try {
      const r = await fetch("/api/notas/trecho", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ comando: true, anterior: (textos.at(-1) || "").slice(-240), audio: { mimeType: "audio/wav", data } }),
        signal: teto.signal,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || `a transcrição falhou (HTTP ${r.status})`);
      try { aoResultado?.({ motor: d.motor, aviso: d.aviso }); } catch { /* o registro não derruba a fala */ }
      textos.push(d.texto || "");
    } catch (e) {
      if (e?.name === "AbortError" && !sinal?.aborted) throw new Error(`a transcrição não respondeu em ${TETO_DA_TRANSCRICAO_MS / 1000} s`);
      throw e;
    } finally {
      clearTimeout(relogio);
      sinal?.removeEventListener?.("abort", desistir);
    }
  }
  return juntarTranscricoes(textos);
}
