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


// ---------- a régua ----------
//
// A Lisa tem 23 células de altura e 14 de largura. TUDO aqui é medido por ela, e é essa régua
// que faltava: sem ela a casa saiu com a parede mais baixa que a moradora, a mesa virou um
// caixote e o poço ganhou um telhado maior que ele mesmo.
//
//   porta 20 · janela 10 · mesa 12 · banco 8 · parede 30 · árvore 48 · poste 26
//
// A outra lição: nada de traço solto pra coisa que tem espessura. Poste, tronco, perna de mesa e
// corrimão são desenhados com `barra` (um quadrilátero fino, cheio e contornado). Como linha de
// 1px eles sumiam e o objeto virava um rabisco.

const cantos = (tx, ty, w, d, h = 0) => [iso(tx, ty, h), iso(tx + w, ty, h), iso(tx + w, ty + d, h), iso(tx, ty + d, h)];

/** Direção, na tela, de cada uma das duas faces visíveis de uma caixa. */
export const DIR_DIR = { x: -1, y: 0.5 };   // face da direita: do canto leste pro sul
export const DIR_ESQ = { x: -1, y: -0.5 };  // face da esquerda: do canto sul pro oeste

/**
 * As aberturas de cada construção, num lugar só: o desenho usa, o mundo acende a janela da casa
 * quando a Lisa está dentro, e o teste confere que nenhuma passa do canto da parede.
 *
 * `face` é "dir" (do canto leste ao sul) ou "esq" (do sul ao oeste); `centro` é a posição do meio
 * da abertura ao longo da face, em TILES; `larg`/`alt`/`base` em células.
 */
export const ABERTURAS = {
  casa: [
    { face: "dir", centro: 6.2, larg: 9, alt: 20, base: 0, tipo: "porta" },
    { face: "dir", centro: 2.4, larg: 7, alt: 10, base: 9, luz: true },
    { face: "esq", centro: 6.1, larg: 7, alt: 10, base: 9, luz: true },
    { face: "esq", centro: 2.7, larg: 7, alt: 10, base: 9, luz: true },
  ],
  sobrado: [
    { face: "dir", centro: 2.6, larg: 7, alt: 10, luz: true },
    { face: "esq", centro: 4.5, larg: 7, alt: 10, luz: true },
  ],
  oficina: [
    { face: "dir", centro: 2.0, larg: 12, alt: 19, base: 0, tipo: "porta" },
    { face: "esq", centro: 1.0, larg: 6, alt: 8, base: 11 },
  ],
};

/** Quanto uma abertura de `larg` células ocupa ao longo da face, em tiles. */
const emTiles = (larg) => larg / 8;

/** A abertura cabe na parede? O teste do node usa isto. */
export const abertaDentroDaParede = (lado, { centro, larg }) =>
  centro - emTiles(larg) >= -1e-9 && centro + emTiles(larg) <= lado + 1e-9;

/**
 * Abertura numa das faces, posicionada em TILES ao longo dela.
 *
 * O centro é PRESO dentro da parede. Sem isso a porta da casa começava a 78% da face e terminava
 * depois do canto, e a da oficina passava de longe: a abertura saía torta, dobrada pra fora da
 * parede — que é exatamente o que fazia a entrada da casinha da Nala parecer entortada.
 */
export function aberturaNaFace(P, { tx, ty, w, d }, cfg, extra = {}) {
  const dir = cfg.face === "dir";
  const lado = dir ? d : w;
  const meia = emTiles(cfg.larg);
  const c = Math.min(lado - meia, Math.max(meia, cfg.centro));
  const base = cfg.base || 0;
  const p = dir ? iso(tx + w, ty + c - meia, base) : iso(tx + c + meia, ty + d, base);
  abertura(P, p, dir ? DIR_DIR : DIR_ESQ, cfg.larg, cfg.alt, { tipo: cfg.tipo, ...extra });
}

/** A janela que o terreno acende quando ela está lá dentro. */
export const janelaDaCasa = () => ABERTURAS.casa.find((j) => j.luz);

/**
 * Barra com espessura: um quadrilátero fino em vez de um traço.
 *
 * É o que faz um poste parecer um poste. Desenhado como `P.linha`, um mastro de 26 células vira
 * um fio de cabelo que some contra o fundo e leva o objeto junto.
 */
export function barra(P, a, b, larg = 1.4, opts = {}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const n = Math.hypot(dx, dy) || 1;
  const px = (-dy / n) * (larg / 2);
  const py = (dx / n) * (larg / 2);
  P.poli([
    { x: a.x + px, y: a.y + py }, { x: b.x + px, y: b.y + py },
    { x: b.x - px, y: b.y - py }, { x: a.x - px, y: a.y - py },
  ], { a: 0.9, fill: 0.14, solido: true, ...opts });
}

