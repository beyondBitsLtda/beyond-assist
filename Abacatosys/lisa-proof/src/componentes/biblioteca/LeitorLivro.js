"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  vistasDoLivro, vistaDaPagina, layoutDoLivro, anguloDoArrasto, progressoDoAngulo, deveVirar, suavizar, duracaoDaVirada,
  capituloDaPagina, rodapeDaLeitura,
} from "@/dominio/ereader.js";

const NOMES_DOS_TEMAS = { claro: "Claro", sepia: "Sépia", escuro: "Noite" };
const NOMES_DOS_LAYOUTS = { auto: "Automático", uma: "Uma página", duas: "Duas páginas" };
const NOMES_DAS_ANIMACOES = { virar: "Virar a folha", deslizar: "Deslizar", nenhuma: "Sem animação" };
const ICONES_DO_TIPO = { destaque: "🖍️", sublinhado: "＿", area: "▭", marcador: "🔖" };
const MAXIMO_EM_CACHE = 14;
const ehToque = (e) => e.pointerType === "touch" || e.pointerType === "pen";
const saiDeAnimacao = (t) => 1 - (1 - t) ** 3; // ao soltar o dedo: a folha já está andando, só desacelera

/** Desenha uma página do PDF num canvas, na altura pedida e na densidade da tela. */
async function desenharPagina(pdf, n, alturaCss) {
  const pagina = await pdf.getPage(n);
  const base = pagina.getViewport({ scale: 1 });
  const densidade = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = pagina.getViewport({ scale: Math.min(5, (alturaCss / base.height) * densidade) });
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.floor(viewport.width));
  c.height = Math.max(1, Math.floor(viewport.height));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  await pagina.render({ canvas: c, viewport }).promise;
  return { canvas: c, url: null, proporcao: base.width / base.height, altura: alturaCss };
}

/** O canvas vira JPEG (pouca memória para guardar): a página já apareceu pelo canvas; a imagem chega depois. */
const emJpeg = (c) => new Promise((ok) => c.toBlob((b) => ok(b ? URL.createObjectURL(b) : null), "image/jpeg", 0.9));

/** A cópia do canvas desenhado (a página aparece na hora, antes de virar JPEG). */
function CopiaDoCanvas({ origem, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !origem?.width) return;
    c.width = origem.width;
    c.height = origem.height;
    c.getContext("2d").drawImage(origem, 0, 0);
  }, [origem]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

/**
 * As imagens das páginas perto da leitura: desenhadas uma de cada vez, na ordem de prioridade (a vista de
 * agora, a próxima, a anterior…), e soltas quando ficam longe — um livro de 600 páginas não vira 600
 * imagens na memória. Se a página precisa de mais definição (a tela cresceu, o zoom), é desenhada de novo.
 */
/** Solta a memória de uma página guardada (a imagem e, se ainda houver, o canvas). */
function soltar(e) {
  if (e?.url) URL.revokeObjectURL(e.url);
  if (e?.canvas) { e.canvas.width = 0; e.canvas.height = 0; }
}

function useImagensDasPaginas(pdf, alturaAlvo) {
  const cache = useRef(new Map());
  const [, setVersao] = useState(0);
  const fila = useRef([]);
  const rodando = useRef(false);
  const vivo = useRef(true);
  const altura = useRef(alturaAlvo);
  altura.current = alturaAlvo;

  useEffect(() => {
    vivo.current = true;
    const guardado = cache.current;
    return () => {
      vivo.current = false;
      for (const e of guardado.values()) soltar(e);
      guardado.clear();
    };
  }, []);

  const precisa = (n) => {
    const e = cache.current.get(n);
    return !e || e.altura < altura.current * 0.85;
  };

  const processar = useCallback(async () => {
    if (rodando.current || !pdf) return;
    rodando.current = true;
    while (fila.current.length && vivo.current) {
      const n = fila.current.shift();
      if (!precisa(n)) continue;
      try {
        const r = await desenharPagina(pdf, n, altura.current);
        if (!vivo.current) { soltar(r); break; }
        const velho = cache.current.get(n);
        cache.current.set(n, r);
        if (velho) setTimeout(() => soltar(velho), 1500); // a página troca primeiro
        setVersao((x) => x + 1);
        // depois de aparecer, vira JPEG e o canvas grande é solto
        emJpeg(r.canvas).then((url) => {
          if (!url) return;
          if (!vivo.current || cache.current.get(n) !== r) { URL.revokeObjectURL(url); return; }
          const leve = { ...r, canvas: null, url };
          cache.current.set(n, leve);
          setVersao((x) => x + 1);
          setTimeout(() => { r.canvas.width = 0; r.canvas.height = 0; }, 1500);
        });
      } catch {
        // fica o papel em branco com o número; a próxima ida tenta de novo
      }
    }
    rodando.current = false;
  }, [pdf]);

  const pedir = useCallback((ordem) => {
    const manter = new Set(ordem);
    fila.current = ordem.filter((n) => n && precisa(n));
    if (cache.current.size > MAXIMO_EM_CACHE) {
      for (const [n, e] of cache.current) {
        if (!manter.has(n)) { soltar(e); cache.current.delete(n); }
      }
    }
    processar();
  }, [processar]);

  return { imagem: (n) => cache.current.get(n) || null, pedir };
}

