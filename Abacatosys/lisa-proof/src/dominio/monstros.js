// As EXPEDIÇÕES do Reino do Neuro: vilas, florestas, bosques e acampamentos de monstros para
// saquear, contra a CPU (pedido de 22/10/2026). Não é jogador contra jogador: ninguém perde moeda
// nem troféu quando você ataca um acampamento. Puro, como o resto de src/dominio.
//
// Cada expedição é uma ilha montada aqui (as mesmas construções do reino, nos mesmos lugares, com
// os monstros no lugar das tropas de defesa) e roda no MESMO motor de combate das invasões. Os
// monstros já estão soltos pela ilha quando o navio chega e guardam o pedaço deles: só correm
// atrás de quem chega perto.
//
// EXPEDIÇÃO NÃO CUSTA NADA (ajuste de 22/10/2026): o exército inteiro volta para casa, mesmo quem
// cai na batalha — não há tropa para treinar de novo, então nenhuma moeda sai. São
// EXPEDICOES_POR_DIA por dia, em qualquer lugar (dá para repetir o mesmo). Cada lugar tem um nível
// de dificuldade e uma recompensa: o saque é proporcional à destruição, e ⭐⭐⭐ dá um bônus. Cada um
// tem também o seu terreno e as suas estruturas no 3D (componentes/reino/cenariosDasExpedicoes.js).
//
// As recompensas ficaram menores que na primeira versão: antes elas pagavam as tropas perdidas;
// de graça e 3 vezes por dia, valores altos inflariam as moedas do reino.
//
// VEÍCULOS (23/10/2026): cada expedição tem o veículo que leva até ela (`veiculo`). O Barco vai às
// de sempre; Submarino, Dirigível e Tanque de Magma abrem três lugares cada, um por nível; a Nave
// vai a planetoides sorteados (planetoides.js). Cada veículo tem o seu tanque: 3 expedições por
// dia, e mais se abastecer (veiculos.js).

import { CARGAS_POR_DIA, VEICULOS, veiculosDe, tanqueDoDia } from "./veiculos.js";

