// A ofensiva: quantos dias seguidos a pessoa estudou.
//
// Um dia conta se teve pelo menos um evento que valeu ponto. Hoje ainda sem estudo NÃO quebra a
// sequência — ela só quebra quando o dia termina vazio. Até lá a ofensiva está "em risco", que é
// exatamente o momento em que vale cobrar.

import { somarDias } from "./datas.js";

/**
 * @param {Iterable<string>} dias  dias ("AAAA-MM-DD") em que houve estudo, em qualquer ordem
 * @param {string} hoje
 */
export function calcularOfensiva(dias, hoje) {
  const conjunto = new Set(dias);
  const estudouHoje = conjunto.has(hoje);

  let atual = 0;
  let cursor = estudouHoje ? hoje : somarDias(hoje, -1);
  while (conjunto.has(cursor)) {
    atual++;
    cursor = somarDias(cursor, -1);
  }

  let recorde = 0;
  let sequencia = 0;
  let anterior = null;
  for (const dia of [...conjunto].sort()) {
    sequencia = anterior && somarDias(anterior, 1) === dia ? sequencia + 1 : 1;
    recorde = Math.max(recorde, sequencia);
    anterior = dia;
  }

  return { atual, recorde, estudouHoje, emRisco: !estudouHoje && atual > 0 };
}
