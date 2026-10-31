"use client";

// O diário de estudo de uma trilha (31/10/2026, src/dominio/diario.js): o que aprendi e onde travei,
// uma entrada por dia. Fica fechado na Prática e só lê o banco quando a pessoa abre.

import { useState } from "react";
import { obter, criar } from "@/lib/api.js";
import { formatarDia } from "@/dominio/datas.js";
import { LIMITES_DO_DIARIO, PONTOS_DO_DIARIO } from "@/dominio/diario.js";
import { celebrar } from "../Neuro.js";
import { useAviso } from "../Pecas.js";

export function DiarioDaTrilha({ trilhaId, tema }) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState(null);
  const [aprendi, setAprendi] = useState("");
  const [travei, setTravei] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();

  async function abrir() {
    setAberto((a) => !a);
    if (dados) return;
    try {
      const r = await obter(`/api/diario?trilha=${trilhaId}`);
      setDados(r);
      setAprendi(r.deHoje?.aprendi || "");
      setTravei(r.deHoje?.travei || "");
    } catch (e) {
      setErro(e.message);
    }
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const r = await criar("/api/diario", { trilhaId, aprendi, travei });
      setDados((d) => ({ ...d, deHoje: r.entrada, entradas: [r.entrada, ...(d?.entradas || []).filter((x) => x.dia !== r.entrada.dia)] }));
      if (r.pontos > 0) { if (!celebrar(r)) avisar(`Diário salvo! +${r.pontos} pontos`); } else avisar("Diário salvo.");
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  const anteriores = (dados?.entradas || []).filter((x) => x.dia !== dados?.hoje);
  return (
    <div className="diario">
      <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" aria-expanded={aberto} onClick={abrir}>
        📓 Diário de hoje{dados?.deHoje ? " ✓" : ""}
      </button>
      {aberto && (
        <form className="pf-cartao diario__form" onSubmit={salvar} aria-label={`Diário de ${tema}`}>
          {!dados && !erro && <small className="pf-estat__nota">Abrindo…</small>}
          <label className="pf-campo">
            <span className="pf-campo__rotulo">O que eu aprendi hoje</span>
            <textarea className="pf-campo__entrada" rows={3} maxLength={LIMITES_DO_DIARIO.aprendi} value={aprendi} required onChange={(e) => setAprendi(e.target.value)} />
          </label>
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Onde eu travei (opcional — a Lisa usa no exercício de amanhã)</span>
            <textarea className="pf-campo__entrada" rows={2} maxLength={LIMITES_DO_DIARIO.travei} value={travei} onChange={(e) => setTravei(e.target.value)} />
          </label>
          {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
          <div className="pf-acoes" style={{ alignItems: "center" }}>
            <button type="submit" className="pf-botao pf-botao--pequeno" disabled={salvando || aprendi.trim().length < LIMITES_DO_DIARIO.minimo}>{salvando ? "Salvando…" : dados?.deHoje ? "Atualizar" : "Salvar"}</button>
            <span className="pf-estat__nota" style={{ margin: 0 }}>Sem nota. A primeira entrada do dia vale {PONTOS_DO_DIARIO} pontos e conta para a ofensiva.</span>
          </div>
          {anteriores.length > 0 && (
            <details>
              <summary>Dias anteriores</summary>
              <ul className="diario__lista">
                {anteriores.map((x) => (
                  <li key={x.dia}><strong>{formatarDia(x.dia, { comSemana: true })}</strong> — {x.aprendi}{x.travei && <small> · travei: {x.travei}</small>}</li>
                ))}
              </ul>
            </details>
          )}
        </form>
      )}
      {Aviso}
    </div>
  );
}
