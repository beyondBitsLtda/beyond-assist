"use client";

import { useEffect, useRef, useState } from "react";
import CardMini from "./CardMini.js";

/**
 * Uma coluna do quadro.
 *
 * A caixa de "novo card" abre no lugar onde o card vai nascer e some ao perder o foco, mas o
 * Enter a mantém aberta para o próximo: anotar cinco tarefas seguidas é o uso normal, e fechar
 * a cada uma obrigaria a cinco cliques a mais.
 */
export default function Coluna({
  coluna, alvo, arrasto, poderes, aoAbrirCard, aoIniciarArrasto, aoConcluirCard,
  aoCriarCard, aoRenomear, aoArquivar, aoMudarCapa,
}) {
  const [escrevendo, setEscrevendo] = useState(false);
  const [texto, setTexto] = useState("");
  const [editandoNome, setEditandoNome] = useState(false);
  const [menu, setMenu] = useState(false);
  const campo = useRef(null);
  const fim = useRef(null);

  useEffect(() => { if (escrevendo) campo.current?.focus(); }, [escrevendo]);

  async function enviar(continuar) {
    const t = texto.trim();
    if (!t) { setEscrevendo(false); return; }
    setTexto("");
    await aoCriarCard(coluna.id, t);
    if (continuar) {
      // Rolar até o fim para o card recém-criado ficar visível — sem isto, numa coluna cheia
      // ele nasce fora da tela e parece que nada aconteceu.
      requestAnimationFrame(() => fim.current?.scrollIntoView({ block: "nearest" }));
      campo.current?.focus();
    } else {
      setEscrevendo(false);
    }
  }

  // O espaço reservado só aparece na coluna sob o ponteiro, e no índice em que o card cairia.
  const reservaAqui = arrasto?.tipo === "card" && alvo?.colunaId === coluna.id ? alvo.indice : null;

  const cards = coluna.cards;
  const lista = [];
  for (let i = 0; i <= cards.length; i++) {
    if (reservaAqui === i) {
      lista.push(<div key={`reserva-${i}`} className="abacato-reserva" style={{ height: arrasto.altura }} />);
    }
    if (i < cards.length) {
      lista.push(
        <CardMini
          key={cards[i].id}
          dados={cards[i]}
          arrastando={arrasto?.tipo === "card" && arrasto.id === cards[i].id}
          aoAbrir={aoAbrirCard}
          aoIniciarArrasto={aoIniciarArrasto}
          aoConcluir={aoConcluirCard}
          podeEditar={poderes.editar}
        />
      );
    }
  }

  return (
    <section
      className={`abacato-coluna${arrasto?.tipo === "coluna" && arrasto.id === coluna.id ? " abacato-coluna--fantasma" : ""}`}
      data-coluna={coluna.id}
    >
      <header
        className="abacato-coluna__cabecalho"
        onPointerDown={(e) => poderes.editar && aoIniciarArrasto?.(e, { tipo: "coluna", id: coluna.id })}
      >
        {coluna.capa && <span className="abacato-coluna__capa" style={{ background: coluna.capa }} />}

        {editandoNome ? (
          <input
            className="abacato-coluna__nome-campo"
            defaultValue={coluna.nome}
            autoFocus
            data-nao-arrasta
            onBlur={(e) => { setEditandoNome(false); aoRenomear(coluna.id, e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
              if (e.key === "Escape") setEditandoNome(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="abacato-coluna__nome"
            onClick={() => poderes.editar && setEditandoNome(true)}
            title={poderes.editar ? "clique para renomear" : undefined}
          >
            {coluna.nome}
            <span className="abacato-coluna__conta">{coluna.cards.length}</span>
          </button>
        )}

        {poderes.editar && (
          <div className="abacato-menu">
            <button type="button" className="abacato-icone" onClick={() => setMenu((m) => !m)} aria-label="opções da coluna">⋯</button>
            {menu && (
              <>
                <div className="abacato-menu__fundo" onClick={() => setMenu(false)} />
                <div className="abacato-menu__caixa" role="menu">
                  <div className="abacato-menu__titulo">Cor do topo</div>
                  <div className="abacato-menu__cores">
                    {["", "#22C55E", "#2362D3", "#F97316", "#EF4444", "#A855F7", "#6B7280"].map((c) => (
                      <button
                        key={c || "nenhuma"}
                        type="button"
                        className={`abacato-bolinha${coluna.capa === (c || null) ? " abacato-bolinha--ativa" : ""}`}
                        style={c ? { background: c } : undefined}
                        title={c ? "usar esta cor" : "sem cor"}
                        onClick={() => { aoMudarCapa(coluna.id, c || null); setMenu(false); }}
                      >{c ? "" : "∅"}</button>
                    ))}
                  </div>
                  <button type="button" className="abacato-menu__item" onClick={() => { setMenu(false); setEscrevendo(true); }}>
                    Adicionar card
                  </button>
                  <button
                    type="button"
                    className="abacato-menu__item abacato-menu__item--perigo"
                    onClick={() => {
                      setMenu(false);
                      // O número no aviso não é enfeite: arquivar uma coluna leva os cards
                      // dela junto, e quem está clicando raramente lembra quantos são.
                      const quantos = coluna.cards.length;
                      const aviso = quantos
                        ? `Arquivar "${coluna.nome}" e os ${quantos} card(s) dentro dela?`
                        : `Arquivar a coluna "${coluna.nome}"?`;
                      if (window.confirm(aviso)) aoArquivar(coluna.id);
                    }}
                  >
                    Arquivar coluna
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      <div className="abacato-coluna__cards">
        {lista}
        <div ref={fim} />

        {escrevendo && (
          <div className="abacato-novo-card" data-nao-arrasta>
            <textarea
              ref={campo}
              className="abacato-novo-card__campo"
              placeholder="O que precisa ser feito?"
              value={texto}
              rows={2}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(true); }
                if (e.key === "Escape") { setTexto(""); setEscrevendo(false); }
              }}
            />
            <div className="abacato-novo-card__acoes">
              <button type="button" className="abacato-botao abacato-botao--pequeno" onClick={() => enviar(false)}>
                Adicionar
              </button>
              <button type="button" className="abacato-icone" onClick={() => { setTexto(""); setEscrevendo(false); }} aria-label="cancelar">✕</button>
              <span className="abacato-dica">Enter adiciona · Shift+Enter quebra linha</span>
            </div>
          </div>
        )}
      </div>

      {poderes.criar && !escrevendo && (
        <button type="button" className="abacato-coluna__adicionar" onClick={() => setEscrevendo(true)}>
          + Adicionar card
        </button>
      )}
    </section>
  );
}
