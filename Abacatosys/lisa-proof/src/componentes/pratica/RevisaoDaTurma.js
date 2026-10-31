"use client";

// A revisão da turma (31/10/2026): o pedido de quem entregou (contestar critérios que a Lisa deu como
// não cumpridos) e o cartão do pedido que um colega revisa. As regras moram em src/dominio/revisoes.js.

import { useEffect, useState } from "react";
import { obter, criar } from "@/lib/api.js";
import { PERFIS } from "@/dominio/perfis.js";
import { VEREDITOS, DIAS_NA_FILA, LIMITES_DA_REVISAO_DA_TURMA } from "@/dominio/revisoes.js";

const minutos = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const SITUACAO = { aberta: "na fila da turma", revisada: "revisada", vencida: `venceu (${DIAS_NA_FILA} dias sem revisão)` };

/** O que o pedido mostra da entrega: o texto, as miniaturas, o link do vídeo e a duração do áudio. */
export function EntregaDoPedido({ entrega }) {
  const e = entrega || {};
  return (
    <div className="turma__entrega">
      {e.miniaturas?.length > 0 && (
        <ul className="evid__fotos evid__fotos--mini">
          {e.miniaturas.map((m, i) => <li key={i}><img src={m} alt={`Miniatura da foto ${i + 1} da entrega`} /></li>)}
        </ul>
      )}
      {e.video && <p style={{ margin: 0 }}>🎬 <a href={e.video} target="_blank" rel="noreferrer">{e.video}</a></p>}
      {e.audio && <p className="pf-estat__nota" style={{ margin: 0 }}>🎙️ Áudio de {minutos(e.audio.segundos || 0)} — não fica guardado, então a turma não ouve.</p>}
      {e.texto && <p className="evid__texto">{e.texto}</p>}
      {!e.texto && !e.video && !e.miniaturas?.length && <p className="pf-estat__nota" style={{ margin: 0 }}>A entrega foi só em áudio.</p>}
    </div>
  );
}

/** O resultado de um pedido, para quem pediu. */
function ResultadoDoPedido({ pedido: p }) {
  return (
    <div className="pf-cartao turma__resultado">
      <strong>🤝 Revisão da turma: {SITUACAO[p.status] || p.status}</strong>
      {p.status === "revisada" ? (
        <>
          <p style={{ margin: 0 }}>Um colega confirmou {p.confirmados} de {p.contestados.length} critério{p.contestados.length > 1 ? "s" : ""} que você contestou{p.confirmados > 0 ? " — a nota e os pontos já subiram." : "."}</p>
          <ul className="turma__vereditos">
            {(p.vereditos || []).map((v) => (
              <li key={v.indice}>
                <span className={`turma__selo turma__selo--${v.veredito}`}>{VEREDITOS[v.veredito]}</span> {p.criterios[v.indice]?.texto}
                {v.observacao && <small> — {v.observacao}</small>}
              </li>
            ))}
          </ul>
          {p.comentario && <blockquote className="turma__comentario">{p.comentario}</blockquote>}
        </>
      ) : p.status === "aberta" ? (
        <p className="pf-estat__nota" style={{ margin: 0 }}>Você contestou {p.contestados.length} critério{p.contestados.length > 1 ? "s" : ""}. Quando um colega revisar, o resultado aparece aqui.</p>
      ) : null}
    </div>
  );
}

/**
 * Depois da avaliação da Lisa: pedir a revisão da turma (ou ver o pedido). `versao` muda a cada
 * entrega nova, para reler se ainda dá para pedir.
 */
