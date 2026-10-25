"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { obter, criar, mudar, remover } from "@/lib/api.js";
import { CORES_DE_MARCACAO, juntarRetangulosPorLinha, progressoDaLeitura } from "@/dominio/biblioteca.js";
import { citacaoDoLivro } from "@/dominio/cadernos.js";
import { abrirPdf, enviarTextoDoLivro } from "./pdf.js";
import PaginaDoPdf from "./PaginaDoPdf.js";
import Miniatura from "./Miniatura.js";
import { AnotacoesDoAlvo } from "../caderno/Vinculos.js";

const VAO = 14; // espaço entre as páginas
const PREFS = "proof-leitor-preferencias";
const NOMES_DAS_CORES = { amarelo: "Amarelo", verde: "Verde", azul: "Azul", rosa: "Rosa", laranja: "Laranja" };
const ICONES_DO_TIPO = { destaque: "🖍️", sublinhado: "＿", area: "▭", marcador: "🔖" };
const PAINEIS = [
  { chave: "sumario", rotulo: "Sumário", icone: "☰" },
  { chave: "paginas", rotulo: "Páginas", icone: "▦" },
  { chave: "marcacoes", rotulo: "Marcações", icone: "🖍️" },
  { chave: "busca", rotulo: "Busca", icone: "🔍" },
  { chave: "anotacoes", rotulo: "Caderno", icone: "📓" },
];

function lerPrefs() {
  try { return { tema: "claro", cor: "amarelo", ...JSON.parse(localStorage.getItem(PREFS) || "{}") }; } catch { return { tema: "claro", cor: "amarelo" }; }
}

/**
 * O leitor de PDF da biblioteca (25/10/2026): "ler com opção de marcação, igual aos melhores leitores".
 *
 * Rolagem contínua (só as páginas perto da tela são desenhadas), zoom (largura, página inteira ou
 * livre, Ctrl+roda), temas de leitura (claro, sépia, escuro), sumário, miniaturas, busca no texto do
 * livro, marcador de página e marcações: selecionar o texto abre a barrinha (cores, sublinhar, nota,
 * copiar, mandar para o caderno); a ferramenta "área" marca um retângulo (figura, fórmula, PDF
 * escaneado). Lembra onde parou, neste aparelho e no servidor.
 */
