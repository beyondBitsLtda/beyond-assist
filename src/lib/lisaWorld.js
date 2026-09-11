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

/**
 * O que ela faz no terreno. `needs` é a construção necessária — sem ela a atividade nem entra
 * no sorteio, que é o que faz o mundo ficar mais movimentado conforme cresce.
 *
 * `at` é o tile pra onde ela caminha; sem ele, ela escolhe um canto qualquer e passeia.
 * `night` prende a atividade ao escuro (fogueira e estrelas só fazem sentido de noite).
 */
export const ACTIVITIES = [
  { key: "passear",   label: "passeando pelo terreno",    ms: 8000,  needs: null },
  { key: "varrer",    label: "varrendo o quintal",        ms: 9000,  needs: null,       at: [10, 18], tool: "vassoura" },
  { key: "nala",      label: "brincando com a Nala",      ms: 14000, needs: null,       at: [13, 21] },
  { key: "regar",     label: "regando a horta",           ms: 10000, needs: "horta",    at: [7, 15],  tool: "regador" },
  { key: "varal",     label: "estendendo roupa",          ms: 9000,  needs: "varal",    at: [21, 7] },
  { key: "descansar", label: "descansando no banco",      ms: 12000, needs: "banco",    at: [11, 16], sit: true },
  { key: "correio",   label: "vendo se chegou carta",     ms: 7000,  needs: "correio",  at: [3, 25] },
  { key: "musica",    label: "ouvindo música",            ms: 12000, needs: "radio",    at: [14, 13] },
  { key: "flores",    label: "cuidando das flores",       ms: 9000,  needs: "flores",   at: [26, 14], tool: "regador" },
  { key: "mesa",      label: "arrumando a mesa",          ms: 9000,  needs: "mesa",     at: [21, 16] },
  { key: "churras",   label: "acendendo a churrasqueira", ms: 11000, needs: "churras",  at: [7, 19] },
  { key: "balanco",   label: "no balanço",                ms: 11000, needs: "balanco",  at: [4, 21] },
  { key: "poco",      label: "tirando água do poço",      ms: 9000,  needs: "poco",     at: [10, 24] },
  { key: "fogueira",  label: "na fogueira",               ms: 13000, needs: "fogueira", at: [16, 20], night: true },
  { key: "steve",     label: "recebendo o Steve",         ms: 16000, needs: "antena",   at: [9, 12] },
  { key: "oficina",   label: "mexendo na oficina",        ms: 12000, needs: "oficina",  at: [15, 6],  tool: "martelo" },
  { key: "estufa",    label: "cuidando da estufa",        ms: 10000, needs: "estufa",   at: [22, 5] },
  { key: "piscina",   label: "na beira da piscina",       ms: 13000, needs: "piscina",  at: [21, 21] },
  { key: "lago",      label: "olhando o lago",            ms: 10000, needs: "lago",     at: [23, 26] },
  { key: "mirante",   label: "no mirante",                ms: 11000, needs: "mirante",  at: [26, 4] },
  { key: "estrelas",  label: "olhando as estrelas",       ms: 10000, needs: null,       at: [18, 25], night: true },
  { key: "obra",      label: "construindo",               ms: 10000, needs: null,       tool: "martelo", onlyOnBuild: true },
];

/** As atividades possíveis agora. A obra não entra no sorteio: ela só acontece quando algo NOVO
 * acaba de ser construído. */
export function availableActivities(unlocked, night = false) {
  const have = new Set(unlocked || []);
  return ACTIVITIES.filter((a) => !a.onlyOnBuild && (!a.needs || have.has(a.needs)) && (!a.night || night));
}

export const BUILD_ACTIVITY = ACTIVITIES.find((a) => a.key === "obra");

/** O caminho de pedra: do portão até a porta da casa, com uma travessa e um ramo pro fundo.
 * Mora aqui e não no desenho porque a Lisa ANDA por ele — é dado, não enfeite. */
export const PATH_TILES = (() => {
  const t = [];
  for (let ty = 27; ty >= 9; ty--) t.push([5, ty]);  // do portão subindo até a travessa
  for (let tx = 5; tx <= 25; tx++) t.push([tx, 9]);  // travessa no meio do terreno
  for (let ty = 10; ty <= 22; ty++) t.push([16, ty]); // ramo pro fundo
  for (let ty = 8; ty >= 7; ty--) t.push([5, ty]);   // entrada da casa
  return t;
})();
