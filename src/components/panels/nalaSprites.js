// Desenhos da Nala, em "#" e "." — mesma linguagem da carinha da Lisa: um pixel aceso por
// célula do painel de LED. Cada pose tem 22x15 células.
//
// Por que 22x15: a primeira versão tinha 15x10 e ela saía um borrão. Nesse tamanho não cabem
// focinho, orelha caída, olho e vão entre as patas ao mesmo tempo, que é justamente o que faz a
// silhueta ser lida como cachorro. E como aqui tudo acende na MESMA cor, a leitura vem só do
// contorno e dos buracos apagados — daí a coluna apagada separando a orelha da bochecha, e o
// olho vazado.
//
// Mora em arquivo próprio porque virou muita arte: além das poses do jogo (correr, pular, pegar),
// tem as GRACINHAS que ela faz sozinha entre um lance e outro (ver ANTICS no fim).

export const NALA = {
  // ---- poses do jogo ----
  // parada: orelha caída, focinho pra frente, rabo levantado
  idle: [
    "......................",
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..###.....###.###.####",
    "..##.....####.########",
    "..##.....####.#######.",
    "...##.....###.#####...",
    "...################...",
    "...################...",
    "...###############....",
    "....#############.....",
    "....###......###......",
    "....###......###......",
    "...#####....#####.....",
  ],
  // rabo mais alto — alterna com a idle e vira abanada
  wag: [
    "......................",
    "..............#####...",
    "..###.......########..",
    "..##.......######.###.",
    "..##......###.###.####",
    "...##....####.########",
    "...##....####.#######.",
    "....#.....###.#####...",
    "...################...",
    "...################...",
    "...###############....",
    "....#############.....",
    "....###......###......",
    "....###......###......",
    "...#####....#####.....",
  ],
  // passada aberta
  runA: [
    "......................",
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..###.....###.###.####",
    "..##.....####.########",
    "..##.....####.#######.",
    "...##.....###.#####...",
    "...################...",
    "...################...",
    "...###############....",
    "....#############.....",
    "...###.......###......",
    "..###.........###.....",
    ".####..........####...",
  ],
  // patas recolhidas
  runB: [
    "......................",
    "..............#####...",
    "..###.......########..",
    "..##.......######.###.",
    "..##......###.###.####",
    "...##....####.########",
    "...##....####.#######.",
    "....#.....###.#####...",
    "...################...",
    "...################...",
    "...###############....",
    "....#############.....",
    ".....###...###........",
    ".....###...###........",
    "....#####.#####.......",
  ],
  // no ar: corpo esticado, patas dobradas, linhas de baixo vazias pra ela descolar do chão
  jump: [
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..........###.###.####",
    "..###....####.########",
    "...##....####.#######.",
    "....#.....###.#####...",
    "...################...",
    "...################...",
    "..###############.....",
    "..#############.......",
    "...####....####.......",
    "...###......##........",
    "......................",
    "......................",
  ],
  // sentada — comemorando com o disco na boca, e também a gracinha "senta".
  // O que faz ela ser lida como cachorro sentado, e não como um bloco: o lombo DESCE em
  // diagonal do ombro até a garupa no chão, e sobra um vão entre a garupa e a pata da frente.
  // A versão anterior tinha as quatro linhas do meio da mesma largura e virava um tijolo.
  // O rabo aqui é um COTOCO de três linhas, não o mastro das outras poses: sentada, um rabo
  // comprido encosta na garupa e os dois viram uma coluna vertical só, que lê como poste.
  happy: [
    "......................",
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..........###.###.####",
    ".........####.########",
    ".##......####.#######.",
    "..##......###.#####...",
    "...##...##########....",
    "..###..###########....",
    "..################....",
    "..###############.....",
    "..#########..#####....",
    "..#########..#####....",
    ".##########..######...",
  ],
  // cabeça baixa e rabo entre as pernas — precisa dar pra ver de longe que ela errou
  sad: [
    "......................",
    "......................",
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..........###.###.####",
    "..........###.########",
    "..........###.#######.",
    "..........###.#####...",
    ".##################...",
    ".#################....",
    ".##.#############.....",
    ".##.###......###......",
    "..#.###......###......",
    "...#####....#####.....",
  ],

  // ---- gracinhas ----
  // DE FRENTE, olhando pra você: orelhas caindo dos dois lados, dois olhos e o focinho vazados.
  // É a única pose que quebra o perfil — e é o que faz parecer que ela reparou em você.
  front: [
    "......................",
    "........######........",
    ".......########.......",
    "......##########......",
    "....####..##..####....",
    "....####..##..####....",
    "....######..######....",
    "....##############....",
    ".....############.....",
    "......##########......",
    ".......########.......",
    "......##########......",
    "......###....###......",
    "......###....###......",
    ".....#####..#####.....",
  ],
  // dormindo enroscada: um vulto só, com a corcova do lombo à esquerda, a cabeça deitada à
  // direita e o olho fechado. A primeira versão tinha um vão no meio e parecia dois bichos.
  sleep: [
    "......................",
    "......................",
    "......................",
    "......................",
    "......................",
    "......................",
    "......................",
    "......................",
    "......................",
    "......................",
    "..............####....",
    "....####.....######...",
    "..#############.####..",
    "..##################..",
    "..##################..",
  ],
  // pata traseira ERGUIDA (o resto é a idle): a patinha fica na altura da barriga, separada do
  // corpo por uma coluna apagada. Na primeira versão a perna saía rente ao chão e parecia
  // esticada, não levantada. O xixi em si sai como partícula, e a poça fica no chão.
  pee: [
    "......................",
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..###.....###.###.####",
    "..##.....####.########",
    "..##.....####.#######.",
    "...##.....###.#####...",
    "...################...",
    "...################...",
    "...###############....",
    ".##.#############.....",
    "..###........###......",
    ".............###......",
    "............#####.....",
  ],
  // agachada: traseiro baixo, lombo arqueado, patas de trás dobradas
  poop: [
    "......................",
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..###.....###.###.####",
    "..##.....####.########",
    "..##.....####.#######.",
    "...##.....###.#####...",
    "......#############...",
    ".....##############...",
    "....###############...",
    "...################...",
    "...#####.....###......",
    "...#####.....###......",
    "..#######...#####.....",
  ],
  // sentada coçando a orelha: a pata de trás sobe POR FORA do corpo, no vazio entre o rabo e a
  // orelha — dentro da silhueta ela simplesmente não apareceria, já que aqui tudo acende igual.
  // Antes a perna se fundia com a orelha e a pose inteira virava uma massa diagonal.
  scratch: [
    "......................",
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..........###.###.####",
    ".........####.########",
    ".##...##.####.#######.",
    "..##.###..###.#####...",
    "...##.############....",
    "..###..###########....",
    "..################....",
    "..###############.....",
    "..#########..#####....",
    "..#########..#####....",
    ".##########..######...",
  ],
  // latindo: cabeça erguida e boca aberta (o vão entre as mandíbulas)
  bark: [
    "..............#####...",
    "............########..",
    "...........######.###.",
    "..###.....###.###.####",
    "..##.....####.###.....",
    "..##.....####.########",
    "...##.....###.#####...",
    "...################...",
    "...################...",
    "...###############....",
    "....#############.....",
    "....#############.....",
    "....###......###......",
    "....###......###......",
    "...#####....#####.....",
  ],
};

