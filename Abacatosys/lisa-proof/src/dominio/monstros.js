// As EXPEDIÇÕES do Reino do Neuro: vilas, florestas, bosques e acampamentos de monstros para
// saquear, contra a CPU (pedido de 22/10/2026). Não é jogador contra jogador: ninguém perde moeda
// nem troféu quando você ataca um acampamento. Puro, como o resto de src/dominio.
//
// Cada expedição é uma ilha montada aqui (as mesmas construções do reino, nos mesmos lugares, com
// os monstros no lugar das tropas de defesa) e roda no MESMO motor de combate das invasões. Os
// monstros já estão soltos pela ilha quando o navio chega e guardam o pedaço deles: só correm
// atrás de quem chega perto.
//
// O saque é proporcional à destruição (e ⭐⭐⭐ dá um bônus). As tropas que sobrevivem voltam para
// casa — diferente da invasão, onde o exército inteiro fica no campo de batalha. Cada lugar pode
// ser saqueado uma vez por dia ("os monstros voltam amanhã"), até EXPEDICOES_POR_DIA por dia.

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
};
export const ORDEM_DOS_MONSTROS = ["ogro", "ent", "cerbero", "orc", "aranha", "lobo", "esqueleto", "slime", "goblin", "cogumelo", "bandido", "morcego"];
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
};

export const EXPEDICOES_POR_DIA = 3;
export const BONUS_DE_TRES_ESTRELAS = 0.25;

/**
 * O mapa das expedições, da mais fácil à mais difícil. `torreMinima`: o nível da Torre do Neuro
 * que libera o lugar. `recompensa`: as moedas de 100% de destruição. As construções seguem as
 * mesmas regras do reino (as da terra nova pedem o Terreno).
 */
export const EXPEDICOES = [
  {
    id: "bosque-cogumelos", nome: "Bosque dos Cogumelos", tipo: "bosque", torreMinima: 1, recompensa: 160, chefe: "cogumelo",
    descricao: "Cogumelos saltitantes e gosmas guardam um baú esquecido no meio do bosque.",
    construcoes: { castelo: 1, mina: 1, cofre: 1, torre: 1 },
    monstros: { cogumelo: 5, slime: 2 },
  },
  {
    id: "vila-goblins", nome: "Vila dos Goblins", tipo: "vila", torreMinima: 1, recompensa: 180, chefe: "goblin",
    descricao: "Os goblins tomaram a vila e escondem o ouro roubado na casa do chefe.",
    construcoes: { castelo: 1, mina: 1, cofre: 1, torre: 1, quartel: 1 },
    monstros: { goblin: 7, bandido: 1 },
  },
  {
    id: "floresta-lobos", nome: "Floresta dos Lobos", tipo: "floresta", torreMinima: 2, recompensa: 300, chefe: "lobo",
    descricao: "Uma alcateia uiva entre os pinheiros — e as aranhas cuidam da toca do líder.",
    construcoes: { castelo: 2, mina: 2, cofre: 1, torre: 2, canhao: 1, quartel: 1, muralha: 1 },
    monstros: { lobo: 5, aranha: 2 },
  },
  {
    id: "acampamento-orc", nome: "Acampamento Orc", tipo: "acampamento", torreMinima: 2, recompensa: 420, chefe: "orc",
    descricao: "Orcs e goblins juntaram o saque de três reinos numa só tenda.",
    construcoes: { castelo: 2, mina: 2, cofre: 2, torre: 2, canhao: 1, quartel: 1, muralha: 1 },
    monstros: { orc: 3, goblin: 6 },
  },
  {
    id: "vila-bandidos", nome: "Vila dos Bandidos", tipo: "vila", torreMinima: 3, recompensa: 560, chefe: "bandido",
    descricao: "Bandidos com bestas no telhado e um ogro de guarda-costas. Leve quem acerta de longe.",
    construcoes: { castelo: 3, terreno: 1, mina: 3, cofre: 3, torre: 2, canhao: 2, quartel: 2, muralha: 1, defesaAerea: 1 },
    monstros: { bandido: 3, goblin: 4, ogro: 1 },
  },
  {
    id: "bosque-assombrado", nome: "Bosque Assombrado", tipo: "bosque", torreMinima: 3, recompensa: 600, chefe: "esqueleto",
    descricao: "Esqueletos se levantam da terra e morcegos cobrem o céu. Cuidado com quem voa.",
    construcoes: { castelo: 3, terreno: 1, mina: 2, cofre: 3, torre: 2, canhao: 2, muralha: 2, biblioteca: 1, defesaAerea: 2 },
    monstros: { esqueleto: 6, morcego: 4 },
  },
  {
    id: "floresta-sombria", nome: "Floresta Sombria", tipo: "floresta", torreMinima: 4, recompensa: 900, chefe: "ent",
    descricao: "As árvores andam. Ents antigos e aranhas gigantes guardam o coração da floresta.",
    construcoes: { castelo: 4, terreno: 2, mina: 3, cofre: 3, torre: 3, canhao: 3, quartel: 3, muralha: 2, defesaAerea: 2, morteiro: 1, torreMagica: 1 },
    monstros: { aranha: 3, lobo: 3, ent: 1 },
  },
  {
    id: "covil-cerbero", nome: "Covil do Cérbero", tipo: "acampamento", torreMinima: 5, recompensa: 1200, chefe: "cerbero",
    descricao: "O cão de três cabeças guarda o maior tesouro do mapa. Só os reinos mais fortes voltam inteiros.",
    construcoes: { castelo: 5, terreno: 3, mina: 3, cofre: 3, torre: 4, canhao: 4, quartel: 3, muralha: 3, defesaAerea: 2, morteiro: 1, torreMagica: 1, torreRaio: 1 },
    monstros: { cerbero: 1, esqueleto: 3, orc: 2 },
  },
];
export const expedicaoPorId = (id) => EXPEDICOES.find((x) => x.id === id) || null;

