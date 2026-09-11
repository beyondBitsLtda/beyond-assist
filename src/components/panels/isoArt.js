// Desenho isométrico do Mundo da Lisa.
//
// A linguagem visual continua a mesma do resto do app — um painel de LED, um pixel aceso por
// célula. O que muda é a PROJEÇÃO: em vez de um corte lateral, o terreno é visto de cima em
// ângulo, e cada construção é uma caixa 3D rasterizada nessa mesma grade de células.
//
// Nada aqui é bitmap. Casa, árvore e piscina saem de primitivas (caixa, telhado em degraus,
// piso, aresta), e é de propósito: numa grade de LED, onde tudo acende na MESMA cor, a leitura
// vem da SILHUETA e da diferença de brilho entre as faces. As três faces de uma caixa saem com
// brilhos diferentes (topo mais claro, lateral esquerda mais escura) — é isso, e só isso, que
// faz o olho ler volume aqui.

export const TW = 8; // largura de um tile, em células
export const TH = 4; // altura de um tile (metade da largura: projeção 2:1 clássica)

export const OX = 126; // origem: empurra o mundo todo pra dentro do canvas
export const OY = 62;

export const WORLD_W = 256; // tamanho do mundo inteiro, em células
export const WORLD_H = 196;

/** tile → célula. `h` é altura acima do chão, em células. */
export const iso = (tx, ty, h = 0) => ({
  x: OX + (tx - ty) * (TW / 2),
  y: OY + (tx + ty) * (TH / 2) - h,
});

/** Quão "na frente" um tile está — define a ordem de desenho (pintor). */
export const depth = (tx, ty) => tx + ty;

// ---------- primitivas ----------

/** Linha entre dois pontos de tela. */
function line(P, a, b, alpha) {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    P.paint(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t), alpha);
  }
}

/**
 * Preenche a área de um retângulo de tiles, opcionalmente levantada. `mod` fura o preenchimento
 * (1 de cada `mod` células) — é assim que grama, água e folhagem deixam de ser mancha sólida.
 */
export function floorFill(P, tx, ty, w, d, alpha, h = 0, mod = 0) {
  const N = TW;
  for (let i = 0; i <= w * N; i++)
    for (let j = 0; j <= d * N; j++) {
      const p = iso(tx + i / N, ty + j / N, h);
      const gx = Math.round(p.x);
      const gy = Math.round(p.y);
      if (mod && (gx * 2 + gy) % mod === 0) continue;
      P.paint(gx, gy, alpha);
    }
}

/** Contorno do losango de um retângulo de tiles, na altura `h`. */
export function floorEdge(P, tx, ty, w, d, alpha, h = 0) {
  const N = iso(tx, ty, h);
  const E = iso(tx + w, ty, h);
  const S = iso(tx + w, ty + d, h);
  const W = iso(tx, ty + d, h);
  line(P, N, E, alpha);
  line(P, E, S, alpha);
  line(P, S, W, alpha);
  line(P, W, N, alpha);
}

/**
 * Caixa isométrica. As três faces visíveis saem com brilhos DIFERENTES — sem isso a caixa vira
 * uma mancha chapada e o volume some.
 */
export function isoBox(P, tx, ty, w, d, h, { top = 0.62, left = 0.26, right = 0.42, edge = 1, mod = 0 } = {}) {
  const N = iso(tx, ty);
  const E = iso(tx + w, ty);
  const S = iso(tx + w, ty + d);
  const W = iso(tx, ty + d);

  // as duas faces da frente: varre a aresta do chão e levanta h células
  const face = (p1, p2, a) => {
    const steps = Math.max(1, Math.round(Math.abs(p2.x - p1.x)) * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(p1.x + (p2.x - p1.x) * t);
      const yb = Math.round(p1.y + (p2.y - p1.y) * t);
      for (let k = 0; k < h; k++) {
        if (mod && (x * 2 + (yb - k)) % mod === 0) continue;
        P.paint(x, yb - k, a);
      }
    }
  };
  face(W, S, left);
  face(S, E, right);
  floorFill(P, tx, ty, w, d, top, h, mod);

  // arestas por cima: é o que crava a silhueta
  floorEdge(P, tx, ty, w, d, edge, h);
  line(P, W, { x: W.x, y: W.y - h }, edge);
  line(P, S, { x: S.x, y: S.y - h }, edge);
  line(P, E, { x: E.x, y: E.y - h }, edge);
  line(P, W, S, edge * 0.7);
  line(P, S, E, edge * 0.7);
}