/** Cilindro em pé: poço, barril, tronco grosso. */
export function cilindro(P, c, rx, ry, h, { luz = 0.1, a = 0.9 } = {}) {
  P.poli([
    { x: c.x - rx, y: c.y }, { x: c.x + rx, y: c.y },
    { x: c.x + rx, y: c.y - h }, { x: c.x - rx, y: c.y - h },
  ], { a: 0, fill: luz, solido: true });
  P.linha([{ x: c.x - rx, y: c.y }, { x: c.x - rx, y: c.y - h }], { a });
  P.linha([{ x: c.x + rx, y: c.y }, { x: c.x + rx, y: c.y - h }], { a });
  P.elipse(c.x, c.y, rx, ry, { a: a * 0.5, w: 0.8 });
  P.elipse(c.x, c.y - h, rx, ry, { a, fill: luz * 1.7, solido: true });
}

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

/** Telhado de quatro águas: quatro triângulos que sobem até um bico. Bom pra torre e poço. */
export function telhado(P, tx, ty, w, d, base, alt, { luz = 0.08, solido = true } = {}) {
  const [N, E, S, W] = cantos(tx, ty, w, d, base);
  const topo = iso(tx + w / 2, ty + d / 2, base + alt);
  // as águas de trás primeiro: assim as da frente as cobrem, e a cumeeira fica certa
  P.poli([N, E, topo], { fill: luz * 0.4, a: 0.5, solido });
  P.poli([N, W, topo], { fill: luz * 0.4, a: 0.5, solido });
  P.poli([W, S, topo], { fill: luz * 0.7, a: 0.85, solido });
  P.poli([S, E, topo], { fill: luz * 1.3, a: 0.85, solido });
}

/**
 * Telhado de DUAS águas, com cumeeira e empenas triangulares. É este que diz "casa": o de quatro
 * águas vira um bico de pirâmide e o prédio fica com cara de tenda de circo.
 */
export function duasAguas(P, tx, ty, w, d, base, alt, { luz = 0.08 } = {}) {
  const [N, E, S, W] = cantos(tx, ty, w, d, base);
  const R1 = iso(tx, ty + d / 2, base + alt);
  const R2 = iso(tx + w, ty + d / 2, base + alt);
  P.poli([N, E, R2, R1], { fill: luz * 0.45, a: 0.5, solido: true });   // água de trás
  P.poli([N, W, R1], { fill: luz * 0.5, a: 0.7, solido: true });        // empenas
  P.poli([E, S, R2], { fill: luz * 1.1, a: 0.8, solido: true });
  P.poli([W, S, R2, R1], { fill: luz * 1.5, a: 0.9, solido: true });    // água da frente
  P.linha([R1, R2], { a: 0.95, w: 1.1 });                               // cumeeira
}

/**
 * Abertura (porta ou janela) NA face, não flutuando na frente dela.
 *
 * `dir` é a direção da parede na tela. A versão anterior usava sempre a mesma direção, então a
 * porta da face direita saía desenhada no plano da face esquerda: um losango torto pousado em
 * cima da casa, que era parte do motivo de nada ali se reconhecer.
 */
export function abertura(P, p, dir, larg, alt, { tipo = "janela", acesa = false } = {}) {
  const desloca = (t, dy = 0) => ({ x: p.x + dir.x * t, y: p.y + dir.y * t - dy });
  P.poli([desloca(0), desloca(larg), desloca(larg, alt), desloca(0, alt)], { a: 0.95, fill: 0.06, solido: true });
  const m = larg * 0.16;
  const base = tipo === "porta" ? 0 : m;
  P.poli([desloca(m, base), desloca(larg - m, base), desloca(larg - m, alt - m), desloca(m, alt - m)],
    { a: 0.6, fill: acesa ? 0.7 : 0.1 });
  if (tipo === "porta") {
    // maçaneta: é o detalhe miúdo que diz "isto se abre"
    const q = desloca(larg * 0.78, alt * 0.45);
    P.elipse(q.x, q.y, 0.9, 0.9, { a: 0.95, fill: 0.5 });
  } else {
    P.linha([desloca(larg / 2, m), desloca(larg / 2, alt - m)], { a: 0.7, w: 0.8 });
    P.linha([desloca(m, alt / 2), desloca(larg - m, alt / 2)], { a: 0.7, w: 0.8 });
  }
}

// ---------- construções ----------

/** Altura da parede da casa. A chaminé e a antena se penduram nela, então mora num lugar só. */
export const casaAltura = (nivel) => (nivel >= 3 ? 52 : nivel >= 2 ? 34 : 30);

