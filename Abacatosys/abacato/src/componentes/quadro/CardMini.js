"use client";

import { Card, Usuario } from "@/dominio/Quadro.js";

/** Uma data como quem fala: "hoje", "ontem", "12 de set". O ano só aparece quando não é este —
 *  escrever 2026 em tudo gasta espaço para repetir o que já se sabe. */
export function dataCurta(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  const hoje = new Date();
  const soDia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((soDia(d) - soDia(hoje)) / 86400000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  const mes = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return d.getFullYear() === hoje.getFullYear()
    ? `${d.getDate()} ${mes}`
    : `${d.getDate()} ${mes} ${d.getFullYear()}`;
}

const ROTULO_DO_PRAZO = {
  atrasado: "atrasado",
  hoje: "vence hoje",
  proximo: "vence em breve",
  "no-prazo": "no prazo",
  concluido: "concluído",
};

/**
 * O card como ele aparece na coluna.
 *
 * O que ele mostra é escolhido: um card na coluna serve para RECONHECER a tarefa de relance,
 * não para lê-la. Descrição, links e checklists viram sinais pequenos; quem quer o conteúdo
 * abre o card. Repetir aqui o que está no painel faria a coluna virar um paredão de texto em
 * que nada se destaca.
 */
export default function CardMini({ dados, aoAbrir, aoIniciarArrasto, arrastando }) {
  const card = dados instanceof Card ? dados : new Card(dados);
  const prazo = card.estadoDoPrazo();
  const progresso = card.progressoDasChecklists;

  const classes = [
    "abacato-card",
    arrastando ? "abacato-card--fantasma" : "",
    card.capa ? "abacato-card--com-capa" : "",
    card.concluido ? "abacato-card--concluido" : "",
  ].filter(Boolean).join(" ");

  return (
    <article
      className={classes}
      data-card={card.id}
      onPointerDown={(e) => aoIniciarArrasto?.(e, { tipo: "card", id: card.id, deColuna: card.colunaId })}
      onClick={() => aoAbrir?.(card.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aoAbrir?.(card.id); } }}
      aria-label={`${card.titulo}${card.fimEm ? `, ${ROTULO_DO_PRAZO[prazo] || ""} ${dataCurta(card.fimEm)}` : ""}`}
    >
      {card.capa && <div className="abacato-card__capa" style={{ background: card.capa }} />}

      {card.etiquetas.length > 0 && (
        <div className="abacato-card__etiquetas">
          {card.etiquetas.map((e) => (
            // A cor sozinha não informa quem não distingue cores, e não informa ninguém que não
            // decorou a legenda. O nome fica no `title` e no rótulo acessível.
            <span
              key={e.id}
              className="abacato-card__etiqueta"
              style={{ background: e.cor }}
              title={e.nome || "sem nome"}
              aria-label={e.nome || "etiqueta sem nome"}
            />
          ))}
        </div>
      )}

      <div className="abacato-card__titulo">
        {card.concluido && <span className="abacato-sinal--pronto" title="concluído">✓ </span>}
        {card.titulo}
      </div>

      <div className="abacato-card__sinais">
        {card.fimEm && (
          <span className={`abacato-prazo abacato-prazo--${prazo}`} title={ROTULO_DO_PRAZO[prazo]}>
            🕑 {dataCurta(card.fimEm)}
          </span>
        )}
        {progresso && (
          <span
            className={`abacato-sinal${progresso.feitos === progresso.total ? " abacato-sinal--pronto" : ""}`}
            title="itens de checklist"
          >
            ☑ {progresso.feitos}/{progresso.total}
          </span>
        )}
        {card.descricao && <span className="abacato-sinal" title="tem descrição">≡</span>}
        {card.links.length > 0 && <span className="abacato-sinal" title="tem links">🔗 {card.links.length}</span>}
        {card.origem === "recorrencia" && <span className="abacato-sinal" title="tarefa que se repete">↻</span>}
        {card.origem === "trello" && <span className="abacato-sinal" title="veio do Trello">⇤</span>}

        {card.responsaveis.length > 0 && (
          <span className="abacato-card__pessoas">
            {card.responsaveis.map((r) => {
              const u = r instanceof Usuario ? r : new Usuario(r);
              return (
                <span key={u.id} className="abacato-avatar" title={u.nome || u.email}>{u.iniciais}</span>
              );
            })}
          </span>
        )}
      </div>
    </article>
  );
}
