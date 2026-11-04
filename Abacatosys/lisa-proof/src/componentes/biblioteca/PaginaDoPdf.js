"use client";

import { memo, useEffect, useRef, useState } from "react";
import { carregarPdfjs } from "./pdf.js";

/**
 * Uma página do leitor. Só desenha quando está perto da tela (o leitor avisa com `visivel`) e solta
 * a memória quando sai — um livro de 600 páginas não vira 600 imagens na memória.
 *
 * Três camadas, de baixo para cima:
 *   1. o desenho da página (canvas, na densidade da tela);
 *   2. as marcações (destaques, sublinhados, áreas), em fração da página — certas em qualquer zoom;
 *   3. a camada de texto do pdf.js: texto invisível por cima do desenho, que é o que se seleciona.
 * Com a ferramenta "área", uma quarta camada por cima captura o arrastar.
 */
function PaginaDoPdf({ pdf, numero, escala, largura, altura, visivel, marcacoes, termo, ferramenta, corDaArea, aoMedir, aoArea }) {
  const canvas = useRef(null);
  const texto = useRef(null);
  const [desenhada, setDesenhada] = useState(false);
  const [rascunho, setRascunho] = useState(null); // a área sendo arrastada [x, y, l, a]
  const inicio = useRef(null);

  useEffect(() => {
    if (!visivel || !pdf) return undefined;
    let cancelado = false;
    let tarefa = null;
    let camada = null;
    (async () => {
      const pagina = await pdf.getPage(numero);
      if (cancelado) return;
      const base = pagina.getViewport({ scale: 1 });
      aoMedir?.(numero, base.width, base.height);
      const viewport = pagina.getViewport({ scale: escala });
      const densidade = Math.min(window.devicePixelRatio || 1, 2);
      const c = canvas.current;
      c.width = Math.floor(viewport.width * densidade);
      c.height = Math.floor(viewport.height * densidade);
      tarefa = pagina.render({ canvas: c, viewport, transform: densidade !== 1 ? [densidade, 0, 0, densidade, 0, 0] : undefined });
      await tarefa.promise;
      if (cancelado) return;
      setDesenhada(true);
      const { TextLayer } = await carregarPdfjs();
      if (cancelado || !texto.current) return;
      texto.current.replaceChildren();
      camada = new TextLayer({ textContentSource: pagina.streamTextContent(), container: texto.current, viewport });
      await camada.render();
      if (!cancelado) acharTermo(texto.current, termo);
    })().catch((e) => {
      if (e?.name !== "RenderingCancelledException") console.warn(`página ${numero}:`, e?.message || e);
    });
    return () => {
      cancelado = true;
      tarefa?.cancel();
      camada?.cancel();
    };
    // aoMedir é estável (useCallback no leitor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, numero, escala, visivel]);

  // longe da tela: solta a imagem e o texto
  useEffect(() => {
    if (visivel) return;
    if (canvas.current) { canvas.current.width = 0; canvas.current.height = 0; }
    texto.current?.replaceChildren();
    setDesenhada(false);
  }, [visivel]);

  // o termo da busca muda sem redesenhar a página
  useEffect(() => { if (texto.current) acharTermo(texto.current, termo); }, [termo]);

  function pontoNaPagina(e) {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1)];
  }

  return (
    <div
      className={`lp-pagina${desenhada ? "" : " lp-pagina--esperando"}`}
      data-pagina={numero}
      style={{ width: largura, height: altura, "--scale-factor": escala, "--total-scale-factor": escala, "--user-unit": 1 }}
    >
      <canvas ref={canvas} className="lp-pagina__desenho" style={{ width: largura, height: altura }} aria-hidden="true" />
      <div className="lp-marcas" aria-hidden="true">
        {marcacoes.flatMap((m) => m.retangulos.map((r, i) => (
          <span
            key={`${m.id}-${i}`}
            className={`lp-marca lp-marca--${m.tipo} lp-cor--${m.cor}${m.nota ? " lp-marca--com-nota" : ""}`}
            style={{ left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%` }}
          />
        )))}
        {marcacoes.filter((m) => m.nota && m.retangulos.length).map((m) => (
          <span key={`nota-${m.id}`} className="lp-marca__nota" style={{ left: `${(m.retangulos[0][0] + m.retangulos[0][2]) * 100}%`, top: `${m.retangulos[0][1] * 100}%` }}>💬</span>
        ))}
      </div>
      <div ref={texto} className="textLayer lp-texto" />
      {ferramenta === "area" && (
        <div
          className="lp-captura"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); inicio.current = pontoNaPagina(e); setRascunho([...inicio.current, 0, 0]); }}
          onPointerMove={(e) => {
            if (!inicio.current) return;
            const [x, y] = pontoNaPagina(e);
            const [x0, y0] = inicio.current;
            setRascunho([Math.min(x, x0), Math.min(y, y0), Math.abs(x - x0), Math.abs(y - y0)]);
          }}
          onPointerUp={(e) => {
            const r = rascunho;
            inicio.current = null;
            setRascunho(null);
            if (r && r[2] > 0.01 && r[3] > 0.005) aoArea?.(numero, r, { x: e.clientX, y: e.clientY });
          }}
        >
          {rascunho && <span className={`lp-marca lp-marca--area lp-cor--${corDaArea}`} style={{ left: `${rascunho[0] * 100}%`, top: `${rascunho[1] * 100}%`, width: `${rascunho[2] * 100}%`, height: `${rascunho[3] * 100}%` }} />}
        </div>
      )}
      <span className="lp-pagina__numero" aria-hidden="true">{numero}</span>
    </div>
  );
}

/** Pinta na camada de texto os pedaços que têm o termo da busca. */
function acharTermo(camada, termo) {
  const t = String(termo || "").trim().toLowerCase();
  for (const span of camada.querySelectorAll("span")) {
    const tem = t.length >= 2 && span.textContent.toLowerCase().includes(t);
    span.classList.toggle("lp-achado", tem);
  }
}

export default memo(PaginaDoPdf);
