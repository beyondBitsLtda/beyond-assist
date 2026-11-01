// O rosto da Lisa (01/11/2026): "crie uma opção que essa malha seja um rosto 3D que interage
// enquanto a Lisa fala e escuta". É a mesma ideia da Esfera de pontos — milhares de pontos que
// brilham —, só que pousados num rosto em vez de numa esfera.
//
// O rosto é descrito por uma função de distância (SDF): elipsoides (crânio, maxilar, queixo,
// maçãs, nariz, lábios, orelhas, pescoço) juntados com "mínimo suave", e as órbitas dos olhos e a
// linha da boca cavadas com "máximo suave". Os pontos saem de raios disparados de dentro da
// cabeça (mais raios para a frente, que é o que importa); cada um leva a normal (para a luz e para
// sumir o que está de costas), o relevo (relevoEm) e os pesos das partes que se mexem:
//
//   mandibula  quanto o ponto gira com o queixo quando a boca abre (o lábio de baixo, 1)
//   labio      o lábio de cima, que sobe um pouco na fala
//   canto      os cantos da boca (o sorriso)
//   palpebra   a pálpebra de cima, que desce na piscada
//   sobrancelha o arco da sobrancelha, que sobe quando ela escuta
//   olho       os pontos da frente do globo ocular; `iris` é a posição no olho (-1..1), para o
//              shader desenhar íris e pupila olhando para onde ela olha
//
// Puro (sem navegador, sem three.js): testado por `npm run visuais-check`. O componente que
// desenha e anima é src/components/panels/visuais/Rosto.js.

/** Os centros dos olhos (o esquerdo é o espelho) e o raio do globo — o shader usa os mesmos. */
export const OLHO = { x: 0.24, y: 0.075, z: 0.5, raio: 0.1 };
/** A altura da linha da boca e a dobradiça da mandíbula (perto das orelhas). */
export const BOCA_Y = -0.517;
export const DOBRADICA = { y: -0.3, z: -0.05 };
/** Onde o pescoço é cortado. */
export const CORTE_Y = -1.3;

