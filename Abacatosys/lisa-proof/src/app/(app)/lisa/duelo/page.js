"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { obter, criar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import Neuro, { comemorar, reagir } from "@/componentes/Neuro.js";

const RESULTADO = {
  venceu: { titulo: "Você venceu a Lisa!", emoji: "🏆" },
  empate: { titulo: "Empate", emoji: "🤝" },
  perdeu: { titulo: "A Lisa venceu", emoji: "🤖" },
};

/**
 * O Duelo de Lógica com a Lisa (03/11/2026, ideia dela): 5 perguntas rápidas de código e raciocínio, 25 s cada.
 * Quem acertar mais leva a aposta: venceu, as moedas saem do reino da Lisa; perdeu, a aposta fica com ela;
 * empate devolve. As perguntas e o gabarito ficam no servidor (src/lib/duelo.js); aqui só se responde.
 */
export default function Duelo() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [duelo, setDuelo] = useState(null);       // o duelo em jogo (perguntas sem gabarito)
  const [resultado, setResultado] = useState(null); // o duelo encerrado (com a correção)
  const [ocupado, setOcupado] = useState(false);
  const [Aviso, avisar] = useAviso();

  const carregar = useCallback(() => obter("/api/duelo").then((d) => {
    setDados(d);
    if (d.aberto) setDuelo(d.aberto);
  }).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  async function comecar(aposta) {
    setOcupado(true);
    try {
      const r = await criar("/api/duelo", { acao: "comecar", aposta });
      setResultado(null);
      setDuelo(r.duelo);
    } catch (e) {
      avisar(`Não deu: ${e.message}`);
    } finally {
      setOcupado(false);
    }
  }

  const entregar = useCallback(async (id, respostas) => {
    setOcupado(true);
    try {
      const r = await criar("/api/duelo", { acao: "responder", id, respostas });
      setDuelo(null);
      setResultado(r.duelo);
      if (r.duelo.resultado === "venceu") comemorar(`🏆 +🪙 ${r.duelo.aposta} do reino da Lisa!`);
      else if (r.duelo.resultado === "perdeu") reagir("triste", "A Lisa levou essa… revanche?", 4000);
      if (r.foraDoPrazo) avisar("O tempo acabou antes da entrega: as respostas não contaram.");
      await carregar();
    } catch (e) {
      avisar(`Não deu: ${e.message}`);
    } finally {
      setOcupado(false);
    }
  }, [avisar, carregar]);

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>⚔️ Duelo de Lógica</h1>
          <p>A Lisa te desafia: {dados?.regras.perguntas || 5} perguntas rápidas de código e raciocínio, {dados?.regras.segundosPorPergunta || 25} segundos cada. Acertou mais que ela, leva a aposta do reino dela; acertou menos, a aposta fica com ela; empate devolve.</p>
        </div>
        <Link href="/lisa" className="pf-botao pf-botao--sec">← A Lisa joga</Link>
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {!dados && !erro && <p className="pf-estat__nota">Chamando a Lisa…</p>}
      {duelo && <Partida duelo={duelo} ocupado={ocupado} aoEntregar={entregar} />}
      {!duelo && resultado && <Resultado d={resultado} />}
      {!duelo && dados && (
        <>
          <section className="pf-cartao du-apostas">
            <div className="du-apostas__lisa" aria-hidden="true"><Neuro personagem="lisa" humor="pensando" tamanho={90} /></div>
            <div>
              <div className="pf-estat__rotulo">Escolha a aposta</div>
              <p className="pf-estat__nota">Você tem 🪙 {Math.floor(dados.saldo)} · o reino da Lisa tem 🪙 {Math.floor(dados.saldoDaLisa)} · duelos hoje: {dados.feitosHoje} de {dados.regras.porDia}</p>
              <div className="du-apostas__botoes">
                {dados.apostas.map((a) => (
                  <button key={a.aposta} type="button" className="pf-botao" disabled={!a.pode || ocupado} title={a.motivo || undefined} onClick={() => comecar(a.aposta)}>
                    ⚔️ Duelar por 🪙 {a.aposta}
                  </button>
                ))}
              </div>
              {dados.apostas.every((a) => !a.pode) && dados.apostas[0]?.motivo && <p className="pf-estat__nota">{dados.apostas[0].motivo}</p>}
            </div>
          </section>
          <section className="pf-secao">
            <h2 className="pf-secao__titulo">Placar contra a Lisa <small>🏆 {dados.placar.venceu} · 🤝 {dados.placar.empate} · 🤖 {dados.placar.perdeu}</small></h2>
            {!dados.recentes.length && <p className="pf-estat__nota">Nenhum duelo ainda. Coragem!</p>}
            <ul className="du-recentes">
              {dados.recentes.map((d) => (
                <li key={d.id}>
                  {RESULTADO[d.resultado]?.emoji} {d.dia.split("-").reverse().join("/")} · você {d.acertos} × {d.acertosDaLisa} Lisa · {d.movimento > 0 ? `+🪙 ${d.movimento}` : d.movimento < 0 ? `−🪙 ${-d.movimento}` : "aposta devolvida"}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {Aviso}
    </>
  );
}

/** As perguntas, uma por vez, com o cronômetro de cada uma; a última (ou o tempo total) entrega. */
function Partida({ duelo, ocupado, aoEntregar }) {
  const total = duelo.perguntas.length;
  const [atual, setAtual] = useState(0);
  const [respostas, setRespostas] = useState(() => Array(total).fill(null));
  const [agora, setAgora] = useState(() => Date.now());
  const inicioDaPergunta = useRef(Date.now());
  const entregue = useRef(false);
  const POR_PERGUNTA = 25_000;
  const fim = new Date(duelo.expiraEm).getTime() - 8_000; // entrega antes do prazo do servidor (folga da rede)

  const entregar = useCallback((lista) => {
    if (entregue.current) return;
    entregue.current = true;
    aoEntregar(duelo.id, lista);
  }, [aoEntregar, duelo.id]);

  const responder = useCallback((i) => {
    setRespostas((r) => {
      const nova = [...r];
      nova[atual] = i;
      if (atual + 1 >= total) entregar(nova);
      return nova;
    });
    inicioDaPergunta.current = Date.now();
    setAtual((a) => Math.min(total - 1, a + 1));
  }, [atual, total, entregar]);

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(relogio);
  }, []);
  const restaDaPergunta = Math.max(0, Math.min(POR_PERGUNTA - (agora - inicioDaPergunta.current), fim - agora));
  useEffect(() => {
    if (entregue.current) return;
    if (agora >= fim) { entregar(respostas); return; }
    if (restaDaPergunta <= 0) responder(null);
  }, [agora, fim, restaDaPergunta, respostas, responder, entregar]);

  const p = duelo.perguntas[atual];
  return (
    <section className="pf-cartao du-partida" aria-live="polite">
      <div className="du-partida__topo">
        <span className="pf-pilula">Pergunta {atual + 1} de {total}</span>
        <span className="pf-pilula">{p.tipo === "codigo" ? "💻 código" : "🧠 raciocínio"} · {"⭐".repeat(p.dificuldade)}</span>
        <span className={`du-partida__tempo${restaDaPergunta < 6000 ? " du-partida__tempo--fim" : ""}`}>⏱️ {Math.ceil(restaDaPergunta / 1000)} s</span>
      </div>
      <div className="du-partida__barra" aria-hidden="true"><span style={{ width: `${(restaDaPergunta / POR_PERGUNTA) * 100}%` }} /></div>
      <h2 className="du-partida__pergunta">{p.pergunta}</h2>
      {p.codigo && <pre className="du-partida__codigo"><code>{p.codigo}</code></pre>}
      <div className="du-partida__opcoes">
        {p.opcoes.map((o, i) => (
          <button key={i} type="button" className="pf-botao pf-botao--sec du-opcao" disabled={ocupado || entregue.current} onClick={() => responder(i)}>
            <span className="du-opcao__letra" aria-hidden="true">{"ABCD"[i]}</span> {o}
          </button>
        ))}
      </div>
      {ocupado && <p className="pf-estat__nota">Corrigindo…</p>}
    </section>
  );
}

/** O fim: o placar, quem levou as moedas e a correção (com o que a Lisa marcou). */
function Resultado({ d }) {
  const r = RESULTADO[d.resultado] || RESULTADO.empate;
  return (
    <section className={`pf-cartao du-resultado du-resultado--${d.resultado}`}>
      <div className="du-resultado__topo">
        <span className="du-resultado__emoji" aria-hidden="true">{r.emoji}</span>
        <div>
          <h2>{r.titulo}</h2>
          <p className="pf-estat__nota">Você acertou {d.acertos} · a Lisa acertou {d.acertosDaLisa} · {d.movimento > 0 ? `+🪙 ${d.movimento} do reino dela` : d.movimento < 0 ? `a aposta de 🪙 ${-d.movimento} ficou com ela` : "a aposta voltou para você"}</p>
        </div>
      </div>
      <ol className="du-correcao">
        {d.correcao.map((c, i) => (
          <li key={c.id}>
            <strong>{d.perguntas[i]?.pergunta}</strong>
            {d.perguntas[i]?.codigo && <pre className="du-partida__codigo"><code>{d.perguntas[i].codigo}</code></pre>}
            <div className="du-correcao__linha">
              <span className={c.acertou ? "du-certo" : "du-errado"}>{c.acertou ? "✔" : "✘"} você: {c.resposta === null ? "sem resposta" : c.opcoes[c.resposta]}</span>
              <span>certa: {c.opcoes[c.certa]}</span>
              <span>Lisa: {c.lisa === null ? "—" : `${c.opcoes[c.lisa]} ${c.lisa === c.certa ? "✔" : "✘"}`}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
