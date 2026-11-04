"use client";

// A conversa com a Lisa (31/10/2026): uma situação na língua do curso. A Lisa faz um papel; a pessoa
// escreve as falas; cada fala volta com a resposta dela e, se precisar, a correção em português. No
// fim, a Lisa avalia a conversa pela rubrica. As regras moram em src/dominio/conversa.js.

import { useEffect, useRef, useState } from "react";
import { criar } from "@/lib/api.js";
import { turnosDe, falasDaPessoa, LIMITES_DA_CONVERSA } from "@/dominio/conversa.js";
import { reagir } from "../Neuro.js";
import { useAviso } from "../Pecas.js";
import { Avaliacao } from "./Retorno.js";
import { Cabecalho, Rodape, reagirACorrecao, falar } from "./Motores.js";

export function ConversaComALisa({ desafio }) {
  const c = desafio.conteudo;
  const [turnos, setTurnos] = useState(() => turnosDe(desafio));
  const [terminou, setTerminou] = useState(Boolean(desafio.resposta?.terminou));
  const [mensagem, setMensagem] = useState("");
  const [resultado, setResultado] = useState(desafio.status === "concluido" ? { avaliacao: desafio.avaliacao, nota: desafio.nota } : null);
  const [ocupado, setOcupado] = useState("");
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();
  const fim = useRef(null);
  const falas = falasDaPessoa(turnos);
  const maximo = c.falas || LIMITES_DA_CONVERSA.falas;
  const podeFalar = !resultado && !terminou && falas < maximo;

  useEffect(() => { fim.current?.scrollIntoView({ block: "nearest" }); }, [turnos.length]);

  async function enviar(e) {
    e.preventDefault();
    if (!mensagem.trim() || ocupado) return;
    setOcupado("falar");
    setErro("");
    try {
      const r = await criar(`/api/desafios/${desafio.id}/conversa`, { mensagem: mensagem.trim() });
      setTurnos(r.turnos);
      setTerminou(r.terminou);
      setMensagem("");
      const ultima = r.turnos.at(-1);
      if (ultima?.quem === "lisa") falar(ultima.texto, c.idioma);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setOcupado("");
    }
  }

  async function encerrar() {
    setOcupado("encerrar");
    setErro("");
    reagir("pensando", "Relendo a nossa conversa…", 30000);
    try {
      const r = await criar(`/api/desafios/${desafio.id}/enviar`, { encerrar: true });
      setResultado({ avaliacao: r.avaliacao, nota: r.nota });
      reagirACorrecao(r, avisar);
    } catch (falha) {
      setErro(falha.message);
      reagir("surpreso", "Ops, não consegui avaliar agora.");
    } finally {
      setOcupado("");
    }
  }

  return (
    <div className="desafio">
      <Cabecalho desafio={desafio}>
        <p className="desafio__texto" style={{ margin: 0 }}><strong>Cena:</strong> {c.cenario} A Lisa é {c.papel}.</p>
        <p className="desafio__texto" style={{ margin: 0 }}><strong>Seu objetivo:</strong> {c.objetivo}</p>
        <small className="pf-estat__nota" style={{ margin: 0 }}>Nível {c.nivel} · escreva na língua do curso · até {maximo} falas suas · 🔊 ouve a fala da Lisa</small>
        {c.dicas?.length > 0 && <details><summary>Expressões que ajudam</summary><ul>{c.dicas.map((d) => <li key={d}>{d}</li>)}</ul></details>}
      </Cabecalho>
      <section className="pf-cartao conversa" aria-label="A conversa">
        <ol className="conversa__turnos">
          {turnos.map((t, i) => (
            <li key={i} className={`conversa__fala conversa__fala--${t.quem}`}>
              <span className="conversa__quem">{t.quem === "lisa" ? `Lisa · ${c.papel}` : "Você"}</span>
              <p lang={c.idioma}>{t.texto}</p>
              {t.quem === "lisa" && <button type="button" className="conversa__ouvir" aria-label="Ouvir a fala da Lisa" onClick={() => falar(t.texto, c.idioma)}>🔊</button>}
              {t.correcao && <small className="conversa__correcao">✏️ {t.correcao}</small>}
            </li>
          ))}
        </ol>
        <div ref={fim} />
        {podeFalar ? (
          <form className="conversa__enviar" onSubmit={enviar}>
            <textarea className="pf-campo__entrada" rows={2} maxLength={LIMITES_DA_CONVERSA.mensagem} value={mensagem} lang={c.idioma} disabled={Boolean(ocupado)}
              aria-label="Sua fala" placeholder="Sua fala…" onChange={(e) => setMensagem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(e); } }} />
            <button type="submit" className="pf-botao" disabled={Boolean(ocupado) || !mensagem.trim()}>{ocupado === "falar" ? "…" : "Enviar"}</button>
          </form>
        ) : !resultado && (
          <p className="pf-estat__nota" style={{ margin: 0 }}>{terminou ? "A cena chegou ao fim. 🎬" : "Suas falas acabaram."} Encerre para a Lisa avaliar.</p>
        )}
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        {!resultado && (
          <div className="pf-acoes" style={{ alignItems: "center" }}>
            <button type="button" className={`pf-botao${podeFalar ? " pf-botao--sec" : ""}`} disabled={Boolean(ocupado) || falas < LIMITES_DA_CONVERSA.minimoDeFalas} onClick={encerrar}>
              {ocupado === "encerrar" ? "A Lisa está avaliando…" : "Encerrar e avaliar"}
            </button>
            <span className="pf-estat__nota" style={{ margin: 0 }}>{falas} de {maximo} falas{falas < LIMITES_DA_CONVERSA.minimoDeFalas ? ` · a avaliação abre com ${LIMITES_DA_CONVERSA.minimoDeFalas}` : ""}</span>
          </div>
        )}
        <Rodape concluido={Boolean(resultado)} rodada={desafio.rodada} maxRodadas={desafio.maxRodadas} />
      </section>
      {resultado && <Avaliacao avaliacao={resultado.avaliacao} nota={resultado.nota} />}
      {Aviso}
    </div>
  );
}