export function drawCasa(P, { tx, ty, w, d }, nivel, noite) {
  const h = casaAltura(nivel);
  caixa(P, tx, ty, w, d, h);
  duasAguas(P, tx - 0.8, ty - 0.8, w + 1.6, d + 1.6, h, 16);
  const casa = { tx, ty, w, d };
  if (nivel >= 3) {
    // faixa entre os dois pavimentos, e as janelas de cima
    P.linha([iso(tx, ty + d, h / 2), iso(tx + w, ty + d, h / 2), iso(tx + w, ty, h / 2)], { a: 0.45, w: 0.9 });
    for (const j of ABERTURAS.sobrado) aberturaNaFace(P, casa, { ...j, base: h / 2 + 6 }, { acesa: noite });
  }
  for (const j of ABERTURAS.casa) aberturaNaFace(P, casa, j, { acesa: j.luz && noite });
  caixa(P, tx + w, ty + 5.1, 0.6, 1.6, 2, { luz: 0.12 }); // degrau da porta
}

export function drawChamine(P, { tx, ty, w }, nivel) {
  // nasce em cima da água do telhado, não no chão: antes era uma coluna inteira passando na
  // frente da casa
  const alto = casaAltura(nivel);
  caixa(P, tx + w - 2.4, ty + 0.8, 1.3, 1.3, 12, { luz: 0.12, base: alto + 6 });
  P.poli(cantos(tx + w - 2.7, ty + 0.5, 1.9, 1.9, alto + 18), { a: 0.9, fill: 0.22, solido: true });
}

export function drawAntena(P, { tx, ty, w, d }, nivel) {
  const base = iso(tx + w / 2, ty + d / 2, casaAltura(nivel) + 15);
  barra(P, base, { x: base.x, y: base.y - 16 }, 1.1);
  for (let k = 0; k < 3; k++) {
    const y = base.y - 4 - k * 4;
    const meio = 6 - k * 1.2;
    barra(P, { x: base.x - meio, y }, { x: base.x + meio, y }, 0.9);
  }
}

/**
 * Árvore: tronco GROSSO subindo do chão até dentro da copa, dois galhos, e a copa em três bolhas
 * centradas nele. Antes o tronco eram duas linhas divergindo e a copa ficava deslocada pro lado —
 * de longe parecia um balão amarrado num arame.
 */
export function drawArvore(P, { tx, ty, w = 2, d = 2 }) {
  const b = iso(tx + w / 2, ty + d / 2);
  barra(P, b, { x: b.x, y: b.y - 21 }, 4.6, { fill: 0.1 });
  barra(P, { x: b.x, y: b.y - 15 }, { x: b.x - 8, y: b.y - 23 }, 2.4);
  barra(P, { x: b.x, y: b.y - 17 }, { x: b.x + 8, y: b.y - 25 }, 2.4);
  // a copa engole o alto do tronco: solta em cima dele, a árvore vira pirulito
  for (const [dx, dy, r] of [[-10, -25, 10], [10, -27, 10], [0, -34, 13]])
    P.elipse(b.x + dx, b.y + dy, r, r * 0.8, { a: 0.85, fill: 0.07, solido: true });
}

/**
 * Horta: canteiro elevado com fileiras de pés de alface — caule curto e três folhas. Antes eram
 * riscos soltos num losango, que de longe viravam mato.
 */
export function drawHorta(P, { tx, ty, w, d }) {
  caixa(P, tx, ty, w, d, 3, { luz: 0.05 });
  for (let a = 0.7; a < w; a += 1.2)
    for (let b = 0.6; b < d; b += 1.1) {
      const p = iso(tx + a, ty + b, 3);
      barra(P, p, { x: p.x, y: p.y - 3.5 }, 1, { fill: 0.1 });
      P.elipse(p.x - 2.2, p.y - 4, 1.7, 1.3, { a: 0.8, fill: 0.1, solido: true });
      P.elipse(p.x + 2.2, p.y - 4, 1.7, 1.3, { a: 0.8, fill: 0.1, solido: true });
      P.elipse(p.x, p.y - 5, 2.4, 1.8, { a: 0.9, fill: 0.14, solido: true });
    }
}

/**
 * Casinha da Nala: pequena, telhado de duas águas e a entrada em ARCO — é o arco que diz que é
 * de cachorro, e não um galpão em miniatura.
 */
export function drawCasinha(P, { tx, ty, w, d }) {
  caixa(P, tx, ty, w, d, 10);
  duasAguas(P, tx - 0.4, ty - 0.4, w + 0.8, d + 0.8, 10, 8);
  // a entrada é centrada na parede e arredondada de verdade: fora de centro ela terminava depois
  // do canto e saía torta, e como pentágono de bico o arco não lia
  const larg = 7;
  const p = iso(tx + w, ty + (d - larg / 4) / 2);
  const desloca = (t, dy = 0) => ({ x: p.x + DIR_DIR.x * t, y: p.y + DIR_DIR.y * t - dy });
  const arco = [desloca(0), desloca(larg)];
  for (let i = 0; i <= 8; i++) {
    const t = 1 - i / 8;
    arco.push(desloca(larg * t, 4.5 + Math.sin(t * Math.PI) * 4));
  }
  P.poli(arco, { a: 0.95, fill: 0.3, solido: true });
}

