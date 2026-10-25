"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { obter, criar, mudar, remover } from "@/lib/api.js";
import {
  montarArvore, paginasEmOrdem, estatisticasDoTexto, LINGUAGENS_DO_CADERNO, rotuloDaLinguagemDoCaderno, CORES_DO_CADERNO, ICONES_DO_CADERNO,
} from "@/dominio/cadernos.js";
import { titulosDoMarkdown } from "@/dominio/markdown.js";
import EditorDoCaderno from "@/componentes/caderno/EditorDoCaderno.js";
import Previa from "@/componentes/caderno/Previa.js";
import Codigo from "@/componentes/codigo/Codigo.js";
import Folha from "@/componentes/Folha.js";
import { ChipDoAlvo, EscolherAlvo } from "@/componentes/caderno/Vinculos.js";

const PREFERENCIAS = "proof-caderno-preferencias";
const PADRAO = { quebrarLinha: true, tamanhoDaLetra: 15, espacosVisiveis: false, modo: "editor" };
const ESPERA_PARA_GRAVAR = 1200;

function lerPreferencias() {
  try {
    return { ...PADRAO, ...JSON.parse(localStorage.getItem(PREFERENCIAS) || "{}") };
  } catch {
    return PADRAO;
  }
}

const extensaoDa = (linguagem) => LINGUAGENS_DO_CADERNO.find((l) => l.chave === linguagem)?.extensoes[0] || "txt";
const hora = (d) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * Um caderno aberto (25/10/2026), no jeito do Notepad++: a árvore de módulos e páginas à esquerda,
 * as abas das páginas abertas em cima, o editor com a cor da linguagem e a barra de status embaixo.
 *
 * Grava sozinho (1,2 s depois de parar de digitar, ou Ctrl+S na hora). Cada gravação manda a versão
 * que a aba tem: se a página mudou em outro lugar (outra aba, o celular), a gravação é recusada e a
 * aba pergunta o que fazer — nada é apagado em silêncio. As gravações de uma página vão uma de cada
 * vez (a segunda espera a primeira voltar com a versão nova).
 */
