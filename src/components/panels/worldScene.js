// O cenário do Mundo da Lisa: chão, casa e tudo que ela constrói no quintal.
//
// Nada aqui é bitmap. Casa, árvore, cerca e companhia são desenhadas com primitivas (contorno,
// linha, retângulo), e é de propósito: numa grade de LED, onde tudo acende na MESMA cor, uma
// construção preenchida vira um bloco sem leitura — foi exatamente o que aconteceu com as
// primeiras poses da Nala. Em TRAÇO, a mesma casa lê na hora. De quebra, os upgrades viram
// composição (põe uma chaminé, sobe um andar) em vez de um desenho novo inteiro.
//
// DUAS LINHAS DE CHÃO. As construções ficam apoiadas em BACK; a Lisa e a Nala andam em GROUND,
// mais pra frente. Na primeira versão estava tudo na mesma linha e ela atravessava a casinha da
// Nala e o banco como fantasma — com as duas linhas, passar na frente das coisas vira
// profundidade em vez de bug.

export const WW = 170; // largura do cenário, em células
export const WH = 72;  // altura
export const BACK = 58;   // linha onde as construções se apoiam (fundo do quintal)
export const GROUND = 66; // linha onde os pés dela encostam (passeio, na frente)

// A ESCALA importa mais do que parece. Na primeira versão a casa tinha a parede MENOR que a
// Lisa e o quintal inteiro parecia de brinquedo. Numa casa térrea de verdade a parede dá umas
// 1,5 vezes a altura de uma pessoa — como ela tem 23 células, a parede daqui tem 36.

/** Onde cada construção fica. Faixas separadas de propósito: nada encosta em nada. */
export const SPOTS = {
  cerca: 0,
  correio: 10,
  arvore: 20,   // a copa é larga: cobre de 16 a 48, por isso o poste só começa depois disso
  poste: 50,
  varalA: 60,
  horta: 62,
  varalB: 80,
  casinha: 84,
  banco: 112,
  radio: 120,
  casa: 130,
};

/** Faixa em que ela pode caminhar. */
export const WALK_MIN = 8;
export const WALK_MAX = 126;

/** Ferramentas de desenho em cima do `paint` do canvas. */
export function painter(paint) {
  const P = {
    paint,
    hline: (x, y, w, a = 1) => { for (let i = 0; i < w; i++) paint(x + i, y, a); },
    vline: (x, y, h, a = 1) => { for (let j = 0; j < h; j++) paint(x, y + j, a); },
    rect: (x, y, w, h, a = 1) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) paint(x + i, y + j, a); },
    frame: (x, y, w, h, a = 1) => {
      P.hline(x, y, w, a);
      P.hline(x, y + h - 1, w, a);
      P.vline(x, y, h, a);
      P.vline(x + w - 1, y, h, a);
    },
    sprite: (rows, ox, oy, a = 1) => {
      for (let r = 0; r < rows.length; r++)
        for (let c = 0; c < rows[r].length; c++)
          if (rows[r][c] === "#") paint(Math.round(ox) + c, Math.round(oy) + r, a);
    },
    /** Elipse preenchida com FUROS — é o que transforma uma mancha sólida em folhagem. */
    leafy: (cx, cy, rx, ry, a = 0.9) => {
      for (let dy = -ry; dy <= ry; dy++)
        for (let dx = -rx; dx <= rx; dx++) {
          if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;
          const gx = Math.round(cx + dx);
          const gy = Math.round(cy + dy);
          if ((gx * 2 + gy) % 3 === 0) continue; // o furo que vira folha
          paint(gx, gy, a);
        }
    },
    ring: (cx, cy, rx, ry, a = 1, step = 6) => {
      for (let d = 0; d < 360; d += step) {
        const r = (d * Math.PI) / 180;
        paint(Math.round(cx + Math.cos(r) * rx), Math.round(cy + Math.sin(r) * ry), a);
      }
    },
  };
  return P;
}

/** Telhado de duas águas, em contorno. */
function roof(P, x, y, w, h, a = 1) {
  for (let i = 0; i <= h; i++) {
    const inset = Math.round((i * (w / 2 - 1)) / h);
    P.paint(x + inset, y + h - i, a);
    P.paint(x + w - 1 - inset, y + h - i, a);
  }
  P.hline(x, y + h, w, a);
}

// ---------- construções ----------

/** Altura da parede por nível — usada também pra saber onde a antena encaixa no telhado. */
export const houseBodyH = (level) => (level >= 3 ? 42 : 30);