/**
 * Varal: dois postes em T com a corda entre as travessas, e as peças penduradas com prendedor.
 *
 * `cheio` é o estado de verdade. Quando ela recolhe a roupa por causa da chuva, a roupa some do
 * varal — antes ela recolhia e as peças continuavam lá, o que fazia a cena inteira perder o
 * sentido.
 */
export function drawVaral(P, { tx, ty, w }, cheio = true) {
  const a = iso(tx, ty + 0.5);
  const b = iso(tx + w, ty + 0.5);
  for (const p of [a, b]) {
    barra(P, p, { x: p.x, y: p.y - 22 }, 1.8);
    barra(P, { x: p.x - 5, y: p.y - 21 }, { x: p.x + 5, y: p.y - 21 }, 1.4);
  }
  const corda = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    corda.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - 21 + Math.sin(t * Math.PI) * 2.5 });
  }
  P.linha(corda, { a: 0.65, w: 0.8 });
  if (!cheio) return;
  for (let k = 1; k <= 3; k++) {
    const p = corda[k * 3];
    P.linha([{ x: p.x - 1.6, y: p.y - 1 }, { x: p.x - 1.6, y: p.y + 1 }], { a: 0.9, w: 0.9 }); // prendedor
    P.linha([{ x: p.x + 1.6, y: p.y - 1 }, { x: p.x + 1.6, y: p.y + 1 }], { a: 0.9, w: 0.9 });
    // camiseta: ombro largo e manga, que é o que faz ler como roupa e não como bandeirinha
    P.poli([
      { x: p.x - 2.6, y: p.y + 0.5 }, { x: p.x + 2.6, y: p.y + 0.5 },
      { x: p.x + 3.8, y: p.y + 2.6 }, { x: p.x + 2.4, y: p.y + 3.4 }, { x: p.x + 2.4, y: p.y + 9 },
      { x: p.x - 2.4, y: p.y + 9 }, { x: p.x - 2.4, y: p.y + 3.4 }, { x: p.x - 3.8, y: p.y + 2.6 },
    ], { a: 0.9, fill: 0.1, solido: true });
  }
}

/** Banco: assento, encosto com ripas e quatro pés — não um caixote. */
export function drawBanco(P, { tx, ty, w, d }) {
  for (const [a, b] of [[0.15, 0.2], [w - 0.15, 0.2], [0.15, d - 0.2], [w - 0.15, d - 0.2]]) {
    const p = iso(tx + a, ty + b);
    barra(P, p, { x: p.x, y: p.y - 8 }, 1.3);
  }
  caixa(P, tx, ty, w, d, 1.6, { base: 8, luz: 0.12 });
  const e1 = iso(tx + 0.2, ty);
  const e2 = iso(tx + w - 0.2, ty);
  barra(P, { x: e1.x, y: e1.y - 8 }, { x: e1.x, y: e1.y - 17 }, 1.3);
  barra(P, { x: e2.x, y: e2.y - 8 }, { x: e2.x, y: e2.y - 17 }, 1.3);
  for (const k of [11, 14.5]) barra(P, { x: e1.x, y: e1.y - k }, { x: e2.x, y: e2.y - k }, 1.5);
}

/**
 * Caixa de correio: poste, caixa de topo ARREDONDADO e a bandeirinha, que sobe quando chega
 * carta. São as três coisas juntas que fazem reconhecer uma caixa de correio.
 */
export function drawCorreio(P, { tx, ty }, temCarta) {
  const p = iso(tx + 0.5, ty + 0.5);
  barra(P, p, { x: p.x, y: p.y - 15 }, 1.8);
  const c = { x: p.x, y: p.y - 15 };
  P.poli([
    { x: c.x - 4.5, y: c.y }, { x: c.x + 4.5, y: c.y }, { x: c.x + 4.5, y: c.y - 3.5 },
    { x: c.x + 3, y: c.y - 6 }, { x: c.x - 3, y: c.y - 6 }, { x: c.x - 4.5, y: c.y - 3.5 },
  ], { a: 0.95, fill: 0.14, solido: true });
  P.linha([{ x: c.x - 4.5, y: c.y - 3.5 }, { x: c.x + 4.5, y: c.y - 3.5 }], { a: 0.4, w: 0.7 });
  barra(P, { x: c.x + 4.5, y: c.y - 1 }, { x: c.x + 4.5, y: c.y - 1 - (temCarta ? 7 : 2) }, 1);
  if (temCarta) {
    P.poli([{ x: c.x + 5, y: c.y - 8 }, { x: c.x + 9.5, y: c.y - 8 }, { x: c.x + 9.5, y: c.y - 4.8 }, { x: c.x + 5, y: c.y - 4.8 }],
      { a: 0.95, fill: 0.4, solido: true });
    P.linha([{ x: c.x + 5, y: c.y - 8 }, { x: c.x + 7.2, y: c.y - 6.2 }, { x: c.x + 9.5, y: c.y - 8 }], { a: 0.9, w: 0.7 });
  }
}

