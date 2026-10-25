"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  dimensoesDoLivro, corDaLombada, estiloDaLombada, corDoTextoDaLombada, corMediaDosPixels, tonalizar, arrumarPrateleiras,
  situacaoNaLombada, descricaoDoLivro,
} from "@/dominio/estante.js";
import { formatarTamanho } from "@/dominio/biblioteca.js";

// a cor tirada de cada capa, guardada para não medir de novo a cada desenho
const coresDasCapas = new Map();

/** A cor da lombada a partir da capa (a miniatura em data URL), ou null se a capa é branca. */
function useCorDaCapa(capa) {
  const [cor, setCor] = useState(() => (capa && coresDasCapas.has(capa) ? coresDasCapas.get(capa) : null));
  useEffect(() => {
    if (!capa) return undefined;
    if (coresDasCapas.has(capa)) { setCor(coresDasCapas.get(capa)); return undefined; }
    let vivo = true;
    const img = new Image();
    img.src = capa;
    img.decode().then(() => {
      const c = document.createElement("canvas");
      c.width = 24;
      c.height = 32;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const media = corMediaDosPixels(ctx.getImageData(0, 0, c.width, c.height).data);
      coresDasCapas.set(capa, media);
      if (vivo) setCor(media);
    }).catch(() => coresDasCapas.set(capa, null));
    return () => { vivo = false; };
  }, [capa]);
  return cor;
}

/**
 * Um livro em 3D: uma caixa de seis faces (lombada, capa, contracapa, topo, corte e base), com a
 * espessura do número de páginas. Na prateleira mostra a lombada; ao passar o mouse sai da fila e
 * gira mostrando a capa. `escala` aumenta o livro (o destaque usa 1,5).
 */
export function Livro3D({ livro, escala = 1, como = "button", ...props }) {
  const { altura, largura, espessura } = dimensoesDoLivro(livro, escala);
  const corDaCapa = useCorDaCapa(livro.capa);
  const cor = corDaCapa || corDaLombada(livro.id || livro.titulo);
  const texto = corDoTextoDaLombada(cor);
  const estilo = estiloDaLombada(livro.id || livro.titulo);
  const situacao = situacaoNaLombada(livro);
  const Elemento = como;
  return (
    <Elemento
      className={`es-livro es-livro--${estilo.fonte}${situacao.preparando ? " es-livro--preparando" : ""}`}
      style={{
        "--t": `${espessura}px`, "--h": `${altura}px`, "--w": `${largura}px`,
        "--cor": cor, "--cor-escura": tonalizar(cor, 0.35), "--cor-clara": tonalizar(cor, -0.18), "--texto": texto,
      }}
      aria-label={descricaoDoLivro(livro)}
      title={livro.titulo}
      {...(como === "button" ? { type: "button" } : {})}
      {...props}
    >
      <span className={`es-face es-lombada es-lombada--${estilo.filetes}`}>
        <span className="es-lombada__filete es-lombada__filete--topo" aria-hidden="true" />
        <span className="es-lombada__titulo">{livro.titulo}</span>
        {livro.autor && espessura >= 34 && <span className="es-lombada__autor">{livro.autor}</span>}
        <span className="es-lombada__selos" aria-hidden="true">
          {situacao.curso && <span className="es-selo" title="Virou curso">🎓</span>}
          {situacao.lido && <span className="es-selo es-selo--lido" title="Lido">✓</span>}
        </span>
        <span className="es-lombada__filete es-lombada__filete--base" aria-hidden="true" />
        {situacao.lendo && <span className="es-marcador" aria-hidden="true" title={`${livro.progresso}% lido`} />}
      </span>
      <span className="es-face es-capa" aria-hidden="true">
        {livro.capa ? <img src={livro.capa} alt="" loading="lazy" draggable={false} /> : <span className="es-capa__titulo">{livro.titulo}</span>}
        <span className="es-capa__brilho" />
      </span>
      <span className="es-face es-contracapa" aria-hidden="true" />
      <span className="es-face es-topo" aria-hidden="true" />
      <span className="es-face es-corte" aria-hidden="true" />
      <span className="es-face es-base" aria-hidden="true" />
    </Elemento>
  );
}

/**
 * A estante (25/10/2026): os livros em pé nas prateleiras de madeira, mostrando as lombadas. As
 * prateleiras se arrumam pela largura da tela; no fim da última, um "livro fantasma" para subir PDF.
 * Tocar num livro abre o destaque, com a capa, as informações e o que fazer com ele.
 */