/** Telhado: losangos que encolhem à medida que sobem. Em degraus, que é como telhado fica bom
 * em pixel — rampa lisa vira serrilhado. */
export function isoRoof(P, tx, ty, w, d, baseH, roofH, alpha = 0.9) {
  // o topo ganha um miolo fraco: só o arame deixava o telhado parecendo vazado
  floorFill(P, tx + w * 0.42, ty + d * 0.42, w * 0.16, d * 0.16, 0.5, baseH + roofH);
  for (let k = 0; k <= roofH; k++) {
    const t = (k / roofH) * 0.92;
    const ix = (w / 2) * t;
    const iy = (d / 2) * t;
    floorEdge(P, tx + ix, ty + iy, w - ix * 2, d - iy * 2, k === roofH ? 1 : alpha, baseH + k);
  }
}

// ---------- construções ----------

/** Altura da parede da casa. A chaminé e a antena se penduram nela, então mora num lugar só. */
export const casaAltura = (level) => (level >= 3 ? 24 : 16);

export function drawCasa(P, { tx, ty, w, d }, level, night) {
  const h = casaAltura(level);
  // top 0: quem tem telhado NÃO preenche o topo da parede, senão o telhado some debaixo dele
  isoBox(P, tx, ty, w, d, h, { top: 0, left: 0.2, right: 0.36 });
  isoRoof(P, tx - 0.4, ty - 0.4, w + 0.8, d + 0.8, h, 7);

  // porta na face direita, e janelas acesas à noite
  const door = iso(tx + w, ty + d * 0.55);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 9; j++) P.paint(Math.round(door.x - i), Math.round(door.y - j - Math.round(i / 2)), 0.95);

  const glow = night ? 1 : 0.55;
  const win = iso(tx + w * 0.45, ty + d);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) P.paint(Math.round(win.x - i), Math.round(win.y - 7 - j + Math.round(i / 2)), glow);
  if (level >= 3) {
    const w2 = iso(tx + w * 0.45, ty + d);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) P.paint(Math.round(w2.x - i), Math.round(w2.y - 16 - j + Math.round(i / 2)), glow);
  }
}

export function drawChamine(P, { tx, ty, w, d }, level) {
  isoBox(P, tx + w - 1.6, ty + 0.4, 0.8, 0.8, casaAltura(level) + 10, { top: 0.6, left: 0.25, right: 0.42 });
}

export function drawAntena(P, { tx, ty, w, d }, level) {
  const base = iso(tx + 1, ty + 1, casaAltura(level) + 7);
  for (let j = 0; j < 12; j++) P.paint(Math.round(base.x), Math.round(base.y - j), 0.9);
  for (let k = 0; k < 3; k++) {
    const len = 9 - k * 2;
    for (let i = -len / 2; i <= len / 2; i++) P.paint(Math.round(base.x + i), Math.round(base.y - 3 - k * 3), 0.75);
  }
}

export function drawArvore(P, { tx, ty }) {
  const t = iso(tx + 1, ty + 1);
  for (let j = 0; j < 11; j++) {
    P.paint(Math.round(t.x), Math.round(t.y - j), 0.75);
    P.paint(Math.round(t.x + 1), Math.round(t.y - j), 0.55);
  }
  // copa: três bolhas furadinhas, com o contorno cravado por cima
  const lobes = [[t.x + 0.5, t.y - 20, 9, 6.5], [t.x - 5, t.y - 15, 6, 4.5], [t.x + 6, t.y - 15, 6, 4.5]];
  for (const [cx, cy, rx, ry] of lobes) ellipseFill(P, cx, cy, rx, ry, 0.72, 3);
  for (const [cx, cy, rx, ry] of lobes) ellipseEdge(P, cx, cy, rx, ry, 1);
}

function ellipseFill(P, cx, cy, rx, ry, a, mod = 0) {
  for (let dy = -ry; dy <= ry; dy++)
    for (let dx = -rx; dx <= rx; dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;
      const gx = Math.round(cx + dx);
      const gy = Math.round(cy + dy);
      if (mod && (gx * 2 + gy) % mod === 0) continue;
      P.paint(gx, gy, a);
    }
}
function ellipseEdge(P, cx, cy, rx, ry, a) {
  for (let d = 0; d < 360; d += 5) {
    const r = (d * Math.PI) / 180;
    P.paint(Math.round(cx + Math.cos(r) * rx), Math.round(cy + Math.sin(r) * ry), a);
  }
}

