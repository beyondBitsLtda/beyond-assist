"use client";

// O desenho de diagrama (31/10/2026): fluxo de processo, modelo de dados, arquitetura de software ou
// de nuvem. A pessoa desenha no quadro (o ProcessMap embutido, em public/diagramas, que conversa com
// esta tela por window.PonteDoProof) e a Lisa avalia o desenho pelos requisitos do cenário. As
// regras moram em src/dominio/diagramas.js.
//
// O rascunho fica no navegador a cada mudança: sair da página não perde o desenho. Depois de
// enviado, o desenho avaliado fica no desafio e reabre para a próxima tentativa.

import { useEffect, useRef, useState } from "react";
import { criar } from "@/lib/api.js";
import { podeReenviar } from "@/dominio/pratica.js";
import { TIPOS_DE_DIAGRAMA } from "@/dominio/diagramas.js";
import Explicacao, { emLinha } from "../Explicacao.js";
import { reagir } from "../Neuro.js";
import { useAviso } from "../Pecas.js";
import { Avaliacao, reagirAEntrega } from "./Retorno.js";
import { Cabecalho, Rodape } from "./Motores.js";

const chaveDoRascunho = (id) => `proof-diagrama:${id}`;
function lerRascunho(id) {
  try {
    const t = localStorage.getItem(chaveDoRascunho(id));
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}
function guardarRascunho(id, doc) {
  try { localStorage.setItem(chaveDoRascunho(id), JSON.stringify(doc)); } catch { /* sem espaço ou bloqueado: o desenho segue na tela */ }
}
function apagarRascunho(id) {
  try { localStorage.removeItem(chaveDoRascunho(id)); } catch { /* nada a fazer */ }
}
const temaDoApp = () => (document.documentElement.dataset.tema === "claro" ? "claro" : "escuro");

export function DesenhoDeDiagrama({ desafio }) {
  const c = desafio.conteudo;
  const quadro = useRef(null);
  const secao = useRef(null);
  const espera = useRef(null);
  const aberto = useRef(false);
  const [pronto, setPronto] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [estado, setEstado] = useState({ status: desafio.status, nota: desafio.nota, tentativas: desafio.tentativas, avaliacao: desafio.avaliacao });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();
  const encerrado = !podeReenviar({ tipo: desafio.tipo, motor: desafio.motor, tentativas: estado.tentativas, status: estado.status });
  const restantes = Math.max(0, (desafio.maxTentativas || 0) - estado.tentativas);
  const tipo = TIPOS_DE_DIAGRAMA[c.tipo] || TIPOS_DE_DIAGRAMA.fluxograma;
  const ponte = () => quadro.current?.contentWindow?.PonteDoProof || null;

  // o quadro abriu: tema e coleção do exercício, e o desenho (o rascunho ou o último enviado). Vale
  // o primeiro sinal que chegar: o "pronto" da ponte, o load do iframe ou o quadro já aberto.
  function abriu() {
    const p = ponte();
    if (!p || aberto.current) return;
    aberto.current = true;
    p.tema(temaDoApp());
    p.colecao(c.colecao);
    const doc = (!encerrado && lerRascunho(desafio.id)) || desafio.resposta?.diagrama || null;
    if (doc) {
      try { p.importar(doc); } catch { apagarRascunho(desafio.id); }
    }
    p.travar(encerrado);
    setPronto(true);
  }

  const abrir = useRef(abriu);
  abrir.current = abriu;

  // cada mudança no quadro guarda o rascunho (com uma pausa, para não gravar a cada arrasto)
  useEffect(() => {
    function ouvir(e) {
      if (e.source !== quadro.current?.contentWindow || e.data?.origem !== "quadro") return;
      if (e.data.tipo === "pronto") { abrir.current(); return; }
      if (e.data.tipo !== "mudou" || !aberto.current) return;
      clearTimeout(espera.current);
      espera.current = setTimeout(() => {
        const p = ponte();
        if (!p) return;
        if (p.vazio()) apagarRascunho(desafio.id);
        else guardarRascunho(desafio.id, p.exportar());
      }, 700);
    }
    window.addEventListener("message", ouvir);
    abrir.current();
    return () => { window.removeEventListener("message", ouvir); clearTimeout(espera.current); };
  }, [desafio.id]);

  // o tema do app muda: o quadro acompanha
  useEffect(() => {
    const observa = new MutationObserver(() => ponte()?.tema(temaDoApp()));
    observa.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    return () => observa.disconnect();
  }, []);

  useEffect(() => { ponte()?.travar(encerrado); }, [encerrado]);

  // Tela cheia (05/11/2026: "a função de tela cheia do fluxograma não funciona"): a de verdade do navegador,
  // que põe o quadro por cima de tudo. Antes era só CSS (position: fixed), e a animação de entrada das telas
  // (.pf-principal > *, com transform) prendia o quadro dentro do bloco do exercício. Onde o navegador não
  // deixa (iPhone), fica a tela cheia da página — com a animação desligada enquanto ela está aberta.
  async function entrarNaTelaCheia() {
    setTelaCheia(true);
    const el = secao.current;
    try {
      if (el?.requestFullscreen && !document.fullscreenElement) await el.requestFullscreen({ navigationUI: "hide" });
    } catch { /* sem a do navegador: fica a da página */ }
  }
  function sairDaTelaCheia() {
    setTelaCheia(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  // Esc fora do quadro sai; o Esc do navegador (que tira a tela cheia dele) também; e a página não rola por baixo
  useEffect(() => {
    if (!telaCheia) return undefined;
    const sair = (e) => { if (e.key === "Escape") sairDaTelaCheia(); };
    const mudou = () => { if (!document.fullscreenElement) setTelaCheia(false); };
    document.addEventListener("keydown", sair);
    document.addEventListener("fullscreenchange", mudou);
    document.body.classList.add("diagrama-sem-rolar");
    return () => {
      document.removeEventListener("keydown", sair);
      document.removeEventListener("fullscreenchange", mudou);
      document.body.classList.remove("diagrama-sem-rolar");
    };
  }, [telaCheia]);

  async function enviar() {
    const p = ponte();
    if (!p) return;
    if (p.vazio()) { setErro("desenhe o diagrama antes de enviar"); return; }
    setEnviando(true);
    setErro("");
    sairDaTelaCheia();
    reagir("pensando", "Olhando o seu diagrama com calma…", 60000);
    try {
      const diagrama = p.exportar();
      guardarRascunho(desafio.id, diagrama);
      const r = await criar(`/api/desafios/${desafio.id}/enviar`, { diagrama });
      setEstado({ status: r.concluido ? "concluido" : "em_andamento", nota: r.nota, tentativas: r.tentativas, avaliacao: r.avaliacao });
      if (!r.reenviar) apagarRascunho(desafio.id);
      reagirAEntrega(r, { projeto: false, avisar });
    } catch (falha) {
      setErro(falha.message);
      reagir("surpreso", "Ops, algo deu errado no envio.");
    } finally {
      setEnviando(false);
    }
  }

  const params = new URLSearchParams({ embutido: "1", tema: "escuro", colecao: c.colecao || "flow" });
  return (
    <div className="desafio desafio--diagrama">
      <Cabecalho desafio={desafio}>
        <span className="pf-pilula diagrama__tipo">{tipo.nome}</span>
        <Explicacao texto={c.cenario} className="desafio__texto" />
        <p className="pf-campo__rotulo">O que o desenho precisa mostrar</p>
        <ol className="diagrama__requisitos">{c.requisitos.map((r, i) => <li key={i}>{emLinha(r)}</li>)}</ol>
        {c.dicas?.length > 0 && (
          <div className="desafio__dicas">
            {c.dicas.map((d, i) => <details key={i}><summary>Dica {i + 1}</summary><p>{emLinha(d)}</p></details>)}
          </div>
        )}
        {c.criterios?.length > 0 && (
          <>
            <p className="pf-campo__rotulo">Como a Lisa vai corrigir</p>
            <ul className="avaliacao__simples">{c.criterios.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </>
        )}
      </Cabecalho>

      <section ref={secao} className={`pf-cartao diagrama${telaCheia ? " diagrama--cheia" : ""}`} aria-label="O quadro de desenho">
        <div className="diagrama__barra">
          <p className="pf-estat__nota diagrama__ajuda">
            Arraste as formas da barra para o quadro · ligue puxando das bolinhas da borda · dois cliques para escrever · o rótulo de uma seta (Sim/Não): selecione a seta e aperte Enter, ou use o painel ao lado · a coleção de formas muda no topo da barra
          </p>
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => (telaCheia ? sairDaTelaCheia() : entrarNaTelaCheia())}>
            {telaCheia ? "Sair da tela cheia" : "⛶ Tela cheia"}
          </button>
          {telaCheia && !encerrado && (
            <button type="button" className="pf-botao pf-botao--pequeno" disabled={!pronto || enviando} onClick={enviar}>
              {enviando ? "A Lisa está avaliando…" : "Enviar"}
            </button>
          )}
        </div>
        <div className="diagrama__moldura">
          {!pronto && <div className="diagrama__carregando">Abrindo o quadro…</div>}
          <iframe ref={quadro} className="diagrama__quadro" title="Quadro de desenho do diagrama" src={`/diagramas/index.html?${params}`} onLoad={abriu} />
        </div>
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        <div className="pf-acoes" style={{ alignItems: "center" }}>
          {!encerrado && (
            <button type="button" className="pf-botao" disabled={!pronto || enviando} onClick={enviar}>
              {enviando ? "A Lisa está avaliando…" : !estado.tentativas ? "Enviar para a Lisa avaliar" : "Enviar de novo"}
            </button>
          )}
          <span className="pf-estat__nota" style={{ margin: 0 }}>
            {encerrado
              ? `Concluído com nota ${estado.nota ?? 0}.`
              : `Entrega ${estado.tentativas + 1} de ${desafio.maxTentativas} · vale a melhor nota${restantes <= 1 && estado.tentativas > 0 ? " · última chance!" : ""}`}
          </span>
        </div>
        <p className="pf-estat__nota" style={{ margin: 0 }}>💾 O rascunho fica guardado neste navegador enquanto você desenha.</p>
        <Rodape concluido={encerrado} rodada={desafio.rodada} maxRodadas={desafio.maxRodadas} />
      </section>
      {estado.avaliacao && <Avaliacao avaliacao={estado.avaliacao} nota={estado.nota} />}
      {Aviso}
    </div>
  );
}

/**
 * Um diagrama só para olhar (05/11/2026): o exemplo da Lisa no exercício de diagrama abre no mesmo quadro,
 * travado — dá para arrastar a vista e dar zoom, não para mexer nas formas.
 */
export function DiagramaParaVer({ documento, colecao = "flow", titulo = "Diagrama de exemplo" }) {
  const quadro = useRef(null);
  const aberto = useRef(false);
  const [pronto, setPronto] = useState(false);
  const ponte = () => quadro.current?.contentWindow?.PonteDoProof || null;

  function abriu() {
    const p = ponte();
    if (!p || aberto.current) return;
    aberto.current = true;
    p.tema(temaDoApp());
    p.colecao(colecao);
    try { p.importar(documento); } catch { /* um documento estragado deixa o quadro vazio */ }
    p.travar(true);
    setPronto(true);
  }
  const abrir = useRef(abriu);
  abrir.current = abriu;

  useEffect(() => {
    function ouvir(e) {
      if (e.source === quadro.current?.contentWindow && e.data?.origem === "quadro" && e.data.tipo === "pronto") abrir.current();
    }
    window.addEventListener("message", ouvir);
    abrir.current();
    return () => window.removeEventListener("message", ouvir);
  }, []);

  useEffect(() => {
    const observa = new MutationObserver(() => ponte()?.tema(temaDoApp()));
    observa.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    return () => observa.disconnect();
  }, []);

  const params = new URLSearchParams({ embutido: "1", tema: "escuro", colecao });
  return (
    <div className="diagrama__moldura diagrama__moldura--exemplo">
      {!pronto && <div className="diagrama__carregando">Abrindo o exemplo…</div>}
      <iframe ref={quadro} className="diagrama__quadro" title={`Exemplo da Lisa: ${titulo}`} src={`/diagramas/index.html?${params}`} onLoad={abriu} />
    </div>
  );
}