/**
 * Poste de luz: base, mastro e o BRAÇO CURVO com a luminária pendurada — é a curva que diz
 * "iluminação pública" em vez de "vara fincada no chão".
 */
export function drawPoste(P, { tx, ty }, noite) {
  const p = iso(tx + 0.5, ty + 0.5);
  P.elipse(p.x, p.y, 3, 1.6, { a: 0.7, fill: 0.12, solido: true });
  barra(P, p, { x: p.x, y: p.y - 26 }, 2);
  const arco = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    arco.push({ x: p.x + t * 7, y: p.y - 26 - Math.sin(t * Math.PI * 0.5) * 3 });
  }
  P.linha(arco, { a: 0.9, w: 1.6 });
  const l = arco[6];
  P.poli([{ x: l.x - 3.2, y: l.y + 1 }, { x: l.x + 3.2, y: l.y + 1 }, { x: l.x + 2, y: l.y + 4.6 }, { x: l.x - 2, y: l.y + 4.6 }],
    { a: 0.95, fill: noite ? 0.85 : 0.1, solido: true });
  if (noite) P.elipse(l.x, p.y, 13, 7, { a: 0.14, fill: 0.035 });
}

/** Caixa de som: gabinete com duas cúpulas (grave e agudo) na face da frente. */
export function drawRadio(P, { tx, ty }) {
  caixa(P, tx + 0.05, ty + 0.05, 0.9, 0.7, 11, { luz: 0.09 });
  const f = iso(tx + 0.95, ty + 0.4, 0);
  const meio = (t, dy) => ({ x: f.x + DIR_DIR.x * t, y: f.y + DIR_DIR.y * t - dy });
  const g = meio(2.8, 3.5);
  P.elipse(g.x, g.y, 2.3, 2.3, { a: 0.95, fill: 0.2 });
  const t2 = meio(2.8, 8);
  P.elipse(t2.x, t2.y, 1.2, 1.2, { a: 0.95, fill: 0.3 });
}

/**
 * Portão: dois pilares e a folha com barras verticais mais a DIAGONAL de contraventamento — a
 * diagonal é o que separa um portão de um pedaço de cerca.
 */
export function drawPortao(P, { tx, ty, w }) {
  const a = iso(tx, ty + 0.5);
  const b = iso(tx + w, ty + 0.5);
  barra(P, a, { x: a.x, y: a.y - 18 }, 2.6);
  barra(P, b, { x: b.x, y: b.y - 18 }, 2.6);
  const alto = (p, k) => ({ x: p.x, y: p.y - k });
  for (const k of [4, 13]) barra(P, alto(a, k), alto(b, k), 1.4);
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    barra(P, { x, y: y - 3 }, { x, y: y - 14 }, 1.1);
  }
  barra(P, alto(a, 4.5), alto(b, 12.5), 1.1, { a: 0.6 });
}

/** Canteiro de flores: caule, miolo e pétalas em volta. Um ponto solto não vira flor. */
export function drawFlores(P, { tx, ty, w, d }) {
  caixa(P, tx, ty, w, d, 2, { luz: 0.04 });
  for (let a = 0.45; a < w; a += 0.75)
    for (let b = 0.45; b < d; b += 0.75) {
      const p = iso(tx + a, ty + b, 2);
      barra(P, p, { x: p.x, y: p.y - 5 }, 0.8, { fill: 0.08 });
      const c = { x: p.x, y: p.y - 6.4 };
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2;
        P.elipse(c.x + Math.cos(ang) * 1.5, c.y + Math.sin(ang) * 1.2, 1.1, 0.9, { a: 0.85, fill: 0.16, solido: true });
      }
      P.elipse(c.x, c.y, 0.9, 0.8, { a: 0.95, fill: 0.55, solido: true });
    }
}

