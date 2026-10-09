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
 * Quebra o texto em pedaços faláveis, respeitando fim de frase. Serve a dois propósitos:
 *
 *   - a voz de reserva do navegador: o `speechSynthesis` do Chrome interrompe sozinho uma fala
 *     longa, por volta de 15 segundos, e não avisa;
 *   - a voz do Gemini, via pedacosParaVoz (no fim deste arquivo).
 *
 * HISTÓRICO, porque a decisão já virou duas vezes. Em 16/09/2026 dez chamadas pareceram mostrar
 * que o tamanho não importava (76 caracteres em 55s, 449 em 16s) e o corte para o Gemini foi
 * proibido: "cada pedaço é um sorteio novo contra uma API que pendura". Em 07/10/2026 (issue
 * BEYOND-0001) uma medição maior, em três modelos, mostrou que aquilo era o modelo antigo
 * pendurando ao acaso — por baixo, o tempo CRESCE com o texto (tabela em gemini.js). Com o
 * modelo novo, que quase não pendura, o sorteio deixou de ser o problema e o tamanho passou a
 * ser: a resposta inteira numa chamada só estourava o teto e caía para o navegador.
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

/** O primeiro pedaço é curto para a Lisa começar a falar em poucos segundos (~5s no 3.8). */
export const ALVO_DO_PRIMEIRO_PEDACO = 150;
/**
 * Os seguintes são maiores: cada um é gerado enquanto o anterior toca, e o 3.8 gera mais
 * rápido do que fala (~15s de síntese para ~38s de áudio), então a fila não esvazia. O pior
 * pedaço possível (uma frase sozinha de até 1,6 × o alvo, ~450 caracteres) ainda cabe no
 * orçamento de tempo — `npm run fala-check` confere a conta.
 */
export const ALVO_DOS_PEDACOS = 280;

/**
 * Os pedaços em que uma fala vai para o Gemini (BEYOND-0001). Texto curto vai inteiro; texto
 * longo vira um pedaço curto na frente e pedaços maiores atrás.
 */
export function pedacosParaVoz(texto) {
  const pedacos = dividirParaFala(texto, ALVO_DOS_PEDACOS);
  if (pedacos.length === 0) return [];
  const [primeiro, ...resto] = pedacos;
  if (primeiro.length <= ALVO_DO_PRIMEIRO_PEDACO * 1.3) return pedacos;
  const [cabeca, ...sobra] = dividirParaFala(primeiro, ALVO_DO_PRIMEIRO_PEDACO);
  return [cabeca, ...(sobra.length ? [sobra.join(" ")] : []), ...resto];
}
