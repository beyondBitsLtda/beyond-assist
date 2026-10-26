"use client";

// A MESA DOS CONSULTORES na tela da Bolsa (26/10/2026): seis personagens, cada um com a projeção
// para o fechamento de hoje, a aposta do dia, o retrospecto dos últimos pregões e a ficha (quem é,
// a história, o jeito, o método e a faixa de erro que ele DIZ ter). A margem de erro de verdade
// muda todo dia e ninguém vê — o retrospecto é a única pista. Na ação escolhida, "o que os
// consultores dizem": a régua com o rosto de cada um no preço que ele projetou.
//
// Os dados vêm de /api/reino/bolsa/consultores (src/dominio/projecoes.js faz a conta no servidor).

import { useMemo, useState } from "react";
import { CONSULTORES, consultorPorId } from "@/dominio/consultores.js";
import { retratoDoConsultor } from "./consultoresDePapel.js";
import { preco, pct, seta, rumo, horaCurta, diaCurto } from "./formatos.js";

const pontos = (n) => `${String(n).replace(".", ",")} ${n === 1 ? "ponto" : "pontos"}`;
const umaCasa = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
const porcento = (a, b) => (b ? Math.round((100 * a) / b) : 0);

/** O rosto de um consultor, recortado do retrato (para as listas e a régua). */
export function Rosto({ id, tamanho = 32 }) {
  return (
    <span className="bx-rosto" style={{ "--t": `${tamanho}px`, "--cor": consultorPorId(id)?.cor }} aria-hidden="true">
      <img src={retratoDoConsultor(id)} alt="" />
    </span>
  );
}

/** As notas dos últimos pregões (0 a 10), do mais antigo ao mais novo — a única pista do jeito de cada um. */
function Retrospecto({ historico }) {
  if (!historico.length) return <span className="bx-retro bx-retro--vazio">sem pregões no placar ainda</span>;
  const dias = [...historico].reverse();
  return (
    <span className="bx-retro" role="img" aria-label={`Notas nos últimos ${dias.length} pregões: ${dias.map((d) => `${diaCurto(d.dia)} ${umaCasa(d.nota)}`).join(", ")}`}>
      {dias.map((d) => (
        <span key={d.dia} className={`bx-retro__barra${d.melhor ? " bx-retro__barra--melhor" : ""}`} style={{ "--h": `${Math.max(6, d.nota * 10)}%` }}
          title={`${diaCurto(d.dia)}: nota ${umaCasa(d.nota)} — errou em média ${pontos(d.erroMedio)}, acertou o lado em ${d.acertos} de ${d.total}${d.melhor ? " · 🏆 melhor do dia" : ""}`} />
      ))}
    </span>
  );
}

/**
 * A mesa: os seis cartões, o placar do último pregão (e o de hoje, depois do fechamento) e a ficha
 * do consultor escolhido.
 */
