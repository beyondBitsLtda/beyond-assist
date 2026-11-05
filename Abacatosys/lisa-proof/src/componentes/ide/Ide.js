"use client";

// A IDE livre da Prática (05/11/2026: "ponha um modo de IDE e terminal livre para os usuários poderem escrever
// seus códigos e testarem"). Os projetos ficam na conta (src/lib/ide.js), com um rascunho no navegador enquanto
// não salva; o explorador, as abas e o editor ficam em cima, o terminal (./Terminal.js) embaixo e a prévia da
// página web (./previa.js) ao lado. As regras do projeto moram em src/dominio/ide.js; as do terminal, em
// src/dominio/shell.js.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { obter, criar, definir, remover as apagarNaApi } from "@/lib/api.js";
import {
  IDE, MODELOS_DE_PROJETO, listar, linguagemDoArquivo, nomeDe, pastaDe, normalizarCaminho, nomeValido, ehArquivo,
  escrever, criarPasta, remover, mover, caminhoParaMostrar,
} from "@/dominio/ide.js";
import { comandoParaRodar } from "@/dominio/shell.js";
import EditorDeCodigo from "../codigo/EditorDeCodigo.js";
import { useAviso } from "../Pecas.js";
import Terminal from "./Terminal.js";
import { montarPrevia, zipDoProjeto } from "./previa.js";
import { MARCA_DO_BANCO } from "./executores.js";

const CHAVE_DO_ULTIMO = "proof-ide-ultimo";
const chaveDoRascunho = (id) => `proof-ide-rascunho:${id}`;
const lerLocal = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const gravarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem espaço: segue sem o rascunho */ } };
const apagarLocal = (k) => { try { localStorage.removeItem(k); } catch { /* nada */ } };
const igual = (a, b) => a.nome === b.nome && a.principal === b.principal && JSON.stringify(a.arquivos) === JSON.stringify(b.arquivos) && JSON.stringify(a.pastas) === JSON.stringify(b.pastas);

const ICONES = { js: "🟨", mjs: "🟨", cjs: "🟨", ts: "🔷", py: "🐍", html: "🌐", htm: "🌐", css: "🎨", json: "🧾", md: "📝", sql: "🗃️", c: "🔧", h: "🔧", cpp: "⚙️", hpp: "⚙️", java: "☕", go: "🐹", rs: "🦀", rb: "💎", php: "🐘", lua: "🌙", sh: "🐚", txt: "📄", csv: "📊", db: "🗄️", svg: "🖼️" };
const iconeDe = (caminho, conteudo) => (conteudo?.startsWith(IDE.marcaDeBinario) ? "⚡" : conteudo?.startsWith(MARCA_DO_BANCO) ? "🗄️" : ICONES[linguagemDoArquivo(caminho).ext] || "📄");

