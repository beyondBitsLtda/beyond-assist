import { synthesizeSpeech } from "@/lib/gemini.js";
import { cleanForSpeech } from "@/lib/cleanForSpeech.js";
import { b64ParaBytes } from "@/lib/base64.js";
import { pcmDoGemini } from "@/lib/audioDoGemini.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/speak   body: { text: string, voice?: string }
 * Retorna um arquivo WAV (audio/wav) pronto para o <audio> do navegador.
 *
 * `voice` (opcional) — nome de uma das TTS_VOICES (src/lib/gemini.js); nomes desconhecidos
 * caem pro padrão do servidor, então esse parâmetro nunca pode quebrar a chamada.
 *
 * O Gemini devolve PCM cru (L16) OU um WAV pronto, conforme o modelo de voz — ver
 * src/lib/audioDoGemini.js: tratar o WAV como PCM tocava o cabeçalho e o bloco C2PA como chiado.
 * Aqui sai sempre um WAV limpo, montado só com as amostras.
 */
export async function POST(req) {
  try {
    const { text, voice } = await req.json();
    const clean = cleanForSpeech(text || "");
    if (!clean) return json({ error: "texto vazio" }, 400);

    // limite de segurança: TTS é caro; corta textos muito longos
    const input = clean.length > 1200 ? clean.slice(0, 1200) : clean;

    const { base64, mime } = await synthesizeSpeech(input, voice);
    const { pcm, sampleRate, canais, bits } = pcmDoGemini(b64ParaBytes(base64), mime);
    const wav = pcmToWav(pcm, sampleRate, canais, bits);

    return new Response(wav, {
      headers: {
        "content-type": "audio/wav",
        "cache-control": "no-store",
        "content-length": String(wav.byteLength),
      },
    });
  } catch (err) {
    // err.keyLabel (ver rewriteError em gemini.js) diz qual chave do pool falhou.
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return json({ error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}

/**
 * Monta um arquivo WAV a partir de PCM 16-bit little-endian.
 *
 * Escrito com DataView/Uint8Array em vez de `Buffer`, que é do Node e não existe no Edge
 * runtime do Cloudflare. O `true` no fim de cada `set` é o little-endian — WAV é little-endian,
 * e esquecer esse argumento produz um arquivo que toca só chiado.
 */
function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;

  const saida = new Uint8Array(44 + dataSize);
  const v = new DataView(saida.buffer);
  const marca = (offset, texto) => {
    for (let i = 0; i < texto.length; i++) v.setUint8(offset + i, texto.charCodeAt(i));
  };

  marca(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  marca(8, "WAVE");
  marca(12, "fmt ");
  v.setUint32(16, 16, true);              // subchunk1 size (PCM)
  v.setUint16(20, 1, true);               // audio format = PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, byteRate, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitsPerSample, true);
  marca(36, "data");
  v.setUint32(40, dataSize, true);

  saida.set(pcm, 44);
  return saida;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
