"use client";

import { useEffect, useRef } from "react";

/**
 * Painel por cima da tela: sobe de baixo no celular (onde o polegar alcança) e aparece no centro
 * no computador. Fecha com Esc, com o X ou tocando fora.
 */
export default function Folha({ aberta, aoFechar, titulo, children }) {
  const painel = useRef(null);

  useEffect(() => {
    if (!aberta) return undefined;
    const anterior = document.activeElement;
    painel.current?.focus();
    const tecla = (e) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
      anterior?.focus?.();
    };
  }, [aberta, aoFechar]);

  if (!aberta) return null;
  return (
    <div className="folha__fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="folha" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={painel}>
        <div className="folha__topo">
          <span className="folha__alca" aria-hidden="true" />
          <button type="button" className="folha__fechar" onClick={aoFechar} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
