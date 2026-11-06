// O MODO LEITURA da biblioteca (pedido de 06/11/2026): "o modo e-reader elegante, com a interface limpa,
// que funcione perfeitamente adaptado tanto no desktop, em tablets ou celulares… focada na leitura, com
// animação de passar página".
//
// As contas do livro aberto: as VISTAS (o que aparece de cada vez — uma página, ou duas lado a lado, com a
// capa sozinha à direita como num livro de verdade), o tamanho das páginas na tela, o ângulo da folha que
// segue o dedo (ou o mouse) e quando o arrasto vira a página. O desenho mora em
// src/componentes/biblioteca/LeitorLivro.js.
//
// Puro: sem React, sem DOM.

export const LAYOUTS_DO_LIVRO = ["auto", "uma", "duas"];
export const ANIMACOES_DO_LIVRO = ["virar", "deslizar", "nenhuma"];

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * As vistas do livro. Uma página: [[1], [2], …]. Duas: a capa sozinha à direita ([null, 1]) e depois os
 * pares par/ímpar ([2, 3], [4, 5]…), como um livro aberto; a última pode ficar sem a da direita.
 */
export function vistasDoLivro(total, duas) {
  const n = Math.max(0, Math.floor(total) || 0);
  if (!n) return [];
  if (!duas) return Array.from({ length: n }, (_, i) => [i + 1]);
  const vistas = [[null, 1]];
  for (let p = 2; p <= n; p += 2) vistas.push([p, p + 1 <= n ? p + 1 : null]);
  return vistas;
}

/** A vista em que a página `n` aparece. */
export function vistaDaPagina(n, total, duas) {
  const p = limitar(Math.floor(n) || 1, 1, Math.max(1, total || 1));
  if (!duas) return p - 1;
  return p === 1 ? 0 : Math.floor(p / 2);
}

/** A página que vale como "onde parou" numa vista: a primeira que existe nela. */
export const paginaDaVista = (vista) => (vista || []).find((p) => p != null) ?? 1;

/**
 * O tamanho do livro na tela. `proporcao`: largura ÷ altura da página. Duas páginas lado a lado quando a
 * pessoa pede, ou no automático com a tela deitada e larga (o tablet de lado, o computador); de pé ou
 * estreita, uma página só. As margens encolhem no celular.
 */
export function layoutDoLivro({ largura, altura, proporcao = 0.7727, preferencia = "auto" }) {
  const W = Math.max(200, largura || 0), H = Math.max(200, altura || 0);
  const celular = W < 600;
  const mh = celular ? 10 : 36;
  const mv = celular ? 14 : 30;
  const p = proporcao > 0.2 && proporcao < 5 ? proporcao : 0.7727;
  const duas = preferencia === "duas" ? W >= 480 : preferencia === "uma" ? false : W >= 900 && W > H * 1.15;
  const larguraUtil = duas ? (W - 2 * mh) / 2 : W - 2 * mh;
  const alturaDaPagina = Math.floor(Math.min(H - 2 * mv, larguraUtil / p));
  const larguraDaPagina = Math.floor(alturaDaPagina * p);
  return {
    duas,
    pagina: { largura: larguraDaPagina, altura: alturaDaPagina },
    livro: { largura: duas ? larguraDaPagina * 2 : larguraDaPagina, altura: alturaDaPagina },
  };
}

/**
 * O ângulo da folha que segue o dedo, em graus. A borda solta da folha fica embaixo do dedo: a folha gira
 * em volta da lombada, e a sua borda, vista de frente, está a cos(ângulo) × largura da lombada.
 *   frente (próxima): a folha da direita, de 0 a −180 (a lombada é a borda esquerda dela)
 *   trás (anterior), duas páginas: a folha da esquerda, de 0 a +180 (a lombada é a borda direita dela)
 * `x`: onde está o dedo; `lombada`: o x da lombada; `larguraDaPagina`: a largura de uma página.
 */
export function anguloDoArrasto({ direcao, x, lombada, larguraDaPagina }) {
  const l = Math.max(1, larguraDaPagina);
  if (direcao === "frente") {
    const graus = (Math.acos(limitar((x - lombada) / l, -1, 1)) * 180) / Math.PI;
    return graus ? -graus : 0; // sem o "−0" da folha deitada
  }
  return (Math.acos(limitar((lombada - x) / l, -1, 1)) * 180) / Math.PI;
}

/** O quanto da virada já foi (0 a 1), pelo ângulo. */
export const progressoDoAngulo = (angulo) => limitar(Math.abs(angulo) / 180, 0, 1);

/**
 * Soltou o dedo: a página vira ou volta? Vira passando da metade, ou com um puxão rápido para o lado certo
 * (`velocidade` em px/ms, negativa = para a esquerda).
 */
export function deveVirar({ progresso, velocidade = 0, direcao }) {
  const aFavor = direcao === "frente" ? velocidade < -0.35 : velocidade > 0.35;
  const contra = direcao === "frente" ? velocidade > 0.35 : velocidade < -0.35;
  if (contra) return false;
  return aFavor || progresso > 0.5;
}

/** A suavização da virada animada (devagar no começo e no fim, como a mão virando a folha). */
export function suavizar(t) {
  const x = limitar(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** Quanto tempo a animação leva para andar `fracao` da virada (a virada inteira, ~0,6 s). */
export const duracaoDaVirada = (fracao) => Math.round(180 + 420 * limitar(fracao, 0, 1));

/**
 * O capítulo da página (pelo sumário do PDF) e quantas páginas faltam para ele acabar — o "faltam 6
 * páginas neste capítulo" do rodapé. Usa os itens de nível 1 (ou o menor nível que houver).
 */
export function capituloDaPagina(sumario, pagina, total) {
  const itens = (Array.isArray(sumario) ? sumario : []).filter((s) => s && s.pagina >= 1).sort((a, b) => a.pagina - b.pagina);
  if (!itens.length) return null;
  const nivel = Math.min(...itens.map((s) => s.nivel || 1));
  const capitulos = itens.filter((s) => (s.nivel || 1) === nivel);
  let atual = null, proximo = null;
  for (let i = 0; i < capitulos.length; i++) {
    if (capitulos[i].pagina <= pagina) { atual = capitulos[i]; proximo = capitulos[i + 1] || null; }
  }
  if (!atual) return null;
  const fim = proximo ? proximo.pagina - 1 : Math.max(pagina, total || pagina);
  return { titulo: atual.titulo, faltam: Math.max(0, fim - pagina) };
}

/** O texto do rodapé: "Página 12 de 340 · faltam 6 páginas neste capítulo". */
export function rodapeDaLeitura({ pagina, total, capitulo }) {
  const base = `Página ${pagina} de ${total}`;
  if (!capitulo) return base;
  if (capitulo.faltam === 0) return `${base} · última página do capítulo`;
  return `${base} · ${capitulo.faltam === 1 ? "falta 1 página" : `faltam ${capitulo.faltam} páginas`} neste capítulo`;
}
