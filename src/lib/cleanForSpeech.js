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
