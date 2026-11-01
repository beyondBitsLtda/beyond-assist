// O rosto da Lisa (01/11/2026): "crie uma opção que essa malha seja um rosto 3D que interage
// enquanto a Lisa fala e escuta" — e, vista a primeira versão, a referência: um busto holográfico
// feito de LINHAS de pontos de luz que contornam o rosto, com pescoço, ombros e cabelo, e um lado
// se desfazendo em partículas.
//
// O busto é descrito por uma função de distância (SDF): elipsoides (crânio, cabelo, maxilar,
// queixo, maçãs, nariz, lábios, orelhas, pescoço, ombros, peito) juntados com "mínimo suave", e as
// órbitas dos olhos e a linha da boca cavadas com "máximo suave". As linhas são fatias horizontais:
// em cada altura, raios saem do eixo do corpo e acham o contorno, e os pontos são postos ao longo
// dele com espaçamento igual. Cada ponto leva a normal (para a luz e para sumir o que está de
// costas), o relevo (relevoEm: as cristas acendem, as dobras apagam) e os pesos do que se mexe:
//
//   mandibula   quanto o ponto gira com o queixo quando a boca abre (o lábio de baixo, 1)
//   labio       o lábio de cima, que sobe um pouco na fala
//   canto       os cantos da boca (o sorriso)
//   palpebra    a pálpebra de cima, que desce na piscada
//   sobrancelha o arco da sobrancelha, que sobe quando ela escuta
//   olho        os pontos da frente do globo ocular; `iris` é a posição no olho (-1..1), para o
//               shader desenhar íris e pupila olhando para onde ela olha
//   cabeca      quanto o ponto gira com a cabeça (1 na cabeça, 0 nos ombros, aos poucos no pescoço)
//   cabelo      o alto e a parte de trás da cabeça, onde as linhas ondulam como fios
//
// Puro (sem navegador, sem three.js): testado por `npm run visuais-check`. O componente que
// desenha e anima é src/components/panels/visuais/Rosto.js.

/** Os centros dos olhos (o esquerdo é o espelho) e o raio do globo — o shader usa os mesmos. */
export const OLHO = { x: 0.24, y: 0.075, z: 0.5, raio: 0.1 };
/** A altura da linha da boca e a dobradiça da mandíbula (perto das orelhas). */
export const BOCA_Y = -0.517;
export const DOBRADICA = { y: -0.3, z: -0.05 };
/** O pivô da cabeça (no pescoço) — a cabeça gira em volta dele, os ombros ficam. */
export const PIVO_DA_CABECA = { y: -0.8, z: -0.05 };
/** Onde o peito é cortado, e o alto da cabeça (com o cabelo). */
export const CORTE_Y = -2.15;
export const TOPO_Y = 1.06;