export default function LeitorDePdf({ livroId }) {
  const raiz = useRef(null);
  const rolagem = useRef(null);
  const [livro, setLivro] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [erro, setErro] = useState("");
  const [base, setBase] = useState({ largura: 612, altura: 792 });
  const medidas = useRef(new Map()); // página → [largura, altura] reais (quando difere da 1ª)
  const [versaoDasMedidas, setVersaoDasMedidas] = useState(0);
  const [zoom, setZoom] = useState({ modo: "largura", escala: 1 });
  const [larguraUtil, setLarguraUtil] = useState(800);
  const [alturaUtil, setAlturaUtil] = useState(800);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [visiveis, setVisiveis] = useState({ de: 1, ate: 3 });
  const [marcacoes, setMarcacoes] = useState([]);
  const [painel, setPainel] = useState(null);
  const [prefs, setPrefs] = useState({ tema: "claro", cor: "amarelo" });
  const [ferramenta, setFerramenta] = useState("texto");
  const [selecao, setSelecao] = useState(null); // { pagina, texto, retangulos, x, y }
  const [aberta, setAberta] = useState(null); // { marcacao, x, y }
  const [notaEmEdicao, setNotaEmEdicao] = useState(null); // { pagina, texto, retangulos, tipo, cor } ou { marcacao }
  const [paraCaderno, setParaCaderno] = useState(null); // { marcacaoId } | { pagina, texto, nota }
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState(null);
  const [termoAtivo, setTermoAtivo] = useState("");
  const [guardandoTexto, setGuardandoTexto] = useState(null);
  const [aviso, setAviso] = useState("");
  const [telaCheia, setTelaCheia] = useState(false);
  const [entradaDePagina, setEntradaDePagina] = useState("1");
  const salvarPosicao = useRef(null);
  const paginaInicial = useRef(null);

  useEffect(() => { setPrefs(lerPrefs()); }, []);
  const mudarPrefs = (p) => setPrefs((a) => {
    const n = { ...a, ...p };
    try { localStorage.setItem(PREFS, JSON.stringify(n)); } catch { /* vale nesta visita */ }
    return n;
  });

  // ------------------------------------------------------------ abrir

  useEffect(() => {
    let vivo = true;
    let doc = null;
    (async () => {
      try {
        const r = await obter(`/api/biblioteca/${livroId}`);
        if (!vivo) return;
        setLivro(r.livro);
        if (!r.endereco) throw new Error("o envio deste PDF não terminou — apague e suba de novo");
        const pedida = Number(new URLSearchParams(window.location.search).get("pagina"));
        let local = 0;
        try { local = Number(localStorage.getItem(`proof-leitor-${livroId}`)) || 0; } catch { /* nada */ }
        paginaInicial.current = pedida || Math.max(r.livro.ultimaPagina || 1, local) || 1;
        if (!pedida && window.matchMedia("(min-width: 1100px)").matches) setPainel(r.livro.sumario?.length ? "sumario" : null);
        doc = await abrirPdf({ url: r.endereco });
        if (!vivo) { doc.destroy(); return; }
        const p1 = await doc.getPage(1);
        const v = p1.getViewport({ scale: 1 });
        setBase({ largura: v.width, altura: v.height });
        setPdf(doc);
        obter(`/api/biblioteca/${livroId}/marcacoes`).then((m) => vivo && setMarcacoes(m.marcacoes)).catch(() => {});
      } catch (e) {
        if (vivo) setErro(e.message || "não consegui abrir o PDF");
      }
    })();
    return () => { vivo = false; doc?.destroy(); };
  }, [livroId]);

  // texto do livro que não terminou de ser guardado (a pessoa fechou a aba no meio): termina aqui
  useEffect(() => {
    if (!pdf || !livro || livro.status === "pronto") return;
    let vivo = true;
    setGuardandoTexto(0);
    enviarTextoDoLivro({ pdf, livroId, enviar: criar, aoAvancar: (n, t) => vivo && setGuardandoTexto(n / t) })
      .then(() => { if (vivo) { setGuardandoTexto(null); setLivro((l) => ({ ...l, status: "pronto" })); } })
      .catch(() => vivo && setGuardandoTexto(null));
    return () => { vivo = false; };
    // uma vez, quando o PDF abre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf]);

  // ------------------------------------------------------------ geometria

  useEffect(() => {
    const el = rolagem.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => { setLarguraUtil(el.clientWidth); setAlturaUtil(el.clientHeight); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdf]);

  const escala = useMemo(() => {
    const ajuste = Math.max(0.3, (larguraUtil - 32) / base.largura);
    // "largura" até 160%: página pequena (A5) esticada na tela larga vira linha comprida demais para ler
    if (zoom.modo === "largura") return Math.min(ajuste, 1.6);
    if (zoom.modo === "pagina") return Math.min(ajuste, Math.max(0.3, (alturaUtil - 24) / base.altura));
    return zoom.escala;
  }, [zoom, larguraUtil, alturaUtil, base]);

  const total = pdf?.numPages || livro?.paginas || 0;
  const aoMedir = useCallback((n, l, a) => {
    const diferente = Math.abs(l - base.largura) > 1 || Math.abs(a - base.altura) > 1;
    const ja = medidas.current.get(n);
    if (diferente && (!ja || ja[0] !== l || ja[1] !== a)) { medidas.current.set(n, [l, a]); setVersaoDasMedidas((v) => v + 1); }
  }, [base]);

  // o topo de cada página (em px) — é o que leva a uma página e diz em qual página se está
  const topos = useMemo(() => {
    const lista = new Array(total + 1);
    let y = VAO;
    for (let n = 1; n <= total; n++) {
      lista[n] = y;
      const m = medidas.current.get(n);
      y += (m ? m[1] : base.altura) * escala + VAO;
    }
    lista[total + 1] = y;
    return lista;
    // versaoDasMedidas: uma página de tamanho diferente foi medida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, base, escala, versaoDasMedidas]);

  const irParaPagina = useCallback((n, { suave = false } = {}) => {
    const el = rolagem.current;
    if (!el || !total) return;
    const alvo = Math.min(Math.max(1, Math.round(n) || 1), total);
    el.scrollTo({ top: topos[alvo] - VAO, behavior: suave ? "smooth" : "auto" });
  }, [topos, total]);

  // chegou: vai para onde parou (ou para a página pedida no endereço). Enquanto a tela se acomoda
  // (a largura é medida, o zoom "largura" recalcula), continua apontando para lá.
  useEffect(() => {
    if (!pdf || !paginaInicial.current) return undefined;
    irParaPagina(paginaInicial.current);
    const t = setTimeout(() => { paginaInicial.current = null; }, 700);
    return () => clearTimeout(t);
  }, [pdf, irParaPagina]);

  // zoom mudou: fica na mesma página
  const ultimaVista = useRef(1);
  useEffect(() => {
    if (pdf && !paginaInicial.current) irParaPagina(ultimaVista.current);
    // só quando a escala muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escala]);

  const aoRolar = useCallback(() => {
    const el = rolagem.current;
    if (!el || !total) return;
    const meio = el.scrollTop + el.clientHeight * 0.3;
    let lo = 1, hi = total;
    while (lo < hi) { const m = Math.ceil((lo + hi) / 2); if (topos[m] <= meio) lo = m; else hi = m - 1; }
    setPaginaAtual(lo);
    if (!paginaInicial.current) ultimaVista.current = lo;
    // as páginas perto da tela: a de cima até a de baixo, mais duas de folga para cada lado
    let ultima = lo;
    while (ultima < total && topos[ultima + 1] < el.scrollTop + el.clientHeight) ultima++;
    let primeira = lo;
    while (primeira > 1 && topos[primeira] > el.scrollTop) primeira--;
    const de = Math.max(1, primeira - 2);
    const ate = Math.min(total, ultima + 2);
    setVisiveis((v) => (v.de === de && v.ate === ate ? v : { de, ate }));
  }, [topos, total]);
  useEffect(() => { aoRolar(); }, [aoRolar]);

  // onde parou: neste aparelho na hora, no servidor 2 s depois de parar
  useEffect(() => {
    if (!pdf) return undefined;
    setEntradaDePagina(String(paginaAtual));
    try { localStorage.setItem(`proof-leitor-${livroId}`, String(paginaAtual)); } catch { /* nada */ }
    clearTimeout(salvarPosicao.current);
    salvarPosicao.current = setTimeout(() => {
      mudar(`/api/biblioteca/${livroId}`, { ultimaPagina: paginaAtual }).catch(() => {});
      window.history.replaceState(null, "", `${window.location.pathname}?pagina=${paginaAtual}`);
    }, 2000);
    return undefined;
  }, [paginaAtual, pdf, livroId]);

  // Ctrl+roda = zoom (no leitor, não na página inteira do navegador)
  useEffect(() => {
    const el = rolagem.current;
    if (!el) return undefined;
    const roda = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => ({ modo: "livre", escala: Math.min(4, Math.max(0.3, (z.modo === "livre" ? z.escala : escala) * (e.deltaY < 0 ? 1.1 : 1 / 1.1))) }));
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [pdf, escala]);

  // ------------------------------------------------------------ teclado

  useEffect(() => {
    const tecla = (e) => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") { e.preventDefault(); setPainel("busca"); setTimeout(() => document.getElementById("lp-busca")?.focus(), 50); return; }
      if (digitando) return;
      if (e.key === "ArrowRight" && !e.altKey) { e.preventDefault(); irParaPagina(paginaAtual + 1); }
      else if (e.key === "ArrowLeft" && !e.altKey) { e.preventDefault(); irParaPagina(paginaAtual - 1); }
      else if (e.key === "+" || e.key === "=") setZoom({ modo: "livre", escala: Math.min(4, escala * 1.15) });
      else if (e.key === "-") setZoom({ modo: "livre", escala: Math.max(0.3, escala / 1.15) });
      else if (e.key === "Escape") { setSelecao(null); setAberta(null); setFerramenta("texto"); }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [irParaPagina, paginaAtual, escala]);

  useEffect(() => {
    const mudou = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", mudou);
    return () => document.removeEventListener("fullscreenchange", mudou);
  }, []);

  // ------------------------------------------------------------ seleção e marcações

  const lerSelecao = useCallback(() => {
    if (ferramenta !== "texto") return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { setSelecao(null); return; }
    const range = sel.getRangeAt(0);
    const no = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const paginaEl = no?.closest?.(".lp-pagina");
    if (!paginaEl || !rolagem.current?.contains(paginaEl)) { setSelecao(null); return; }
    const p = paginaEl.getBoundingClientRect();
    const rets = [...range.getClientRects()]
      .filter((r) => r.width > 1 && r.height > 1 && r.bottom > p.top && r.top < p.bottom)
      .map((r) => [(r.left - p.left) / p.width, (r.top - p.top) / p.height, r.width / p.width, r.height / p.height]);
    const retangulos = juntarRetangulosPorLinha(rets);
    const textoSel = sel.toString().replace(/\s+/g, " ").trim();
    if (!retangulos.length || !textoSel) { setSelecao(null); return; }
    const ultimo = [...range.getClientRects()].filter((r) => r.width > 1).at(-1) || p;
    setAberta(null);
    setSelecao({ pagina: Number(paginaEl.dataset.pagina), texto: textoSel, retangulos, x: ultimo.left + ultimo.width / 2, y: ultimo.bottom });
  }, [ferramenta]);

  // a seleção pelo toque (celular) não passa pelo "soltar o mouse": lê quando ela para de mudar
  useEffect(() => {
    let espera = null;
    const mudouSelecao = () => {
      const s = window.getSelection();
      clearTimeout(espera);
      if (!s || s.isCollapsed) setSelecao(null);
      else espera = setTimeout(lerSelecao, 450);
    };
    document.addEventListener("selectionchange", mudouSelecao);
    return () => { clearTimeout(espera); document.removeEventListener("selectionchange", mudouSelecao); };
  }, [lerSelecao]);

  /** Tocar numa marcação (com a seleção vazia) abre o balão dela. */
  function aoSoltar(e) {
    if (ferramenta !== "texto") return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) { setTimeout(lerSelecao, 0); return; }
    const paginaEl = e.target.closest?.(".lp-pagina");
    if (!paginaEl) { setAberta(null); return; }
    const p = paginaEl.getBoundingClientRect();
    const x = (e.clientX - p.left) / p.width;
    const y = (e.clientY - p.top) / p.height;
    const n = Number(paginaEl.dataset.pagina);
    const achada = marcacoes.find((m) => m.pagina === n && m.retangulos.some((r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] - 0.004 && y <= r[1] + r[3] + 0.004));
    setAberta(achada ? { marcacao: achada, x: e.clientX, y: e.clientY } : null);
  }

  async function marcar({ tipo = "destaque", cor = prefs.cor, nota = "" } = {}, de = selecao) {
    if (!de) return null;
    try {
      const { marcacao } = await criar(`/api/biblioteca/${livroId}/marcacoes`, { pagina: de.pagina, tipo, cor, texto: de.texto || "", nota, retangulos: de.retangulos });
      setMarcacoes((l) => [...l, marcacao].sort((a, b) => a.pagina - b.pagina));
      window.getSelection()?.removeAllRanges();
      setSelecao(null);
      if (cor !== prefs.cor && tipo !== "marcador") mudarPrefs({ cor });
      return marcacao;
    } catch (e) {
      setAviso(e.message);
      return null;
    }
  }

  async function editarMarcacao(m, mudanca) {
    try {
      const { marcacao } = await mudar(`/api/marcacoes/${m.id}`, mudanca);
      setMarcacoes((l) => l.map((x) => (x.id === m.id ? marcacao : x)));
      setAberta((a) => (a?.marcacao.id === m.id ? { ...a, marcacao } : a));
      return marcacao;
    } catch (e) {
      setAviso(e.message);
      return null;
    }
  }

  async function apagarMarcacao(m) {
    try {
      await remover(`/api/marcacoes/${m.id}`);
      setMarcacoes((l) => l.filter((x) => x.id !== m.id));
      setAberta(null);
    } catch (e) {
      setAviso(e.message);
    }
  }

  const marcadorDaPagina = marcacoes.find((m) => m.tipo === "marcador" && m.pagina === paginaAtual);
  async function alternarMarcador() {
    if (marcadorDaPagina) apagarMarcacao(marcadorDaPagina);
    else marcar({ tipo: "marcador", cor: "laranja" }, { pagina: paginaAtual, texto: "", retangulos: [] });
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(selecao?.texto || ""); setAviso("Copiado."); } catch { setAviso("Não consegui copiar — use Ctrl+C."); }
    setSelecao(null);
  }

  // ------------------------------------------------------------ busca

  async function buscar(e) {
    e?.preventDefault();
    const t = termo.trim();
    if (t.length < 2) return;
    setResultados("buscando");
    try {
      const r = await obter(`/api/biblioteca/${livroId}/busca?q=${encodeURIComponent(t)}`);
      setResultados(r.resultados);
      setTermoAtivo(t);
      if (r.resultados[0]) irParaPagina(r.resultados[0].pagina);
    } catch (falha) {
      setResultados([]);
      setAviso(falha.message);
    }
  }

  // ------------------------------------------------------------ desenho

  if (erro) {
    return (
      <div className="pf-aviso pf-aviso--erro">
        {erro} <Link href="/biblioteca">Voltar à biblioteca</Link>
      </div>
    );
  }

  const porPagina = new Map();
  for (const m of marcacoes) if (m.tipo !== "marcador") porPagina.set(m.pagina, [...(porPagina.get(m.pagina) || []), m]);
  const paginasParaDesenhar = [];
  for (let n = 1; n <= total; n++) {
    const m = medidas.current.get(n);
    paginasParaDesenhar.push({ n, largura: Math.floor((m ? m[0] : base.largura) * escala), altura: Math.floor((m ? m[1] : base.altura) * escala) });
  }
  const larguraMaxima = Math.max(...paginasParaDesenhar.map((p) => p.largura), 0);

  return (
    <div ref={raiz} className={`lp lp--tema-${prefs.tema}${painel ? " lp--com-painel" : ""}${telaCheia ? " lp--cheia" : ""}${ferramenta === "area" ? " lp--area" : ""}`}>
      <div className="lp-barra" role="toolbar" aria-label="Leitor">
        <Link href="/biblioteca" className="lp-barra__voltar" aria-label="Voltar à biblioteca">←</Link>
        <button type="button" className="lp-barra__botao" aria-pressed={Boolean(painel)} onClick={() => setPainel(painel ? null : "sumario")} title="Painel (sumário, páginas, marcações, busca)" aria-label="Painel lateral">☰</button>
        <span className="lp-barra__titulo" title={livro?.titulo}>{livro?.titulo || "…"}</span>
        <form className="lp-barra__pagina" onSubmit={(e) => { e.preventDefault(); irParaPagina(Number(entradaDePagina)); }}>
          <button type="button" className="lp-barra__botao" onClick={() => irParaPagina(paginaAtual - 1)} disabled={paginaAtual <= 1} aria-label="Página anterior">‹</button>
          <input value={entradaDePagina} onChange={(e) => setEntradaDePagina(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Ir para a página" />
          <span>/ {total || "…"}</span>
          <button type="button" className="lp-barra__botao" onClick={() => irParaPagina(paginaAtual + 1)} disabled={paginaAtual >= total} aria-label="Próxima página">›</button>
        </form>
        <div className="lp-barra__grupo">
          <button type="button" className="lp-barra__botao" onClick={() => setZoom({ modo: "livre", escala: Math.max(0.3, escala / 1.15) })} aria-label="Diminuir">−</button>
          <button type="button" className="lp-barra__zoom" onClick={() => setZoom({ modo: zoom.modo === "largura" ? "pagina" : "largura", escala })} title="Alternar: largura / página inteira">
            {Math.round(escala * 100)}%{zoom.modo === "largura" ? " ↔" : zoom.modo === "pagina" ? " ▭" : ""}
          </button>
          <button type="button" className="lp-barra__botao" onClick={() => setZoom({ modo: "livre", escala: Math.min(4, escala * 1.15) })} aria-label="Aumentar">+</button>
        </div>
        <div className="lp-barra__grupo lp-barra__ferramentas">
          <button type="button" className="lp-barra__botao" aria-pressed={ferramenta === "texto"} onClick={() => setFerramenta("texto")} title="Selecionar texto para marcar">𝐓</button>
          <button type="button" className="lp-barra__botao" aria-pressed={ferramenta === "area"} onClick={() => setFerramenta(ferramenta === "area" ? "texto" : "area")} title="Marcar uma área (figura, fórmula, PDF escaneado)">▭</button>
          <span className="lp-cores" role="group" aria-label="Cor do marca-texto">
            {CORES_DE_MARCACAO.map((c) => (
              <button key={c} type="button" className={`lp-cor lp-cor--${c}`} aria-pressed={prefs.cor === c} aria-label={NOMES_DAS_CORES[c]} onClick={() => mudarPrefs({ cor: c })} />
            ))}
          </span>
          <button type="button" className="lp-barra__botao" aria-pressed={Boolean(marcadorDaPagina)} onClick={alternarMarcador} title={marcadorDaPagina ? "Tirar o marcador desta página" : "Marcar esta página"}>🔖</button>
        </div>
        <div className="lp-barra__grupo">
          {[["claro", "☀️"], ["sepia", "📜"], ["escuro", "🌙"]].map(([t, i]) => (
            <button key={t} type="button" className="lp-barra__botao lp-barra__tema" aria-pressed={prefs.tema === t} onClick={() => mudarPrefs({ tema: t })} title={`Tema ${t === "sepia" ? "sépia" : t}`}>{i}</button>
          ))}
          {/* no celular, um botão só que passa pelos três temas */}
          <button type="button" className="lp-barra__botao lp-barra__tema-celular" onClick={() => mudarPrefs({ tema: { claro: "sepia", sepia: "escuro", escuro: "claro" }[prefs.tema] || "claro" })} title="Trocar o tema de leitura">
            {{ claro: "☀️", sepia: "📜", escuro: "🌙" }[prefs.tema] || "☀️"}
          </button>
          <button type="button" className="lp-barra__botao lp-barra__cheia" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : raiz.current?.requestFullscreen?.())} title="Tela cheia" aria-pressed={telaCheia}>⛶</button>
          {livro?.status === "pronto" && livro.paginasComTexto > 0 && (
            <Link href={`/trilhas/novo?livro=${livroId}`} className="lp-barra__curso" title="Gerar um curso a partir deste livro">🎓<span className="lp-barra__curso-texto"> Curso</span></Link>
          )}
        </div>
      </div>

      <div className="lp-progresso" aria-hidden="true"><i style={{ width: `${progressoDaLeitura(paginaAtual, total || 1)}%` }} /></div>
      {guardandoTexto !== null && <div className="lp-aviso">Guardando o texto do livro para a busca e os cursos… {Math.round(guardandoTexto * 100)}%</div>}
      {aviso && <div className="lp-aviso" role="status" onAnimationEnd={() => setAviso("")}>{aviso}</div>}

      <div className="lp-corpo">
        {painel && (
          <aside className="lp-lado" aria-label="Painel do leitor">
            <div className="lp-lado__abas" role="tablist">
              {PAINEIS.map((p) => (
                <button key={p.chave} type="button" role="tab" aria-selected={painel === p.chave} onClick={() => setPainel(p.chave)} title={p.rotulo}>
                  <span aria-hidden="true">{p.icone}</span><span className="lp-lado__rotulo">{p.rotulo}</span>
                </button>
              ))}
              <button type="button" className="lp-lado__fechar" onClick={() => setPainel(null)} aria-label="Fechar o painel">×</button>
            </div>
            <div className="lp-lado__conteudo">
              {painel === "sumario" && (
                livro?.sumario?.length ? (
                  <ul className="lp-sumario">
                    {livro.sumario.map((s, i) => {
                      const proximo = livro.sumario.slice(i + 1).find((x) => x.nivel <= s.nivel);
                      const aqui = paginaAtual >= s.pagina && (!proximo || paginaAtual < proximo.pagina);
                      return (
                        <li key={i} className={`lp-sumario__item lp-sumario__item--${Math.min(s.nivel, 4)}${aqui ? " lp-sumario__item--aqui" : ""}`}>
                          <button type="button" onClick={() => irParaPagina(s.pagina)}><span>{s.titulo}</span><small>{s.pagina}</small></button>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="lp-lado__vazio">Este PDF não tem sumário. Use as miniaturas ou a busca.</p>
              )}
              {painel === "paginas" && pdf && (
                <ul className="lp-miniaturas">
                  {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
                    <li key={n}>
                      <button type="button" className={n === paginaAtual ? "lp-miniatura--aqui" : ""} onClick={() => irParaPagina(n)} aria-label={`Página ${n}`}>
                        <Miniatura pdf={pdf} numero={n} />
                        <small>{n}{marcacoes.some((m) => m.pagina === n && m.tipo === "marcador") ? " 🔖" : ""}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {painel === "marcacoes" && (
                <ListaDeMarcacoes
                  marcacoes={marcacoes} livro={livro} livroId={livroId}
                  aoIr={(m) => irParaPagina(m.pagina)} aoApagar={apagarMarcacao}
                  aoCaderno={(m) => setParaCaderno({ marcacaoId: m.id, pagina: m.pagina })}
                  aoAviso={setAviso}
                />
              )}
              {painel === "busca" && (
                <div className="lp-busca">
                  <form onSubmit={buscar}>
                    <input id="lp-busca" type="search" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar no livro…" className="pf-campo__entrada" />
                  </form>
                  {livro?.status !== "pronto" && <p className="lp-lado__vazio">O texto do livro ainda está sendo guardado; a busca fica completa quando terminar.</p>}
                  {resultados === "buscando" && <p className="lp-lado__vazio">Buscando…</p>}
                  {Array.isArray(resultados) && (
                    <>
                      <p className="lp-busca__resumo">{resultados.length ? `${resultados.reduce((s, r) => s + r.vezes, 0)} vez(es) em ${resultados.length} página(s)` : "Nada encontrado."}</p>
                      <ul className="lp-busca__lista">
                        {resultados.map((r) => (
                          <li key={r.pagina}>
                            <button type="button" onClick={() => irParaPagina(r.pagina)} className={r.pagina === paginaAtual ? "lp-busca--aqui" : ""}>
                              <small>p. {r.pagina}{r.vezes > 1 ? ` · ${r.vezes}×` : ""}</small>
                              <span><Destacar texto={r.trecho} termo={termoAtivo} /></span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {termoAtivo && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => { setTermoAtivo(""); setResultados(null); setTermo(""); }}>Limpar a busca</button>}
                    </>
                  )}
                </div>
              )}
              {painel === "anotacoes" && (
                <div className="lp-anotacoes">
                  <AnotacoesDoAlvo alvo={{ tipo: "livro", id: livroId }} titulo="Páginas do caderno ligadas ao livro" nomeDoAlvo={livro?.titulo} />
                  <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setParaCaderno({ pagina: paginaAtual, texto: "", nota: "" })}>
                    📓 Anotar sobre a página {paginaAtual}
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}

        <div ref={rolagem} className="lp-rolagem" onScroll={aoRolar} onPointerUp={aoSoltar} onKeyUp={(e) => e.shiftKey && lerSelecao()}>
          {!pdf && <div className="pf-carregando lp-abrindo">Abrindo o livro…</div>}
          {pdf && (
            <div className="lp-paginas" style={{ height: topos[total + 1], minWidth: larguraMaxima + 32 }}>
              {paginasParaDesenhar.map(({ n, largura, altura }) => (
                <div key={n} className="lp-lugar" style={{ top: topos[n], height: altura, width: largura }}>
                  {n >= visiveis.de - 1 && n <= visiveis.ate + 1 ? (
                    <PaginaDoPdf
                      pdf={pdf} numero={n} escala={escala} largura={largura} altura={altura}
                      visivel={n >= visiveis.de && n <= visiveis.ate}
                      marcacoes={porPagina.get(n) || []} termo={termoAtivo}
                      ferramenta={ferramenta} corDaArea={prefs.cor} aoMedir={aoMedir}
                      aoArea={(pagina, r, ponto) => marcar({ tipo: "area" }, { pagina, texto: "", retangulos: [r], ...ponto })}
                    />
                  ) : (
                    <div className="lp-pagina lp-pagina--esperando" style={{ width: largura, height: altura }}><span className="lp-pagina__numero">{n}</span></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selecao && (
        <div className="lp-flutua" style={{ left: selecao.x, top: selecao.y + 8 }} onPointerDown={(e) => e.preventDefault()} role="toolbar" aria-label="Marcar a seleção">
          {CORES_DE_MARCACAO.map((c) => (
            <button key={c} type="button" className={`lp-cor lp-cor--${c}`} aria-label={`Destacar em ${NOMES_DAS_CORES[c]}`} title={`Destacar (${NOMES_DAS_CORES[c]})`} onClick={() => marcar({ cor: c })} />
          ))}
          <button type="button" onClick={() => marcar({ tipo: "sublinhado" })} title="Sublinhar">U̲</button>
          <button type="button" onClick={() => { setNotaEmEdicao({ ...selecao, tipo: "destaque", cor: prefs.cor }); setSelecao(null); }} title="Destacar com nota">💬</button>
          <button type="button" onClick={copiar} title="Copiar">⧉</button>
          <button type="button" onClick={() => { setParaCaderno({ pagina: selecao.pagina, texto: selecao.texto, nota: "" }); setSelecao(null); }} title="Mandar para o caderno">📓</button>
        </div>
      )}

      {aberta && (
        <div className="lp-flutua lp-flutua--marcacao" style={{ left: aberta.x, top: aberta.y + 10 }} role="dialog" aria-label="Marcação">
          <div className="lp-flutua__linha">
            {CORES_DE_MARCACAO.map((c) => (
              <button key={c} type="button" className={`lp-cor lp-cor--${c}`} aria-pressed={aberta.marcacao.cor === c} aria-label={NOMES_DAS_CORES[c]} onClick={() => editarMarcacao(aberta.marcacao, { cor: c })} />
            ))}
            {aberta.marcacao.tipo !== "area" && (
              <button type="button" onClick={() => editarMarcacao(aberta.marcacao, { tipo: aberta.marcacao.tipo === "sublinhado" ? "destaque" : "sublinhado" })} title="Trocar destaque/sublinhado">U̲</button>
            )}
            <button type="button" onClick={() => { setNotaEmEdicao({ marcacao: aberta.marcacao }); setAberta(null); }} title="Nota">💬</button>
            <button type="button" onClick={() => { setParaCaderno({ marcacaoId: aberta.marcacao.id, pagina: aberta.marcacao.pagina }); setAberta(null); }} title="Mandar para o caderno">📓</button>
            <button type="button" onClick={() => apagarMarcacao(aberta.marcacao)} title="Apagar">🗑️</button>
          </div>
          {aberta.marcacao.nota && <p className="lp-flutua__nota">{aberta.marcacao.nota}</p>}
        </div>
      )}

      {notaEmEdicao && (
        <EditorDeNota
          inicial={notaEmEdicao.marcacao?.nota || ""}
          texto={notaEmEdicao.marcacao?.texto || notaEmEdicao.texto}
          aoCancelar={() => setNotaEmEdicao(null)}
          aoGravar={async (nota) => {
            if (notaEmEdicao.marcacao) await editarMarcacao(notaEmEdicao.marcacao, { nota });
            else await marcar({ tipo: notaEmEdicao.tipo, cor: notaEmEdicao.cor, nota }, notaEmEdicao);
            setNotaEmEdicao(null);
          }}
        />
      )}

      {paraCaderno && (
        <MandarParaCaderno
          livro={livro} livroId={livroId} envio={paraCaderno}
          aoFechar={() => setParaCaderno(null)}
          aoFeito={(msg) => { setParaCaderno(null); setAviso(msg); window.getSelection()?.removeAllRanges(); }}
        />
      )}
    </div>
  );
}

/** O trecho da busca com o termo em negrito. */
function Destacar({ texto, termo }) {
  if (!termo) return texto;
  const i = texto.toLowerCase().indexOf(termo.toLowerCase());
  if (i < 0) return texto;
  return <>{texto.slice(0, i)}<mark>{texto.slice(i, i + termo.length)}</mark>{texto.slice(i + termo.length)}</>;
}

/** A nota de uma marcação: uma caixinha com o trecho em cima. */
function EditorDeNota({ inicial, texto, aoGravar, aoCancelar }) {
  const [nota, setNota] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="lp-modal" role="dialog" aria-label="Nota" onMouseDown={(e) => e.target === e.currentTarget && aoCancelar()}>
      <form className="lp-modal__caixa" onSubmit={async (e) => { e.preventDefault(); setOcupado(true); await aoGravar(nota.trim()); }}>
        <h2>💬 Nota</h2>
        {texto && <blockquote className="lp-modal__trecho">{texto}</blockquote>}
        <textarea className="pf-campo__entrada" rows={5} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={4000} autoFocus placeholder="O que esse trecho quer dizer, uma dúvida, uma ligação com outro assunto…" />
        <div className="pf-acoes">
          <button type="submit" className="pf-botao pf-botao--pequeno" disabled={ocupado}>{ocupado ? "Gravando…" : "Gravar nota"}</button>
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={aoCancelar} disabled={ocupado}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}

/** As marcações do livro, por página, com filtro de cor — e "exportar tudo para o caderno". */
function ListaDeMarcacoes({ marcacoes, livro, livroId, aoIr, aoApagar, aoCaderno, aoAviso }) {
  const [cor, setCor] = useState(null);
  const [exportando, setExportando] = useState(false);
  const lista = marcacoes.filter((m) => !cor || m.cor === cor);

  async function exportar() {
    setExportando(true);
    try {
      const { cadernos } = await obter("/api/cadernos");
      let cadernoId = cadernos.find((c) => c.titulo === livro.titulo)?.id;
      if (!cadernoId) cadernoId = (await criar("/api/cadernos", { titulo: livro.titulo.slice(0, 120), icone: "📘", cor: "azul" })).caderno.id;
      const conteudo = [`# Marcações — ${livro.titulo}`, "", ...lista.filter((m) => m.tipo !== "marcador").map((m) => citacaoDoLivro({ livroId, livroTitulo: livro.titulo, pagina: m.pagina, texto: m.texto || (m.tipo === "area" ? "(área marcada)" : ""), nota: m.nota }) + "\n")].join("\n");
      const { pagina } = await criar(`/api/cadernos/${cadernoId}/paginas`, { tipo: "pagina", titulo: `Marcações — ${livro.titulo}`.slice(0, 150), linguagem: "markdown", conteudo });
      await criar(`/api/cadernos/${cadernoId}/vinculos`, { paginaId: pagina.id, alvo: { tipo: "livro", id: livroId } }).catch(() => {});
      aoAviso(`Mandei ${lista.length} marcação(ões) para o caderno “${livro.titulo}”.`);
    } catch (e) {
      aoAviso(e.message);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="lp-marcacoes">
      <div className="lp-marcacoes__filtro" role="group" aria-label="Filtrar por cor">
        <button type="button" aria-pressed={!cor} onClick={() => setCor(null)}>Todas ({marcacoes.length})</button>
        {CORES_DE_MARCACAO.filter((c) => marcacoes.some((m) => m.cor === c)).map((c) => (
          <button key={c} type="button" className={`lp-cor lp-cor--${c}`} aria-pressed={cor === c} aria-label={NOMES_DAS_CORES[c]} onClick={() => setCor(cor === c ? null : c)} />
        ))}
      </div>
      {!lista.length && <p className="lp-lado__vazio">Nenhuma marcação ainda. Selecione um trecho do livro para destacar, sublinhar ou anotar.</p>}
      <ul className="lp-marcacoes__lista">
        {lista.map((m) => (
          <li key={m.id} className={`lp-marcacao lp-cor--${m.cor}`}>
            <button type="button" className="lp-marcacao__ir" onClick={() => aoIr(m)}>
              <small>{ICONES_DO_TIPO[m.tipo]} p. {m.pagina}</small>
              {m.texto ? <span className="lp-marcacao__texto">{m.texto}</span> : <span className="lp-marcacao__texto lp-marcacao__texto--vazio">{m.tipo === "marcador" ? "Marcador de página" : "Área marcada"}</span>}
              {m.nota && <span className="lp-marcacao__nota">💬 {m.nota}</span>}
            </button>
            <div className="lp-marcacao__acoes">
              {m.tipo !== "marcador" && <button type="button" onClick={() => aoCaderno(m)} title="Mandar para o caderno">📓</button>}
              <button type="button" onClick={() => aoApagar(m)} title="Apagar">🗑️</button>
            </div>
          </li>
        ))}
      </ul>
      {lista.some((m) => m.tipo !== "marcador") && (
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={exportar} disabled={exportando}>
          {exportando ? "Mandando…" : "📓 Exportar estas marcações para um caderno"}
        </button>
      )}
    </div>
  );
}

const ULTIMO_DESTINO = "proof-leitor-destino";

/**
 * Mandar um trecho (ou uma marcação) para o caderno: escolhe o caderno e a página (ou uma página
 * nova) e o trecho entra no fim dela, com o link que volta para esta página do livro.
 */
function MandarParaCaderno({ livro, livroId, envio, aoFechar, aoFeito }) {
  const [cadernos, setCadernos] = useState(null);
  const [cadernoId, setCadernoId] = useState("");
  const [paginas, setPaginas] = useState([]);
  const [paginaId, setPaginaId] = useState("");
  const [nota, setNota] = useState(envio.nota || "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    obter("/api/cadernos").then((r) => {
      setCadernos(r.cadernos);
      let ultimo = null;
      try { ultimo = JSON.parse(localStorage.getItem(ULTIMO_DESTINO) || "null"); } catch { /* nada */ }
      const escolhido = r.cadernos.find((c) => c.id === ultimo?.cadernoId)?.id || r.cadernos.find((c) => c.titulo === livro?.titulo)?.id || "";
      setCadernoId(escolhido);
      if (escolhido && ultimo?.cadernoId === escolhido) setPaginaId(ultimo.paginaId || "");
    }).catch((e) => setErro(e.message));
  }, [livro?.titulo]);

  useEffect(() => {
    if (!cadernoId) { setPaginas([]); return; }
    obter(`/api/cadernos/${cadernoId}`).then((r) => setPaginas(r.itens.filter((i) => i.tipo === "pagina"))).catch(() => setPaginas([]));
  }, [cadernoId]);

  async function mandar(e) {
    e.preventDefault();
    setOcupado(true);
    setErro("");
    try {
      let cid = cadernoId;
      if (!cid) cid = (await criar("/api/cadernos", { titulo: (livro?.titulo || "Livro").slice(0, 120), icone: "📘", cor: "azul" })).caderno.id;
      let pid = paginaId;
      if (!pid || pid === "nova") {
        const titulo = `${(livro?.titulo || "Livro").slice(0, 100)} — p. ${envio.pagina}`;
        pid = (await criar(`/api/cadernos/${cid}/paginas`, { tipo: "pagina", titulo, linguagem: "markdown", conteudo: `# ${titulo}\n` })).pagina.id;
      }
      await criar(`/api/paginas/${pid}/anexar`, envio.marcacaoId ? { marcacaoId: envio.marcacaoId } : { livroId, pagina: envio.pagina, texto: envio.texto, nota });
      try { localStorage.setItem(ULTIMO_DESTINO, JSON.stringify({ cadernoId: cid, paginaId: pid })); } catch { /* nada */ }
      aoFeito("Mandei para o caderno ✓");
    } catch (falha) {
      setErro(falha.message);
      setOcupado(false);
    }
  }

  return (
    <div className="lp-modal" role="dialog" aria-label="Mandar para o caderno" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <form className="lp-modal__caixa" onSubmit={mandar}>
        <h2>📓 Mandar para o caderno</h2>
        {envio.texto && <blockquote className="lp-modal__trecho">{envio.texto}</blockquote>}
        <p className="lp-modal__onde">De “{livro?.titulo}”, página {envio.pagina}. Vai com o link que volta para cá.</p>
        <label className="pf-campo">
          <span className="pf-campo__rotulo">Caderno</span>
          <select className="pf-campo__entrada" value={cadernoId} onChange={(e) => { setCadernoId(e.target.value); setPaginaId(""); }} disabled={ocupado || !cadernos}>
            <option value="">＋ Caderno novo “{(livro?.titulo || "").slice(0, 40)}”</option>
            {(cadernos || []).map((c) => <option key={c.id} value={c.id}>{c.icone} {c.titulo}</option>)}
          </select>
        </label>
        {cadernoId && (
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Página</span>
            <select className="pf-campo__entrada" value={paginaId} onChange={(e) => setPaginaId(e.target.value)} disabled={ocupado}>
              <option value="nova">＋ Página nova (“… — p. {envio.pagina}”)</option>
              {paginas.map((p) => <option key={p.id} value={p.id}>📄 {p.titulo}</option>)}
            </select>
          </label>
        )}
        {!envio.marcacaoId && (
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Nota (opcional)</span>
            <textarea className="pf-campo__entrada" rows={3} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={4000} disabled={ocupado} />
          </label>
        )}
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        <div className="pf-acoes">
          <button type="submit" className="pf-botao pf-botao--pequeno" disabled={ocupado || (!envio.texto && !envio.marcacaoId && !nota.trim())}>{ocupado ? "Mandando…" : "Mandar"}</button>
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={aoFechar} disabled={ocupado}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
