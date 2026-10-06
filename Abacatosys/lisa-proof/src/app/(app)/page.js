"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { obter } from "@/lib/api.js";
import { formatarDia } from "@/dominio/datas.js";
import Assunto from "@/componentes/Assunto.js";
import { Barra, useAviso, textoDosPontos } from "@/componentes/Pecas.js";
import Neuro, { reagirAoResultado } from "@/componentes/Neuro.js";
import { NOTA_DE_APROVACAO } from "@/dominio/pratica.js";

/**
 * O que o Neuro diz na tela inicial. A ordem é a da urgência: ofensiva em risco vem antes de
 * tudo, porque é a única coisa que se perde de vez se o dia acabar.
 */
function falaDoNeuro(dados) {
  const { resumo, tarefas, pratica } = dados;
  const o = resumo.ofensiva;
  const pendentes = tarefas.filter((t) => t.situacao !== "feita").length;
  const quizPendente = pratica.some((p) => p.quiz?.status !== "concluido");

  if (dados.trilhas === 0) return { humor: "surpreso", fala: "Oi, eu sou o Neuro! Crie um quadro STUDY no Abacato e monte sua trilha comigo." };
  if (o.emRisco) return { humor: "triste", fala: `Sua ofensiva de ${o.atual} ${o.atual === 1 ? "dia" : "dias"} está em risco! Bora estudar só um pouquinho?` };
  if (resumo.pontosHoje >= resumo.metaDiaria && !quizPendente && !pendentes) return { humor: "comemorando", fala: "Meta batida e tudo em dia. Você é demais! 🧠✨" };
  if (resumo.pontosHoje >= resumo.metaDiaria) return { humor: "feliz", fala: "Meta do dia batida! O que vier agora é bônus." };
  if (quizPendente) return { humor: "surpreso", fala: "O quiz de hoje está te esperando na Prática. São só 5 perguntas!" };
  if (pendentes) return { humor: "normal", fala: `Você tem ${pendentes} assunto(s) para hoje. Vamos nessa?` };
  return { humor: "dormindo", fala: "Tudo em dia por aqui. Descansa que amanhã tem mais." };
}

