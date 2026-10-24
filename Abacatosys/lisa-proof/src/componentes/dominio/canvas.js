// Desenho em canvas que funciona também nos navegadores sem os recursos mais novos (Modo Domínio).

/**
 * Um retângulo de cantos redondos no canvas. `roundRect` só existe nos navegadores mais novos
 * (Chrome 99, Firefox 112, Safari 16): sem ele, o caminho é feito à mão — senão a primeira
 * plaquinha dava erro e nenhum chefão aparecia na torre.
 */
export function retanguloRedondo(x, px, py, largura, altura, raio) {
  x.beginPath();
  if (typeof x.roundRect === "function") { x.roundRect(px, py, largura, altura, raio); return; }
  const r = Math.min(raio, largura / 2, altura / 2);
  x.moveTo(px + r, py);
  x.arcTo(px + largura, py, px + largura, py + altura, r);
  x.arcTo(px + largura, py + altura, px, py + altura, r);
  x.arcTo(px, py + altura, px, py, r);
  x.arcTo(px, py, px + largura, py, r);
  x.closePath();
}
