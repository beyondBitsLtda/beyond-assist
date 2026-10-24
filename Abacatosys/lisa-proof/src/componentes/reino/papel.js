// O efeito de papel do Reino (o jeito do Paper Mario): o desenho vira uma imagem com borda branca
// de adesivo e uma sombrinha. Usado pelo mundo 3D do Reino e pela torre do Modo Domínio. Só navegador.

/** Copia o SVG do Neuro (com as cores calculadas pelo CSS) para uma imagem. */
export function svgComoImagem(svg) {
  const copia = svg.cloneNode(true);
  const originais = svg.querySelectorAll("*");
  const copias = copia.querySelectorAll("*");
  originais.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const c = copias[i];
    for (const prop of ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "display"]) {
      const v = cs.getPropertyValue(prop);
      if (v) c.setAttribute(prop, v);
    }
    if (el.classList.contains("neuro__sombra")) c.setAttribute("display", "none");
    c.removeAttribute("class");
    c.removeAttribute("style");
  });
  copia.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copia.setAttribute("width", "400");
  copia.setAttribute("height", "400");
  copia.removeAttribute("class");
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(copia));
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = erro;
    img.src = url;
  });
}

/** A imagem com borda branca de adesivo e uma sombrinha de papel. */
export function recorteDePapel(img) {
  const T = 512, margem = 30, lado = T - margem * 2;
  const silhueta = (cor) => {
    const c = document.createElement("canvas");
    c.width = c.height = T;
    const x = c.getContext("2d");
    x.drawImage(img, margem, margem, lado, lado);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = cor;
    x.fillRect(0, 0, T, T);
    return c;
  };
  const c = document.createElement("canvas");
  c.width = c.height = T;
  const ctx = c.getContext("2d");
  const sombra = silhueta("rgba(0,0,0,0.18)");
  const branca = silhueta("#ffffff");
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.drawImage(sombra, Math.cos(a) * 11 + 2, Math.sin(a) * 11 + 5);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.drawImage(branca, Math.cos(a) * 10, Math.sin(a) * 10);
  }
  ctx.drawImage(img, margem, margem, lado, lado);
  return c;
}
