"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reordenar uma lista vertical pela ALÇA (⋮⋮) — os itens da checklist.
 *
 * Por que não o `useArrastar` dos cards: lá o card inteiro é a pega, e por isso o dedo precisa
 * esperar 220ms parado para o arrasto não roubar a rolagem da coluna. Aqui a pega é uma alça
 * que não serve para mais nada, com `touch-action: none` no CSS: o dedo arrasta NA HORA, e
 * rolar a checklist continua sendo arrastar em qualquer outro ponto do item.
 *
 * A lista se reordena AO VIVO enquanto se arrasta: o item na mão troca de lugar com o vizinho
 * quando o ponteiro passa do meio dele. É o que dispensa desenhar um fantasma — o próprio item
 * mostra onde vai cair.
 *
 * `aoSoltar(id, indice)` recebe o índice final contado na lista SEM o item arrastado, o mesmo
 * que `posicaoAoMover` espera.
 */
export function useReordenar({ lista, aoSoltar }) {
  const [emMao, setEmMao] = useState(null); // { id, indice }
  const atual = useRef(null);
  const limpeza = useRef(null);

  useEffect(() => () => limpeza.current?.(), []);

  const segurar = useCallback((evento, id) => {
    if (evento.button != null && evento.button !== 0) return;
    evento.preventDefault();

    const calcular = (y) => {
      const outros = [...(lista.current?.querySelectorAll("[data-item]") || [])]
        .filter((el) => el.dataset.item !== id);
      return outros.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2 < y;
      }).length;
    };

    atual.current = { id, indice: calcular(evento.clientY) };
    setEmMao(atual.current);

    const mover = (ev) => {
      const indice = calcular(ev.clientY);
      if (indice !== atual.current.indice) {
        atual.current = { id, indice };
        setEmMao(atual.current);
      }
    };
    const soltar = () => {
      limpeza.current?.();
      const final = atual.current;
      atual.current = null;
      setEmMao(null);
      if (final) aoSoltar(final.id, final.indice);
    };
    const tecla = (ev) => {
      if (ev.key !== "Escape") return;
      limpeza.current?.();
      atual.current = null;
      setEmMao(null);
    };

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    window.addEventListener("keydown", tecla);
    document.body.classList.add("abacato-arrastando");
    limpeza.current = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      window.removeEventListener("keydown", tecla);
      document.body.classList.remove("abacato-arrastando");
      limpeza.current = null;
    };
  }, [lista, aoSoltar]);

  return { segurar, emMao };
}
