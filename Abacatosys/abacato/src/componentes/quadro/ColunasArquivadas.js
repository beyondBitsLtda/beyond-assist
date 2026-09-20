"use client";

import { useCallback, useEffect, useState } from "react";
import { obter, mudar } from "@/lib/api.js";

/**
 * As colunas que saíram de vista, e o caminho de volta.
 *
 * Isto existe por causa de uma falha concreta, e vale registrar qual: na migração do Trello,
 * 55 cards vieram vivos dentro de listas que tinham sido arquivadas lá. Eles estavam no banco,
 * inteiros — e não havia uma única tela no sistema capaz de mostrá-los. Arquivar uma coluna
 * era, na prática, apagá-la sem dizer isso a ninguém.
 *
 * A contagem de cards ao lado do nome não é enfeite: "Ideias 2024" sozinho não ajuda a decidir
 * nada, e "Ideias 2024 · 12 cards a fazer" ajuda.
 */
export default function ColunasArquivadas({ quadroId, poderes, aoFechar, aoMudar }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [trabalhando, setTrabalhando] = useState(null);

  const carregar = useCallback(async () => {
    try {
      setLista((await obter(`/api/quadros/${quadroId}/colunas?arquivadas=1`)).colunas);
    } catch (e) { setErro(e.message); }
  }, [quadroId]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  async function restaurar(coluna) {
    setTrabalhando(coluna.id);
    setErro("");
    try {
      await mudar(`/api/colunas/${coluna.id}`, { arquivada: false });
      await carregar();
      aoMudar?.();
    } catch (e) {
      setErro(e.message);
    } finally {
      setTrabalhando(null);
    }
  }

  return (
    <div className="abacato-painel" role="dialog" aria-modal="true" aria-label="Colunas arquivadas">
      <div className="abacato-painel__fundo" onClick={aoFechar} />
      <div className="abacato-painel__caixa abacato-painel__caixa--estreita">
        <header className="abacato-painel__cabecalho">
          <h2 className="abacato-painel__titulo abacato-painel__titulo--fixo">Colunas arquivadas</h2>
          <button type="button" className="abacato-icone" onClick={aoFechar} aria-label="fechar">✕</button>
        </header>

        <p className="abacato-dica abacato-dica--bloco">
          Elas saíram do quadro, mas nada foi apagado. Os cards continuam guardados e voltam
          junto com a coluna — inclusive os que ainda estão por fazer.
        </p>

        {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}

        <div className="abacato-painel__corpo">
          {lista === null && <span className="abacato-dica">carregando…</span>}

          {lista?.length === 0 && (
            <div className="abacato-vazio">
              <p className="abacato-vazio__titulo">Nenhuma coluna arquivada</p>
              <p>Tudo que este quadro tem está à vista.</p>
            </div>
          )}

          {lista?.map((c) => (
            <div key={c.id} className="abacato-recorrencia">
              <div>
                <strong>{c.nome}</strong>
                <div className="abacato-dica">
                  {c.vivos > 0
                    ? `${c.vivos} card(s) ainda por fazer`
                    : "nenhum card por fazer"}
                  {c.arquivados > 0 && ` · ${c.arquivados} arquivado(s)`}
                </div>
              </div>
              {poderes.editar && (
                <div className="abacato-recorrencia__acoes">
                  <button
                    type="button"
                    className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
                    disabled={trabalhando === c.id}
                    onClick={() => restaurar(c)}
                  >
                    {trabalhando === c.id ? "…" : "↩ Restaurar"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
