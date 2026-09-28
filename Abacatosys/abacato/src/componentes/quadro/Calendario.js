"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useArrastar } from "./useArrastar.js";
import {
  chaveDoDia, semanasDoMes, cardsPorDia, prazoNoDia, diaDaChave, NOMES_DOS_MESES, DIAS_DA_SEMANA,
} from "@/dominio/calendario.js";

/** Quantos cards cabem numa casa antes do "+N". Mais que isso e a grade vira uma lista. */
const CABEM_NA_CASA = 3;

const horaCurta = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * O quadro visto como calendário do mês (BEYOND-0003).
 *
 * Cada card aparece no dia da ENTREGA. Arrastar um card para outro dia muda a entrega e mantém
 * o horário (ver prazoNoDia); clicar abre o card, igual à vista de colunas. O arrastar é o
 * mesmo `useArrastar` do quadro — dedo com espera de 220ms, mouse na hora —, só com o alvo
 * trocado de "coluna e índice" para "dia".
 *
 * Tocar num dia abre a lista dele embaixo da grade. No telefone é o único jeito de ler: sete
 * casas em 390px não comportam título de card, e ali a casa mostra só quantos há.
 */
export default function Calendario({ quadro, poderes, aoAbrirCard, aoMudarPrazo, aoCriarNoDia }) {
  const hoje = chaveDoDia(new Date());
  const [mes, setMes] = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() }; });
  const [escolhido, setEscolhido] = useState(null);
  const [verSemData, setVerSemData] = useState(false);
  const raiz = useRef(null);

  const cards = quadro.todosOsCards();
  const { porDia, semData } = useMemo(() => cardsPorDia(cards), [cards]);
  const semanas = useMemo(() => semanasDoMes(mes.ano, mes.mes), [mes]);
  const porId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const alvoEm = useCallback((x, y) => {
    const casa = document.elementFromPoint(x, y)?.closest("[data-dia]");
    return casa ? { dia: casa.dataset.dia } : null;
  }, []);

  const aoSoltar = useCallback((item, alvo) => {
    const card = porId.get(item.id);
    if (!card || !alvo?.dia) return;
    if (card.fimEm && chaveDoDia(card.fimEm) === alvo.dia) return; // soltou no mesmo dia
    aoMudarPrazo(card.id, prazoNoDia(card.fimEm, alvo.dia));
  }, [porId, aoMudarPrazo]);

  const { iniciar, arrasto, alvo } = useArrastar({ refDoQuadro: raiz, alvoEm, aoSoltar });
  const naMao = arrasto ? porId.get(arrasto.id) : null;

  function andarMes(passo) {
    setMes(({ ano, mes: m }) => {
      const d = new Date(ano, m + passo, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
  }

  function irParaHoje() {
    const d = new Date();
    setMes({ ano: d.getFullYear(), mes: d.getMonth() });
    setEscolhido(hoje);
  }

  const doDiaEscolhido = escolhido ? porDia.get(escolhido) || [] : [];

  return (
    <div className="abacato-calendario" ref={raiz}>
      <div className="abacato-calendario__topo">
        <div className="abacato-calendario__navegar">
          <button type="button" className="abacato-icone" aria-label="mês anterior" onClick={() => andarMes(-1)}>‹</button>
          <h2 className="abacato-calendario__mes">{NOMES_DOS_MESES[mes.mes]} de {mes.ano}</h2>
          <button type="button" className="abacato-icone" aria-label="próximo mês" onClick={() => andarMes(1)}>›</button>
          <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno" onClick={irParaHoje}>Hoje</button>
        </div>
        {semData.length > 0 && (
          <button type="button" className="abacato-chip" aria-expanded={verSemData} onClick={() => setVerSemData((v) => !v)}>
            {semData.length} card(s) sem entrega {verSemData ? "▴" : "▾"}
          </button>
        )}
      </div>

      {/* Os cards sem entrega não têm casa na grade — e somem se ninguém mostrar. Ficam aqui,
          à mão, e um card daqui arrastado para um dia GANHA a entrega naquele dia. */}
      {verSemData && semData.length > 0 && (
        <div className="abacato-calendario__sem-data">
          {semData.map((c) => (
            <CardDoCalendario key={c.id} card={c} poderes={poderes} aoAbrir={aoAbrirCard} aoIniciarArrasto={iniciar}
              arrastando={arrasto?.id === c.id} />
          ))}
        </div>
      )}

      <div className="abacato-calendario__grade" role="grid" aria-label={`${NOMES_DOS_MESES[mes.mes]} de ${mes.ano}`}>
        {DIAS_DA_SEMANA.map((d) => <div key={d} className="abacato-calendario__semana" role="columnheader">{d}</div>)}
        {semanas.flat().map((casa) => {
          const doDia = porDia.get(casa.chave) || [];
          const classes = ["abacato-calendario__casa"];
          if (!casa.doMes) classes.push("abacato-calendario__casa--fora");
          if (casa.chave === hoje) classes.push("abacato-calendario__casa--hoje");
          if (casa.chave === escolhido) classes.push("abacato-calendario__casa--escolhida");
          if (arrasto && alvo?.dia === casa.chave) classes.push("abacato-calendario__casa--alvo");
          return (
            <div
              key={casa.chave}
              className={classes.join(" ")}
              data-dia={casa.chave}
              role="gridcell"
              aria-label={`${casa.dia} — ${doDia.length} card(s)`}
              onClick={() => setEscolhido(casa.chave === escolhido ? null : casa.chave)}
            >
              <span className="abacato-calendario__numero">{casa.dia}</span>
              {doDia.length > 0 && <span className="abacato-calendario__quantos">{doDia.length}</span>}
              <div className="abacato-calendario__cards">
                {doDia.slice(0, CABEM_NA_CASA).map((c) => (
                  <CardDoCalendario key={c.id} card={c} poderes={poderes} aoAbrir={aoAbrirCard} aoIniciarArrasto={iniciar}
                    arrastando={arrasto?.id === c.id} compacto />
                ))}
                {doDia.length > CABEM_NA_CASA && (
                  <span className="abacato-calendario__mais">+{doDia.length - CABEM_NA_CASA} mais</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {escolhido && (
        <section className="abacato-calendario__dia" aria-label="cards do dia escolhido">
          <h3 className="abacato-calendario__dia-titulo">
            {diaDaChave(escolhido).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            <button type="button" className="abacato-icone" aria-label="fechar o dia" onClick={() => setEscolhido(null)}>✕</button>
          </h3>
          {doDiaEscolhido.length === 0 && <p className="abacato-dica">Nada vence neste dia.</p>}
          {doDiaEscolhido.map((c) => (
            <CardDoCalendario key={c.id} card={c} poderes={poderes} aoAbrir={aoAbrirCard} aoIniciarArrasto={iniciar}
              arrastando={arrasto?.id === c.id} />
          ))}
          {poderes.criar && quadro.colunas.length > 0 && (
            <NovoNoDia colunas={quadro.colunas} aoCriar={(titulo, colunaId) => aoCriarNoDia(escolhido, titulo, colunaId)} />
          )}
        </section>
      )}

      {arrasto && naMao && (
        <div className="abacato-fantasma abacato-fantasma--calendario"
          style={{ left: arrasto.x - arrasto.dx, top: arrasto.y - arrasto.dy, width: arrasto.largura }}>
          <CardDoCalendario card={naMao} poderes={poderes} compacto />
        </div>
      )}
    </div>
  );
}

/** Um card no calendário: a faixa da cor do prazo, as etiquetas em pontinho e o título. */
function CardDoCalendario({ card, poderes, aoAbrir, aoIniciarArrasto, arrastando, compacto }) {
  const estado = card.estadoDoPrazo();
  return (
    <div
      className={`abacato-cal-card abacato-cal-card--${estado}${compacto ? " abacato-cal-card--compacto" : ""}${arrastando ? " abacato-cal-card--fantasma" : ""}${card.concluido ? " abacato-cal-card--feito" : ""}`}
      title={card.titulo}
      role="button"
      tabIndex={0}
      onPointerDown={(e) => { if (poderes.editar && aoIniciarArrasto) aoIniciarArrasto(e, { tipo: "card", id: card.id }); }}
      onClick={(e) => { e.stopPropagation(); aoAbrir?.(card.id); }}
      onKeyDown={(e) => { if (e.key === "Enter") aoAbrir?.(card.id); }}
    >
      {card.etiquetas.length > 0 && (
        <span className="abacato-cal-card__etiquetas" aria-hidden="true">
          {card.etiquetas.slice(0, 4).map((e) => <span key={e.id} style={{ background: e.cor }} />)}
        </span>
      )}
      <span className="abacato-cal-card__titulo">{card.titulo}</span>
      {!compacto && card.fimEm && <span className="abacato-cal-card__hora">{horaCurta(card.fimEm)}</span>}
    </div>
  );
}

/** Criar um card já com a entrega no dia escolhido. Nasce na coluna escolhida — a primeira,
 *  por padrão, que costuma ser "A fazer". */
function NovoNoDia({ colunas, aoCriar }) {
  const [titulo, setTitulo] = useState("");
  const [colunaId, setColunaId] = useState(colunas[0].id);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const t = titulo.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try { await aoCriar(t, colunaId); setTitulo(""); }
    finally { setEnviando(false); }
  }

  return (
    <form className="abacato-calendario__novo" onSubmit={enviar}>
      <input className="abacato-campo__entrada" placeholder="Novo card com entrega neste dia" value={titulo}
        onChange={(e) => setTitulo(e.target.value)} maxLength={300} />
      {colunas.length > 1 && (
        <select className="abacato-selecao" value={colunaId} onChange={(e) => setColunaId(e.target.value)} aria-label="coluna do card novo">
          {colunas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      )}
      <button className="abacato-botao abacato-botao--pequeno" type="submit" disabled={!titulo.trim() || enviando}>
        {enviando ? "Criando…" : "Criar"}
      </button>
    </form>
  );
}