export function drawHorta(P, { tx, ty, w, d }) {
  floorFill(P, tx, ty, w, d, 0.3, 0, 2);
  floorEdge(P, tx, ty, w, d, 0.8);
  for (let a = 0.5; a < w; a += 1.2)
    for (let b = 0.5; b < d; b += 1.2) {
      const p = iso(tx + a, ty + b);
      for (let j = 0; j < 5; j++) P.paint(Math.round(p.x), Math.round(p.y - j), 0.85);
      P.paint(Math.round(p.x - 1), Math.round(p.y - 3), 0.7);
      P.paint(Math.round(p.x + 1), Math.round(p.y - 4), 0.7);
    }
}

export function drawCasinha(P, { tx, ty, w, d }) {
  isoBox(P, tx, ty, w, d, 6, { top: 0, left: 0.2, right: 0.36 });
  isoRoof(P, tx - 0.3, ty - 0.3, w + 0.6, d + 0.6, 6, 4);
  const door = iso(tx + w, ty + d * 0.5);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) P.paint(Math.round(door.x - i), Math.round(door.y - j - Math.round(i / 2)), 0.95);
}

export function drawVaral(P, { tx, ty, w }) {
  const a = iso(tx, ty);
  const b = iso(tx + w, ty);
  for (const p of [a, b]) for (let j = 0; j < 13; j++) P.paint(Math.round(p.x), Math.round(p.y - j), 0.85);
  const steps = Math.round(Math.abs(b.x - a.x));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    P.paint(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t - 12 + Math.sin(t * Math.PI) * 2), 0.65);
  }
  for (let k = 1; k <= 3; k++) {
    const t = k / 4;
    const px = Math.round(a.x + (b.x - a.x) * t);
    const py = Math.round(a.y + (b.y - a.y) * t - 11 + Math.sin(t * Math.PI) * 2);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) P.paint(px - 1 + i, py + j, 0.8);
  }
}

export function drawBanco(P, { tx, ty, w, d }) {
  isoBox(P, tx, ty, w, d, 3, { top: 0.6, left: 0.25, right: 0.42 });
  const back = iso(tx, ty);
  const back2 = iso(tx + w, ty);
  for (let j = 3; j < 9; j++) line(P, { x: back.x, y: back.y - j }, { x: back2.x, y: back2.y - j }, j > 7 ? 0.7 : 0.3);
}

export function drawCorreio(P, { tx, ty }, temCarta) {
  const p = iso(tx + 0.5, ty + 0.5);
  for (let j = 0; j < 8; j++) P.paint(Math.round(p.x), Math.round(p.y - j), 0.8);
  isoBox(P, tx + 0.1, ty + 0.1, 0.8, 0.8, 4, { top: 0.6, left: 0.3, right: 0.45 });
  if (temCarta) for (let j = 0; j < 4; j++) P.paint(Math.round(p.x + 4), Math.round(p.y - 10 - j), 0.95);
}

export function drawPoste(P, { tx, ty }, night) {
  const p = iso(tx + 0.5, ty + 0.5);
  for (let j = 0; j < 18; j++) P.paint(Math.round(p.x), Math.round(p.y - j), 0.8);
  for (let i = -2; i <= 2; i++) for (let j = 0; j < 3; j++) P.paint(Math.round(p.x + i), Math.round(p.y - 20 - j), night ? 1 : 0.6);
  if (night) ellipseEdge(P, p.x, p.y - 19, 7, 5, 0.14);
}

export function drawRadio(P, { tx, ty }) {
  isoBox(P, tx + 0.1, ty + 0.1, 0.8, 0.8, 6, { top: 0.6, left: 0.28, right: 0.45 });
  const p = iso(tx + 0.5, ty + 0.5);
  ellipseEdge(P, p.x, p.y - 4, 2, 1.5, 0.95);
}

export function drawPortao(P, { tx, ty, w }) {
  const a = iso(tx, ty);
  const b = iso(tx + w, ty);
  for (const p of [a, b]) for (let j = 0; j < 10; j++) P.paint(Math.round(p.x), Math.round(p.y - j), 0.9);
  const steps = Math.round(Math.abs(b.x - a.x));
  for (let i = 0; i <= steps; i += 2)
    for (let j = 2; j < 11; j += 3) {
      const t = i / steps;
      P.paint(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t - j), 0.6);
    }
}

