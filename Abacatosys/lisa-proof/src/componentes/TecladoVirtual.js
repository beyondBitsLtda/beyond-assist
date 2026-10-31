"use client";

import { useEffect } from "react";

// O teclado do celular e do tablet (pedido de 31/10/2026: "a parte de escrita nas notas e cadernos e
// de leitura funcionando super bem em tablets e celulares").
//
// O teclado virtual não encolhe a página: no iPhone e no Android ele cobre a parte de baixo, e o
// que estava lá (o fim do editor, a barra de abas, o botão de gravar) some atrás dele. Aqui a página
// fica sabendo:
//   --pf-vv-altura e --pf-vv-topo  a área que se vê de verdade (a visualViewport), em px;
//   html.pf-teclado                alguém está digitando num aparelho de toque.
// O CSS usa isso para tirar a barra de abas do caminho e encaixar o caderno e as caixas de nota na
// área acima do teclado.

const DIGITAVEL = [
  "textarea", '[contenteditable="true"]', '[contenteditable=""]',
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="color"])',
].join(", ");

export default function AcompanharTeclado() {
  useEffect(() => {
    const raiz = document.documentElement;
    const toque = window.matchMedia("(pointer: coarse)");
    const vv = window.visualViewport;
    let quadro = 0;

    const medir = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        raiz.style.setProperty("--pf-vv-altura", `${Math.round(vv ? vv.height : window.innerHeight)}px`);
        raiz.style.setProperty("--pf-vv-topo", `${Math.round(vv ? vv.offsetTop : 0)}px`);
      });
    };
    // o foco muda em dois passos (sai de um, entra no outro): lê depois que assentou
    let espera = 0;
    const focoMudou = () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        const el = document.activeElement;
        const digitando = toque.matches && Boolean(el?.matches?.(DIGITAVEL)) && !el.readOnly && !el.disabled;
        raiz.classList.toggle("pf-teclado", digitando);
        medir();
      }, 30);
    };

    medir();
    document.addEventListener("focusin", focoMudou);
    document.addEventListener("focusout", focoMudou);
    vv?.addEventListener("resize", medir);
    vv?.addEventListener("scroll", medir);
    window.addEventListener("resize", medir);
    return () => {
      cancelAnimationFrame(quadro);
      clearTimeout(espera);
      document.removeEventListener("focusin", focoMudou);
      document.removeEventListener("focusout", focoMudou);
      vv?.removeEventListener("resize", medir);
      vv?.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      raiz.classList.remove("pf-teclado");
    };
  }, []);
  return null;
}
