"use client";

// Painel ProcessMap (01/11/2026): "quero poder usar o processmap livremente de dentro da Lisa,
// podendo criar projetos e salvar os fluxogramas, inclusive os fluxos que a Lisa desenha".
//
// À esquerda, os projetos e os fluxogramas de cada um; à direita, o ProcessMap inteiro (o de
// public/diagramas, num iframe do mesmo endereço, pela mesma ponte do quadro da Lisa —
// window.PonteDoProof). Tudo se salva sozinho: cada mudança espera um instante de calma e vai para o
// banco (criarSalvador, em src/lib/fluxogramasNoNavegador.js); sem fluxo aberto, o primeiro traço já
// cria um. A barra de baixo pede à Lisa um desenho, ou uma mudança no que está aberto (/api/diagrama,
// o mesmo do quadro dela). Os fluxos que a Lisa desenha na conversa chegam aqui pelo "salvar" do
// quadro dela (QuadroDaLisa.js), com a marca ✦.

import { useEffect, useRef, useState } from "react";
import { apiDosFluxos, assinaturaDoDesenho, criarSalvador, LIMITE_DO_KEEPALIVE } from "@/lib/fluxogramasNoNavegador.js";

const api = apiDosFluxos();
const CHAVE_DO_ULTIMO = "lisa-processmap-ultimo";
const NOMES_NOVOS = { diagram: "Novo fluxograma", mindmap: "Novo mapa mental" };
const ehNomeNovo = (nome) => Object.values(NOMES_NOVOS).includes(nome);
const hora = (d) => (d ? new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
// "14:32" se foi hoje; "31/10" se não
function quando(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toDateString() === new Date().toDateString() ? hora(d) : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
const slug = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "fluxograma";
const lembrar = (id) => { try { if (id) localStorage.setItem(CHAVE_DO_ULTIMO, id); else localStorage.removeItem(CHAVE_DO_ULTIMO); } catch { /* sem armazenamento */ } };
const ultimoAberto = () => { try { return localStorage.getItem(CHAVE_DO_ULTIMO); } catch { return null; } };
const marcarNoEndereco = (id) => { try { window.history.replaceState(null, "", id ? `/fluxogramas?fluxo=${encodeURIComponent(id)}` : "/fluxogramas"); } catch { /* fica o endereço de antes */ } };

const TEXTO_DO_ESTADO = {
  rascunho: "rascunho · o primeiro traço já salva",
  pendente: "alterado…",
  salvando: "salvando…",
  erro: "não salvou",
  conflito: "mudou em outro lugar",
};

/** Um menu pequeno de ações, aberto pelo "⋯" de um projeto ou fluxo. */
function Menu({ itens, aoFechar }) {
  return (
    <div className="bb-fluxos-menu" role="menu" onClick={(e) => e.stopPropagation()}>
      {itens.map((i) => i.titulo
        ? <span key={i.titulo} className="bb-fluxos-menu-titulo">{i.titulo}</span>
        : (
          <button key={i.rotulo} type="button" role="menuitem" className={i.perigo ? "bb-fluxos-perigo" : undefined}
            onClick={() => { aoFechar(); i.fazer(); }}>
            {i.rotulo}
          </button>
        ))}
    </div>
  );
}

export default function ProcessMapPage() {
  const quadro = useRef(null);
  const pronto = useRef(false); // a ponte do iframe avisou que está pronta
  const aAbrir = useRef(null); // o que abrir assim que ela estiver
  const salvador = useRef(null);
  const criando = useRef(null); // o rascunho virando fluxo (o primeiro traço)
  const arquivo = useRef(null);
  const [projetos, setProjetos] = useState(null);
  const [erroLista, setErroLista] = useState("");
  const [aberto, setAberto] = useState(null); // { id, nome, projetoId, origem, modo, versao } — null: rascunho
  const abertoRef = useRef(null);
  const [estado, setEstado] = useState({ estado: "rascunho" });
  const [titulo, setTitulo] = useState("");
  const [expandidos, setExpandidos] = useState(() => new Set());
  const [ladoAberto, setLadoAberto] = useState(false); // a lista, no celular
  const [menu, setMenu] = useState(null); // o id do projeto/fluxo com o "⋯" aberto, ou "novo"
  const [renomeando, setRenomeando] = useState(null); // { id, valor } de um projeto
  const [projetoNovo, setProjetoNovo] = useState(null); // o nome sendo digitado, ou null
  const [pedido, setPedido] = useState("");
  const [desenhando, setDesenhando] = useState(false);
  const [explicacao, setExplicacao] = useState("");
  const [aviso, setAviso] = useState("");
  const ponte = () => quadro.current?.contentWindow?.PonteDoProof || null;

  // ---- a árvore de projetos ----

  async function recarregarLista() {
    try {
      const ps = await api.listar();
      setProjetos(ps);
      setErroLista("");
      return ps;
    } catch (err) {
      setErroLista(err.message);
      return null;
    }
  }
  const expandir = (id) => id && setExpandidos((s) => (s.has(id) ? s : new Set(s).add(id)));
  const alternar = (id) => setExpandidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // o fluxo gravado: atualiza na lista (e leva o projeto dele para o topo), sem ir ao banco
  function atualizarNaArvore(fluxo) {
    setProjetos((ps) => {
      if (!ps) return ps;
      const antigo = ps.flatMap((p) => p.fluxos).find((f) => f.id === fluxo.id);
      const novo = { ...antigo, ...fluxo };
      const semEle = ps.map((p) => ({ ...p, fluxos: p.fluxos.filter((f) => f.id !== fluxo.id) }));
      const i = semEle.findIndex((p) => p.id === novo.projetoId);
      if (i < 0) return ps;
      const alvo = { ...semEle[i], atualizadoEm: novo.atualizadoEm, fluxos: [novo, ...semEle[i].fluxos] };
      return [alvo, ...semEle.filter((_, j) => j !== i)];
    });
  }

  // ---- abrir e salvar ----

  /** Liga o salvamento automático ao fluxo aberto (e desliga o do anterior). */
  function trocarSalvador(fluxo, doc) {
    salvador.current?.parar();
    salvador.current = null;
    if (!fluxo) return;
    const id = fluxo.id;
    salvador.current = criarSalvador({
      versao: fluxo.versao,
      assinatura: assinaturaDoDesenho(doc),
      gravar: (d, { versao, forcar, saindo }) => {
        const extra = saindo && JSON.stringify(d).length < LIMITE_DO_KEEPALIVE ? { keepalive: true } : undefined;
        return api.salvar(id, { documento: d, versao, forcar }, extra);
      },
      aoEstado: (e) => {
        if (abertoRef.current?.id !== id) return;
        setEstado(e);
        if (e.estado === "salvo" && e.fluxo) {
          abertoRef.current = { ...abertoRef.current, versao: e.fluxo.versao };
          atualizarNaArvore(e.fluxo);
        }
      },
    });
  }

  /** O fluxo agora é o aberto: estado, título, endereço e salvamento automático. */
  function tomarPosse(fluxo, doc) {
    abertoRef.current = fluxo;
    setAberto(fluxo);
    setTitulo(fluxo?.nome || "");
    trocarSalvador(fluxo, doc);
    lembrar(fluxo?.id);
    marcarNoEndereco(fluxo?.id);
    if (fluxo) expandir(fluxo.projetoId);
  }

  /** Põe o desenho no quadro (ou um em branco); se o quadro ainda não abriu, abre assim que abrir. */
  function mostrarNoQuadro(fluxo, doc, modo = "diagram") {
    const p = ponte();
    if (!p || !pronto.current) { aAbrir.current = { fluxo, doc, modo }; return; }
    aAbrir.current = null;
    try {
      if (doc) p.importar(doc); else p.novo(modo);
      p.nome(fluxo?.nome || NOMES_NOVOS[modo] || NOMES_NOVOS.diagram);
    } catch (err) {
      setAviso(`Não consegui abrir o desenho: ${err.message}`);
    }
    // a assinatura sai do que o quadro devolve (normalizado), não do que veio do banco: senão a
    // primeira mudança de verdade seria precedida de uma gravação à toa
    tomarPosse(fluxo, fluxo ? p.exportar() : null);
  }

  async function abrirFluxo(id, { deNovo = false } = {}) {
    setLadoAberto(false);
    if (!deNovo && abertoRef.current?.id === id) return;
    await salvador.current?.agora();
    setAviso("");
    setExplicacao("");
    try {
      const { documento, ...fluxo } = await api.ler(id);
      setEstado({ estado: "salvo", quando: fluxo.atualizadoEm });
      mostrarNoQuadro(fluxo, documento);
    } catch (err) {
      setAviso(`Não consegui abrir o fluxograma: ${err.message}`);
      if (err.status === 404) { lembrar(null); recarregarLista(); }
    }
  }

  /** Fecha o que está aberto e deixa um rascunho em branco (que vira fluxo no primeiro traço). */
  function fecharParaRascunho() {
    salvador.current?.parar();
    salvador.current = null;
    abertoRef.current = null;
    setAberto(null);
    setTitulo("");
    setEstado({ estado: "rascunho" });
    lembrar(null);
    marcarNoEndereco(null);
    try { ponte()?.novo("diagram"); } catch { /* o quadro ainda não abriu */ }
  }

  /** Um fluxo novo, já salvo (em branco), no projeto escolhido. `sql`: abre o "schema SQL" em seguida. */
  async function novoFluxo(projetoId, modo = "diagram", { sql = false } = {}) {
    setLadoAberto(false);
    setMenu(null);
    await salvador.current?.agora();
    const p = ponte();
    if (!p || !pronto.current) return;
    setAviso("");
    setExplicacao("");
    try {
      p.novo(modo);
      p.nome(NOMES_NOVOS[modo]);
      const doc = p.exportar();
      const r = await api.criar({ documento: doc, nome: NOMES_NOVOS[modo], projetoId, origem: "pessoa" });
      setEstado({ estado: "salvo", quando: r.fluxo.atualizadoEm });
      tomarPosse(r.fluxo, doc);
      await recarregarLista();
      if (sql) p.sql();
    } catch (err) {
      setAviso(`Não consegui criar o fluxograma: ${err.message}`);
    }
  }

  /** O rascunho ganhou o primeiro traço (ou o primeiro desenho da Lisa): vira um fluxo salvo. */
  function guardarRascunho(doc, { nome, origem = "pessoa" } = {}) {
    if (criando.current) return criando.current;
    const n = nome || NOMES_NOVOS[doc?.mode === "mindmap" ? "mindmap" : "diagram"];
    criando.current = (async () => {
      setEstado({ estado: "salvando" });
      try {
        ponte()?.nome(n);
        const documento = { ...doc, name: n };
        // sem projeto: o servidor põe no mexido por último (ou cria "Meus fluxogramas")
        const r = await api.criar({ documento, nome: n, origem });
        setEstado({ estado: "salvo", quando: r.fluxo.atualizadoEm });
        tomarPosse(r.fluxo, documento);
        await recarregarLista();
        // o que a pessoa desenhou enquanto o fluxo era criado vai na próxima gravação
        const agora = ponte()?.exportar();
        if (agora) salvador.current?.mudou(agora);
      } catch (err) {
        setEstado({ estado: "erro", erro: err });
        setAviso(`Não consegui salvar o rascunho: ${err.message}`);
      } finally {
        criando.current = null;
      }
    })();
    return criando.current;
  }

  /** Renomeia ou move o fluxo aberto (ou outro). Passa pelo salvador para a versão não desencontrar. */
  async function mudarFluxo(id, mudancas) {
    const ehOAberto = abertoRef.current?.id === id;
    try {
      if (ehOAberto) await salvador.current?.agora();
      const fluxo = await api.salvar(id, mudancas);
      if (ehOAberto) {
        salvador.current?.ajustarVersao(fluxo.versao);
        abertoRef.current = { ...abertoRef.current, ...fluxo };
        setAberto(abertoRef.current);
        if (mudancas.nome) { setTitulo(fluxo.nome); ponte()?.nome(fluxo.nome); }
        if (mudancas.projetoId) expandir(mudancas.projetoId);
      }
      atualizarNaArvore(fluxo);
      return fluxo;
    } catch (err) {
      setAviso(`Não consegui mudar o fluxograma: ${err.message}`);
      if (ehOAberto) setTitulo(abertoRef.current?.nome || "");
      return null;
    }
  }

  // lê o campo (não o estado): o blur pode chegar antes de o React aplicar a última tecla
  function confirmarTitulo(valor) {
    const novo = String(valor ?? "").replace(/\s+/g, " ").trim();
    const a = abertoRef.current;
    if (!a) return;
    if (!novo) { setTitulo(a.nome); return; }
    if (novo !== a.nome) mudarFluxo(a.id, { nome: novo });
  }

  async function duplicar(f) {
    try {
      const { documento } = await api.ler(f.id);
      const r = await api.criar({ documento, nome: `${f.nome} (cópia)`.slice(0, 120), projetoId: f.projetoId, origem: f.origem });
      await recarregarLista();
      abrirFluxo(r.fluxo.id);
    } catch (err) {
      setAviso(`Não consegui duplicar: ${err.message}`);
    }
  }

  async function excluirFluxo(f) {
    if (!window.confirm(`Excluir "${f.nome}"?\nEle sai da lista (fica arquivado no banco).`)) return;
    if (abertoRef.current?.id === f.id) fecharParaRascunho();
    try {
      await api.excluir(f.id);
    } catch (err) {
      setAviso(`Não consegui excluir: ${err.message}`);
    }
    recarregarLista();
  }

  async function criarProjeto(e) {
    e.preventDefault();
    const nome = String(projetoNovo || "").trim();
    if (!nome) { setProjetoNovo(null); return; }
    try {
      const p = await api.criarProjeto(nome);
      setProjetoNovo(null);
      setProjetos((ps) => [p, ...(ps || [])]);
      expandir(p.id);
    } catch (err) {
      setAviso(`Não consegui criar o projeto: ${err.message}`);
    }
  }

  async function renomearProjeto(e) {
    e?.preventDefault?.();
    const r = renomeando;
    setRenomeando(null);
    const nome = String(r?.valor || "").trim();
    const antes = projetos?.find((p) => p.id === r?.id);
    if (!r || !nome || nome === antes?.nome) return;
    try {
      await api.mudarProjeto(r.id, { nome });
      setProjetos((ps) => ps.map((p) => (p.id === r.id ? { ...p, nome } : p)));
    } catch (err) {
      setAviso(`Não consegui renomear o projeto: ${err.message}`);
    }
  }

  async function excluirProjeto(p) {
    const n = p.fluxos.length;
    if (!window.confirm(`Excluir o projeto "${p.nome}"${n ? ` e ${n === 1 ? "o fluxograma" : `os ${n} fluxogramas`} dele` : ""}?\nSai da lista (fica arquivado no banco).`)) return;
    if (p.fluxos.some((f) => f.id === abertoRef.current?.id)) fecharParaRascunho();
    try {
      await api.excluirProjeto(p.id);
    } catch (err) {
      setAviso(`Não consegui excluir o projeto: ${err.message}`);
    }
    recarregarLista();
  }

  // ---- arquivos .json (o "Importar" e o "Exportar" do ProcessMap) ----

  function exportar() {
    const p = ponte();
    if (!p) return;
    const doc = p.exportar();
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(doc.name)}.processmap.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // um .json importado vira um fluxo novo no projeto aberto (nunca troca o desenho do fluxo aberto)
  async function importarArquivo(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    const p = ponte();
    if (!f || !p) return;
    await salvador.current?.agora();
    setAviso("");
    try {
      const json = JSON.parse(await f.text());
      const projetoId = abertoRef.current?.projetoId;
      salvador.current?.parar();
      p.importar(json); // confere o arquivo (formato, formas, ligações); estragado, lança
      const nome = String(json.name || f.name.replace(/(\.processmap)?\.json$/i, "")).slice(0, 120) || "Fluxograma importado";
      p.nome(nome);
      const doc = p.exportar();
      const r = await api.criar({ documento: doc, nome, projetoId, origem: "pessoa" });
      setEstado({ estado: "salvo", quando: r.fluxo.atualizadoEm });
      tomarPosse(r.fluxo, doc);
      recarregarLista();
    } catch (err) {
      setAviso(`Não consegui importar "${f.name}": ${err.message}`);
      // o quadro pode ter ficado com o arquivo: vira rascunho, para não gravar por cima do aberto
      if (abertoRef.current && !salvador.current?.temPendente()) {
        const id = abertoRef.current.id;
        abertoRef.current = null;
        abrirFluxo(id, { deNovo: true });
      }
    }
  }

  // ---- a Lisa desenha ----

  async function pedirALisa(e) {
    e.preventDefault();
    const q = pedido.trim();
    const p = ponte();
    if (!q || desenhando || !p) return;
    setDesenhando(true);
    setAviso("");
    try {
      const atual = p.vazio() ? null : p.exportar();
      const res = await fetch("/api/diagrama", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pedido: q, atual }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok || !r.ok) throw new Error(r.error || `HTTP ${res.status}`);
      p.importar(r.doc);
      if (r.colecao) p.colecao(r.colecao);
      setExplicacao(r.explicacao || "");
      setPedido("");
      const a = abertoRef.current;
      if (!a) {
        guardarRascunho(p.exportar(), { nome: r.titulo, origem: "lisa" });
        return;
      }
      p.nome(a.nome);
      salvador.current?.mudou(p.exportar());
      await salvador.current?.agora();
      // o fluxo ainda tinha o nome de nascença: fica com o título que a Lisa deu
      if (ehNomeNovo(a.nome) && r.titulo) mudarFluxo(a.id, { nome: r.titulo });
    } catch (err) {
      setAviso(`A Lisa não conseguiu desenhar: ${err.message}`);
    } finally {
      setDesenhando(false);
    }
  }

  // ---- ligações com o quadro e com a página ----

  // os avisos do quadro chegam aqui; as funções mudam a cada render, então o ouvinte lê a versão atual
  const acoes = useRef({});
  acoes.current = { mostrarNoQuadro, guardarRascunho, importar: () => arquivo.current?.click() };
  useEffect(() => {
    let espera = null;
    function ouvir(e) {
      if (e.source !== quadro.current?.contentWindow || e.data?.origem !== "quadro") return;
      const tipo = e.data.tipo;
      if (tipo === "pronto") {
        pronto.current = true;
        const a = aAbrir.current;
        if (a) acoes.current.mostrarNoQuadro(a.fluxo, a.doc, a.modo);
        return;
      }
      // Ctrl+S: lê o desenho agora (a última mudança ainda pode estar na espera abaixo) e grava já
      if (tipo === "salvar") {
        const p = ponte();
        if (!p) return;
        if (abertoRef.current) { salvador.current?.mudou(p.exportar()); salvador.current?.agora(); }
        else if (!p.vazio()) acoes.current.guardarRascunho(p.exportar());
        return;
      }
      if (tipo === "importar") { acoes.current.importar(); return; }
      if (tipo !== "mudou") return;
      clearTimeout(espera);
      espera = setTimeout(() => {
        const p = ponte();
        if (!p) return;
        const doc = p.exportar();
        if (abertoRef.current) salvador.current?.mudou(doc);
        else if (!p.vazio()) acoes.current.guardarRascunho(doc);
      }, 300);
    }
    window.addEventListener("message", ouvir);
    return () => { window.removeEventListener("message", ouvir); clearTimeout(espera); };
  }, []);

  // ao chegar: a lista e o fluxo do endereço (?fluxo=) ou o último aberto neste navegador
  useEffect(() => {
    (async () => {
      const ps = await recarregarLista();
      const doEndereco = new URLSearchParams(window.location.search).get("fluxo");
      const id = doEndereco || ultimoAberto();
      const existe = ps?.some((p) => p.fluxos.some((f) => f.id === id));
      if (id && existe) abrirFluxo(id);
      else {
        if (doEndereco && ps) setAviso("Esse fluxograma não existe mais (ou não é seu).");
        if (ps?.[0]) expandir(ps[0].id);
      }
    })();
    // sair da página: grava o que faltou (keepalive) e, se ainda está para gravar, o navegador pergunta
    const sair = () => salvador.current?.sair();
    const perguntar = (e) => { if (salvador.current?.temPendente() || criando.current) { e.preventDefault(); e.returnValue = ""; } };
    const fecharMenus = (e) => { if (!e.target.closest?.(".bb-fluxos-menu, .bb-fluxos-acao, .bb-fluxos-novo-botao")) setMenu(null); };
    window.addEventListener("pagehide", sair);
    window.addEventListener("beforeunload", perguntar);
    document.addEventListener("pointerdown", fecharMenus);
    return () => {
      window.removeEventListener("pagehide", sair);
      window.removeEventListener("beforeunload", perguntar);
      document.removeEventListener("pointerdown", fecharMenus);
      // foi para outro painel da Lisa (a página continua viva): grava o que faltou
      salvador.current?.agora();
    };
  }, []);

  // ---- tela ----

  const projetoDoAberto = projetos?.find((p) => p.id === aberto?.projetoId);
  const projetoAlvo = aberto?.projetoId || projetos?.[0]?.id; // onde o "Novo" cria
  const textoDoEstado = estado.estado === "salvo" ? `salvo${estado.quando ? ` ${quando(estado.quando)}` : ""}` : TEXTO_DO_ESTADO[estado.estado] || "";

  return (
    <div className="bb-fluxos" data-lado={ladoAberto ? "aberto" : "fechado"}>
      {ladoAberto && <div className="bb-fluxos-veu" onClick={() => setLadoAberto(false)} aria-hidden="true" />}
      <aside className="bb-fluxos-lado" aria-label="Projetos e fluxogramas">
        <div className="bb-fluxos-lado-topo">
          <h1>ProcessMap</h1>
          <button type="button" className="bb-fluxos-botao" onClick={() => setProjetoNovo("")} title="criar um projeto (uma pasta de fluxogramas)">+ projeto</button>
        </div>
        {projetoNovo !== null && (
          <form className="bb-fluxos-form" onSubmit={criarProjeto}>
            <input autoFocus value={projetoNovo} maxLength={80} placeholder="Nome do projeto" aria-label="nome do projeto novo"
              onChange={(e) => setProjetoNovo(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setProjetoNovo(null)}
              onBlur={(e) => { if (!e.target.value.trim()) setProjetoNovo(null); }} />
            <button type="submit" className="bb-fluxos-botao">criar</button>
          </form>
        )}
        <div className="bb-fluxos-lista">
          {projetos === null && !erroLista && <p className="bb-fluxos-vazio">Carregando os projetos…</p>}
          {erroLista && (
            <p className="bb-fluxos-vazio">
              Não consegui carregar os projetos ({erroLista}). <button type="button" className="bb-fluxos-link" onClick={recarregarLista}>Tentar de novo</button>
            </p>
          )}
          {projetos?.length === 0 && (
            <p className="bb-fluxos-vazio">Nenhum projeto ainda. Crie um em “+ projeto”, ou comece a desenhar: o primeiro traço já salva em “Meus fluxogramas”.</p>
          )}
          {projetos?.map((pr) => {
            const aberta = expandidos.has(pr.id);
            const outros = projetos.filter((o) => o.id !== pr.id);
            return (
              <section key={pr.id} className="bb-fluxos-projeto">
                <div className="bb-fluxos-linha bb-fluxos-linha--projeto">
                  {renomeando?.id === pr.id ? (
                    <form className="bb-fluxos-form bb-fluxos-form--linha" onSubmit={renomearProjeto}>
                      <input autoFocus value={renomeando.valor} maxLength={80} aria-label="novo nome do projeto"
                        onChange={(e) => setRenomeando({ id: pr.id, valor: e.target.value })}
                        onKeyDown={(e) => e.key === "Escape" && setRenomeando(null)} onBlur={renomearProjeto} />
                    </form>
                  ) : (
                    <button type="button" className="bb-fluxos-abrir" aria-expanded={aberta} onClick={() => alternar(pr.id)}>
                      <span className="bb-fluxos-seta" aria-hidden="true">{aberta ? "▾" : "▸"}</span>
                      <span className="bb-fluxos-nome">{pr.nome}</span>
                      <small>{pr.fluxos.length}</small>
                    </button>
                  )}
                  <button type="button" className="bb-fluxos-acao" aria-label={`opções do projeto ${pr.nome}`} aria-expanded={menu === pr.id}
                    onClick={() => setMenu((m) => (m === pr.id ? null : pr.id))}>⋯</button>
                  {menu === pr.id && (
                    <Menu aoFechar={() => setMenu(null)} itens={[
                      { rotulo: "Novo fluxograma aqui", fazer: () => novoFluxo(pr.id, "diagram") },
                      { rotulo: "Novo mapa mental aqui", fazer: () => novoFluxo(pr.id, "mindmap") },
                      { rotulo: "Renomear", fazer: () => setRenomeando({ id: pr.id, valor: pr.nome }) },
                      { rotulo: "Excluir projeto", perigo: true, fazer: () => excluirProjeto(pr) },
                    ]} />
                  )}
                </div>
                {aberta && (
                  <ul>
                    {pr.fluxos.map((f) => (
                      <li key={f.id} className="bb-fluxos-linha bb-fluxos-linha--fluxo" aria-current={aberto?.id === f.id ? "true" : undefined}>
                        <button type="button" className="bb-fluxos-abrir" onClick={() => abrirFluxo(f.id)}
                          title={`${f.nome}${f.origem === "lisa" ? " · desenhado pela Lisa" : ""} · ${f.formas} forma${f.formas === 1 ? "" : "s"}`}>
                          <span className={f.origem === "lisa" ? "bb-fluxos-icone bb-fluxos-icone--lisa" : "bb-fluxos-icone"} aria-hidden="true">
                            {f.origem === "lisa" ? "✦" : f.modo === "mindmap" ? "◎" : "◇"}
                          </span>
                          <span className="bb-fluxos-nome">{f.nome}</span>
                          <small>{quando(f.atualizadoEm)}</small>
                        </button>
                        <button type="button" className="bb-fluxos-acao" aria-label={`opções de ${f.nome}`} aria-expanded={menu === f.id}
                          onClick={() => setMenu((m) => (m === f.id ? null : f.id))}>⋯</button>
                        {menu === f.id && (
                          <Menu aoFechar={() => setMenu(null)} itens={[
                            { rotulo: "Duplicar", fazer: () => duplicar(f) },
                            ...(outros.length ? [{ titulo: "Mover para" }, ...outros.map((o) => ({ rotulo: `→ ${o.nome}`, fazer: () => mudarFluxo(f.id, { projetoId: o.id }) }))] : []),
                            { rotulo: "Excluir", perigo: true, fazer: () => excluirFluxo(f) },
                          ]} />
                        )}
                      </li>
                    ))}
                    <li>
                      <button type="button" className="bb-fluxos-novo-item" onClick={() => novoFluxo(pr.id)}>+ novo fluxograma</button>
                    </li>
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <p className="bb-fluxos-legenda">✦ desenhado pela Lisa · ◇ fluxograma · ◎ mapa mental</p>
      </aside>

      <section className="bb-fluxos-principal">
        <div className="bb-fluxos-barra">
          <button type="button" className="bb-fluxos-botao bb-fluxos-so-celular" onClick={() => setLadoAberto(true)} aria-label="abrir os projetos">☰ Projetos</button>
          {projetoDoAberto && <span className="bb-fluxos-caminho" title={projetoDoAberto.nome}>{projetoDoAberto.nome} /</span>}
          <input className="bb-fluxos-titulo" value={titulo} maxLength={120} disabled={!aberto}
            placeholder="Rascunho" aria-label="nome do fluxograma"
            onChange={(e) => setTitulo(e.target.value)} onBlur={(e) => confirmarTitulo(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setTitulo(aberto?.nome || ""); e.currentTarget.blur(); } }} />
          {estado.estado === "erro" ? (
            <button type="button" className="bb-fluxos-estado" data-estado="erro" onClick={() => salvador.current?.agora()} title={estado.erro?.message || ""}>
              não salvou · tentar de novo
            </button>
          ) : (
            <span className="bb-fluxos-estado" data-estado={estado.estado} aria-live="polite">{textoDoEstado}</span>
          )}
          <div className="bb-fluxos-acoes">
            <div className="bb-fluxos-ancora">
              <button type="button" className="bb-fluxos-botao bb-fluxos-novo-botao" aria-expanded={menu === "novo"}
                onClick={() => setMenu((m) => (m === "novo" ? null : "novo"))}>+ Novo</button>
              {menu === "novo" && (
                <div className="bb-fluxos-menu bb-fluxos-menu--novo" role="menu">
                  <button type="button" role="menuitem" onClick={() => novoFluxo(projetoAlvo, "diagram")}><b>Fluxograma</b><span>Formas e conexões, com todas as coleções de figuras.</span></button>
                  <button type="button" role="menuitem" onClick={() => novoFluxo(projetoAlvo, "mindmap")}><b>Mapa mental</b><span>Tema central e tópicos em árvore.</span></button>
                  <button type="button" role="menuitem" onClick={() => novoFluxo(projetoAlvo, "diagram", { sql: true })}><b>Diagrama de um schema SQL</b><span>Cole o CREATE TABLE: tabelas e relações se desenham sozinhas.</span></button>
                </div>
              )}
            </div>
            <button type="button" className="bb-fluxos-botao" onClick={() => arquivo.current?.click()} title="abrir um .json do ProcessMap como fluxograma novo">Importar</button>
            <button type="button" className="bb-fluxos-botao" onClick={exportar} title="baixar este desenho em .json">Exportar</button>
            <input ref={arquivo} type="file" accept=".json,application/json" hidden onChange={importarArquivo} />
          </div>
        </div>

        {estado.estado === "conflito" && (
          <div className="bb-fluxos-aviso" role="alert">
            <span>Este fluxograma foi salvo em outra aba ou aparelho{estado.fluxo?.atualizadoEm ? ` às ${hora(estado.fluxo.atualizadoEm)}` : ""}.</span>
            <button type="button" className="bb-fluxos-botao" onClick={() => salvador.current?.ficarComAMinha()}>Ficar com a minha</button>
            <button type="button" className="bb-fluxos-botao" onClick={() => aberto && abrirFluxo(aberto.id, { deNovo: true })}>Abrir a de lá</button>
          </div>
        )}
        {aviso && (
          <div className="bb-fluxos-aviso" role="alert">
            <span>{aviso}</span>
            <button type="button" className="bb-fluxos-botao" onClick={() => setAviso("")} aria-label="fechar o aviso">ok</button>
          </div>
        )}

        <div className="bb-fluxos-palco">
          <iframe ref={quadro} title="ProcessMap" src="/diagramas/index.html?embutido=1&tema=lisa" />
          {desenhando && <div className="bb-fluxos-desenhando">✦ a Lisa está desenhando…</div>}
        </div>

        {explicacao && (
          <div className="bb-fluxos-explicacao">
            <span aria-hidden="true">✦</span>
            <p>{explicacao}</p>
            <button type="button" onClick={() => setExplicacao("")} aria-label="fechar a explicação">×</button>
          </div>
        )}
        <form className="bb-fluxos-pedir" onSubmit={pedirALisa}>
          <input value={pedido} onChange={(e) => setPedido(e.target.value)} disabled={desenhando}
            placeholder={aberto ? "Peça à Lisa uma mudança: inclua a aprovação do diretor, separe em raias…" : "Peça à Lisa um desenho: o processo de compras, a arquitetura do sistema…"}
            aria-label="pedir à Lisa um desenho ou uma mudança" />
          <button type="submit" className="bb-fluxos-botao bb-fluxos-botao--lisa" disabled={desenhando || !pedido.trim()}>
            {desenhando ? "desenhando…" : "✦ pedir à Lisa"}
          </button>
        </form>
      </section>
    </div>
  );
}