export function drawFlores(P, { tx, ty, w, d }) {
  floorFill(P, tx, ty, w, d, 0.28, 0, 2);
  floorEdge(P, tx, ty, w, d, 0.6);
  for (let a = 0.4; a < w; a += 0.7)
    for (let b = 0.4; b < d; b += 0.7) {
      const p = iso(tx + a, ty + b);
      for (let j = 0; j < 3; j++) P.paint(Math.round(p.x), Math.round(p.y - j), 0.6);
      P.paint(Math.round(p.x), Math.round(p.y - 4), 1);
      P.paint(Math.round(p.x - 1), Math.round(p.y - 4), 0.7);
      P.paint(Math.round(p.x + 1), Math.round(p.y - 4), 0.7);
    }
}

export function drawMesa(P, { tx, ty, w, d }) {
  isoBox(P, tx + 0.2, ty + 0.5, w - 0.4, d - 1, 6, { top: 0.62, left: 0.26, right: 0.44 });
  isoBox(P, tx + 0.2, ty, w - 0.4, 0.4, 3, { top: 0.5, left: 0.22, right: 0.38 });
  isoBox(P, tx + 0.2, ty + d - 0.4, w - 0.4, 0.4, 3, { top: 0.5, left: 0.22, right: 0.38 });
}

export function drawChurras(P, { tx, ty, w, d }) {
  isoBox(P, tx, ty, w, d, 8, { top: 0.5, left: 0.24, right: 0.42 });
  isoBox(P, tx + w - 0.9, ty + 0.1, 0.7, 0.7, 15, { top: 0.6, left: 0.28, right: 0.45 });
}

export function drawBalanco(P, { tx, ty, w, d }) {
  const a = iso(tx, ty + d / 2);
  const b = iso(tx + w, ty + d / 2);
  for (const p of [a, b]) {
    for (let j = 0; j < 15; j++) P.paint(Math.round(p.x), Math.round(p.y - j), 0.8);
    P.paint(Math.round(p.x - 2), Math.round(p.y), 0.5);
    P.paint(Math.round(p.x + 2), Math.round(p.y), 0.5);
  }
  line(P, { x: a.x, y: a.y - 15 }, { x: b.x, y: b.y - 15 }, 0.9);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  for (let j = 0; j < 9; j++) {
    P.paint(Math.round(mid.x - 3), Math.round(mid.y - 15 + j), 0.6);
    P.paint(Math.round(mid.x + 3), Math.round(mid.y - 15 + j), 0.6);
  }
  for (let i = -4; i <= 4; i++) P.paint(Math.round(mid.x + i), Math.round(mid.y - 7), 0.95);
}

export function drawPoco(P, { tx, ty, w, d }) {
  isoBox(P, tx, ty, w, d, 4, { top: 0.18, left: 0.24, right: 0.4 });
  const a = iso(tx + 0.2, ty + d / 2);
  const b = iso(tx + w - 0.2, ty + d / 2);
  for (const p of [a, b]) for (let j = 4; j < 14; j++) P.paint(Math.round(p.x), Math.round(p.y - j), 0.8);
  isoRoof(P, tx - 0.3, ty - 0.3, w + 0.6, d + 0.6, 14, 4);
}

export function drawFogueira(P, { tx, ty, w, d }) {
  const c = iso(tx + w / 2, ty + d / 2);
  ellipseEdge(P, c.x, c.y, 7, 4, 0.7);
  for (let a = 0; a < 360; a += 40) {
    const r = (a * Math.PI) / 180;
    const px = Math.round(c.x + Math.cos(r) * 6);
    const py = Math.round(c.y + Math.sin(r) * 3.4);
    for (let j = 0; j < 2; j++) P.paint(px, py - j, 0.85);
  }
}

export function drawOficina(P, { tx, ty, w, d }) {
  isoBox(P, tx, ty, w, d, 12, { top: 0, left: 0.2, right: 0.36 });
  isoRoof(P, tx - 0.3, ty - 0.3, w + 0.6, d + 0.6, 12, 5);
  const door = iso(tx + w, ty + d * 0.5);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) P.paint(Math.round(door.x - i), Math.round(door.y - j - Math.round(i / 2)), 0.9);
}

