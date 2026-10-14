// O volume da voz da Lisa e do microfone, para a esfera do Assistente se mexer com o som de
// verdade (ver src/components/panels/EsferaDaVoz.js).
//
// UM AudioContext para o app inteiro, com um AnalyserNode no caminho até os alto-falantes:
//
//   <audio> da fala ──► MediaElementSource ──► analisador ──► destino (alto-falantes)
//   microfone ──► MediaStreamSource ──► analisadorDoMic   (não vai para os alto-falantes)
//
// O CUIDADO QUE DECIDE TUDO: depois de createMediaElementSource, o som do <audio> só sai pelo
// grafo. Se o contexto estiver suspenso (o navegador só libera depois de um gesto do usuário),
// ligar o elemento deixaria a Lisa MUDA. Por isso só se liga quando o contexto já está rodando;
// fora disso o elemento toca como sempre tocou e a esfera simula o movimento. A esfera é enfeite;
// a voz não pode depender dela.

let ctx = null;
let analisador = null;
let dadosDaVoz = null;
let analisadorDoMic = null;
let dadosDoMic = null;
let streamDoMic = null;
let tocando = 0; // quantos <audio> ligados estão tocando agora

function contexto() {
  if (ctx || typeof window === "undefined") return ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    ctx = new Ctx();
    analisador = ctx.createAnalyser();
    analisador.fftSize = 512;
    analisador.smoothingTimeConstant = 0.6;
    analisador.connect(ctx.destination);
    dadosDaVoz = new Uint8Array(analisador.fftSize);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Chame dentro de um gesto (clique, tecla): é o que o navegador exige para liberar o áudio. */
export function acordarAudio() {
  const c = contexto();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

/**
 * Passa um <audio> da fala pelo analisador. Devolve true se ligou; false deixa o elemento como
 * está (toca normalmente, só não é medido). Cada pedaço da fala é um <audio> novo, e um elemento
 * só pode ser ligado uma vez — daí a marca.
 */
export function escutarElemento(audio) {
  try {
    const c = contexto();
    if (!c || c.state !== "running" || !audio) return false;
    if (audio.__bbLigado) return true;
    const fonte = c.createMediaElementSource(audio);
    fonte.connect(analisador);
    audio.__bbLigado = true;
    let contando = false;
    const comecou = () => { if (!contando) { contando = true; tocando++; } };
    const parou = () => { if (contando) { contando = false; tocando = Math.max(0, tocando - 1); } };
    audio.addEventListener("playing", comecou);
    audio.addEventListener("pause", parou);
    audio.addEventListener("ended", parou);
    audio.addEventListener("error", parou);
    return true;
  } catch {
    return false;
  }
}

function rms(no, dados) {
  if (!no || !dados) return 0;
  no.getByteTimeDomainData(dados);
  let soma = 0;
  for (let i = 0; i < dados.length; i++) {
    const v = (dados[i] - 128) / 128;
    soma += v * v;
  }
  return Math.sqrt(soma / dados.length);
}

/** Volume da fala (0–1), ou null quando não há fala medida tocando — aí a esfera simula. */
export function nivelDaVoz() {
  if (!tocando || !analisador) return null;
  return Math.min(1, rms(analisador, dadosDaVoz) * 3.2);
}

/** Abre o microfone SÓ para medir o volume (o reconhecimento de voz usa o dele, à parte). */
export async function abrirMicrofone() {
  if (streamDoMic || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
  try {
    const c = contexto();
    if (!c) return;
    if (c.state === "suspended") await c.resume().catch(() => {});
    streamDoMic = await navigator.mediaDevices.getUserMedia({ audio: true });
    analisadorDoMic = c.createAnalyser();
    analisadorDoMic.fftSize = 512;
    analisadorDoMic.smoothingTimeConstant = 0.5;
    c.createMediaStreamSource(streamDoMic).connect(analisadorDoMic);
    dadosDoMic = new Uint8Array(analisadorDoMic.fftSize);
  } catch {
    fecharMicrofone();
  }
}

export function fecharMicrofone() {
  try { streamDoMic?.getTracks().forEach((t) => t.stop()); } catch { /* já parado */ }
  streamDoMic = null;
  analisadorDoMic = null;
  dadosDoMic = null;
}

/** Volume do microfone (0–1), ou null quando ele não está aberto. */
export function nivelDoMicrofone() {
  if (!analisadorDoMic) return null;
  return Math.min(1, rms(analisadorDoMic, dadosDoMic) * 4.5);
}