export default function Estante({ livros, aoSubir, aoApagar }) {
  const caixa = useRef(null);
  const [largura, setLargura] = useState(0);
  const [aberto, setAberto] = useState(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setLargura(el.clientWidth));
    ro.observe(el);
    setLargura(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const escala = largura && largura < 560 ? 0.78 : 1;
  // o fantasma ocupa a espessura dele mais a margem de 56 px que o separa do último livro
  const fantasma = { id: "fantasma", espessura: Math.round(46 * escala) + 56 };
  const fileiras = useMemo(() => {
    if (!largura) return [];
    const itens = livros.map((livro) => ({ livro, ...dimensoesDoLivro(livro, escala) }));
    // 2 × 22 px de moldura, 2 × 12 px de respiro dentro da prateleira
    return arrumarPrateleiras([...itens, fantasma], largura - 68, { vao: 3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livros, largura, escala]);

  // o livro aberto acompanha a lista (depois de apagar, ele some)
  const livroAberto = aberto ? livros.find((l) => l.id === aberto) : null;

  return (
    <div className="es-estante" ref={caixa}>
      <div className="es-moldura">
        {fileiras.map((fila, i) => (
          <div key={i} className="es-prateleira">
            <div className="es-livros">
              {fila.map((item) => (item.id === "fantasma" ? (
                <button key="fantasma" type="button" className="es-fantasma" style={{ "--t": `${item.espessura - 56}px`, "--h": `${Math.round(200 * escala)}px` }} onClick={aoSubir} aria-label="Subir PDF" title="Subir PDF">
                  <span>＋</span>
                </button>
              ) : (
                <Livro3D key={item.livro.id} livro={item.livro} escala={escala} onClick={() => setAberto(item.livro.id)} />
              )))}
            </div>
            <div className="es-tabua" aria-hidden="true" />
          </div>
        ))}
      </div>
      {livroAberto && <LivroEmDestaque livro={livroAberto} aoFechar={() => setAberto(null)} aoApagar={aoApagar} />}
    </div>
  );
}

/** O livro tirado da estante: ele vem para a frente e gira mostrando a capa, com o que fazer com ele. */
function LivroEmDestaque({ livro, aoFechar, aoApagar }) {
  const principal = useRef(null);
  useEffect(() => {
    const anterior = document.activeElement;
    principal.current?.focus({ preventScroll: true });
    const tecla = (e) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("keydown", tecla); anterior?.focus?.({ preventScroll: true }); };
  }, [aoFechar]);
  const situacao = situacaoNaLombada(livro);
  const podeCurso = livro.status === "pronto" && livro.paginasComTexto > 0;
  // no celular o livro em destaque é menor, para não cobrir o título embaixo dele
  const [escala] = useState(() => (typeof window !== "undefined" && window.innerWidth < 640 ? 1.05 : 1.45));
  return (
    <div className="es-destaque" role="dialog" aria-modal="true" aria-label={livro.titulo} onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="es-destaque__caixa">
        <button type="button" className="es-destaque__fechar" onClick={aoFechar} aria-label="Fechar">✕</button>
        <div className="es-destaque__palco" aria-hidden="true">
          <Livro3D livro={livro} escala={escala} como="span" tabIndex={-1} />
          <span className="es-destaque__sombra" />
        </div>
        <div className="es-destaque__info">
          <h2>{livro.titulo}</h2>
          {livro.autor && <p className="es-destaque__autor">{livro.autor}</p>}
          <p className="es-destaque__meta">
            {livro.paginas} páginas · {formatarTamanho(livro.tamanho)}
            {livro.marcacoes ? ` · 🖍️ ${livro.marcacoes} marcaç${livro.marcacoes === 1 ? "ão" : "ões"}` : ""}
            {livro.cursos ? ` · 🎓 ${livro.cursos} curso${livro.cursos === 1 ? "" : "s"}` : ""}
          </p>
          <div className="es-destaque__progresso" aria-label={`${livro.progresso}% lido`}>
            <span><i style={{ width: `${situacao.lido ? 100 : livro.progresso}%` }} /></span>
            <small>{situacao.lido ? "Lido até o fim ✓" : livro.progresso > 1 ? `${livro.progresso}% lido · parou na p. ${livro.ultimaPagina}` : "Ainda não aberto"}</small>
          </div>
          {situacao.preparando && <p className="pf-pilula pf-pilula--atencao">{livro.status === "enviando" ? "envio incompleto" : "texto incompleto — abra para terminar"}</p>}
          {livro.status === "pronto" && !livro.paginasComTexto && <p className="pf-pilula">PDF sem texto (escaneado): lê e marca por área</p>}
          <div className="es-destaque__acoes">
            <Link ref={principal} href={`/biblioteca/${livro.id}${livro.progresso > 1 && !situacao.lido ? `?pagina=${livro.ultimaPagina}` : ""}`} className="pf-botao">
              📖 {livro.progresso > 1 && !situacao.lido ? `Continuar da p. ${livro.ultimaPagina}` : "Ler"}
            </Link>
            {podeCurso && <Link href={`/trilhas/novo?livro=${livro.id}`} className="pf-botao pf-botao--sec">🎓 Gerar curso</Link>}
            <button type="button" className="pf-botao pf-botao--perigo pf-botao--pequeno" onClick={() => aoApagar(livro)}>🗑️ Apagar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