/** Os monstros: só defendem. Mesmos campos das tropas (dano a cada `intervalo` segundos...). */
export const MONSTROS = {
  cogumelo: { nome: "Cogumelo Saltitante", vida: 70, dano: 9, intervalo: 1.0, alcance: 0.6, velocidade: 1.4, voa: false, acertaAr: false },
  slime: { nome: "Gosma", vida: 140, dano: 7, intervalo: 1.0, alcance: 0.6, velocidade: 1.0, voa: false, acertaAr: false, area: 0.6 },
  goblin: { nome: "Goblin", vida: 65, dano: 13, intervalo: 0.8, alcance: 0.6, velocidade: 2.0, voa: false, acertaAr: false },
  bandido: { nome: "Bandido", vida: 75, dano: 9, intervalo: 1.0, alcance: 2.8, velocidade: 1.6, voa: false, acertaAr: true },
  lobo: { nome: "Lobo", vida: 110, dano: 14, intervalo: 0.9, alcance: 0.6, velocidade: 2.3, voa: false, acertaAr: false },
  aranha: { nome: "Aranha Gigante", vida: 160, dano: 12, intervalo: 1.0, alcance: 1.8, velocidade: 1.6, voa: false, acertaAr: true },
  morcego: { nome: "Morcego", vida: 55, dano: 10, intervalo: 0.7, alcance: 0.6, velocidade: 2.4, voa: true, acertaAr: true },
  esqueleto: { nome: "Esqueleto", vida: 90, dano: 14, intervalo: 1.0, alcance: 0.6, velocidade: 1.7, voa: false, acertaAr: false },
  orc: { nome: "Orc", vida: 220, dano: 20, intervalo: 1.2, alcance: 0.7, velocidade: 1.4, voa: false, acertaAr: false },
  ent: { nome: "Ent", vida: 600, dano: 28, intervalo: 1.6, alcance: 1.0, velocidade: 0.8, voa: false, acertaAr: false, area: 0.8 },
  ogro: { nome: "Ogro", vida: 550, dano: 30, intervalo: 1.8, alcance: 0.9, velocidade: 0.9, voa: false, acertaAr: false, area: 0.9 },
  cerbero: { nome: "Cérbero", vida: 1100, dano: 26, intervalo: 1.2, alcance: 1.8, velocidade: 1.5, voa: false, acertaAr: true, area: 0.6 },
  // o fundo do mar (Submarino)
  caranguejo: { nome: "Caranguejo de Coral", vida: 160, dano: 11, intervalo: 1.0, alcance: 0.6, velocidade: 1.3, voa: false, acertaAr: false },
  aguaViva: { nome: "Água-viva", vida: 60, dano: 9, intervalo: 0.8, alcance: 0.7, velocidade: 1.6, voa: true, acertaAr: true },
  tritao: { nome: "Tritão Lanceiro", vida: 120, dano: 13, intervalo: 1.0, alcance: 2.4, velocidade: 1.6, voa: false, acertaAr: true },
  tubarao: { nome: "Tubarão-martelo", vida: 210, dano: 22, intervalo: 1.0, alcance: 0.7, velocidade: 2.4, voa: false, acertaAr: false },
  kraken: { nome: "Kraken", vida: 1100, dano: 28, intervalo: 1.4, alcance: 2.2, velocidade: 1.0, voa: false, acertaAr: true, area: 0.8 },
  // as montanhas geladas (Dirigível)
  bode: { nome: "Bode da Montanha", vida: 130, dano: 14, intervalo: 1.0, alcance: 0.6, velocidade: 2.2, voa: false, acertaAr: false },
  harpia: { nome: "Harpia", vida: 80, dano: 12, intervalo: 0.8, alcance: 1.4, velocidade: 2.4, voa: true, acertaAr: true },
  yeti: { nome: "Yeti", vida: 380, dano: 24, intervalo: 1.5, alcance: 0.8, velocidade: 1.2, voa: false, acertaAr: false },
  golem: { nome: "Golem de Pedra", vida: 700, dano: 24, intervalo: 1.8, alcance: 0.9, velocidade: 0.7, voa: false, acertaAr: false },
  giganteDeGelo: { nome: "Gigante de Gelo", vida: 1100, dano: 28, intervalo: 1.7, alcance: 1.2, velocidade: 0.9, voa: false, acertaAr: false, area: 0.6 },
  // os reinos de fogo e lava (Tanque de Magma)
  diabrete: { nome: "Diabrete", vida: 70, dano: 11, intervalo: 0.7, alcance: 1.6, velocidade: 2.3, voa: true, acertaAr: true },
  salamandra: { nome: "Salamandra de Fogo", vida: 150, dano: 14, intervalo: 1.0, alcance: 2.2, velocidade: 1.7, voa: false, acertaAr: true, area: 0.3 },
  golemDeMagma: { nome: "Golem de Magma", vida: 650, dano: 30, intervalo: 1.7, alcance: 0.9, velocidade: 0.8, voa: false, acertaAr: false, area: 0.8 },
  dragaoDeLava: { nome: "Dragão de Lava", vida: 1250, dano: 26, intervalo: 1.3, alcance: 2.0, velocidade: 1.2, voa: false, acertaAr: true, area: 0.6 },
  // os alienígenas dos planetoides (Nave Estelar) — a força de cada planetoide é sorteada (planetoides.js)
  zorg: { nome: "Zorg", vida: 80, dano: 12, intervalo: 0.8, alcance: 2.2, velocidade: 1.8, voa: false, acertaAr: true },
  gosmoide: { nome: "Gosmoide", vida: 200, dano: 9, intervalo: 1.0, alcance: 0.6, velocidade: 1.0, voa: false, acertaAr: false, area: 0.7 },
  insetoide: { nome: "Insetoide", vida: 110, dano: 16, intervalo: 0.7, alcance: 0.6, velocidade: 2.6, voa: false, acertaAr: false },
  ciborgue: { nome: "Ciborgue", vida: 320, dano: 20, intervalo: 1.2, alcance: 2.0, velocidade: 1.0, voa: false, acertaAr: true },
  cristalino: { nome: "Cristalino", vida: 450, dano: 22, intervalo: 1.4, alcance: 1.0, velocidade: 0.8, voa: false, acertaAr: false, area: 0.6 },
  polvoEstelar: { nome: "Polvo Estelar", vida: 160, dano: 14, intervalo: 1.0, alcance: 2.6, velocidade: 1.4, voa: false, acertaAr: true },
  disco: { nome: "Disco Voador", vida: 140, dano: 15, intervalo: 1.0, alcance: 1.8, velocidade: 2.0, voa: true, acertaAr: true },
  rainhaAlien: { nome: "Rainha Alienígena", vida: 1200, dano: 28, intervalo: 1.2, alcance: 2.0, velocidade: 1.2, voa: false, acertaAr: true, area: 0.7 },
};
// os grandes primeiro: o primeiro monstro da lista fica perto do covil (combate.js)
export const ORDEM_DOS_MONSTROS = [
  "ogro", "ent", "cerbero", "kraken", "giganteDeGelo", "dragaoDeLava", "rainhaAlien",
  "golem", "golemDeMagma", "cristalino", "yeti", "ciborgue",
  "orc", "aranha", "lobo", "esqueleto", "slime", "goblin", "cogumelo", "bandido", "morcego",
  "tubarao", "caranguejo", "tritao", "aguaViva", "bode", "harpia", "salamandra", "diabrete",
  "gosmoide", "insetoide", "polvoEstelar", "zorg", "disco",
];
export const ehMonstro = (tipo) => Boolean(MONSTROS[tipo]);

