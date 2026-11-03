"use client";

import { useCallback, useEffect, useState } from "react";
import { obter, mudar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import ReportarProblema from "@/componentes/ReportarProblema.js";
import { SITUACOES, TETO_DA_RESPOSTA, previsaoDoChamado, quandoEmBrasilia, diaEmBrasilia } from "@/dominio/chamado.js";

const FILTROS = [
  { id: "abertos", rotulo: "Em aberto", vale: (c) => c.situacao !== "resolvido" },
  { id: "resolvidos", rotulo: "Resolvidos", vale: (c) => c.situacao === "resolvido" },
  { id: "todos", rotulo: "Todos", vale: () => true },
];
const TOM = { aberto: "pf-pilula--atencao", analise: "pf-pilula--tema", resolvido: "pf-pilula--verde" };
// a data do <input type="date"> a partir do prazo guardado (em Brasília)
const diaDoInput = (iso) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso)) : "");

/**
 * Chamados (BEYOND-0015): o que foi reportado pelo "Reportar problema" e em que pé está. Quem abriu vê
 * os seus — status, previsão de término e as respostas do técnico. O técnico vê todos, com quem abriu,
 * e muda o status, a previsão e responde aqui mesmo (o chamado continua sendo o card no Abacato).
 */
export default function Chamados() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("abertos");
  const [Aviso, avisar] = useAviso();

  const carregar = useCallback(() => {
    setErro("");
    return obter("/api/chamados").then(setDados).catch((e) => setErro(e.message));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const mudarChamado = useCallback(async (id, corpo, ok) => {
    try {
      await mudar(`/api/chamados/${id}`, corpo);
      avisar(ok);
      await carregar();
      return true;
    } catch (e) {
      avisar(`Não deu: ${e.message}`);
      return false;
    }
  }, [avisar, carregar]);

  const lista = (dados?.chamados || []).filter(FILTROS.find((f) => f.id === filtro).vale);
  const contagem = (id) => (dados?.chamados || []).filter(FILTROS.find((f) => f.id === id).vale).length;

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>Chamados</h1>
          <p>
            {dados?.tecnico
              ? "Todos os chamados do Proof. Mude o status, marque a previsão de término e responda: quem abriu vê aqui na hora."
              : "Os problemas que você reportou e em que pé eles estão, com a previsão de término quando o técnico marcar."}
          </p>
        </div>
        <ReportarProblema className="pf-botao pf-botao--sec" />
      </div>

      {erro && <div className="pf-aviso pf-aviso--erro">{erro} <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={carregar}>Tentar de novo</button></div>}
      {!dados && !erro && <p className="pf-estat__nota">Carregando os chamados…</p>}

      {dados && (
        <>
          <div className="agenda__modos ch-filtros" role="tablist" aria-label="Quais chamados">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} className="agenda__modo" onClick={() => setFiltro(f.id)}>
                {f.rotulo} <span className="ch-filtros__n">{contagem(f.id)}</span>
              </button>
            ))}
          </div>

          {lista.length === 0 ? (
            <div className="pf-cartao ch-vazio">
              <p className="pf-estat__nota">
                {filtro === "abertos"
                  ? (dados.tecnico ? "Nenhum chamado em aberto. Tudo em dia." : "Nenhum chamado em aberto. Se algo der errado, use o “Reportar problema”.")
                  : filtro === "resolvidos" ? "Nenhum chamado resolvido ainda." : "Nenhum chamado por aqui ainda."}
              </p>
            </div>
          ) : (
            <ul className="ch-lista">
              {lista.map((c) => (
                <Chamado key={c.id} chamado={c} tecnico={dados.tecnico} colunas={dados.colunas} aoMudar={mudarChamado} />
              ))}
            </ul>
          )}
        </>
      )}
      {Aviso}
    </>
  );
}

function Chamado({ chamado: c, tecnico, colunas, aoMudar }) {
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const previsao = previsaoDoChamado({ fimEm: c.fimEm, situacao: c.situacao });

  async function responder(e) {
    e.preventDefault();
    if (!resposta.trim()) return;
    setEnviando(true);
    if (await aoMudar(c.id, { resposta }, "Resposta enviada")) setResposta("");
    setEnviando(false);
  }

  return (
    <li className="pf-cartao ch-item" data-situacao={c.situacao}>
      <div className="ch-item__topo">
        <span className={`pf-pilula ${TOM[c.situacao]}`}>{SITUACOES[c.situacao].rotulo}</span>
        {tecnico && c.coluna && SITUACOES[c.situacao].rotulo !== c.coluna && <span className="pf-pilula">{c.coluna}</span>}
        <span className="ch-item__quando">aberto em {quandoEmBrasilia(new Date(c.criadoEm))}{tecnico && c.quem ? ` · por ${c.quem}` : ""}</span>
      </div>
      <h2 className="ch-item__titulo">{c.titulo}</h2>
      {previsao && (
        <p className={`ch-item__previsao${previsao.atrasada ? " ch-item__previsao--atrasada" : ""}`}>
          Previsão de término: <strong>{previsao.texto}</strong>{previsao.atrasada ? " — atrasado" : ""}
        </p>
      )}

      <details className="ch-item__relato">
        <summary>O que foi relatado</summary>
        <p>{c.relato || "(sem texto)"}</p>
      </details>

      {c.respostas.length > 0 && (
        <ol className="ch-respostas" aria-label="Respostas do técnico">
          {c.respostas.map((r, i) => (
            <li key={i} className="ch-resposta">
              <span className="ch-resposta__quem">Técnico · {quandoEmBrasilia(new Date(r.em))}</span>
              <p>{r.texto}</p>
            </li>
          ))}
        </ol>
      )}

      {tecnico && (
        <div className="ch-gestao">
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Status</span>
            <select className="pf-campo__entrada" value={c.colunaId} onChange={(e) => aoMudar(c.id, { colunaId: e.target.value }, "Status mudado")}>
              {colunas.map((col) => <option key={col.id} value={col.id}>{col.nome}</option>)}
            </select>
          </label>
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Previsão de término</span>
            <span className="ch-gestao__data">
              <input type="date" className="pf-campo__entrada" value={diaDoInput(c.fimEm)}
                onChange={(e) => aoMudar(c.id, { previsao: e.target.value }, e.target.value ? `Previsão: ${diaEmBrasilia(`${e.target.value}T21:00:00Z`)}` : "Previsão tirada")} />
              {c.fimEm && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => aoMudar(c.id, { previsao: "" }, "Previsão tirada")}>Tirar</button>}
            </span>
          </label>
          <form className="ch-gestao__resposta" onSubmit={responder}>
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Responder a quem abriu</span>
              <textarea className="pf-campo__entrada" rows={2} maxLength={TETO_DA_RESPOSTA} value={resposta}
                placeholder="Ex.: achei a causa, a correção sai amanhã." onChange={(e) => setResposta(e.target.value)} />
            </label>
            <button type="submit" className="pf-botao pf-botao--pequeno" disabled={enviando || !resposta.trim()}>{enviando ? "Enviando…" : "Responder"}</button>
          </form>
        </div>
      )}
    </li>
  );
}
