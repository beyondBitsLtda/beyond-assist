// Expressões matemáticas para a lista de cálculo (perfil Matemática, 30/10/2026): ler o que a
// pessoa digitou, conferir se é equivalente à resposta certa e se está na forma pedida. Sem IA e
// sem biblioteca: um analisador pequeno, que roda igual no servidor (que corrige) e na tela.
//
// Aceita + − × ÷ * / ^, parênteses, multiplicação implícita (2x, (x-1)(x+2)), ², ³, √, π, decimal
// com vírgula ou ponto e as funções sqrt, raiz, sin, sen, cos, tan, tg, ln, log, abs. Uma variável
// só (a do item, x por padrão). Puro.

const FUNCOES = { sqrt: "sqrt", raiz: "sqrt", sin: "sin", sen: "sin", cos: "cos", tan: "tan", tg: "tan", ln: "log", log: "log10", abs: "abs" };
const CONSTANTES = { pi: Math.PI, e: Math.E };

/** Troca a escrita do dia a dia pela que o analisador lê. */
function normalizar(fonte) {
  return String(fonte ?? "")
    .replace(/[−–—]/g, "-").replace(/[×·∙]/g, "*").replace(/÷/g, "/")
    .replace(/²/g, "^2").replace(/³/g, "^3").replace(/√/g, "sqrt").replace(/π/g, "pi")
    .toLowerCase();
}

/** Número com vírgula ou ponto: "2,5" e "2.5" valem 2,5; "1.000,5" (com os dois) é o jeito brasileiro. */
function lerNumero(bruto) {
  let s = bruto;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  return Number.parseFloat(s);
}

/**
 * Lê a expressão e devolve a árvore. Lança Error com uma frase para a pessoa quando não dá para ler.
 * `variavel`: a letra que vale como incógnita (null = só números).
 */
export function analisar(fonte, variavel = "x") {
  const s = normalizar(fonte);
  if (!s.trim()) throw new Error("a resposta está vazia");
  if (s.length > 300) throw new Error("a expressão é longa demais");
  const fichas = [];
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d[\d.,]*\d|\d)/.exec(s.slice(i)) || /^[.,]\d+/.exec(s.slice(i));
    if (num) {
      const v = lerNumero(num[0]);
      if (!Number.isFinite(v)) throw new Error(`não entendi o número "${num[0]}"`);
      fichas.push({ t: "n", v });
      i += num[0].length;
      continue;
    }
    const nome = /^[a-z]+/.exec(s.slice(i));
    if (nome) {
      let resto = nome[0];
      // "sqrtx", "2pix": tira do começo as funções e constantes conhecidas, letra a letra o resto
      while (resto) {
        const f = Object.keys(FUNCOES).sort((a, b) => b.length - a.length).find((k) => resto.startsWith(k));
        if (f) { fichas.push({ t: "f", v: FUNCOES[f] }); resto = resto.slice(f.length); continue; }
        if (resto.startsWith("pi")) { fichas.push({ t: "n", v: CONSTANTES.pi }); resto = resto.slice(2); continue; }
        const letra = resto[0];
        if (variavel && letra === variavel) fichas.push({ t: "x" });
        else if (letra === "e") fichas.push({ t: "n", v: CONSTANTES.e });
        else throw new Error(variavel ? `"${letra}" não é a incógnita deste item (use ${variavel})` : `"${letra}" não cabe numa resposta numérica`);
        resto = resto.slice(1);
      }
      i += nome[0].length;
      continue;
    }
    if ("+-*/^()".includes(c)) { fichas.push({ t: c }); i++; continue; }
    if (c === "[" || c === "{") { fichas.push({ t: "(" }); i++; continue; }
    if (c === "]" || c === "}") { fichas.push({ t: ")" }); i++; continue; }
    throw new Error(`não entendi o símbolo "${c}"`);
  }

  let p = 0;
  const olhar = () => fichas[p];
  const comer = (t) => { if (fichas[p]?.t === t) { p++; return true; } return false; };
  const comecaFator = (f) => f && (f.t === "n" || f.t === "x" || f.t === "f" || f.t === "(");
  const fechar = () => { if (!comer(")")) throw new Error("faltou fechar um parêntese"); };

  function soma() {
    let a = produto();
    for (;;) {
      if (comer("+")) a = { t: "+", a, b: produto() };
      else if (comer("-")) a = { t: "-", a, b: produto() };
      else return a;
    }
  }
  function produto() {
    let a = sinal();
    for (;;) {
      if (comer("*")) a = { t: "*", a, b: sinal() };
      else if (comer("/")) a = { t: "/", a, b: sinal() };
      else if (comecaFator(olhar())) a = { t: "*", a, b: potencia() };
      else return a;
    }
  }
  function sinal() {
    if (comer("-")) return { t: "neg", a: sinal() };
    if (comer("+")) return sinal();
    return potencia();
  }
  function potencia() {
    const base = primario();
    return comer("^") ? { t: "^", a: base, b: sinal() } : base;
  }
  function primario() {
    const f = olhar();
    if (!f) throw new Error("a expressão terminou antes da hora");
    if (f.t === "n") { p++; return { t: "n", v: f.v }; }
    if (f.t === "x") { p++; return { t: "x" }; }
    if (f.t === "f") {
      p++;
      // sqrt 2 e sqrt(2) valem; sem parênteses, a função pega só o próximo fator
      if (comer("(")) { const a = soma(); fechar(); return { t: "fn", f: f.v, a }; }
      return { t: "fn", f: f.v, a: potencia() };
    }
    if (comer("(")) { const a = soma(); fechar(); return a; }
    throw new Error(f.t === ")" ? "sobrou um parêntese fechando" : `não esperava "${f.t}" aqui`);
  }

  const arvore = soma();
  if (p < fichas.length) throw new Error(fichas[p].t === ")" ? "sobrou um parêntese fechando" : "sobrou algo no fim da expressão");
  return arvore;
}

