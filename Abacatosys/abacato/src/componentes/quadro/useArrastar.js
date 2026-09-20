"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Arrastar cards e colunas, com o dedo ou com o mouse.
 *
 * Por que não a API de arrastar do HTML: ela simplesmente não existe no toque. `dragstart` e
 * `drop` nunca disparam num celular, e o requisito aqui é que o sistema funcione tão bem no
 * telefone quanto na mesa. Eventos de ponteiro são os mesmos nos dois, e é o que isto usa.
 *
 * As duas diferenças que importam entre dedo e mouse:
 *
 *   MOUSE  começa a arrastar assim que o ponteiro anda alguns pixels com o botão apertado.
 *
 *   DEDO   espera uma pressão de 220ms parada. Sem essa espera, rolar a coluna com o dedo em
 *          cima de um card viraria um arrasto — e a pessoa não conseguiria mais rolar a lista.
 *          Se o dedo andar antes dos 220ms, é rolagem: o arrasto é cancelado e a página rola
 *          normalmente.
 */

const ESPERA_DO_DEDO_MS = 220;
const FOLGA_ATE_ARRASTAR = 6;     // px que o mouse anda antes de virar arrasto
const FOLGA_DO_DEDO = 10;         // px que o dedo pode tremer sem cancelar a espera
const BORDA_DE_ROLAGEM = 72;      // px de margem em que o quadro rola sozinho
const VELOCIDADE_DE_ROLAGEM = 18;

