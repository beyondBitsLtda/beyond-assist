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

/**
 * Soltar um arrasto em cima de onde ele começou faz o navegador disparar um `click` ali. Num
 * card isso abriria o card; no nome da coluna, abriria a renomeação — logo depois de a pessoa
 * só querer mudar a coluna de lugar. O clique que vem colado no fim de um arrasto é engolido,
 * na fase de captura, antes de chegar a qualquer botão.
 */
function engolirOProximoClique() {
  const engolir = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
  window.addEventListener("click", engolir, { capture: true, once: true });
  // O clique, quando vem, chega no mesmo ciclo do pointerup. Se não vier (soltou longe de onde
  // começou), a armadilha não pode ficar armada e comer o próximo clique de verdade.
  setTimeout(() => window.removeEventListener("click", engolir, { capture: true }), 0);
}

/**
 * `alvoEm(x, y, item)` e `aoSoltar(item, alvo)` são opcionais e servem a quem não é a faixa de
 * colunas — o calendário, onde o alvo é um DIA, e não uma coluna e um índice. O resto (dedo x
 * mouse, espera de 220ms, rolagem na borda, o clique engolido no fim) é o mesmo, e é por isso
 * que o calendário usa este hook em vez de ter um arrastar só dele.
 */
export function useArrastar({ aoSoltarCard, aoSoltarColuna, refDoQuadro, alvoEm, aoSoltar }) {
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
    if (alvoEm) return alvoEm(x, y, { tipo, id: idArrastado });
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
    // Controles não arrastam — exceto os marcados com `data-arrastavel`. O nome da coluna é um
    // botão (clicar renomeia) e ocupa quase o cabeçalho inteiro: sem a exceção, sobrava um
    // cantinho vazio para pegar a coluna, e arrastar coluna parecia simplesmente não existir.
    // Clique e arrasto não brigam: o arrasto só começa depois de o ponteiro ANDAR.
    const controle = evento.target.closest("button, a, input, textarea, select, [data-nao-arrasta]");
    if (controle && !controle.hasAttribute("data-arrastavel")) return;

    // A coluna é pega pelo CABEÇALHO, mas o que se arrasta é a coluna inteira: medir só o
    // cabeçalho deixaria o espaço reservado com 40px de altura, e o fantasma fora de posição.
    const alvoDom = item.tipo === "coluna"
      ? evento.currentTarget.closest("[data-coluna]") || evento.currentTarget
      : evento.currentTarget;
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
      if (chegouAArrastar) engolirOProximoClique();
      if (!chegouAArrastar || !destino) return;
      if (aoSoltar) { aoSoltar(oQueFoi, destino); return; }
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
  }, [limpar, aoSoltarCard, aoSoltarColuna, refDoQuadro, alvoEm, aoSoltar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { alvoAtual.current = alvo; }, [alvo]);

  return { iniciar, arrasto, alvo };
}
