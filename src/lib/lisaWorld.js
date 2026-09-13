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
// Era 30, e a casa sozinha ocupa 9: com as construções em tamanho de verdade, tudo ficava
// encostado em tudo. 42 dá espaço pra cada peça respirar e ainda sobra terreno pra crescer.
export const GRID = 42;

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
  { key: "horta",    xp: 45,   label: "Horta",              note: "canteiro pra ela regar",       tx: 3,  ty: 14, w: 6, d: 5 },
  { key: "arvore1",  xp: 80,   label: "Primeira árvore",    note: "sombra no terreno",            tx: 15, ty: 10, w: 3, d: 3 },
  { key: "cerca",    xp: 120,  label: "Cerca",              note: "fecha o terreno" },
  { key: "casinha",  xp: 170,  label: "Casinha da Nala",    note: "onde a Nala dorme",            tx: 21, ty: 16, w: 3, d: 3 },
  { key: "varal",    xp: 230,  label: "Varal",              note: "roupa secando ao vento",       tx: 24, ty: 8,  w: 8, d: 1 },
  { key: "banco",    xp: 300,  label: "Banco",              note: "lugar pra ela descansar",      tx: 12, ty: 20, w: 2, d: 1 },
  { key: "correio",  xp: 380,  label: "Caixa de correio",   note: "chega carta de vez em quando", tx: 3,  ty: 36, w: 1, d: 1 },
  { key: "poste1",   xp: 470,  label: "Poste de luz",       note: "acende quando escurece",       tx: 14, ty: 15, w: 1, d: 1 },
  { key: "radio",    xp: 570,  label: "Caixa de som",       note: "ela ouve música no terreno",   tx: 18, ty: 21, w: 1, d: 1 },
  { key: "arvore2",  xp: 680,  label: "Segunda árvore",     note: "o terreno vai ficando verde",  tx: 35, ty: 10, w: 3, d: 3 },
  { key: "portao",   xp: 800,  label: "Portão",             note: "a entrada do terreno",         tx: 6,  ty: 40, w: 3, d: 1 },
  { key: "flores",   xp: 930,  label: "Canteiro de flores", note: "cor no meio do verde",         tx: 36, ty: 16, w: 3, d: 3 },
  { key: "mesa",     xp: 1070, label: "Mesa de piquenique", note: "pra receber gente",            tx: 28, ty: 13, w: 4, d: 3 },
  { key: "churras",  xp: 1220, label: "Churrasqueira",      note: "fim de semana no quintal",     tx: 6,  ty: 23, w: 3, d: 2 },
  { key: "balanco",  xp: 1380, label: "Balanço",            note: "pendurado numa trave",         tx: 11, ty: 27, w: 4, d: 3 },
  { key: "poco",     xp: 1550, label: "Poço",               note: "água pra horta",               tx: 20, ty: 26, w: 3, d: 3 },
  { key: "fogueira", xp: 1730, label: "Fogueira",           note: "acende de noite",              tx: 16, ty: 22, w: 2, d: 2 },
  { key: "antena",   xp: 1920, label: "Antena",             note: "é por ela que o Steve aparece" },
  { key: "chamine",  xp: 2120, label: "Chaminé",            note: "fumacinha no telhado" },
  { key: "oficina",  xp: 2330, label: "Oficina",            note: "onde ela conserta as coisas",  tx: 18, ty: 2,  w: 5, d: 5 },
  { key: "estufa",   xp: 2550, label: "Estufa",             note: "planta o ano inteiro",         tx: 27, ty: 2,  w: 5, d: 4 },
  { key: "arvore3",  xp: 2780, label: "Terceira árvore",    note: "agora é um bosque",            tx: 3,  ty: 25, w: 3, d: 3 },
  { key: "solar",    xp: 3020, label: "Painel solar",       note: "no telhado da oficina" },
  { key: "piscina",  xp: 3280, label: "Piscina",            note: "o luxo do terreno",            tx: 28, ty: 20, w: 6, d: 5 },
  { key: "lago",     xp: 3550, label: "Lago",               note: "com peixe e tudo",             tx: 29, ty: 29, w: 6, d: 5 },
  { key: "mirante",  xp: 3840, label: "Mirante",            note: "pra ver o terreno inteiro",    tx: 36, ty: 2,  w: 3, d: 3 },
  { key: "sobrado",  xp: 4200, label: "Segundo andar",      note: "a casa cresce" },
];