export function useArrastar({ aoSoltarCard, aoSoltarColuna, refDoQuadro }) {
  const [arrasto, setArrasto] = useState(null);   // { tipo, id, deColuna, x, y, dx, dy, largura, altura }
  const [alvo, setAlvo] = useState(null);         // { colunaId, indice } | { indiceDeColuna }
  const estado = useRef({});

  // O `soltar` é montado uma vez, no pointerdown, e por isso enxergaria para sempre o primeiro
  // valor de `alvo`. Este ref é a ponte: ele acompanha o estado e o `soltar` lê dele na hora.
  const alvoAtual = useRef(null);

  const limpar = useCallback(() => {
    const e = estado.current;
    clearTimeout(e.espera);
    cancelAnimationFrame(e.quadroDeRolagem);
    document.removeEventListener("pointermove", e.mover);
    document.removeEventListener("pointerup", e.soltar);
    document.removeEventListener("pointercancel", e.soltar);
    document.removeEventListener("touchmove", e.bloquearRolagem);
    document.removeEventListener("keydown", e.tecla);
    document.body.classList.remove("abacato-arrastando");
    estado.current = {};
    setArrasto(null);
    setAlvo(null);
  }, []);

  useEffect(() => limpar, [limpar]);

  /**
   * Onde o item cairia se fosse solto neste ponto da tela.
   *
   * Usa `elementFromPoint` em vez de guardar as medidas de tudo no começo do arrasto: as
   * medidas mudam enquanto se arrasta — a coluna rola, o espaço reservado abre e fecha — e uma
   * lista de retângulos tirada no início erra o alvo depois do primeiro movimento.
   */
  function calcularAlvo(x, y, tipo, idArrastado) {
    const sob = document.elementFromPoint(x, y);
    if (!sob) return null;

    if (tipo === "coluna") {
      const colunas = [...(refDoQuadro.current?.querySelectorAll("[data-coluna]") || [])];
      let indice = colunas.filter((el) => {
        if (el.dataset.coluna === idArrastado) return false;
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2 < x;
      }).length;
      return { indiceDeColuna: indice };
    }

    const colunaEl = sob.closest("[data-coluna]");
    if (!colunaEl) return null;

    const cards = [...colunaEl.querySelectorAll("[data-card]")].filter((el) => el.dataset.card !== idArrastado);
    // Conta quantos cards têm o meio acima do ponteiro. Comparar pelo MEIO, e não pelo topo,
    // é o que faz o espaço abrir do lado certo quando se passa devagar por cima de um card.
    const indice = cards.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2 < y;
    }).length;

    return { colunaId: colunaEl.dataset.coluna, indice };
  }

  /** Rola o quadro sozinho quando o ponteiro chega perto da borda — senão não há como levar um
   *  card para uma coluna que está fora da tela. */
  function rolarSePerto(x) {
    const e = estado.current;
    const caixa = refDoQuadro.current;
    if (!caixa) return;
    const r = caixa.getBoundingClientRect();
    let passo = 0;
    if (x < r.left + BORDA_DE_ROLAGEM) passo = -VELOCIDADE_DE_ROLAGEM;
    else if (x > r.right - BORDA_DE_ROLAGEM) passo = VELOCIDADE_DE_ROLAGEM;

    cancelAnimationFrame(e.quadroDeRolagem);
    if (!passo) return;
    const seguir = () => {
      caixa.scrollLeft += passo;
      e.quadroDeRolagem = requestAnimationFrame(seguir);
    };
    e.quadroDeRolagem = requestAnimationFrame(seguir);
  }

  const iniciar = useCallback((evento, item) => {
    // Só botão principal. Botão do meio cola texto no Linux e o direito abre menu — nenhum dos
    // dois deveria arrastar um card.
    if (evento.button != null && evento.button !== 0) return;
    if (evento.target.closest("button, a, input, textarea, select, [data-nao-arrasta]")) return;

    const alvoDom = evento.currentTarget;
    const r = alvoDom.getBoundingClientRect();
    const e = estado.current;
    const dedo = evento.pointerType === "touch";

    e.item = item;
    e.inicioX = evento.clientX;
    e.inicioY = evento.clientY;
    e.dx = evento.clientX - r.left;
    e.dy = evento.clientY - r.top;
    e.largura = r.width;
    e.altura = r.height;
    e.ativo = false;

    const comecarDeVerdade = (x, y) => {
      e.ativo = true;
      document.body.classList.add("abacato-arrastando");
      setArrasto({ ...item, x, y, dx: e.dx, dy: e.dy, largura: e.largura, altura: e.altura });
      setAlvo(calcularAlvo(x, y, item.tipo, item.id));
    };

    e.mover = (ev) => {
      const andou = Math.hypot(ev.clientX - e.inicioX, ev.clientY - e.inicioY);

      if (!e.ativo) {
        if (dedo) {
          // Andou antes da espera terminar: isto é rolagem, não arrasto.
          if (andou > FOLGA_DO_DEDO) limpar();
          return;
        }
        if (andou < FOLGA_ATE_ARRASTAR) return;
        comecarDeVerdade(ev.clientX, ev.clientY);
      }

      setArrasto((a) => (a ? { ...a, x: ev.clientX, y: ev.clientY } : a));
      const novo = calcularAlvo(ev.clientX, ev.clientY, e.item.tipo, e.item.id);
      if (novo) setAlvo(novo);
      rolarSePerto(ev.clientX);
    };

    e.soltar = () => {
      const chegouAArrastar = e.ativo;
      const oQueFoi = e.item;
      const destino = chegouAArrastar ? alvoAtual.current : null;
      limpar();
      if (!chegouAArrastar || !destino) return;
      if (oQueFoi.tipo === "coluna") {
        if (destino.indiceDeColuna != null) aoSoltarColuna?.(oQueFoi.id, destino.indiceDeColuna);
      } else if (destino.colunaId) {
        aoSoltarCard?.(oQueFoi.id, destino.colunaId, destino.indice);
      }
    };

    e.tecla = (ev) => { if (ev.key === "Escape") limpar(); };

    // Enquanto o arrasto do dedo estiver valendo, a página não rola. `passive: false` é o que
    // permite o `preventDefault`; sem ele o navegador ignora o pedido e rola assim mesmo.
    e.bloquearRolagem = (ev) => { if (e.ativo) ev.preventDefault(); };

    document.addEventListener("pointermove", e.mover);
    document.addEventListener("pointerup", e.soltar);
    document.addEventListener("pointercancel", e.soltar);
    document.addEventListener("touchmove", e.bloquearRolagem, { passive: false });
    document.addEventListener("keydown", e.tecla);

    if (dedo) {
      e.espera = setTimeout(() => {
        if (estado.current === e) comecarDeVerdade(e.inicioX, e.inicioY);
      }, ESPERA_DO_DEDO_MS);
    }
  }, [limpar, aoSoltarCard, aoSoltarColuna, refDoQuadro]);

  useEffect(() => { alvoAtual.current = alvo; }, [alvo]);

  return { iniciar, arrasto, alvo };
}