/** Mesa de piquenique: tampo, dois bancos corridos e pernas em X — o X é a assinatura dela. */
export function drawMesa(P, { tx, ty, w, d }) {
  for (const bx of [tx + 0.5, tx + w - 0.5]) {
    const p1 = iso(bx, ty + 0.4);
    const p2 = iso(bx, ty + d - 0.4);
    barra(P, { x: p1.x - 4, y: p1.y }, { x: p2.x + 1, y: p2.y - 12 }, 1.4);
    barra(P, { x: p2.x + 4, y: p2.y }, { x: p1.x - 1, y: p1.y - 12 }, 1.4);
  }
  caixa(P, tx + 0.15, ty - 0.1, w - 0.3, 0.5, 1.4, { base: 7, luz: 0.09 });
  caixa(P, tx + 0.15, ty + d - 0.4, w - 0.3, 0.5, 1.4, { base: 7, luz: 0.09 });
  caixa(P, tx + 0.15, ty + 0.55, w - 0.3, d - 1.1, 1.8, { base: 12, luz: 0.13 });
}

/** Churrasqueira: cuba sobre pernas, GRELHA à mostra no topo e chaminé atrás. */
export function drawChurras(P, { tx, ty, w, d }) {
  for (const [a, b] of [[0.3, 0.3], [w - 0.3, 0.3], [0.3, d - 0.3], [w - 0.3, d - 0.3]]) {
    const p = iso(tx + a, ty + b);
    barra(P, p, { x: p.x, y: p.y - 9 }, 1.2);
  }
  caixa(P, tx + w - 0.85, ty + 0.2, 0.6, 0.6, 11, { base: 15, luz: 0.12 }); // chaminé, atrás
  caixa(P, tx + 0.15, ty + 0.15, w - 0.3, d - 0.3, 6, { base: 9, luz: 0.09 });
  const [N, E, S, W] = cantos(tx + 0.15, ty + 0.15, w - 0.3, d - 0.3, 15);
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    P.linha([
      { x: N.x + (W.x - N.x) * t, y: N.y + (W.y - N.y) * t },
      { x: E.x + (S.x - E.x) * t, y: E.y + (S.y - E.y) * t },
    ], { a: 0.75, w: 0.8 });
  }
}

/** Balanço: dois pórticos em A bem abertos, viga no topo, duas correntes e o assento. */
export function drawBalanco(P, { tx, ty, w, d }) {
  const alto = 20;
  const portico = (px) => {
    const f = iso(px, ty + 0.2);
    const t = iso(px, ty + d - 0.2);
    const cume = { x: (f.x + t.x) / 2, y: (f.y + t.y) / 2 - alto };
    barra(P, f, cume, 1.6);
    barra(P, t, cume, 1.6);
    return cume;
  };
  const c1 = portico(tx + 0.3);
  const c2 = portico(tx + w - 0.3);
  barra(P, c1, c2, 1.8);
  const m = { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };
  for (const dx of [-4.5, 4.5]) barra(P, { x: m.x + dx, y: m.y }, { x: m.x + dx, y: m.y + 12 }, 1);
  P.poli([{ x: m.x - 6.5, y: m.y + 12 }, { x: m.x + 6.5, y: m.y + 12 }, { x: m.x + 6.5, y: m.y + 14 }, { x: m.x - 6.5, y: m.y + 14 }],
    { a: 0.95, fill: 0.25, solido: true });
}

/** Poço: cilindro de pedra, dois montantes, telhadinho do tamanho dele, manivela e balde. */
export function drawPoco(P, { tx, ty, w, d }) {
  const c = iso(tx + w / 2, ty + d / 2);
  cilindro(P, c, 7.5, 3.8, 9, { luz: 0.08 });
  const e = { x: c.x - 6, y: c.y - 9 };
  const f = { x: c.x + 6, y: c.y - 9 };
  barra(P, e, { x: e.x, y: e.y - 10 }, 1.6);
  barra(P, f, { x: f.x, y: f.y - 10 }, 1.6);
  duasAguas(P, tx - 0.15, ty - 0.15, w + 0.3, d + 0.3, 19, 5);
  barra(P, { x: e.x, y: e.y - 8 }, { x: f.x, y: f.y - 8 }, 2);                                  // tambor
  barra(P, { x: f.x, y: f.y - 8 }, { x: f.x + 3.5, y: f.y - 5.5 }, 1.1);                        // manivela
  P.linha([{ x: c.x, y: c.y - 17 }, { x: c.x, y: c.y - 12 }], { a: 0.6, w: 0.7 });
  P.poli([{ x: c.x - 2.4, y: c.y - 12 }, { x: c.x + 2.4, y: c.y - 12 }, { x: c.x + 1.8, y: c.y - 8 }, { x: c.x - 1.8, y: c.y - 8 }],
    { a: 0.9, fill: 0.14, solido: true });
}

