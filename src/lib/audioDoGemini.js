// O áudio que o TTS do Gemini devolve, reduzido ao que interessa: as amostras PCM.
//
// O CHIADO DE RÁDIO ENTRE AS FALAS (13/10/2026) veio daqui. Os modelos de voz não devolvem o
// mesmo formato:
//
//   gemini-3.1-flash-tts-preview  "audio/l16; rate=24000"  → PCM cru, como sempre foi
//   gemini-3.8-flash-tts          "audio/wav"              → um WAV INTEIRO: cabeçalho RIFF,
//                                                            "fmt ", "data" e, no fim, um bloco
//                                                            "C2PA" de ~6 KB (a marca de procedência
//                                                            de conteúdo gerado por IA)
//
// A rota /api/speak tratava tudo como PCM cru e punha um cabeçalho WAV por cima. Com o 3.8, os
// 44 bytes do cabeçalho original e os 6 KB do C2PA eram tocados COMO SOM: um estalo no começo
// e ~0,13 s de chiado no fim de cada pedaço da fala — o "rádio do exército" entre uma frase e
// outra. Aqui o WAV é aberto e só o bloco "data" segue adiante.
//
// Sem `Buffer` (não existe no runtime da Cloudflare): só Uint8Array e DataView.

const ascii = (bytes, inicio) => String.fromCharCode(bytes[inicio], bytes[inicio + 1], bytes[inicio + 2], bytes[inicio + 3]);

/**
 * `{ pcm, sampleRate, canais, bits }` a partir dos bytes que o Gemini mandou e do mimeType dele.
 *
 * WAV: lê "fmt " e devolve exatamente o conteúdo de "data" (o que vier depois — C2PA, LIST,
 * qualquer metadado — fica de fora). PCM cru: a taxa sai do mimeType ("rate=24000").
 * O PCM devolvido tem sempre um número PAR de bytes: meia amostra solta no fim também estala.
 */
export function pcmDoGemini(bytes, mimeType = "") {
  const ehWav = bytes.length >= 12 && ascii(bytes, 0) === "RIFF" && ascii(bytes, 8) === "WAVE";
  if (!ehWav) {
    const taxa = /rate=(\d+)/i.exec(mimeType || "");
    const pcm = bytes.length % 2 ? bytes.subarray(0, bytes.length - 1) : bytes;
    return { pcm, sampleRate: taxa ? Number(taxa[1]) : 24000, canais: 1, bits: 16 };
  }

  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sampleRate = 24000;
  let canais = 1;
  let bits = 16;
  let pcm = null;
  for (let o = 12; o + 8 <= bytes.length;) {
    const id = ascii(bytes, o);
    const tamanho = v.getUint32(o + 4, true);
    const inicio = o + 8;
    if (id === "fmt " && inicio + 16 <= bytes.length) {
      canais = v.getUint16(inicio + 2, true);
      sampleRate = v.getUint32(inicio + 4, true);
      bits = v.getUint16(inicio + 14, true);
    } else if (id === "data") {
      // Tamanho "indefinido" (0xFFFFFFFF, de quem escreve em streaming) ou maior que o que
      // chegou: vai até o fim do que existe.
      const fim = tamanho === 0xffffffff ? bytes.length : Math.min(bytes.length, inicio + tamanho);
      pcm = bytes.subarray(inicio, fim);
      break;
    }
    o = inicio + tamanho + (tamanho % 2); // blocos RIFF são alinhados em 2 bytes
  }
  if (!pcm) throw new Error("TTS: WAV sem bloco de áudio (data)");
  if (pcm.length % 2) pcm = pcm.subarray(0, pcm.length - 1);
  return { pcm, sampleRate, canais, bits };
}
