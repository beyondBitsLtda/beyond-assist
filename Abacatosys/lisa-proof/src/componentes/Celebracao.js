"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PONTOS } from "@/dominio/pontos.js";
import { NOMES_DOS_DIAS, diaDe, somarDias, diaDaSemana } from "@/dominio/datas.js";
import Neuro from "./Neuro.js";

/**
 * As comemorações em tela cheia, no estilo do Duolingo: ofensiva que subiu, meta do dia batida e
 * conquista desbloqueada. Montada uma vez, na moldura; qualquer tela chama `celebrar(resultado)`
 * (em Neuro.js) com o que o servidor devolveu e ela enfileira os cartões — um de cada vez, com
 * "Continuar".
 */

function Chama() {
  return (
    <svg className="festa__chama" viewBox="0 0 120 150" aria-hidden="true">
      <defs>
        <linearGradient id="chama-fora" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#F97316" />
          <stop offset="1" stopColor="#FACC15" />
        </linearGradient>
        <linearGradient id="chama-dentro" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FDE047" />
          <stop offset="1" stopColor="#FFF7D6" />
        </linearGradient>
      </defs>
      <path className="festa__chama-fora" fill="url(#chama-fora)"
        d="M60 6 C 72 34, 104 50, 104 92 C 104 124, 84 144, 60 144 C 36 144, 16 124, 16 92 C 16 70, 28 58, 36 46 C 38 62, 44 70, 52 72 C 46 48, 50 26, 60 6 Z" />
      <path className="festa__chama-dentro" fill="url(#chama-dentro)"
        d="M60 62 C 68 78, 84 88, 84 108 C 84 126, 73 136, 60 136 C 47 136, 36 126, 36 108 C 36 96, 44 88, 48 82 C 50 92, 54 96, 58 96 C 55 84, 56 72, 60 62 Z" />
    </svg>
  );
}

function Ofensiva({ dias }) {
  const hoje = diaDe();
  const semana = Array.from({ length: 7 }, (_, i) => somarDias(hoje, i - 6));
  return (
    <>
      <div className="festa__palco">
        <Chama />
        <div className="festa__numero" aria-live="polite">
          <span className="festa__numero-velho">{Math.max(0, dias - 1)}</span>
          <span className="festa__numero-novo">{dias}</span>
        </div>
      </div>
      <h2 className="festa__titulo festa__titulo--fogo">{dias === 1 ? "dia de ofensiva!" : "dias de ofensiva!"}</h2>
      <p className="festa__texto">
        {dias === 1 ? "Começou! Volte amanhã para a chama crescer." : `Você estudou hoje. Volte amanhã para chegar a ${dias + 1}!`}
      </p>
      <div className="festa__semana" aria-hidden="true">
        {semana.map((d, i) => {
          const aceso = i >= 7 - Math.min(dias, 7);
          return (
            <div key={d} className="festa__dia">
              <span>{NOMES_DOS_DIAS[diaDaSemana(d)]}</span>
              <i className={`festa__bolinha${aceso ? " festa__bolinha--acesa" : ""}${i === 6 ? " festa__bolinha--hoje" : ""}`} style={{ animationDelay: `${0.5 + i * 0.08}s` }}>
                {aceso ? "✓" : ""}
              </i>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Meta() {
  return (
    <>
      <div className="festa__palco">
        <svg className="festa__anel" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="50" className="festa__anel-trilho" />
          <circle cx="60" cy="60" r="50" className="festa__anel-brilho" />
          <circle cx="60" cy="60" r="50" className="festa__anel-cheio" />
        </svg>
        <span className="festa__alvo" aria-hidden="true">🎯</span>
      </div>
      <h2 className="festa__titulo">Meta do dia batida!</h2>
      <p className="festa__texto">Você fez a sua parte hoje. Tudo que vier agora é bônus.</p>
      <span className="festa__selo">+{PONTOS.meta_diaria} pontos de bônus</span>
    </>
  );
}

function Conquista({ nome, icone, descricao, pontos }) {
  return (
    <>
      <p className="festa__chamada">Conquista desbloqueada!</p>
      <div className="festa__palco">
        <div className="festa__medalha">
          <span className="festa__fitas" aria-hidden="true" />
          <span className="festa__moeda"><span aria-hidden="true">{icone || "🏅"}</span></span>
        </div>
      </div>
      <h2 className="festa__titulo">{nome}</h2>
      {descricao && <p className="festa__texto">{descricao}</p>}
      <span className="festa__selo">+{pontos} pontos na conta</span>
    </>
  );
}

export default function Celebracao() {
  const [fila, setFila] = useState([]);
  const botao = useRef(null);

  useEffect(() => {
    const chegou = (e) => setFila((f) => [...f, ...(e.detail?.cartoes || [])]);
    window.addEventListener("proof-celebrar", chegou);
    return () => window.removeEventListener("proof-celebrar", chegou);
  }, []);

  const atual = fila[0];

  // Cada cartão novo solta confete e ganha o foco no botão (Enter/espaço continua).
  useEffect(() => {
    if (!atual) return;
    window.dispatchEvent(new CustomEvent("neuro-confete"));
    const t = setTimeout(() => botao.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [atual]);

  const seguir = useCallback(() => setFila((f) => f.slice(1)), []);

  useEffect(() => {
    if (!atual) return undefined;
    const tecla = (e) => e.key === "Escape" && setFila([]);
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [atual]);

  if (!atual) return null;
  const chave = `${atual.tipo}-${atual.codigo || atual.dias || ""}-${fila.length}`;

  return (
    <div className={`festa festa--${atual.tipo}`} role="dialog" aria-modal="true" aria-label="Comemoração">
      <div className="festa__conteudo" key={chave}>
        {atual.tipo === "ofensiva" && <Ofensiva dias={atual.dias} />}
        {atual.tipo === "meta" && <Meta />}
        {atual.tipo === "conquista" && <Conquista {...atual} />}
        <div className="festa__neuro">
          <Neuro humor="comemorando" tamanho={96} />
        </div>
        <button ref={botao} type="button" className="pf-botao festa__continuar" onClick={seguir}>
          {fila.length > 1 ? "Continuar" : "Show!"}
        </button>
      </div>
    </div>
  );
}
