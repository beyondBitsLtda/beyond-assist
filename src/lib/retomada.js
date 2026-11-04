// RESPOSTA CORTADA NO MEIO: retomar em vez de mostrar o erro.
//
// Com o Gemini sobrecarregado, o stream às vezes fecha no meio da resposta e o SDK estoura
// "Incomplete JSON segment at the end" — visto em 16/10/2026 (1 de 9 chamadas medidas, com
// 1316 letras já entregues). Antes, isso aparecia cru na tela: "[erro: Incomplete JSON ...]",
// com a frase dela pela metade. O retry de withTransientRetry só cobre a ABERTURA do stream.
//
// Agora: se o stream quebra, abre outro (o withTransientRetry escolhe outra chave e, se for o
// caso, o modelo reserva). Se já tinha chegado texto, o novo pedido leva o que ela já disse e
// pede para continuar exatamente dali — quem está lendo ou ouvindo não vê o corte. Uma retomada
// só; se falhar de novo, aí sim vira erro, com uma frase que se entende.

export const RETOMADAS = 1;
export const PEDIDO_DE_CONTINUAR =
  "Sua resposta anterior foi cortada no meio por uma falha de conexão. Continue EXATAMENTE do ponto onde parou, " +
  "sem repetir nada do que já escreveu, sem recomeçar a frase e sem comentar o corte.";

/** O pedido de continuação: a conversa original, o que ela já disse e "continue daí". */
export function contentsParaContinuar(contents, entregue) {
  const inicio = typeof contents === "string" ? [{ role: "user", parts: [{ text: contents }] }] : contents;
  return [...inicio, { role: "model", parts: [{ text: entregue }] }, { role: "user", parts: [{ text: PEDIDO_DE_CONTINUAR }] }];
}

/**
 * Repassa os pedaços de texto de `abrir(contents)` (que devolve um async iterable de chunks com
 * `.text`), retomando se o stream quebrar no meio.
 */
export async function* streamComRetomada(abrir, contents, retomadas = RETOMADAS) {
  let entregue = "";
  let stream = await abrir(contents);
  for (let tentativa = 0; ; tentativa++) {
    try {
      for await (const chunk of stream) {
        const text = chunk?.text;
        if (text) { entregue += text; yield text; }
      }
      return;
    } catch (err) {
      if (tentativa >= retomadas) {
        const e = new Error("o Gemini cortou a resposta no meio (está com alta demanda agora). Pergunte de novo em instantes.");
        e.cause = err;
        throw e;
      }
      stream = await abrir(entregue ? contentsParaContinuar(contents, entregue) : contents);
    }
  }
}