export default function Caderno() {
  const { id } = useParams();
  const router = useRouter();
  const [caderno, setCaderno] = useState(null);
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState("");
  const [abas, setAbas] = useState([]);
  const [ativa, setAtiva] = useState(null);
  const [docs, setDocs] = useState({}); // id → { base, sujo, gravando, salvoEm, conflito, erro } (o que a tela mostra)
  const textos = useRef({}); // id → texto de agora (digitar não redesenha a tela)
  const paginas = useRef({}); // id → { versao, gravando, pendente, conflito, timer, carregando }
  const [prefs, setPrefs] = useState(PADRAO);
  const [cursor, setCursor] = useState({ linha: 1, coluna: 1, selecionados: 0 });
  const [filtro, setFiltro] = useState("");
  const [resultados, setResultados] = useState(null);
  const [fechados, setFechados] = useState(() => new Set());
  const [arvoreAberta, setArvoreAberta] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [vinculos, setVinculos] = useState([]);
  const [painel, setPainel] = useState(null); // null | { tipo: "vinculos", paginaId } | { tipo: "caderno" }
  const [renomeando, setRenomeando] = useState(null);
  const [menu, setMenu] = useState(null);
  const editores = useRef({});

  useEffect(() => { setPrefs(lerPreferencias()); }, []);
  const mudarPrefs = (p) => setPrefs((atual) => {
    const novo = { ...atual, ...p };
    try { localStorage.setItem(PREFERENCIAS, JSON.stringify(novo)); } catch { /* sem armazenamento: vale nesta visita */ }
    return novo;
  });

  const estado = (pid) => (paginas.current[pid] ||= { versao: 0 });
  const marcar = (pid, mudanca) => setDocs((d) => ({ ...d, [pid]: { ...d[pid], ...mudanca } }));

  const chaveDasAbas = `proof-caderno-abas-${id}`;
  const carregarVinculos = useCallback(() => obter(`/api/cadernos/${id}/vinculos`).then((r) => setVinculos(r.vinculos)).catch(() => {}), [id]);

  const carregar = useCallback(async () => {
    try {
      const r = await obter(`/api/cadernos/${id}`);
      setCaderno(r.caderno);
      setItens(r.itens);
      setErro("");
      return r;
    } catch (e) {
      setErro(e.message);
      return null;
    }
  }, [id]);

  /** Carrega o texto da página (uma vez só, mesmo com dois pedidos ao mesmo tempo). */
  const carregarTexto = useCallback(async (pid) => {
    const e = estado(pid);
    if (textos.current[pid] !== undefined || e.carregando) return;
    e.carregando = true;
    try {
      const { pagina } = await obter(`/api/paginas/${pid}`);
      textos.current[pid] = pagina.conteudo;
      e.versao = pagina.versao;
      marcar(pid, { base: pagina.conteudo, sujo: false, erro: "" });
    } catch (falha) {
      marcar(pid, { base: "", erro: falha.message });
    } finally {
      e.carregando = false;
    }
  }, []);

  const abrir = useCallback((pid, { linha } = {}) => {
    setAbas((a) => (a.includes(pid) ? a : [...a, pid]));
    setAtiva(pid);
    setArvoreAberta(false);
    carregarTexto(pid).then(() => { if (linha) setTimeout(() => editores.current[pid]?.irParaLinha(linha), 150); });
  }, [carregarTexto]);

  // entrada: o caderno, as abas da última visita e a página pedida no endereço (?pagina=)
  useEffect(() => {
    (async () => {
      const r = await carregar();
      if (!r) return;
      carregarVinculos();
      const existe = new Set(r.itens.filter((i) => i.tipo === "pagina").map((i) => i.id));
      let guardadas = [];
      try { guardadas = JSON.parse(localStorage.getItem(chaveDasAbas) || "[]").filter((x) => existe.has(x)); } catch { /* nada guardado */ }
      const pedida = new URLSearchParams(window.location.search).get("pagina");
      const primeira = paginasEmOrdem(montarArvore(r.itens))[0]?.id;
      const alvo = pedida && existe.has(pedida) ? pedida : guardadas[0] || primeira;
      setAbas([...new Set([...guardadas, alvo].filter(Boolean))]);
      if (alvo) abrir(alvo);
    })();
    // só na entrada do caderno
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!ativa) return;
    try { localStorage.setItem(chaveDasAbas, JSON.stringify([ativa, ...abas.filter((a) => a !== ativa)])); } catch { /* nada */ }
  }, [abas, ativa, chaveDasAbas]);

  // aba que veio da última visita carrega o texto quando vira a ativa
  useEffect(() => { if (ativa) carregarTexto(ativa); }, [ativa, carregarTexto]);

  const arvore = useMemo(() => montarArvore(itens), [itens]);
  const porId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  const paginaAtiva = ativa ? porId.get(ativa) : null;
  const docAtivo = ativa ? docs[ativa] : null;

  // ------------------------------------------------------------ gravar

  const gravar = useCallback(async (pid, { forcar = false } = {}) => {
    const e = estado(pid);
    clearTimeout(e.timer);
    if (e.gravando) { e.pendente = true; return; } // grava de novo quando esta voltar
    if (e.conflito && !forcar) return;
    const texto = textos.current[pid];
    if (texto === undefined) return;
    e.gravando = true;
    marcar(pid, { gravando: true });
    try {
      if (forcar) e.versao = (await obter(`/api/paginas/${pid}`)).pagina.versao;
      const { pagina } = await mudar(`/api/paginas/${pid}`, { conteudo: texto, versao: e.versao });
      e.versao = pagina.versao;
      e.conflito = false;
      const sujo = textos.current[pid] !== texto;
      marcar(pid, { gravando: false, conflito: false, erro: "", salvoEm: new Date(), sujo });
      setItens((lista) => lista.map((i) => (i.id === pid ? { ...i, versao: pagina.versao, atualizadoEm: pagina.atualizadoEm } : i)));
    } catch (falha) {
      e.conflito = /alterada em outro lugar/.test(falha.message);
      marcar(pid, { gravando: false, conflito: e.conflito, erro: e.conflito ? "" : falha.message });
    } finally {
      e.gravando = false;
      if (e.pendente && !e.conflito) { e.pendente = false; gravar(pid); }
    }
  }, []);

  const aoMudarTexto = useCallback((pid, texto) => {
    textos.current[pid] = texto;
    const e = estado(pid);
    setDocs((d) => (d[pid]?.sujo ? d : { ...d, [pid]: { ...d[pid], sujo: true } }));
    clearTimeout(e.timer);
    e.timer = setTimeout(() => gravar(pid), ESPERA_PARA_GRAVAR);
  }, [gravar]);

  // sair com algo por gravar: o navegador pergunta
  useEffect(() => {
    const antes = (ev) => { if (Object.values(docs).some((d) => d?.sujo)) { ev.preventDefault(); ev.returnValue = ""; } };
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [docs]);

  async function recarregarDeLa(pid) {
    const { pagina } = await obter(`/api/paginas/${pid}`);
    textos.current[pid] = pagina.conteudo;
    Object.assign(estado(pid), { versao: pagina.versao, conflito: false, pendente: false });
    marcar(pid, { base: pagina.conteudo, sujo: false, conflito: false });
  }

  // ------------------------------------------------------------ árvore

  async function novaPagina({ tipo = "pagina", moduloId = null } = {}) {
    const quantas = itens.filter((i) => i.tipo === tipo).length + 1;
    const titulo = tipo === "modulo" ? `Módulo ${quantas}` : `sem título ${quantas}.md`;
    try {
      const { pagina } = await criar(`/api/cadernos/${id}/paginas`, { tipo, titulo, moduloId });
      setItens((l) => [...l, pagina]);
      if (moduloId) setFechados((s) => { const n = new Set(s); n.delete(moduloId); return n; });
      if (pagina.tipo === "pagina") {
        textos.current[pagina.id] = "";
        estado(pagina.id).versao = pagina.versao;
        marcar(pagina.id, { base: "", sujo: false });
        abrir(pagina.id);
      }
      setRenomeando(pagina.id); // já entra no nome, para trocar o "sem título"
    } catch (e) {
      setErro(e.message);
    }
  }

  async function renomear(item, titulo) {
    setRenomeando(null);
    if (!titulo.trim() || titulo === item.titulo) return;
    try {
      const { pagina } = await mudar(`/api/paginas/${item.id}`, { titulo });
      setItens((l) => l.map((i) => (i.id === item.id ? { ...i, ...pagina } : i)));
      if (pagina.versao) estado(item.id).versao = pagina.versao;
    } catch (e) {
      setErro(e.message);
    }
  }

  async function mover(item, direcao) {
    setMenu(null);
    try {
      const { ordens } = await criar(`/api/paginas/${item.id}/mover`, { direcao });
      const nova = new Map(ordens.map((o) => [o.id, o.ordem]));
      setItens((l) => l.map((i) => (nova.has(i.id) ? { ...i, ordem: nova.get(i.id) } : i)));
    } catch (e) {
      setErro(e.message);
    }
  }

  async function moverParaModulo(item, moduloId) {
    setMenu(null);
    try {
      const { pagina } = await mudar(`/api/paginas/${item.id}`, { moduloId: moduloId || null });
      setItens((l) => l.map((i) => (i.id === item.id ? { ...i, ...pagina } : i)));
      estado(item.id).versao = pagina.versao;
    } catch (e) {
      setErro(e.message);
    }
  }

  function fecharAba(pid) {
    if (docs[pid]?.sujo) gravar(pid);
    setAbas((a) => {
      const resto = a.filter((x) => x !== pid);
      if (ativa === pid) setAtiva(resto.at(-1) || null);
      return resto;
    });
  }

  async function apagar(item) {
    setMenu(null);
    const filhas = item.tipo === "modulo" ? itens.filter((i) => i.moduloId === item.id).length : 0;
    const aviso = item.tipo === "modulo"
      ? `Apagar o módulo “${item.titulo}”${filhas ? ` e as ${filhas} página(s) dele` : ""}? Não tem volta.`
      : `Apagar a página “${item.titulo}”? Não tem volta.`;
    if (!window.confirm(aviso)) return;
    try {
      await remover(`/api/paginas/${item.id}`);
      const saem = new Set([item.id, ...itens.filter((i) => i.moduloId === item.id).map((i) => i.id)]);
      for (const pid of saem) { clearTimeout(paginas.current[pid]?.timer); delete textos.current[pid]; }
      setItens((l) => l.filter((i) => !saem.has(i.id)));
      setAbas((a) => a.filter((x) => !saem.has(x)));
      if (saem.has(ativa)) setAtiva(abas.find((x) => !saem.has(x)) || null);
      carregarVinculos();
    } catch (e) {
      setErro(e.message);
    }
  }

  // busca em todas as páginas
  useEffect(() => {
    const t = filtro.trim();
    if (t.length < 2) { setResultados(null); return undefined; }
    const espera = setTimeout(() => {
      obter(`/api/cadernos/${id}/busca?q=${encodeURIComponent(t)}`).then((r) => setResultados(r.resultados)).catch(() => setResultados([]));
    }, 350);
    return () => clearTimeout(espera);
  }, [filtro, id]);

  // ------------------------------------------------------------ caderno

  async function editarCaderno(mudanca) {
    try {
      const { caderno: c } = await mudar(`/api/cadernos/${id}`, mudanca);
      setCaderno(c);
    } catch (e) {
      setErro(e.message);
    }
  }

  async function apagarCaderno() {
    if (!window.confirm(`Apagar o caderno “${caderno.titulo}” com todas as páginas? Não tem volta.`)) return;
    try {
      await remover(`/api/cadernos/${id}`);
      router.push("/cadernos");
    } catch (e) {
      setErro(e.message);
    }
  }

  function baixar() {
    if (!paginaAtiva) return;
    const nome = /\.[a-z0-9]{1,10}$/i.test(paginaAtiva.titulo) ? paginaAtiva.titulo : `${paginaAtiva.titulo}.${extensaoDa(paginaAtiva.linguagem)}`;
    const url = URL.createObjectURL(new Blob([textos.current[ativa] ?? ""], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: nome.replace(/[\\/:*?"<>|]+/g, "-") });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function mudarLinguagem(linguagem) {
    try {
      const { pagina } = await mudar(`/api/paginas/${ativa}`, { linguagem });
      setItens((l) => l.map((i) => (i.id === ativa ? { ...i, ...pagina } : i)));
      estado(ativa).versao = pagina.versao;
    } catch (e) {
      setErro(e.message);
    }
  }

  // Ctrl+Alt+N: página nova. Esc: sai da tela cheia.
  const novaRef = useRef(novaPagina);
  novaRef.current = novaPagina;
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") setTelaCheia(false);
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); novaRef.current(); }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);

  // o menu "⋯" fecha ao clicar fora
  useEffect(() => {
    if (!menu) return undefined;
    const fora = (e) => { if (!e.target.closest?.(".cd-menu, .cd-arvore__mais")) setMenu(null); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [menu]);

  if (!caderno) return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Abrindo o caderno…</div>;

  const vinculosDaPagina = vinculos.filter((v) => v.paginaId === ativa);
  const vinculosDoCaderno = vinculos.filter((v) => !v.paginaId);
  const estat = paginaAtiva ? estatisticasDoTexto(textos.current[ativa] ?? "") : null;
  const ehMarkdown = paginaAtiva?.linguagem === "markdown";
  const modo = prefs.modo;
  const modulos = itens.filter((i) => i.tipo === "modulo");
  const vinculadas = new Set(vinculos.map((v) => v.paginaId).filter(Boolean));

  // uma função (e não um componente): a árvore não é recriada a cada tecla, e o campo de renomear não perde o foco
  const itemDaArvore = (item, dentro = false) => {
    const aberto = item.tipo === "modulo" && !fechados.has(item.id);
    return (
      <li key={item.id} className={`cd-arvore__item${item.tipo === "modulo" ? " cd-arvore__item--modulo" : ""}${ativa === item.id ? " cd-arvore__item--ativo" : ""}${dentro ? " cd-arvore__item--dentro" : ""}`}>
        {renomeando === item.id ? (
          <input
            className="cd-arvore__renomear" defaultValue={item.titulo} autoFocus maxLength={160} aria-label="Novo nome"
            // nome padrão ("sem título 3.md"): seleciona tudo, para digitar "rotas.py" e pronto; nome dado: só antes da extensão
            onFocus={(e) => { const v = e.target.value; const ponto = v.lastIndexOf("."); e.target.setSelectionRange(0, ponto > 0 && !/^sem título/.test(v) ? ponto : v.length); }}
            onBlur={(e) => renomear(item, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setRenomeando(null); }}
          />
        ) : (
          <button
            type="button" className="cd-arvore__nome" title={`${item.titulo} (duplo clique renomeia)`}
            aria-expanded={item.tipo === "modulo" ? aberto : undefined}
            onClick={() => (item.tipo === "modulo"
              ? setFechados((s) => { const n = new Set(s); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n; })
              : abrir(item.id))}
            onDoubleClick={() => setRenomeando(item.id)}
          >
            <span className="cd-arvore__icone" aria-hidden="true">{item.tipo === "modulo" ? (aberto ? "📂" : "📁") : "📄"}</span>
            <span className="cd-arvore__titulo">{item.titulo}</span>
            {docs[item.id]?.sujo && <span className="cd-ponto" title="não gravado" />}
            {vinculadas.has(item.id) && <span className="cd-arvore__vinc" title="tem vínculo">🔗</span>}
          </button>
        )}
        <button type="button" className="cd-arvore__mais" aria-label={`Ações de ${item.titulo}`} aria-expanded={menu === item.id} onClick={() => setMenu(menu === item.id ? null : item.id)}>⋯</button>
        {menu === item.id && (
          <div className="cd-menu" role="menu">
            {item.tipo === "modulo" && <button type="button" role="menuitem" onClick={() => { setMenu(null); novaPagina({ moduloId: item.id }); }}>＋ Página neste módulo</button>}
            <button type="button" role="menuitem" onClick={() => { setMenu(null); setRenomeando(item.id); }}>✏️ Renomear</button>
            <button type="button" role="menuitem" onClick={() => mover(item, "cima")}>↑ Subir</button>
            <button type="button" role="menuitem" onClick={() => mover(item, "baixo")}>↓ Descer</button>
            {item.tipo === "pagina" && modulos.length > 0 && (
              <label className="cd-menu__mover">
                <span>Mover para</span>
                <select value={item.moduloId || ""} onChange={(e) => moverParaModulo(item, e.target.value)}>
                  <option value="">(raiz do caderno)</option>
                  {modulos.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                </select>
              </label>
            )}
            <button type="button" role="menuitem" onClick={() => { setMenu(null); setPainel({ tipo: "vinculos", paginaId: item.id }); }}>🔗 Vincular…</button>
            <button type="button" role="menuitem" className="cd-menu__perigo" onClick={() => apagar(item)}>🗑️ Apagar</button>
          </div>
        )}
        {item.tipo === "modulo" && aberto && (
          <ul className="cd-arvore__filhos">
            {item.paginas.map((p) => itemDaArvore(p, true))}
            {!item.paginas.length && <li className="cd-arvore__vazio">sem páginas</li>}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className={`cd-caderno cd-cor--${caderno.cor}${telaCheia ? " cd-caderno--cheia" : ""}`}>
      <div className="cd-topo">
        <Link href="/cadernos" className="cd-topo__voltar" aria-label="Voltar para os cadernos">←</Link>
        <button type="button" className="cd-topo__nome" onClick={() => setPainel({ tipo: "caderno" })} title="Nome, cor e ícone do caderno">
          <span aria-hidden="true">{caderno.icone}</span>
          <span>{caderno.titulo}</span>
        </button>
        <div className="cd-topo__chips">
          {vinculosDoCaderno.slice(0, 3).map((v) => <ChipDoAlvo key={v.id} alvo={v.alvo} />)}
        </div>
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno cd-topo__acao" onClick={() => setPainel({ tipo: "vinculos", paginaId: ativa })}>
          🔗 Vínculos{vinculos.length ? ` (${vinculos.length})` : ""}
        </button>
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno cd-topo__acao cd-so-celular" onClick={() => setArvoreAberta((a) => !a)} aria-expanded={arvoreAberta}>
          ☰ Páginas
        </button>
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro cd-erro" role="alert">{erro} <button type="button" onClick={() => setErro("")} aria-label="Fechar aviso">×</button></div>}

      <div className="cd-area">
        <aside className={`cd-lado${arvoreAberta ? " cd-lado--aberto" : ""}`} aria-label="Páginas do caderno">
          <input className="cd-lado__busca" type="search" placeholder="🔍 Buscar em todas as páginas" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar em todas as páginas" />
          {resultados ? (
            <ul className="cd-resultados">
              {!resultados.length && <li className="cd-arvore__vazio">nada encontrado</li>}
              {resultados.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => abrir(r.id, { linha: r.linha })}>
                    <strong>{r.titulo}</strong>
                    {r.trecho && <small>{r.linha ? `L${r.linha}: ` : ""}{r.trecho}</small>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="cd-arvore">
              {arvore.map((item) => itemDaArvore(item))}
              {!arvore.length && <li className="cd-arvore__vazio">caderno vazio</li>}
            </ul>
          )}
          <div className="cd-lado__acoes">
            <button type="button" className="pf-botao pf-botao--pequeno" onClick={() => novaPagina()}>＋ Página</button>
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => novaPagina({ tipo: "modulo" })}>＋ Módulo</button>
          </div>
        </aside>

        <section className="cd-principal">
          <div className="cd-abas" role="tablist" aria-label="Páginas abertas">
            {abas.map((pid) => {
              const p = porId.get(pid);
              if (!p) return null;
              return (
                <div key={pid} className={`cd-aba${pid === ativa ? " cd-aba--ativa" : ""}`}
                  onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); fecharAba(pid); } }}>
                  <button type="button" role="tab" aria-selected={pid === ativa} className="cd-aba__nome" onClick={() => setAtiva(pid)} title={p.titulo}>
                    {p.titulo}{docs[pid]?.sujo && <span className="cd-ponto" aria-label="não gravado" />}
                  </button>
                  <button type="button" className="cd-aba__fechar" onClick={() => fecharAba(pid)} aria-label={`Fechar ${p.titulo}`}>×</button>
                </div>
              );
            })}
            <button type="button" className="cd-aba cd-aba--nova" onClick={() => novaPagina()} aria-label="Página nova" title="Página nova (Ctrl+Alt+N)">＋</button>
          </div>

          {paginaAtiva ? (
            <>
              <div className="cd-ferramentas" role="toolbar" aria-label="Ferramentas do editor">
                <select className="cd-ferramentas__linguagem" value={paginaAtiva.linguagem} onChange={(e) => mudarLinguagem(e.target.value)} aria-label="Linguagem da página">
                  {LINGUAGENS_DO_CADERNO.map((l) => <option key={l.chave} value={l.chave}>{l.rotulo}</option>)}
                </select>
                <div className="cd-segmento" role="group" aria-label="Modo de ver">
                  {[["editor", "Editor"], ["dividido", "Dividido"], ["previa", "Prévia"]].map(([m, r]) => (
                    <button key={m} type="button" aria-pressed={modo === m} onClick={() => mudarPrefs({ modo: m })}>{r}</button>
                  ))}
                </div>
                <button type="button" aria-pressed={prefs.quebrarLinha} onClick={() => mudarPrefs({ quebrarLinha: !prefs.quebrarLinha })} title="Quebra de linha automática">↩ Quebra</button>
                <button type="button" aria-pressed={prefs.espacosVisiveis} onClick={() => mudarPrefs({ espacosVisiveis: !prefs.espacosVisiveis })} title="Mostrar espaços e tabulações" aria-label="Mostrar espaços">¶</button>
                <button type="button" onClick={() => mudarPrefs({ tamanhoDaLetra: Math.max(11, prefs.tamanhoDaLetra - 1) })} aria-label="Letra menor" title="Letra menor">A−</button>
                <button type="button" onClick={() => mudarPrefs({ tamanhoDaLetra: Math.min(24, prefs.tamanhoDaLetra + 1) })} aria-label="Letra maior" title="Letra maior">A+</button>
                <button type="button" onClick={() => editores.current[ativa]?.buscar()} title="Buscar e substituir (Ctrl+F / Ctrl+H)" aria-label="Buscar e substituir">🔍</button>
                <button type="button" onClick={baixar} title="Baixar a página como arquivo" aria-label="Baixar a página">⬇</button>
                <button type="button" onClick={() => setTelaCheia((t) => !t)} aria-pressed={telaCheia} title="Tela cheia (Esc sai)" aria-label="Tela cheia">⛶</button>
                <span className="cd-ferramentas__vinc">
                  {vinculosDaPagina.map((v) => <ChipDoAlvo key={v.id} alvo={v.alvo} />)}
                  <button type="button" onClick={() => setPainel({ tipo: "vinculos", paginaId: ativa })} className="cd-ferramentas__vincular">🔗 Vincular página</button>
                </span>
              </div>

              {docAtivo?.conflito && (
                <div className="pf-aviso cd-conflito" role="alert">
                  <span>Esta página foi alterada em outro lugar (outra aba ou outro aparelho) depois que você abriu.</span>
                  <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => recarregarDeLa(ativa)}>Ver a versão de lá</button>
                  <button type="button" className="pf-botao pf-botao--pequeno" onClick={() => gravar(ativa, { forcar: true })}>Manter a minha</button>
                </div>
              )}
              {docAtivo?.erro && (
                <div className="pf-aviso pf-aviso--erro cd-conflito" role="alert">
                  <span>Não gravou: {docAtivo.erro}</span>
                  <button type="button" className="pf-botao pf-botao--pequeno" onClick={() => gravar(ativa)}>Tentar de novo</button>
                </div>
              )}

              <div className={`cd-folha cd-folha--${modo}`}>
                {abas.map((pid) => {
                  const p = porId.get(pid);
                  const d = docs[pid];
                  if (!p || !d || d.base === undefined) return null;
                  return (
                    <div key={pid} className="cd-folha__editor" hidden={pid !== ativa || modo === "previa"}>
                      <EditorDoCaderno
                        ref={(r) => { editores.current[pid] = r; }}
                        valor={d.base}
                        linguagem={p.linguagem}
                        quebrarLinha={prefs.quebrarLinha}
                        tamanhoDaLetra={prefs.tamanhoDaLetra}
                        espacosVisiveis={prefs.espacosVisiveis}
                        aoMudar={(t) => aoMudarTexto(pid, t)}
                        aoGravar={() => gravar(pid)}
                        aoCursor={pid === ativa ? setCursor : undefined}
                        rotulo={p.titulo}
                      />
                    </div>
                  );
                })}
                {!docAtivo && <div className="pf-carregando cd-folha__carregando">Abrindo a página…</div>}
                {modo !== "editor" && docAtivo && (
                  <div className="cd-folha__previa">
                    <PreviaAoVivo ehMarkdown={ehMarkdown} linguagem={paginaAtiva.linguagem} textos={textos} ativa={ativa} base={docAtivo.base} />
                  </div>
                )}
              </div>

              <div className="cd-status" aria-live="polite">
                <span>Ln {cursor.linha}, Col {cursor.coluna}{cursor.selecionados ? ` · ${cursor.selecionados} sel.` : ""}</span>
                {estat && <span className="cd-status__contagem">{estat.linhas} linhas · {estat.palavras} palavras · {estat.caracteres} caracteres</span>}
                <span>{rotuloDaLinguagemDoCaderno(paginaAtiva.linguagem)}</span>
                <span className="cd-status__fixo">UTF-8 · LF</span>
                <span className="cd-status__salvo">
                  {docAtivo?.gravando ? "Gravando…" : docAtivo?.sujo ? "● não gravado" : docAtivo?.salvoEm ? `✓ gravado às ${hora(docAtivo.salvoEm)}` : "✓ em dia"}
                </span>
              </div>
            </>
          ) : (
            <div className="cd-vazio">
              <p>Nenhuma página aberta.</p>
              <button type="button" className="pf-botao" onClick={() => novaPagina()}>＋ Criar uma página</button>
            </div>
          )}
        </section>
      </div>

      <Folha aberta={painel?.tipo === "vinculos"} aoFechar={() => setPainel(null)} titulo="Vínculos do caderno">
        {painel?.tipo === "vinculos" && (
          <PainelDeVinculos
            cadernoId={id} caderno={caderno} vinculos={vinculos} pagina={painel.paginaId ? porId.get(painel.paginaId) : null}
            porId={porId} aoMudar={carregarVinculos} aoAbrir={(pid) => { setPainel(null); if (porId.get(pid)?.tipo === "pagina") abrir(pid); }}
          />
        )}
      </Folha>
      <Folha aberta={painel?.tipo === "caderno"} aoFechar={() => setPainel(null)} titulo="Caderno">
        {painel?.tipo === "caderno" && (
          <div className="cd-painel">
            <h2>Caderno</h2>
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Nome</span>
              <input className="pf-campo__entrada" defaultValue={caderno.titulo} maxLength={120} onBlur={(e) => e.target.value.trim() && e.target.value !== caderno.titulo && editarCaderno({ titulo: e.target.value })} />
            </label>
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Descrição</span>
              <input className="pf-campo__entrada" defaultValue={caderno.descricao} maxLength={400} onBlur={(e) => e.target.value !== caderno.descricao && editarCaderno({ descricao: e.target.value })} />
            </label>
            <div className="pf-campo">
              <span className="pf-campo__rotulo">Ícone</span>
              <div className="cd-icones">{ICONES_DO_CADERNO.map((i) => <button key={i} type="button" aria-pressed={caderno.icone === i} onClick={() => editarCaderno({ icone: i })}>{i}</button>)}</div>
            </div>
            <div className="pf-campo">
              <span className="pf-campo__rotulo">Cor</span>
              <div className="cd-cores">{CORES_DO_CADERNO.map((c) => <button key={c} type="button" className={`cd-cor cd-cor--${c}`} aria-pressed={caderno.cor === c} aria-label={c} onClick={() => editarCaderno({ cor: c })} />)}</div>
            </div>
            <button type="button" className="pf-botao pf-botao--perigo pf-botao--pequeno" onClick={apagarCaderno}>Apagar o caderno</button>
          </div>
        )}
      </Folha>
    </div>
  );
}

/** A prévia acompanha o texto de agora (lido da referência a cada 400 ms, sem redesenhar a cada tecla). */
function PreviaAoVivo({ ehMarkdown, linguagem, textos, ativa, base }) {
  const [agora, setAgora] = useState(textos.current[ativa] ?? "");
  useEffect(() => {
    setAgora(textos.current[ativa] ?? "");
    const t = setInterval(() => {
      const novo = textos.current[ativa] ?? "";
      setAgora((v) => (v === novo ? v : novo));
    }, 400);
    return () => clearInterval(t);
  }, [ativa, base, textos]);
  if (!ehMarkdown) return <Codigo texto={agora || " "} linguagem={linguagem === "texto" ? "" : linguagem} />;
  const titulos = titulosDoMarkdown(agora);
  return (
    <>
      {titulos.length > 2 && (
        <nav className="cd-indice" aria-label="Índice da página">
          {titulos.map((t, i) => <span key={i} className={`cd-indice__item cd-indice__item--${t.nivel}`}>{t.texto}</span>)}
        </nav>
      )}
      <Previa texto={agora} />
    </>
  );
}

/** O painel de vínculos: o que está ligado à página (ou módulo) escolhida, ao caderno inteiro e às outras páginas. */
function PainelDeVinculos({ cadernoId, caderno, vinculos, pagina, porId, aoMudar, aoAbrir }) {
  const [escolhendo, setEscolhendo] = useState(null); // null | "pagina" | "caderno"
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function vincular(alvo) {
    setOcupado(true);
    setErro("");
    try {
      await criar(`/api/cadernos/${cadernoId}/vinculos`, { paginaId: escolhendo === "pagina" ? pagina?.id : null, alvo });
      setEscolhendo(null);
      await aoMudar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function tirar(v) {
    try {
      await remover(`/api/vinculos/${v.id}`);
      await aoMudar();
    } catch (e) {
      setErro(e.message);
    }
  }

  const daPagina = pagina ? vinculos.filter((v) => v.paginaId === pagina.id) : [];
  const doCaderno = vinculos.filter((v) => !v.paginaId);
  const outras = new Map();
  for (const v of vinculos) if (v.paginaId && v.paginaId !== pagina?.id) outras.set(v.paginaId, [...(outras.get(v.paginaId) || []), v]);

  if (escolhendo) {
    return (
      <div className="cd-painel">
        <h2>{escolhendo === "pagina" ? `Vincular “${pagina?.titulo}” a…` : `Vincular o caderno “${caderno.titulo}” a…`}</h2>
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        <EscolherAlvo aoEscolher={vincular} aoCancelar={() => setEscolhendo(null)} ocupado={ocupado} />
      </div>
    );
  }
  return (
    <div className="cd-painel">
      <h2>Vínculos</h2>
      <p className="cd-painel__nota">Ligue o caderno, um módulo ou uma página a uma trilha, um curso, um assunto, uma torre, um andar ou a página de um livro. Lá aparece o “📓 Anotações” com o caminho de volta para cá.</p>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {pagina && (
        <section className="cd-painel__bloco">
          <h3>{pagina.tipo === "modulo" ? "📁" : "📄"} {pagina.titulo}</h3>
          <div className="cd-painel__chips">
            {daPagina.map((v) => <ChipDoAlvo key={v.id} alvo={v.alvo} aoTirar={() => tirar(v)} />)}
            {!daPagina.length && <span className="cd-painel__vazio">nenhum vínculo</span>}
          </div>
          <button type="button" className="pf-botao pf-botao--pequeno" onClick={() => setEscolhendo("pagina")}>🔗 Vincular {pagina.tipo === "modulo" ? "este módulo" : "esta página"}…</button>
        </section>
      )}
      <section className="cd-painel__bloco">
        <h3>{caderno.icone} O caderno inteiro</h3>
        <div className="cd-painel__chips">
          {doCaderno.map((v) => <ChipDoAlvo key={v.id} alvo={v.alvo} aoTirar={() => tirar(v)} />)}
          {!doCaderno.length && <span className="cd-painel__vazio">nenhum vínculo</span>}
        </div>
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setEscolhendo("caderno")}>🔗 Vincular o caderno…</button>
      </section>
      {outras.size > 0 && (
        <section className="cd-painel__bloco">
          <h3>Outras páginas</h3>
          <ul className="cd-painel__outras">
            {[...outras.entries()].map(([pid, lista]) => (
              <li key={pid}>
                <button type="button" className="cd-painel__pagina" onClick={() => aoAbrir(pid)}>{porId.get(pid)?.tipo === "modulo" ? "📁" : "📄"} {porId.get(pid)?.titulo || "página"}</button>
                <div className="cd-painel__chips">{lista.map((v) => <ChipDoAlvo key={v.id} alvo={v.alvo} aoTirar={() => tirar(v)} />)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
