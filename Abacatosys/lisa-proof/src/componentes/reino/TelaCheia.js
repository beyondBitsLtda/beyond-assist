"use client";

import { useEffect } from "react";
import { numero } from "./pecas.js";

/** Os menus da tela cheia, na ordem do dock. */
export const PAINEIS = [
  { id: "construcoes", emoji: "🏗️", rotulo: "Construir" },
  { id: "minas", emoji: "⛏️", rotulo: "Minas" },
  { id: "tropas", emoji: "⚔️", rotulo: "Tropas" },
  { id: "garagem", emoji: "🚗", rotulo: "Garagem" },
  { id: "expedicoes", emoji: "🗺️", rotulo: "Expedições" },
  { id: "bolsa", emoji: "📈", rotulo: "Bolsa" },
  { id: "invadir", emoji: "🎯", rotulo: "Invadir" },
  { id: "paz", emoji: "🕊️", rotulo: "Paz" },
  { id: "personagens", emoji: "🎭", rotulo: "Neuro" },
];

/**
 * A tela cheia do reino (pedido de 23/10/2026): o mundo 3D ocupa tudo, e as funções do reino
 * ficam em menus suspensos — a barra de cima (moedas, troféus, escudo e as coletas rápidas) e o
 * dock de baixo, que abre um painel flutuante com a parte escolhida da página. Esc fecha o painel;
 * Esc de novo sai da tela cheia.
 */
export default function TelaCheia({ reino, painel, aoPainel, aoSair, ocupado, aoColetarMina, aoColetarOuro, children }) {
  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== "Escape" || document.querySelector(".folha__fundo")) return; // a folha aberta fecha primeiro
      if (painel) aoPainel(null);
      else aoSair();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [painel, aoPainel, aoSair]);

  const atual = PAINEIS.find((p) => p.id === painel);
  return (
    <>
      <div className="rn-hud__topo">
        <div className="rn-hud__reino">
          <strong>{reino.nome}</strong>
          <span>🪙 {numero(reino.saldo)}</span>
          <span>🏆 {numero(reino.trofeus)}</span>
          {reino.paz?.vigente ? <span>🕊️ paz</span> : reino.escudoAte ? <span>🛡️ escudo</span> : null}
        </div>
        <div className="rn-hud__rapido">
          {reino.mina.paraColetar > 0 && (
            <button type="button" className="rn-hud__botao" disabled={Boolean(ocupado)} onClick={aoColetarMina}>⛏️ +{numero(reino.mina.paraColetar)}</button>
          )}
          {reino.ouro?.moedas > 0 && (
            <button type="button" className="rn-hud__botao" disabled={Boolean(ocupado)} onClick={aoColetarOuro}>⚒️ +{numero(reino.ouro.moedas)}</button>
          )}
          <button type="button" className="rn-hud__botao rn-hud__sair" onClick={aoSair} aria-label="Sair da tela cheia">✕ <span>Sair</span></button>
        </div>
      </div>
      {atual && (
        <aside className="rn-hud__painel" aria-label={atual.rotulo}>
          <div className="rn-hud__painel-topo">
            <strong>{atual.emoji} {atual.rotulo}</strong>
            <button type="button" className="folha__fechar" onClick={() => aoPainel(null)} aria-label="Fechar o painel">✕</button>
          </div>
          <div className="rn-hud__painel-corpo">{children}</div>
        </aside>
      )}
      <nav className="rn-hud__dock" aria-label="Menus do reino">
        {PAINEIS.map((p) => (
          <button key={p.id} type="button" className={`rn-hud__item${painel === p.id ? " rn-hud__item--atual" : ""}`} aria-pressed={painel === p.id}
            onClick={() => aoPainel(painel === p.id ? null : p.id)}>
            <span aria-hidden="true">{p.emoji}</span><small>{p.rotulo}</small>
          </button>
        ))}
      </nav>
    </>
  );
}
