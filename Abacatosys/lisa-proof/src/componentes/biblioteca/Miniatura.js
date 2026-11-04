"use client";

import { memo, useEffect, useRef, useState } from "react";

/** A miniatura de uma página no painel do leitor: só desenha quando aparece na lista. */
function Miniatura({ pdf, numero, largura = 110 }) {
  const caixa = useRef(null);
  const canvas = useRef(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisivel(true); io.disconnect(); } }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel || !pdf) return undefined;
    let tarefa = null;
    let cancelado = false;
    (async () => {
      const pagina = await pdf.getPage(numero);
      if (cancelado) return;
      const base = pagina.getViewport({ scale: 1 });
      const viewport = pagina.getViewport({ scale: largura / base.width });
      const c = canvas.current;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      tarefa = pagina.render({ canvas: c, viewport });
      await tarefa.promise;
    })().catch(() => {});
    return () => { cancelado = true; tarefa?.cancel(); };
  }, [visivel, pdf, numero, largura]);

  return (
    <span ref={caixa} className="lp-miniatura" style={{ width: largura }}>
      <canvas ref={canvas} aria-hidden="true" />
    </span>
  );
}

export default memo(Miniatura);
