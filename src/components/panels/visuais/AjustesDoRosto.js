"use client";

// O cabelo e as cores do Rosto (01/11/2026: "pôr a Lisa com cabelo feminino também, além de um modo
// de cores diferentes"), no painel "Visual da Lisa" (/visual). A escolha fica neste navegador e vale
// na hora, no rosto aberto aqui e no do Assistente (src/lib/rostoDaLisa.js: escolherAjustesDoRosto).

import { CABELOS_DO_ROSTO, PALETAS_DO_ROSTO, escolherAjustesDoRosto } from "@/lib/rostoDaLisa.js";
import { usarAjustesDoRosto } from "./VisualDaLisa.js";

export default function AjustesDoRosto() {
  const a = usarAjustesDoRosto();
  return (
    <div className="bb-visuais-ajustes">
      <div className="bb-visuais-simulador" role="group" aria-label="Cabelo do Rosto">
        <span>Cabelo:</span>
        {CABELOS_DO_ROSTO.map((c) => (
          <button key={c.id} type="button" aria-pressed={a.cabelo === c.id} title={c.descricao} onClick={() => escolherAjustesDoRosto({ cabelo: c.id })}>
            {c.nome}
          </button>
        ))}
      </div>
      <div className="bb-visuais-simulador" role="group" aria-label="Cores do Rosto">
        <span>Cores:</span>
        {PALETAS_DO_ROSTO.map((p) => (
          <button key={p.id} type="button" aria-pressed={a.paleta === p.id} onClick={() => escolherAjustesDoRosto({ paleta: p.id })}>
            {/* a amostra: o rosto escuro no meio, a borda nas cores da paleta e o halo por fora */}
            <i className="bb-visuais-amostra" aria-hidden="true"
              style={{ background: `radial-gradient(circle at 50% 45%, #000 0 34%, ${p.profundo} 46%, ${p.meio} 60%, ${p.borda} 72%, ${p.halo} 84%, transparent 94%)` }} />
            {p.nome}
          </button>
        ))}
      </div>
    </div>
  );
}
