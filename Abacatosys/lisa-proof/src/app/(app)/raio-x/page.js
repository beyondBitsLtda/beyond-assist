"use client";

import { useEffect, useMemo, useState } from "react";
import { obter } from "@/lib/api.js";
import { formatarDia } from "@/dominio/datas.js";
import { Barra } from "@/componentes/Pecas.js";

const POR_PAGINA = 50;
const numero = (n) => (n == null ? "—" : new Intl.NumberFormat("pt-BR").format(n));

/**
 * Raio-X: tudo o que o Proof sabe de quem está estudando, num lugar só — pontos por origem, ritmo,
 * quiz, exercícios, projetos, cada trilha e todas as pontuações (ver src/dominio/raioX.js).
 * Os gráficos são de uma série só (uma cor), com o valor escrito; o detalhe aparece ao passar o
 * mouse ou focar pelo teclado, e as tabelas logo abaixo carregam os mesmos números.
 */
export default function RaioX() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    obter("/api/raio-x").then(setDados).catch((e) => setErro(e.message));
  }, []);

  if (!dados) {
    return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Montando o seu raio-x…</div>;
  }

  const { resumo, usuario } = dados;
  const semNada = resumo.diasEstudados === 0 && dados.quiz.feitos === 0 && dados.exercicios.feitos === 0;

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>Raio-X</h1>
          <p>
            {usuario.nome || "Você"}
            {resumo.desde ? ` · estudando desde ${formatarDia(resumo.desde)} · ${resumo.diasEstudados} dia(s) de estudo em ${resumo.diasDesdeOInicio}` : ""}
          </p>
        </div>
      </div>

      {semNada && <div className="pf-aviso">Ainda não há estudo registrado. Marque uma tarefa na tela Hoje ou faça o quiz do dia, e o raio-x começa a se encher.</div>}

      {/* ------------------------------------------------------------ números principais */}
      <section className="rx-heroi pf-cartao" aria-label="Resumo">
        <div className="rx-heroi__principal">
          <div className="pf-estat__rotulo">Pontos no total</div>
          <div className="rx-heroi__valor">{numero(resumo.pontos)}</div>
          <div className="rx-heroi__nivel">
            <span>Nível {resumo.nivel.nivel}</span>
            <Barra valor={resumo.nivel.noNivel} total={resumo.nivel.proximo} rotulo="Progresso do nível" />
            <small>{resumo.nivel.proximo - resumo.nivel.noNivel} pts para o nível {resumo.nivel.nivel + 1}</small>
          </div>
        </div>
        <div className="rx-tiles">
          <Tile rotulo="Ofensiva atual" valor={`🔥 ${resumo.ofensiva.atual}`} nota={`recorde de ${resumo.ofensiva.recorde} dia(s)`} />
          <Tile rotulo="Dias de estudo" valor={numero(resumo.diasEstudados)} nota={resumo.constancia != null ? `constância de ${resumo.constancia}%` : "—"} />
          <Tile rotulo="Média por dia estudado" valor={`${numero(resumo.mediaPorDiaEstudado)} pts`} nota={`meta do dia: ${resumo.metaDiaria} pts`} />
          <Tile rotulo="Metas do dia batidas" valor={numero(resumo.metasBatidas)} nota={resumo.taxaDeMeta != null ? `${resumo.taxaDeMeta}% dos dias estudados` : "—"} />
          <Tile rotulo="Melhor dia" valor={resumo.melhorDia ? `${numero(resumo.melhorDia.pontos)} pts` : "—"} nota={resumo.melhorDia ? formatarDia(resumo.melhorDia.dia, { comSemana: true }) : ""} />
          <Tile rotulo="Horário mais forte" valor={dados.horaForte != null ? `${String(dados.horaForte).padStart(2, "0")}h` : "—"} nota="quando você mais pontua" />
        </div>
      </section>

      {/* ------------------------------------------------------------ de onde vêm os pontos */}
      <section className="pf-secao">
        <h2 className="pf-secao__titulo">De onde vêm os seus pontos</h2>
        <div className="pf-cartao">
          {dados.porOrigem.length === 0 ? <p className="pf-estat__nota">Nada ainda.</p> : (
            <BarrasDeitadas
              itens={dados.porOrigem.map((o) => ({ chave: o.tipo, rotulo: o.nome, valor: o.pontos, detalhe: `${o.vezes} vez(es) · ${Math.round((o.pontos / Math.max(1, resumo.pontos)) * 100)}% do total` }))}
              unidade="pts"
            />
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ ritmo */}
      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Ritmo</h2>
        <div className="pf-grade pf-grade--2">
          <div className="pf-cartao">
            <p className="rx-subtitulo">Pontos por semana · últimas {dados.semanas.length}</p>
            <Colunas
              itens={dados.semanas.map((s) => ({
                chave: s.inicio,
                rotulo: formatarDia(s.inicio),
                valor: s.pontos,
                destaque: s.atual,
                detalhe: `semana de ${formatarDia(s.inicio)}${s.atual ? " (esta)" : ""} · ${s.dias} dia(s) de estudo`,
              }))}
            />
          </div>
          <div className="pf-cartao">
            <p className="rx-subtitulo">Pontos por dia da semana</p>
            <Colunas
              itens={dados.diasDaSemana.map((d) => ({ chave: d.nome, rotulo: d.nome, valor: d.pontos, detalhe: `${d.dias} dia(s) de estudo` }))}
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ prática */}
      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Quiz</h2>
        <div className="rx-tiles rx-tiles--4">
          <Tile rotulo="Quizzes feitos" valor={numero(dados.quiz.feitos)} />
          <Tile rotulo="Perguntas respondidas" valor={numero(dados.quiz.perguntas)} />
          <Tile rotulo="Taxa de acerto" valor={dados.quiz.taxa != null ? `${dados.quiz.taxa}%` : "—"}
            nota={`${numero(dados.quiz.acertos)} de ${numero(dados.quiz.perguntas)} certas`}
            medidor={dados.quiz.taxa} />
          <Tile rotulo="Gabaritos" valor={numero(dados.quiz.gabaritos)} nota="quizzes com tudo certo" />
        </div>
      </section>

      <Entregas titulo="Exercícios do dia" resumo={dados.exercicios} vazio="Nenhum exercício enviado ainda." />
      <Entregas titulo="Projetos da semana e do mês" resumo={dados.projetos} vazio="Nenhum projeto entregue ainda." />

      {/* ------------------------------------------------------------ trilhas */}
      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Trilhas</h2>
        {dados.porTrilha.length === 0 ? <p className="pf-estat__nota">Nenhuma trilha ainda.</p> : (
          <div className="pf-cartao rx-rolagem">
            <table className="rx-tabela">
              <thead>
                <tr>
                  <th scope="col" className="rx-col-trilha">Trilha</th>
                  <th scope="col">Assuntos</th>
                  <th scope="col" className="rx-num">Pontos</th>
                  <th scope="col" className="rx-num">Quiz</th>
                  <th scope="col" className="rx-num">Acerto</th>
                  <th scope="col" className="rx-num">Exercícios</th>
                  <th scope="col" className="rx-num">Nota média</th>
                  <th scope="col" className="rx-num">Projetos</th>
                </tr>
              </thead>
              <tbody>
                {dados.porTrilha.map((t) => (
                  <tr key={t.id}>
                    <th scope="row">
                      {t.tema}
                      <small>{t.status === "ativa" ? "ativa" : t.status} · desde {formatarDia(t.inicio)}</small>
                    </th>
                    <td className="rx-progresso">
                      <Barra valor={t.concluidos} total={Math.max(1, t.assuntos)} rotulo={`Assuntos concluídos em ${t.tema}`} />
                      <small>{t.concluidos} de {t.assuntos} · {t.progresso}%</small>
                    </td>
                    <td className="rx-num">{numero(t.pontos)}</td>
                    <td className="rx-num">{t.quizzes}</td>
                    <td className="rx-num">{t.acertoNoQuiz != null ? `${t.acertoNoQuiz}%` : "—"}</td>
                    <td className="rx-num">{t.exercicios}</td>
                    <td className="rx-num">{t.notaDosExercicios ?? "—"}</td>
                    <td className="rx-num">{t.projetos}{t.notaDosProjetos != null ? ` · ${t.notaDosProjetos}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Historico historico={dados.historico} />
    </>
  );
}

function Tile({ rotulo, valor, nota, medidor }) {
  return (
    <div className="pf-cartao rx-tile">
      <div className="pf-estat__rotulo">{rotulo}</div>
      <div className="pf-estat__valor">{valor}</div>
      {medidor != null && <Barra valor={medidor} total={100} rotulo={rotulo} />}
      {nota && <p className="pf-estat__nota">{nota}</p>}
    </div>
  );
}

/** Barras deitadas, uma série: o rótulo à esquerda, o valor na ponta. */
function BarrasDeitadas({ itens, unidade }) {
  const maior = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="rx-barras" aria-label="Pontos por origem">
      {itens.map((i) => (
        <li key={i.chave} className="rx-barras__linha" tabIndex={0} aria-label={`${i.rotulo}: ${i.valor} ${unidade} (${i.detalhe})`}>
          <span className="rx-barras__rotulo">{i.rotulo}</span>
          <span className="rx-barras__trilho">
            <span className="rx-barras__barra" style={{ width: `${Math.max(1.5, (i.valor / maior) * 100)}%` }} />
            <span className="rx-barras__valor">{numero(i.valor)}</span>
          </span>
          <span className="rx-dica" role="tooltip"><strong>{numero(i.valor)} {unidade}</strong> {i.rotulo} · {i.detalhe}</span>
        </li>
      ))}
    </ul>
  );
}

/** Colunas, uma série: o valor só no maior e no destacado (o resto vem no foco/mouse e na dica). */
function Colunas({ itens }) {
  const maior = Math.max(...itens.map((i) => i.valor), 0);
  const topo = Math.max(1, maior);
  return (
    <div className="rx-colunas" role="list">
      {itens.map((i) => {
        const rotular = i.valor > 0 && (i.valor === maior || i.destaque);
        return (
          <div key={i.chave} className={`rx-colunas__item${i.destaque ? " rx-colunas__item--destaque" : ""}`} role="listitem" tabIndex={0}
            aria-label={`${i.rotulo}: ${i.valor} pontos · ${i.detalhe}`}>
            <span className="rx-colunas__area">
              {rotular && <span className="rx-colunas__valor">{numero(i.valor)}</span>}
              <span className="rx-colunas__coluna" style={{ height: `${i.valor > 0 ? Math.max(3, (i.valor / topo) * 100) : 0}%` }} />
            </span>
            <span className="rx-colunas__rotulo">{i.rotulo}</span>
            <span className="rx-dica" role="tooltip"><strong>{numero(i.valor)} pts</strong> {i.detalhe}</span>
          </div>
        );
      })}
    </div>
  );
}

function Entregas({ titulo, resumo, vazio }) {
  return (
    <section className="pf-secao">
      <h2 className="pf-secao__titulo">{titulo}</h2>
      {resumo.feitos === 0 ? <p className="pf-estat__nota">{vazio}</p> : (
        <>
          <div className="rx-tiles rx-tiles--4">
            <Tile rotulo="Entregues" valor={numero(resumo.feitos)} nota={`${resumo.aprovados} aprovado(s)`} />
            <Tile rotulo="Nota média" valor={resumo.notaMedia ?? "—"} nota="pela melhor nota de cada um" medidor={resumo.notaMedia} />
            <Tile rotulo="Melhor nota" valor={resumo.melhorNota ?? "—"} nota={`${resumo.notasCem} nota(s) 100`} />
            <Tile rotulo="Tentativas por entrega" valor={resumo.tentativasMedia ?? "—"} nota="em média" />
          </div>
          <div className="pf-cartao rx-rolagem" style={{ marginTop: 12 }}>
            <table className="rx-tabela">
              <thead>
                <tr>
                  <th scope="col">Dia</th>
                  <th scope="col">Desafio</th>
                  <th scope="col" className="rx-col-trilha">Trilha</th>
                  <th scope="col" className="rx-num">Nota</th>
                  <th scope="col" className="rx-num">Tentativas</th>
                  <th scope="col" className="rx-num">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {resumo.lista.map((d) => (
                  <tr key={d.id}>
                    <td>{formatarDia(d.periodo)}</td>
                    <th scope="row">{d.titulo || d.nome}<small>{d.nome}<span className="rx-so-celular">{d.tema ? ` · ${d.tema}` : ""}</span></small></th>
                    <td className="rx-col-trilha">{d.tema}</td>
                    <td className="rx-num"><span className={`rx-nota${d.aprovado ? " rx-nota--ok" : ""}`}>{d.nota ?? "—"}</span></td>
                    <td className="rx-num">{d.tentativas}{d.maxTentativas ? `/${d.maxTentativas}` : ""}</td>
                    <td className="rx-num">+{numero(d.pontos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Historico({ historico }) {
  const tipos = useMemo(() => [...new Map(historico.map((h) => [h.tipo, h.nome])).entries()], [historico]);
  const [filtro, setFiltro] = useState("");
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const lista = filtro ? historico.filter((h) => h.tipo === filtro) : historico;
  const somaDoFiltro = lista.reduce((s, h) => s + h.pontos, 0);

  return (
    <section className="pf-secao">
      <h2 className="pf-secao__titulo">Todas as pontuações</h2>
      <div className="rx-filtros" role="group" aria-label="Filtrar por tipo">
        <button type="button" className="pf-dia" aria-pressed={!filtro} onClick={() => { setFiltro(""); setMostrar(POR_PAGINA); }}>Tudo</button>
        {tipos.map(([tipo, nome]) => (
          <button key={tipo} type="button" className="pf-dia" aria-pressed={filtro === tipo} onClick={() => { setFiltro(tipo); setMostrar(POR_PAGINA); }}>{nome}</button>
        ))}
      </div>
      <p className="pf-estat__nota">{numero(lista.length)} registro(s) · {numero(somaDoFiltro)} pts</p>
      {lista.length === 0 ? <p className="pf-estat__nota">Nada ainda.</p> : (
        <div className="pf-cartao rx-rolagem">
          <table className="rx-tabela">
            <thead>
              <tr>
                <th scope="col">Quando</th>
                <th scope="col">O quê</th>
                <th scope="col" className="rx-col-trilha">Trilha</th>
                <th scope="col" className="rx-num">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, mostrar).map((h, i) => (
                <tr key={i}>
                  <td>{formatarDia(h.dia)}{h.hora != null ? ` · ${String(h.hora).padStart(2, "0")}h` : ""}</td>
                  <th scope="row">{h.texto || h.nome}<small>{h.nome}<span className="rx-so-celular">{h.tema ? ` · ${h.tema}` : ""}</span></small></th>
                  <td className="rx-col-trilha">{h.tema}</td>
                  <td className="rx-num">+{numero(h.pontos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length > mostrar && (
            <div className="pf-acoes" style={{ justifyContent: "center", marginTop: 12 }}>
              <button type="button" className="pf-botao pf-botao--sec" onClick={() => setMostrar((m) => m + POR_PAGINA)}>
                Mostrar mais ({numero(lista.length - mostrar)} restantes)
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
