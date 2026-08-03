import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
const EMBED_DIM = Number(process.env.GEMINI_EMBED_DIM || 768);

/**
 * Gera embeddings para um ou mais textos.
 * taskType: "RETRIEVAL_DOCUMENT" ao indexar, "RETRIEVAL_QUERY" ao buscar.
 * Retorna sempre um array de vetores (number[][]).
 */
export async function embed(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const contents = Array.isArray(texts) ? texts : [texts];
  const res = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents,
    config: { outputDimensionality: EMBED_DIM, taskType },
  });
  // O SDK retorna { embeddings: [{ values: number[] }, ...] }
  return res.embeddings.map((e) => e.values);
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
  const stream = await ai.models.generateContentStream({
    model: CHAT_MODEL,
    contents: prompt,
    config: systemInstruction ? { systemInstruction } : undefined,
  });
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}
