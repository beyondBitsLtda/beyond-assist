"use client";

import { useState } from "react";
import { numero } from "./pecas.js";
import { TROPAS, ORDEM_DAS_TROPAS } from "@/dominio/tropas.js";

const listaDeTropas = (tropas) => ORDEM_DAS_TROPAS.filter((t) => tropas?.[t] > 0).map((t) => `${tropas[t]} ${TROPAS[t].emoji} ${TROPAS[t].nome}`).join(" · ") || "nenhuma";

/**
 * A visita a um reino vizinho (na paz): o mundo 3D mostra a ilha dele, e este cartão por cima
 * conta tudo — construções, tropas, veículos, operários, Neuro e troféus.
 */
export default function Visita({ visita, aoVoltar }) {
  // no celular, o cartão começa recolhido: aberto, ele cobriria a ilha que se está visitando
  const [aberto, setAberto] = useState(() => typeof window === "undefined" || window.innerWidth >= 700);
  if (!visita) return null;
  if (visita.carregando) {
    return <div className="rn-visita rn-visita--carregando" role="status">🕊️ Abrindo os portões de {visita.nome || "um reino vizinho"}…</div>;
  }
  const r = visita;
  return (
    <div className="rn-visita" role="region" aria-label={`Visita ao ${r.nome}`}>
      <div className="rn-visita__topo">
        <div>
          <span className="rn-visita__selo">👁️ Visitando</span>
          <h3>{r.nome}</h3>
          <small>de {r.dono} · 🏆 {numero(r.trofeus)} · Neuro nível {r.neuro.nivel} ({r.neuro.estagio})</small>
        </div>
        <div className="rn-visita__botoes">
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>{aberto ? "Menos" : "Ver tudo"}</button>
          <button type="button" className="pf-botao pf-botao--pequeno" onClick={aoVoltar}>⬅ Meu reino</button>
        </div>
      </div>
      {aberto && (
        <div className="rn-visita__corpo">
          <p className="rn-visita__linha">⚔️ {r.poder.ataque}/s · 🛡️ {r.poder.defesa} · ⚒️ {r.ouro.operarios} operário(s) na Mina de Ouro nível {r.ouro.nivel} · 🚗 {r.veiculos.map((v) => v.emoji).join(" ")}</p>
          <ul className="rn-visita__predios">
            {r.construcoes.filter((c) => c.nivel > 0).map((c) => <li key={c.chave}><span aria-hidden="true">{c.emoji}</span> {c.nome} <strong>nv {c.nivel}</strong></li>)}
          </ul>
          <p className="rn-visita__linha"><strong>Exército:</strong> {listaDeTropas(r.tropas.exercito)}</p>
          <p className="rn-visita__linha"><strong>Defesa:</strong> {listaDeTropas(r.tropas.guarnicao)}</p>
        </div>
      )}
    </div>
  );
}