/** Fogueira: anel de pedras e a lenha cruzada em tenda. */
export function drawFogueira(P, { tx, ty, w, d }) {
  const c = iso(tx + w / 2, ty + d / 2);
  for (let a = 0; a < 360; a += 45) {
    const r = (a * Math.PI) / 180;
    P.elipse(c.x + Math.cos(r) * 7, c.y + Math.sin(r) * 3.6, 1.6, 1.1, { a: 0.8, fill: 0.1, solido: true });
  }
  for (const dx of [-4, -1.5, 1.5, 4]) barra(P, { x: c.x + dx * 1.4, y: c.y - 0.5 }, { x: c.x - dx * 0.5, y: c.y - 11 }, 1.5);
}

/** Oficina: galpão de porta dupla larga — é a porta que diz que ali entra ferramenta, não gente. */
export function drawOficina(P, { tx, ty, w, d }) {
  caixa(P, tx, ty, w, d, 26);
  duasAguas(P, tx - 0.6, ty - 0.6, w + 1.2, d + 1.2, 26, 11);
  const of = { tx, ty, w, d };
  for (const j of ABERTURAS.oficina) aberturaNaFace(P, of, j);
  // a fresta entre as duas folhas: é o que diz que a porta é dupla, de galpão
  const porta = ABERTURAS.oficina[0];
  const m = iso(tx + w, ty + porta.centro, 0);
  P.linha([m, { x: m.x, y: m.y - porta.alt }], { a: 0.8, w: 0.9 });
}

/** Painel solar: moldura inclinada no telhado da oficina, com as células marcadas. */
export function drawSolar(P, { tx, ty, w, d }) {
  const c = [iso(tx + 0.8, ty + 0.8, 30), iso(tx + w - 0.8, ty + 0.8, 34), iso(tx + w - 0.8, ty + d - 0.8, 30), iso(tx + 0.8, ty + d - 0.8, 26)];
  P.poli(c, { a: 0.95, fill: 0.18, solido: true });
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    P.linha([
      { x: c[0].x + (c[3].x - c[0].x) * t, y: c[0].y + (c[3].y - c[0].y) * t },
      { x: c[1].x + (c[2].x - c[1].x) * t, y: c[1].y + (c[2].y - c[1].y) * t },
    ], { a: 0.45, w: 0.7 });
    P.linha([
      { x: c[0].x + (c[1].x - c[0].x) * t, y: c[0].y + (c[1].y - c[0].y) * t },
      { x: c[3].x + (c[2].x - c[3].x) * t, y: c[3].y + (c[2].y - c[3].y) * t },
    ], { a: 0.45, w: 0.7 });
  }
}

/**
 * Estufa: a única transparente de propósito — as ripas aparecendo através do vidro são o que diz
 * que aquilo é vidro, e não parede.
 */
export function drawEstufa(P, { tx, ty, w, d }) {
  caixa(P, tx, ty, w, d, 18, { luz: 0.04, traco: 0.55, solido: false });
  duasAguas(P, tx - 0.3, ty - 0.3, w + 0.6, d + 0.6, 18, 8, { luz: 0.03 });
  for (let a = 1; a < w; a += 1) {
    const p = iso(tx + a, ty + d);
    P.linha([p, { x: p.x, y: p.y - 18 }], { a: 0.35, w: 0.8 });
  }
  for (let b = 1; b < d; b += 1) {
    const p = iso(tx + w, ty + b);
    P.linha([p, { x: p.x, y: p.y - 18 }], { a: 0.35, w: 0.8 });
  }
}

/** Piscina: borda elevada, água rebaixada com ondulação e a escadinha de mão. */
export function drawPiscina(P, { tx, ty, w, d }, agora = 0) {
  caixa(P, tx, ty, w, d, 2.5, { luz: 0.06 });
  P.poli(cantos(tx + 0.4, ty + 0.4, w - 0.8, d - 0.8, 1), { a: 0.6, fill: 0.22, solido: true });
  for (let k = 0; k < 3; k++) {
    const b = ty + 0.9 + ((k * 1.2 + ((agora / 2600) % 1)) % (d - 1.8));
    P.linha([iso(tx + 0.7, b, 1), iso(tx + w - 0.7, b, 1)], { a: 0.45, w: 0.7 });
  }
  const e = iso(tx + w - 0.5, ty + 0.9, 2.5);
  for (const dx of [-2.5, 2.5]) {
    const arco = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      arco.push({ x: e.x + dx, y: e.y - Math.sin(t * Math.PI * 0.85) * 10 - t * 1 });
    }
    P.linha(arco, { a: 0.9, w: 1.6 });
  }
  for (const k of [4, 8]) barra(P, { x: e.x - 3, y: e.y - k }, { x: e.x + 3, y: e.y - k }, 1);
}

