"use client";

import { useCallback, useEffect, useState } from "react";
import { obter, criar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import { Recebidas, quandoChegou } from "@/componentes/correio/Cartas.js";
import { CORREIO } from "@/dominio/correio.js";

const quando = quandoChegou;

/**
 * O correio (BEYOND-0016): cada jogador tem um mensageiro e uma caixa. Recado útil dá moedas aos dois
 * (quem recebe avalia); a pergunta do quiz que chega se responde aqui — acertou, os dois ganham.
 */
export default function Correio() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("recebidas");
  const [Aviso, avisar] = useAviso();

  const carregar = useCallback(() => obter("/api/correio").then((d) => {
    setDados(d);
    if (d.naoLidas) criar("/api/correio", { acao: "ler" }).catch(() => {});
  }).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  const agir = useCallback(async (url, corpo, texto) => {
    try {
      const r = await criar(url, corpo);
      avisar(texto(r));
      await carregar();
      return r;
    } catch (e) {
      avisar(`Não deu: ${e.message}`);
      return null;
    }
  }, [avisar, carregar]);

  const abas = [
    { id: "recebidas", rotulo: "Recebidas", n: dados?.naoLidas || 0 },
    { id: "enviadas", rotulo: "Enviadas" },
    { id: "escrever", rotulo: "Escrever" },
  ];
  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>{CORREIO.mensageiro} Correio</h1>
          <p>Mande recados para outros jogadores: se quem recebe achar útil, vocês dois ganham 🪙 {CORREIO.recompensaDoRecado}. No quiz do dia, até {CORREIO.perguntasPorQuiz} perguntas podem vir para cá — acertou, você ganha 🪙 {CORREIO.recompensaDaPergunta} e quem mandou, 🪙 {CORREIO.ajudaDaPergunta}.</p>
        </div>
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {!dados && !erro && <p className="pf-estat__nota">Abrindo a caixa…</p>}
      {dados && (
        <>
          <div className="agenda__modos co-abas" role="tablist" aria-label="Correio">
            {abas.map((a) => (
              <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className="agenda__modo" onClick={() => setAba(a.id)}>
                {a.rotulo}{a.n ? <span className="co-abas__n">{a.n}</span> : null}
              </button>
            ))}
          </div>
          {aba === "recebidas" && <Recebidas cartas={dados.recebidas} agir={agir} />}
          {aba === "enviadas" && <Enviadas cartas={dados.enviadas} />}
          {aba === "escrever" && <Escrever lista={dados.destinatarios || []} agir={agir} aoMandar={() => setAba("enviadas")} />}
        </>
      )}
      {Aviso}
    </>
  );
}

function Enviadas({ cartas }) {
  if (!cartas.length) return <div className="pf-cartao co-vazio"><p className="pf-estat__nota">Você ainda não mandou nada. Na aba Escrever, mande um recado; no quiz do dia, dá para mandar uma pergunta.</p></div>;
  const situacao = (c) => c.tipo === "recado"
    ? (c.avaliacao === "util" ? `achou útil${c.moedas ? ` · +🪙 ${c.moedas}` : ""}` : c.avaliacao === "nao_util" ? "achou que não foi útil" : "ainda não avaliou")
    : (c.respondida ? (c.acertou ? `acertou${c.moedas ? ` · +🪙 ${c.moedas} para você` : ""}` : "errou") : "ainda não respondeu");
  return (
    <ul className="co-lista">
      {cartas.map((c) => (
        <li key={c.id} className="pf-cartao co-carta">
          <div className="co-carta__topo">
            <span className="pf-pilula">{c.tipo === "pergunta" ? "❓ pergunta" : "💌 recado"}</span>
            <span className="co-carta__quem">para <strong>{c.para}</strong> · {quando(c.criadoEm)}</span>
          </div>
          <p className="co-carta__texto">{c.texto}</p>
          <p className="pf-estat__nota">{c.para} {situacao(c)}</p>
        </li>
      ))}
    </ul>
  );
}

function Escrever({ lista, agir, aoMandar }) {
  const [para, setPara] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function mandar(e) {
    e.preventDefault();
    if (!para || !texto.trim() || enviando) return;
    setEnviando(true);
    if (await agir("/api/correio", { acao: "recado", paraId: para, texto }, () => `${CORREIO.mensageiro} Recado a caminho!`)) { setTexto(""); aoMandar(); }
    setEnviando(false);
  }
  return (
    <form className="pf-cartao co-escrever" onSubmit={mandar}>
      <label className="pf-campo">
        <span className="pf-campo__rotulo">Para</span>
        <select className="pf-campo__entrada" value={para} onChange={(e) => setPara(e.target.value)}>
          <option value="">Escolha um jogador</option>
          {lista.map((d) => <option key={d.id} value={d.id}>{d.nome}{d.robo ? " 🤖" : ""}</option>)}
        </select>
      </label>
      <label className="pf-campo">
        <span className="pf-campo__rotulo">Recado</span>
        <textarea className="pf-campo__entrada" rows={4} maxLength={CORREIO.recadoMaximo} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Uma dica de estudo, um incentivo, um macete que te ajudou…" />
      </label>
      <p className="pf-estat__nota">Até {CORREIO.recadosPorDia} recados por dia. Se quem receber achar útil, vocês dois ganham 🪙 {CORREIO.recompensaDoRecado}.</p>
      <button type="submit" className="pf-botao" disabled={!para || !texto.trim() || enviando}>{enviando ? "Mandando…" : `${CORREIO.mensageiro} Mandar pelo mensageiro`}</button>
    </form>
  );
}
