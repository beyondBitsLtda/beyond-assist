// A geometria de uma janela flutuante — o editor da Lisa (src/components/panels/IdeDaLisa.js):
// arrastar para qualquer lugar, redimensionar pelas bordas e pelos cantos, e nunca sumir de vez
// (pedido de 24/10/2026: "uma janela que eu posso pôr onde eu quiser e aumentar livremente").
//
// Pode sair parcialmente da tela, como uma janela de verdade, mas um pedaço sempre fica à vista e
// a barra de título fica sempre ao alcance, para dar para puxar de volta. Puro: `tela` é
// { w, h } da janela do navegador. Testado por `npm run codigo-check`.

/** O menor tamanho: ainda cabe a barra de título, as abas e umas linhas de código. */
export const MINIMO = { w: 300, h: 180 };
const SEMPRE_A_VISTA = 80; // na horizontal, quanto da janela fica sempre dentro da tela
const BARRA = 36;          // a altura da barra de título: ela nunca sai por baixo da tela

/** Onde a janela nasce: no canto direito, sem cobrir a conversa; no celular, quase a largura toda. */
export function caixaInicial(tela) {
  const w = Math.min(tela.w - 16, 640);
  const h = Math.min(Math.round(tela.h * 0.62), 480);
  return ajustarCaixa({ x: tela.w - w - 24, y: tela.w < 700 ? 64 : 84, w, h }, tela);
}

/** A caixa dentro das regras: tamanho entre o mínimo e a tela, e um pedaço sempre à vista. */
export function ajustarCaixa(c, tela) {
  const w = Math.round(Math.min(Math.max(Number(c?.w) || MINIMO.w, MINIMO.w), Math.max(MINIMO.w, tela.w)));
  const h = Math.round(Math.min(Math.max(Number(c?.h) || MINIMO.h, MINIMO.h), Math.max(MINIMO.h, tela.h)));
  const x = Math.round(Math.min(Math.max(Number(c?.x) || 0, SEMPRE_A_VISTA - w), tela.w - SEMPRE_A_VISTA));
  const y = Math.round(Math.min(Math.max(Number(c?.y) || 0, 0), tela.h - BARRA));
  return { x, y, w, h };
}

/** Arrastar pela barra de título: a caixa anda junto com o ponteiro. */
export function moverCaixa(inicio, dx, dy, tela) {
  return ajustarCaixa({ ...inicio, x: inicio.x + dx, y: inicio.y + dy }, tela);
}

/**
 * Redimensionar puxando uma borda ou um canto: `direcao` é "n", "s", "e", "w" ou a combinação de
 * um canto ("ne", "nw", "se", "sw"). A borda do lado oposto fica parada — puxar a esquerda para a
 * esquerda aumenta a janela sem mexer na direita, como em qualquer sistema de janelas.
 */
export function redimensionarCaixa(inicio, direcao, dx, dy, tela) {
  let { x, y, w, h } = inicio;
  if (direcao.includes("e")) w = Math.max(MINIMO.w, inicio.w + dx);
  if (direcao.includes("s")) h = Math.max(MINIMO.h, inicio.h + dy);
  if (direcao.includes("w")) {
    const direita = inicio.x + inicio.w;
    w = Math.max(MINIMO.w, inicio.w - dx);
    x = direita - w;
  }
  if (direcao.includes("n")) {
    const baixo = inicio.y + inicio.h;
    y = Math.max(0, inicio.y + dy);           // o topo não passa da tela (a barra some)
    h = Math.max(MINIMO.h, baixo - y);
    y = baixo - h;
  }
  return ajustarCaixa({ x, y, w, h }, tela);
}

/** A caixa guardada no navegador, se ainda serve para esta tela (senão, a do canto). */
export function caixaGuardada(guardada, tela) {
  const ok = guardada && ["x", "y", "w", "h"].every((k) => Number.isFinite(Number(guardada[k])));
  return ok ? ajustarCaixa(guardada, tela) : caixaInicial(tela);
}
