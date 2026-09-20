// Texto colado → itens de checklist.
//
// A fonte quase nunca é digitação: é um trecho de ata, uma lista do WhatsApp, uma cópia de
// outro sistema. Cada uma vem com o seu marcador na frente — hífen, asterisco, bolinha,
// "1.", "[ ]" — e guardar esse marcador dentro do texto do item faz a checklist inteira ficar
// com dois marcadores, o do sistema e o que veio junto.
//
// Fica no domínio porque é regra de conteúdo, e porque assim o `dominio-check` consegue provar
// os casos esquisitos sem subir servidor nenhum.

/** Marcadores de lista no começo da linha, nas formas em que eles costumam chegar. */
const MARCADOR = /^\s*(?:[-*+•–—]\s+|\[[ xX]?\]\s*|\d+[.)]\s+)/;

/**
 * Quebra o texto em itens, um por linha, sem os marcadores.
 *
 * Linhas vazias somem — colar um texto com parágrafos separados não deve criar itens em branco
 * no meio da lista.
 */
export function linhasDeItens(texto) {
  return String(texto || "")
    .split(/\r?\n/)
    .map((linha) => linha.replace(MARCADOR, "").trim())
    .filter(Boolean);
}
