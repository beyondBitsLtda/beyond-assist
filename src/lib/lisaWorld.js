// Regras do "Mundo da Lisa": o terreno dela, em isométrico, que vai ganhando construções
// conforme você interage com ela nos modos interativos.
//
// O progresso NÃO é uma moeda inventada: sai do que você já fez de verdade e que já está
// gravado — partidas dos joguinhos (lisa_games), quiz e pair programming (lisa_quiz,
// lisa_pair_sessions). Quem joga e estuda com ela constrói a casa dela; quem não joga vê um
// terreno vazio. É honesto e não precisou de tabela nova.
//
// Fica fora do componente porque é regra, não desenho: assim dá pra testar a escada de
// construções, o mapa e as atividades sem navegador (npm run world-check).

/** Lado do terreno, em tiles. O mundo inteiro é GRID x GRID. */
export const GRID = 30;

/** XP do mundo a partir das estatísticas REAIS já existentes. */
export function worldXp({ games, quiz, pair } = {}) {
  const played = Math.max(0, games?.total || 0);
  const wins = Math.max(0, games?.wins || 0);
  const quizPts = Math.max(0, quiz?.points || 0);
  const pairPts = Math.max(0, pair?.points || 0);
  // jogar já conta (é interação), ganhar conta um pouco mais; quiz e pair entram com o valor
  // que já valem nas telas de pontuação, pra não existirem duas moedas diferentes no app
  return played * 8 + wins * 6 + quizPts + pairPts;
}

/**
 * A escada de construções, e onde cada uma fica no terreno.
 *
 * `tx`/`ty` é o canto de trás do objeto em tiles, `w`/`d` a área que ele ocupa. As posições são
 * FIXAS de propósito: é o mesmo terreno sempre, e o que muda é o que já existe nele — é isso
 * que dá a sensação de ver o lugar se formando ao longo do tempo, em vez de um mapa aleatório.
 *
 * Os degraus do começo são baratos: umas poucas partidas já mudam alguma coisa na tela, senão o
 * modo abre vazio e não dá vontade de voltar.
 */
