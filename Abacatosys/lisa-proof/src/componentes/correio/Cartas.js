"use client";

// As cartas que chegam (BEYOND-0016): o recado para avaliar e a pergunta do quiz para responder. A tela
// Correio e a caixa do Reino (src/componentes/reino/CorreioDoReino.js) usam as mesmas peças.

import { useState } from "react";
import { emLinha } from "@/componentes/Explicacao.js";
import Codigo from "@/componentes/codigo/Codigo.js";

const LETRAS = ["A", "B", "C", "D"];
export const quandoChegou = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const quando = quandoChegou;

/** As cartas recebidas. `agir(url, corpo, texto)` faz o pedido, avisa e recarrega. */
export function Recebidas({ cartas, agir }) {
  if (!cartas.length) return <div className="pf-cartao co-vazio"><p className="pf-estat__nota">A caixa está vazia. Quando alguém mandar um recado ou uma pergunta do quiz, chega aqui.</p></div>;
  return (
    <ul className="co-lista">
      {cartas.map((c) => (
        <li key={c.id} className="pf-cartao co-carta" data-nova={!c.lida || undefined}>
          <div className="co-carta__topo">
            <span className="pf-pilula">{c.tipo === "pergunta" ? "❓ pergunta do quiz" : "💌 recado"}</span>
            <span className="co-carta__quem">de <strong>{c.de}</strong> · {quando(c.criadoEm)}</span>
          </div>
          {c.tipo === "recado" ? <Recado c={c} agir={agir} /> : <Pergunta c={c} agir={agir} />}
        </li>
      ))}
    </ul>
  );
}

export function Recado({ c, agir }) {
  return (
    <>
      <p className="co-carta__texto">{c.texto}</p>
      {c.avaliacao ? (
        <p className="pf-estat__nota">{c.avaliacao === "util" ? `Você achou útil${c.moedas ? ` · +🪙 ${c.moedas}` : ""}` : "Você achou que não foi útil."}</p>
      ) : (
        <div className="pf-acoes">
          <button type="button" className="pf-botao pf-botao--pequeno" onClick={() => agir(`/api/correio/${c.id}`, { acao: "avaliar", util: true }, (r) => (r.moedas ? `Útil! +🪙 ${r.moedas} para você${r.remetenteGanhou ? " e para quem mandou" : ""}` : "Avaliado como útil"))}>👍 Foi útil</button>
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => agir(`/api/correio/${c.id}`, { acao: "avaliar", util: false }, () => "Avaliado")}>Não foi útil</button>
        </div>
      )}
    </>
  );
}

export function Pergunta({ c, agir }) {
  const p = c.pergunta;
  const [enviando, setEnviando] = useState(false);
  if (!p) return null;
  async function responder(j) {
    if (enviando || c.respondida) return;
    setEnviando(true);
    await agir(`/api/correio/${c.id}`, { acao: "responder", escolha: j }, (r) => (r.acertou ? `Acertou! +🪙 ${r.moedas}` : `Quase! A certa era a ${LETRAS[r.correta]}.`));
    setEnviando(false);
  }
  return (
    <>
      <p className="co-carta__texto">{emLinha(p.pergunta)}</p>
      {p.codigo && <Codigo texto={p.codigo} linguagem={p.linguagem} />}
      <div className="co-opcoes" role="group" aria-label="Opções">
        {p.opcoes.map((o, j) => {
          let classe = "quiz__opcao";
          if (c.respondida && j === p.correta) classe += " quiz__opcao--certa";
          else if (c.respondida && j === c.escolha) classe += " quiz__opcao--errada";
          return (
            <button key={j} type="button" className={classe} disabled={c.respondida || enviando} onClick={() => responder(j)}>
              <span className="quiz__letra">{LETRAS[j]}</span><span>{emLinha(o)}</span>
            </button>
          );
        })}
      </div>
      {c.respondida && (
        <p className="pf-estat__nota">{c.acertou ? `✓ Você acertou · +🪙 ${c.moedas}` : "✗ Não foi dessa vez."}{p.explicacao ? ` ${p.explicacao}` : ""}</p>
      )}
    </>
  );
}
