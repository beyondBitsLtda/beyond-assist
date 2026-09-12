// Desenho isométrico do Mundo da Lisa — em TRAÇO.
//
// A versão anterior rasterizava tudo numa grade de LED: cada linha era uma fileira de
// quadradinhos arredondados, cada um com brilho próprio. Ficava granulado e, com trinta objetos
// na tela, virava poluição — não dava pra separar uma casa de uma árvore de longe.
//
// Aqui é o contrário: cada construção é um CAMINHO vetorial, traçado fino, com as faces
// preenchidas de leve só pra dar volume. O brilho é um só, no contexto inteiro, em vez de um por
// célula. Menos tinta na tela, silhueta mais limpa e, de quebra, algumas centenas de operações
// por quadro em vez de dezenas de milhares.
//
// Os SERES continuam vindo dos mesmos desenhos em "#" e "." de sempre (a Nala não mudou um
// pixel) — o que mudou é que agora são pintados como silhueta cheia com contorno, em vez de
// pontinhos soltos. É isso que faz eles existirem contra qualquer fundo.

export const TW = 8; // largura de um tile, em células
export const TH = 4; // altura de um tile (metade da largura: projeção 2:1 clássica)

export const OX = 126;
export const OY = 62;

export const WORLD_W = 256; // o mundo inteiro, em células
export const WORLD_H = 196;

/** tile → célula. `h` é altura acima do chão. */
export const iso = (tx, ty, h = 0) => ({
  x: OX + (tx - ty) * (TW / 2),
  y: OY + (tx + ty) * (TH / 2) - h,
});

/** Altura da parede da casa. A chaminé e a antena se penduram nela, então mora num lugar só. */
export const casaAltura = (nivel) => (nivel >= 3 ? 24 : 16);

/**
 * O pincel. Converte coordenadas de célula pra pixel de tela e desenha caminhos.
 * `cell` é o tamanho da célula na tela; `camX/camY` a câmera, em células.
 */
