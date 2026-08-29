import { synthesizeSpeech } from "@/lib/gemini.js";
import { cleanForSpeech } from "@/lib/cleanForSpeech.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/speak   body: { text: string, voice?: string }
 * Retorna um arquivo WAV (audio/wav) pronto para o <audio> do navegador.
 *
 * `voice` (opcional) — nome de uma das TTS_VOICES (src/lib/gemini.js); nomes desconhecidos
 * caem pro padrão do servidor, então esse parâmetro nunca pode quebrar a chamada.
 *
 * O Gemini devolve PCM cru (L16, 24kHz, mono). Aqui montamos o cabeçalho WAV.
 */
export async function POST(req) {
  try {
    const { text, voice } = await req.json();
    const clean = cleanForSpeech(text || "");
    if (!clean) return json({ error: "texto vazio" }, 400);

    // limite de segurança: TTS é caro; corta textos muito longos
    const input = clean.length > 1200 ? clean.slice(0, 1200) : clean;

    const { base64, sampleRate } = await synthesizeSpeech(input, voice);
    const pcm = Buffer.from(base64, "base64");
    const wav = pcmToWav(pcm, sampleRate, 1, 16);

    return new Response(wav, {
      headers: {
        "content-type": "audio/wav",
        "cache-control": "no-store",
        "content-length": String(wav.length),
      },
    });
  } catch (err) {
    // err.keyLabel (ver rewriteError em gemini.js) diz qual chave do pool falhou.
    const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
    return json({ error: `${String(err?.message || err)}${keySuffix}` }, 500);
  }
}

/** Monta um arquivo WAV a partir de PCM 16-bit little-endian. */
function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);           // subchunk1 size (PCM)
  header.writeUInt16LE(1, 20);            // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
