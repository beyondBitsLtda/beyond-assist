// A Conversa livre no CELULAR (03/11/2026, BEYOND-0011: "o modo conversa não funciona, a Lisa fica
// pensando e não faz nada, nunca responde de volta").
//
// No computador a conversa usa o reconhecimento de voz do navegador. No celular ele não serve: com o
// microfone da esfera aberto ao mesmo tempo, o Chrome do Android derruba a escuta (o mesmo motivo que
// levou o microfone de segurar a gravar, ver src/lib/falaComoWhatsApp.js). Aqui a conversa GRAVA:
//
//   ouvindo        o microfone aberto e gravando; o volume (nivelDoMicrofone) diz quando a fala começa
//                  e, depois de VEZ.silencioMs quieto, que ela acabou (passoDaEscuta, testado)
//   transcrevendo  a gravação, sem o silêncio de antes da fala, vai para /api/notas/trecho como pedido
//   respondendo    o texto vai para a Lisa (aoTexto); o microfone FECHA até ela terminar de falar —
//                  senão ela se ouve, e no Android o microfone aberto abafa a voz dela
//
// Cada espera tem teto (a transcrição em gravadorDeFala.js; a fala dela em quem chama), para a
// conversa não ficar presa num passo que nunca termina.

import { inicioDaEscuta, passoDaEscuta, tipoDeGravacao, PICO_DE_SILENCIO } from "./falaComoWhatsApp.js";
import { falaEmWav, transcreverFala } from "./gravadorDeFala.js";
import { medirMicrofone, fecharMicrofone, nivelDoMicrofone } from "./vozAnalisador.js";

/** O volume é lido a cada PASSO_MS; a gravação guarda ANTES_DA_FALA_S antes do começo da fala. */
const PASSO_MS = 80;
const ANTES_DA_FALA_S = 0.4;

/**
 * Abre o microfone e conversa até `fechar()`. Levanta o erro do getUserMedia (permissão negada, sem
 * microfone) para quem chamou dizer o motivo.
 *   aoTexto(texto)  uma promessa: a Lisa responde e fala; a escuta volta quando ela termina
 *   aoEstado(e)     "ouvindo" | "transcrevendo" | "respondendo"
 *   aoAviso(t)      o que deu errado numa vez (a conversa continua)
 *   aoMotor(r)      { motor, aviso } da transcrição, para o registro
 */
export async function abrirConversaPorGravacao({ aoTexto, aoEstado, aoAviso, aoMotor }) {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw Object.assign(new Error("este navegador não grava áudio"), { name: "NotSupportedError" });
  }
  const tipo = tipoDeGravacao((t) => MediaRecorder.isTypeSupported?.(t));
  let parado = false;
  let stream = null;
  let gravacao = null; // { gravador, pedacos, inicio }
  let estado = null;
  let ocupado = false;
  let relogio = null;
  let medidoEm = 0;

  const avisar = (t) => { try { aoAviso?.(t); } catch { /* o registro não derruba a conversa */ } };
  const mudar = (e) => { try { aoEstado?.(e); } catch { /* idem */ } };

  const abrirMicrofone = async () => {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    medirMicrofone(stream); // o volume vem do MESMO microfone (no Android, dois donos derrubam um)
    medidoEm = performance.now();
  };
  const fecharMicrofoneDaConversa = () => {
    try { stream?.getTracks().forEach((t) => t.stop()); } catch { /* já parado */ }
    stream = null;
    fecharMicrofone();
  };

  const comecarGravacao = () => {
    const pedacos = [];
    const gravador = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    gravador.ondataavailable = (e) => { if (e.data?.size) pedacos.push(e.data); };
    gravador.start(250);
    gravacao = { gravador, pedacos, inicio: performance.now() };
  };
  const descartarGravacao = () => {
    const g = gravacao;
    gravacao = null;
    if (!g) return;
    g.gravador.ondataavailable = null;
    try { g.gravador.stop(); } catch { /* já parado */ }
  };
  const fecharGravacao = () => new Promise((ok) => {
    const g = gravacao;
    gravacao = null;
    if (!g) return ok(null);
    const blob = () => new Blob(g.pedacos, { type: g.gravador.mimeType || tipo || "audio/webm" });
    g.gravador.onstop = () => ok({ blob: blob(), inicio: g.inicio });
    try { g.gravador.stop(); } catch { ok({ blob: blob(), inicio: g.inicio }); }
  });

  const ouvir = async () => {
    if (parado) return;
    if (!stream) await abrirMicrofone();
    if (parado) return fecharMicrofoneDaConversa();
    comecarGravacao();
    estado = inicioDaEscuta(performance.now());
    mudar("ouvindo");
  };

  // a vez da pessoa acabou: transcreve, entrega à Lisa e volta a ouvir
  const vez = async (fala) => {
    ocupado = true;
    try {
      const fechada = await fecharGravacao();
      fecharMicrofoneDaConversa();
      if (!fechada || parado) return;
      mudar("transcrevendo");
      const desde = Math.max(0, (fala.inicio - fechada.inicio) / 1000 - ANTES_DA_FALA_S);
      const wav = await falaEmWav(fechada.blob, { desde });
      if (wav.pico < PICO_DE_SILENCIO) return;
      const texto = await transcreverFala(wav.pedacos, { aoResultado: aoMotor });
      if (!texto || parado) return;
      mudar("respondendo");
      await aoTexto(texto);
    } catch (err) {
      avisar(`não consegui ouvir esta vez: ${String(err?.message || err).slice(0, 140)}`);
    } finally {
      ocupado = false;
      if (!parado) await ouvir().catch((err) => { avisar(`o microfone não reabriu: ${err?.message || err}`); fechar(); });
    }
  };

  const passo = () => {
    if (parado || ocupado || !gravacao || !estado) return;
    const nivel = nivelDoMicrofone();
    if (nivel === null) {
      // o áudio do app ainda não estava liberado quando o microfone abriu: tenta medir de novo
      if (performance.now() - medidoEm > 1000) { medirMicrofone(stream); medidoEm = performance.now(); }
      return;
    }
    const r = passoDaEscuta(estado, nivel, performance.now());
    estado = r.estado;
    if (r.acao === "terminou") vez({ inicio: estado.inicio });
    else if (r.acao === "recomecar") { descartarGravacao(); comecarGravacao(); }
  };

  const fechar = () => {
    parado = true;
    clearInterval(relogio);
    descartarGravacao();
    fecharMicrofoneDaConversa();
  };

  await abrirMicrofone();
  comecarGravacao();
  estado = inicioDaEscuta(performance.now());
  mudar("ouvindo");
  relogio = setInterval(passo, PASSO_MS);
  return { fechar };
}