/** Uma página no papel: a imagem do tamanho certo (cada página tem a sua proporção), as marcações e a fita do marcador. */
function Pagina({ n, lado, largura, altura, imagem, marcacoes, marcada, espelho = false }) {
  if (n == null) return <div className="er-pagina er-pagina--vazia" style={{ width: largura, height: altura }} />;
  const img = imagem(n);
  const prop = img?.proporcao || largura / altura;
  const cabe = prop >= largura / altura ? { width: largura, height: Math.round(largura / prop) } : { width: Math.round(altura * prop), height: altura };
  return (
    <div className={`er-pagina er-pagina--${lado}`} style={{ width: largura, height: altura }}>
      <div className="er-papel" style={cabe}>
        {img?.url ? (
          <img className={`er-papel__imagem${espelho ? " er-papel__imagem--verso" : ""}`} src={img.url} alt={espelho ? "" : `Página ${n}`} draggable={false} />
        ) : img?.canvas ? (
          <CopiaDoCanvas origem={img.canvas} className={`er-papel__imagem${espelho ? " er-papel__imagem--verso" : ""}`} />
        ) : (
          <span className="er-papel__abrindo" aria-hidden="true">{n}</span>
        )}
        {!espelho && marcacoes?.length > 0 && (
          <div className="er-marcas" aria-hidden="true">
            {marcacoes.flatMap((m) => m.retangulos.map((r, i) => (
              <span key={`${m.id}-${i}`} className={`lp-marca lp-marca--${m.tipo} lp-cor--${m.cor}`}
                style={{ left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%` }} />
            )))}
          </div>
        )}
        {!espelho && marcada && <span className="er-fita" title="Página marcada" />}
      </div>
    </div>
  );
}

/**
 * O MODO LEITURA (06/11/2026): o livro aberto na tela inteira, sem nada em volta. Uma página (celular,
 * tablet de pé) ou duas lado a lado (tablet deitado, computador), e a folha que vira em 3D: segue o dedo
 * ou o mouse e, ao soltar, termina de virar (ou volta) — com a sombra que a folha joga na página de baixo.
 * Toque nas laterais (ou ← →, espaço, a roda do mouse) para virar; no meio, para mostrar e esconder os
 * controles; dois toques (ou duplo clique) ampliam, e a pinça também. Lembra onde parou pelo leitor.
 */
export default function LeitorLivro({
  pdf, livro, total, base, alvo, marcacoes, prefs, mudarPrefs, aoMudarPagina, aoSair, aoAlternarMarcador, aviso,
}) {
  const raiz = useRef(null);
  const palco = useRef(null);
  const livroRef = useRef(null);
  const [tela, setTela] = useState({ largura: 0, altura: 0 });
  const [pagina, setPagina] = useState(Math.max(1, alvo?.n || 1));
  const [virada, setVirada] = useState(null); // { direcao: "frente" | "tras", progresso: 0..1 }
  const viradaRef = useRef(null);
  viradaRef.current = virada;
  const [controles, setControles] = useState(true);
  const [painel, setPainel] = useState(null); // null | "aparencia" | "sumario"
  const [abaDoSumario, setAbaDoSumario] = useState("sumario");
  const [arrasteDaBarra, setArrasteDaBarra] = useState(null);
  const [zoom, setZoom] = useState({ escala: 1, x: 0, y: 0 });
  const [telaCheia, setTelaCheia] = useState(false);
  const tween = useRef(0);
  const esconder = useRef(0);
  const sobreControles = useRef(false);

  const tema = prefs.tema || "claro";
  const [reduzir, setReduzir] = useState(false);
  useEffect(() => { setReduzir(Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)); }, []);
  const animacao = prefs.livroAnimacao || (reduzir ? "nenhuma" : "virar");
  const layout = useMemo(() => layoutDoLivro({
    largura: tela.largura, altura: tela.altura, proporcao: base.largura / base.altura, preferencia: prefs.livroLayout || "auto",
  }), [tela, base, prefs.livroLayout]);
  const duas = layout.duas;
  const pw = layout.pagina.largura, ph = layout.pagina.altura;
  const vistas = useMemo(() => vistasDoLivro(total, duas), [total, duas]);
  const v = Math.min(vistaDaPagina(pagina, total, duas), Math.max(0, vistas.length - 1));
  const vRef = useRef(v);
  vRef.current = v;
  const imagens = useImagensDasPaginas(pdf, ph * Math.min(zoom.escala, 2.5));

  // ------------------------------------------------------------ tamanho, pulo e "onde parou"

  useEffect(() => {
    const el = palco.current;
    if (!el) return undefined;
    const medir = () => setTela({ largura: el.clientWidth, altura: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // o leitor pediu uma página (abriu, voltou de outro modo): vai direto, sem animação
  useEffect(() => { if (alvo?.n) setPagina(Math.max(1, alvo.n)); }, [alvo?.n, alvo?.chave]);

  useEffect(() => { if (total) aoMudarPagina?.(Math.min(pagina, total)); }, [pagina, total, aoMudarPagina]);

  // as páginas perto da leitura: a vista de agora, a próxima, a anterior e a seguinte
  useEffect(() => {
    if (!pdf || !vistas.length) return;
    const ordem = [];
    for (const d of [0, 1, -1, 2, -2]) for (const n of vistas[v + d] || []) if (n && !ordem.includes(n)) ordem.push(n);
    imagens.pedir(ordem);
    // `imagens.pedir` é estável; o tamanho (ph) e o zoom refazem o pedido pela altura nova
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, vistas, v, ph, zoom.escala]);

  // a página do app não rola por baixo do livro
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, []);

  const [podeTelaCheia, setPodeTelaCheia] = useState(false);
  useEffect(() => {
    setPodeTelaCheia(Boolean(document.fullscreenEnabled));
    const mudou = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", mudou);
    return () => document.removeEventListener("fullscreenchange", mudou);
  }, []);

  // ------------------------------------------------------------ virar

  const podeIr = useCallback((direcao) => (direcao === "frente" ? vRef.current < vistas.length - 1 : vRef.current > 0), [vistas.length]);

  const concluir = useCallback((direcao) => {
    const destino = vistas[vRef.current + (direcao === "frente" ? 1 : -1)];
    if (destino) setPagina(destino.find((n) => n != null) ?? 1);
    setVirada(null);
  }, [vistas]);

  /** Anda a virada até `alvo` (1 = virou, 0 = voltou); `aoFim` roda no último quadro. */
  const animarAte = useCallback((alvoP, aoFim, { soltou = false } = {}) => {
    cancelAnimationFrame(tween.current);
    const p0 = viradaRef.current?.progresso ?? 0;
    const dur = animacao === "nenhuma" ? 0 : duracaoDaVirada(Math.abs(alvoP - p0));
    const inicio = performance.now();
    const passo = (agora) => {
      const t = dur ? Math.min(1, (agora - inicio) / dur) : 1;
      const p = p0 + (alvoP - p0) * (soltou ? saiDeAnimacao(t) : suavizar(t));
      setVirada((x) => (x ? { ...x, progresso: p } : x));
      if (t < 1) tween.current = requestAnimationFrame(passo);
      else aoFim();
    };
    tween.current = requestAnimationFrame(passo);
  }, [animacao]);

  const virar = useCallback((direcao) => {
    if (viradaRef.current || !podeIr(direcao)) return;
    if (animacao === "nenhuma") { concluir(direcao); return; }
    const nova = { direcao, progresso: 0 };
    viradaRef.current = nova;
    setVirada(nova);
    animarAte(1, () => concluir(direcao));
    setControles(false);
    setPainel(null);
  }, [podeIr, animacao, concluir, animarAte]);

  const irPara = useCallback((n) => {
    cancelAnimationFrame(tween.current);
    setVirada(null);
    setPagina(Math.min(Math.max(1, Math.round(n) || 1), total || 1));
  }, [total]);

  useEffect(() => () => { cancelAnimationFrame(tween.current); clearTimeout(esconder.current); }, []);

  // ------------------------------------------------------------ teclado e roda do mouse

  useEffect(() => {
    const tecla = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) return;
      if (["ArrowRight", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey)) { e.preventDefault(); virar("frente"); }
      else if (["ArrowLeft", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey)) { e.preventDefault(); virar("tras"); }
      else if (e.key === "Home") irPara(1);
      else if (e.key === "End") irPara(total);
      else if (e.key === "Escape") {
        if (painel) setPainel(null);
        else if (zoom.escala > 1) setZoom({ escala: 1, x: 0, y: 0 });
      }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [virar, irPara, total, painel, zoom.escala]);

  const rodaAcumulada = useRef({ soma: 0, ultimo: 0 });
  useEffect(() => {
    const el = palco.current;
    if (!el) return undefined;
    const roda = (e) => {
      if (e.ctrlKey) { e.preventDefault(); setZoom((z) => ajustarZoom(z, z.escala * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); return; }
      if (zoom.escala > 1 || painel) return;
      e.preventDefault();
      const r = rodaAcumulada.current;
      const agora = performance.now();
      if (agora - r.ultimo > 260) r.soma = 0;
      r.ultimo = agora;
      r.soma += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(r.soma) > 70 && !viradaRef.current) { virar(r.soma > 0 ? "frente" : "tras"); r.soma = 0; }
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [virar, zoom.escala, painel]);

  // ------------------------------------------------------------ o dedo (e o mouse)

  const gesto = useRef(null);
  const ponteiros = useRef(new Map());
  const ultimoToque = useRef({ t: 0, x: 0, y: 0 });
  const toqueAdiado = useRef(0);

  function ajustarZoom(z, escala, centro) {
    const s = Math.min(4, Math.max(1, escala));
    if (s <= 1.02) return { escala: 1, x: 0, y: 0 };
    if (!centro) return { ...z, escala: s };
    // o ponto embaixo do dedo fica no lugar
    const k = s / z.escala;
    return { escala: s, x: centro.x - (centro.x - z.x) * k, y: centro.y - (centro.y - z.y) * k };
  }

  function centroDoPalco(x, y) {
    const r = palco.current.getBoundingClientRect();
    return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
  }

  function aoBaixar(e) {
    if (e.target.closest?.("button, a, input, select, .er-controles, .er-painel")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { palco.current?.setPointerCapture?.(e.pointerId); } catch { /* sem captura, o arrasto continua pelo palco */ }
    if (ponteiros.current.size === 2) {
      // a pinça: o zoom do livro (não o da página do navegador)
      const [a, b] = [...ponteiros.current.values()];
      gesto.current = { pinca: true, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: zoom, centro: centroDoPalco((a.x + b.x) / 2, (a.y + b.y) / 2) };
      if (viradaRef.current) animarAte(0, () => setVirada(null), { soltou: true });
      return;
    }
    const caixa = livroRef.current?.getBoundingClientRect();
    gesto.current = { x0: e.clientX, y0: e.clientY, t0: performance.now(), ultimoX: e.clientX, ultimoT: performance.now(), vel: 0, direcao: null, caixa, zoom0: zoom };
  }

  function aoMover(e) {
    if (e.pointerType === "mouse" && !gesto.current) {
      // no computador, os controles aparecem com o mouse perto do alto ou de baixo
      const r = palco.current?.getBoundingClientRect();
      if (r && (e.clientY - r.top < 70 || r.bottom - e.clientY < 80)) mostrarControlesUmTempo();
    }
    if (!ponteiros.current.has(e.pointerId)) return;
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current;
    if (!g) return;
    if (g.pinca) {
      if (ponteiros.current.size < 2) return;
      const [a, b] = [...ponteiros.current.values()];
      setZoom(ajustarZoom(g.z0, g.z0.escala * (Math.hypot(a.x - b.x, a.y - b.y) / g.d0), g.centro));
      return;
    }
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    const agora = performance.now();
    if (agora > g.ultimoT) { g.vel = (e.clientX - g.ultimoX) / (agora - g.ultimoT); g.ultimoX = e.clientX; g.ultimoT = agora; }
    if (zoom.escala > 1) { setZoom({ ...g.zoom0, x: g.zoom0.x + dx, y: g.zoom0.y + dy }); return; }
    if (!g.direcao) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) || viradaRef.current) return;
      const direcao = dx < 0 ? "frente" : "tras";
      if (!podeIr(direcao) || animacao === "nenhuma") { g.direcao = "nada"; return; }
      g.direcao = direcao;
      cancelAnimationFrame(tween.current);
      const nova = { direcao, progresso: 0, arrastando: true };
      viradaRef.current = nova;
      setVirada(nova);
      setPainel(null);
    }
    if (g.direcao === "nada" || !g.caixa) return;
    const larguraDaPagina = duas ? g.caixa.width / 2 : g.caixa.width;
    let progresso;
    if (animacao === "deslizar") progresso = Math.min(1, Math.max(0, (g.direcao === "frente" ? -dx : dx) / (g.caixa.width * 0.9)));
    else if (g.direcao === "frente") {
      const lombada = duas ? g.caixa.left + larguraDaPagina : g.caixa.left;
      progresso = progressoDoAngulo(anguloDoArrasto({ direcao: "frente", x: g.caixa.right + dx, lombada, larguraDaPagina }));
    } else if (duas) {
      const lombada = g.caixa.left + larguraDaPagina;
      progresso = progressoDoAngulo(anguloDoArrasto({ direcao: "tras", x: g.caixa.left + dx, lombada, larguraDaPagina }));
    } else progresso = Math.min(1, Math.max(0, dx / (larguraDaPagina * 0.9)));
    setVirada((x) => (x ? { ...x, progresso } : x));
  }

  function aoSoltar(e) {
    ponteiros.current.delete(e.pointerId);
    const g = gesto.current;
    if (!g) return;
    if (g.pinca) {
      if (!ponteiros.current.size) gesto.current = null;
      return;
    }
    gesto.current = null;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (g.direcao && g.direcao !== "nada") {
      const atual = viradaRef.current;
      if (!atual) return;
      const vai = deveVirar({ progresso: atual.progresso, velocidade: g.vel, direcao: g.direcao });
      const direcao = g.direcao;
      setVirada((x) => (x ? { ...x, arrastando: false } : x));
      animarAte(vai ? 1 : 0, () => (vai ? concluir(direcao) : setVirada(null)), { soltou: true });
      if (vai) setControles(false);
      return;
    }
    // um toque (não um arrasto)
    if (Math.hypot(dx, dy) > 10 || performance.now() - g.t0 > 450) return;
    tocar(e);
  }

  function tocar(e) {
    const r = palco.current.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const agora = performance.now();
    if (painel) { setPainel(null); return; }
    // as laterais viram na hora (tocar seguido vira várias páginas, não amplia)
    if ((fx < 0.3 || fx > 0.7) && zoom.escala <= 1) {
      ultimoToque.current = { t: 0, x: 0, y: 0 };
      virar(fx < 0.3 ? "tras" : "frente");
      return;
    }
    // o meio: dois toques ampliam (ou voltam ao tamanho); um toque mostra ou esconde os controles
    const duplo = agora - ultimoToque.current.t < 300 && Math.hypot(e.clientX - ultimoToque.current.x, e.clientY - ultimoToque.current.y) < 40;
    ultimoToque.current = { t: agora, x: e.clientX, y: e.clientY };
    if (duplo) {
      clearTimeout(toqueAdiado.current);
      ultimoToque.current = { t: 0, x: 0, y: 0 };
      setZoom((z) => (z.escala > 1 ? { escala: 1, x: 0, y: 0 } : ajustarZoom(z, 2.2, centroDoPalco(e.clientX, e.clientY))));
      return;
    }
    if (zoom.escala > 1) return;
    clearTimeout(toqueAdiado.current);
    toqueAdiado.current = setTimeout(() => setControles((c) => !c), ehToque(e) ? 260 : 200);
  }

  function mostrarControlesUmTempo() {
    setControles(true);
    clearTimeout(esconder.current);
    esconder.current = setTimeout(() => { if (!sobreControles.current) setControles(false); }, 2600);
  }

  function alternarTelaCheia() {
    if (document.fullscreenElement) document.exitFullscreen();
    else raiz.current?.requestFullscreen?.().catch(() => {});
  }

  // ------------------------------------------------------------ desenho

  const porPagina = useMemo(() => {
    const m = new Map();
    for (const x of marcacoes || []) if (x.tipo !== "marcador") m.set(x.pagina, [...(m.get(x.pagina) || []), x]);
    return m;
  }, [marcacoes]);
  const marcadas = useMemo(() => new Set((marcacoes || []).filter((m) => m.tipo === "marcador").map((m) => m.pagina)), [marcacoes]);
  const pag = (n, lado, extra = {}) => (
    <Pagina n={n} lado={lado} largura={pw} altura={ph} imagem={imagens.imagem} marcacoes={porPagina.get(n)} marcada={marcadas.has(n)} {...extra} />
  );

  const atual = vistas[v] || [];
  const dir = virada?.direcao;
  const proxima = vistas[v + 1] || [];
  const anterior = vistas[v - 1] || [];
  const p = virada?.progresso || 0;
  const lombada = duas ? pw : 0;

  let conteudo;
  if (virada && animacao === "deslizar") {
    // deslizar: a vista de agora sai e a próxima (ou a anterior) entra pelo lado
    const sinal = dir === "frente" ? 1 : -1;
    const passo = layout.livro.largura + 48;
    const vista = (lista, x, chave) => (
      <div key={chave} className="er-vista" style={{ transform: `translateX(${x}px)` }}>
        {duas ? <>{pag(lista[0], "esq")}{pag(lista[1], "dir")}</> : pag(lista[0], "uma")}
      </div>
    );
    conteudo = <>{vista(atual, -sinal * p * passo, "a")}{vista(dir === "frente" ? proxima : anterior, sinal * (1 - p) * passo, "b")}</>;
  } else {
    // virar: o que fica parado embaixo e a folha que gira em volta da lombada
    let esq = null, direita, folha = null;
    if (duas) {
      esq = dir === "tras" ? anterior[0] : atual[0];
      direita = dir === "frente" ? proxima[1] : atual[1];
      if (dir === "frente") folha = { esquerda: pw, origem: "left center", angulo: -180 * p, frente: pag(atual[1], "dir"), verso: pag(proxima[0], "esq") };
      if (dir === "tras") folha = { esquerda: 0, origem: "right center", angulo: 180 * p, frente: pag(atual[0], "esq"), verso: pag(anterior[1], "dir") };
    } else {
      direita = dir === "frente" ? proxima[0] : atual[0];
      if (dir === "frente") folha = { esquerda: 0, origem: "left center", angulo: -180 * p, frente: pag(atual[0], "uma"), verso: pag(atual[0], "uma", { espelho: true }), some: p };
      if (dir === "tras") folha = { esquerda: 0, origem: "left center", angulo: -180 * (1 - p), frente: pag(anterior[0], "uma"), verso: pag(anterior[0], "uma", { espelho: true }), some: 1 - p };
    }
    let sombra = null, luz = 0;
    if (folha) {
      const rad = (folha.angulo * Math.PI) / 180;
      const s = Math.abs(Math.sin(rad));
      luz = s;
      // a borda solta da folha, vista de frente, e a sombra que ela joga na página de baixo
      const borda = dir === "tras" && duas ? lombada - Math.cos(rad) * pw : lombada + Math.cos(rad) * pw;
      const largura = 16 + 70 * s;
      const paraDireita = borda >= lombada;
      sombra = { left: paraDireita ? borda : borda - largura, width: largura, opacity: 0.55 * s, paraDireita };
    }
    // uma página só: a folha some no fim da virada (ela sai da página, para o lado de fora)
    const opacidade = folha && !duas ? Math.min(1, Math.max(0, (1 - folha.some) / 0.3)) : 1;
    conteudo = (
      <>
        {duas && <div className="er-lado" style={{ left: 0, width: pw }}>{pag(esq, "esq")}</div>}
        <div className="er-lado" style={{ left: lombada, width: pw }}>{pag(direita, duas ? "dir" : "uma")}</div>
        {sombra && (
          <i className={`er-sombra${sombra.paraDireita ? "" : " er-sombra--esq"}`} style={{ left: sombra.left, width: sombra.width, opacity: sombra.opacity }} aria-hidden="true" />
        )}
        {folha && (
          <div className="er-folha" style={{ left: folha.esquerda, width: pw, transformOrigin: folha.origem, transform: `rotateY(${folha.angulo}deg)`, opacity: opacidade }}>
            <div className="er-face">{folha.frente}<i className={`er-luz${folha.origem.startsWith("right") ? " er-luz--dir" : ""}`} style={{ opacity: luz }} /></div>
            <div className="er-face er-face--verso">{folha.verso}<i className={`er-luz${folha.origem.startsWith("right") ? "" : " er-luz--dir"}`} style={{ opacity: luz }} /></div>
          </div>
        )}
      </>
    );
  }

  const paginaMostrada = arrasteDaBarra ?? pagina;
  const capitulo = capituloDaPagina(livro?.sumario, paginaMostrada, total);
  const visivel = controles || Boolean(painel) || arrasteDaBarra != null;

  return (
    <div
      ref={raiz}
      className={`er er--${tema}${visivel ? " er--controles" : ""}${zoom.escala > 1 ? " er--zoom" : ""}${duas ? " er--duas" : " er--uma"}`}
      role="region" aria-label={`Modo leitura: ${livro?.titulo || "livro"}`}
    >
      <div className="er-topo er-controles" onPointerEnter={() => { sobreControles.current = true; }} onPointerLeave={() => { sobreControles.current = false; }}>
        <Link href="/biblioteca" className="er-botao" aria-label="Fechar o livro e voltar à biblioteca" title="Voltar à biblioteca">✕</Link>
        <button type="button" className="er-botao" onClick={() => setPainel(painel === "sumario" ? null : "sumario")} aria-pressed={painel === "sumario"} aria-label="Sumário e marcadores" title="Sumário e marcadores">☰</button>
        <div className="er-topo__titulo">
          <strong title={livro?.titulo}>{livro?.titulo || "…"}</strong>
          {capitulo && <small>{capitulo.titulo}</small>}
        </div>
        <button type="button" className="er-botao" onClick={() => aoAlternarMarcador?.(pagina)} aria-pressed={marcadas.has(pagina)} aria-label={marcadas.has(pagina) ? "Tirar o marcador desta página" : "Marcar esta página"} title="Marcador">🔖</button>
        <button type="button" className="er-botao er-botao--aa" onClick={() => setPainel(painel === "aparencia" ? null : "aparencia")} aria-pressed={painel === "aparencia"} aria-label="Aparência" title="Aparência">Aa</button>
        {podeTelaCheia && (
          <button type="button" className="er-botao er-so-largo" onClick={alternarTelaCheia} aria-pressed={telaCheia} aria-label="Tela cheia" title="Tela cheia">⛶</button>
        )}
      </div>

      <div
        ref={palco} className="er-palco"
        onPointerDown={aoBaixar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}
        onContextMenu={(e) => { if (ehToque(e)) e.preventDefault(); }}
      >
        {!pdf || !tela.largura ? (
          <div className="er-abrindo">Abrindo o livro…</div>
        ) : (
          <div className="er-centro" style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.escala})` }}>
            <div ref={livroRef} className="er-livro" style={{ width: layout.livro.largura, height: ph, perspective: `${Math.max(1600, layout.livro.largura * 2.2)}px` }}>
              {conteudo}
              {duas && <i className="er-lombada" style={{ left: pw }} aria-hidden="true" />}
            </div>
          </div>
        )}
        {/* no computador, as setas discretas dos lados */}
        <button type="button" className="er-seta er-seta--esq" onClick={() => virar("tras")} disabled={v <= 0} aria-label="Página anterior">‹</button>
        <button type="button" className="er-seta er-seta--dir" onClick={() => virar("frente")} disabled={v >= vistas.length - 1} aria-label="Próxima página">›</button>
      </div>

      <div className="er-base er-controles" onPointerEnter={() => { sobreControles.current = true; }} onPointerLeave={() => { sobreControles.current = false; }}>
        <input
          type="range" className="er-barra" min={1} max={Math.max(1, total)} value={Math.min(paginaMostrada, total || 1)}
          aria-label="Ir para a página" aria-valuetext={`Página ${paginaMostrada} de ${total}`}
          onChange={(e) => setArrasteDaBarra(Number(e.target.value))}
          onPointerUp={() => { if (arrasteDaBarra != null) { irPara(arrasteDaBarra); setArrasteDaBarra(null); } }}
          onKeyUp={() => { if (arrasteDaBarra != null) { irPara(arrasteDaBarra); setArrasteDaBarra(null); } }}
          onBlur={() => { if (arrasteDaBarra != null) { irPara(arrasteDaBarra); setArrasteDaBarra(null); } }}
          style={{ "--andou": `${total > 1 ? ((paginaMostrada - 1) / (total - 1)) * 100 : 100}%` }}
        />
        <p className="er-base__texto">{total ? rodapeDaLeitura({ pagina: paginaMostrada, total, capitulo }) : "…"}</p>
      </div>

      {/* sem os controles, só o número da página, bem discreto */}
      <p className="er-numero" aria-hidden="true">{total ? `${pagina} de ${total}` : ""}</p>
      <p className="er-falado" aria-live="polite">{total ? `Página ${pagina} de ${total}` : ""}</p>
      {aviso && <div className="er-aviso" role="status">{aviso}</div>}

      {painel === "aparencia" && (
        <div className="er-painel er-painel--aparencia" role="dialog" aria-label="Aparência">
          <p className="er-painel__rotulo">Tema</p>
          <div className="er-temas">
            {Object.entries(NOMES_DOS_TEMAS).map(([t, nome]) => (
              <button key={t} type="button" className={`er-tema er-tema--${t}`} aria-pressed={tema === t} onClick={() => mudarPrefs({ tema: t })}>
                <span aria-hidden="true">Aa</span>{nome}
              </button>
            ))}
          </div>
          <p className="er-painel__rotulo">Páginas</p>
          <div className="er-opcoes" role="group" aria-label="Páginas">
            {Object.entries(NOMES_DOS_LAYOUTS).map(([k, nome]) => (
              <button key={k} type="button" aria-pressed={(prefs.livroLayout || "auto") === k} onClick={() => mudarPrefs({ livroLayout: k })}>{nome}</button>
            ))}
          </div>
          <p className="er-painel__rotulo">Ao passar a página</p>
          <div className="er-opcoes" role="group" aria-label="Animação">
            {Object.entries(NOMES_DAS_ANIMACOES).map(([k, nome]) => (
              <button key={k} type="button" aria-pressed={animacao === k} onClick={() => mudarPrefs({ livroAnimacao: k })}>{nome}</button>
            ))}
          </div>
          <div className="er-painel__outros">
            <button type="button" onClick={() => aoSair?.("texto")}>Aa Ler como texto (letra grande)</button>
            <button type="button" onClick={() => aoSair?.("pagina")}>🖍️ Marcar, anotar e buscar (modo página)</button>
          </div>
        </div>
      )}

      {painel === "sumario" && (
        <div className="er-painel er-painel--sumario" role="dialog" aria-label="Sumário e marcadores">
          <div className="er-abas" role="tablist">
            <button type="button" role="tab" aria-selected={abaDoSumario === "sumario"} onClick={() => setAbaDoSumario("sumario")}>Sumário</button>
            <button type="button" role="tab" aria-selected={abaDoSumario === "marcadores"} onClick={() => setAbaDoSumario("marcadores")}>Marcadores e destaques</button>
          </div>
          <div className="er-painel__lista">
            {abaDoSumario === "sumario" && (livro?.sumario?.length ? (
              <ul className="er-sumario">
                {livro.sumario.map((s, i) => {
                  const proximo = livro.sumario.slice(i + 1).find((x) => x.nivel <= s.nivel);
                  const aqui = pagina >= s.pagina && (!proximo || pagina < proximo.pagina);
                  return (
                    <li key={i} className={`er-sumario__item er-sumario__item--${Math.min(s.nivel || 1, 3)}${aqui ? " er-sumario__item--aqui" : ""}`}>
                      <button type="button" onClick={() => { irPara(s.pagina); setPainel(null); }}><span>{s.titulo}</span><small>{s.pagina}</small></button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="er-vazio">Este PDF não tem sumário. Use a barra de baixo para ir a qualquer página.</p>)}
            {abaDoSumario === "marcadores" && ((marcacoes || []).length ? (
              <ul className="er-sumario">
                {[...marcacoes].sort((a, b) => a.pagina - b.pagina).map((m) => (
                  <li key={m.id} className="er-sumario__item">
                    <button type="button" onClick={() => { irPara(m.pagina); setPainel(null); }}>
                      <span>{ICONES_DO_TIPO[m.tipo] || "🖍️"} {m.texto || (m.tipo === "marcador" ? "Página marcada" : "Área marcada")}</span><small>{m.pagina}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="er-vazio">Nenhum marcador ainda. Toque em 🔖 para marcar a página; para destacar trechos, use o modo página (em Aa).</p>)}
          </div>
        </div>
      )}
    </div>
  );
}