function linhaDaPratica(rotulo, d, emoji) {
  if (!d?.status) return `${emoji} ${rotulo}: pendente`;
  if (d.status === "concluido") return `${emoji} ${rotulo}: ${(d.nota ?? 0) >= NOTA_DE_APROVACAO ? "✓" : "feito"} ${d.nota}%`;
  return `${emoji} ${rotulo}: em andamento`;
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function notaDaOfensiva(o) {
  if (o.estudouHoje) return "Hoje já conta. Volte amanhã para manter a sequência.";
  if (o.emRisco) return "Estude hoje para não perder a sequência!";
  return "Marque uma tarefa para começar a sequência.";
}

function Meta({ titulo, meta }) {
  return (
    <div className="pf-cartao">
      <div className="pf-estat__rotulo">{titulo}</div>
      <div className="pf-estat__valor">
        {meta.feitas}<small>/{meta.total} assuntos</small>
      </div>
      <Barra valor={meta.feitas} total={meta.total} rotulo={titulo} />
      <p className="pf-estat__nota">
        {meta.total === 0
          ? "Nada planejado para terminar neste período."
          : meta.atrasadas
            ? `Inclui ${meta.atrasadas} atrasado(s) de antes.`
            : `${formatarDia(meta.de)} a ${formatarDia(meta.ate)}`}
      </p>
    </div>
  );
}

/** A tela de todo dia: ofensiva, meta do dia, metas da semana e do mês, e os assuntos. */
export default function Hoje() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();

  const carregar = useCallback(async () => {
    try {
      setDados(await obter("/api/hoje"));
      setErro("");
    } catch (e) {
      setErro(e.message);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function aoMudar(resultado) {
    const t = textoDosPontos(resultado);
    if (t) avisar(t);
    reagirAoResultado(resultado);
    carregar();
  }

  if (!dados) {
    return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Carregando o seu dia…</div>;
  }

  const { resumo, metas, tarefas } = dados;
  const o = resumo.ofensiva;
  const primeiroNome = String(dados.usuario?.nome || "").split(" ")[0];

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}</h1>
          <p>{formatarDia(dados.hoje, { comSemana: true })} · {tarefas.filter((t) => t.situacao !== "feita").length} assunto(s) na fila</p>
        </div>
      </div>

      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginBottom: 12 }}>{erro}</div>}

      <div className="pf-cartao hoje__neuro">
        <Neuro {...falaDoNeuro(dados)} tamanho={104} ouvir />
      </div>

      <div className="pf-grade">
        <div className={`pf-cartao pf-ofensiva${o.emRisco ? " pf-ofensiva--risco" : ""}`}>
          <div className="pf-estat__rotulo">Ofensiva</div>
          <div className="pf-estat__valor">
            <span className="pf-ofensiva__fogo" aria-hidden="true">🔥</span>
            {o.atual}<small style={{ color: "inherit" }}> {o.atual === 1 ? "dia" : "dias"}</small>
          </div>
          <p className="pf-estat__nota">{notaDaOfensiva(o)} Recorde: {o.recorde}.</p>
        </div>

        <div className="pf-cartao">
          <div className="pf-estat__rotulo">Meta do dia</div>
          <div className="pf-estat__valor">
            {resumo.pontosHoje}<small>/{resumo.metaDiaria} pts</small>
          </div>
          <Barra valor={resumo.pontosHoje} total={resumo.metaDiaria} rotulo="Meta do dia" />
          <p className="pf-estat__nota">
            {resumo.pontosHoje >= resumo.metaDiaria ? "Meta batida! 🎉" : `Faltam ${resumo.metaDiaria - resumo.pontosHoje} pontos.`}
          </p>
        </div>

        <Meta titulo="Meta da semana" meta={metas.semana} />
        <Meta titulo="Meta do mês" meta={metas.mes} />
      </div>

      {dados.pratica.length > 0 && (
        <section className="pf-secao">
          <h2 className="pf-secao__titulo">
            Prática do dia
            <Link href="/pratica" style={{ fontSize: 14 }}>Abrir prática →</Link>
          </h2>
          <div className="hoje__pratica">
            {dados.pratica.map((p) => {
              const diarioFeito = p.quiz?.status === "concluido" && p.exercicio?.status === "concluido";
              return (
                <Link key={p.trilhaId} href="/pratica" className={`pratica__bloco${diarioFeito ? " pratica__bloco--feito" : p.quiz?.status === "concluido" ? " pratica__bloco--andamento" : ""}`}>
                  <span className="pratica__icone" aria-hidden="true">{diarioFeito ? "🏅" : "⚡"}</span>
                  <span className="pratica__textos">
                    <strong>{p.tema}</strong>
                    <small>{linhaDaPratica("Quiz", p.quiz, "❓")} · {linhaDaPratica("Exercício", p.exercicio, "⌨️")}</small>
                    <small>{linhaDaPratica("Projeto da semana", p.projetoSemanal, "🎁")}</small>
                  </span>
                  <span className="pratica__acao">{diarioFeito ? "Rever" : "Praticar"}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="pf-secao">
        <h2 className="pf-secao__titulo">
          Seus assuntos
          <small>Nível {resumo.nivel.nivel} · {resumo.total} pts</small>
        </h2>

        {dados.trilhas === 0 ? (
          <div className="pf-cartao pf-vazio">
            <h2>Nenhuma trilha ainda</h2>
            <p>
              Crie no Abacato um quadro com o nome começando por <strong>STUDY</strong> (ex.: “STUDY JavaScript”),
              com um card por assunto. Depois monte a trilha dele aqui.
            </p>
            <Link className="pf-botao" href="/trilhas">Montar uma trilha</Link>
          </div>
        ) : tarefas.length === 0 ? (
          <div className="pf-cartao pf-vazio">
            <h2>Tudo em dia 🎉</h2>
            <p>Suas trilhas não têm assuntos pendentes. Abra uma trilha para ver o caminho completo.</p>
            <Link className="pf-botao pf-botao--sec" href="/trilhas">Ver trilhas</Link>
          </div>
        ) : (
          <div className="pf-assuntos">
            {tarefas.map((t) => (
              <Assunto
                key={`${t.cardId}:${t.checklists.map((c) => c.id).join(",")}`}
                tarefa={t}
                aoMudar={aoMudar}
              />
            ))}
          </div>
        )}
      </section>

      {Aviso}
    </>
  );
}