/** Só os monstros conhecidos, em números inteiros positivos (como `contagens` faz com as tropas). */
export function contagensDeMonstros(valor) {
  const c = {};
  for (const t of ORDEM_DOS_MONSTROS) {
    const n = Math.floor(Number(valor?.[t]) || 0);
    if (n > 0) c[t] = n;
  }
  return c;
}

export const TIPOS_DE_LUGAR = {
  vila: { nome: "Vila", emoji: "🏘️" },
  floresta: { nome: "Floresta", emoji: "🌲" },
  bosque: { nome: "Bosque", emoji: "🍄" },
  acampamento: { nome: "Acampamento de monstros", emoji: "⛺" },
  submerso: { nome: "Reino submerso", emoji: "🐚" },
  montanha: { nome: "Montanha gelada", emoji: "🏔️" },
  vulcao: { nome: "Reino de fogo", emoji: "🌋" },
  planetoide: { nome: "Planetoide", emoji: "🪐" },
};

// Desde 23/10/2026 o limite é POR VEÍCULO: o tanque de cada um (src/dominio/veiculos.js).
export const EXPEDICOES_POR_DIA = CARGAS_POR_DIA;

/** Os níveis de dificuldade (1 a 5), do jeito que aparecem na tela. */
export const DIFICULDADES = {
  1: { nome: "Fácil", cor: "facil" },
  2: { nome: "Médio", cor: "medio" },
  3: { nome: "Difícil", cor: "dificil" },
  4: { nome: "Muito difícil", cor: "muito-dificil" },
  5: { nome: "Lendário", cor: "lendario" },
};
export const BONUS_DE_TRES_ESTRELAS = 0.25;

/**
 * O mapa das expedições, da mais fácil à mais difícil. `torreMinima`: o nível da Torre do Neuro
 * que libera o lugar. `recompensa`: as moedas de 100% de destruição. As construções seguem as
 * mesmas regras do reino (as da terra nova pedem o Terreno).
 */
