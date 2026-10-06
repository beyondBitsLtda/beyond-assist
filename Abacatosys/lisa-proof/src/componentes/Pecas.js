"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NOMES_DOS_DIAS } from "@/dominio/datas.js";

/** Barra de progresso com o número lido em voz alta por leitor de tela. */
export function Barra({ valor, total, rotulo }) {
  const pct = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0;
  return (
    <div className="pf-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={rotulo}>
      <div className="pf-barra__cheio" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Escolha dos dias da semana em que se estuda. Ordem de segunda a domingo, como a semana. */
const ORDEM = [1, 2, 3, 4, 5, 6, 0];
export function DiasDeEstudo({ valor, aoMudar }) {
  function alternar(d) {
    const tem = valor.includes(d);
    if (tem && valor.length === 1) return; // ao menos um dia
    aoMudar(tem ? valor.filter((x) => x !== d) : [...valor, d].sort((a, b) => a - b));
  }
  return (
    <div className="pf-dias" role="group" aria-label="Dias de estudo">
      {ORDEM.map((d) => (
        <button key={d} type="button" className="pf-dia" aria-pressed={valor.includes(d)} onClick={() => alternar(d)}>
          {NOMES_DOS_DIAS[d]}
        </button>
      ))}
    </div>
  );
}

/** Aviso flutuante que some sozinho ("+10 pontos"). */
export function useAviso() {
  const [texto, setTexto] = useState("");
  const timer = useRef(null);
  const mostrar = useCallback((t) => {
    setTexto(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTexto(""), 2600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const Aviso = texto ? <div className="pf-toast" role="status">{texto}</div> : null;
  return [Aviso, mostrar];
}

/** O texto que acompanha os pontos ganhos ou perdidos num clique. */
export function textoDosPontos(r) {
  if (!r) return "";
  if (r.metaBatida) return `Meta do dia batida! +${r.pontos} pontos`;
  if (r.pontos > 0) return r.cardConcluido ? `Assunto concluído! +${r.pontos} pontos` : `+${r.pontos} pontos`;
  if (r.pontos < 0) return `${r.pontos} pontos`;
  return "";
}
