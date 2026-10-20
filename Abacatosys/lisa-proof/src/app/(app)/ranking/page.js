"use client";

import { useCallback, useEffect, useState } from "react";
import { obter, mudar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";

const numero = (n) => new Intl.NumberFormat("pt-BR").format(n || 0);

const ABAS = [
  { id: "total", rotulo: "Geral", titulo: "Pontos de todos os tempos", unidade: "pts" },
  { id: "semana", rotulo: "Semana", titulo: "Pontos dos últimos 7 dias", unidade: "pts" },
  { id: "reino", rotulo: "Reinos", titulo: "Troféus do Reino do Neuro", unidade: "🏆" },
];
const MEDALHAS = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * O ranking mundial: todo mundo que estuda no Proof. Três placares — pontos de sempre, pontos da
 * semana (dá chance a quem chegou agora) e troféus do Reino. Só aparece o nome público: apelido,
 * "Primeiro I." ou "Estudante anônimo" para quem preferir sair.
 */
export default function Ranking() {
  const [aba, setAba] = useState("total");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();

  const carregar = useCallback((periodo) => {
    setErro("");
    obter(`/api/ranking?periodo=${periodo}`).then(setDados).catch((e) => setErro(e.message));
  }, []);
  useEffect(() => { carregar(aba); }, [aba, carregar]);

  const info = ABAS.find((a) => a.id === aba);
  const euForaDoTopo = dados?.eu && !dados.topo.some((l) => l.souEu);

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>Ranking</h1>
          <p>Quem mais estuda no mundo do Proof.{dados ? ` ${numero(dados.total)} pessoa(s) no placar.` : ""}</p>
        </div>
        <div className="agenda__modos" role="tablist" aria-label="Placar">
          {ABAS.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className="agenda__modo" onClick={() => setAba(a.id)}>
              {a.rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}

      {dados && dados.periodo === aba && (
        <>
          {dados.eu && (
            <section className="rk-eu pf-cartao" aria-label="A sua posição">
              <div className="rk-eu__posicao">{MEDALHAS[dados.eu.posicao] || `${dados.eu.posicao}º`}</div>
              <div>
                <div className="pf-estat__rotulo">A sua posição · {info.titulo.toLowerCase()}</div>
                <div className="pf-estat__valor">{numero(dados.eu.valor)} <small>{info.unidade}</small></div>
                <p className="pf-estat__nota">
                  {dados.eu.valor === 0
                    ? (aba === "reino" ? "Ainda sem troféus — invada um reino para entrar no placar." : "Ainda sem pontos aqui — faça o quiz do dia para entrar no placar.")
                    : dados.eu.posicao === 1 ? "Você está no topo do mundo! 👑" : `de ${numero(dados.total)} · aparece como “${dados.perfil.comoApareco}”`}
                </p>
              </div>
            </section>
          )}

          <section className="pf-secao">
            <h2 className="pf-secao__titulo">{info.titulo} <small>top {Math.min(50, dados.total)}</small></h2>
            <div className="pf-cartao rk-tabela-caixa">
              {dados.topo.length === 0 ? (
                <p className="pf-estat__nota">
                  {aba === "reino" ? "Ninguém ganhou troféus ainda. Abra o Reino e faça a primeira invasão!" : "Ninguém pontuou nesse período ainda."}
                </p>
              ) : (
                <table className="rx-tabela rk-tabela">
                  <thead>
                    <tr>
                      <th scope="col" className="rk-col-pos">#</th>
                      <th scope="col">Quem</th>
                      <th scope="col" className="rk-col-extra">{aba === "reino" ? "Reino" : "Dias"}</th>
                      <th scope="col" className="rk-col-valor">{aba === "reino" ? "Troféus" : "Pontos"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.topo.map((l) => <Linha key={`${l.posicao}-${l.nome}-${l.valor}-${l.souEu}`} l={l} aba={aba} />)}
                    {euForaDoTopo && (
                      <>
                        <tr className="rk-reticencias" aria-hidden="true"><td colSpan={4}>⋯</td></tr>
                        <Linha l={dados.eu} aba={aba} />
                      </>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <ComoApareco perfil={dados.perfil} aoSalvar={(texto) => { avisar(texto); carregar(aba); }} />
        </>
      )}
      {!dados && !erro && <div className="pf-carregando">Montando o placar…</div>}
      {Aviso}
    </>
  );
}

function Linha({ l, aba }) {
  return (
    <tr className={l.souEu ? "rk-linha--eu" : ""}>
      <td className="rk-col-pos">{MEDALHAS[l.posicao] ? <span className="rk-medalha" role="img" aria-label={`${l.posicao}º`}>{MEDALHAS[l.posicao]}</span> : l.posicao}</td>
      <th scope="row">
        {l.nome}{l.souEu && <span className="pf-pilula pf-pilula--verde rk-voce">você</span>}
        {aba === "total" && l.nivel != null && <span className="rk-sub">nível {l.nivel}</span>}
      </th>
      <td className="rk-col-extra">
        {aba === "reino" ? <>{l.reino}<span className="rk-sub">torre {l.torre} · Neuro {l.neuro}</span></> : `${numero(l.dias)} dia(s)`}
      </td>
      <td className="rk-col-valor">{numero(l.valor)}</td>
    </tr>
  );
}

/** Como eu apareço para os outros: apelido, ou sair do ranking. */
function ComoApareco({ perfil, aoSalvar }) {
  const [apelido, setApelido] = useState(perfil.apelido);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => setApelido(perfil.apelido), [perfil.apelido]);

  async function salvar(corpo, texto) {
    setSalvando(true);
    setErro("");
    try {
      await mudar("/api/perfil", corpo);
      aoSalvar(texto);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="pf-secao">
      <h2 className="pf-secao__titulo">Como você aparece</h2>
      <div className="pf-cartao rk-perfil">
        <p className="pf-estat__nota" style={{ marginTop: 0 }}>
          Os outros veem você como <strong>“{perfil.comoApareco}”</strong>. O seu nome completo e o seu e-mail nunca aparecem no ranking.
        </p>
        <form className="rk-perfil__linha" onSubmit={(e) => { e.preventDefault(); salvar({ apelido }, apelido.trim() ? "Apelido salvo" : "Voltou para o primeiro nome"); }}>
          <label className="pf-campo" style={{ flex: 1 }}>
            <span className="pf-campo__rotulo">Apelido no ranking (opcional)</span>
            <input className="pf-campo__entrada" value={apelido} maxLength={24} placeholder="ex.: Dev da Madrugada"
              onChange={(e) => setApelido(e.target.value)} disabled={salvando} />
          </label>
          <button type="submit" className="pf-botao pf-botao--pequeno" disabled={salvando || apelido === perfil.apelido}>Salvar</button>
        </form>
        <label className="pf-marcar">
          <input type="checkbox" checked={perfil.noRanking} disabled={salvando}
            onChange={(e) => salvar({ noRanking: e.target.checked }, e.target.checked ? "Você voltou a aparecer com seu nome" : "Agora você aparece como Estudante anônimo")} />
          Mostrar meu nome (ou apelido) para os outros
        </label>
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      </div>
    </section>
  );
}