export function MesaDosConsultores({ mesa, erro, acoes, aoEscolherAcao }) {
  const [aberto, setAberto] = useState(null);
  const dados = useMemo(() => new Map((mesa?.consultores || []).map((c) => [c.id, c])), [mesa]);
  const acaoDe = (id) => acoes.find((a) => a.id === id);

  return (
    <section className="bx-painel bx-mesa" aria-labelledby="bx-mesa-titulo">
      <div className="bx-mesa__topo">
        <div>
          <h2 id="bx-mesa-titulo">🔮 Mesa dos Consultores</h2>
          <p className="bx-mesa__sub">
            Projeções para o fechamento de hoje ({horaCurta(mesa?.fechaAs ?? 17)}). Cada consultor erra do seu jeito, e a margem de erro de cada um
            muda todo dia — ninguém conta qual é. O retrospecto é a sua pista.
          </p>
        </div>
      </div>

      {!mesa ? <p className="bx-vazio">{erro || "Chamando os consultores…"}</p> : (
        <div className="bx-mesa__grade">
          <ul className="bx-mesa__lista">
            {CONSULTORES.map((c) => {
              const d = dados.get(c.id);
              const a = d?.aposta && acaoDe(d.aposta.acao);
              return (
                <li key={c.id}>
                  <button type="button" className={`bx-consultor${aberto === c.id ? " bx-consultor--aberto" : ""}`} style={{ "--cor": c.cor }}
                    aria-expanded={aberto === c.id} aria-controls="bx-ficha" onClick={() => setAberto(aberto === c.id ? null : c.id)}>
                    <img className="bx-consultor__retrato" src={retratoDoConsultor(c.id)} alt="" width={84} height={84} />
                    <span className="bx-consultor__texto">
                      <strong>{c.nome}</strong>
                      <small>{c.titulo}</small>
                      <span className="bx-consultor__aposta">
                        {d?.aposta ? <>Aposta: {a?.emoji} <b>{d.aposta.acao}</b> <span className={`bx-txt--${rumo(d.aposta.variacao)}`}>{seta(d.aposta.variacao)} {pct(d.aposta.variacao)}</span></>
                          : mesa.abrindo ? "esperando o pregão abrir" : "sem projeção hoje"}
                      </span>
                    </span>
                    <span className="bx-consultor__rodape">
                      <Retrospecto historico={d?.historico || []} />
                      <small>
                        {d?.resumo ? `erro médio ${umaCasa(d.resumo.erroMedio)} · lado certo ${porcento(d.resumo.acertos, d.resumo.total)}%` : "estreando na mesa"}
                        {d?.hoje ? <> · <b>hoje: nota {umaCasa(d.hoje.nota)}{d.hoje.melhor ? " 🏆" : ""}</b></> : null}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Placar mesa={mesa} />
        </div>
      )}

      {mesa && aberto && <Ficha id={aberto} dados={dados.get(aberto)} mesa={mesa} acoes={acoes} aoEscolherAcao={aoEscolherAcao} aoFechar={() => setAberto(null)} />}
    </section>
  );
}

/** O placar: quem errou menos no último pregão (e hoje, depois que o pregão fecha). */
function Placar({ mesa }) {
  const blocos = [
    mesa.placarDeHoje && { titulo: `Hoje, ${diaCurto(mesa.placarDeHoje.dia)}`, ...mesa.placarDeHoje },
    mesa.ultimoPregao && { titulo: `Último pregão, ${diaCurto(mesa.ultimoPregao.dia)}`, ...mesa.ultimoPregao },
  ].filter(Boolean);
  return (
    <aside className="bx-placar" aria-label="Placar dos consultores">
      <h3>🏆 Placar</h3>
      {!blocos.length && <p className="bx-vazio">O placar aparece depois do primeiro pregão com projeções.</p>}
      {blocos.map((b) => (
        <div key={b.titulo} className="bx-placar__bloco">
          <span className="bx-rotulo">{b.titulo}</span>
          <ol>
            {b.ranking.map((r, i) => (
              <li key={r.id}>
                <span className="bx-placar__pos">{i + 1}º</span>
                <Rosto id={r.id} tamanho={26} />
                <span className="bx-placar__nome">{consultorPorId(r.id)?.nome}</span>
                <span className="bx-placar__nota" title={`errou em média ${pontos(r.erroMedio)}; acertou o lado em ${r.acertos} de ${r.total}; dentro da faixa que declarou em ${r.naFaixa} de ${r.total}`}>
                  {umaCasa(r.nota)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p className="bx-placar__nota-rodape">Nota = 10 − o erro médio (em pontos percentuais) entre a projeção e o fechamento.</p>
    </aside>
  );
}

/** A ficha do consultor: quem é, o comentário do dia, as projeções de hoje e o retrospecto. */
function Ficha({ id, dados, mesa, acoes, aoEscolherAcao, aoFechar }) {
  const c = consultorPorId(id);
  const projecoes = dados?.projecoes || [];
  return (
    <div className="bx-ficha" id="bx-ficha" style={{ "--cor": c.cor }}>
      <div className="bx-ficha__cabeca">
        <img className="bx-ficha__retrato" src={retratoDoConsultor(id)} alt={`Retrato de ${c.nome}`} width={150} height={150} />
        <div className="bx-ficha__quem">
          <h3>{c.nome} <small>{c.titulo}</small></h3>
          <p className="bx-ficha__meta">{c.idade} · {c.origem}</p>
          <ul className="bx-ficha__tracos">{c.personalidade.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="bx-ficha__historia">{c.historia}</p>
          <dl className="bx-ficha__dados">
            <div><dt>Método</dt><dd>{c.metodo}</dd></div>
            <div><dt>Faixa de erro que diz ter</dt><dd>±{c.faixaDeclarada}% {c.sobreAFaixa}</dd></div>
            <div><dt>Bordão</dt><dd>“{c.bordao}”</dd></div>
          </dl>
          {dados?.comentario && <blockquote className="bx-balao">{dados.comentario}</blockquote>}
        </div>
        <button type="button" className="bx-ficha__fechar" onClick={aoFechar} aria-label={`Fechar a ficha de ${c.nome}`}>✕</button>
      </div>

      <h4>Projeções para o fechamento de hoje</h4>
      {!projecoes.length ? <p className="bx-vazio">{mesa.abrindo ? "A Lisa está abrindo o pregão — as projeções saem em seguida." : "Nenhuma ação para projetar hoje."}</p> : (
        <ul className="bx-proj">
          {projecoes.map((p) => {
            const a = acoes.find((x) => x.id === p.acao);
            const r = p.resultado;
            return (
              <li key={p.acao}>
                <button type="button" onClick={() => aoEscolherAcao(p.acao)}>
                  <span className="bx-proj__acao">{a?.emoji} <strong>{p.acao}</strong></span>
                  <span className="bx-proj__num">
                    <small>projeção</small>
                    <b className={`bx-txt--${rumo(p.variacao)}`}>{preco(p.preco)} {seta(p.variacao)} {pct(p.variacao)}</b>
                  </span>
                  <span className="bx-proj__num"><small>faixa declarada</small>{preco(p.faixa.de)} – {preco(p.faixa.ate)}</span>
                  {r ? (
                    <span className="bx-proj__num">
                      <small>fechou</small>
                      <b className={`bx-txt--${rumo(r.variacao)}`}>{preco(r.preco)} {pct(r.variacao)}</b>
                      <em>{r.direcao ? "✓ lado certo" : "✗ lado errado"} · errou {pontos(r.erro)}{r.naFaixa ? " · na faixa" : ""}</em>
                    </span>
                  ) : a ? <span className="bx-proj__num"><small>agora</small>{preco(a.preco)}</span> : null}
                  <q className="bx-proj__fala">{p.frase}</q>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {dados?.historico?.length > 0 && (
        <>
          <h4>Retrospecto</h4>
          <table className="bx-tabela bx-ficha__historico">
            <thead><tr><th scope="col">Pregão</th><th scope="col">Nota</th><th scope="col">Erro médio</th><th scope="col">Lado certo</th><th scope="col">Na faixa</th></tr></thead>
            <tbody>
              {dados.historico.map((h) => (
                <tr key={h.dia}>
                  <th scope="row">{diaCurto(h.dia)}{h.melhor ? " 🏆" : ""}</th>
                  <td>{umaCasa(h.nota)}</td>
                  <td>{umaCasa(h.erroMedio)} pts</td>
                  <td>{h.acertos}/{h.total}</td>
                  <td>{h.naFaixa}/{h.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** Distribui os rostos na régua em faixas, para não ficarem um em cima do outro. */
function emFaixas(itens, folga = 12, maximo = 3) {
  const fim = [];
  return [...itens].sort((a, b) => a.x - b.x).map((it) => {
    let f = fim.findIndex((x) => it.x - x >= folga);
    if (f < 0) f = fim.length < maximo ? fim.length : fim.indexOf(Math.min(...fim));
    fim[f] = it.x;
    return { ...it, faixa: f };
  });
}

/**
 * Na ação escolhida: o que cada consultor projeta para o fechamento, numa régua de preço (com a
 * abertura, o preço de agora e, depois do fechamento, onde ela fechou) e numa lista com a fala.
 */
export function OpinioesDaAcao({ mesa, acao }) {
  if (!mesa) return null;
  const titulo = <h3 className="bx-opinioes__titulo">🔮 O que os consultores dizem <small>para o fechamento das {horaCurta(mesa.fechaAs)}</small></h3>;
  if (acao.estreia) return <div className="bx-opinioes">{titulo}<p className="bx-vazio">Estreia hoje: os consultores ainda não conhecem a empresa.</p></div>;
  const lista = mesa.consultores.map((c) => ({ id: c.id, p: c.projecoes.find((p) => p.acao === acao.id) })).filter((x) => x.p);
  if (!lista.length) return <div className="bx-opinioes">{titulo}<p className="bx-vazio">{mesa.abrindo ? "Os consultores esperam a Lisa abrir o pregão." : "Sem projeções para esta ação hoje."}</p></div>;

  const fechou = lista[0].p.resultado?.preco;
  const valores = [acao.abertura, acao.preco, ...lista.map((x) => x.p.preco), ...(fechou != null ? [fechou] : [])];
  let min = Math.min(...valores), max = Math.max(...valores);
  const folga = Math.max((max - min) * 0.08, max * 0.01);
  min -= folga; max += folga;
  const x = (v) => ((v - min) / (max - min)) * 100;
  const rostos = emFaixas(lista.map((it) => ({ ...it, x: x(it.p.preco) })));
  const faixas = Math.max(1, ...rostos.map((r) => r.faixa + 1));
  const ordenadas = [...lista].map((it) => it.p.preco).sort((a, b) => a - b);
  const mediana = ordenadas.length % 2 ? ordenadas[(ordenadas.length - 1) / 2] : (ordenadas[ordenadas.length / 2 - 1] + ordenadas[ordenadas.length / 2]) / 2;
  const varMediana = acao.abertura ? Math.round(((mediana - acao.abertura) / acao.abertura) * 1000) / 10 : 0;

  return (
    <div className="bx-opinioes">
      {titulo}
      <div className="bx-regua" style={{ "--faixas": faixas }} aria-hidden="true">
        <span className="bx-regua__marca bx-regua__marca--abertura" style={{ left: `${x(acao.abertura)}%` }}><small>abertura</small></span>
        {fechou != null
          ? <span className="bx-regua__marca bx-regua__marca--fechou" style={{ left: `${x(fechou)}%` }}><small>fechou</small></span>
          : <span className="bx-regua__marca bx-regua__marca--agora" style={{ left: `${x(acao.preco)}%` }}><small>agora</small></span>}
        {rostos.map((r) => (
          <span key={r.id} className="bx-regua__rosto" style={{ left: `${r.x}%`, "--faixa": r.faixa }}
            title={`${consultorPorId(r.id).nome}: ${preco(r.p.preco)} (${pct(r.p.variacao)})`}>
            <Rosto id={r.id} tamanho={30} />
          </span>
        ))}
        <span className="bx-regua__eixo" />
      </div>
      <ul className="bx-opinioes__lista">
        {lista.map(({ id, p }) => (
          <li key={id}>
            <Rosto id={id} tamanho={34} />
            <span className="bx-opinioes__quem">
              <strong>{consultorPorId(id).nome}</strong>
              <q>{p.frase}</q>
            </span>
            <span className="bx-opinioes__num">
              <b className={`bx-txt--${rumo(p.variacao)}`}>🪙 {preco(p.preco)}</b>
              <small>{seta(p.variacao)} {pct(p.variacao)}{p.resultado ? ` · errou ${pontos(p.resultado.erro)}` : ""}</small>
            </span>
          </li>
        ))}
      </ul>
      <p className="bx-opinioes__rodape">
        Mediana da mesa: <strong>🪙 {preco(mediana)}</strong> ({pct(varMediana)} sobre a abertura). Projeções feitas antes da abertura; quem acerta mais muda de um dia para o outro.
      </p>
    </div>
  );
}
