// Os VEÍCULOS do Reino do Neuro (pedido de 23/10/2026): cada um leva as tropas a um tipo de
// expedição. O Barco Voador é de todo mundo e vai às expedições de sempre (vilas, florestas,
// bosques e acampamentos); os outros se compram com moedas e abrem mapas novos — o fundo do mar,
// as montanhas geladas, os reinos de fogo e lava e os planetoides do espaço. Puro.
//
// COMBUSTÍVEL: cada veículo faz CARGAS_POR_DIA expedições por dia — o tanque enche sozinho na
// virada do dia. Quer mais? Abasteça: cada carga extra custa moedas, um pouco mais cara a cada
// uma do mesmo dia, até EXTRAS_POR_DIA cargas extras por veículo.

import { faltam } from "./moedas.js";

export const VEICULOS = {
  barco: {
    nome: "Barco Voador", emoji: "⛵", preco: 0, torreMinima: 1, destino: "Vilas, florestas, bosques e acampamentos",
    descricao: "O barco do reino, de todo mundo: leva as tropas a qualquer ilha de monstros.",
  },
  submarino: {
    nome: "Submarino", emoji: "🌊", preco: 600, torreMinima: 2, destino: "Reinos submersos",
    descricao: "Desce ao fundo do mar, onde tritões, tubarões e o Kraken guardam tesouros afundados.",
  },
  dirigivel: {
    nome: "Dirigível das Montanhas", emoji: "🎈", preco: 800, torreMinima: 2, destino: "Montanhas geladas",
    descricao: "Sobe acima das nuvens até os picos dos yetis, das harpias e do Gigante de Gelo.",
  },
  tanque: {
    nome: "Tanque de Magma", emoji: "🌋", preco: 1200, torreMinima: 3, destino: "Reinos de fogo e lava",
    descricao: "Blindado contra o calor: atravessa rios de lava até a forja dos diabretes e o trono do Dragão.",
  },
  nave: {
    nome: "Nave Estelar", emoji: "🚀", preco: 2000, torreMinima: 3, destino: "Planetoides aleatórios",
    descricao: "Cada viagem cai num planetoide diferente, com uma raça alienígena sorteada: a força e o tesouro mudam toda vez.",
  },
};
export const ORDEM_DOS_VEICULOS = ["barco", "submarino", "dirigivel", "tanque", "nave"];
export const CARGAS_POR_DIA = 3;
export const EXTRAS_POR_DIA = 5;

/** Os veículos que a pessoa tem (o Barco sempre, mesmo que a lista venha vazia). */
export function veiculosDe(lista) {
  const validos = (Array.isArray(lista) ? lista : []).filter((v) => VEICULOS[v]);
  return ORDEM_DOS_VEICULOS.filter((v) => v === "barco" || validos.includes(v));
}

/** Comprar um veículo: precisa da Torre do Neuro no nível dele e das moedas. */
export function podeComprarVeiculo({ id, possui, nivelDaTorre, saldo }) {
  const def = VEICULOS[id];
  if (!def) return { ok: false, motivo: "veículo desconhecido" };
  if (veiculosDe(possui).includes(id)) return { ok: false, motivo: "esse veículo já é seu" };
  if ((nivelDaTorre || 0) < def.torreMinima) return { ok: false, custo: def.preco, motivo: `libera com a Torre do Neuro no nível ${def.torreMinima}` };
  if ((saldo || 0) < def.preco) return { ok: false, custo: def.preco, motivo: faltam(def.preco, saldo) };
  return { ok: true, custo: def.preco };
}

/** O preço da próxima carga extra do dia: 20, 35, 50, 65, 80 moedas. */
export const precoDaCarga = (extrasJaCompradas) => 20 + 15 * Math.max(0, extrasJaCompradas || 0);

/** O tanque de um veículo hoje: as cargas do dia (as 3 de graça mais as compradas), as usadas e as que sobram. */
export function tanqueDoDia({ feitas = 0, extras = 0 }) {
  const cargas = CARGAS_POR_DIA + Math.max(0, extras);
  return { cargas, usadas: feitas, restantes: Math.max(0, cargas - feitas), extras, extrasPossiveis: Math.max(0, EXTRAS_POR_DIA - extras) };
}

/** Abastecer (comprar uma carga extra para hoje). Só quando o tanque está vazio — carga não acumula. */
export function podeAbastecer({ id, possui, feitas = 0, extras = 0, saldo }) {
  if (!VEICULOS[id]) return { ok: false, motivo: "veículo desconhecido" };
  if (!veiculosDe(possui).includes(id)) return { ok: false, motivo: "esse veículo ainda não é seu" };
  const tanque = tanqueDoDia({ feitas, extras });
  const custo = precoDaCarga(extras);
  if (tanque.restantes > 0) return { ok: false, custo, motivo: `ainda tem ${tanque.restantes} carga(s) no tanque` };
  if (extras >= EXTRAS_POR_DIA) return { ok: false, custo, motivo: `já abasteceu ${EXTRAS_POR_DIA} vezes hoje — amanhã o tanque enche de novo` };
  if ((saldo || 0) < custo) return { ok: false, custo, motivo: faltam(custo, saldo) };
  return { ok: true, custo };
}