export function PedirRevisao({ desafioId, versao }) {
  const [info, setInfo] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [escolhas, setEscolhas] = useState({}); // indice -> justificativa
  const [consentiu, setConsentiu] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    obter(`/api/desafios/${desafioId}/revisao`).then(setInfo).catch(() => setInfo(null));
  }, [desafioId, versao]);

  if (!info) return null;
  if (info.pedido) return <ResultadoDoPedido pedido={info.pedido} />;
  if (!info.pode) return null;

  const naoCumpridos = info.criterios.map((texto, i) => ({ texto, i, observacao: info.observacoes[i] })).filter((c) => !info.atendidos.includes(c.i));
  const marcados = Object.keys(escolhas).map(Number);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      const r = await criar(`/api/desafios/${desafioId}/revisao`, {
        contestados: marcados.map((indice) => ({ indice, justificativa: escolhas[indice] })), consentiu,
      });
      setInfo({ ...info, pedido: r.pedido, pode: false });
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <div className="pf-cartao turma__convite">
        <span>🤝 Discorda da Lisa em algum critério? Peça a revisão de um colega da turma.</span>
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setAberto(true)}>Pedir revisão da turma</button>
      </div>
    );
  }
  return (
    <form className="pf-cartao turma__pedido" onSubmit={enviar}>
      <strong>🤝 Pedir a revisão da turma</strong>
      <p className="pf-estat__nota" style={{ margin: 0 }}>
        Marque os critérios que você cumpriu e a Lisa não viu, e explique o que mostra isso na sua entrega. Um colega revisa; o que ele confirmar passa a valer e a nota sobe (nunca desce). É um pedido por desafio.
      </p>
      <ul className="turma__criterios">
        {naoCumpridos.map((c) => (
          <li key={c.i}>
            <label className="turma__marcar">
              <input type="checkbox" checked={c.i in escolhas} onChange={(ev) => setEscolhas((es) => {
                const novo = { ...es };
                if (ev.target.checked) novo[c.i] = ""; else delete novo[c.i];
                return novo;
              })} />
              <span>{c.texto}{c.observacao && <small> — a Lisa: {c.observacao}</small>}</span>
            </label>
            {c.i in escolhas && (
              <textarea className="pf-campo__entrada" rows={2} maxLength={LIMITES_DA_REVISAO_DA_TURMA.justificativa} value={escolhas[c.i]} required
                placeholder="O que na sua entrega mostra que você cumpriu?" onChange={(ev) => setEscolhas((es) => ({ ...es, [c.i]: ev.target.value }))} />
            )}
          </li>
        ))}
      </ul>
      <label className="turma__marcar">
        <input type="checkbox" checked={consentiu} onChange={(ev) => setConsentiu(ev.target.checked)} />
        <span>Concordo que o texto, as miniaturas das fotos e o link do vídeo desta entrega apareçam, <strong>sem o meu nome</strong>, para um colega do Proof revisar. O áudio não vai (ele não fica guardado).</span>
      </label>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      <div className="pf-acoes">
        <button type="submit" className="pf-botao pf-botao--pequeno" disabled={enviando || !marcados.length || !consentiu}>{enviando ? "Enviando…" : "Mandar para a turma"}</button>
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </form>
  );
}

/** O pedido de um colega, para revisar: a entrega, os critérios e o veredito de cada contestado. */
export function PedidoParaRevisar({ pedido: p, aoRevisar }) {
  const [vereditos, setVereditos] = useState({});
  const [observacoes, setObservacoes] = useState({});
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const contestados = new Map(p.contestados.map((c) => [c.indice, c.justificativa]));
  const completo = p.contestados.every((c) => vereditos[c.indice]) && comentario.trim().length >= LIMITES_DA_REVISAO_DA_TURMA.minimoComentario;

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      const r = await criar(`/api/revisoes/${p.id}`, {
        vereditos: p.contestados.map((c) => ({ indice: c.indice, veredito: vereditos[c.indice], observacao: observacoes[c.indice] || "" })),
        comentario,
      });
      aoRevisar(p.id, r);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="pf-cartao turma__cartao" onSubmit={enviar}>
      <div className="pf-assunto__chips">
        <span className="pf-pilula pf-pilula--tema">{PERFIS[p.perfil]?.emoji} {p.tema}</span>
        <span className="pf-pilula">{p.tipo === "exercicio" ? "Desafio do dia" : "Projeto"}</span>
      </div>
      <h3 style={{ margin: 0 }}>{p.titulo}</h3>
      {p.enunciado && <details><summary>Enunciado</summary><p className="evid__texto">{p.enunciado}</p></details>}
      <EntregaDoPedido entrega={p.entrega} />
      <ol className="turma__criterios">
        {p.criterios.map((c, i) => (
          <li key={i} className={contestados.has(i) ? "turma__contestado" : undefined}>
            <span>{c.atendido ? "✅" : "❌"} {c.texto}</span>
            {c.observacao && <small className="pf-estat__nota">A Lisa: {c.observacao}</small>}
            {contestados.has(i) && (
              <>
                <small><strong>O colega diz:</strong> {contestados.get(i)}</small>
                <div className="motor__opcoes" role="radiogroup" aria-label={`Veredito do critério ${i + 1}`}>
                  {Object.entries(VEREDITOS).map(([v, nome]) => (
                    <button key={v} type="button" role="radio" aria-checked={vereditos[i] === v} className="motor__opcao" disabled={enviando}
                      onClick={() => setVereditos((vs) => ({ ...vs, [i]: v }))}>{nome}</button>
                  ))}
                </div>
                <input className="pf-campo__entrada" maxLength={300} placeholder="Por quê? (opcional)" value={observacoes[i] || ""}
                  onChange={(ev) => setObservacoes((os) => ({ ...os, [i]: ev.target.value }))} />
              </>
            )}
          </li>
        ))}
      </ol>
      <label className="pf-campo">
        <span className="pf-campo__rotulo">Comentário para o colega</span>
        <textarea className="pf-campo__entrada" rows={3} maxLength={LIMITES_DA_REVISAO_DA_TURMA.comentario} value={comentario} required
          placeholder="O que está bom e o que dá para melhorar — com gentileza" onChange={(ev) => setComentario(ev.target.value)} />
      </label>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      <div className="pf-acoes"><button type="submit" className="pf-botao pf-botao--pequeno" disabled={enviando || !completo}>{enviando ? "Enviando…" : "Enviar a revisão"}</button></div>
    </form>
  );
}

export { ResultadoDoPedido, SITUACAO };
