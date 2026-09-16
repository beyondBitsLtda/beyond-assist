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
 * Quebra o texto em pedaços faláveis. Hoje serve A UM ÚNICO propósito: a voz de reserva do
 * navegador.
 *
 * O `speechSynthesis` do Chrome interrompe sozinho uma fala longa, por volta de 15 segundos,
 * e não avisa. Cortar resolve isso.
 *
 * O que ela NÃO deve fazer é cortar o texto que vai para o Gemini, e vale registrar por quê,
 * porque a intuição aponta para o lado errado. Eu presumi que o tempo de síntese acompanhasse
 * a quantidade de áudio pedida e cortei por isso. A medição (16/09/2026, dez chamadas reais)
 * desmentiu:
 *
 *    76 caracteres  →  68s FALHA · 29s · 55s
 *   152 caracteres  →  51s · 68s FALHA · 15s
 *   304 caracteres  →  17s · 61s · 68s FALHA
 *   449 caracteres  →  43s · 43s · 19s · 16s · 18s   (cinco de cinco)
 *
 * O texto de 76 caracteres levou 55s; o de 304 levou 17s; e o maior de todos foi o único sem
 * nenhuma falha. Não há correlação com o tamanho: o que existe é uma taxa alta de chamadas
 * que penduram, independente do texto, e cada tentativa ou volta em ~16-20s ou estoura o teto.
 *
 * A consequência prática é o contrário do que parece: cortar em três MULTIPLICA por três as
 * chances de a fala cair para a voz do navegador, porque cada pedaço é um sorteio novo. Menos
 * chamadas, maiores, falham menos.
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
