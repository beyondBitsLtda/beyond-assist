"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Usuario, posicaoAoMover } from "@/dominio/Quadro.js";
import { CORES } from "@/dominio/cores.js";
import { criar, mudar, definir, remover } from "@/lib/api.js";
import { dataCurta } from "./CardMini.js";
import { regraEmPalavras } from "@/dominio/recorrencia.js";
import EscolherDestino from "./EscolherDestino.js";
import { useReordenar } from "./useReordenar.js";

/**
 * A prancheta de checklists.
 *
 * Mora fora do componente, num módulo, porque ela precisa sobreviver a fechar um card e abrir
 * outro — que é o único uso que o copiar-e-colar tem. Num `useState` ela morreria junto com o
 * painel, exatamente no meio da operação.
 */
let prancheta = null;

/** `datetime-local` só aceita "AAAA-MM-DDTHH:MM", e em hora LOCAL. Jogar um ISO com Z nele faz
 *  o campo aparecer vazio sem reclamar de nada — e a data parece ter sumido. */
function paraCampoDeData(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * O caminho de volta: o que o campo devolve → uma data com FUSO.
 *
 * Esta função existe por causa de um defeito de três horas que não dava erro nenhum.
 *
 * O `datetime-local` devolve "2026-09-21T17:00", sem fuso. Quem interpreta essa string é quem
 * a recebe — e o servidor é um Worker da Cloudflare, que roda em UTC. Um prazo marcado para as
 * 17h aqui virava 17h UTC, ou seja, 14h no relógio de quem marcou. O card voltava da gravação
 * com uma hora diferente da que foi digitada, e nada na tela explicava por quê.
 *
 * `new Date(valor)` no NAVEGADOR lê a string no fuso de quem está digitando, que é o certo, e
 * `toISOString()` a fecha num instante absoluto que nenhum servidor reinterpreta.
 */
function doCampoParaISO(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Os botões da faixa "Adicionar", na ordem em que aparecem. */
const JANELAS = [
  ["etiquetas", "Etiquetas", "◧"],
  ["membros", "Membros", "◔"],
  ["datas", "Datas", "◷"],
  ["checklist", "Checklist", "☑"],
  ["repetir", "Repetir", "↻"],
  ["link", "Link", "↗"],
  ["capa", "Capa", "▬"],
];
const TITULO_DA_JANELA = Object.fromEntries(JANELAS.map(([k, t]) => [k, t]));
/** O estado do prazo em português de gente — "proximo" e "no-prazo" são nomes de código. */
const PRAZO_EM_PALAVRAS = {
  atrasado: "atrasado", hoje: "vence hoje", proximo: "próximo", "no-prazo": "no prazo",
  "sem-prazo": "sem prazo", concluido: "concluído",
};
const LARGURA_DA_JANELA = 320;

/**
 * O card aberto, num modal no centro da tela.
 *
 * O desenho segue o do Trello, e a regra é uma só: O CORPO MOSTRA O QUE O CARD TEM, E NADA
 * MAIS. Antes, cada card aberto desenhava todas as etiquetas do quadro, todos os membros, a
 * configuração inteira de recorrência e a paleta de capas — mesmo num card de uma linha, que
 * não usava nada disso. Agora essas opções moram na faixa "Adicionar": cada botão abre uma
 * janelinha, e o corpo só ganha a etiqueta, o membro ou o prazo quando o card passa a tê-los.
 *
 * Mover, copiar e arquivar saíram do rodapé para o `⋯` do cabeçalho: são ações sobre o card
 * inteiro, raras, e três botões grandes no pé de todo card aberto competiam com o conteúdo.
 */
export default function PainelDoCard({ card: dados, quadro, poderes, aoFechar, aoMudar, aoRecarregar }) {
  const card = dados instanceof Card ? dados : new Card(dados);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [descricao, setDescricao] = useState(card.descricao || "");
  const [editandoDescricao, setEditandoDescricao] = useState(false);
  const [recado, setRecado] = useState("");
  // Qual janelinha está aberta, e onde: { tipo, x, y } em coordenadas da tela.
  const [janela, setJanela] = useState(null);
  const [acoes, setAcoes] = useState(false);
  // "mover" | "copiar" | null — qual diálogo de destino está aberto.
  const [destino, setDestino] = useState(null);

  useEffect(() => { setDescricao(card.descricao || ""); }, [card.id, card.descricao]);

  useEffect(() => {
    const tecla = (e) => {
      // Escape fecha a camada de cima primeiro: a janelinha, depois o menu, e só então o card.
      // Dentro de um campo ele serve para desistir daquele campo, e fechar o card inteiro
      // apagaria o que estava sendo escrito.
      if (e.key !== "Escape") return;
      const dentroDeCampo = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
      if (dentroDeCampo) return;
      if (janela) setJanela(null);
      else if (acoes) setAcoes(false);
      else aoFechar();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoFechar, janela, acoes]);

  /** Toda chamada ao servidor passa por aqui: mostra que está salvando, guarda o erro e
   *  recarrega o quadro. Espalhar esse trio por trinta botões é como um deles fica sem. */
  const agir = useCallback(async (oQueFazer, { recarregar = true } = {}) => {
    setSalvando(true);
    setErro("");
    try {
      const resultado = await oQueFazer();
      if (recarregar) await aoRecarregar();
      return resultado;
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }, [aoRecarregar]);

  /** Abre a janelinha logo abaixo do botão que a pediu, sem sair da tela pela direita. */
  function abrirJanela(tipo, evento) {
    if (janela?.tipo === tipo) { setJanela(null); return; }
    const r = evento.currentTarget.getBoundingClientRect();
    const x = Math.max(12, Math.min(r.left, window.innerWidth - LARGURA_DA_JANELA - 12));
    setJanela({ tipo, x, y: r.bottom + 6 });
  }

  async function concluir(marcando) {
    const r = await agir(() => mudar(`/api/cards/${card.id}`, { concluido: marcando }));
    // Concluir um card que se repete faz nascer o próximo. Dizer QUANDO ele vence é o que fecha
    // o ciclo na cabeça de quem clicou — sem isso, o card novo aparece no quadro do nada.
    if (r?.proxima) setRecado(`Pronto. O próximo já está no quadro, para ${dataCurta(r.proxima.fim_em)}.`);
  }

  const colunaAtual = quadro.colunas.find((c) => c.id === card.colunaId);
  const podeEditar = poderes.editar;
  const membrosDoCard = quadro.membros.filter((m) => card.temResponsavel(m.id));
  const temAlgoNoResumo = card.etiquetas.length || membrosDoCard.length || card.fimEm || card.inicioEm || card.recorrenciaRegra;

  return (
    <div className="abacato-painel abacato-painel--centro" role="dialog" aria-modal="true" aria-label={card.titulo}>
      <div className="abacato-painel__fundo" onClick={aoFechar} />

      <div className="abacato-painel__caixa abacato-cartao-aberto">
        {card.capa && <div className="abacato-cartao-aberto__capa" style={{ background: card.capa }} />}

        <header className="abacato-painel__cabecalho">
          {/* O círculo de concluído mora ao lado do título, como no Trello: é a pergunta mais
              frequente sobre um card, e ela não deveria estar enterrada no meio das datas. */}
          <button
            type="button"
            className={`abacato-concluido${card.concluido ? " abacato-concluido--feito" : ""}`}
            disabled={!podeEditar}
            aria-pressed={card.concluido}
            aria-label={card.concluido ? "marcar como não concluído" : "marcar como concluído"}
            title={card.concluido ? "Concluído — clique para reabrir" : "Marcar como concluído"}
            onClick={() => concluir(!card.concluido)}
          >✓</button>

          <input
            className="abacato-painel__titulo"
            defaultValue={card.titulo}
            key={card.id}
            disabled={!podeEditar}
            onBlur={(e) => {
              const t = e.target.value.trim();
              if (t && t !== card.titulo) agir(() => mudar(`/api/cards/${card.id}`, { titulo: t }));
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
          />

          {(poderes.editar || poderes.criar || poderes.apagar) && (
            <div className="abacato-menu">
              <button type="button" className="abacato-icone" aria-label="ações do card" onClick={() => setAcoes((a) => !a)}>⋯</button>
              {acoes && (
                <>
                  <div className="abacato-menu__fundo" onClick={() => setAcoes(false)} />
                  <div className="abacato-menu__caixa abacato-menu__caixa--direita" role="menu">
                    {poderes.editar && (
                      <button type="button" className="abacato-menu__item" onClick={() => { setAcoes(false); setDestino("mover"); }}>
                        → Mover para…
                      </button>
                    )}
                    {poderes.criar && (
                      <button type="button" className="abacato-menu__item" onClick={() => { setAcoes(false); setDestino("copiar"); }}>
                        ⎘ Copiar para…
                      </button>
                    )}
                    {poderes.apagar && (
                      <button
                        type="button"
                        className="abacato-menu__item abacato-menu__item--perigo"
                        onClick={async () => {
                          setAcoes(false);
                          if (!window.confirm(`Arquivar "${card.titulo}"? Ele sai do quadro, mas continua guardado.`)) return;
                          await agir(() => remover(`/api/cards/${card.id}`));
                          aoFechar();
                        }}
                      >
                        Arquivar card
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <button type="button" className="abacato-icone" onClick={aoFechar} aria-label="fechar">✕</button>
        </header>

        <div className="abacato-painel__migalha">
          na coluna
          {podeEditar && quadro.colunas.length > 1 ? (
            <select
              className="abacato-selecao"
              value={card.colunaId}
              onChange={(e) => agir(() => mudar(`/api/cards/${card.id}`, { mover: { colunaId: e.target.value, indice: 0 } }))}
              aria-label="mover para outra coluna"
            >
              {quadro.colunas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          ) : (
            <strong>{colunaAtual?.nome || "—"}</strong>
          )}
          {card.concluido && <span className="abacato-prazo abacato-prazo--concluido">concluído</span>}
          <span className="abacato-painel__estado">{salvando ? "salvando…" : "tudo salvo"}</span>
        </div>

        {erro && <div className="abacato-campo__erro abacato-cartao-aberto__recado">⚠ {erro}</div>}
        {recado && <p className="abacato-recado abacato-cartao-aberto__recado">↻ {recado}</p>}

        <div className="abacato-painel__corpo" onScroll={() => janela && setJanela(null)}>
          {podeEditar && (
            <div className="abacato-cartao-aberto__adicionar" role="toolbar" aria-label="adicionar ao card">
              {JANELAS.map(([tipo, rotulo, icone]) => (
                <button
                  key={tipo}
                  type="button"
                  className={`abacato-chip${janela?.tipo === tipo ? " abacato-chip--ativo" : ""}`}
                  aria-expanded={janela?.tipo === tipo}
                  onClick={(e) => abrirJanela(tipo, e)}
                >
                  <span aria-hidden="true">{icone}</span> {rotulo}
                </button>
              ))}
            </div>
          )}

          {/* ------------------------------------------------ o que o card tem, e só isso */}
          {temAlgoNoResumo ? (
            <div className="abacato-cartao-aberto__resumo">
              {card.etiquetas.length > 0 && (
                <div className="abacato-resumo">
                  <span className="abacato-resumo__rotulo">Etiquetas</span>
                  <div className="abacato-resumo__valor">
                    {card.etiquetas.map((e) => (
                      <button key={e.id} type="button" className="abacato-etiqueta-pilula" style={{ background: e.cor }}
                        disabled={!podeEditar} onClick={(ev) => abrirJanela("etiquetas", ev)}>
                        {e.nome || " "}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {membrosDoCard.length > 0 && (
                <div className="abacato-resumo">
                  <span className="abacato-resumo__rotulo">Membros</span>
                  <div className="abacato-resumo__valor">
                    {membrosDoCard.map((m) => {
                      const u = new Usuario(m);
                      return (
                        <button key={m.id} type="button" className="abacato-avatar abacato-avatar--medio"
                          title={u.nome || u.email} disabled={!podeEditar} onClick={(ev) => abrirJanela("membros", ev)}>
                          {u.iniciais}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {(card.fimEm || card.inicioEm) && (
                <div className="abacato-resumo">
                  <span className="abacato-resumo__rotulo">{card.fimEm ? "Entrega" : "Início"}</span>
                  <div className="abacato-resumo__valor">
                    <button type="button" disabled={!podeEditar} onClick={(ev) => abrirJanela("datas", ev)}
                      className={`abacato-prazo abacato-prazo--botao abacato-prazo--${card.estadoDoPrazo()}`}>
                      {card.inicioEm && card.fimEm ? `${dataCurta(card.inicioEm)} → ` : ""}
                      {dataCurta(card.fimEm || card.inicioEm)}
                      {card.fimEm && ` · ${PRAZO_EM_PALAVRAS[card.estadoDoPrazo()]}`}
                    </button>
                  </div>
                </div>
              )}
              {card.recorrenciaRegra && (
                <div className="abacato-resumo">
                  <span className="abacato-resumo__rotulo">Repete</span>
                  <div className="abacato-resumo__valor">
                    <button type="button" className="abacato-chip" disabled={!podeEditar} onClick={(ev) => abrirJanela("repetir", ev)}>
                      ↻ {regraEmPalavras(card.recorrenciaRegra)}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* ---------------------------------------------------------- descrição */}
          <section className="abacato-secao">
            <h3 className="abacato-secao__titulo"><span aria-hidden="true">≡</span> Descrição</h3>
            {editandoDescricao || descricao ? (
              <textarea
                className="abacato-campo__entrada abacato-campo__entrada--alta"
                value={descricao}
                disabled={!podeEditar}
                autoFocus={editandoDescricao && !descricao}
                placeholder="O contexto que você vai querer daqui a três meses."
                onChange={(e) => setDescricao(e.target.value)}
                onFocus={() => setEditandoDescricao(true)}
                onBlur={() => {
                  setEditandoDescricao(false);
                  if (descricao !== (card.descricao || "")) {
                    agir(() => mudar(`/api/cards/${card.id}`, { descricao }));
                  }
                }}
              />
            ) : (
              <button type="button" className="abacato-vazio-clicavel" onClick={() => setEditandoDescricao(true)} disabled={!podeEditar}>
                Escrever uma descrição…
              </button>
            )}
          </section>

          {/* ---------------------------------------------------------- checklists */}
          {card.checklists.map((cl) => (
            <ChecklistNoPainel
              key={cl.id}
              checklist={cl}
              podeEditar={podeEditar}
              agir={agir}
              aoCopiar={() => { prancheta = { id: cl.id, titulo: cl.titulo, itens: cl.total }; aoMudar?.(); }}
            />
          ))}

          {/* ---------------------------------------------------------- links */}
          {card.links.length > 0 && (
            <section className="abacato-secao">
              <h3 className="abacato-secao__titulo"><span aria-hidden="true">↗</span> Links</h3>
              {card.links.map((l) => (
                <div key={l.id} className="abacato-link">
                  {/* `noreferrer` junto do `noopener`: o primeiro impede a página aberta de mexer
                      nesta pela `window.opener`; o segundo evita mandar o endereço do quadro,
                      que pode ter o id do card, para um site de fora. */}
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="abacato-link__url">
                    {l.titulo || l.url}
                  </a>
                  {podeEditar && (
                    <button type="button" className="abacato-icone abacato-mostra-no-hover" aria-label="remover link"
                      onClick={() => agir(() => remover(`/api/links/${l.id}`))}>✕</button>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>

      {janela && (
        <>
          <div className="abacato-menu__fundo abacato-janelinha__fundo" onClick={() => setJanela(null)} />
          <div
            className="abacato-janelinha"
            role="dialog"
            aria-label={TITULO_DA_JANELA[janela.tipo]}
            style={{ left: janela.x, top: janela.y, width: LARGURA_DA_JANELA }}
          >
            <div className="abacato-janelinha__topo">
              <strong>{TITULO_DA_JANELA[janela.tipo]}</strong>
              <button type="button" className="abacato-icone" aria-label="fechar" onClick={() => setJanela(null)}>✕</button>
            </div>
            <ConteudoDaJanela
              tipo={janela.tipo}
              card={card}
              quadro={quadro}
              agir={agir}
              aoRecarregar={aoRecarregar}
              aoFechar={() => setJanela(null)}
            />
          </div>
        </>
      )}

      {destino && (
        <EscolherDestino
          titulo={destino === "mover" ? "Mover a tarefa" : "Copiar a tarefa"}
          rotuloAcao={destino === "mover" ? "Mover" : "Copiar"}
          quadroAtual={quadro?.id}
          colunaAtual={card.colunaId}
          aoFechar={() => setDestino(null)}
          aoConfirmar={async ({ colunaId }) => {
            const r = destino === "mover"
              ? await criar(`/api/cards/${card.id}/mover`, { colunaId })
              : await criar(`/api/cards/${card.id}/copiar`, { colunaId });

            // O que a travessia custou, dito em voz alta. Uma etiqueta recriada e um
            // responsável removido são mudanças de verdade, e sumir com elas faria a pessoa
            // descobrir por acaso, dias depois.
            const notas = [];
            if (r.etiquetasCriadas?.length) notas.push(`etiqueta(s) criada(s) lá: ${r.etiquetasCriadas.join(", ")}`);
            if (r.responsaveisRemovidos?.length) notas.push(`saiu dos responsáveis: ${r.responsaveisRemovidos.join(", ")}`);
            setRecado(
              (destino === "mover" ? "Movida." : "Copiada.") + (notas.length ? ` ${notas.join(" · ")}` : "")
            );

            setDestino(null);
            await aoRecarregar?.();
            // Mover para outro quadro tira o card DESTE quadro: o painel aberto passaria a
            // mostrar uma tarefa que não está mais aqui.
            if (destino === "mover" && r.mudouDeQuadro) aoFechar();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ as janelinhas */

/** O miolo de cada janelinha da faixa "Adicionar". Um componente só, com um caso por botão:
 *  são todas pequenas, e espalhá-las em sete arquivos custaria mais para achar que para ler. */
function ConteudoDaJanela({ tipo, card, quadro, agir, aoRecarregar, aoFechar }) {
  if (tipo === "etiquetas") {
    return (
      <div className="abacato-janelinha__corpo">
        <div className="abacato-janelinha__lista">
          {quadro.etiquetas.length === 0 && <span className="abacato-dica">nenhuma etiqueta neste quadro ainda</span>}
          {quadro.etiquetas.map((e) => {
            const marcada = card.temEtiqueta(e.id);
            return (
              <button
                key={e.id}
                type="button"
                className={`abacato-opcao${marcada ? " abacato-opcao--marcada" : ""}`}
                onClick={() => {
                  const atuais = card.etiquetas.map((x) => x.id);
                  const novas = marcada ? atuais.filter((x) => x !== e.id) : [...atuais, e.id];
                  agir(() => definir(`/api/cards/${card.id}/etiquetas`, { etiquetas: novas }));
                }}
              >
                <span className="abacato-opcao__marca" aria-hidden="true">{marcada ? "✓" : ""}</span>
                <span className="abacato-etiqueta-pilula abacato-etiqueta-pilula--larga" style={{ background: e.cor }}>
                  {e.nome || " "}
                </span>
              </button>
            );
          })}
        </div>
        <NovaEtiqueta quadroId={quadro.id} aoCriar={aoRecarregar} />
      </div>
    );
  }

  if (tipo === "membros") {
    return (
      <div className="abacato-janelinha__corpo">
        <div className="abacato-janelinha__lista">
          {quadro.membros.map((m) => {
            const u = new Usuario(m);
            const marcado = card.temResponsavel(m.id);
            return (
              <button
                key={m.id}
                type="button"
                className={`abacato-opcao${marcado ? " abacato-opcao--marcada" : ""}`}
                onClick={() => {
                  const atuais = card.responsaveis.map((x) => x.id);
                  const novos = marcado ? atuais.filter((x) => x !== m.id) : [...atuais, m.id];
                  agir(() => definir(`/api/cards/${card.id}/responsaveis`, { responsaveis: novos }));
                }}
              >
                <span className="abacato-opcao__marca" aria-hidden="true">{marcado ? "✓" : ""}</span>
                <span className="abacato-avatar">{u.iniciais}</span>
                <span className="abacato-opcao__texto">{u.nome || u.email}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (tipo === "datas") {
    return (
      <div className="abacato-janelinha__corpo">
        <label className="abacato-campo">
          <span className="abacato-campo__rotulo">Início</span>
          <input
            type="datetime-local"
            className="abacato-campo__entrada"
            defaultValue={paraCampoDeData(card.inicioEm)}
            key={`i-${card.id}-${card.inicioEm}`}
            onChange={(e) => agir(() => mudar(`/api/cards/${card.id}`, { inicioEm: doCampoParaISO(e.target.value) }))}
          />
        </label>
        <label className="abacato-campo">
          <span className="abacato-campo__rotulo">Entrega</span>
          <input
            type="datetime-local"
            className="abacato-campo__entrada"
            defaultValue={paraCampoDeData(card.fimEm)}
            key={`f-${card.id}-${card.fimEm}`}
            onChange={(e) => agir(() => mudar(`/api/cards/${card.id}`, { fimEm: doCampoParaISO(e.target.value) }))}
          />
        </label>
        {(card.inicioEm || card.fimEm) && (
          <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
            onClick={async () => { await agir(() => mudar(`/api/cards/${card.id}`, { inicioEm: null, fimEm: null })); aoFechar(); }}>
            Tirar as datas
          </button>
        )}
      </div>
    );
  }

  if (tipo === "checklist") {
    return (
      <div className="abacato-janelinha__corpo">
        <CampoRapido
          dica="Nome da checklist"
          valorInicial="Checklist"
          aoEnviar={async (t) => { await agir(() => criar(`/api/cards/${card.id}/checklists`, { titulo: t })); aoFechar(); }}
          aoCancelar={aoFechar}
        />
        {prancheta && (
          <button
            type="button"
            className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
            title={`colar "${prancheta.titulo}" com ${prancheta.itens} item(ns), tudo desmarcado`}
            onClick={async () => { await agir(() => criar(`/api/cards/${card.id}/checklists`, { copiarDe: prancheta.id })); aoFechar(); }}
          >
            ⎘ Colar "{prancheta.titulo}"
          </button>
        )}
      </div>
    );
  }

  if (tipo === "link") {
    return (
      <div className="abacato-janelinha__corpo">
        <CampoRapido
          dica="https://…"
          aoEnviar={async (t) => { await agir(() => criar(`/api/cards/${card.id}/links`, { url: t })); aoFechar(); }}
          aoCancelar={aoFechar}
        />
      </div>
    );
  }

  if (tipo === "capa") {
    return (
      <div className="abacato-janelinha__corpo">
        <div className="abacato-menu__cores">
          <button type="button" className={`abacato-bolinha${!card.capa ? " abacato-bolinha--ativa" : ""}`}
            title="sem capa" onClick={() => agir(() => mudar(`/api/cards/${card.id}`, { capa: null }))}>∅</button>
          {CORES.map(({ cor, nome }) => (
            <button
              key={cor}
              type="button"
              className={`abacato-bolinha${card.capa === cor ? " abacato-bolinha--ativa" : ""}`}
              style={{ background: cor }}
              title={nome}
              aria-label={`capa ${nome}`}
              onClick={() => agir(() => mudar(`/api/cards/${card.id}`, { capa: cor }))}
            />
          ))}
        </div>
      </div>
    );
  }

  if (tipo === "repetir") {
    // A regra vive no PRÓPRIO card, e não numa lista à parte. Foi o que faltava: havia um
    // cadastro de tarefas recorrentes por coluna, e ninguém o encontrava — porque o lugar onde
    // se pensa "isto se repete toda semana" é o card, não um menu.
    return (
      <div className="abacato-janelinha__corpo abacato-repetir">
        <label className="abacato-concluir">
          <input
            type="checkbox"
            checked={Boolean(card.recorrenciaRegra)}
            onChange={(e) => agir(() => mudar(`/api/cards/${card.id}`, {
              recorrenciaRegra: e.target.checked ? "semanal:1" : null,
            }))}
          />
          Esta tarefa se repete
        </label>

        {card.recorrenciaRegra && (
          <>
            <div className="abacato-abas">
              {[["diaria", "Todo dia"], ["semanal:1", "Toda semana"], ["mensal:1", "Todo mês"]].map(([valor, rotulo]) => {
                const ativa = card.recorrenciaRegra.split(":")[0] === valor.split(":")[0];
                return (
                  <button key={valor} type="button"
                    className={`abacato-aba${ativa ? " abacato-aba--ativa" : ""}`}
                    onClick={() => agir(() => mudar(`/api/cards/${card.id}`, { recorrenciaRegra: valor }))}>
                    {rotulo}
                  </button>
                );
              })}
            </div>

            {card.recorrenciaRegra.startsWith("semanal") && (
              <div className="abacato-dias">
                {[[1, "seg"], [2, "ter"], [3, "qua"], [4, "qui"], [5, "sex"], [6, "sáb"], [7, "dom"]].map(([n, curto]) => {
                  const dias = (card.recorrenciaRegra.split(":")[1] || "").split(",").filter(Boolean).map(Number);
                  const ativo = dias.includes(n);
                  return (
                    <button key={n} type="button" aria-pressed={ativo}
                      className={`abacato-dia${ativo ? " abacato-dia--ativo" : ""}`}
                      onClick={() => {
                        const novos = ativo ? dias.filter((d) => d !== n) : [...dias, n];
                        // Sem nenhum dia, a regra nunca dispararia — e uma tarefa que se diz
                        // recorrente e nunca aparece é pior que nenhuma.
                        if (!novos.length) return;
                        agir(() => mudar(`/api/cards/${card.id}`, {
                          recorrenciaRegra: `semanal:${novos.sort((a, b) => a - b).join(",")}`,
                        }));
                      }}>{curto}</button>
                  );
                })}
              </div>
            )}

            {card.recorrenciaRegra.startsWith("mensal") && (
              <label className="abacato-campo">
                <span className="abacato-campo__rotulo">Dia do mês</span>
                <input type="number" min={1} max={31} className="abacato-campo__entrada"
                  defaultValue={card.recorrenciaRegra.split(":")[1] || 1}
                  key={card.recorrenciaRegra}
                  onBlur={(e) => {
                    const dia = Math.max(1, Math.min(31, Number(e.target.value) || 1));
                    agir(() => mudar(`/api/cards/${card.id}`, { recorrenciaRegra: `mensal:${dia}` }));
                  }} />
              </label>
            )}

            <p className="abacato-resumo-da-regra">
              Repete <strong>{regraEmPalavras(card.recorrenciaRegra)}</strong>. Ao marcar como
              concluído, o próximo nasce sozinho com a data recalculada — e este fica no quadro,
              feito, como histórico.
            </p>
          </>
        )}
      </div>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ peças menores */

/** Um campo que aparece, recebe uma linha e some. Enter envia, Escape desiste. */
function CampoRapido({ dica, aoEnviar, aoCancelar, multiplo = false, valorInicial = "" }) {
  const [texto, setTexto] = useState(valorInicial);
  const Campo = multiplo ? "textarea" : "input";
  return (
    <div className="abacato-rapido">
      <Campo
        className="abacato-campo__entrada"
        placeholder={dica}
        value={texto}
        autoFocus
        onFocus={(e) => { if (valorInicial) e.target.select(); }}
        rows={multiplo ? 3 : undefined}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (!multiplo || !e.shiftKey)) {
            e.preventDefault();
            if (texto.trim()) aoEnviar(texto.trim());
            setTexto("");
          }
          if (e.key === "Escape") aoCancelar();
        }}
      />
      <button type="button" className="abacato-botao abacato-botao--pequeno"
        onClick={() => { if (texto.trim()) { aoEnviar(texto.trim()); setTexto(""); } }}>OK</button>
      <button type="button" className="abacato-icone" onClick={aoCancelar} aria-label="cancelar">✕</button>
    </div>
  );
}

/**
 * Uma checklist no card aberto.
 *
 * Três coisas que antes não havia:
 *  - o NOME da checklist e o texto de cada ITEM são renomeáveis com um clique;
 *  - os itens se REORDENAM pela alça ⋮⋮, com mouse ou dedo;
 *  - o texto do item deixou de ser o <label> da caixinha. Antes, clicar no texto marcava o
 *    item — e não havia onde clicar para editar. Agora a caixinha marca, e o texto edita.
 */
function ChecklistNoPainel({ checklist, podeEditar, agir, aoCopiar }) {
  const [adicionando, setAdicionando] = useState(false);
  const [copiada, setCopiada] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const [editandoItem, setEditandoItem] = useState(null);
  const lista = useRef(null);

  // A ordem que a TELA mostra. Anda sozinha na hora da solta — esperar a volta do banco faria
  // o item pular de volta ao lugar antigo por um instante — e se realinha com o servidor
  // sempre que as posições de lá mudarem.
  const assinatura = checklist.itens.map((i) => `${i.id}:${i.posicao}`).join("|");
  const [ordem, setOrdem] = useState(() => checklist.itens.map((i) => i.id));
  useEffect(() => { setOrdem(checklist.itens.map((i) => i.id)); }, [assinatura]); // eslint-disable-line react-hooks/exhaustive-deps

  const aoSoltar = useCallback((id, para) => {
    const persistida = checklist.itens; // em ordem de posição, como veio do servidor
    const de = persistida.findIndex((i) => i.id === id);
    const posicao = posicaoAoMover(persistida.map((i) => i.posicao), de, para);
    if (posicao == null) return;
    const sem = persistida.map((i) => i.id).filter((x) => x !== id);
    sem.splice(para, 0, id);
    setOrdem(sem);
    agir(() => mudar(`/api/itens/${id}`, { posicao }));
  }, [checklist.itens, agir]);

  const { segurar, emMao } = useReordenar({ lista, aoSoltar });

  const porId = new Map(checklist.itens.map((i) => [i.id, i]));
  let exibidos = ordem.map((id) => porId.get(id)).filter(Boolean);
  // Enquanto se arrasta, o item na mão já aparece onde vai cair.
  if (emMao) {
    const naMao = porId.get(emMao.id);
    exibidos = exibidos.filter((i) => i.id !== emMao.id);
    if (naMao) exibidos.splice(emMao.indice, 0, naMao);
  }

  const pct = Math.round(checklist.progresso * 100);

  return (
    <section className="abacato-secao abacato-checklist">
      <div className="abacato-checklist__cabecalho">
        <span className="abacato-secao__icone" aria-hidden="true">☑</span>
        {renomeando ? (
          <input
            className="abacato-campo__entrada abacato-checklist__campo-titulo"
            defaultValue={checklist.titulo}
            autoFocus
            maxLength={120}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              setRenomeando(false);
              const t = e.target.value.trim();
              if (t && t !== checklist.titulo) agir(() => mudar(`/api/checklists/${checklist.id}`, { titulo: t }));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
              if (e.key === "Escape") { e.target.value = checklist.titulo; setRenomeando(false); }
            }}
          />
        ) : (
          <button
            type="button"
            className="abacato-checklist__titulo"
            disabled={!podeEditar}
            title={podeEditar ? "clique para renomear" : undefined}
            onClick={() => setRenomeando(true)}
          >
            {checklist.titulo}
          </button>
        )}
        <span className="abacato-checklist__conta">{checklist.feitos}/{checklist.total}</span>
        {podeEditar && (
          <>
            <button type="button" className="abacato-icone" title="copiar esta checklist"
              onClick={() => { aoCopiar(); setCopiada(true); setTimeout(() => setCopiada(false), 1600); }}>
              {copiada ? "✓" : "⎘"}
            </button>
            <button type="button" className="abacato-icone" title="apagar checklist"
              onClick={() => {
                if (window.confirm(`Apagar a checklist "${checklist.titulo}" e os ${checklist.total} item(ns) dela?`)) {
                  agir(() => remover(`/api/checklists/${checklist.id}`));
                }
              }}>🗑</button>
          </>
        )}
      </div>

      <div className="abacato-barra-progresso" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>

      <div className="abacato-checklist__itens" ref={lista}>
        {exibidos.map((i) => (
          <div
            key={i.id}
            data-item={i.id}
            className={`abacato-item${i.feito ? " abacato-item--feito" : ""}${emMao?.id === i.id ? " abacato-item--na-mao" : ""}`}
          >
            {podeEditar && exibidos.length > 1 && (
              <span
                className="abacato-item__alca"
                role="button"
                tabIndex={-1}
                aria-label={`arrastar "${i.texto}"`}
                title="arraste para reordenar"
                onPointerDown={(e) => segurar(e, i.id)}
              >⋮⋮</span>
            )}
            <input
              type="checkbox"
              checked={i.feito}
              disabled={!podeEditar}
              aria-label={i.texto}
              onChange={(e) => agir(() => mudar(`/api/itens/${i.id}`, { feito: e.target.checked }))}
            />
            {editandoItem === i.id ? (
              <input
                className="abacato-campo__entrada abacato-item__campo"
                defaultValue={i.texto}
                autoFocus
                onBlur={(e) => {
                  setEditandoItem(null);
                  const t = e.target.value.trim();
                  if (t && t !== i.texto) agir(() => mudar(`/api/itens/${i.id}`, { texto: t }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.target.blur();
                  if (e.key === "Escape") { e.target.value = i.texto; setEditandoItem(null); }
                }}
              />
            ) : (
              <button
                type="button"
                className="abacato-item__texto"
                disabled={!podeEditar}
                title={podeEditar ? "clique para editar" : undefined}
                onClick={() => setEditandoItem(i.id)}
              >
                {i.texto}
              </button>
            )}
            {podeEditar && editandoItem !== i.id && (
              <button type="button" className="abacato-icone abacato-mostra-no-hover" aria-label="remover item"
                onClick={() => agir(() => remover(`/api/itens/${i.id}`))}>✕</button>
            )}
          </div>
        ))}
      </div>

      {podeEditar && (adicionando ? (
        <CampoRapido
          multiplo
          dica="Um item por linha — pode colar uma lista inteira"
          aoEnviar={(t) => agir(() => criar(`/api/checklists/${checklist.id}/itens`, { texto: t }))}
          aoCancelar={() => setAdicionando(false)}
        />
      ) : (
        <button type="button" className="abacato-checklist__adicionar" onClick={() => setAdicionando(true)}>
          + Adicionar item
        </button>
      ))}
    </section>
  );
}

function NovaEtiqueta({ quadroId, aoCriar }) {
  const [abrindo, setAbrindo] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES[0].cor);

  if (!abrindo) {
    return (
      <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno" onClick={() => setAbrindo(true)}>
        + Criar etiqueta
      </button>
    );
  }

  return (
    <div className="abacato-nova-etiqueta">
      <input className="abacato-campo__entrada" placeholder="Para que serve esta cor?" value={nome} autoFocus
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") setAbrindo(false); }} />
      <div className="abacato-menu__cores">
        {CORES.map((c) => (
          <button key={c.cor} type="button" className={`abacato-bolinha${cor === c.cor ? " abacato-bolinha--ativa" : ""}`}
            style={{ background: c.cor }} title={c.nome} aria-label={c.nome} onClick={() => setCor(c.cor)} />
        ))}
      </div>
      <div className="abacato-rapido">
        <button type="button" className="abacato-botao abacato-botao--pequeno"
          onClick={async () => {
            await criar(`/api/quadros/${quadroId}/etiquetas`, { nome: nome.trim(), cor });
            setNome(""); setAbrindo(false); await aoCriar();
          }}>Criar</button>
        <button type="button" className="abacato-icone" onClick={() => setAbrindo(false)} aria-label="cancelar">✕</button>
      </div>
    </div>
  );
}
