"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { obter, mudar } from "@/lib/api.js";

/**
 * Os cards que saíram do quadro, e o caminho de volta.
 *
 * "Excluir" um card — pela tela ou pela Lisa — sempre foi arquivar: some do quadro e continua no
 * banco. A tela dizia "dá para recuperar", mas não havia onde recuperar (pedido de 20/10/2026).
 * É a mesma falha que deu origem às Colunas arquivadas, agora do lado dos cards.
 *
 * Restaurar devolve o card à coluna de onde ele saiu, no mesmo lugar. Se essa coluna também
 * estiver arquivada, o card voltaria para um lugar invisível — então ele vai para o topo da
 * primeira coluna ativa, e a tela diz para onde foi.
 */
export default function CardsArquivados({ quadroId, poderes, aoFechar, aoMudar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [trabalhando, setTrabalhando] = useState(null);
  // Quantos arquivados o quadro tem ao todo (sem busca): decide se a busca é local ou no banco.
  const [totalDoQuadro, setTotalDoQuadro] = useState(null);

  const carregar = useCallback(async (termo = "") => {
    try {
      const d = await obter(`/api/quadros/${quadroId}/cards-arquivados${termo ? `?q=${encodeURIComponent(termo)}` : ""}`);
      setDados(d);
      if (!termo) setTotalDoQuadro(d.total);
    } catch (e) { setErro(e.message); }
  }, [quadroId]);

  useEffect(() => { carregar(); }, [carregar]);

  // Mais arquivados do que cabem numa leva: a busca vai ao banco (com uma pausa na digitação).
  const buscaNoBanco = totalDoQuadro != null && dados && totalDoQuadro > (dados.limite || Infinity);
  useEffect(() => {
    if (!buscaNoBanco) return;
    const t = setTimeout(() => carregar(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca, buscaNoBanco, carregar]);

  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = dados?.cards || [];
    if (!termo || buscaNoBanco) return lista; // no banco, a lista já veio filtrada
    return lista.filter((c) => `${c.titulo} ${c.descricao} ${c.coluna}`.toLowerCase().includes(termo));
  }, [dados, busca, buscaNoBanco]);

  async function restaurar(card) {
    setTrabalhando(card.id);
    setErro("");
    setAviso("");
    try {
      if (card.colunaArquivada) {
        const destino = dados.colunasAtivas[0];
        if (!destino) throw new Error("o quadro não tem nenhuma coluna ativa para receber o card — restaure uma coluna primeiro");
        await mudar(`/api/cards/${card.id}`, { arquivado: false, mover: { colunaId: destino.id, indice: 0 } });
        setAviso(`"${card.titulo}" voltou para ${destino.nome}: a coluna ${card.coluna} também está arquivada.`);
      } else {
        await mudar(`/api/cards/${card.id}`, { arquivado: false });
        setAviso(`"${card.titulo}" voltou para ${card.coluna}.`);
      }
      await carregar(buscaNoBanco ? busca.trim() : "");
      aoMudar?.();
    } catch (e) {
      setErro(e.message);
    } finally {
      setTrabalhando(null);
    }
  }

  const total = totalDoQuadro ?? 0;

  return (
    <div className="abacato-painel" role="dialog" aria-modal="true" aria-label="Cards arquivados">
      <div className="abacato-painel__fundo" onClick={aoFechar} />
      <div className="abacato-painel__caixa abacato-painel__caixa--estreita">
        <header className="abacato-painel__cabecalho">
          <h2 className="abacato-painel__titulo abacato-painel__titulo--fixo">Cards arquivados</h2>
          <button type="button" className="abacato-icone" onClick={aoFechar} aria-label="fechar">✕</button>
        </header>

        <p className="abacato-dica abacato-dica--bloco">
          Eles saíram do quadro, mas nada foi apagado: descrição, checklist, comentários e anexos
          voltam junto. Restaurar devolve o card à coluna de onde ele saiu.
        </p>

        {total > 8 && (
          <input
            className="abacato-campo__entrada"
            type="search"
            placeholder="procurar nos arquivados…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="procurar nos cards arquivados"
          />
        )}

        {aviso && <div className="abacato-dica abacato-dica--bloco" role="status">✓ {aviso}</div>}
        {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}

        <div className="abacato-painel__corpo">
          {dados === null && !erro && <span className="abacato-dica">carregando…</span>}

          {dados && total === 0 && (
            <div className="abacato-vazio">
              <p className="abacato-vazio__titulo">Nenhum card arquivado</p>
              <p>Tudo que este quadro tem está à vista.</p>
            </div>
          )}

          {dados && total > 0 && visiveis.length === 0 && (
            <span className="abacato-dica">Nenhum arquivado com “{busca}”.</span>
          )}

          {visiveis.map((c) => (
            <div key={c.id} className="abacato-recorrencia">
              <div>
                <strong>{c.titulo}</strong>
                <div className="abacato-dica">
                  em {c.coluna || "coluna sem nome"}
                  {c.colunaArquivada && " (coluna arquivada)"}
                  {c.fimEm && ` · prazo ${new Date(c.fimEm).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "")}`}
                  {c.concluido && " · concluído"}
                </div>
                {c.descricao && <div className="abacato-dica abacato-arquivado__descricao">{c.descricao}</div>}
              </div>
              {poderes.editar && (
                <div className="abacato-recorrencia__acoes">
                  <button
                    type="button"
                    className="abacato-botao abacato-botao--pequeno"
                    disabled={trabalhando === c.id}
                    onClick={() => restaurar(c)}
                  >
                    {trabalhando === c.id ? "…" : "↩ Restaurar"}
                  </button>
                </div>
              )}
            </div>
          ))}

          {dados && !busca.trim() && total > (dados.cards?.length || 0) && (
            <span className="abacato-dica">
              Mostrando os {dados.cards.length} mais recentes de {total}. Procure pelo título para achar os outros.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
