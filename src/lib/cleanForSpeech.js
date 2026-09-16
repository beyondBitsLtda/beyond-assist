// Limpa o texto para o TTS (voz) não ler símbolos literalmente.
// A tela continua mostrando o texto original; isto afeta SÓ a fala.

export function cleanForSpeech(input) {
  if (!input) return "";
  let t = String(input);

  // remove blocos de código inteiros (não faz sentido falar código)
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]+)`/g, "$1");

  // markdown de ênfase: **negrito**, *itálico*, __x__, _x_
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/\*([^*]+)\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1");
  t = t.replace(/(?<!\w)_([^_]+)_(?!\w)/g, "$1");

  // cabeçalhos markdown (# Título) → só o texto
  t = t.replace(/^#{1,6}\s+/gm, "");

  // links [texto](url) → texto
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // bullets no início da linha (-, *, •, +) → vira frase
  t = t.replace(/^\s*[-*•+]\s+/gm, "");

  // listas numeradas "1. " "2) " → mantém como "primeiro/segundo" fica difícil;
  // então só tira o marcador e deixa a pausa da vírgula
  t = t.replace(/^\s*\d+[.)]\s+/gm, "");

  // parênteses: mantém o conteúdo, tira os símbolos (ele lia "abre parênteses")
  t = t.replace(/[()]/g, " ");

  // colchetes e chaves
  t = t.replace(/[\[\]{}]/g, " ");

  // travessão / hífen isolado entre espaços → pausa (vírgula)
  t = t.replace(/\s[-–—]\s/g, ", ");

  // símbolos que o TTS soletra
  t = t.replace(/[#>*_`|]/g, " ");
  t = t.replace(/&/g, " e ");
  t = t.replace(/\//g, " ");           // "segunda/sexta" → "segunda sexta"
  t = t.replace(/\.\.\./g, ". ");      // reticências → pausa

  // emojis / pictogramas
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, " ");

  // múltiplos espaços / quebras → normaliza
  t = t.replace(/\n{2,}/g, ". ");      // parágrafos viram pausa
  t = t.replace(/\n/g, ", ");
  t = t.replace(/\s{2,}/g, " ");
  t = t.replace(/\s+([,.!?;:])/g, "$1"); // sem espaço antes de pontuação
  t = t.replace(/([,.!?;:]){2,}/g, "$1"); // pontuação repetida

  return t.trim();
}

// ---- corte em pedaços faláveis ---------------------------------------------------------

/**
 * Quebra o texto em pedaços curtos o bastante para o Gemini sintetizar sem estourar o tempo.
 *
 * O motivo é físico, não estético: o tempo de síntese acompanha a QUANTIDADE DE ÁUDIO pedida.
 * Em português falado, ~14 caracteres viram 1 segundo de fala. Uma resposta de 340 caracteres
 * é quase meio minuto de áudio — e era mandada numa única chamada, com teto de 22 s. Não era
 * azar de chave: o teto era menor que o áudio, e nenhuma tentativa poderia dar certo. Foi
 * exatamente isso que apareceu em 16/09/2026, com três chaves seguidas marcadas como
 * "tempo esgotado" enquanto todas apareciam disponíveis no painel.
 *
 * Cortar resolve duas coisas de uma vez: cada chamada volta a caber no teto, e a Lisa começa
 * a falar antes — o primeiro pedaço já toca enquanto o segundo está sendo sintetizado (a fila
 * de reprodução do Assistente já fazia isso; só faltava ter mais de um pedaço).
 *
 * O corte respeita fim de frase. Falar "ele disse que" / "ia chegar tarde" com pausa no meio
 * soa pior que uma frase um pouco mais longa, então o alvo é orientação, não regra.
 */
export function dividirParaFala(texto, alvo = 180) {
  const limpo = String(texto || "").trim();
  if (!limpo) return [];
  if (limpo.length <= alvo) return [limpo];

  // Mantém a pontuação junto da frase que a terminou.
  const frases = limpo.match(/[^.!?…]+[.!?…]+[\s]*|[^.!?…]+$/g) || [limpo];

  const pedacos = [];
  let atual = "";
  for (const frase of frases) {
    const f = frase.trim();
    if (!f) continue;

    // Frase sozinha já maior que o alvo: parte em vírgulas, e só então em espaços. Uma frase
    // de 500 caracteres sem pontuação existe (listas ditadas, por exemplo) e não pode virar
    // uma chamada de TTS de meio minuto só porque ninguém pôs um ponto final.
    if (f.length > alvo * 1.6) {
      if (atual) { pedacos.push(atual.trim()); atual = ""; }
      let resto = f;
      while (resto.length > alvo * 1.6) {
        let corte = resto.lastIndexOf(", ", alvo);
        if (corte < alvo * 0.4) corte = resto.lastIndexOf(" ", alvo);
        if (corte < alvo * 0.4) corte = alvo;
        pedacos.push(resto.slice(0, corte + 1).trim());
        resto = resto.slice(corte + 1);
      }
      if (resto.trim()) atual = resto.trim() + " ";
      continue;
    }

    if (atual && (atual + f).length > alvo) { pedacos.push(atual.trim()); atual = ""; }
    atual += f + " ";
  }
  if (atual.trim()) pedacos.push(atual.trim());
  return pedacos.filter(Boolean);
}

/**
 * Quanto esperar por UMA tentativa de síntese deste texto, em milissegundos.
 *
 * Um número fixo não serve: o mesmo teto que é generoso para "Bom dia" é impossível para um
 * parágrafo. Aqui ele acompanha o áudio pedido, com folga de 1,5× e um piso de 15 s para a
 * parte que não depende do tamanho (rede, fila do modelo, início da geração).
 *
 * O teto máximo não é gosto: o navegador desiste em 75 s (ver SPEAK_TIMEOUT_MS no Assistente)
 * e o servidor tenta 2 vezes. 2 × 35 s + a espera entre elas cabe; 2 × 45 s não caberia, e o
 * navegador cortaria o servidor no meio da segunda tentativa — que é precisamente o defeito
 * que estes dois números existem para evitar.
 */
export function tetoDeSinteseMs(texto, { piso = 22_000, teto = 35_000 } = {}) {
  const segundosDeAudio = String(texto || "").length / 14;
  return Math.min(teto, Math.max(piso, Math.round((15 + 1.5 * segundosDeAudio) * 1000)));
}