// A casa existe desde sempre — é o ponto de partida, não uma construção.
//
// Era 7x6 com parede de 16 células — mais baixa que a própria moradora, que tem 23.
// De longe parecia um galpãozinho. Agora ocupa 9x8 e a parede vai a 30 (52 com o sobrado), o que
// encosta exatamente na árvore e na horta: se mexer aqui, rode o world-check.
export const CASA = { tx: 3, ty: 3, w: 9, d: 8 };

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

/**
 * O caminho de pedra: do portão até a porta, com uma travessa e um ramo pro fundo.
 *
 * No fim ele é FILTRADO contra as construções. Traçar a mão e conferir a olho não se sustenta —
 * a casa cresceu de 7x6 pra 9x8 e a travessa passou a correr por baixo dela e por dentro da
 * horta. Assim o caminho contorna sozinho o que estiver no meio, agora e quando algo mudar.
 */
export const PATH_TILES = (() => {
  const t = [];
  for (let ty = 39; ty >= 21; ty--) t.push([7, ty]);   // do portão subindo pela esquerda
  for (let tx = 7; tx <= 27; tx++) t.push([tx, 21]);   // travessa no meio do terreno
  for (let ty = 20; ty >= 9; ty--) t.push([12, ty]);   // sobe até a porta da casa
  for (let ty = 22; ty <= 33; ty++) t.push([26, ty]);  // ramo pro fundo
  const areas = [CASA, ...WORLD_ITEMS.filter((i) => i.tx != null)];
  const sobreConstrucao = ([x, y]) => areas.some((a) => x >= a.tx && x < a.tx + a.w && y >= a.ty && y < a.ty + a.d);
  return t.filter((p) => !sobreConstrucao(p));
})();

/**
 * ORDEM DE DESENHO em isométrico.
 *
 * Ordenar por `tx+ty` (o canto de trás) só funciona quando todas as peças têm o mesmo tamanho.
 * Com a casa ocupando 9x8 e uma árvore 2x2 encostada nela, o canto de trás da casa é muito mais
 * fundo do que a casa realmente é — e ela sai desenhada depois de coisas que estão na frente,
 * fazendo a janela aparecer por cima da copa da árvore.
 *
 * Aqui é ordenação topológica: A vem antes de B quando A TERMINA antes de B COMEÇAR num dos
 * eixos, e só entre peças que podem se tapar (uma sombreia a outra em tx ou em ty). Sem essa
 * segunda condição, duas peças em cantos opostos criariam uma dependência circular à toa.
 */
export function ordemIso(itens) {
  const podeTapar = (a, b) =>
    (a.tx < b.tx + b.w && b.tx < a.tx + a.w) || (a.ty < b.ty + b.d && b.ty < a.ty + a.d);
  const atras = (a, b) => podeTapar(a, b) && (a.tx + a.w <= b.tx || a.ty + a.d <= b.ty);
  const n = itens.length;
  const grau = new Array(n).fill(0);
  const depois = itens.map(() => []);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i !== j && atras(itens[i].item || itens[i], itens[j].item || itens[j])) {
        depois[i].push(j);
        grau[j]++;
      }
    }
  // fila estável: entre peças sem dependência, a de trás primeiro
  const chave = (i) => { const b = itens[i].item || itens[i]; return b.tx + b.ty; };
  const fila = [];
  for (let i = 0; i < n; i++) if (!grau[i]) fila.push(i);
  fila.sort((a, b) => chave(a) - chave(b));
  const out = [];
  const posto = new Array(n).fill(false);
  while (fila.length) {
    const i = fila.shift();
    if (posto[i]) continue;
    posto[i] = true;
    out.push(itens[i]);
    let novos = false;
    for (const j of depois[i]) if (--grau[j] === 0) { fila.push(j); novos = true; }
    if (novos) fila.sort((a, b) => chave(a) - chave(b));
  }
  // se sobrar alguém (ciclo), entra no fim pela ordem antiga em vez de sumir da tela
  for (let i = 0; i < n; i++) if (!posto[i]) out.push(itens[i]);
  return out;
}
