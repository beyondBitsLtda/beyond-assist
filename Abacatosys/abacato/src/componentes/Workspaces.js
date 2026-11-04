"use client";

import { useState } from "react";
import { criar, mudar, remover } from "@/lib/api.js";

/**
 * Workspaces na tela: o que a lista de quadros e a de documentos têm em comum.
 *
 * As duas listas usam os MESMOS workspaces (ver db/011-workspaces-documentos.sql): "Delp" nos
 * quadros é o mesmo "Delp" nos documentos. Por isso as seções, o formulário e o menu de mover
 * moram aqui, uma vez — duas cópias acabariam com a mesma pasta se comportando diferente
 * conforme a tela em que se está.
 */

/** Criar, renomear e apagar workspaces. `aoMudar` recarrega a lista de quem usa. */
export function useWorkspaces({ aoMudar, aoErro }) {
  const [novo, setNovo] = useState(false);
  const [renomeando, setRenomeando] = useState(null);
  const [menu, setMenu] = useState(null);

  async function criarWorkspace(nome) {
    try { await criar("/api/workspaces", { nome }); setNovo(false); await aoMudar(); }
    catch (e) { aoErro(e.message); }
  }

  async function renomear(ws, nome) {
    setRenomeando(null);
    if (!nome || nome === ws.nome) return;
    try { await mudar(`/api/workspaces/${ws.id}`, { nome }); await aoMudar(); }
    catch (e) { aoErro(e.message); }
  }

  async function apagar(ws) {
    setMenu(null);
    // O aviso diz o que NÃO se perde, e fala das DUAS listas: o workspace aparece nos quadros e
    // nos documentos, e apagá-lo daqui também o tira de lá.
    if (!window.confirm(
      `Apagar o workspace "${ws.nome}"?\n\nNada dentro dele é apagado: os quadros e os projetos de documentação voltam para "Sem workspace", inteiros. Ele some das duas listas, Quadros e Documentos.`
    )) return;
    try { await remover(`/api/workspaces/${ws.id}`); await aoMudar(); }
    catch (e) { aoErro(e.message); }
  }

  return { novo, setNovo, renomeando, setRenomeando, menu, setMenu, criarWorkspace, renomear, apagar };
}

/** O formulário de "+ Workspace". */
export function NovoWorkspace({ ws }) {
  if (!ws.novo) return null;
  return (
    <form
      className="abacato-criar-quadro"
      onSubmit={(e) => {
        e.preventDefault();
        const t = e.currentTarget.elements.nome.value.trim();
        if (t) ws.criarWorkspace(t);
      }}
    >
      <input
        name="nome"
        className="abacato-campo__entrada"
        placeholder="Nome do workspace — ex.: Delp, Pessoal, Clientes"
        maxLength={80}
        autoFocus
        onKeyDown={(e) => { if (e.key === "Escape") ws.setNovo(false); }}
      />
      <button className="abacato-botao" type="submit">Criar workspace</button>
      <button type="button" className="abacato-icone" aria-label="cancelar" onClick={() => ws.setNovo(false)}>✕</button>
    </form>
  );
}

/**
 * Os itens agrupados por workspace, e os soltos em "Sem workspace" no fim.
 *
 * `cartao(item)` desenha cada um — é da tela, que sabe o que é um quadro ou um projeto. O
 * "Sem workspace" vazio não aparece: quando tudo já está organizado, a seção só diria que não
 * há nada ali.
 */
export function SecoesPorWorkspace({ itens, workspaces, cartao, ws, rotuloAqui, aoCriarAqui, oQue }) {
  const soltos = itens.filter((i) => !i.workspace_id);
  return (
    <>
      {workspaces.map((w) => {
        const dele = itens.filter((i) => i.workspace_id === w.id);
        return (
          <section key={w.id} className="abacato-workspace">
            <header className="abacato-workspace__cabecalho">
              <span className="abacato-workspace__icone" aria-hidden="true">{(w.nome[0] || "?").toUpperCase()}</span>
              {ws.renomeando === w.id ? (
                <input
                  className="abacato-workspace__campo"
                  defaultValue={w.nome}
                  autoFocus
                  maxLength={80}
                  onBlur={(e) => ws.renomear(w, e.target.value.trim())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.target.blur();
                    if (e.key === "Escape") ws.setRenomeando(null);
                  }}
                />
              ) : (
                <button type="button" className="abacato-workspace__nome" title="clique para renomear"
                  onClick={() => ws.setRenomeando(w.id)}>
                  {w.nome}
                </button>
              )}
              <span className="abacato-workspace__conta">{dele.length}</span>

              <div className="abacato-workspace__acoes">
                {aoCriarAqui && (
                  <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
                    onClick={() => aoCriarAqui(w.id)}>
                    {rotuloAqui}
                  </button>
                )}
                <div className="abacato-menu">
                  <button type="button" className="abacato-icone" aria-label={`opções do workspace ${w.nome}`}
                    onClick={() => ws.setMenu(ws.menu === w.id ? null : w.id)}>⋯</button>
                  {ws.menu === w.id && (
                    <>
                      <div className="abacato-menu__fundo" onClick={() => ws.setMenu(null)} />
                      <div className="abacato-menu__caixa abacato-menu__caixa--direita" role="menu">
                        <button type="button" className="abacato-menu__item"
                          onClick={() => { ws.setMenu(null); ws.setRenomeando(w.id); }}>
                          Renomear
                        </button>
                        <button type="button" className="abacato-menu__item abacato-menu__item--perigo"
                          onClick={() => ws.apagar(w)}>
                          Apagar workspace
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </header>

            {dele.length ? (
              <div className="abacato-grade">{dele.map(cartao)}</div>
            ) : (
              <p className="abacato-workspace__vazio">
                Nenhum {oQue} aqui ainda. Crie um com <strong>{rotuloAqui}</strong>, ou traga um que já
                existe pelo <strong>⋯</strong> dele, em <strong>Mover para workspace</strong>.
              </p>
            )}
          </section>
        );
      })}

      {soltos.length > 0 && (
        <section className="abacato-workspace abacato-workspace--soltos">
          <header className="abacato-workspace__cabecalho">
            <span className="abacato-workspace__nome abacato-workspace__nome--fixo">Sem workspace</span>
            <span className="abacato-workspace__conta">{soltos.length}</span>
          </header>
          <div className="abacato-grade">{soltos.map(cartao)}</div>
        </section>
      )}
    </>
  );
}

/** O trecho "Mover para workspace" do menu ⋯ de um cartão. */
export function MoverParaWorkspace({ workspaces, atual, aoMover }) {
  if (!workspaces.length) return null;
  return (
    <>
      <div className="abacato-menu__titulo">Mover para workspace</div>
      {workspaces.map((w) => (
        <button key={w.id} type="button" className="abacato-menu__item"
          disabled={atual === w.id} onClick={() => aoMover(w.id)}>
          {atual === w.id ? "✓ " : ""}{w.nome}
        </button>
      ))}
      <button type="button" className="abacato-menu__item" disabled={!atual} onClick={() => aoMover(null)}>
        {!atual ? "✓ " : ""}Sem workspace
      </button>
    </>
  );
}
