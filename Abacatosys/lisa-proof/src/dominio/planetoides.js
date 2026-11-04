// Os PLANETOIDES da Nave Estelar (pedido de 23/10/2026): "atacar um planetoide aleatório, com
// raças de alienígenas aleatórias — a força desses aliens é aleatória e a recompensa também".
// Puro, como o resto de src/dominio.
//
// Cada viagem sorteia um planetoide: a raça, quantos alienígenas, a FORÇA deles (que multiplica a
// vida e o dano no motor de combate) e o tesouro. O sorteio sai de uma semente fixa — a pessoa, o
// dia e o número da viagem —, então o radar da nave mostra o planetoide de verdade antes de
// partir, e recarregar a tela não troca o planetoide. A recompensa acompanha o perigo, com uma
// pitada de sorte: um planetoide forte quase sempre paga mais, mas não sempre.

import { MONSTROS } from "./monstros.js";
import { VEICULOS } from "./veiculos.js";

export const RACAS = {
  zorgs: { nome: "Zorgs", emoji: "👽", principal: "zorg", apoio: "insetoide", texto: "homenzinhos verdes com pistolas de raio" },
  gosmoides: { nome: "Gosmoides", emoji: "🟢", principal: "gosmoide", apoio: "zorg", texto: "uma gosma que se divide e engole tudo" },
  insetoides: { nome: "Insetoides", emoji: "🪲", principal: "insetoide", apoio: "gosmoide", texto: "uma colmeia rápida de garras afiadas" },
  ciborgues: { nome: "Ciborgues", emoji: "🤖", principal: "ciborgue", apoio: "zorg", texto: "metade máquina, com canhões no braço" },
  cristalinos: { nome: "Cristalinos", emoji: "💎", principal: "cristalino", apoio: "polvoEstelar", texto: "gigantes de cristal duros de quebrar" },
  polvos: { nome: "Polvos Estelares", emoji: "🐙", principal: "polvoEstelar", apoio: "gosmoide", texto: "tentáculos que atiram de longe" },
};
export const ORDEM_DAS_RACAS = Object.keys(RACAS);
export const FORCA_MINIMA = 0.6;
export const FORCA_MAXIMA = 1.8;
export const RECOMPENSA_MINIMA = 80;
export const RECOMPENSA_MAXIMA = 520;
export const VARIANTES_DO_CENARIO = 4; // as paletas do chão e do céu (cenariosDasExpedicoes.js)

const NOMES = ["Zeta", "Kepler", "Xandar", "Vórtex", "Nébula", "Órbita", "Quasar", "Pulsar", "Andrômeda", "Cosmo"];

/** Um sorteio próprio por semente (o mesmo do motor de combate): mesma semente, mesmo planetoide. */
function sorteio(semente) {
  let a = (semente >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A semente de uma viagem: a pessoa, o dia ("AAAA-MM-DD") e a viagem do dia (1, 2, 3...). */
export function sementeDoPlanetoide(usuarioId, dia, viagem) {
  let h = 0x811c9dc5;
  for (const ch of `${usuarioId}|${dia}|${viagem}`) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) || 1;
}

/** O perigo dos monstros, num número só: soma de vida × dano por segundo (a força conta duas vezes). */
export function perigoDos(monstros, forca = 1) {
  let soma = 0;
  for (const [tipo, n] of Object.entries(monstros || {})) {
    const m = MONSTROS[tipo];
    if (m) soma += n * Math.sqrt(m.vida * forca * ((m.dano * forca) / m.intervalo));
  }
  return Math.round(soma);
}

/** A dificuldade (1 a 5) pelo perigo — os mesmos degraus das expedições fixas. */
export function dificuldadeDoPerigo(perigo) {
  if (perigo < 260) return 1;
  if (perigo < 420) return 2;
  if (perigo < 600) return 3;
  if (perigo < 820) return 4;
  return 5;
}

const arredondar = (x, passo) => Math.round(x / passo) * passo;

/**
 * O planetoide de uma viagem. Mesma forma das expedições fixas (monstros.js), mais `forca`,
 * `raca`, `perigo` e o `cenario` (a paleta sorteada).
 */
export function planetoideDa(semente) {
  const r = sorteio(semente);
  const raca = ORDEM_DAS_RACAS[Math.floor(r() * ORDEM_DAS_RACAS.length)];
  const def = RACAS[raca];
  const forca = Math.round((FORCA_MINIMA + r() * (FORCA_MAXIMA - FORCA_MINIMA)) * 100) / 100;

  const monstros = {};
  const quantos = 5 + Math.floor(r() * 5); // 5 a 9
  const apoio = Math.floor(r() * 3);       // 0 a 2 do apoio
  monstros[def.principal] = Math.max(2, quantos - apoio);
  if (apoio) monstros[def.apoio] = (monstros[def.apoio] || 0) + apoio;
  if (r() < 0.45) monstros.disco = 1 + Math.floor(r() * 2);
  const rainha = forca >= 1.2 && r() < 0.5;
  if (rainha) monstros.rainhaAlien = 1;
  // os gigantes de cristal são poucos e grandes
  if (monstros.cristalino) monstros.cristalino = Math.min(monstros.cristalino, 3);

  // a base alienígena: as mesmas construções do reino, com o tamanho sorteado
  const nivel = 2 + Math.floor(r() * 3); // 2 a 4
  const construcoes = {
    castelo: nivel, terreno: Math.max(0, nivel - 2), mina: Math.min(3, nivel), cofre: Math.min(3, nivel),
    torre: Math.max(1, nivel - 1), canhao: Math.max(1, nivel - 1), quartel: Math.max(1, nivel - 1),
    muralha: Math.max(0, nivel - 2), defesaAerea: nivel >= 3 ? nivel - 2 : 0,
    ...(nivel >= 4 ? { morteiro: 1, torreMagica: 1 } : {}),
  };

  const perigo = perigoDos(monstros, forca) + 20 * nivel;
  const dificuldade = dificuldadeDoPerigo(perigo);
  const sorte = 0.8 + r() * 0.5; // 0,8 a 1,3: o tesouro nem sempre acompanha a força
  const recompensa = Math.max(RECOMPENSA_MINIMA, Math.min(RECOMPENSA_MAXIMA, arredondar(perigo * 0.42 * sorte, 5)));
  const nome = `Planetoide ${NOMES[Math.floor(r() * NOMES.length)]}-${10 + Math.floor(r() * 90)}`;
  const variante = Math.floor(r() * VARIANTES_DO_CENARIO);

  return {
    id: "planetoide", nome, tipo: "planetoide", veiculo: "nave", torreMinima: VEICULOS.nave.torreMinima,
    dificuldade, recompensa, chefe: rainha ? "rainhaAlien" : def.principal,
    descricao: `${def.emoji} ${def.nome}: ${def.texto}. Força ×${String(forca).replace(".", ",")}${rainha ? " — e a Rainha Alienígena está lá" : ""}.`,
    construcoes, monstros, forca, raca, perigo, cenario: `planetoide-${variante}`,
  };
}
