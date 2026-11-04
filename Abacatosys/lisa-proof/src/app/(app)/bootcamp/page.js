"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { obter, remover } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import Neuro from "@/componentes/Neuro.js";
import DesenhoDoJurado from "@/componentes/bootcamp/Jurados.js";

const SITUACAO = { preparando: "aguardando a 1ª rodada", "em-andamento": "em andamento", encerrado: "encerrado" };

/**
 * O Modo Bootcamp (04/11/2026): o reality show de programação do Proof. Aqui ficam os torneios em que a pessoa
 * joga (os que organizou e os que recebeu convite) e a apresentação dos 3 jurados.
 */
export default function Bootcamp() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();

  const carregar = useCallback(() => obter("/api/bootcamp").then(setDados).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(t) {
    if (!window.confirm(`Excluir o torneio "${t.nome}"? As rodadas e as entregas somem junto.`)) return;
    try {
      await remover(`/api/bootcamp/${t.id}`);
      avisar("Torneio excluído.");
      carregar();
    } catch (e) {
      avisar(`Não deu: ${e.message}`);
    }
  }

  return (
    <div className="bc-pagina">
      <div className="pf-cabecalho">
        <div>
          <h1>🏁 Bootcamp</h1>
          <p>Um reality show de programação num escritório de TI futurista: até 8 competidores, cada um na sua baia, contra pessoas do Proof e os personagens da Lisa. Três jurados lançam o desafio de cada rodada e avaliam o código, a arquitetura e as regras.</p>
        </div>
        <Link href="/bootcamp/create" className="pf-botao">＋ Novo torneio</Link>
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}

      {dados && (
        <section className="bc-jurados" aria-label="Os jurados">
          {dados.opcoes.jurados.map((j) => (
            <div key={j.id} className="pf-cartao bc-jurado">
              <DesenhoDoJurado id={j.id} tamanho={84} />
              <div>
                <strong>{j.emoji} {j.nome}</strong>
                <span className="bc-jurado__criterio">{j.criterio}</span>
                <p className="pf-estat__nota">{j.arquetipo[0].toUpperCase() + j.arquetipo.slice(1)}. Olha {j.foco}.</p>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Seus torneios</h2>
        {!dados && !erro && <p className="pf-estat__nota">Abrindo o escritório…</p>}
        {dados && !dados.torneios.length && (
          <div className="pf-cartao bc-vazio">
            <Neuro personagem="lisa" humor="feliz" tamanho={96} />
            <div>
              <strong>Nenhum torneio ainda.</strong>
              <p className="pf-estat__nota">Monte o primeiro: escolha o formato, o tempo e as linguagens, chame quem quiser do Proof e complete as vagas com os personagens da Lisa.</p>
              <Link href="/bootcamp/create" className="pf-botao">Montar um torneio</Link>
            </div>
          </div>
        )}
        <ul className="bc-torneios">
          {dados?.torneios.map((t) => (
            <li key={t.id} className="pf-cartao bc-torneio">
              <div className="bc-torneio__topo">
                <strong className="bc-torneio__nome">{t.nome}</strong>
                <span className={`pf-pilula${t.status === "em-andamento" ? " pf-pilula--verde" : ""}`}>{SITUACAO[t.status]}</span>
              </div>
              <p className="pf-estat__nota">
                {t.formatoNome} · rodada {t.rodadaAtual || 0} de {t.rodadasTotal} · {t.participantes} competidores ({t.humanos} {t.humanos === 1 ? "humano" : "humanos"}) · {t.tempoMin ? `${t.tempoMin} min por desafio` : "sem limite de tempo"}
                {t.souDono ? " · você organiza" : ""}
              </p>
              {t.campeao && <p className="bc-torneio__campeao">🏆 Campeão: {t.campeao.souEu ? "você!" : t.campeao.nome}</p>}
              {t.eu?.eliminado && !t.campeao && <p className="pf-estat__nota">Você saiu na rodada {t.eu.eliminadoNa}: dá para acompanhar até o fim.</p>}
              <div className="bc-torneio__acoes">
                <Link href={`/bootcamp/arena/${t.id}`} className="pf-botao pf-botao--pequeno">Entrar na arena</Link>
                <Link href={`/bootcamp/judges/${t.id}`} className="pf-botao pf-botao--sec pf-botao--pequeno">⚖️ Jurados</Link>
                {t.souDono && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => excluir(t)}>Excluir</button>}
              </div>
            </li>
          ))}
        </ul>
      </section>
      {Aviso}
    </div>
  );
}