export const EXPEDICOES = [
  {
    id: "bosque-cogumelos", nome: "Bosque dos Cogumelos", tipo: "bosque", torreMinima: 1, dificuldade: 1, recompensa: 60, chefe: "cogumelo",
    descricao: "Cogumelos saltitantes e gosmas guardam um baú esquecido no meio do bosque.",
    construcoes: { castelo: 1, mina: 1, cofre: 1, torre: 1 },
    monstros: { cogumelo: 5, slime: 2 },
  },
  {
    id: "vila-goblins", nome: "Vila dos Goblins", tipo: "vila", torreMinima: 1, dificuldade: 1, recompensa: 75, chefe: "goblin",
    descricao: "Os goblins tomaram a vila e escondem o ouro roubado na casa do chefe.",
    construcoes: { castelo: 1, mina: 1, cofre: 1, torre: 1, quartel: 1 },
    monstros: { goblin: 7, bandido: 1 },
  },
  {
    id: "floresta-lobos", nome: "Floresta dos Lobos", tipo: "floresta", torreMinima: 2, dificuldade: 2, recompensa: 100, chefe: "lobo",
    descricao: "Uma alcateia uiva entre os pinheiros — e as aranhas cuidam da toca do líder.",
    construcoes: { castelo: 2, mina: 2, cofre: 1, torre: 2, canhao: 1, quartel: 1, muralha: 1 },
    monstros: { lobo: 5, aranha: 2 },
  },
  {
    id: "acampamento-orc", nome: "Acampamento Orc", tipo: "acampamento", torreMinima: 2, dificuldade: 2, recompensa: 120, chefe: "orc",
    descricao: "Orcs e goblins juntaram o saque de três reinos numa só tenda.",
    construcoes: { castelo: 2, mina: 2, cofre: 2, torre: 2, canhao: 1, quartel: 1, muralha: 1 },
    monstros: { orc: 3, goblin: 6 },
  },
  {
    id: "vila-bandidos", nome: "Vila dos Bandidos", tipo: "vila", torreMinima: 3, dificuldade: 3, recompensa: 160, chefe: "bandido",
    descricao: "Bandidos com bestas no telhado e um ogro de guarda-costas. Leve quem acerta de longe.",
    construcoes: { castelo: 3, terreno: 1, mina: 3, cofre: 3, torre: 2, canhao: 2, quartel: 2, muralha: 1, defesaAerea: 1 },
    monstros: { bandido: 3, goblin: 4, ogro: 1 },
  },
  {
    id: "bosque-assombrado", nome: "Bosque Assombrado", tipo: "bosque", torreMinima: 3, dificuldade: 3, recompensa: 180, chefe: "esqueleto",
    descricao: "Esqueletos se levantam da terra e morcegos cobrem o céu. Cuidado com quem voa.",
    construcoes: { castelo: 3, terreno: 1, mina: 2, cofre: 3, torre: 2, canhao: 2, muralha: 2, biblioteca: 1, defesaAerea: 2 },
    monstros: { esqueleto: 6, morcego: 4 },
  },
  {
    id: "floresta-sombria", nome: "Floresta Sombria", tipo: "floresta", torreMinima: 4, dificuldade: 4, recompensa: 240, chefe: "ent",
    descricao: "As árvores andam. Ents antigos e aranhas gigantes guardam o coração da floresta.",
    construcoes: { castelo: 4, terreno: 2, mina: 3, cofre: 3, torre: 3, canhao: 3, quartel: 3, muralha: 2, defesaAerea: 2, morteiro: 1, torreMagica: 1 },
    monstros: { aranha: 3, lobo: 3, ent: 1 },
  },
  {
    id: "covil-cerbero", nome: "Covil do Cérbero", tipo: "acampamento", torreMinima: 5, dificuldade: 5, recompensa: 320, chefe: "cerbero",
    descricao: "O cão de três cabeças guarda o maior tesouro do mapa. Só os reinos mais fortes voltam inteiros.",
    construcoes: { castelo: 5, terreno: 3, mina: 3, cofre: 3, torre: 4, canhao: 4, quartel: 3, muralha: 3, defesaAerea: 2, morteiro: 1, torreMagica: 1, torreRaio: 1 },
    monstros: { cerbero: 1, esqueleto: 3, orc: 2 },
  },

  // ---- os reinos submersos (Submarino): um lugar por nível
  {
    id: "recife-tritoes", nome: "Recife dos Tritões", tipo: "submerso", veiculo: "submarino", torreMinima: 2, dificuldade: 2, recompensa: 120, chefe: "tritao",
    descricao: "Corais coloridos, caranguejos de guarda e tritões com lanças em volta de um baú de pérolas.",
    construcoes: { castelo: 2, mina: 2, cofre: 1, torre: 2, canhao: 1, quartel: 1 },
    monstros: { caranguejo: 4, aguaViva: 3, tritao: 2 },
  },
  {
    id: "cidade-afundada", nome: "Cidade Afundada", tipo: "submerso", veiculo: "submarino", torreMinima: 3, dificuldade: 3, recompensa: 190, chefe: "tubarao",
    descricao: "As ruínas de um reino que afundou. Tubarões-martelo patrulham as colunas tombadas.",
    construcoes: { castelo: 3, terreno: 1, mina: 3, cofre: 2, torre: 2, canhao: 2, quartel: 2, muralha: 1, defesaAerea: 1 },
    monstros: { tubarao: 3, tritao: 3, caranguejo: 2, aguaViva: 2 },
  },
  {
    id: "fossa-kraken", nome: "Fossa do Kraken", tipo: "submerso", veiculo: "submarino", torreMinima: 4, dificuldade: 4, recompensa: 280, chefe: "kraken",
    descricao: "No ponto mais fundo do oceano, os tentáculos do Kraken abraçam o maior tesouro do mar.",
    construcoes: { castelo: 4, terreno: 2, mina: 3, cofre: 3, torre: 3, canhao: 3, quartel: 3, muralha: 2, defesaAerea: 2, morteiro: 1, torreMagica: 1 },
    monstros: { kraken: 1, tubarao: 2, tritao: 2, aguaViva: 2 },
  },

  // ---- as montanhas geladas (Dirigível)
  {
    id: "trilha-yetis", nome: "Trilha dos Yetis", tipo: "montanha", veiculo: "dirigivel", torreMinima: 2, dificuldade: 2, recompensa: 130, chefe: "yeti",
    descricao: "Pegadas enormes na neve levam a uma caverna cheia de cristais. Os bodes avisam quando alguém chega.",
    construcoes: { castelo: 2, mina: 2, cofre: 1, torre: 2, canhao: 1, quartel: 1, muralha: 1 },
    monstros: { bode: 4, harpia: 2, yeti: 1 },
  },
  {
    id: "ninho-harpias", nome: "Ninho das Harpias", tipo: "montanha", veiculo: "dirigivel", torreMinima: 3, dificuldade: 3, recompensa: 200, chefe: "harpia",
    descricao: "Um pico sem caminho de volta: as harpias atacam do céu e um golem de pedra vigia os ovos de ouro.",
    construcoes: { castelo: 3, terreno: 1, mina: 2, cofre: 3, torre: 3, canhao: 2, quartel: 2, muralha: 1, defesaAerea: 2 },
    monstros: { harpia: 5, bode: 3, golem: 1 },
  },
  {
    id: "pico-gigante", nome: "Pico do Gigante de Gelo", tipo: "montanha", veiculo: "dirigivel", torreMinima: 4, dificuldade: 4, recompensa: 290, chefe: "giganteDeGelo",
    descricao: "No topo do mundo, o Gigante de Gelo guarda a coroa congelada. Cada passo dele racha a montanha.",
    construcoes: { castelo: 4, terreno: 2, mina: 3, cofre: 3, torre: 3, canhao: 2, quartel: 3, muralha: 2, defesaAerea: 2, morteiro: 1, torreMagica: 1 },
    monstros: { giganteDeGelo: 1, yeti: 2, harpia: 2 },
  },

  // ---- os reinos de fogo e lava (Tanque de Magma)
  {
    id: "forja-diabretes", nome: "Forja dos Diabretes", tipo: "vulcao", veiculo: "tanque", torreMinima: 3, dificuldade: 3, recompensa: 170, chefe: "diabrete",
    descricao: "Diabretes voam em volta da bigorna onde forjam moedas de ouro derretido. Salamandras cospem fogo de longe.",
    construcoes: { castelo: 3, terreno: 1, mina: 3, cofre: 2, torre: 3, canhao: 2, quartel: 2, muralha: 1, defesaAerea: 1 },
    monstros: { diabrete: 5, salamandra: 3 },
  },
  {
    id: "rio-de-magma", nome: "Rio de Magma", tipo: "vulcao", veiculo: "tanque", torreMinima: 4, dificuldade: 4, recompensa: 250, chefe: "golemDeMagma",
    descricao: "Um rio de lava corta a ilha ao meio. Na ponte de obsidiana, o Golem de Magma não deixa ninguém passar.",
    construcoes: { castelo: 4, terreno: 2, mina: 3, cofre: 3, torre: 3, canhao: 3, quartel: 3, muralha: 2, defesaAerea: 2, morteiro: 1, torreMagica: 1 },
    monstros: { golemDeMagma: 1, salamandra: 4, diabrete: 3 },
  },
  {
    id: "trono-dragao", nome: "Trono do Dragão de Lava", tipo: "vulcao", veiculo: "tanque", torreMinima: 5, dificuldade: 5, recompensa: 380, chefe: "dragaoDeLava",
    descricao: "Dentro do vulcão, o Dragão de Lava dorme sobre o maior tesouro de todos os reinos. Não acorde ele à toa.",
    construcoes: { castelo: 5, terreno: 3, mina: 3, cofre: 3, torre: 4, canhao: 3, quartel: 3, muralha: 3, defesaAerea: 2, morteiro: 1, torreMagica: 1, torreRaio: 1 },
    monstros: { dragaoDeLava: 1, salamandra: 2, diabrete: 3 },
  },
];
export const expedicaoPorId = (id) => EXPEDICOES.find((x) => x.id === id) || null;
/** O veículo que leva até a expedição (as de antes dos veículos vão de Barco). */
export const veiculoDa = (expedicao) => (VEICULOS[expedicao?.veiculo] ? expedicao.veiculo : "barco");

