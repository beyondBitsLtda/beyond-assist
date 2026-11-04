import { updateTrelloCard, getBoardLists } from "@/lib/ingest/trello.js";
import { atualizarCardDoAbacato, getQuadroColunas } from "@/lib/ingest/abacato.js";
import { fonteDosQuadros } from "@/lib/configLisa.js";
import { esquecerCache } from "@/lib/liveQuadros.js";

/**
 * Escrever num card — no Trello ou no Abacato, conforme o interruptor.
 *
 * Par do `liveQuadros.js`: aquele lê, este escreve. Separados porque a leitura acontece a cada
 * tela e a escrita só quando você confirma uma ação do assistente — e porque a escrita é a
 * parte que estraga dados quando erra.
 *
 * As assinaturas são as do Trello (`due`, `idList`, `dueComplete`) e isso é proposital: o
 * código do assistente que chama daqui não precisa saber qual sistema está do outro lado.
 */

/** Altera um card. `due: null` remove o prazo; campos omitidos não são tocados. */
export async function atualizarCard(cardId, mudancas) {
  const fonte = await fonteDosQuadros();
  const feito = fonte === "abacato"
    ? await atualizarCardDoAbacato(cardId, mudancas)
    : await updateTrelloCard(cardId, mudancas);

  // O cache de leitura tem quinze segundos de validade. Sem esta linha, confirmar "marca como
  // concluído" e olhar a tela em seguida mostraria o card ainda aberto — e a ação pareceria
  // não ter funcionado bem na hora em que a confiança no assistente se decide.
  esquecerCache();
  return feito;
}

/** As listas/colunas de um quadro — `{ id, name }` — para resolver "mover para a lista X" por
 *  nome. O nome `name` em inglês é o que o chamador já esperava do Trello. */
export async function listasDoQuadro(quadroId) {
  const fonte = await fonteDosQuadros();
  return fonte === "abacato" ? getQuadroColunas(quadroId) : getBoardLists(quadroId);
}
