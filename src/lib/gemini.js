import { GoogleGenAI } from "@google/genai";

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
const EMBED_DIM = Number(process.env.GEMINI_EMBED_DIM || 768);

let _ai = null;
function ai() {
  if (_ai) return _ai;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada. " +
      "Defina em Vercel → Settings → Environment Variables (ou no .env local)."
    );
  }
  _ai = new GoogleGenAI({ apiKey });
  return _ai;
}

// ---- erros transitórios do Gemini (429 quota / 503 alta demanda) ----
// A API costuma devolver o corpo cru como uma string JSON aninhada e feia
// (ex.: {"error":{"message":"{\"error\":{\"code\":503,...}}",...}}). Detectamos
// por substring (robusto o bastante pro texto que a API realmente devolve) e
// trocamos por uma mensagem curta e acionável — nunca mostramos o JSON cru pro usuário.
function isQuotaError(msg) {
  return msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("429");
}
function isOverloadError(msg) {
  return msg.includes("UNAVAILABLE") || msg.includes("high demand") || msg.includes("503");
}
function isTransientError(err) {
  const msg = String(err?.message || err);
  return isQuotaError(msg) || isOverloadError(msg);
}
function rewriteTransientError(err) {
  const msg = String(err?.message || err);
  if (isQuotaError(msg)) {
    const e = new Error("QUOTA_EXCEEDED: limite do Gemini atingido. Aguarde ~1 min e tente de novo.");
    e.code = "QUOTA";
    return e;
  }
  if (isOverloadError(msg)) {
    const e = new Error("UNAVAILABLE: o Gemini está com alta demanda no momento. Tente de novo em instantes.");
    e.code = "UNAVAILABLE";
    return e;
  }
  return err;
}

/** Repete a chamada quando o erro é transitório (429/503); troca por mensagem curta se persistir. */
async function withTransientRetry(fn, { attempts = 3, delayMs = 1200 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientError(err) || attempt === attempts) throw rewriteTransientError(err);
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error("withTransientRetry: unreachable");
}

/**
 * Gera embeddings para um ou mais textos.
 * taskType: "RETRIEVAL_DOCUMENT" ao indexar, "RETRIEVAL_QUERY" ao buscar.
 * Retorna sempre um array de vetores (number[][]).
 *
 * Faz retry automático quando o Gemini devolve 429 (quota) ou 503 (alta demanda).
 */
export async function embed(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const contents = Array.isArray(texts) ? texts : [texts];
  // menos tentativas e esperas curtas: falha rápido em vez de travar minutos.
  // (a ingestão em lote tem seu próprio ritmo; aqui priorizamos resposta rápida)
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await ai().models.embedContent({
        model: EMBED_MODEL,
        contents,
        config: { outputDimensionality: EMBED_DIM, taskType },
      });
      return res.embeddings.map((e) => e.values);
    } catch (err) {
      if (!isTransientError(err) || attempt === maxAttempts) throw rewriteTransientError(err);
      await new Promise((r) => setTimeout(r, 3000)); // uma espera curta só
    }
  }
  throw new Error("embed: unreachable");
}

/** Conveniência: embedding de um único texto (number[]). */
export async function embedOne(text, taskType = "RETRIEVAL_QUERY") {
  const [v] = await embed(text, taskType);
  return v;
}

/**
 * Versão PACIENTE do embed, só para ingestão em lote.
 * Espera o tempo que o Gemini pedir (retryDelay) para respeitar a quota,
 * já que reindexar não precisa ser instantâneo.
 */
export async function embedForIngest(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const contents = Array.isArray(texts) ? texts : [texts];
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await ai().models.embedContent({
        model: EMBED_MODEL,
        contents,
        config: { outputDimensionality: EMBED_DIM, taskType },
      });
      return res.embeddings.map((e) => e.values);
    } catch (err) {
      if (!isTransientError(err) || attempt === maxAttempts) throw err;
      const msg = String(err?.message || err);
      const m = msg.match(/retry in ([\d.]+)s/i);
      const waitSec = m ? Math.ceil(Number(m[1])) + 1 : 15 * attempt;
      await new Promise((r) => setTimeout(r, waitSec * 1000));
    }
  }
  throw new Error("embedForIngest: unreachable");
}

/**
 * Gera a resposta em streaming.
 * Retorna um async iterator de pedaços de texto (string).
 *
 * `tools` (opcional) — ex.: [{ googleSearch: {} }] pra habilitar grounding com
 * busca do Google (o modelo decide sozinho quando de fato buscar). Usado pelo
 * modo "Geral" do assistente.
 */
export async function* chatStream(prompt, systemInstruction, { tools } = {}) {
  const config = {};
  if (systemInstruction) config.systemInstruction = systemInstruction;
  if (tools) config.tools = tools;

  // retry só na abertura do stream (antes de qualquer chunk chegar) — 429/503 costumam
  // se resolver em segundos; uma vez que o texto começou a chegar não há o que repetir.
  const stream = await withTransientRetry(() =>
    ai().models.generateContentStream({
      model: CHAT_MODEL,
      contents: prompt,
      config: Object.keys(config).length ? config : undefined,
    })
  );
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}

// ---- TTS: gera áudio a partir de texto ----
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Kore";

/**
 * Gera fala a partir de texto.
 * Retorna { base64, sampleRate, mime } — áudio PCM cru (L16) que a rota
 * converte em WAV para o navegador tocar.
 */
export async function synthesizeSpeech(text) {
  const res = await withTransientRetry(() =>
    ai().models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } },
        },
      },
    })
  );

  const part = res?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  const inline = part?.inlineData;
  if (!inline?.data) throw new Error("TTS: resposta sem áudio");

  // mime tipo "audio/L16;codec=pcm;rate=24000"
  const rateMatch = /rate=(\d+)/.exec(inline.mimeType || "");
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;

  return { base64: inline.data, sampleRate, mime: inline.mimeType || "audio/L16" };
}
