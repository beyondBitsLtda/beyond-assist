// O que faz um quadro do Abacato ser um quadro de estudo.
//
// A regra combinada: o NOME começa com "STUDY". O Abacato não tem campo de tipo de quadro, e
// criar um só para isto obrigaria a mexer na tela dele; o prefixo funciona hoje, em qualquer
// quadro, sem migração.

/** "STUDY JavaScript", "STUDY - Java", "study: SQL", "STUDY_Python" — sim. "STUDYING" — não. */
export function ehQuadroDeEstudo(nome) {
  return /^\s*study(?![a-z0-9])/i.test(String(nome || ""));
}

/** O tema macro: o nome sem o prefixo e sem a pontuação que separa os dois. */
export function temaDo(nome) {
  const limpo = String(nome || "").replace(/^\s*study[\s:\-–—_|·.]*/i, "").trim();
  return limpo || String(nome || "").trim();
}