/** Lago: água, ondas e os juncos na margem — sem os juncos vira uma poça. */
export function drawLago(P, { tx, ty, w, d }, agora = 0) {
  const c = iso(tx + w / 2, ty + d / 2);
  P.elipse(c.x, c.y, w * 4, d * 2, { a: 0.85, fill: 0.07, solido: true });
  for (let k = 0; k < 3; k++) {
    const t = ((agora / 3400) + k / 3) % 1;
    P.elipse(c.x, c.y, w * 4 * t, d * 2 * t, { a: 0.35 * (1 - t), w: 0.7 });
  }
  for (const [dx, dy] of [[-w * 3.4, -d * 0.6], [-w * 3, d * 0.9], [w * 3.2, -d * 0.9]]) {
    const p = { x: c.x + dx, y: c.y + dy };
    for (const k of [-1.6, 0, 1.6]) {
      barra(P, { x: p.x + k, y: p.y }, { x: p.x + k * 2.2, y: p.y - 9 - Math.abs(k) }, 0.9);
      P.elipse(p.x + k * 2.2, p.y - 10.5 - Math.abs(k), 0.9, 1.6, { a: 0.9, fill: 0.2, solido: true });
    }
  }
}

/** Mirante: quatro pernas, plataforma, guarda-corpo com balaústres e a escada de acesso. */
export function drawMirante(P, { tx, ty, w, d }) {
  const alto = 28;
  for (const [a, b] of [[0.3, 0.3], [w - 0.3, 0.3], [0.3, d - 0.3], [w - 0.3, d - 0.3]]) {
    const p = iso(tx + a, ty + b);
    barra(P, p, { x: p.x, y: p.y - alto }, 2);
  }
  const e = iso(tx + 0.3, ty + d - 0.3);
  const f = iso(tx + w - 0.3, ty + d - 0.3);
  for (const k of [alto * 0.35, alto * 0.7]) barra(P, { x: e.x, y: e.y - k }, { x: f.x, y: f.y - k }, 1.1, { a: 0.5 });
  caixa(P, tx - 0.5, ty - 0.5, w + 1, d + 1, 2, { base: alto, luz: 0.13 });
  const pl = cantos(tx - 0.5, ty - 0.5, w + 1, d + 1, alto + 2);
  const guarda = cantos(tx - 0.5, ty - 0.5, w + 1, d + 1, alto + 10);
  for (let i = 0; i < 4; i++) barra(P, pl[i], guarda[i], 1.6);
  P.poli(guarda, { a: 0.8, w: 0.9 });
  for (const [i, j] of [[3, 2], [2, 1]])
    for (let k = 1; k < 5; k++) {
      const t = k / 5;
      const x = pl[i].x + (pl[j].x - pl[i].x) * t;
      const y = pl[i].y + (pl[j].y - pl[i].y) * t;
      barra(P, { x, y }, { x, y: y - 8 }, 0.9, { a: 0.5 });
    }
  const base = iso(tx + w / 2, ty + d + 1.4);
  const topo = iso(tx + w / 2, ty + d - 0.4, alto);
  for (const dx of [-2.5, 2.5]) barra(P, { x: base.x + dx, y: base.y }, { x: topo.x + dx, y: topo.y }, 1.1);
  for (let k = 1; k < 8; k++) {
    const t = k / 8;
    const x = base.x + (topo.x - base.x) * t;
    const y = base.y + (topo.y - base.y) * t;
    barra(P, { x: x - 2.5, y }, { x: x + 2.5, y }, 0.9, { a: 0.6 });
  }
}

/** Cerca: mourões com espessura e duas travessas. Como linha de 1px ela sumia. */
export function drawCerca(P, grid) {
  const lados = [[0, 0, grid, 0], [0, grid, grid, grid], [0, 0, 0, grid], [grid, 0, grid, grid]];
  for (const [ax, ay, bx, by] of lados) {
    const a = iso(ax, ay);
    const b = iso(bx, by);
    for (const h of [3, 6.5]) barra(P, { x: a.x, y: a.y - h }, { x: b.x, y: b.y - h }, 1, { a: 0.45 });
    for (let i = 0; i <= 1; i += 1 / 12) {
      const x = a.x + (b.x - a.x) * i;
      const y = a.y + (b.y - a.y) * i;
      barra(P, { x, y }, { x, y: y - 8.5 }, 1.5, { a: 0.6 });
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
    P.linha([{ x: p.x - 1, y: p.y }, { x: p.x - 0.4, y: p.y - 1.8 }], { a: 0.13, w: 0.7 });
    P.linha([{ x: p.x + 1, y: p.y }, { x: p.x + 0.4, y: p.y - 2 }], { a: 0.13, w: 0.7 });
  }
}

/** O caminho: lajotas assentadas, não cinquenta losangos soltos. */
export function drawCaminho(P, tiles) {
  if (!tiles.length) return;
  for (const [tx, ty] of tiles) P.poli(cantos(tx + 0.12, ty + 0.12, 0.76, 0.76), { a: 0.3, fill: 0.05, w: 0.7 });
}