/** O lado defensor da batalha: a ilha da expedição, sem Neuro, com os monstros soltos. */
export function defensorDaExpedicao(expedicao) {
  return {
    construcoes: { ...expedicao.construcoes },
    neuro_nivel: 0,
    guarnicao: {},
    monstros: contagensDeMonstros(expedicao.monstros),
    tema: expedicao.tipo,
  };
}

/**
 * Dá para partir nessa expedição agora? `feitasHoje`: as expedições do dia; `jaFezHoje`: este
 * lugar já foi saqueado hoje (os monstros voltam amanhã).
 */
export function podeExpedicionar({ expedicao, nivelDaTorre, temExercito, feitasHoje, jaFezHoje }) {
  if (!expedicao) return { ok: false, motivo: "essa expedição não existe" };
  if ((nivelDaTorre || 0) < expedicao.torreMinima) return { ok: false, motivo: `libera com a Torre do Neuro no nível ${expedicao.torreMinima}` };
  if (jaFezHoje) return { ok: false, motivo: "já saqueado hoje — os monstros voltam amanhã" };
  if ((feitasHoje || 0) >= EXPEDICOES_POR_DIA) return { ok: false, motivo: `você já fez as ${EXPEDICOES_POR_DIA} expedições de hoje — amanhã tem mais` };
  if (!temExercito) return { ok: false, motivo: "treine tropas no Quartel antes de partir" };
  return { ok: true };
}

/** As moedas do saque: proporcional à destruição; ⭐⭐⭐ ganha +25%. */
export function saqueDaExpedicao(expedicao, { destruicao, estrelas }) {
  const base = Math.floor(((expedicao?.recompensa || 0) * Math.max(0, Math.min(100, destruicao || 0))) / 100);
  return estrelas >= 3 ? Math.round(base * (1 + BONUS_DE_TRES_ESTRELAS)) : base;
}
