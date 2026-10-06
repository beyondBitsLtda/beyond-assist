"use client";

import { useEffect, useState } from "react";
import { obter, mudar } from "@/lib/api.js";
import { formatarDia } from "@/dominio/datas.js";
import { METAS_DIARIAS } from "@/dominio/pontos.js";
import { Barra } from "@/componentes/Pecas.js";
import Lembretes from "@/componentes/Lembretes.js";
import Conquistas from "@/componentes/Conquistas.js";

/** Intensidade do quadradinho do mapa, relativa à meta do dia. */
function nivelDoDia(pontos, meta) {
  if (!pontos) return 0;
  if (pontos < meta / 2) return 1;
  if (pontos < meta) return 2;
  return 3;
}

export default function Progresso() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    obter("/api/progresso").then(setDados).catch((e) => setErro(e.message));
  }, []);

  async function mudarMeta(meta) {
    setSalvando(true);
    setErro("");
    try {
      await mudar("/api/perfil", { metaDiaria: meta });
      setDados((d) => ({ ...d, metaDiaria: meta }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (!dados) {
    return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Carregando o histórico…</div>;
  }

  const { nivel, ofensiva } = dados;

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>Progresso</h1>
          <p>{dados.diasEstudados} dia(s) de estudo registrados.</p>
        </div>
      </div>

      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginBottom: 12 }}>{erro}</div>}

      <div className="pf-grade">
        <div className="pf-cartao pf-ofensiva">
          <div className="pf-estat__rotulo">Ofensiva atual</div>
          <div className="pf-estat__valor"><span className="pf-ofensiva__fogo" aria-hidden="true">🔥</span>{ofensiva.atual}</div>
          <p className="pf-estat__nota">Recorde: {ofensiva.recorde} dia(s)</p>
        </div>
        <div className="pf-cartao">
          <div className="pf-estat__rotulo">Nível</div>
          <div className="pf-estat__valor">{nivel.nivel}</div>
          <Barra valor={nivel.noNivel} total={nivel.proximo} rotulo="Progresso do nível" />
          <p className="pf-estat__nota">{nivel.proximo - nivel.noNivel} pts para o próximo</p>
        </div>
        <div className="pf-cartao">
          <div className="pf-estat__rotulo">Pontos no total</div>
          <div className="pf-estat__valor">{dados.total}</div>
        </div>
        <div className="pf-cartao">
          <div className="pf-estat__rotulo">Assuntos concluídos</div>
          <div className="pf-estat__valor">{dados.contagem.card || 0}</div>
          <p className="pf-estat__nota">
            {dados.contagem.item || 0} tarefa(s) · {dados.contagem.quiz || 0} quiz(zes) · {dados.contagem.exercicio || 0} exercício(s) ·{" "}
            {(dados.contagem.projeto_semanal || 0) + (dados.contagem.projeto_mensal || 0)} projeto(s)
          </p>
        </div>
      </div>

      <Conquistas lista={dados.conquistas} pontos={dados.pontosDeConquistas} />

      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Últimas 16 semanas</h2>
        <div className="pf-cartao">
          <div className="pf-mapa">
            <div className="pf-mapa__grade" role="img" aria-label="Mapa dos dias estudados">
              {dados.mapa.map((d) => (
                <span
                  key={d.dia}
                  className={`pf-mapa__dia ${d.futuro ? "pf-mapa__dia--futuro" : `pf-mapa__dia--${nivelDoDia(d.pontos, dados.metaDiaria)}`}`}
                  title={d.futuro ? "" : `${formatarDia(d.dia, { comSemana: true })}: ${d.pontos} pts`}
                />
              ))}
            </div>
          </div>
          <div className="pf-mapa__legenda">
            menos
            <span className="pf-mapa__dia" />
            <span className="pf-mapa__dia pf-mapa__dia--1" />
            <span className="pf-mapa__dia pf-mapa__dia--2" />
            <span className="pf-mapa__dia pf-mapa__dia--3" />
            meta batida
          </div>
        </div>
      </section>

      <div className="pf-grade pf-grade--2 pf-secao">
        <section className="pf-cartao">
          <h2 className="pf-secao__titulo">Meta diária</h2>
          <p className="pf-estat__nota" style={{ marginTop: 0, marginBottom: 12 }}>
            Quantos pontos por dia contam como meta batida. Cada tarefa vale 10, cada assunto concluído vale mais 30.
          </p>
          <div className="pf-dias" role="group" aria-label="Meta diária">
            {METAS_DIARIAS.map((m) => (
              <button key={m} type="button" className="pf-dia" aria-pressed={dados.metaDiaria === m} disabled={salvando} onClick={() => mudarMeta(m)}>
                {m}
              </button>
            ))}
          </div>
        </section>

        <Lembretes />

        <section className="pf-cartao pf-grade--largo-todo">
          <h2 className="pf-secao__titulo">Atividade recente</h2>
          {dados.recentes.length === 0 ? (
            <p className="pf-estat__nota">Nada ainda. Marque uma tarefa na tela Hoje.</p>
          ) : (
            <ul className="pf-lista">
              {dados.recentes.map((e, i) => (
                <li key={i}>
                  <span className="pf-lista__texto">
                    {e.texto || e.nome}
                    <small>{e.nome}{e.assunto ? ` · ${e.assunto}` : ""} · {formatarDia(e.dia)}</small>
                  </span>
                  <span className="pf-lista__pontos">+{e.pontos}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