/** A casa. Nível 1 é térrea; 2 ganha chaminé; 3 sobe um andar com janela de cima. */
export function drawHouse(P, x, level, night) {
  const w = 40;
  // teto do cenário manda: com 50 de parede o telhado do sobrado saía por cima da tela
  const bodyH = houseBodyH(level);
  const top = BACK - bodyH;
  P.frame(x, top, w, bodyH + 1);
  roof(P, x - 3, top - 15, w + 6, 15);

  P.frame(x + 5, BACK - 16, 9, 17); // porta
  P.paint(x + 11, BACK - 8, 0.9);   // maçaneta

  const glow = night ? 0.85 : 0.22; // janela acesa à noite
  P.frame(x + 21, BACK - 18, 13, 11);
  P.rect(x + 22, BACK - 17, 11, 9, glow);
  P.vline(x + 27, BACK - 17, 9, 1);
  P.hline(x + 22, BACK - 13, 11, 1);

  if (level >= 3) {
    P.hline(x, BACK - 19, w); // laje entre os andares
    P.frame(x + 14, BACK - 33, 12, 10);
    P.rect(x + 15, BACK - 32, 10, 8, glow);
    P.vline(x + 19, BACK - 32, 8, 1);
  }
  if (level >= 2) P.frame(x + 29, top - 12, 7, 9); // chaminé
}

export function drawTree(P, x) {
  const tx = x + 11;
  P.vline(tx, BACK - 21, 22);
  P.vline(tx + 1, BACK - 21, 22);
  P.vline(tx + 2, BACK - 21, 22, 0.7);
  P.paint(tx - 1, BACK, 0.7);
  P.paint(tx + 3, BACK, 0.7);
  // copa: três lóbulos, folhagem furadinha com o contorno cravado por cima
  const lobes = [[tx + 1, BACK - 36, 13, 10], [tx - 7, BACK - 28, 8, 6.5], [tx + 9, BACK - 28, 8, 6.5]];
  for (const [cx, cy, rx, ry] of lobes) P.leafy(cx, cy, rx, ry, 0.9);
  for (const [cx, cy, rx, ry] of lobes) P.ring(cx, cy, rx, ry, 1, 6);
}

export function drawHorta(P, x) {
  P.hline(x, BACK, 17, 0.6); // canteiro
  for (let i = 0; i < 4; i++) {
    const px = x + 3 + i * 4;
    P.vline(px, BACK - 6, 6);
    P.paint(px - 1, BACK - 4);
    P.paint(px - 2, BACK - 5, 0.8);
    P.paint(px + 1, BACK - 5);
    P.paint(px + 2, BACK - 6, 0.8);
    P.paint(px - 1, BACK - 7, 0.7);
  }
}

export function drawCasinha(P, x) {
  P.frame(x, BACK - 12, 20, 13);
  roof(P, x - 2, BACK - 21, 24, 9);
  P.rect(x + 7, BACK - 9, 7, 10, 0.85); // entrada
  P.paint(x + 6, BACK - 8, 0.85);
  P.paint(x + 14, BACK - 8, 0.85);
}

export function drawBanco(P, x) {
  P.hline(x, BACK - 6, 16);
  P.hline(x, BACK - 11, 16, 0.8);
  P.vline(x + 1, BACK - 11, 6, 0.8);
  P.vline(x + 14, BACK - 11, 6, 0.8);
  P.vline(x + 1, BACK - 6, 7);
  P.vline(x + 14, BACK - 6, 7);
}

export function drawRadio(P, x) {
  P.frame(x, BACK - 13, 10, 9);
  P.ring(x + 3, BACK - 9, 2, 2, 0.9, 45);
  P.paint(x + 7, BACK - 11);
  P.paint(x + 7, BACK - 8);
  P.vline(x + 9, BACK - 19, 6, 0.7);
}

export function drawPoste(P, x, night) {
  P.vline(x + 3, BACK - 23, 24);
  P.frame(x, BACK - 29, 7, 7);
  if (night) {
    P.rect(x + 1, BACK - 28, 5, 5, 0.95);
    P.ring(x + 3, BACK - 26, 8, 8, 0.12, 16); // halo
  }
}

export function drawCerca(P, x) {
  for (let i = 0; i < 5; i++) {
    P.vline(x + i * 2, BACK - 13, 14);
    P.paint(x + i * 2, BACK - 14, 0.8);
  }
  P.hline(x, BACK - 10, 9, 0.8);
  P.hline(x, BACK - 4, 9, 0.8);
}

export function drawCorreio(P, x, temCarta) {
  P.vline(x + 3, BACK - 10, 11);
  P.frame(x, BACK - 18, 8, 9);
  if (temCarta) {
    P.vline(x + 8, BACK - 21, 5, 0.9); // bandeirinha levantada
    P.hline(x + 8, BACK - 21, 3, 0.9);
  }
}