// distância (aproximada) até um elipsoide — a de Inigo Quilez, boa o bastante perto da superfície
function elipsoide(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = x - cx, py = y - cy, pz = z - cz;
  const k0 = Math.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
  const k1 = Math.sqrt((px / (rx * rx)) ** 2 + (py / (ry * ry)) ** 2 + (pz / (rz * rz)) ** 2);
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
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

/** A distância de (x, y, z) até a superfície do rosto: < 0 dentro, > 0 fora. Simétrico em x. */
export function distanciaDoRosto(x, y, z) {
  const sx = Math.abs(x);
  let d = elipsoide(sx, y, z, 0, 0.16, -0.06, 0.7, 0.86, 0.8); // crânio
  d = juntar(d, elipsoide(sx, y, z, 0, -0.36, 0.06, 0.5, 0.52, 0.58), 0.22); // maxilar e bochechas
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
  d = juntar(d, elipsoide(sx, y, z, 0, -1.0, -0.14, 0.32, 0.5, 0.32), 0.15); // pescoço
  return Math.max(d, CORTE_Y - y);
}

/**
 * O relevo em (x, y, z) na superfície, de -1 (dobra: a linha da boca, o fundo da órbita) a 1
 * (crista: a ponta do nariz, os lábios, o arco da sobrancelha). É o laplaciano da distância (a
 * curvatura média), descontada a da cabeça inteira. Com os pontos espalhados por igual, é isso
 * que faz o nariz e a boca aparecerem: as cristas acendem e as dobras apagam.
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

function normalEm(x, y, z) {
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
  // boca: perto dela, o corte é seco na linha dos lábios; longe, a mandíbula puxa a pele aos poucos
  const pertoDaBoca = Math.exp(-((sx / 0.2) ** 4)) * suaviza(0.45, 0.52, z);
  const seco = suaviza(BOCA_Y + 0.004, BOCA_Y - 0.03, y);
  const solto = suaviza(-0.45, -0.72, y) * suaviza(-0.2, 0.15, z) * (1 - suaviza(0.4, 0.62, sx));
  const mandibula = Math.max(seco * pertoDaBoca, solto);
  const labio = pertoDaBoca * suaviza(BOCA_Y - 0.002, BOCA_Y + 0.01, y) * (1 - suaviza(-0.44, -0.41, y));
  const canto = suaviza(0.42, 0.5, z) * Math.exp(-(((sx - 0.165) / 0.045) ** 2)) * Math.exp(-(((y - BOCA_Y) / 0.045) ** 2));
  return { mandibula, labio, canto, palpebra, sobrancelha, olho, iris };
}

/**
 * Os pontos do rosto: `n` pontos na superfície, com a normal e os pesos. Devolve arrays prontos
 * para a GPU: posicoes/normais (3 por ponto), iris (2 por ponto) e os pesos (1 por ponto).
 * `acaso` é injetável (testes). Mais raios na frente: a nuca recebe só uma parte.
 */
export function pontosDoRosto(n, acaso = Math.random) {
  const centro = [0, -0.12, 0.02];
  const posicoes = new Float32Array(n * 3);
  const normais = new Float32Array(n * 3);
  const iris = new Float32Array(n * 2);
  const campos = ["mandibula", "labio", "canto", "palpebra", "sobrancelha", "olho"];
  const pesos = Object.fromEntries(campos.map((c) => [c, new Float32Array(n)]));
  const acasos = new Float32Array(n);
  const relevos = new Float32Array(n);
  const ouro = Math.PI * (3 - Math.sqrt(5));
  // direções candidatas (a nuca descarta parte delas), percorridas fora de ordem — em ordem, a
  // cota enchia antes de os raios chegarem à metade de baixo do rosto
  let total = Math.ceil(n * 1.5);
  const PULO = 7919;
  if (total % PULO === 0) total++;
  let k = 0;
  for (let j = 0; j < total && k < n; j++) {
    const i = (j * PULO) % total;
    // direção de Fibonacci com um tremor (sem o desenho em espiral) …
    const yy = 1 - ((i + acaso()) / total) * 2;
    const r = Math.sqrt(Math.max(0, 1 - yy * yy));
    const a = ouro * i + (acaso() - 0.5) * 0.4;
    const dx = Math.cos(a) * r, dy = yy, dz = Math.sin(a) * r;
    // … e a nuca e o alto da cabeça ficam com menos (o rosto é a frente)
    if (dz < -0.15 && acaso() > 0.3) continue;
    // marcha de fora para dentro até cruzar a superfície; depois, bissecção
    let t = 2.4, dentro = -1, fora = t;
    for (let passo = 0; passo < 48; passo++) {
      const d = distanciaDoRosto(centro[0] + dx * t, centro[1] + dy * t, centro[2] + dz * t);
      if (d < 0) { dentro = t; break; }
      fora = t;
      t -= Math.max(d * 0.9, 0.004);
      if (t <= 0) break;
    }
    if (dentro < 0) continue;
    let lo = dentro, hi = fora;
    for (let b = 0; b < 12; b++) {
      const m = (lo + hi) / 2;
      if (distanciaDoRosto(centro[0] + dx * m, centro[1] + dy * m, centro[2] + dz * m) < 0) lo = m; else hi = m;
    }
    const s = (lo + hi) / 2;
    const x = centro[0] + dx * s, y = centro[1] + dy * s, z = centro[2] + dz * s;
    const nn = normalEm(x, y, z);
    posicoes.set([x, y, z], k * 3);
    normais.set(nn, k * 3);
    const p = pesosDoPonto(x, y, z);
    for (const c of campos) pesos[c][k] = p[c];
    iris.set(p.iris, k * 2);
    acasos[k] = acaso();
    relevos[k] = relevoEm(x, y, z);
    k++;
  }
  const corta = (arr, por) => arr.subarray(0, k * por);
  return {
    total: k,
    posicoes: corta(posicoes, 3),
    normais: corta(normais, 3),
    iris: corta(iris, 2),
    acaso: corta(acasos, 1),
    relevo: corta(relevos, 1),
    ...Object.fromEntries(campos.map((c) => [c, corta(pesos[c], 1)])),
  };
}