/** O valor da árvore com a incógnita valendo `x`. */
export function avaliar(n, x = 0) {
  switch (n.t) {
    case "n": return n.v;
    case "x": return x;
    case "neg": return -avaliar(n.a, x);
    case "+": return avaliar(n.a, x) + avaliar(n.b, x);
    case "-": return avaliar(n.a, x) - avaliar(n.b, x);
    case "*": return avaliar(n.a, x) * avaliar(n.b, x);
    case "/": return avaliar(n.a, x) / avaliar(n.b, x);
    case "^": return Math.pow(avaliar(n.a, x), avaliar(n.b, x));
    case "fn": return Math[n.f](avaliar(n.a, x));
    default: return Number.NaN;
  }
}

export const temIncognita = (n) => n.t === "x" || Boolean(n.a && temIncognita(n.a)) || Boolean(n.b && temIncognita(n.b));
export const tamanho = (n) => 1 + (n.a ? tamanho(n.a) : 0) + (n.b ? tamanho(n.b) : 0);
const fatores = (n) => (n.t === "*" ? [...fatores(n.a), ...fatores(n.b)] : [n]);
const ehSoma = (n) => n.t === "+" || n.t === "-";

// Valores de teste longe dos inteiros, onde moram as divisões por zero dos exercícios.
const PONTOS = [-3.7, -2.3, -1.1, -0.4, 0.6, 1.7, 2.9, 4.3];

function iguais(a, b) {
  return Math.abs(a - b) <= 1e-6 * (1 + Math.abs(b));
}

/**
 * As duas expressões são a mesma função? Compara nos valores de teste; um ponto fora do domínio
 * das duas (raiz de negativo, log de zero) é pulado, e é preciso bater em pelo menos 4.
 * Devolve { iguais, x, minha, certa } — no primeiro ponto onde diferem, para a tela explicar.
 */
export function equivalentes(minha, certa) {
  let validos = 0;
  for (const x of PONTOS) {
    const a = avaliar(minha, x), b = avaliar(certa, x);
    if (!Number.isFinite(b)) {
      if (Number.isFinite(a)) return { iguais: false, x, minha: a, certa: b };
      continue;
    }
    if (!Number.isFinite(a) || !iguais(a, b)) return { iguais: false, x, minha: a, certa: b };
    validos++;
  }
  return { iguais: validos >= 4 };
}

/** As formas que um item pode pedir, além de "equivalente". */
export const FORMAS = {
  livre: "qualquer forma equivalente",
  fatorada: "fatorada (um produto de fatores)",
  expandida: "expandida (sem produtos de somas)",
  simplificada: "simplificada",
};

/**
 * A resposta está na forma pedida? `certa` é a árvore da resposta certa (a "simplificada" compara
 * tamanhos: não pode ser bem maior que a certa — senão vale reenviar a própria pergunta).
 */
export function formaAtendida(arvore, forma, certa = null) {
  if (forma === "fatorada") {
    const r = arvore.t === "neg" ? arvore.a : arvore;
    if (r.t === "^") return temIncognita(r.a) && r.a.t !== "x";
    return r.t === "*" && fatores(r).filter(temIncognita).length >= 2;
  }
  if (forma === "expandida") {
    const temProdutoDeSoma = (n) => {
      if (n.t === "*" && fatores(n).some((f) => ehSoma(f) && temIncognita(f))) return true;
      if (n.t === "^" && ehSoma(n.a) && temIncognita(n.a)) return true;
      return Boolean(n.a && temProdutoDeSoma(n.a)) || Boolean(n.b && temProdutoDeSoma(n.b));
    };
    return !temProdutoDeSoma(arvore);
  }
  if (forma === "simplificada") return !certa || tamanho(arvore) <= tamanho(certa) + 2;
  return true;
}

/** Lê um número da resposta: aceita conta ("1/3"), vírgula e unidade no fim ("12 cm", "45°", "30%"). */
export function lerResposta(fonte) {
  let arvore;
  try {
    arvore = analisar(fonte, null);
  } catch (e) {
    // "12 cm", "30%", "45°": tenta de novo sem a unidade do fim (2pi e e continuam sendo números)
    const sem = String(fonte ?? "").trim().replace(/\s*(%|°|º|[a-zA-Zµ]+\d?(\/[a-zA-Z]+\d?)?)\s*$/, "");
    if (!sem || sem === String(fonte ?? "").trim()) throw e;
    arvore = analisar(sem, null);
  }
  const v = avaliar(arvore);
  if (!Number.isFinite(v)) throw new Error("o número não tem valor definido");
  return v;
}

/** O número digitado bate com o certo? Tolerância absoluta do item ou 0,5% do valor certo. */
export function numeroCerto(valor, certo, tolerancia = 0) {
  const t = tolerancia > 0 ? tolerancia : Math.max(1e-9, Math.abs(certo) * 0.005);
  return Math.abs(valor - certo) <= t;
}

/** Um número para a pessoa ler: até 4 casas, vírgula decimal. */
export function formatarNumero(v) {
  if (!Number.isFinite(v)) return "um valor indefinido";
  const r = Math.round(v * 10_000) / 10_000;
  return String(r).replace(".", ",");
}