// distância (aproximada) até um elipsoide — a de Inigo Quilez, boa o bastante perto da superfície
function elipsoide(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = x - cx, py = y - cy, pz = z - cz;
  const k0 = Math.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
  const k1 = Math.sqrt((px / (rx * rx)) ** 2 + (py / (ry * ry)) ** 2 + (pz / (rz * rz)) ** 2);
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
// o mesmo, girado em volta do eixo z (para o ombro que desce do pescoço)
function elipsoideGirado(x, y, z, cx, cy, cz, rx, ry, rz, angulo) {
  const c = Math.cos(angulo), s = Math.sin(angulo);
  const px = x - cx, py = y - cy;
  return elipsoide(c * px + s * py, -s * px + c * py, z, 0, 0, cz, rx, ry, rz);
}
// junta duas formas arredondando a emenda (k = o tamanho da curva)
function juntar(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
// cava b de a, arredondando a borda
function cavar(a, b, k) {
  return -juntar(-a, b, k);
}

/** A distância de (x, y, z) até a superfície do busto: < 0 dentro, > 0 fora. Simétrico em x. */
export function distanciaDoRosto(x, y, z) {
  const sx = Math.abs(x);
  let d = elipsoide(sx, y, z, 0, 0.13, -0.06, 0.7, 0.8, 0.8); // crânio
  d = juntar(d, elipsoide(sx, y, z, 0, 0.24, -0.16, 0.75, 0.8, 0.84), 0.12); // cabelo: volume no alto e atrás
  d = juntar(d, elipsoide(sx, y, z, 0, -0.36, 0.06, 0.54, 0.52, 0.58), 0.22); // maxilar e bochechas
  d = juntar(d, elipsoide(sx, y, z, 0, -0.76, 0.26, 0.19, 0.13, 0.16), 0.12); // queixo
  d = juntar(d, elipsoide(sx, y, z, 0.36, -0.1, 0.36, 0.2, 0.15, 0.2), 0.12); // maçãs do rosto
  d = juntar(d, elipsoide(sx, y, z, 0, 0.24, 0.5, 0.46, 0.08, 0.16), 0.1); // arco das sobrancelhas
  d = cavar(d, elipsoide(sx, y, z, OLHO.x, 0.08, 0.62, 0.15, 0.085, 0.13), 0.05); // órbitas
  d = juntar(d, elipsoide(sx, y, z, OLHO.x, OLHO.y, OLHO.z, OLHO.raio, OLHO.raio, OLHO.raio), 0.015); // olhos
  d = juntar(d, elipsoide(sx, y, z, 0, -0.1, 0.65, 0.06, 0.23, 0.1), 0.05); // ponte do nariz
  d = juntar(d, elipsoide(sx, y, z, 0, -0.27, 0.71, 0.075, 0.065, 0.08), 0.08); // ponta do nariz
  d = juntar(d, elipsoide(sx, y, z, 0.07, -0.305, 0.63, 0.05, 0.04, 0.05), 0.05); // asas do nariz
  d = juntar(d, elipsoide(sx, y, z, 0, -0.475, 0.6, 0.17, 0.045, 0.07), 0.04); // lábio de cima
  d = juntar(d, elipsoide(sx, y, z, 0, -0.565, 0.58, 0.15, 0.05, 0.07), 0.04); // lábio de baixo
  d = cavar(d, elipsoide(sx, y, z, 0, BOCA_Y, 0.66, 0.17, 0.012, 0.09), 0.01); // a linha da boca
  d = juntar(d, elipsoide(sx, y, z, 0.7, 0.02, -0.02, 0.07, 0.19, 0.12), 0.05); // orelhas
  d = juntar(d, elipsoide(sx, y, z, 0, -1.1, -0.1, 0.33, 0.66, 0.31), 0.15); // pescoço
  d = juntar(d, elipsoideGirado(sx, y, z, 0.46, -1.58, -0.12, 0.52, 0.13, 0.27, -0.36), 0.16); // trapézio: desce do pescoço ao ombro
  d = juntar(d, elipsoide(sx, y, z, 0.88, -1.84, -0.08, 0.27, 0.25, 0.3), 0.16); // ombros (deltoides)
  d = juntar(d, elipsoide(sx, y, z, 0, -2.08, -0.03, 0.96, 0.44, 0.44), 0.18); // peito
  return Math.max(d, CORTE_Y - y);
}

/**
 * O relevo em (x, y, z) na superfície, de -1 (dobra: a linha da boca, o fundo da órbita) a 1
 * (crista: a ponta do nariz, os lábios, o arco da sobrancelha). É o laplaciano da distância (a
 * curvatura média), descontada a da cabeça inteira. É isso que faz o nariz e a boca aparecerem.
 */
export function relevoEm(x, y, z) {
  const e = 0.02;
  const centro = distanciaDoRosto(x, y, z);
  const soma = distanciaDoRosto(x + e, y, z) + distanciaDoRosto(x - e, y, z)
    + distanciaDoRosto(x, y + e, z) + distanciaDoRosto(x, y - e, z)
    + distanciaDoRosto(x, y, z + e) + distanciaDoRosto(x, y, z - e);
  const laplaciano = (soma - 6 * centro) / (e * e);
  return Math.max(-1, Math.min(1, (laplaciano - 2.6) / 14));
}

function gradiente(x, y, z) {
  const e = 0.0015;
  const nx = distanciaDoRosto(x + e, y, z) - distanciaDoRosto(x - e, y, z);
  const ny = distanciaDoRosto(x, y + e, z) - distanciaDoRosto(x, y - e, z);
  const nz = distanciaDoRosto(x, y, z + e) - distanciaDoRosto(x, y, z - e);
  const n = Math.hypot(nx, ny, nz) || 1;
  return [nx / n, ny / n, nz / n];
}

const suaviza = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Os pesos das partes que se mexem, para um ponto parado em (x, y, z) — ver o topo do arquivo. */
export function pesosDoPonto(x, y, z) {
  const sx = Math.abs(x);
  const frente = suaviza(0.42, 0.52, z);
  // olho: a frente do globo ocular (atrás da pálpebra, a borda da órbita não conta)
  const dOlho = Math.hypot(sx - OLHO.x, y - OLHO.y, z - OLHO.z);
  const olho = dOlho < OLHO.raio * 1.08 && z > OLHO.z + 0.03 ? 1 : 0;
  const iris = olho ? [(sx - OLHO.x) / OLHO.raio * Math.sign(x || 1), (y - OLHO.y) / OLHO.raio] : [0, 0];
  // pálpebra de cima: a pele logo acima do olho, dentro da órbita
  const palpebra = olho ? 0 : frente * Math.exp(-(((sx - OLHO.x) / 0.13) ** 4)) * suaviza(OLHO.y - 0.01, OLHO.y + 0.03, y) * (1 - suaviza(OLHO.y + 0.09, OLHO.y + 0.14, y));
  // sobrancelha: o arco acima da órbita
  const sobrancelha = frente * Math.exp(-(((y - 0.235) / 0.06) ** 2)) * Math.exp(-(((sx - 0.25) / 0.2) ** 4));
  // boca: perto dela, o corte é seco na linha dos lábios; longe, a mandíbula puxa a pele aos poucos.
  // Tudo para no queixo: o pescoço e o peito não giram com a boca.
  const acimaDoPescoco = 1 - suaviza(-0.8, -0.95, y);
  const pertoDaBoca = Math.exp(-((sx / 0.2) ** 4)) * suaviza(0.45, 0.52, z);
  const seco = suaviza(BOCA_Y + 0.004, BOCA_Y - 0.03, y);
  const solto = suaviza(-0.45, -0.72, y) * suaviza(-0.2, 0.15, z) * (1 - suaviza(0.4, 0.62, sx));
  const mandibula = Math.max(seco * pertoDaBoca, solto) * acimaDoPescoco;
  const labio = pertoDaBoca * suaviza(BOCA_Y - 0.002, BOCA_Y + 0.01, y) * (1 - suaviza(-0.44, -0.41, y));
  const canto = suaviza(0.42, 0.5, z) * Math.exp(-(((sx - 0.165) / 0.045) ** 2)) * Math.exp(-(((y - BOCA_Y) / 0.045) ** 2));
  // a cabeça gira inteira; no pescoço, aos poucos; os ombros ficam
  const cabeca = suaviza(-1.3, -0.85, y);
  // o cabelo: acima da linha da testa e atrás das orelhas, até a nuca
  const cabelo = Math.max(suaviza(0.48, 0.66, y), suaviza(-0.02, -0.3, z) * suaviza(-0.75, -0.45, y));
  return { mandibula, labio, canto, palpebra, sobrancelha, olho, iris, cabeca, cabelo };
}

// As fatias são INCLINADAS: o plano y + INCLINACAO·z = s, não y = s. Vista de frente, a linha
// desce onde o rosto avança (nariz, lábios, queixo) e sobe onde ele recua (órbitas, lados) — é o
// desenho de um escaneamento com luz estruturada, e é o que faz o relevo aparecer nas linhas.
export const INCLINACAO = 0.33;
const NORMAL_DO_PLANO = [0, 1 / Math.hypot(1, INCLINACAO), INCLINACAO / Math.hypot(1, INCLINACAO)];

// o eixo do corpo em cada altura (de onde saem os raios da fatia): na cabeça, um pouco à frente;
// no pescoço e nos ombros, um pouco atrás
const eixoZ = (y) => 0.05 - 0.13 * suaviza(-0.9, -1.25, y);

// o contorno da fatia s num ângulo (0 = de frente): o ponto mais de fora do busto nessa direção
function contorno(s, angulo) {
  const cz = eixoZ(s);
  const ay = s - INCLINACAO * cz;
  const n = Math.hypot(1, INCLINACAO * Math.cos(angulo));
  const dx = Math.sin(angulo) / n, dy = (-INCLINACAO * Math.cos(angulo)) / n, dz = Math.cos(angulo) / n;
  const em = (t) => distanciaDoRosto(dx * t, ay + dy * t, cz + dz * t);
  let t = 1.75, dentro = -1, fora = t;
  for (let passo = 0; passo < 60; passo++) {
    const d = em(t);
    if (d < 0) { dentro = t; break; }
    fora = t;
    t -= Math.max(d * 0.9, 0.004);
    if (t <= 0) break;
  }
  if (dentro < 0) return null;
  let lo = dentro, hi = fora;
  for (let b = 0; b < 12; b++) {
    const m = (lo + hi) / 2;
    if (em(m) < 0) lo = m; else hi = m;
  }
  const r = (lo + hi) / 2;
  return [dx * r, ay + dy * r, cz + dz * r];
}

const CAMPOS = ["mandibula", "labio", "canto", "palpebra", "sobrancelha", "olho", "cabeca", "cabelo"];
const distancia = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/**
 * Os pontos do busto em linhas: `linhas` fatias (inclinadas, ver INCLINACAO) do peito ao alto da
 * cabeça e, em cada uma, um ponto a cada `passo` ao longo do contorno. Devolve arrays prontos para
 * a GPU: posicoes/normais (3 por ponto), iris (2), linha (o índice da fatia), relevo, acaso e os
 * pesos (1 por ponto). `angulos` é quantos raios medem cada contorno; `acaso` é injetável.
 *
 * É um gerador que para a cada fatia (o Rosto.js vai gerando alguns milissegundos por quadro, sem
 * travar a tela — o busto inteiro leva ~0,5s); `pontosDoRosto` roda tudo de uma vez.
 */
export function* gerarPontosDoRosto({ linhas = 84, passo = 0.0095, angulos = 300, acaso = Math.random } = {}) {
  const saida = { posicoes: [], normais: [], iris: [], linha: [], relevo: [], acaso: [] };
  for (const c of CAMPOS) saida[c] = [];
  // a fatia mais baixa ainda cabe inteira acima do corte do peito; a mais alta, abaixo do topo
  const baixo = CORTE_Y + INCLINACAO * 0.55 + 0.03, alto = TOPO_Y - 0.06;
  for (let k = 0; k < linhas; k++) {
    const s = baixo + ((alto - baixo) * k) / (linhas - 1);
    // o contorno da fatia, medido em `angulos` raios; um raio que não acha o busto parte a linha
    const amostras = [];
    for (let a = 0; a < angulos; a++) amostras.push(contorno(s, (a / angulos) * Math.PI * 2));
    const trechos = [];
    let atual = [];
    for (const p of amostras) {
      if (p && (!atual.length || distancia(p, atual[atual.length - 1]) < 0.15)) atual.push(p);
      else { if (atual.length) trechos.push(atual); atual = p ? [p] : []; }
    }
    if (atual.length) trechos.push(atual);
    // o anel inteiro (sem falha): fecha o último no primeiro
    const fechado = trechos.length === 1 && trechos[0].length === angulos && distancia(trechos[0][0], trechos[0][angulos - 1]) < 0.15;
    if (fechado) trechos[0].push(trechos[0][0]);
    for (const trecho of trechos) {
      if (trecho.length < 4) continue;
      // o comprimento acumulado, para espalhar os pontos por igual
      const acumulado = [0];
      for (let i = 1; i < trecho.length; i++) acumulado.push(acumulado[i - 1] + distancia(trecho[i], trecho[i - 1]));
      const total = acumulado[acumulado.length - 1];
      let i = 0;
      for (let u = acaso() * passo; u < total; u += passo * (0.85 + acaso() * 0.3)) {
        while (acumulado[i + 1] < u) i++;
        const f = (u - acumulado[i]) / (acumulado[i + 1] - acumulado[i] || 1);
        const p = trecho[i], q = trecho[i + 1];
        let x = p[0] + (q[0] - p[0]) * f, y = p[1] + (q[1] - p[1]) * f, z = p[2] + (q[2] - p[2]) * f;
        // o meio do caminho entre dois raios pode cair fora da superfície: um passo de Newton,
        // dentro do plano da fatia, a traz de volta
        const d = distanciaDoRosto(x, y, z);
        const g = gradiente(x, y, z);
        const gn = g[1] * NORMAL_DO_PLANO[1] + g[2] * NORMAL_DO_PLANO[2];
        const gp = [g[0], g[1] - gn * NORMAL_DO_PLANO[1], g[2] - gn * NORMAL_DO_PLANO[2]];
        const g2 = gp[0] ** 2 + gp[1] ** 2 + gp[2] ** 2;
        if (g2 > 0.05) { x -= (d * gp[0]) / g2; y -= (d * gp[1]) / g2; z -= (d * gp[2]) / g2; }
        saida.posicoes.push(x, y, z);
        saida.normais.push(...g); // a normal de antes do passo: o ponto andou milímetros
        const pesos = pesosDoPonto(x, y, z);
        for (const c of CAMPOS) saida[c].push(pesos[c]);
        saida.iris.push(...pesos.iris);
        saida.linha.push(k);
        saida.relevo.push(relevoEm(x, y, z));
        saida.acaso.push(acaso());
      }
    }
    yield k;
  }
  const r = { total: saida.linha.length, linhas };
  for (const [nome, arr] of Object.entries(saida)) r[nome] = Float32Array.from(arr);
  return r;
}

/** Os pontos do busto de uma vez (ver gerarPontosDoRosto). */
export function pontosDoRosto(opcoes) {
  const gerador = gerarPontosDoRosto(opcoes);
  for (;;) {
    const passo = gerador.next();
    if (passo.done) return passo.value;
  }
}
