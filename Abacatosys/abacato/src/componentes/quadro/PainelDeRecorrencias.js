"use client";

import { useCallback, useEffect, useState } from "react";
import { obter, criar, mudar, remover } from "@/lib/api.js";
import { regraEmPalavras } from "@/dominio/recorrencia.js";
import { dataCurta } from "./CardMini.js";

// As repetições que cabem num quadro de trabalho. Não é um editor de cron: quem precisa de
// "toda terça sim, terça não" precisa de um calendário, não de um quadro — e um campo livre
// aqui só produziria regras que nunca disparam.
const DIAS = [
  { n: 1, curto: "seg" }, { n: 2, curto: "ter" }, { n: 3, curto: "qua" },
  { n: 4, curto: "qui" }, { n: 5, curto: "sex" }, { n: 6, curto: "sáb" }, { n: 7, curto: "dom" },
];

export default function PainelDeRecorrencias({ quadroId, colunas, poderes, aoFechar, aoMudar }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [titulo, setTitulo] = useState("");
  const [colunaId, setColunaId] = useState(colunas[0]?.id || "");
  const [tipo, setTipo] = useState("semanal");
  const [dias, setDias] = useState([1]);
  const [diaDoMes, setDiaDoMes] = useState(1);

  const carregar = useCallback(async () => {
    try { setLista((await obter(`/api/quadros/${quadroId}/recorrencias`)).recorrencias); }
    catch (e) { setErro(e.message); }
  }, [quadroId]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape" && !["INPUT", "SELECT"].includes(document.activeElement?.tagName)) aoFechar(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  const regra =
    tipo === "diaria" ? "diaria"
    : tipo === "semanal" ? `semanal:${[...dias].sort((a, b) => a - b).join(",")}`
    : `mensal:${diaDoMes}`;

  const regraUtil = tipo !== "semanal" || dias.length > 0;

  async function adicionar() {
    if (!titulo.trim() || !colunaId || !regraUtil) return;
    try {
      await criar(`/api/quadros/${quadroId}/recorrencias`, { colunaId, titulo: titulo.trim(), regra });
      setTitulo("");
      await carregar();
      aoMudar?.();
    } catch (e) { setErro(e.message); }
  }

  return (
    <div className="abacato-painel" role="dialog" aria-modal="true" aria-label="Tarefas que se repetem">
      <div className="abacato-painel__fundo" onClick={aoFechar} />
      <div className="abacato-painel__caixa abacato-painel__caixa--estreita">
        <header className="abacato-painel__cabecalho">
          <h2 className="abacato-painel__titulo abacato-painel__titulo--fixo">Tarefas que se repetem</h2>
          <button type="button" className="abacato-icone" onClick={aoFechar} aria-label="fechar">✕</button>
        </header>

        <p className="abacato-dica abacato-dica--bloco">
          Cada repetição vira um card de verdade na coluna escolhida, com a data de entrega do dia.
          Os cards que já nasceram ficam no quadro mesmo que você apague a regra depois.
        </p>

        {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}

        <div className="abacato-painel__corpo">
          {poderes.criar && (
            <section className="abacato-bloco">
              <h3 className="abacato-bloco__titulo">Nova</h3>

              <label className="abacato-campo">
                <span className="abacato-campo__rotulo">O que se repete</span>
                <input className="abacato-campo__entrada" value={titulo} placeholder="Ex.: Backup semanal do servidor"
                  onChange={(e) => setTitulo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") adicionar(); }} />
              </label>

              <label className="abacato-campo">
                <span className="abacato-campo__rotulo">Em qual coluna</span>
                <select className="abacato-selecao" value={colunaId} onChange={(e) => setColunaId(e.target.value)}>
                  {colunas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </label>

              <div className="abacato-campo">
                <span className="abacato-campo__rotulo">Quando</span>
                <div className="abacato-abas">
                  {[["diaria", "Todo dia"], ["semanal", "Por semana"], ["mensal", "Por mês"]].map(([v, r]) => (
                    <button key={v} type="button"
                      className={`abacato-aba${tipo === v ? " abacato-aba--ativa" : ""}`}
                      onClick={() => setTipo(v)}>{r}</button>
                  ))}
                </div>
              </div>

              {tipo === "semanal" && (
                <div className="abacato-dias">
                  {DIAS.map((d) => (
                    <button key={d.n} type="button"
                      className={`abacato-dia${dias.includes(d.n) ? " abacato-dia--ativo" : ""}`}
                      aria-pressed={dias.includes(d.n)}
                      onClick={() => setDias((atual) => atual.includes(d.n) ? atual.filter((x) => x !== d.n) : [...atual, d.n])}>
                      {d.curto}
                    </button>
                  ))}
                </div>
              )}

              {tipo === "mensal" && (
                <label className="abacato-campo">
                  <span className="abacato-campo__rotulo">Dia do mês</span>
                  <input type="number" min={1} max={31} className="abacato-campo__entrada" value={diaDoMes}
                    onChange={(e) => setDiaDoMes(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} />
                  {diaDoMes > 28 && (
                    // Vale avisar: escolher 31 e não entender por que a tarefa caiu dia 28 em
                    // fevereiro é o tipo de surpresa que faz perder a confiança no recurso.
                    <span className="abacato-dica">
                      Nos meses mais curtos a tarefa cai no último dia do mês.
                    </span>
                  )}
                </label>
              )}

              <p className="abacato-resumo-da-regra">
                {regraUtil ? <>Vai criar <strong>{titulo.trim() || "a tarefa"}</strong> {regraEmPalavras(regra)}.</>
                           : "Escolha pelo menos um dia da semana."}
              </p>

              <button type="button" className="abacato-botao" onClick={adicionar} disabled={!titulo.trim() || !regraUtil}>
                Criar repetição
              </button>
            </section>
          )}

          <section className="abacato-bloco">
            <h3 className="abacato-bloco__titulo">Já cadastradas</h3>
            {lista === null && <span className="abacato-dica">carregando…</span>}
            {lista?.length === 0 && <span className="abacato-dica">nenhuma ainda</span>}
            {lista?.map((r) => (
              <div key={r.id} className={`abacato-recorrencia${r.ativa ? "" : " abacato-recorrencia--pausada"}`}>
                <div>
                  <strong>{r.titulo}</strong>
                  <div className="abacato-dica">
                    {regraEmPalavras(r.regra)} · em <em>{colunas.find((c) => c.id === r.coluna_id)?.nome || "coluna arquivada"}</em>
                    {r.ativa && <> · próxima {dataCurta(r.proxima_em)}</>}
                    {!r.ativa && <> · pausada</>}
                  </div>
                </div>
                {poderes.editar && (
                  <div className="abacato-recorrencia__acoes">
                    <button type="button" className="abacato-icone" title={r.ativa ? "pausar" : "retomar"}
                      onClick={async () => {
                        try { await mudar(`/api/recorrencias/${r.id}`, { ativa: !r.ativa }); await carregar(); }
                        catch (e) { setErro(e.message); }
                      }}>{r.ativa ? "⏸" : "▶"}</button>
                    <button type="button" className="abacato-icone" title="apagar a regra"
                      onClick={async () => {
                        if (!window.confirm(`Apagar a repetição "${r.titulo}"? Os cards já criados continuam no quadro.`)) return;
                        try { await remover(`/api/recorrencias/${r.id}`); await carregar(); }
                        catch (e) { setErro(e.message); }
                      }}>🗑</button>
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