export const DISC = [".#####.", "#######", ".#####."];

/** Z do sono — mesmo glifo da carinha da Lisa quando ela cochila. */
export const Z_GLYPH = ["#####", "...#.", "..#..", ".#...", "#####"];

/** O montinho que ela deixa pra trás. Fica no chão por um tempo, porque é a piada. */
export const POOP_PILE = ["..#..", ".###.", "#####"];

/** Poça do xixi — desenhada baixinha, com pouca luz. */
export const PUDDLE = [".#####.", "#######"];

/**
 * As gracinhas que ela faz sozinha entre um lance e outro.
 *
 * - `pose`: qual desenho usar.
 * - `ms`: quanto dura.
 * - `shake`: treme de leve na horizontal (serve pra coçar e pra se sacudir, sem arte nova).
 * - `fx`: efeito que o desenho sozinho não dá — "z" (sono), "pee", "poop", "bark".
 * - `weight`: quanto ela repete essa. Dormir e olhar pra você são comuns; cagar é evento.
 */
export const ANTICS = [
  { key: "front", pose: "front", ms: 2800, weight: 3 },
  { key: "sleep", pose: "sleep", ms: 9000, fx: "z", weight: 3 },
  { key: "sit", pose: "happy", ms: 3400, weight: 2 },
  { key: "scratch", pose: "scratch", ms: 2600, shake: true, weight: 2 },
  { key: "shake", pose: "idle", ms: 1500, shake: true, weight: 2 },
  { key: "bark", pose: "bark", ms: 1800, fx: "bark", weight: 2 },
  { key: "pee", pose: "pee", ms: 3400, fx: "pee", weight: 1 },
  { key: "poop", pose: "poop", ms: 4000, fx: "poop", weight: 1 },
];