export function drawSolar(P, { tx, ty, w, d }) {
  floorFill(P, tx + 0.6, ty + 0.6, w - 1.2, d - 1.2, 0.8, 17, 2);
  floorEdge(P, tx + 0.6, ty + 0.6, w - 1.2, d - 1.2, 1, 17);
}

export function drawEstufa(P, { tx, ty, w, d }) {
  isoBox(P, tx, ty, w, d, 10, { top: 0, left: 0.16, right: 0.26, mod: 2 });
  isoRoof(P, tx - 0.2, ty - 0.2, w + 0.4, d + 0.4, 10, 4, 0.55);
  for (let a = 0.6; a < w; a += 1.1) {
    const p = iso(tx + a, ty + d * 0.5);
    for (let j = 0; j < 5; j++) P.paint(Math.round(p.x), Math.round(p.y - j), 0.5);
  }
}

export function drawPiscina(P, { tx, ty, w, d }, now = 0) {
  floorEdge(P, tx, ty, w, d, 0.9);
  floorFill(P, tx + 0.25, ty + 0.25, w - 0.5, d - 0.5, 0.4, -2, 2);
  // ondinhas: linhas claras que andam devagar
  for (let k = 0; k < 4; k++) {
    const b = ty + 0.6 + ((k * 0.9 + (now / 2600) % 1) % (d - 1.2));
    const p1 = iso(tx + 0.4, b, -2);
    const p2 = iso(tx + w - 0.4, b, -2);
    line(P, p1, p2, 0.85);
  }
}

export function drawLago(P, { tx, ty, w, d }, now = 0) {
  const c = iso(tx + w / 2, ty + d / 2);
  ellipseFill(P, c.x, c.y, w * 4, d * 2, 0.35, 2);
  ellipseEdge(P, c.x, c.y, w * 4, d * 2, 0.9);
  for (let k = 0; k < 3; k++) {
    const t = ((now / 3400) + k / 3) % 1;
    ellipseEdge(P, c.x, c.y, w * 4 * t, d * 2 * t, 0.5 * (1 - t));
  }
}

export function drawMirante(P, { tx, ty, w, d }) {
  isoBox(P, tx + 0.3, ty + 0.3, w - 0.6, d - 0.6, 20, { top: 0.3, left: 0.22, right: 0.38 });
  floorFill(P, tx - 0.3, ty - 0.3, w + 0.6, d + 0.6, 0.55, 20);
  floorEdge(P, tx - 0.3, ty - 0.3, w + 0.6, d + 0.6, 1, 20);
  floorEdge(P, tx - 0.3, ty - 0.3, w + 0.6, d + 0.6, 0.7, 25);
  for (const [a, b] of [[0, 0], [w, 0], [0, d], [w, d]]) {
    const p = iso(tx - 0.3 + a, ty - 0.3 + b, 20);
    for (let j = 0; j < 5; j++) P.paint(Math.round(p.x), Math.round(p.y - j), 0.8);
  }
}

/** Cerca no perímetro do terreno. */
export function drawCerca(P, grid) {
  const post = (tx, ty) => {
    const p = iso(tx, ty);
    for (let j = 0; j < 5; j++) P.paint(Math.round(p.x), Math.round(p.y - j), 0.75);
  };
  for (let i = 0; i <= grid; i += 1.5) {
    post(i, 0);
    post(i, grid);
    post(0, i);
    post(grid, i);
  }
  for (const h of [2, 4]) {
    line(P, iso(0, 0, h), iso(grid, 0, h), 0.5);
    line(P, iso(0, grid, h), iso(grid, grid, h), 0.5);
    line(P, iso(0, 0, h), iso(0, grid, h), 0.5);
    line(P, iso(grid, 0, h), iso(grid, grid, h), 0.5);
  }
}

/** Chão do terreno: grama furadinha com uma malha de tiles bem fraca por cima. */
export function drawTerreno(P, grid) {
  floorFill(P, 0, 0, grid, grid, 0.09, 0, 3);
  for (let i = 0; i <= grid; i += 3) {
    line(P, iso(i, 0), iso(i, grid), 0.05);
    line(P, iso(0, i), iso(grid, i), 0.05);
  }
}

export function drawCaminho(P, tiles) {
  for (const [tx, ty] of tiles) {
    floorFill(P, tx, ty, 1, 1, 0.4, 0, 2);
    floorEdge(P, tx, ty, 1, 1, 0.22);
  }
}