export default function Ide() {
  const [projetos, setProjetos] = useState(null);
  const [projeto, setProjeto] = useState(null); // { id, nome, arquivos, pastas, principal, versao }
  const [abertos, setAbertos] = useState([]);
  const [ativo, setAtivo] = useState("");
  const [estado, setEstado] = useState("salvo"); // salvo | pendente | salvando | erro | conflito
  const [erro, setErro] = useState("");
  const [novo, setNovo] = useState(false);
  const [previa, setPrevia] = useState(null); // { caminho }
  const [alturaDoTerminal, setAlturaDoTerminal] = useState(280);
  const [terminalAberto, setTerminalAberto] = useState(true);
  // no celular o explorador é uma gaveta: começa fechado (a tela só desenha depois de carregar, então não há
  // diferença entre o HTML do servidor e o do navegador)
  const [exploradorAberto, setExploradorAberto] = useState(() => typeof window === "undefined" || !window.matchMedia?.("(max-width: 899px)").matches);
  const [telaCheia, setTelaCheia] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const [Aviso, avisar] = useAviso();
  const terminal = useRef(null);
  const raiz = useRef(null);
  const enviarArquivos = useRef(null);
  const atual = useRef(null);
  atual.current = projeto;
  const revisao = useRef(0); // sobe a cada mudança: o salvamento sabe se algo mudou enquanto gravava
  const salvando = useRef(false);

  // ------------------------------------------------------------------ abrir e salvar

  const abrirProjeto = useCallback(async (id) => {
    setErro("");
    try {
      const { projeto: p } = await obter(`/api/ide/projetos/${id}`);
      const r = lerLocal(chaveDoRascunho(id));
      let usado = p;
      if (r && r.versao === p.versao && r.projeto && !igual(r.projeto, p)) {
        usado = { ...p, ...r.projeto, id: p.id, versao: p.versao };
        setEstado("pendente");
        avisar("Recuperei as mudanças que ainda não tinham sido salvas.");
      } else { apagarLocal(chaveDoRascunho(id)); setEstado("salvo"); }
      setProjeto(usado);
      gravarLocal(CHAVE_DO_ULTIMO, id);
      const primeiro = usado.principal || Object.keys(usado.arquivos).sort()[0] || "";
      setAbertos(primeiro ? [primeiro] : []);
      setAtivo(primeiro);
      setPrevia(null);
    } catch (e) {
      setErro(e.message);
    }
  }, [avisar]);

  const carregarLista = useCallback(async (abrir) => {
    try {
      const { projetos: lista } = await obter("/api/ide/projetos");
      setProjetos(lista);
      const alvo = abrir || (lista.some((p) => p.id === lerLocal(CHAVE_DO_ULTIMO)) ? lerLocal(CHAVE_DO_ULTIMO) : lista[0]?.id);
      if (alvo) await abrirProjeto(alvo);
      else setNovo(true);
    } catch (e) {
      setErro(e.message);
      setProjetos([]);
    }
  }, [abrirProjeto]);

  useEffect(() => { carregarLista(); }, [carregarLista]);

  const salvar = useCallback(async () => {
    const p = atual.current;
    if (!p || salvando.current) return;
    salvando.current = true;
    const minha = revisao.current;
    setEstado("salvando");
    try {
      const r = await definir(`/api/ide/projetos/${p.id}`, { nome: p.nome, arquivos: p.arquivos, pastas: p.pastas, principal: p.principal, versao: p.versao });
      setProjeto((x) => (x && x.id === p.id ? { ...x, versao: r.versao } : x));
      if (revisao.current === minha) { setEstado("salvo"); apagarLocal(chaveDoRascunho(p.id)); }
      else setEstado("pendente");
      setProjetos((lista) => lista?.map((x) => (x.id === p.id ? { ...x, nome: p.nome, atualizadoEm: r.atualizadoEm, arquivos: Object.keys(p.arquivos).length } : x)));
    } catch (e) {
      setEstado(/mudou em outra aba/.test(e.message) ? "conflito" : "erro");
      setErro(e.message);
    } finally {
      salvando.current = false;
    }
  }, []);

  // salva sozinho 1,2 s depois da última mudança (e guarda o rascunho no navegador na hora)
  useEffect(() => {
    if (estado !== "pendente" || !projeto) return undefined;
    gravarLocal(chaveDoRascunho(projeto.id), { versao: projeto.versao, projeto: { nome: projeto.nome, arquivos: projeto.arquivos, pastas: projeto.pastas, principal: projeto.principal }, quando: Date.now() });
    const t = setTimeout(salvar, 1200);
    return () => clearTimeout(t);
  }, [projeto, estado, salvar]);

  // fechar a aba com mudança não salva: o navegador pergunta (o rascunho fica guardado de qualquer jeito)
  useEffect(() => {
    const antes = (e) => { if (estado === "pendente" || estado === "salvando") { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [estado]);

  /** Muda o projeto (fn recebe o de agora). Erros de regra (nome inválido, limite) viram aviso. */
  const mudarProjeto = useCallback((fn) => {
    setProjeto((p) => {
      if (!p) return p;
      try {
        const novoP = fn(p);
        if (novoP === p) return p;
        revisao.current++;
        setEstado((e) => (e === "conflito" ? e : "pendente"));
        return { ...novoP, id: p.id, versao: p.versao };
      } catch (e) {
        setTimeout(() => avisar(e.message), 0);
        return p;
      }
    });
  }, [avisar]);

  // as abas seguem o projeto: o arquivo apagado (pelo terminal, por exemplo) sai das abas
  useEffect(() => {
    if (!projeto) return;
    setAbertos((a) => { const f = a.filter((c) => ehArquivo(projeto, c)); return f.length === a.length ? a : f; });
    if (ativo && !ehArquivo(projeto, ativo)) setAtivo((x) => (ehArquivo(projeto, x) ? x : ""));
  }, [projeto, ativo]);
  useEffect(() => { if (!ativo && abertos.length) setAtivo(abertos[abertos.length - 1]); }, [ativo, abertos]);

  // ------------------------------------------------------------------ arquivos

  const abrirArquivo = useCallback((caminho) => {
    setAbertos((a) => (a.includes(caminho) ? a : [...a, caminho]));
    setAtivo(caminho);
    if (window.matchMedia?.("(max-width: 899px)").matches) setExploradorAberto(false);
  }, []);
  const fecharAba = (caminho) => {
    setAbertos((a) => {
      const i = a.indexOf(caminho);
      const resto = a.filter((c) => c !== caminho);
      if (caminho === ativo) setAtivo(resto[Math.min(i, resto.length - 1)] || "");
      return resto;
    });
  };

  const rodarAtivo = useCallback(() => {
    const p = atual.current;
    const alvo = ativo || p?.principal;
    if (!alvo) { avisar("Abra um arquivo para rodar."); return; }
    const l = linguagemDoArquivo(alvo);
    if (l.executor === "previa") { setPrevia({ caminho: alvo }); return; }
    const cmd = comandoParaRodar(alvo);
    if (!cmd) { avisar(`Arquivos .${l.ext || "?"} não rodam — abra um .js, .py, .c, .java, .html…`); return; }
    setTerminalAberto(true);
    terminal.current?.rodar(cmd);
  }, [ativo, avisar]);

  // atalhos da IDE inteira: Ctrl+S salva, Ctrl+Enter roda, Ctrl+` vai para o terminal, Ctrl+B mostra os arquivos
  useEffect(() => {
    const teclas = (e) => {
      // o editor já tratou (Ctrl+Enter e Ctrl+S dele): não roda de novo — rodar duas vezes juntas duplicava a saída
      if (e.defaultPrevented) return;
      if (!(e.ctrlKey || e.metaKey) || !raiz.current?.contains(document.activeElement || document.body)) return;
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); salvar(); avisar("Salvando…"); }
      else if (k === "enter" && !e.target.closest?.(".ide-term")) { e.preventDefault(); rodarAtivo(); }
      else if (k === "`" || k === "j") { e.preventDefault(); setTerminalAberto(true); setTimeout(() => terminal.current?.focar(), 0); }
      else if (k === "b") { e.preventDefault(); setExploradorAberto((v) => !v); }
    };
    document.addEventListener("keydown", teclas);
    return () => document.removeEventListener("keydown", teclas);
  }, [salvar, rodarAtivo, avisar]);

  // ------------------------------------------------------------------ projetos

  async function criarProjeto(modelo, nome) {
    try {
      const { projeto: p } = await criar("/api/ide/projetos", { modelo, nome });
      setNovo(false);
      setProjetos((l) => [{ id: p.id, nome: p.nome, principal: p.principal, atualizadoEm: p.atualizadoEm, arquivos: Object.keys(p.arquivos).length }, ...(l || [])]);
      await abrirProjeto(p.id);
      setTimeout(() => terminal.current?.rodar("ls"), 50);
    } catch (e) {
      avisar(e.message);
    }
  }

  async function trocarDeProjeto(id) {
    if (estado === "pendente" || estado === "salvando") await salvar();
    await abrirProjeto(id);
  }

  async function apagarProjeto() {
    if (!projeto || !window.confirm(`Apagar o projeto "${projeto.nome}" e todos os arquivos dele? Não dá para desfazer.`)) return;
    try {
      await apagarNaApi(`/api/ide/projetos/${projeto.id}`);
      apagarLocal(chaveDoRascunho(projeto.id));
      setProjeto(null);
      setAbertos([]); setAtivo("");
      await carregarLista();
    } catch (e) { avisar(e.message); }
  }

  async function recarregarDoServidor() {
    if (!projeto) return;
    apagarLocal(chaveDoRascunho(projeto.id));
    await abrirProjeto(projeto.id);
  }
  async function sobrescrever() {
    try {
      const { projeto: doServidor } = await obter(`/api/ide/projetos/${projeto.id}`);
      setProjeto((p) => ({ ...p, versao: doServidor.versao }));
      setEstado("pendente");
      setErro("");
    } catch (e) { avisar(e.message); }
  }

  function baixarZip() {
    if (!projeto) return;
    const url = URL.createObjectURL(zipDoProjeto(projeto));
    const a = document.createElement("a");
    a.href = url; a.download = `${projeto.nome.replace(/[\\/:*?"<>|]+/g, "-")}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function receberArquivos(lista, pasta = "/") {
    const recusados = [];
    let p = atual.current;
    for (const f of [...lista].slice(0, 50)) {
      if (f.size > IDE.maxTamanhoDoArquivo) { recusados.push(`${f.name} (grande demais)`); continue; }
      const texto = await f.text();
      if (texto.includes("\u0000")) { recusados.push(`${f.name} (binário: o projeto guarda só texto)`); continue; }
      try { p = escrever(p, normalizarCaminho(pasta, f.name), texto); } catch (e) { recusados.push(`${f.name} (${e.message})`); }
    }
    mudarProjeto(() => p);
    avisar(recusados.length ? `Não entraram: ${recusados.join(", ")}` : "Arquivos adicionados ao projeto.");
  }

  // ------------------------------------------------------------------ tela cheia (a do navegador; senão, a da página)

  async function alternarTelaCheia() {
    if (telaCheia) {
      setTelaCheia(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      return;
    }
    setTelaCheia(true);
    try { if (raiz.current?.requestFullscreen && !document.fullscreenElement) await raiz.current.requestFullscreen({ navigationUI: "hide" }); } catch { /* fica a da página */ }
  }
  useEffect(() => {
    const mudou = () => { if (!document.fullscreenElement) setTelaCheia(false); };
    document.addEventListener("fullscreenchange", mudou);
    return () => document.removeEventListener("fullscreenchange", mudou);
  }, []);
  useEffect(() => {
    document.body.classList.toggle("ide-sem-rolar", telaCheia);
    return () => document.body.classList.remove("ide-sem-rolar");
  }, [telaCheia]);

  // ------------------------------------------------------------------ o puxador da altura do terminal

  function puxar(e) {
    e.preventDefault();
    const inicio = e.clientY, altura0 = alturaDoTerminal;
    const maximo = Math.max(160, (raiz.current?.clientHeight || 800) - 180);
    const mover_ = (ev) => setAlturaDoTerminal(Math.min(maximo, Math.max(110, altura0 + (inicio - ev.clientY))));
    const soltar = () => { window.removeEventListener("pointermove", mover_); window.removeEventListener("pointerup", soltar); };
    window.addEventListener("pointermove", mover_);
    window.addEventListener("pointerup", soltar);
  }

  // ------------------------------------------------------------------ a tela

  if (projetos === null) return <div className="pf-carregando">Abrindo a IDE…</div>;

  const conteudoAtivo = projeto && ativo ? projeto.arquivos[ativo] : undefined;
  const lingAtiva = ativo ? linguagemDoArquivo(ativo) : null;
  const temPagina = projeto && Object.keys(projeto.arquivos).some((c) => /\.html?$/i.test(c));
  const textoDoEstado = { salvo: "✓ salvo na sua conta", pendente: "• mudanças…", salvando: "salvando…", erro: "⚠ não salvou (guardado neste navegador)", conflito: "⚠ mudou em outra aba" }[estado];

  return (
    <div ref={raiz} className={`ide${telaCheia ? " ide--cheia" : ""}${exploradorAberto ? "" : " ide--sem-explorador"}`}>
      <header className="ide__barra">
        <Link href="/pratica" className="ide__voltar" title="Voltar para a Prática">← Prática</Link>
        <span className="ide__marca" aria-hidden="true">💻</span>
        {projeto && (renomeando ? (
          <form className="ide__renomear" onSubmit={(e) => { e.preventDefault(); const n = e.currentTarget.nome.value.trim().slice(0, IDE.maxNome); if (n) mudarProjeto((p) => ({ ...p, nome: n })); setRenomeando(false); }}>
            <input name="nome" defaultValue={projeto.nome} autoFocus maxLength={IDE.maxNome} aria-label="Nome do projeto" onBlur={(e) => e.currentTarget.form.requestSubmit()} />
          </form>
        ) : (
          <select className="ide__projetos" value={projeto.id} onChange={(e) => (e.target.value === "+" ? setNovo(true) : trocarDeProjeto(e.target.value))} aria-label="Projeto">
            {(projetos || []).map((p) => <option key={p.id} value={p.id}>{p.id === projeto.id ? projeto.nome : p.nome}</option>)}
            <option value="+">＋ Novo projeto…</option>
          </select>
        ))}
        {projeto && (
          <div className="ide__acoes">
            <button type="button" className="ide__botao" onClick={() => setNovo(true)} title="Novo projeto">＋ Novo</button>
            <button type="button" className="ide__botao" onClick={() => setRenomeando(true)} title="Renomear o projeto">✎</button>
            <button type="button" className="ide__botao" onClick={() => enviarArquivos.current?.click()} title="Enviar arquivos do computador">⬆</button>
            <button type="button" className="ide__botao" onClick={baixarZip} title="Baixar o projeto (.zip)">⬇ .zip</button>
            <button type="button" className="ide__botao ide__botao--perigo" onClick={apagarProjeto} title="Apagar o projeto">🗑</button>
            <input ref={enviarArquivos} type="file" multiple hidden onChange={(e) => { receberArquivos(e.target.files); e.target.value = ""; }} />
          </div>
        )}
        <span className={`ide__estado ide__estado--${estado}`} role="status">{projeto ? textoDoEstado : ""}</span>
        <div className="ide__acoes ide__acoes--direita">
          {projeto && <button type="button" className="ide__botao ide__botao--rodar" onClick={rodarAtivo} title="Rodar o arquivo aberto (Ctrl+Enter)">▶ Rodar</button>}
          {temPagina && <button type="button" className={`ide__botao${previa ? " ide__botao--ligado" : ""}`} onClick={() => setPrevia((v) => (v ? null : { caminho: Object.keys(projeto.arquivos).find((c) => /\/index\.html?$/i.test(c)) || Object.keys(projeto.arquivos).find((c) => /\.html?$/i.test(c)) }))} title="Prévia da página">🌐 Prévia</button>}
          <button type="button" className="ide__botao" onClick={() => setExploradorAberto((v) => !v)} title="Mostrar/esconder os arquivos (Ctrl+B)">📁</button>
          <button type="button" className={`ide__botao${terminalAberto ? " ide__botao--ligado" : ""}`} onClick={() => setTerminalAberto((v) => !v)} title="Mostrar/esconder o terminal (Ctrl+J)">⌨</button>
          <button type="button" className="ide__botao" onClick={alternarTelaCheia} title="Tela cheia">{telaCheia ? "Sair ⛶" : "⛶"}</button>
        </div>
      </header>

      {erro && estado !== "conflito" && <div className="pf-aviso pf-aviso--erro ide__aviso">{erro} <button type="button" className="ide__botao" onClick={() => setErro("")}>ok</button></div>}
      {estado === "conflito" && (
        <div className="pf-aviso ide__aviso">
          O projeto mudou em outra aba ou aparelho. As suas mudanças daqui estão guardadas neste navegador.
          <button type="button" className="ide__botao" onClick={recarregarDoServidor}>Usar o da outra aba</button>
          <button type="button" className="ide__botao" onClick={sobrescrever}>Ficar com o daqui</button>
        </div>
      )}

      {!projeto ? (
        <div className="ide__vazia">
          <h2>Bem-vindo à IDE do Proof</h2>
          <p>Escreva e rode código em mais de 30 linguagens, com terminal de verdade. Escolha um modelo para começar.</p>
          <ModelosDeProjeto aoEscolher={criarProjeto} />
        </div>
      ) : (
        <div className="ide__corpo">
          {exploradorAberto && (
            <Explorador projeto={projeto} ativo={ativo} aoAbrir={abrirArquivo} aoMudar={mudarProjeto} avisar={avisar}
              aoRodar={(c) => { setTerminalAberto(true); const cmd = comandoParaRodar(c); if (linguagemDoArquivo(c).executor === "previa") setPrevia({ caminho: c }); else if (cmd) terminal.current?.rodar(cmd); }}
              aoRenomear={(de, para) => { setAbertos((a) => a.map((c) => (c === de ? para : c.startsWith(de + "/") ? para + c.slice(de.length) : c))); setAtivo((x) => (x === de ? para : x.startsWith(de + "/") ? para + x.slice(de.length) : x)); }}
              aoReceber={receberArquivos} aoFechar={() => setExploradorAberto(false)} />
          )}
          <section className="ide__centro">
            <div className={`ide__meio${previa ? " ide__meio--com-previa" : ""}`}>
              <div className="ide__editor">
                <div className="ide__abas" role="tablist">
                  {abertos.map((c) => (
                    <div key={c} role="tab" aria-selected={c === ativo} className={`ide__aba${c === ativo ? " ide__aba--ativa" : ""}`} onClick={() => setAtivo(c)} onAuxClick={(e) => { if (e.button === 1) fecharAba(c); }} title={caminhoParaMostrar(c)}>
                      <span aria-hidden="true">{iconeDe(c, projeto.arquivos[c])}</span>
                      <span className="ide__aba-nome">{nomeDe(c)}</span>
                      {projeto.principal === c && <span className="ide__estrela" title="Arquivo principal">★</span>}
                      <button type="button" className="ide__fechar" onClick={(e) => { e.stopPropagation(); fecharAba(c); }} aria-label={`Fechar ${nomeDe(c)}`}>×</button>
                    </div>
                  ))}
                </div>
                {!ativo || conteudoAtivo === undefined ? (
                  <div className="ide__sem-arquivo">
                    <p>Abra um arquivo no explorador, ou crie um no terminal:</p>
                    <code>open main.py</code>
                    <p className="ide__dica">Ctrl+Enter roda · Ctrl+S salva · Ctrl+J vai para o terminal · Ctrl+B mostra os arquivos</p>
                  </div>
                ) : conteudoAtivo.startsWith(IDE.marcaDeBinario) ? (
                  <div className="ide__sem-arquivo">
                    <p>⚡ <strong>{nomeDe(ativo)}</strong> é o executável que o compilador gerou.</p>
                    <code>./{caminhoParaMostrar(ativo).replace(/^~\//, "")}</code>
                    <p className="ide__dica">Rode no terminal. Ele é compilado de novo a partir das fontes a cada vez (no compilador on-line).</p>
                  </div>
                ) : conteudoAtivo.startsWith(MARCA_DO_BANCO) ? (
                  <div className="ide__sem-arquivo">
                    <p>🗄️ <strong>{nomeDe(ativo)}</strong> é um banco SQLite ({Math.round(conteudoAtivo.length * 0.75 / 1024)} KB).</p>
                    <code>sqlite3 {caminhoParaMostrar(ativo).replace(/^~\//, "")}</code>
                    <p className="ide__dica">Abra no terminal para consultar (.tables, .schema, SELECT...).</p>
                  </div>
                ) : (
                  <EditorDeCodigo
                    key={ativo}
                    classe="ide__codigo"
                    valor={conteudoAtivo}
                    linguagem={lingAtiva?.editor}
                    nome={caminhoParaMostrar(ativo).replace(/^~\//, "")}
                    atalhos="Ctrl+Enter roda · Ctrl+S salva · Ctrl+F busca"
                    rotulo={`Editor de ${nomeDe(ativo)}`}
                    aoMudar={(t) => mudarProjeto((p) => (p.arquivos[ativo] === t ? p : escrever(p, ativo, t)))}
                    aoCtrlEnter={rodarAtivo}
                    aoCtrlS={() => { salvar(); avisar("Salvando…"); }}
                  />
                )}
              </div>
              {previa && previa.caminho && ehArquivo(projeto, previa.caminho) && (
                <Previa projeto={projeto} caminho={previa.caminho} aoFechar={() => setPrevia(null)} aoConsole={(tipo, texto) => terminal.current?.escrever(tipo, `[página] ${texto}\n`)} />
              )}
            </div>
            {terminalAberto && <div className="ide__puxador" onPointerDown={puxar} role="separator" aria-orientation="horizontal" aria-label="Arraste para mudar a altura do terminal" />}
            <div className="ide__terminal" style={{ height: terminalAberto ? alturaDoTerminal : 0 }} hidden={!terminalAberto}>
              <div className="ide__terminal-barra">
                <span>⌨ Terminal <small>· {projeto.nome}</small></span>
                <span className="ide__terminal-dica">help · ↑↓ histórico · Tab completa · Ctrl+C interrompe · Ctrl+L limpa</span>
                <button type="button" className="ide__botao" onClick={() => terminal.current?.limpar()} title="Limpar (Ctrl+L)">limpar</button>
                <button type="button" className="ide__botao" onClick={() => setTerminalAberto(false)} title="Esconder o terminal">▾</button>
              </div>
              <Terminal ref={terminal} projeto={projeto} nomeDoProjeto={projeto.nome} aoMudarProjeto={mudarProjeto} aoAbrir={abrirArquivo} aoPrevia={(c) => setPrevia({ caminho: c })} />
            </div>
          </section>
        </div>
      )}

      {novo && (
        <div className="ide__modal-fundo" onClick={(e) => { if (e.target === e.currentTarget && projeto) setNovo(false); }}>
          <div className="ide__modal" role="dialog" aria-modal="true" aria-label="Novo projeto">
            <div className="ide__modal-topo">
              <h2>Novo projeto</h2>
              {projeto && <button type="button" className="ide__botao" onClick={() => setNovo(false)} aria-label="Fechar">×</button>}
            </div>
            <ModelosDeProjeto aoEscolher={criarProjeto} comNome />
          </div>
        </div>
      )}
      {Aviso}
    </div>
  );
}

function ModelosDeProjeto({ aoEscolher, comNome = false }) {
  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);
  return (
    <div className="ide__modelos-caixa">
      {comNome && (
        <label className="ide__nome-novo">
          <span>Nome (opcional)</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={IDE.maxNome} placeholder="ex.: Calculadora em Python" />
        </label>
      )}
      <div className="ide__modelos">
        {Object.entries(MODELOS_DE_PROJETO).map(([chave, m]) => (
          <button key={chave} type="button" className="ide__modelo" disabled={criando} onClick={async () => { setCriando(true); await aoEscolher(chave, nome); setCriando(false); }}>
            <span className="ide__modelo-icone" aria-hidden="true">{m.icone}</span>
            <strong>{m.nome}</strong>
            <small>{m.descricao}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ o explorador

function Explorador({ projeto, ativo, aoAbrir, aoMudar, aoRodar, aoRenomear, aoReceber, avisar, aoFechar }) {
  const [abertas, setAbertas] = useState(() => new Set(["/"]));
  const [selecionada, setSelecionada] = useState("/");
  const [editando, setEditando] = useState(null); // { tipo: "arquivo" | "pasta" | "renomear", pasta, caminho }
  const [arrastando, setArrastando] = useState(false);

  // o arquivo aberto fica visível: as pastas dele abrem
  useEffect(() => {
    if (!ativo) return;
    setAbertas((s) => { const n = new Set(s); for (let p = pastaDe(ativo); p !== "/"; p = pastaDe(p)) n.add(p); return n.size === s.size ? s : n; });
  }, [ativo]);

  const pastaDoNovo = selecionada && ehArquivo(projeto, selecionada) ? pastaDe(selecionada) : selecionada || "/";
  // o Enter confirma e o campo some; o blur que vem depois não confirma de novo
  const emEdicao = useRef(null);
  emEdicao.current = editando;

  function confirmar(valor) {
    const e = emEdicao.current;
    if (!e) return;
    emEdicao.current = null;
    setEditando(null);
    const v = nomeValido(valor?.trim() ? valor.trim() : "");
    if (!valor?.trim()) return;
    if (!v.ok) { avisar(v.erro); return; }
    if (e.tipo === "arquivo") {
      const c = normalizarCaminho(e.pasta, v.nome);
      if (ehArquivo(projeto, c)) { aoAbrir(c); return; }
      aoMudar((p) => escrever(p, c, ""));
      setTimeout(() => aoAbrir(c), 0);
    } else if (e.tipo === "pasta") {
      const c = normalizarCaminho(e.pasta, v.nome);
      aoMudar((p) => criarPasta(p, c, { pais: true }));
      setAbertas((s) => new Set([...s, c]));
    } else if (e.tipo === "renomear") {
      const para = normalizarCaminho(pastaDe(e.caminho), v.nome);
      if (para === e.caminho) return;
      aoMudar((p) => mover(p, e.caminho, para));
      aoRenomear(e.caminho, para);
    }
  }

  function apagar(c) {
    const ehPastaC = !ehArquivo(projeto, c);
    if (!window.confirm(ehPastaC ? `Apagar a pasta ${nomeDe(c)} e tudo dentro dela?` : `Apagar ${nomeDe(c)}?`)) return;
    aoMudar((p) => remover(p, c, { recursivo: true }));
  }

  // um <input> comum (não um componente criado aqui dentro): o que se digita não se perde quando a IDE redesenha
  const campo = ({ inicial = "", recuo, chave }) => (
    <input key={chave} className="ide__campo-nome" style={{ marginLeft: recuo }} autoFocus defaultValue={inicial} maxLength={IDE.maxNome}
      onKeyDown={(e) => { if (e.key === "Enter") confirmar(e.currentTarget.value); if (e.key === "Escape") { emEdicao.current = null; setEditando(null); } }}
      onBlur={(e) => confirmar(e.currentTarget.value)} aria-label="Nome" />
  );

  const pasta = (caminho, nivel) => {
    const filhos = listar(projeto, caminho);
    const recuo = 8 + nivel * 14;
    return (
      <>
        {editando && editando.tipo !== "renomear" && editando.pasta === caminho && campo({ recuo, chave: `novo:${caminho}` })}
        {filhos.map((f) => {
          const sel = f.caminho === selecionada;
          if (editando?.tipo === "renomear" && editando.caminho === f.caminho) return campo({ inicial: f.nome, recuo, chave: f.caminho });
          return (
            <div key={f.caminho}>
              <div
                className={`ide__item${f.tipo === "pasta" ? " ide__item--pasta" : ""}${f.caminho === ativo ? " ide__item--ativo" : ""}${sel ? " ide__item--selecionado" : ""}`}
                style={{ paddingLeft: recuo }}
                role="treeitem"
                aria-expanded={f.tipo === "pasta" ? abertas.has(f.caminho) : undefined}
                tabIndex={0}
                onClick={() => { setSelecionada(f.caminho); if (f.tipo === "pasta") setAbertas((s) => { const n = new Set(s); n.has(f.caminho) ? n.delete(f.caminho) : n.add(f.caminho); return n; }); else aoAbrir(f.caminho); }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); if (e.key === "F2") setEditando({ tipo: "renomear", caminho: f.caminho }); if (e.key === "Delete") apagar(f.caminho); }}
                title={caminhoParaMostrar(f.caminho)}
              >
                <span className="ide__item-icone" aria-hidden="true">{f.tipo === "pasta" ? (abertas.has(f.caminho) ? "📂" : "📁") : iconeDe(f.caminho, projeto.arquivos[f.caminho])}</span>
                <span className="ide__item-nome">{f.nome}</span>
                {projeto.principal === f.caminho && <span className="ide__estrela" title="Arquivo principal">★</span>}
                <span className="ide__item-acoes">
                  {f.tipo === "arquivo" && linguagemDoArquivo(f.caminho).executor && <button type="button" title="Rodar" onClick={(e) => { e.stopPropagation(); aoRodar(f.caminho); }}>▶</button>}
                  {f.tipo === "arquivo" && <button type="button" title={projeto.principal === f.caminho ? "É o principal" : "Marcar como principal (o ▶ e o run sem nome rodam ele)"} onClick={(e) => { e.stopPropagation(); aoMudar((p) => ({ ...p, principal: p.principal === f.caminho ? "" : f.caminho })); }}>★</button>}
                  <button type="button" title="Renomear (F2)" onClick={(e) => { e.stopPropagation(); setEditando({ tipo: "renomear", caminho: f.caminho }); }}>✎</button>
                  <button type="button" title="Apagar (Delete)" onClick={(e) => { e.stopPropagation(); apagar(f.caminho); }}>🗑</button>
                </span>
              </div>
              {f.tipo === "pasta" && abertas.has(f.caminho) && pasta(f.caminho, nivel + 1)}
            </div>
          );
        })}
      </>
    );
  };

  return (
    <aside
      className={`ide__explorador${arrastando ? " ide__explorador--soltar" : ""}`}
      aria-label="Arquivos do projeto"
      onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setArrastando(true); } }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files?.length) aoReceber(e.dataTransfer.files, pastaDoNovo); }}
    >
      <div className="ide__explorador-barra">
        <span>Arquivos</span>
        <button type="button" title="Novo arquivo" onClick={() => { setAbertas((s) => new Set([...s, pastaDoNovo])); setEditando({ tipo: "arquivo", pasta: pastaDoNovo }); }}>＋📄</button>
        <button type="button" title="Nova pasta" onClick={() => { setAbertas((s) => new Set([...s, pastaDoNovo])); setEditando({ tipo: "pasta", pasta: pastaDoNovo }); }}>＋📁</button>
        <button type="button" title="Recolher as pastas" onClick={() => setAbertas(new Set(["/"]))}>⊟</button>
        <button type="button" className="ide__so-celular" title="Fechar" onClick={aoFechar}>×</button>
      </div>
      <div className="ide__arvore" role="tree" onClick={(e) => { if (e.target === e.currentTarget) setSelecionada("/"); }}>
        {pasta("/", 0)}
        {!Object.keys(projeto.arquivos).length && !editando && <p className="ide__dica">Projeto vazio: crie um arquivo (＋📄), arraste arquivos para cá ou use o terminal (touch main.py).</p>}
      </div>
      <p className="ide__explorador-rodape">{Object.keys(projeto.arquivos).length} arquivo(s) · arraste arquivos do computador para cá</p>
    </aside>
  );
}

// ------------------------------------------------------------------ a prévia da página

function Previa({ projeto, caminho, aoFechar, aoConsole }) {
  const [chave] = useState(() => Math.random().toString(36).slice(2));
  const [doc, setDoc] = useState("");
  const [n, setN] = useState(0);
  const moldura = useRef(null);
  const ultimoDoc = useRef("");
  const ultimoConsole = useRef(aoConsole);
  ultimoConsole.current = aoConsole;

  // atualiza sozinha 600 ms depois da última mudança no projeto. A moldura NASCE com o HTML (e nasce de novo a
  // cada mudança): trocar o srcdoc de uma moldura que já carregou deixava a página em branco (visto em 05/11/2026).
  useEffect(() => {
    const t = setTimeout(() => {
      const novo = montarPrevia(projeto, caminho, chave);
      if (novo === ultimoDoc.current) return;
      ultimoDoc.current = novo;
      setDoc(novo);
      setN((x) => x + 1);
    }, doc ? 600 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projeto, caminho, chave]);

  useEffect(() => {
    const ouvir = (e) => {
      if (e.source !== moldura.current?.contentWindow || e.data?.origem !== "proof-previa" || e.data.chave !== chave) return;
      ultimoConsole.current?.(e.data.tipo, String(e.data.texto || ""));
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, [chave]);

  return (
    <div className="ide__previa">
      <div className="ide__previa-barra">
        <span>🌐 {caminhoParaMostrar(caminho).replace(/^~\//, "")}</span>
        <button type="button" className="ide__botao" onClick={() => setN((x) => x + 1)} title="Recarregar a página">↻</button>
        <button type="button" className="ide__botao" onClick={aoFechar} title="Fechar a prévia">×</button>
      </div>
      {doc ? (
        <iframe key={n} ref={moldura} className="ide__previa-quadro" title={`Prévia de ${nomeDe(caminho)}`} sandbox="allow-scripts allow-modals allow-forms allow-popups" srcDoc={doc} />
      ) : <div className="ide__previa-quadro" />}
    </div>
  );
}
