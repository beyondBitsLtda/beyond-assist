// A fala do microfone vira o pedido para a Lisa (03/11/2026, BEYOND-0011): o microfone de segurar do
// chat e do modo voz e a Conversa livre no celular. Primeiro o Whisper da Groq (rápido, só transcreve);
// se ele falhar, a transcrição do Tomar nota pelo Gemini, como antes. Nos dois, o nome dela sai certo
// quando a pessoa chama por ela ("oi Elisa" → "oi Lisa", src/lib/falaComoWhatsApp.js).
//
// O Tomar nota continua só no Gemini: são trechos longos de reunião, em que o silêncio é comum e o
// Whisper às vezes inventa frase; aqui a fala é curta e já chega sem o silêncio (o aparelho só manda
// quando ouviu voz).

import { transcreverNaGroq } from "./groq.js";
import { transcreverTrechoDeNota } from "./gemini.js";
import { textoDoWhisper, dicaDaTranscricao, corrigirNomeDaLisa } from "./falaComoWhatsApp.js";

const TEMA_DO_PEDIDO = "pedido falado à assistente Lisa (quando a pessoa chama por ela, o nome é Lisa, nunca Elisa ou Liza)";

/** WAV em base64 → { texto, motor: "groq" | "gemini", aviso? } (aviso: por que a Groq não atendeu). */
export async function transcreverPedido(audio, { anterior = "" } = {}) {
  let aviso = null;
  try {
    const resposta = await transcreverNaGroq(audio, { dica: dicaDaTranscricao(anterior) });
    return { texto: corrigirNomeDaLisa(textoDoWhisper(resposta)), motor: "groq" };
  } catch (err) {
    aviso = `Groq: ${String(err?.message || err).slice(0, 160)}`;
  }
  const texto = await transcreverTrechoDeNota(audio, { tema: TEMA_DO_PEDIDO, anterior });
  return { texto: corrigirNomeDaLisa(texto), motor: "gemini", aviso };
}