export function pincel(ctx, { cell, camX = 0, camY = 0, accent = "56,225,255" }) {
  const X = (p) => (p.x - camX) * cell;
  const Y = (p) => (p.y - camY) * cell;
  const esp = Math.max(0.9, cell * 0.17); // espessura base, acompanha o zoom

  const caminho = (pts, fechar) => {
    ctx.beginPath();
    ctx.moveTo(X(pts[0]), Y(pts[0]));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i]), Y(pts[i]));
    if (fechar) ctx.closePath();
  };

  const P = {
    cell,
    /** Polilinha aberta. */
    linha(pts, { a = 0.85, w = 1 } = {}) {
      if (pts.length < 2 || a <= 0.02) return;
      caminho(pts, false);
      ctx.strokeStyle = `rgba(${accent},${a})`;
      ctx.lineWidth = esp * w;
      ctx.stroke();
    },
    /**
     * Polígono fechado: contorno e, se pedir, um preenchimento fraco pra dar volume.
     *
     * `solido` tampa primeiro com o fundo escuro. Sem isso as paredes ficam de vidro e dá pra ver
     * a cerca, as árvores e a casa do cachorro ATRAVÉS da casa — o desenho fica limpo mas a
     * profundidade some, e em isométrico a profundidade é o que faz a cena existir.
     */
    poli(pts, { a = 0.85, w = 1, fill = 0, solido = false } = {}) {
      if (pts.length < 3) return;
      caminho(pts, true);
      if (solido) { ctx.fillStyle = "rgba(3,8,12,0.94)"; ctx.fill(); }
      if (fill > 0) {
        ctx.fillStyle = `rgba(${accent},${fill})`;
        ctx.fill();
      }
      if (a > 0.02) {
        ctx.strokeStyle = `rgba(${accent},${a})`;
        ctx.lineWidth = esp * w;
        ctx.stroke();
      }
    },
    /** Elipse em coordenada de célula. */
    elipse(cx, cy, rx, ry, { a = 0.85, w = 1, fill = 0, solido = false } = {}) {
      ctx.beginPath();
      ctx.ellipse((cx - camX) * cell, (cy - camY) * cell, rx * cell, ry * cell, 0, 0, Math.PI * 2);
      if (solido) { ctx.fillStyle = "rgba(3,8,12,0.94)"; ctx.fill(); }
      if (fill > 0) { ctx.fillStyle = `rgba(${accent},${fill})`; ctx.fill(); }
      if (a > 0.02) { ctx.strokeStyle = `rgba(${accent},${a})`; ctx.lineWidth = esp * w; ctx.stroke(); }
    },
    /** Ponto miúdo — pingo de chuva, faísca, pixel solto. */
    ponto(p, { a = 0.9, r = 0.6 } = {}) {
      if (a <= 0.02) return;
      ctx.beginPath();
      ctx.arc(X(p), Y(p), r * cell, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${accent},${a})`;
      ctx.fill();
    },
    /**
     * Um ser, a partir do desenho em "#": silhueta cheia + contorno.
     *
     * O contorno sai das bordas EXTERNAS (uma aresta só entra se o vizinho daquele lado estiver
     * apagado). Traçar retângulo por retângulo desenharia também as divisas internas e o bicho
     * viria quadriculado.
     *
     * `lean` inclina o corpo inteiro em torno dos PÉS: positivo curva pra frente (varrer, colher,
     * regar), negativo joga pra trás (olhar as estrelas, beber). São sete desenhos parados
     * virando uma pessoa que se curva e se agacha, sem precisar de um desenho pra cada gesto.
     *
     * O eixo fica nos pés e não na cintura porque girar só o tronco abre uma fresta na barriga:
     * as duas metades se separam, o contorno de uma some atrás do preenchimento da outra e ela
     * aparece partida ao meio. Girando inteira não há emenda, e a leitura é a mesma.
     *
     * `agacha` (0 a 1) encolhe ela no mesmo eixo. É diferente de descer a figura inteira: quem
     * desce afunda no chão, quem encolhe fica de cócoras com os pés plantados.
     */
    figura(rows, ox, oy, { flip = false, fundo = "rgba(3,8,12,0.92)", a = 1, w = 1, lean = 0, agacha = 0 } = {}) {
      const larg = rows[0].length;
      const aceso = (r, c) => r >= 0 && r < rows.length && c >= 0 && c < larg && rows[r][c] === "#";
      const col = (c) => (flip ? larg - 1 - c : c);
      const dobra = Math.abs(lean) > 0.01 || agacha > 0.01;
      const ex = (ox + larg / 2 - camX) * cell;          // eixo: o meio dos pés
      const ey = (oy + rows.length - camY) * cell;
      const px = (c) => (ox + col(c) - camX) * cell - (dobra ? ex : 0);
      const py = (r) => (oy + r - camY) * cell - (dobra ? ey : 0);

      const corpo = new Path2D();
      const borda = new Path2D();
      for (let r = 0; r < rows.length; r++)
        for (let c = 0; c < larg; c++) {
          if (!aceso(r, c)) continue;
          const x = px(c); // `col()` já espelhou a coluna: isto é sempre a borda esquerda
          const y = py(r);
          corpo.rect(x, y, cell, cell);
          const viz = flip ? { esq: c + 1, dir: c - 1 } : { esq: c - 1, dir: c + 1 };
          if (!aceso(r - 1, c)) { borda.moveTo(x, y); borda.lineTo(x + cell, y); }
          if (!aceso(r + 1, c)) { borda.moveTo(x, y + cell); borda.lineTo(x + cell, y + cell); }
          if (!aceso(r, viz.esq)) { borda.moveTo(x, y); borda.lineTo(x, y + cell); }
          if (!aceso(r, viz.dir)) { borda.moveTo(x + cell, y); borda.lineTo(x + cell, y + cell); }
        }

      if (dobra) {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(flip ? -lean : lean);
        if (agacha > 0.01) ctx.scale(1, 1 - agacha);
      }
      ctx.fillStyle = fundo;
      ctx.fill(corpo);
      ctx.strokeStyle = `rgba(${accent},${a})`;
      ctx.lineWidth = esp * w;
      ctx.lineJoin = "round";
      ctx.stroke(borda);
      if (dobra) ctx.restore();
    },
  };
  return P;
}

// ---------- peças de construção ----------

const cantos = (tx, ty, w, d, h = 0) => [iso(tx, ty, h), iso(tx + w, ty, h), iso(tx + w, ty + d, h), iso(tx, ty + d, h)];

/**
 * Caixa isométrica em traço: o topo e as duas faces da frente.
 *
 * `solido` tampa o fundo antes de tingir — é o que impede de enxergar a cerca e as árvores
 * ATRAVÉS da parede da casa. Só o vidro (estufa) é desenhado sem isso.
 */
export function caixa(P, tx, ty, w, d, h, opts = {}) {
  volume(P, cantos(tx, ty, w, d, opts.base || 0), h, opts);
}

/**
 * A mesma caixa, a partir dos quatro cantos JÁ projetados. O dentro da casa tem origem e escala
 * próprias, então projeta por conta e entra por aqui — em vez de haver duas implementações de
 * caixa isométrica que envelhecem em separado.
 */
export function volume(P, [N, E, S, W], h, { luz = 0.09, traco = 0.85, solido = true } = {}) {
  const up = (p) => ({ x: p.x, y: p.y - h });
  // as três faces com brilhos diferentes — é o que faz o olho ler volume
  P.poli([W, S, up(S), up(W)], { fill: luz * 0.55, a: traco * 0.8, solido });
  P.poli([S, E, up(E), up(S)], { fill: luz, a: traco * 0.8, solido });
  P.poli([up(N), up(E), up(S), up(W)], { fill: luz * 1.6, a: traco, solido });
}

/** Telhado de quatro águas: quatro triângulos que sobem até a cumeeira. */
export function telhado(P, tx, ty, w, d, base, alt, { luz = 0.08, solido = true } = {}) {
  const [N, E, S, W] = cantos(tx, ty, w, d, base);
  const topo = iso(tx + w / 2, ty + d / 2, base + alt);
  // as águas de trás primeiro: assim as da frente as cobrem, e a cumeeira fica certa
  P.poli([N, E, topo], { fill: luz * 0.4, a: 0.5, solido });
  P.poli([N, W, topo], { fill: luz * 0.4, a: 0.5, solido });
  P.poli([W, S, topo], { fill: luz * 0.7, a: 0.85, solido });
  P.poli([S, E, topo], { fill: luz * 1.3, a: 0.85, solido });
}

/** Painel numa das faces da frente: porta, janela, vidro. */
function painel(P, p, larg, alt, { a = 0.9, fill = 0 } = {}) {
  const pts = [
    { x: p.x, y: p.y },
    { x: p.x - larg, y: p.y - larg / 2 },
    { x: p.x - larg, y: p.y - larg / 2 - alt },
    { x: p.x, y: p.y - alt },
  ];
  P.poli(pts, { a, fill });
}

// ---------- construções ----------

export function drawCasa(P, { tx, ty, w, d }, nivel, noite) {
  const h = casaAltura(nivel);
  caixa(P, tx, ty, w, d, h);
  telhado(P, tx - 0.5, ty - 0.5, w + 1, d + 1, h, 9);
  painel(P, iso(tx + w, ty + d * 0.72), 7, 14, { a: 0.95, fill: 0.1 });            // porta
  painel(P, iso(tx + w, ty + d * 0.3), 6, 8, { a: 0.9, fill: noite ? 0.55 : 0.06 }); // janela
  if (nivel >= 3) {
    P.linha([iso(tx, ty + d, h / 2), iso(tx + w, ty + d, h / 2)], { a: 0.4 });
    painel(P, iso(tx + w, ty + d * 0.6, h / 2 + 3), 6, 7, { a: 0.9, fill: noite ? 0.55 : 0.06 });
  }
}

export function drawChamine(P, { tx, ty, w, d }, nivel) {
  // nasce em cima da água do telhado, não no chão: antes era uma coluna inteira passando na
  // frente da casa
  const alto = casaAltura(nivel);
  caixa(P, tx + w - 2.2, ty + 0.6, 1.1, 1.1, 8, { luz: 0.12, base: alto + 4 });
  P.poli([iso(tx + w - 2.4, ty + 0.4, alto + 12), iso(tx + w - 0.9, ty + 0.4, alto + 12),
          iso(tx + w - 0.9, ty + 1.9, alto + 12), iso(tx + w - 2.4, ty + 1.9, alto + 12)],
         { a: 0.9, fill: 0.2, solido: true });
}

export function drawAntena(P, { tx, ty, w, d }, nivel) {
  const base = iso(tx + w / 2, ty + d / 2, casaAltura(nivel) + 8);
  const topo = { x: base.x, y: base.y - 13 };
  P.linha([base, topo], { a: 0.9 });
  for (let k = 0; k < 3; k++) {
    const y = base.y - 3 - k * 3.5;
    const meio = 4.5 - k;
    P.linha([{ x: base.x - meio, y }, { x: base.x + meio, y }], { a: 0.7, w: 0.8 });
  }
}

export function drawArvore(P, { tx, ty }) {
  const b = iso(tx + 1, ty + 1);
  const topo = { x: b.x, y: b.y - 12 };
  P.linha([{ x: b.x - 0.8, y: b.y }, topo], { a: 0.8, w: 1.3 });
  P.linha([{ x: b.x + 0.8, y: b.y }, topo], { a: 0.8, w: 1.3 });
  // copa: três bolhas sobrepostas, contorno fino e miolo quase transparente
  for (const [dx, dy, rx, ry] of [[-5.5, -14.5, 6, 4.5], [6, -14.5, 6, 4.5], [0, -20, 9, 6.5]])
    P.elipse(b.x + dx, b.y + dy, rx, ry, { a: 0.85, fill: 0.07, solido: true });
}

export function drawHorta(P, { tx, ty, w, d }) {
  P.poli(cantos(tx, ty, w, d), { a: 0.5, fill: 0.05 });
  for (let a = 0.6; a < w; a += 1.3)
    for (let b = 0.6; b < d; b += 1.3) {
      const p = iso(tx + a, ty + b);
      P.linha([p, { x: p.x, y: p.y - 4 }], { a: 0.75, w: 0.8 });
      P.linha([{ x: p.x, y: p.y - 2.5 }, { x: p.x - 1.6, y: p.y - 3.6 }], { a: 0.6, w: 0.7 });
      P.linha([{ x: p.x, y: p.y - 3.4 }, { x: p.x + 1.6, y: p.y - 4.6 }], { a: 0.6, w: 0.7 });
    }
}

export function drawCasinha(P, { tx, ty, w, d }) {
  caixa(P, tx, ty, w, d, 6);
  telhado(P, tx - 0.4, ty - 0.4, w + 0.8, d + 0.8, 6, 5);
  painel(P, iso(tx + w, ty + d * 0.5), 3, 4.5, { a: 0.95, fill: 0.16 });
}

export function drawVaral(P, { tx, ty, w }) {
  const a = iso(tx, ty);
  const b = iso(tx + w, ty);
  P.linha([a, { x: a.x, y: a.y - 13 }], { a: 0.85 });
  P.linha([b, { x: b.x, y: b.y - 13 }], { a: 0.85 });
  // a corda cede no meio
  const corda = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    corda.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - 12 + Math.sin(t * Math.PI) * 2 });
  }
  P.linha(corda, { a: 0.6, w: 0.7 });
  for (let k = 1; k <= 3; k++) {
    const p = corda[Math.round((10 * k) / 4)];
    P.poli([{ x: p.x - 1.6, y: p.y }, { x: p.x + 1.6, y: p.y }, { x: p.x + 1.6, y: p.y + 6 }, { x: p.x - 1.6, y: p.y + 6 }], { a: 0.7, fill: 0.06 });
  }
}

export function drawBanco(P, { tx, ty, w, d }) {
  caixa(P, tx, ty, w, d, 3, { luz: 0.08 });
  const a = iso(tx, ty, 3);
  const b = iso(tx + w, ty, 3);
  P.poli([a, b, { x: b.x, y: b.y - 5 }, { x: a.x, y: a.y - 5 }], { a: 0.7, fill: 0.05 });
}

export function drawCorreio(P, { tx, ty }, temCarta) {
  const p = iso(tx + 0.5, ty + 0.5);
  P.linha([p, { x: p.x, y: p.y - 8 }], { a: 0.8 });
  caixa(P, tx + 0.1, ty + 0.1, 0.8, 0.8, 12, { luz: 0.1 });
  if (temCarta) P.linha([{ x: p.x + 3, y: p.y - 12 }, { x: p.x + 3, y: p.y - 16 }, { x: p.x + 5.5, y: p.y - 15 }], { a: 0.95, w: 0.8 });
}

export function drawPoste(P, { tx, ty }, noite) {
  const p = iso(tx + 0.5, ty + 0.5);
  const topo = { x: p.x, y: p.y - 18 };
  P.linha([p, topo], { a: 0.8 });
  P.poli([{ x: topo.x - 2.5, y: topo.y }, { x: topo.x + 2.5, y: topo.y }, { x: topo.x + 1.5, y: topo.y - 3 }, { x: topo.x - 1.5, y: topo.y - 3 }], { a: 0.9, fill: noite ? 0.8 : 0.08 });
  if (noite) P.elipse(topo.x, topo.y + 1, 8, 5.5, { a: 0.12, fill: 0.03 });
}

export function drawRadio(P, { tx, ty }) {
  caixa(P, tx + 0.15, ty + 0.15, 0.7, 0.7, 6, { luz: 0.11 });
  const p = iso(tx + 0.5, ty + 0.5);
  P.elipse(p.x, p.y - 4, 1.6, 1.1, { a: 0.9 });
}

export function drawPortao(P, { tx, ty, w }) {
  const a = iso(tx, ty);
  const b = iso(tx + w, ty);
  P.linha([a, { x: a.x, y: a.y - 10 }], { a: 0.9 });
  P.linha([b, { x: b.x, y: b.y - 10 }], { a: 0.9 });
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    P.linha([{ x, y: y - 1.5 }, { x, y: y - 8.5 }], { a: 0.45, w: 0.7 });
  }
}

export function drawFlores(P, { tx, ty, w, d }) {
  P.poli(cantos(tx, ty, w, d), { a: 0.4, fill: 0.04 });
  for (let a = 0.5; a < w; a += 0.8)
    for (let b = 0.5; b < d; b += 0.8) {
      const p = iso(tx + a, ty + b);
      P.linha([p, { x: p.x, y: p.y - 3 }], { a: 0.5, w: 0.7 });
      P.elipse(p.x, p.y - 3.6, 0.7, 0.55, { a: 0.9, fill: 0.25 });
    }
}

export function drawMesa(P, { tx, ty, w, d }) {
  caixa(P, tx + 0.3, ty + 0.6, w - 0.6, d - 1.2, 6, { luz: 0.1 });
  caixa(P, tx + 0.3, ty, w - 0.6, 0.45, 3, { luz: 0.07 });
  caixa(P, tx + 0.3, ty + d - 0.45, w - 0.6, 0.45, 3, { luz: 0.07 });
}

export function drawChurras(P, { tx, ty, w, d }) {
  caixa(P, tx, ty, w, d, 8, { luz: 0.09 });
  caixa(P, tx + w - 0.9, ty + 0.1, 0.7, 0.7, 15, { luz: 0.1 });
}

export function drawBalanco(P, { tx, ty, w, d }) {
  const a = iso(tx, ty + d / 2);
  const b = iso(tx + w, ty + d / 2);
  const topoA = { x: a.x, y: a.y - 15 };
  const topoB = { x: b.x, y: b.y - 15 };
  P.linha([{ x: a.x - 2, y: a.y }, topoA, { x: a.x + 2, y: a.y }], { a: 0.8 });
  P.linha([{ x: b.x - 2, y: b.y }, topoB, { x: b.x + 2, y: b.y }], { a: 0.8 });
  P.linha([topoA, topoB], { a: 0.85 });
  const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  P.linha([{ x: meio.x - 3, y: meio.y - 15 }, { x: meio.x - 3, y: meio.y - 7 }], { a: 0.6, w: 0.7 });
  P.linha([{ x: meio.x + 3, y: meio.y - 15 }, { x: meio.x + 3, y: meio.y - 7 }], { a: 0.6, w: 0.7 });
  P.linha([{ x: meio.x - 4, y: meio.y - 7 }, { x: meio.x + 4, y: meio.y - 7 }], { a: 0.95, w: 1.2 });
}

export function drawPoco(P, { tx, ty, w, d }) {
  caixa(P, tx, ty, w, d, 4, { luz: 0.06 });
  const a = iso(tx + 0.3, ty + d / 2, 4);
  const b = iso(tx + w - 0.3, ty + d / 2, 4);
  P.linha([a, { x: a.x, y: a.y - 10 }], { a: 0.8 });
  P.linha([b, { x: b.x, y: b.y - 10 }], { a: 0.8 });
  telhado(P, tx - 0.4, ty - 0.4, w + 0.8, d + 0.8, 14, 4);
}

export function drawFogueira(P, { tx, ty, w, d }) {
  const c = iso(tx + w / 2, ty + d / 2);
  P.elipse(c.x, c.y, 6, 3.4, { a: 0.6 });
  for (let a = 0; a < 360; a += 60) {
    const r = (a * Math.PI) / 180;
    P.elipse(c.x + Math.cos(r) * 5.5, c.y + Math.sin(r) * 3, 1.1, 0.8, { a: 0.75, fill: 0.08 });
  }
}

export function drawOficina(P, { tx, ty, w, d }) {
  caixa(P, tx, ty, w, d, 12);
  telhado(P, tx - 0.4, ty - 0.4, w + 0.8, d + 0.8, 12, 6);
  painel(P, iso(tx + w, ty + d * 0.5), 5, 8, { a: 0.9, fill: 0.12 });
}

export function drawSolar(P, { tx, ty, w, d }) {
  const c = cantos(tx + 0.7, ty + 0.7, w - 1.4, d - 1.4, 17);
  P.poli(c, { a: 0.9, fill: 0.16, solido: true });
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    P.linha([
      { x: c[0].x + (c[3].x - c[0].x) * t, y: c[0].y + (c[3].y - c[0].y) * t },
      { x: c[1].x + (c[2].x - c[1].x) * t, y: c[1].y + (c[2].y - c[1].y) * t },
    ], { a: 0.35, w: 0.7 });
  }
}

export function drawEstufa(P, { tx, ty, w, d }) {
  caixa(P, tx, ty, w, d, 10, { luz: 0.05, traco: 0.6, solido: false });
  telhado(P, tx - 0.3, ty - 0.3, w + 0.6, d + 0.6, 10, 5, { luz: 0.04, solido: false });
  for (let a = 1; a < w; a += 1) {
    const p = iso(tx + a, ty + d);
    P.linha([p, { x: p.x, y: p.y - 10 }], { a: 0.3, w: 0.7 });
  }
}

export function drawPiscina(P, { tx, ty, w, d }, agora = 0) {
  P.poli(cantos(tx, ty, w, d), { a: 0.85 });
  P.poli(cantos(tx + 0.35, ty + 0.35, w - 0.7, d - 0.7, -1.5), { a: 0.5, fill: 0.09, solido: true });
  for (let k = 0; k < 3; k++) {
    const b = ty + 0.8 + ((k * 1.1 + ((agora / 2600) % 1)) % (d - 1.6));
    P.linha([iso(tx + 0.6, b, -1.5), iso(tx + w - 0.6, b, -1.5)], { a: 0.5, w: 0.7 });
  }
}

export function drawLago(P, { tx, ty, w, d }, agora = 0) {
  const c = iso(tx + w / 2, ty + d / 2);
  P.elipse(c.x, c.y, w * 4, d * 2, { a: 0.85, fill: 0.07, solido: true });
  for (let k = 0; k < 3; k++) {
    const t = ((agora / 3400) + k / 3) % 1;
    P.elipse(c.x, c.y, w * 4 * t, d * 2 * t, { a: 0.35 * (1 - t), w: 0.7 });
  }
}

export function drawMirante(P, { tx, ty, w, d }) {
  caixa(P, tx + 0.4, ty + 0.4, w - 0.8, d - 0.8, 20, { luz: 0.07 });
  const pl = cantos(tx - 0.4, ty - 0.4, w + 0.8, d + 0.8, 20);
  P.poli(pl, { a: 0.9, fill: 0.1, solido: true });
  const guarda = cantos(tx - 0.4, ty - 0.4, w + 0.8, d + 0.8, 25);
  P.poli(guarda, { a: 0.6, w: 0.8 });
  for (let i = 0; i < 4; i++) P.linha([pl[i], guarda[i]], { a: 0.6, w: 0.8 });
}

export function drawCerca(P, grid) {
  const lados = [[0, 0, grid, 0], [0, grid, grid, grid], [0, 0, 0, grid], [grid, 0, grid, grid]];
  for (const [ax, ay, bx, by] of lados) {
    const a = iso(ax, ay);
    const b = iso(bx, by);
    for (const h of [2.5, 5]) P.linha([{ x: a.x, y: a.y - h }, { x: b.x, y: b.y - h }], { a: 0.35, w: 0.7 });
    for (let i = 0; i <= 1; i += 1 / 12) {
      const x = a.x + (b.x - a.x) * i;
      const y = a.y + (b.y - a.y) * i;
      P.linha([{ x, y }, { x, y: y - 6 }], { a: 0.5, w: 0.7 });
    }
  }
}

/**
 * O chão. Aqui é onde a poluição morava: era uma grama pontilhada célula a célula, mais uma
 * malha de tiles inteira por cima. Agora é a borda do terreno e uns poucos tufos, feito mapa.
 */
export function drawTerreno(P, grid) {
  P.poli(cantos(0, 0, grid, grid), { a: 0.45, fill: 0.02 });
  P.poli(cantos(1, 1, grid - 2, grid - 2), { a: 0.1, w: 0.7 });
  for (let i = 0; i < 46; i++) {
    const tx = ((i * 7.3) % (grid - 2)) + 1;
    const ty = ((i * 11.7) % (grid - 2)) + 1;
    const p = iso(tx, ty);
    P.linha([{ x: p.x - 1, y: p.y }, { x: p.x - 0.4, y: p.y - 2 }], { a: 0.16, w: 0.7 });
    P.linha([{ x: p.x + 1, y: p.y }, { x: p.x + 0.4, y: p.y - 2.2 }], { a: 0.16, w: 0.7 });
  }
}

/** O caminho: duas margens contínuas, não cinquenta losangos soltos. */
export function drawCaminho(P, tiles) {
  if (!tiles.length) return;
  for (const [tx, ty] of tiles) P.poli(cantos(tx + 0.12, ty + 0.12, 0.76, 0.76), { a: 0.3, fill: 0.05, w: 0.7 });
}
