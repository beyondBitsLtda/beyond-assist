"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Usuario } from "@/dominio/Quadro.js";
import { CORES } from "@/dominio/cores.js";
import { criar, mudar, definir, remover } from "@/lib/api.js";
import { dataCurta } from "./CardMini.js";
import { regraEmPalavras } from "@/dominio/recorrencia.js";
import EscolherDestino from "./EscolherDestino.js";

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

export default function PainelDoCard({ card: dados, quadro, poderes, aoFechar, aoMudar, aoRecarregar }) {
  const card = dados instanceof Card ? dados : new Card(dados);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [descricao, setDescricao] = useState(card.descricao || "");
  const [editandoDescricao, setEditandoDescricao] = useState(false);
  const [novaChecklist, setNovaChecklist] = useState(false);
  const [novoLink, setNovoLink] = useState(false);
  const [recado, setRecado] = useState("");
  // "mover" | "copiar" | null — qual diálogo de destino está aberto.
  const [destino, setDestino] = useState(null);
  const caixa = useRef(null);

  useEffect(() => { setDescricao(card.descricao || ""); }, [card.id, card.descricao]);

  useEffect(() => {
    const tecla = (e) => {
      // Escape fecha, mas não enquanto se digita: dentro de um campo ele serve para desistir
      // daquele campo, e fechar o painel inteiro apagaria o que estava sendo escrito.
      if (e.key !== "Escape") return;
      const dentroDeCampo = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
      if (!dentroDeCampo) aoFechar();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  /** Toda chamada ao servidor passa por aqui: mostra que está salvando, guarda o erro e
   *  recarrega o quadro. Espalhar esse trio por trinta botões é como um deles fica sem. */
  async function agir(oQueFazer, { recarregar = true } = {}) {
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
  }

  const colunaAtual = quadro.colunas.find((c) => c.id === card.colunaId);
  const podeEditar = poderes.editar;

  return (
    <div className="abacato-painel" role="dialog" aria-modal="true" aria-label={card.titulo}>
      <div className="abacato-painel__fundo" onClick={aoFechar} />

      <div className="abacato-painel__caixa" ref={caixa}>
        <header className="abacato-painel__cabecalho">
          {card.capa && <div className="abacato-painel__capa" style={{ background: card.capa }} />}
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
          <button type="button" className="abacato-icone" onClick={aoFechar} aria-label="fechar">✕</button>
        </header>

        <div className="abacato-painel__migalha">
          na coluna <strong>{colunaAtual?.nome || "—"}</strong>
          {podeEditar && quadro.colunas.length > 1 && (
            <select
              className="abacato-selecao"
              value={card.colunaId}
              onChange={(e) => agir(() => mudar(`/api/cards/${card.id}`, { mover: { colunaId: e.target.value, indice: 0 } }))}
              aria-label="mover para outra coluna"
            >
              {quadro.colunas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
        </div>

        {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}

        <div className="abacato-painel__corpo">
          {/* ---------------------------------------------------------- etiquetas */}
          <section className="abacato-bloco">
            <h3 className="abacato-bloco__titulo">Etiquetas</h3>
            <div className="abacato-etiquetas-lista">
              {quadro.etiquetas.length === 0 && <span className="abacato-dica">nenhuma etiqueta neste quadro ainda</span>}
              {quadro.etiquetas.map((e) => {
                const marcada = card.temEtiqueta(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    disabled={!podeEditar}
                    className={`abacato-etiqueta-botao${marcada ? " abacato-etiqueta-botao--marcada" : ""}`}
                    style={{ background: e.cor }}
                    onClick={() => {
                      const atuais = card.etiquetas.map((x) => x.id);
                      const novas = marcada ? atuais.filter((x) => x !== e.id) : [...atuais, e.id];
                      agir(() => definir(`/api/cards/${card.id}/etiquetas`, { etiquetas: novas }));
                    }}
                  >
                    {marcada ? "✓ " : ""}{e.nome || "sem nome"}
                  </button>
                );
              })}
            </div>
            {podeEditar && <NovaEtiqueta quadroId={quadro.id} aoCriar={aoRecarregar} />}
          </section>

          {/* ---------------------------------------------------------- pessoas */}
          <section className="abacato-bloco">
            <h3 className="abacato-bloco__titulo">Responsáveis</h3>
            <div className="abacato-etiquetas-lista">
              {quadro.membros.map((m) => {
                const u = new Usuario(m);
                const marcado = card.temResponsavel(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!podeEditar}
                    className={`abacato-pessoa-botao${marcado ? " abacato-pessoa-botao--marcada" : ""}`}
                    onClick={() => {
                      const atuais = card.responsaveis.map((x) => x.id);
                      const novos = marcado ? atuais.filter((x) => x !== m.id) : [...atuais, m.id];
                      agir(() => definir(`/api/cards/${card.id}/responsaveis`, { responsaveis: novos }));
                    }}
                  >
                    <span className="abacato-avatar">{u.iniciais}</span>
                    {u.nome || u.email}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ---------------------------------------------------------- datas */}
          <section className="abacato-bloco">
            <h3 className="abacato-bloco__titulo">Datas</h3>
            <div className="abacato-datas">
              <label className="abacato-campo">
                <span className="abacato-campo__rotulo">Início</span>
                <input
                  type="datetime-local"
                  className="abacato-campo__entrada"
                  disabled={!podeEditar}
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
                  disabled={!podeEditar}
                  defaultValue={paraCampoDeData(card.fimEm)}
                  key={`f-${card.id}-${card.fimEm}`}
                  onChange={(e) => agir(() => mudar(`/api/cards/${card.id}`, { fimEm: doCampoParaISO(e.target.value) }))}
                />
              </label>
            </div>
            {card.fimEm && (
              <p className={`abacato-prazo abacato-prazo--${card.estadoDoPrazo()}`}>
                {dataCurta(card.fimEm)} · {card.estadoDoPrazo().replace("-", " ")}
              </p>
            )}

            {/* Marcar concluido fica junto das DATAS, e nao no rodape com arquivar. Sao coisas
                diferentes: concluir diz que o trabalho acabou, arquivar diz que o card sai da
                frente. Um card concluido continua no quadro, a vista de quem quer conferir. */}
            <label className="abacato-concluir">
              <input
                type="checkbox"
                checked={card.concluido}
                disabled={!podeEditar}
                onChange={async (e) => {
                  const marcando = e.target.checked;
                  const r = await agir(() => mudar(`/api/cards/${card.id}`, { concluido: marcando }));
                  // Concluir um card que se repete faz nascer o próximo. Dizer QUANDO ele vence
                  // é o que fecha o ciclo na cabeça de quem clicou — sem isso, o card novo
                  // aparece no quadro do nada.
                  if (r?.proxima) {
                    setRecado(`Pronto. O próximo já está no quadro, para ${dataCurta(r.proxima.fim_em)}.`);
                  }
                }}
              />
              Trabalho concluído
              {card.concluidoPelasChecklists && !card.concluido && (
                <span className="abacato-dica">as checklists já estão todas completas</span>
              )}
            </label>

            {recado && <p className="abacato-recado">↻ {recado}</p>}

            {/* ---- repetir ----
                A regra vive no PRÓPRIO card, e não numa lista à parte. Foi o que faltava: havia
                um cadastro de tarefas recorrentes por coluna, e ninguém o encontrava — porque o
                lugar onde se pensa "isto se repete toda semana" é o card, não um menu. */}
            {podeEditar && (
              <div className="abacato-repetir">
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
                                // Sem nenhum dia, a regra nunca dispararia — e uma tarefa que
                                // se diz recorrente e nunca aparece é pior que nenhuma.
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
                      Repete <strong>{regraEmPalavras(card.recorrenciaRegra)}</strong>. Ao marcar
                      como concluído, o próximo nasce sozinho com a data recalculada — e este
                      fica no quadro, feito, como histórico.
                    </p>
                  </>
                )}
              </div>
            )}
          </section>

          {/* ---------------------------------------------------------- descrição */}
          <section className="abacato-bloco">
            <h3 className="abacato-bloco__titulo">Descrição</h3>
            {editandoDescricao || descricao ? (
              <textarea
                className="abacato-campo__entrada abacato-campo__entrada--alta"
                value={descricao}
                disabled={!podeEditar}
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
          <section className="abacato-bloco">
            <div className="abacato-bloco__linha">
              <h3 className="abacato-bloco__titulo">Checklists</h3>
              {podeEditar && (
                <div className="abacato-bloco__acoes">
                  <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno" onClick={() => setNovaChecklist(true)}>
                    + Nova
                  </button>
                  {prancheta && (
                    <button
                      type="button"
                      className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
                      title={`colar "${prancheta.titulo}" com ${prancheta.itens} item(ns), tudo desmarcado`}
                      onClick={() => agir(() => criar(`/api/cards/${card.id}/checklists`, { copiarDe: prancheta.id }))}
                    >
                      ⎘ Colar "{prancheta.titulo}"
                    </button>
                  )}
                </div>
              )}
            </div>

            {novaChecklist && (
              <CampoRapido
                dica="Nome da checklist"
                aoEnviar={async (t) => { await agir(() => criar(`/api/cards/${card.id}/checklists`, { titulo: t })); setNovaChecklist(false); }}
                aoCancelar={() => setNovaChecklist(false)}
              />
            )}

            {card.checklists.length === 0 && !novaChecklist && <span className="abacato-dica">nenhuma ainda</span>}

            {card.checklists.map((cl) => (
              <ChecklistNoPainel
                key={cl.id}
                checklist={cl}
                podeEditar={podeEditar}
                agir={agir}
                aoCopiar={() => { prancheta = { id: cl.id, titulo: cl.titulo, itens: cl.total }; aoMudar?.(); }}
              />
            ))}
          </section>

          {/* ---------------------------------------------------------- links */}
          <section className="abacato-bloco">
            <div className="abacato-bloco__linha">
              <h3 className="abacato-bloco__titulo">Links</h3>
              {podeEditar && (
                <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno" onClick={() => setNovoLink(true)}>
                  + Link
                </button>
              )}
            </div>

            {novoLink && (
              <CampoRapido
                dica="https://…"
                aoEnviar={async (t) => { await agir(() => criar(`/api/cards/${card.id}/links`, { url: t })); setNovoLink(false); }}
                aoCancelar={() => setNovoLink(false)}
              />
            )}

            {card.links.map((l) => (
              <div key={l.id} className="abacato-link">
                {/* `noreferrer` junto do `noopener`: o primeiro impede a página aberta de mexer
                    nesta pela `window.opener`; o segundo evita mandar o endereço do quadro,
                    que pode ter o id do card, para um site de fora. */}
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="abacato-link__url">
                  {l.titulo || l.url}
                </a>
                {podeEditar && (
                  <button type="button" className="abacato-icone" aria-label="remover link"
                    onClick={() => agir(() => remover(`/api/links/${l.id}`))}>✕</button>
                )}
              </div>
            ))}
            {card.links.length === 0 && !novoLink && <span className="abacato-dica">nenhum ainda</span>}
          </section>

          {/* ---------------------------------------------------------- capa e ações */}
          {podeEditar && (
            <section className="abacato-bloco">
              <h3 className="abacato-bloco__titulo">Capa</h3>
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
            </section>
          )}
        </div>

        <footer className="abacato-painel__rodape">
          {poderes.editar && (
            <button type="button" className="abacato-botao abacato-botao--fantasma" disabled={salvando}
              onClick={() => setDestino("mover")}>
              → Mover
            </button>
          )}
          {poderes.criar && (
            <button type="button" className="abacato-botao abacato-botao--fantasma" disabled={salvando}
              onClick={() => setDestino("copiar")}>
              ⎘ Copiar para…
            </button>
          )}
          {poderes.apagar && (
            <button
              type="button"
              className="abacato-botao abacato-botao--perigo"
              disabled={salvando}
              onClick={async () => {
                if (!window.confirm(`Arquivar "${card.titulo}"? Ele sai do quadro, mas continua guardado.`)) return;
                await agir(() => remover(`/api/cards/${card.id}`));
                aoFechar();
              }}
            >
              Arquivar card
            </button>
          )}
          <span className="abacato-painel__estado">{salvando ? "salvando…" : "tudo salvo"}</span>
        </footer>
      </div>

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

/* ------------------------------------------------------------------ peças menores */

/** Um campo que aparece, recebe uma linha e some. Enter envia, Escape desiste. */
function CampoRapido({ dica, aoEnviar, aoCancelar, multiplo = false }) {
  const [texto, setTexto] = useState("");
  const Campo = multiplo ? "textarea" : "input";
  return (
    <div className="abacato-rapido">
      <Campo
        className="abacato-campo__entrada"
        placeholder={dica}
        value={texto}
        autoFocus
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

function ChecklistNoPainel({ checklist, podeEditar, agir, aoCopiar }) {
  const [adicionando, setAdicionando] = useState(false);
  const [copiada, setCopiada] = useState(false);
  const pct = Math.round(checklist.progresso * 100);

  return (
    <div className="abacato-checklist">
      <div className="abacato-checklist__cabecalho">
        <strong className="abacato-checklist__titulo">{checklist.titulo}</strong>
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

      {checklist.itens.map((i) => (
        <label key={i.id} className={`abacato-item${i.feito ? " abacato-item--feito" : ""}`}>
          <input
            type="checkbox"
            checked={i.feito}
            disabled={!podeEditar}
            onChange={(e) => agir(() => mudar(`/api/itens/${i.id}`, { feito: e.target.checked }))}
          />
          <span className="abacato-item__texto">{i.texto}</span>
          {podeEditar && (
            <button type="button" className="abacato-icone" aria-label="remover item"
              onClick={(e) => { e.preventDefault(); agir(() => remover(`/api/itens/${i.id}`)); }}>✕</button>
          )}
        </label>
      ))}

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
    </div>
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
