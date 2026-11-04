// Modo Tomar nota — as partes puras, usadas no aparelho (src/components/panels/TomarNota.js)
// e no servidor (src/lib/notas.js). Testadas em scripts/notas-check.mjs.

// 10 minutos ininterruptos.
export const LIMITE_DE_SEGUNDOS = 600;
// O Gemini reduz para 16 kHz de todo jeito; mandar mais é só peso.
export const TAXA_DA_GRAVACAO = 16_000;

/** "07:05" a partir de segundos. */
export function minutoDe(segundos) {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * "tomar nota sobre a reunião de vendas", "Lisa, toma nota: planejamento", "modo tomar nota".
 * Devolve o tema ("" quando não disse) ou null se a frase não é um pedido do modo. Tema longo
 * demais não conta: "toma nota que amanhã eu tenho que…" é um lembrete, não um tema.
 */
export function pedidoDeTomarNota(texto) {
  const m = String(texto || "").trim().match(
    /^(?:lisa[\s,!]+)?(?:(?:entra(?:r)?|liga(?:r)?|abr(?:e|ir))\s+(?:o\s+)?)?(?:modo\s+)?(?:tomar|toma|tome)\s+(?:uma\s+)?notas?(?:\s*(?:sobre|de|do|da|dos|das|:|—|–|-)\s*(.*?))?[\s.!?]*$/i
  );
  if (!m) return null;
  const tema = (m[1] || "").replace(/^["“']|["”']$/g, "").trim();
  return tema.length > 80 ? null : tema;
}

/**
 * O que o modelo devolve às vezes vem com sujeira que não foi dita: marcações de tempo
 * ("00:52" no meio da frase — num trecho de menos de um minuto elas são sempre 00:xx),
 * caracteres invisíveis de quebra de palavra e linhas separadoras ("───────", quando a fala
 * se repete). Tira isso e o espaço que sobra. O "— " sozinho de troca de pessoa fica.
 */
export function limparTranscricao(texto) {
  return String(texto || "")
    .replace(/[​-‍⁠﻿]/g, "")
    .replace(/(?<![\d:])00:[0-5]\d(?![\d:])/g, " ")
    .replace(/[─-╿—–_=*-]{3,}/g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]{2,}/g, " ").replace(/ +([,.;:!?])/g, "$1").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** PCM 16 bits mono → WAV (cabeçalho de 44 bytes). O formato que o Gemini aceita sempre. */
export function wavDePcm16(pcm, taxa = TAXA_DA_GRAVACAO) {
  const bytes = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + bytes);
  const v = new DataView(buffer);
  const texto = (pos, s) => { for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i)); };
  texto(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, "data");
  v.setUint32(40, bytes, true);
  new Int16Array(buffer, 44).set(pcm);
  return buffer;
}

/** Bytes → base64, em blocos (um apply com o trecho inteiro estoura a pilha). */
export function base64DeBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

/**
 * O gravador roda num AudioWorklet (thread de áudio), e não em timers da página: com a tela
 * apagada o navegador segura os timers, mas o áudio de um microfone aberto continua andando.
 * Ele mesmo reduz para 16 kHz mono, conta o tempo pelas amostras (o limite de 10 min vale
 * mesmo com a página em segundo plano) e corta os trechos numa pausa (200 ms quietos) entre 25 e
 * 35 s, para a emenda não cair no meio de uma palavra.
 *
 * Mensagens que manda: { tipo: "nivel", rms, segundos } a cada 100 ms e
 * { tipo: "trecho", indice, inicio, duracao, pico, pcm, final, motivo }.
 * Recebe: "despejar" (manda o que tem sem encerrar) e "parar".
 */
export const CODIGO_DO_GRAVADOR = `
class GravadorDeNota extends AudioWorkletProcessor {
  constructor(opcoes) {
    super();
    const o = opcoes.processorOptions || {};
    this.taxa = Math.min(o.taxa || 16000, sampleRate);
    this.limite = Math.round((o.limiteSegundos || 600) * this.taxa);
    this.total = o.jaGravadas || 0;
    this.indice = o.proximoIndice || 0;
    this.razao = sampleRate / this.taxa;
    this.passo = 0; this.soma = 0; this.n = 0;
    this.buf = new Int16Array(this.taxa * 36);
    this.len = 0; this.inicio = this.total; this.pico = 0;
    this.minimo = this.taxa * 25; this.maximo = this.taxa * 35;
    this.janela = 0; this.somaQ = 0; this.media = 0.02; this.quietas = 0;
    this.nivelN = 0; this.nivelQ = 0;
    this.parado = false;
    this.port.onmessage = (e) => {
      if (this.parado) return;
      if (e.data === "despejar") this.enviar(false, "despejo");
      if (e.data === "parar") { this.enviar(true, "parada"); this.parado = true; }
    };
  }
  enviar(final, motivo) {
    const pcm = this.buf.slice(0, this.len);
    if (this.len > 0 || final) {
      this.port.postMessage({ tipo: "trecho", indice: this.indice, inicio: this.inicio / this.taxa, duracao: this.len / this.taxa, pico: this.pico, pcm, final, motivo }, [pcm.buffer]);
      if (this.len > 0) this.indice++;
    }
    this.inicio = this.total; this.len = 0; this.pico = 0;
  }
  process(entradas) {
    if (this.parado) return false;
    const canais = entradas[0];
    if (!canais || !canais.length) return true;
    const a = canais[0], b = canais[1];
    for (let i = 0; i < a.length; i++) {
      this.soma += b ? (a[i] + b[i]) / 2 : a[i]; this.n++; this.passo++;
      if (this.passo < this.razao) continue;
      this.passo -= this.razao;
      const y = this.soma / this.n; this.soma = 0; this.n = 0;
      const s = y < -1 ? -1 : y > 1 ? 1 : y;
      this.buf[this.len++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      this.total++;
      this.somaQ += y * y; this.janela++;
      this.nivelQ += y * y; this.nivelN++;
      if (this.janela >= this.taxa / 20) {
        const rms = Math.sqrt(this.somaQ / this.janela);
        this.somaQ = 0; this.janela = 0;
        if (rms > this.pico) this.pico = rms;
        // Pausa = 200 ms seguidos bem abaixo do volume médio. Uma janela só não basta: entre
        // duas sílabas o volume também despenca, e o corte cairia no meio da palavra.
        this.quietas = rms < Math.max(0.004, this.media * 0.3) ? this.quietas + 1 : 0;
        this.media = this.media * 0.97 + rms * 0.03;
        if ((this.len >= this.minimo && this.quietas >= 4) || this.len >= this.maximo) { this.enviar(false, "corte"); this.quietas = 0; }
      }
      if (this.nivelN >= this.taxa / 10) {
        this.port.postMessage({ tipo: "nivel", rms: Math.sqrt(this.nivelQ / this.nivelN), segundos: this.total / this.taxa });
        this.nivelQ = 0; this.nivelN = 0;
      }
      if (this.total >= this.limite) { this.enviar(true, "limite"); this.parado = true; return false; }
    }
    return true;
  }
}
registerProcessor("gravador-de-nota", GravadorDeNota);
`;
