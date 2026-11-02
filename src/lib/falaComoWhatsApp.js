// O microfone do celular "como o do WhatsApp" (02/11/2026: "no modo mobile o uso do microfone não
// funciona bem, deveria ser igual ao do WhatsApp, tanto no modo chat como no modo só por fala;
// inclusive o modo só por fala nem funciona").
//
// Antes, os dois botões usavam o reconhecimento de voz do navegador (Web Speech), e no celular
// isso falhava de quatro jeitos: o dedo saindo um pouco do botão parava tudo (pointerleave); o
// navegador encerrava sozinho na primeira pausa, com o dedo ainda no botão; soltar antes de ele
// avisar que começou deixava o microfone aberto; e, ao mesmo tempo, o app abria o microfone de
// novo só para medir o volume — no Chrome do Android, dois donos do microfone derrubam o
// reconhecimento (era isso que deixava o modo voz mudo).
//
// Agora o áudio é gravado de verdade (MediaRecorder, src/lib/gravadorDeFala.js) e transcrito no
// servidor pela mesma transcrição do Tomar nota (/api/notas/trecho). O gesto é o do WhatsApp:
//
//   segurar        grava (ponto vermelho e relógio)
//   soltar         envia
//   ← deslizar     cancela
//   ↑ deslizar     trava: continua gravando sem segurar, com lixeira e enviar
//   toque curto    só mostra a dica "segure para gravar"
//
// Aqui fica o que não precisa de navegador: o gesto, o relógio, a escolha do formato, a
// conversão para 16 kHz mono e os cortes de uma fala longa. Testado por `npm run microfone-check`.

/** Distâncias do dedo (px) e o mínimo de tempo segurando para valer como fala. */
export const GESTO = { cancelar: 100, travar: 80, minimoMs: 600 };
/** Uma fala vai até 2 minutos; no limite, é enviada sozinha. */
export const LIMITE_DA_FALA = 120;
/** A taxa da transcrição: o Gemini reduz para 16 kHz de todo jeito; mandar mais é só peso. */
export const TAXA_DA_FALA = 16_000;
/** Abaixo disto (o pico do volume, 0–1), a gravação é silêncio: nem vai para o servidor. */
export const PICO_DE_SILENCIO = 0.01;

export const DICAS = {
  segure: "Segure para gravar, solte para enviar",
  liberado: "Microfone liberado. Agora segure para falar",
  silencio: "Não ouvi nada. Segure e fale de novo",
  naoEntendi: "Não entendi o áudio. Tente de novo, mais perto do microfone",
  cancelada: "Cancelada",
};

/** O que o dedo está pedindo, pelo quanto andou desde que encostou (dx < 0 é para a esquerda,
 *  dy < 0 é para cima). Cancelar ganha de travar: o dedo que foi para a esquerda desistiu. */
export function gestoDoDedo(dx, dy) {
  if (dx <= -GESTO.cancelar) return "cancelar";
  if (dy <= -GESTO.travar && dx > -GESTO.cancelar / 2) return "travar";
  return "segurando";
}

/** O que fazer ao soltar o dedo: travada continua; curta demais vira só a dica; senão, envia. */
export function aoSoltar({ duracaoMs, travada = false }) {
  if (travada) return "continuar";
  if (!(duracaoMs >= GESTO.minimoMs)) return "curta";
  return "enviar";
}