export const WORLD_ITEMS = [
  { key: "caminho",  xp: 20,   label: "Caminho de pedra",   note: "liga o portão à porta" },
  { key: "horta",    xp: 45,   label: "Horta",              note: "canteiro pra ela regar",       tx: 5,  ty: 10, w: 5, d: 4 },
  { key: "arvore1",  xp: 80,   label: "Primeira árvore",    note: "sombra no terreno",            tx: 11, ty: 6,  w: 2, d: 2 },
  { key: "cerca",    xp: 120,  label: "Cerca",              note: "fecha o terreno" },
  { key: "casinha",  xp: 170,  label: "Casinha da Nala",    note: "onde a Nala dorme",            tx: 15, ty: 8,  w: 3, d: 3 },
  { key: "varal",    xp: 230,  label: "Varal",              note: "roupa secando ao vento",       tx: 20, ty: 5,  w: 4, d: 1 },
  { key: "banco",    xp: 300,  label: "Banco",              note: "lugar pra ela descansar",      tx: 11, ty: 14, w: 2, d: 1 },
  { key: "correio",  xp: 380,  label: "Caixa de correio",   note: "chega carta de vez em quando", tx: 2,  ty: 25, w: 1, d: 1 },
  { key: "poste1",   xp: 470,  label: "Poste de luz",       note: "acende quando escurece",       tx: 11, ty: 10, w: 1, d: 1 },
  { key: "radio",    xp: 570,  label: "Caixa de som",       note: "ela ouve música no terreno",   tx: 13, ty: 12, w: 1, d: 1 },
  { key: "arvore2",  xp: 680,  label: "Segunda árvore",     note: "o terreno vai ficando verde",  tx: 25, ty: 9,  w: 2, d: 2 },
  { key: "portao",   xp: 800,  label: "Portão",             note: "a entrada do terreno",         tx: 4,  ty: 27, w: 2, d: 1 },
  { key: "flores",   xp: 930,  label: "Canteiro de flores", note: "cor no meio do verde",         tx: 27, ty: 13, w: 2, d: 2 },
  { key: "mesa",     xp: 1070, label: "Mesa de piquenique", note: "pra receber gente",            tx: 21, ty: 13, w: 3, d: 2 },
  { key: "churras",  xp: 1220, label: "Churrasqueira",      note: "fim de semana no quintal",     tx: 6,  ty: 16, w: 2, d: 2 },
  { key: "balanco",  xp: 1380, label: "Balanço",            note: "pendurado numa trave",         tx: 2,  ty: 18, w: 3, d: 2 },
  { key: "poco",     xp: 1550, label: "Poço",               note: "água pra horta",               tx: 9,  ty: 21, w: 2, d: 2 },
  { key: "fogueira", xp: 1730, label: "Fogueira",           note: "acende de noite",              tx: 15, ty: 17, w: 2, d: 2 },
  { key: "antena",   xp: 1920, label: "Antena",             note: "é por ela que o Steve aparece" },
  { key: "chamine",  xp: 2120, label: "Chaminé",            note: "fumacinha no telhado" },
  { key: "oficina",  xp: 2330, label: "Oficina",            note: "onde ela conserta as coisas",  tx: 13, ty: 1,  w: 4, d: 4 },
  { key: "estufa",   xp: 2550, label: "Estufa",             note: "planta o ano inteiro",         tx: 21, ty: 1,  w: 4, d: 3 },
  { key: "arvore3",  xp: 2780, label: "Terceira árvore",    note: "agora é um bosque",            tx: 1,  ty: 12, w: 2, d: 2 },
  { key: "solar",    xp: 3020, label: "Painel solar",       note: "no telhado da oficina" },
  { key: "piscina",  xp: 3280, label: "Piscina",            note: "o luxo do terreno",            tx: 22, ty: 18, w: 5, d: 4 },
  { key: "lago",     xp: 3550, label: "Lago",               note: "com peixe e tudo",             tx: 24, ty: 24, w: 4, d: 4 },
  { key: "mirante",  xp: 3840, label: "Mirante",            note: "pra ver o terreno inteiro",    tx: 27, ty: 1,  w: 2, d: 2 },
  { key: "sobrado",  xp: 4200, label: "Segundo andar",      note: "a casa cresce" },
];

/** A casa existe desde sempre — é o ponto de partida, não uma construção. */
export const CASA = { tx: 2, ty: 2, w: 7, d: 6 };

/** Chaves já construídas com esse XP. */
export function unlockedItems(xp) {
  return WORLD_ITEMS.filter((i) => xp >= i.xp).map((i) => i.key);
}

/** Próxima construção e quanto falta — é o que a interface mostra como objetivo. */
export function nextItem(xp) {
  const next = WORLD_ITEMS.find((i) => xp < i.xp);
  if (!next) return null;
  const prev = [...WORLD_ITEMS].reverse().find((i) => xp >= i.xp);
  const from = prev ? prev.xp : 0;
  return { ...next, falta: next.xp - xp, progresso: Math.max(0, Math.min(1, (xp - from) / (next.xp - from))) };
}

/** Nível da casa: sobe com as construções grandes do fim da escada. */
export function houseLevel(xp) {
  if (xp >= 4200) return 3;
  if (xp >= 2120) return 2;
  return 1;
}

// O que ela faz e a que horas mora em src/lib/lisaRotina.js. Aqui ficou só a obra, que não é
// rotina: é reação a uma construção nova.

/** A obra: fora da rotina de propósito. Só acontece quando alguma coisa ACABOU de ser
 * construída, e por isso é enfileirada em vez de sorteada. */
export const BUILD_ACTIVITY = { key: "obra", label: "construindo", anim: "martelar", ms: 10000 };

export const PATH_TILES = (() => {
  const t = [];
  for (let ty = 27; ty >= 9; ty--) t.push([5, ty]);  // do portão subindo até a travessa
  for (let tx = 5; tx <= 25; tx++) t.push([tx, 9]);  // travessa no meio do terreno
  for (let ty = 10; ty <= 22; ty++) t.push([16, ty]); // ramo pro fundo
  for (let ty = 8; ty >= 7; ty--) t.push([5, ty]);   // entrada da casa
  return t;
})();
