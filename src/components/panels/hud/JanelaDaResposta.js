"use client";

// A janela da resposta (01/11/2026): a Lisa escreve aqui, numa janela holográfica flutuante, em vez
// de embaixo do visual. Surge do fundo da cena (uma linha que se abre, como um holograma ligando) e
// fica inclinada na perspectiva da cena (CenaDaLisa.js). Arrasta pela barra de cima (a posição fica
// guardada neste navegador; dois cliques na barra voltam ao lugar de sempre); o × fecha até a próxima
// pergunta. Enquanto a resposta chega, o texto acompanha o fim (a não ser que a pessoa role para
// cima para reler) e um cursor pisca no fim.

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const CHAVE_DA_POSICAO = "lisa-janela-da-resposta";
const SEMPRE_A_VISTA = 90; // quanto da janela fica sempre dentro da cena ao arrastar

/**
 * `estado`: o rótulo da barra (PROCESSANDO, RESPONDENDO, RESPOSTA). `pergunta` e `texto`: o que foi
 * perguntado e a resposta até agora. `digitando`: a resposta ainda está chegando. `children`: o que
 * vem junto (fontes, rascunho do card, código ao vivo, aviso da voz).
 */
export default function JanelaDaResposta({ estado = "RESPOSTA", pergunta = "", texto = "", digitando = false, aoFechar, children }) {
  const raiz = useRef(null);
  const corpo = useRef(null);
  const seguindo = useRef(true); // acompanhando o fim do texto
  const [pos, setPos] = useState(null); // { x, y } arrastada; null = o lugar de sempre

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(CHAVE_DA_POSICAO) || "null");
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) setPos(p);
    } catch { /* sem armazenamento: o lugar de sempre */ }
  }, []);

  // o texto novo chega no fim: a janela rola junto, se a pessoa não subiu para reler
  useLayoutEffect(() => {
    const el = corpo.current;
    if (el && seguindo.current) el.scrollTop = el.scrollHeight;
  }, [texto, children]);
  const aoRolar = () => {
    const el = corpo.current;
    if (el) seguindo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const arrastar = (e) => {
    if (e.target.closest("button") || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = raiz.current;
    const cena = el?.offsetParent;
    if (!el || !cena) return;
    e.preventDefault();
    const caixa = cena.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const inicio = { x: r.left - caixa.left, y: r.top - caixa.top, px: e.clientX, py: e.clientY };
    let ultima = null;
    const limitar = (x, y) => ({
      x: Math.round(Math.min(Math.max(x, SEMPRE_A_VISTA - r.width), caixa.width - SEMPRE_A_VISTA)),
      y: Math.round(Math.min(Math.max(y, 0), caixa.height - 48)),
    });
    const mover = (ev) => { ultima = limitar(inicio.x + ev.clientX - inicio.px, inicio.y + ev.clientY - inicio.py); setPos(ultima); };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      if (ultima) { try { localStorage.setItem(CHAVE_DA_POSICAO, JSON.stringify(ultima)); } catch { /* vale só agora */ } }
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  };
  const voltarAoLugar = () => {
    setPos(null);
    try { localStorage.removeItem(CHAVE_DA_POSICAO); } catch { /* nada guardado */ }
  };

  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div ref={raiz} className="bb-jr" data-arrastada={pos ? "sim" : undefined} style={pos ? { left: pos.x, top: pos.y } : undefined}
      role="region" aria-label="Resposta da Lisa">
      <div className="bb-jr-surge">
        <div className="bb-jr-brilho" aria-hidden="true" />
        <div className="bb-jr-borda">
          <div className="bb-jr-caixa">
            <header className="bb-jr-cabeca" onPointerDown={arrastar} onDoubleClick={voltarAoLugar} title="arraste para mudar de lugar · dois cliques voltam ao lugar de sempre">
              <span className="bb-jr-marca">◇ LISA</span>
              <span className="bb-jr-estado" data-estado={estado}><i />{estado}</span>
              <span className="bb-jr-riscos" aria-hidden="true"><i /><i /><i /><i /></span>
              <button type="button" className="bb-jr-fechar" onClick={aoFechar} aria-label="fechar a janela da resposta" title="fechar (volta na próxima pergunta)">×</button>
            </header>
            <div className="bb-jr-corpo" ref={corpo} onScroll={aoRolar} aria-live="polite">
              {pergunta && <p className="bb-jr-pergunta"><span aria-hidden="true">›</span> {pergunta}</p>}
              {texto ? (
                <p className="bb-jr-texto">{texto}{digitando && <i className="bb-jr-cursor" aria-hidden="true" />}</p>
              ) : (
                <div className="bb-jr-processando" aria-label="processando"><i /><i /><i /><span>processando</span></div>
              )}
              {children}
            </div>
            <footer className="bb-jr-pe" aria-hidden="true">
              <span className="bb-jr-medidor"><i /></span>
              <span>LSA·{hora.replace(":", "")}</span>
            </footer>
          </div>
        </div>
        <span className="bb-jr-canto bb-jr-canto--a" aria-hidden="true" />
        <span className="bb-jr-canto bb-jr-canto--b" aria-hidden="true" />
        <span className="bb-jr-aba" aria-hidden="true" />
      </div>
    </div>
  );
}
