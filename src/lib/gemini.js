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

/**
 * Gera embeddings para um ou mais textos.
 * taskType: "RETRIEVAL_DOCUMENT" ao indexar, "RETRIEVAL_QUERY" ao buscar.
 * Retorna sempre um array de vetores (number[][]).
 *
 * Faz retry automático quando o Gemini devolve 429 (quota do free tier).
 */
export async function embed(texts, taskType = "RETRIEVAL_DOCUMENT") {
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
      const msg = String(err?.message || err);
      const is429 = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
      if (!is429 || attempt === maxAttempts) throw err;
      // extrai retryDelay do payload se houver ("Please retry in 12.2s")
      const m = msg.match(/retry in ([\d.]+)s/i);
      const waitSec = m ? Math.ceil(Number(m[1])) + 1 : 15 * attempt;
      console.warn(`[gemini] quota atingida, esperando ${waitSec}s (tentativa ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
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
 * Gera a resposta em streaming.
 * Retorna um async iterator de pedaços de texto (string).
 */
export async function* chatStream(prompt, systemInstruction) {
  const stream = await ai().models.generateContentStream({
    model: CHAT_MODEL,
    contents: prompt,
    config: systemInstruction ? { systemInstruction } : undefined,
  });
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}
