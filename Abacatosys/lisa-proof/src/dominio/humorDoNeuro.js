// O humor do Neuro (03/11/2026, ideia da Lisa: "se você mantiver a sequência diária de estudos, o mascote
// evolui e dá bônus de produção na sua mina; se você sumir por dias, ele fica revoltado e fecha as
// expedições"). Puro: recebe a ofensiva e o último dia de estudo, devolve o estado, o rosto e os efeitos.
// Os efeitos valem no reino de verdade (src/lib/reino.js); no Reino de Teste o humor só aparece.
// Testado em scripts/dominio-check.mjs.

import { somarDias } from "./datas.js";

/** A evolução pela ofensiva (dias seguidos de estudo): cada estágio dá um pouco mais de mina. */
export const EVOLUCOES_DO_NEURO = [
  { minimo: 0, id: "comum", nome: "Neuro", emoji: "🧠", bonus: 0 },
  { minimo: 3, id: "animado", nome: "Neuro Animado", emoji: "🌱", bonus: 0.05 },
  { minimo: 7, id: "radiante", nome: "Neuro Radiante", emoji: "✨", bonus: 0.1 },
  { minimo: 14, id: "brilhante", nome: "Neuro Brilhante", emoji: "🌟", bonus: 0.15 },
  { minimo: 30, id: "lendario", nome: "Neuro Lendário", emoji: "👑", bonus: 0.2 },
];

/** Dias desde o último estudo (hoje conta como um): 0 = estudou hoje; 3 = dois dias inteiros vazios. */
export const DIAS_PARA_REVOLTAR = 3;

/** Quantos dias entre o último dia de estudo e hoje (0 = estudou hoje; null = nunca estudou). */
export function diasSemEstudo(ultimoDia, hoje) {
  if (!ultimoDia) return null;
  if (ultimoDia >= hoje) return 0;
  let n = 0;
  for (let d = ultimoDia; d < hoje && n < 400; d = somarDias(d, 1)) n++;
  return n;
}

export function evolucaoDa(ofensiva) {
  let atual = EVOLUCOES_DO_NEURO[0];
  for (const e of EVOLUCOES_DO_NEURO) if ((ofensiva || 0) >= e.minimo) atual = e;
  return atual;
}

/**
 * O humor de agora. `ofensiva`: { atual, estudouHoje } (src/dominio/ofensiva.js); `semEstudo`: dias desde o
 * último estudo (diasSemEstudo). Devolve o estado ("revoltado", "chateado", "em-risco", "contente", "novo"),
 * o rosto do Neuro (`humor`, um dos HUMORES de src/componentes/Neuro.js), a evolução, o bônus da mina e se
 * as expedições estão fechadas, com um texto para a tela.
 */
export function humorDoNeuro({ ofensiva = { atual: 0, estudouHoje: false }, semEstudo = null } = {}) {
  const dias = ofensiva.atual || 0;
  const evolucao = evolucaoDa(dias);
  const seguinte = EVOLUCOES_DO_NEURO.find((e) => e.minimo > dias) || null;
  const proximo = seguinte ? { ...seguinte, faltam: seguinte.minimo - dias } : null;
  const base = { evolucao, proximo, ofensiva: dias, semEstudo, bonusDaMina: 0, expedicoesFechadas: false };
  if (semEstudo === null) {
    return { ...base, estado: "novo", humor: "normal", texto: "Estude hoje e o Neuro começa a evoluir: a cada sequência, mais moedas na mina." };
  }
  if (semEstudo >= DIAS_PARA_REVOLTAR) {
    return {
      ...base, estado: "revoltado", humor: "bravo", expedicoesFechadas: true,
      texto: `O Neuro está revoltado: ${semEstudo} dias sem estudo. Ele fechou as expedições até você estudar de novo — uma sessão hoje e ele volta.`,
    };
  }
  if (semEstudo === DIAS_PARA_REVOLTAR - 1) {
    return { ...base, estado: "chateado", humor: "triste", texto: "O Neuro está chateado: mais um dia sem estudo e ele se revolta e fecha as expedições." };
  }
  const bonusDaMina = evolucao.bonus;
  const seguidos = `${dias} ${dias === 1 ? "dia seguido" : "dias seguidos"} de estudo`;
  const comBonus = bonusDaMina ? ` A mina rende +${Math.round(bonusDaMina * 100)}%.` : "";
  const falta = proximo ? ` ${proximo.faltam === 1 ? "Falta 1 dia" : `Faltam ${proximo.faltam} dias`} para ${proximo.emoji} ${proximo.nome}.` : "";
  if (!ofensiva.estudouHoje && dias > 0) {
    return { ...base, estado: "em-risco", humor: "pensando", bonusDaMina, texto: `${seguidos} — estude hoje para não perder a sequência.${comBonus}` };
  }
  return {
    ...base, estado: "contente", humor: dias >= 7 ? "comemorando" : "feliz", bonusDaMina,
    texto: `${seguidos}.${comBonus}${falta}`,
  };
}

/** O multiplicador da mina que vem do humor (1 = nada). */
export const fatorDaMinaDoHumor = (h) => 1 + (h?.bonusDaMina || 0);