export function drawVaral(P, a, b) {
  P.vline(a, BACK - 24, 25);
  P.vline(b, BACK - 24, 25);
  P.hline(a - 2, BACK - 24, 5, 0.8);
  P.hline(b - 2, BACK - 24, 5, 0.8);
  const span = b - a;
  for (let i = 0; i <= span; i++) {
    const t = i / span;
    P.paint(a + i, Math.round(BACK - 23 + Math.sin(t * Math.PI) * 3), 0.7);
  }
  for (let k = 1; k <= 3; k++) {
    const px = a + Math.round((span * k) / 4);
    const py = Math.round(BACK - 23 + Math.sin((k / 4) * Math.PI) * 3) + 1;
    P.frame(px - 2, py, 5, 8, 0.85);
  }
}

/** Antena de telhado: mastro com três travessas que encurtam pra cima. */
export function drawAntena(P, x, topY) {
  P.vline(x, topY, 15);
  for (let i = 0; i < 3; i++) P.hline(x - 4 + i, topY + 2 + i * 4, 9 - i * 2, 0.85);
}

// ---------- fundo ----------

/** Céu: estrelas à noite, sol ou lua sempre. A hora é a de VERDADE do aparelho — parte da graça
 * é abrir de madrugada e achar o quintal escuro com o poste aceso. */
export function drawSky(P, night, hour) {
  if (night) {
    // posições fixas: estrela trocando de lugar a cada quadro viraria chuvisco
    for (let i = 0; i < 38; i++) P.paint((i * 43) % WW, (i * 17) % 28, 0.3 + 0.22 * Math.sin(i));
  }
  // o sol cruza das 6h às 18h; a lua, das 19h às 5h. Sem o arco da noite ela ficava grudada no
  // canto da tela a madrugada inteira, em cima do telhado.
  const t = night
    ? Math.max(0, Math.min(1, ((hour < 6 ? hour + 24 : hour) - 19) / 10))
    : Math.max(0, Math.min(1, (hour - 6) / 12));
  const cx = Math.round(16 + t * (WW - 32));
  const cy = Math.round(20 - Math.sin(t * Math.PI) * 12);
  P.ring(cx, cy, 5.5, 5.5, night ? 0.8 : 1, 9);
  // de dia ela ganha raios; de noite é a mesma bola, só que sozinha — e vira lua
  if (!night) for (let a = 0; a < 360; a += 45) {
    const r = (a * Math.PI) / 180;
    P.paint(Math.round(cx + Math.cos(r) * 9), Math.round(cy + Math.sin(r) * 9), 0.6);
  }
}

/** As duas linhas de chão e a grama entre elas. */
export function drawGround(P) {
  P.hline(0, BACK + 1, WW, 0.28);                       // fundo do quintal
  for (let x = 1; x < WW; x += 5) P.paint(x, BACK, 0.14); // tufos lá atrás
  P.hline(0, GROUND + 1, WW, 0.4);                      // passeio da frente
  for (let x = 3; x < WW; x += 7) P.paint(x, GROUND, 0.16);
  for (let x = 2; x < WW; x += 9) P.paint(x, GROUND + 3, 0.1);
  // grama solta entre as duas linhas, pra não ficar um vazio
  for (let x = 4; x < WW; x += 6) P.paint(x, BACK + 3 + ((x / 6) % 3), 0.1);
}

/** Desenha o quintal inteiro conforme o que já foi construído. É esta função que vai pra uma
 * camada em cache: só refaz quando aparece construção nova ou o dia vira noite. */
export function drawWorld(P, { unlocked, level, night, hour, temCarta }) {
  const has = (k) => unlocked.includes(k);
  drawSky(P, night, hour);
  drawGround(P);
  drawHouse(P, SPOTS.casa, level, night);
  if (has("antena")) drawAntena(P, SPOTS.casa + 30, BACK - houseBodyH(level) - 12);
  if (has("arvore")) drawTree(P, SPOTS.arvore);
  if (has("varal")) drawVaral(P, SPOTS.varalA, SPOTS.varalB);
  if (has("horta")) drawHorta(P, SPOTS.horta);
  if (has("casinha")) drawCasinha(P, SPOTS.casinha);
  if (has("banco")) drawBanco(P, SPOTS.banco);
  if (has("radio")) drawRadio(P, SPOTS.radio);
  if (has("poste")) drawPoste(P, SPOTS.poste, night);
  if (has("cerca")) drawCerca(P, SPOTS.cerca);
  if (has("correio")) drawCorreio(P, SPOTS.correio, temCarta);
}
