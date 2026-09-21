"use client";

import { useCallback, useEffect, useState } from "react";
import { obter } from "@/lib/api.js";

/**
 * Para onde vai: um quadro e uma coluna.
 *
 * Uma peça só para os três casos — mover card, copiar card e mover coluna — porque a pergunta
 * é a mesma. Três diálogos parecidos seriam três lugares para a lista de quadros divergir.
 *
 * `modo="quadro"` esconde o seletor de coluna: uma coluna que muda de quadro vai para o fim
 * dele, e não para dentro de outra coluna.
 *
 * O AVISO DA TRAVESSIA aparece antes do clique, e não depois. Mudar de quadro mexe em etiqueta
 * e em responsável, e descobrir isso quando já aconteceu é o jeito de a pessoa não confiar mais
 * na função.
 */
export default function EscolherDestino({
  titulo,
  rotuloAcao,
  quadroAtual,
  colunaAtual,
  modo = "coluna",
  aoConfirmar,
  aoFechar,
}) {
  const [quadros, setQuadros] = useState(null);
  const [quadroId, setQuadroId] = useState(quadroAtual || "");
  const [colunaId, setColunaId] = useState(colunaAtual || "");
  const [erro, setErro] = useState("");
  const [indo, setIndo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const d = await obter("/api/destinos");
      setQuadros(d.quadros || []);
      if (!d.quadros?.length) setErro("você não pode criar em nenhum quadro.");
    } catch (e) { setErro(e.message); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Trocar de quadro escolhe a primeira coluna dele. Deixar a escolha anterior apontaria para
  // uma coluna que não existe mais no quadro selecionado, e o erro só apareceria no clique.
  useEffect(() => {
    if (modo === "quadro" || !quadros) return;
    const q = quadros.find((x) => x.id === quadroId);
    if (!q) return;
    if (!q.colunas.some((c) => c.id === colunaId)) setColunaId(q.colunas[0]?.id || "");
  }, [quadroId, quadros, colunaId, modo]);

  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  const quadro = quadros?.find((q) => q.id === quadroId);
  const atravessa = quadroId && quadroAtual && quadroId !== quadroAtual;
  const semColuna = modo === "coluna" && !colunaId;

  async function confirmar() {
    if (indo || semColuna || !quadroId) return;
    setIndo(true);
    setErro("");
    try {
      await aoConfirmar({ quadroId, colunaId });
    } catch (e) {
      setErro(e.message);
      setIndo(false);
    }
  }

  return (
    <div className="abacato-painel" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="abacato-painel__fundo" onClick={aoFechar} />
      <div className="abacato-painel__caixa abacato-painel__caixa--estreita">
        <header className="abacato-painel__cabecalho">
          <h2 className="abacato-painel__titulo abacato-painel__titulo--fixo">{titulo}</h2>
          <button type="button" className="abacato-icone" onClick={aoFechar} aria-label="fechar">✕</button>
        </header>

        <div className="abacato-painel__corpo">
          {!quadros && <div className="abacato-vazio">carregando…</div>}

          {quadros && (
            <>
              <label className="abacato-campo">
                <span className="abacato-campo__rotulo">Quadro</span>
                <select className="abacato-campo__entrada" value={quadroId}
                  onChange={(e) => setQuadroId(e.target.value)}>
                  <option value="">escolha…</option>
                  {quadros.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.nome}{q.id === quadroAtual ? " (este)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {modo === "coluna" && (
                <label className="abacato-campo">
                  <span className="abacato-campo__rotulo">Coluna</span>
                  <select className="abacato-campo__entrada" value={colunaId}
                    disabled={!quadro} onChange={(e) => setColunaId(e.target.value)}>
                    {!quadro && <option value="">escolha um quadro antes</option>}
                    {quadro?.colunas.length === 0 && <option value="">este quadro não tem colunas</option>}
                    {quadro?.colunas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}{c.id === colunaAtual ? " (esta)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {atravessa && (
                <div className="abacato-aviso" style={{ margin: "4px 0 0" }}>
                  <strong>Vai para outro quadro.</strong> As etiquetas são recriadas lá (mesmo
                  nome e cor), e quem não participa daquele quadro sai da lista de responsáveis
                  — ninguém deve ficar com uma tarefa que não consegue abrir.
                </div>
              )}

              {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}
            </>
          )}
        </div>

        <footer className="abacato-painel__rodape">
          <button type="button" className="abacato-botao abacato-botao--fantasma" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="button" className="abacato-botao" onClick={confirmar}
            disabled={indo || !quadroId || semColuna}>
            {indo ? "…" : rotuloAcao}
          </button>
        </footer>
      </div>
    </div>
  );
}
