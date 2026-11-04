// O GRÁFICO (pedido de 31/10/2026, da proposta dos cursos de matemática): "arrastar pontos ou retas
// até cumprir a condição". Um plano cartesiano de −6 a 6, com pontos que a pessoa arrasta (encaixam
// nos inteiros). Montado pelo código (sem IA) e corrigido no servidor:
//
//   ponto    — marcar o ponto (3, −2)
//   reta     — dois pontos que fazem a reta y = 2x − 1
//   vertice  — o vértice da parábola y = x² − 4x + 3 (a parábola só aparece depois de corrigir)
//   raizes   — onde a parábola corta o eixo x
//
// Puro: sem banco, sem rede, sem DOM.

export const LIMITE_DO_PLANO = 6;
const ITENS_DO_GRAFICO = 4;

function sorteador(semente) {
  let a = semente >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const inteiroEntre = (sortear, min, max) => min + Math.floor(sortear() * (max - min + 1));
const menos = (n) => (n < 0 ? `−${Math.abs(n)}` : String(n));

/** O polinômio escrito para gente: [1, −4, 3] → "x² − 4x + 3"; [2, −1] → "2x − 1". */
export function formatarPolinomio(coeficientes) {
  const grau = coeficientes.length - 1;
  const partes = [];
  coeficientes.forEach((c, i) => {
    const g = grau - i;
    if (!c) return;
    const abs = Math.abs(c);
    const corpo = g === 0 ? String(abs) : `${abs === 1 ? "" : abs}x${g === 2 ? "²" : ""}`;
    partes.push(partes.length ? `${c < 0 ? "−" : "+"} ${corpo}` : `${c < 0 ? "−" : ""}${corpo}`);
  });
  return partes.join(" ") || "0";
}

/** O que o assunto pede: retas (função afim), parábolas (2º grau), pontos (plano cartesiano) ou um pouco de cada. */
export function categoriaDoGrafico(assunto) {
  const t = `${assunto?.titulo || ""} ${assunto?.descricao || ""}`;
  if (/quadr[aá]tic|par[aá]bola|2[ºo°] grau|segundo grau|v[eé]rtice|bhaskara/i.test(t)) return "parabola";
  if (/afim|linear|reta|inclina|coeficiente angular|1[ºo°] grau|primeiro grau/i.test(t)) return "reta";
  if (/plano cartesiano|coordenad|par ordenado|quadrante/i.test(t)) return "pontos";
  return "misto";
}

function itemDoTipo(tipo, sortear) {
  if (tipo === "ponto") {
    let x = 0, y = 0;
    while (!x || !y) { x = inteiroEntre(sortear, -5, 5); y = inteiroEntre(sortear, -5, 5); }
    return { tipo, alvo: [x, y], pedido: `Marque o ponto (${menos(x)}, ${menos(y)})`, pontos: 1 };
  }
  if (tipo === "reta") {
    const a = [-2, -1, 1, 2][inteiroEntre(sortear, 0, 3)];
    const b = inteiroEntre(sortear, -3, 3);
    const expressao = `y = ${formatarPolinomio([a, b])}`;
    return { tipo, a, b, expressao, pedido: `Arraste os dois pontos para que a reta seja ${expressao}`, pontos: 2 };
  }
  if (tipo === "vertice") {
    const h = inteiroEntre(sortear, -3, 3), k = inteiroEntre(sortear, -4, 2);
    const expressao = `y = ${formatarPolinomio([1, -2 * h, h * h + k])}`;
    return { tipo, h, k, coeficientes: [1, -2 * h, h * h + k], expressao, pedido: `Marque o vértice da parábola ${expressao}`, pontos: 1 };
  }
  // raízes distintas, inteiras, dentro do plano
  const r1 = inteiroEntre(sortear, -5, 4);
  const r2 = inteiroEntre(sortear, r1 + 1, 5);
  const coeficientes = [1, -(r1 + r2), r1 * r2];
  const expressao = `y = ${formatarPolinomio(coeficientes)}`;
  return { tipo: "raizes", r1, r2, coeficientes, expressao, pedido: `Marque as duas raízes (onde a parábola corta o eixo x) de ${expressao}`, pontos: 2 };
}

const TIPOS_DA_CATEGORIA = {
  reta: ["ponto", "reta", "reta", "reta"],
  parabola: ["vertice", "raizes", "vertice", "raizes"],
  pontos: ["ponto", "ponto", "ponto", "reta"],
  misto: ["ponto", "reta", "vertice", "raizes"],
};

/** O treino de gráfico, montado pelo código (sem IA): 4 itens do tipo que o assunto pede. */
export function gerarGrafico({ semente, assunto }) {
  const categoria = categoriaDoGrafico(assunto);
  const sortear = sorteador(semente);
  const itens = TIPOS_DA_CATEGORIA[categoria].slice(0, ITENS_DO_GRAFICO).map((t) => itemDoTipo(t, sortear));
  return {
    motor: "grafico",
    titulo: { reta: "Gráfico: retas", parabola: "Gráfico: parábolas", pontos: "Gráfico: plano cartesiano", misto: "Gráfico: pontos, retas e parábolas" }[categoria],
    categoria, limite: LIMITE_DO_PLANO, itens, semente: semente >>> 0,
  };
}

/**
 * Onde os pontos começam na tela: nas bordas x = ±6, que nenhuma resposta sorteada usa (os pontos e
 * as raízes vão de −5 a 5, o vértice de −3 a 3, e nenhuma das retas passa por (−6, 1) nem (6, −1)).
 */
export const inicioDosPontos = (n) => (n === 1 ? [[-6, 1]] : [[-6, 1], [6, -1]]);

/** O conteúdo como a tela pode ver antes de corrigir: sem a resposta (vértice, raízes). */
export function graficoParaTela(conteudo) {
  return { ...conteudo, itens: conteudo.itens.map(({ h, k, r1, r2, coeficientes, ...resto }) => resto) };
}

/** Os pontos que a tela mandou ("3,-2;4,1"): inteiros dentro do plano. */
export function lerPontos(resposta) {
  return String(resposta ?? "").split(";").map((p) => p.split(",").map((n) => Number(n.trim())))
    .filter((p) => p.length === 2 && p.every((n) => Number.isInteger(n) && Math.abs(n) <= LIMITE_DO_PLANO))
    .slice(0, 2);
}

const ponto = ([x, y]) => `(${menos(x)}, ${menos(y)})`;
const igual = (p, q) => p[0] === q[0] && p[1] === q[1];

export function corrigirItemDeGrafico(item, resposta) {
  const pts = lerPontos(resposta);
  if (pts.length < item.pontos) return { certo: false, nota: 0, motivo: "faltam pontos" };
  if (item.tipo === "ponto" || item.tipo === "vertice") {
    const alvo = item.tipo === "ponto" ? item.alvo : [item.h, item.k];
    return igual(pts[0], alvo)
      ? { certo: true, nota: 1, motivo: "" }
      : { certo: false, nota: 0, motivo: `você marcou ${ponto(pts[0])}; ${item.tipo === "vertice" ? "o vértice é" : "era"} ${ponto(alvo)}` };
  }
  if (item.tipo === "reta") {
    if (igual(pts[0], pts[1])) return { certo: false, nota: 0, motivo: "os dois pontos estão no mesmo lugar" };
    const naReta = pts.filter(([x, y]) => y === item.a * x + item.b);
    if (naReta.length === 2) return { certo: true, nota: 1, motivo: "" };
    const fora = pts.find(([x, y]) => y !== item.a * x + item.b);
    return { certo: false, nota: naReta.length / 2, motivo: `o ponto ${ponto(fora)} não está em ${item.expressao}: com x = ${menos(fora[0])}, y = ${menos(item.a * fora[0] + item.b)}` };
  }
  const raizes = [[item.r1, 0], [item.r2, 0]];
  const acertos = raizes.filter((r) => pts.some((p) => igual(p, r))).length;
  return acertos === 2
    ? { certo: true, nota: 1, motivo: "" }
    : { certo: false, nota: acertos / 2, motivo: `as raízes são ${ponto(raizes[0])} e ${ponto(raizes[1])}` };
}

export function corrigirGrafico(conteudo, respostas) {
  const itens = conteudo.itens.map((it, i) => corrigirItemDeGrafico(it, respostas?.[i]));
  return { nota: Math.round((itens.reduce((s, x) => s + x.nota, 0) / itens.length) * 100), itens };
}