/** "0:07", "1:05". */
export function relogioDaFala(segundos) {
  const s = Math.max(0, Math.floor(Number(segundos) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** O formato da gravação que o aparelho sabe fazer (Chrome/Android: webm; iPhone: mp4). */
export function tipoDeGravacao(suporta) {
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"].find((t) => {
    try { return suporta(t); } catch { return false; }
  }) || "";
}

/** Vários canais → um (a média). */
export function mixarEmMono(canais) {
  if (!canais.length) return new Float32Array(0);
  if (canais.length === 1) return canais[0];
  const n = canais[0].length;
  const mono = new Float32Array(n);
  for (const c of canais) for (let i = 0; i < n; i++) mono[i] += c[i] / canais.length;
  return mono;
}

/** Reamostra para baixo pela média de cada janela (o mesmo jeito do gravador do Tomar nota):
 *  serve para 48 kHz → 16 kHz e para razões quebradas, como 44,1 kHz → 16 kHz. */
export function reamostrar(amostras, taxaDe, taxaPara = TAXA_DA_FALA) {
  if (taxaDe <= taxaPara) return Float32Array.from(amostras);
  const razao = taxaDe / taxaPara;
  const saida = new Float32Array(Math.floor(amostras.length / razao));
  let passo = 0, soma = 0, n = 0, j = 0;
  for (let i = 0; i < amostras.length && j < saida.length; i++) {
    soma += amostras[i]; n++; passo++;
    if (passo < razao) continue;
    passo -= razao;
    saida[j++] = soma / n;
    soma = 0; n = 0;
  }
  return saida;
}

/** Float (−1 a 1) → PCM de 16 bits. */
export function pcm16DeFloat(amostras) {
  const pcm = new Int16Array(amostras.length);
  for (let i = 0; i < amostras.length; i++) {
    const s = amostras[i] < -1 ? -1 : amostras[i] > 1 ? 1 : amostras[i];
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm;
}

/** O maior volume (RMS em janelas de 50 ms, 0–1): é o que diz se houve fala ou só silêncio. */
export function picoDaFala(pcm, taxa = TAXA_DA_FALA) {
  const janela = Math.max(1, Math.round(taxa / 20));
  let pico = 0;
  for (let i = 0; i < pcm.length; i += janela) {
    let soma = 0;
    const fim = Math.min(pcm.length, i + janela);
    for (let k = i; k < fim; k++) { const v = pcm[k] / 0x8000; soma += v * v; }
    pico = Math.max(pico, Math.sqrt(soma / (fim - i)));
  }
  return pico;
}

/**
 * Onde cortar uma fala longa para a transcrição (cada pedaço vai num pedido): pedaços de até
 * `maximo` segundos, e cada corte na janela de 50 ms mais quieta entre `minimo` e `maximo` depois
 * do anterior — para não cortar no meio de uma palavra. Devolve [[início, fim], …] em amostras.
 */
export function cortesNaPausa(pcm, taxa = TAXA_DA_FALA, { minimo = 25, maximo = 35 } = {}) {
  const cortes = [];
  const janela = Math.max(1, Math.round(taxa / 20));
  let inicio = 0;
  while (pcm.length - inicio > maximo * taxa) {
    let melhor = inicio + maximo * taxa;
    let menor = Infinity;
    for (let i = inicio + minimo * taxa; i + janela <= inicio + maximo * taxa; i += janela) {
      let soma = 0;
      for (let k = i; k < i + janela; k++) soma += (pcm[k] / 0x8000) ** 2;
      if (soma < menor) { menor = soma; melhor = i + Math.floor(janela / 2); }
    }
    cortes.push([inicio, melhor]);
    inicio = melhor;
  }
  if (pcm.length > inicio) cortes.push([inicio, pcm.length]);
  return cortes;
}

/** Os textos dos pedaços, numa frase só. */
export function juntarTranscricoes(textos) {
  return textos.map((t) => String(t || "").trim()).filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
}

/** A mensagem para o erro de abrir o microfone. */
export function dicaDoErro(erro) {
  const nome = erro?.name || "";
  if (nome === "NotAllowedError" || nome === "SecurityError") {
    return "O microfone está bloqueado para a Lisa. Libere nas permissões do navegador e tente de novo";
  }
  if (nome === "NotFoundError" || nome === "OverconstrainedError") return "Não encontrei um microfone neste aparelho";
  if (nome === "NotReadableError") return "O microfone está em uso por outro app. Feche o outro app e tente de novo";
  return "Não consegui abrir o microfone. Tente de novo";
}