/**
 * O lado defensor da batalha: a ilha da expedição, sem Neuro, com os monstros soltos. `forca`
 * (planetoides) multiplica a vida e o dano dos monstros; `veiculo` é o que chega na ilha no 3D.
 */
export function defensorDaExpedicao(expedicao) {
  return {
    construcoes: { ...expedicao.construcoes },
    neuro_nivel: 0,
    guarnicao: {},
    monstros: contagensDeMonstros(expedicao.monstros),
    tema: expedicao.tipo,
    cenario: expedicao.cenario || expedicao.id, // o terreno e as estruturas próprias do lugar, no 3D
    veiculo: veiculoDa(expedicao),
    ...(expedicao.forca && expedicao.forca !== 1 ? { forca: expedicao.forca } : {}),
  };
}

/**
 * Dá para partir nessa expedição agora? Precisa da Torre do Neuro no nível do lugar, do veículo
 * que leva até ele e de combustível no tanque desse veículo (`tanque`: tanqueDoDia). Não pede
 * tropa: quem não tem exército vai com a Tropa da Expedição (emprestada, de graça — ver
 * exercitoDaExpedicao em reino.js).
 */
export function podeExpedicionar({ expedicao, nivelDaTorre, veiculos, tanque }) {
  if (!expedicao) return { ok: false, motivo: "essa expedição não existe" };
  if ((nivelDaTorre || 0) < expedicao.torreMinima) return { ok: false, motivo: `libera com a Torre do Neuro no nível ${expedicao.torreMinima}` };
  const v = veiculoDa(expedicao);
  if (!veiculosDe(veiculos).includes(v)) return { ok: false, motivo: `precisa do ${VEICULOS[v].nome} — compre na garagem` };
  const t = tanque || tanqueDoDia({});
  if (t.restantes <= 0) return { ok: false, semCombustivel: true, motivo: `o tanque do ${VEICULOS[v].nome} está vazio — abasteça ou volte amanhã` };
  return { ok: true };
}

/** As moedas do saque: proporcional à destruição; ⭐⭐⭐ ganha +25%. */
export function saqueDaExpedicao(expedicao, { destruicao, estrelas }) {
  const base = Math.floor(((expedicao?.recompensa || 0) * Math.max(0, Math.min(100, destruicao || 0))) / 100);
  return estrelas >= 3 ? Math.round(base * (1 + BONUS_DE_TRES_ESTRELAS)) : base;
}
