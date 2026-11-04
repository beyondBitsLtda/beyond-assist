"use client";

// Os Quebra-cabeças de Parsons (BEYOND-0023): os blocos vêm embaralhados e sem recuo. Arraste (ou use os botões
// ↑ ↓ para a ordem e ⇤ ⇥ para o recuo) e confira: quem confere é o servidor, que sabe a resposta.

import { useRef, useState } from "react";
import { comemorar } from "@/componentes/Neuro.js";
import { RECUO_MAXIMO } from "@/dominio/arena.js";

const NOMES = { python: "Python", javascript: "JavaScript", c: "C", php: "PHP", java: "Java" };

export default function Parsons({ puzzles, aoConferir, linguagens = [] }) {
  const primeiro = puzzles.find((p) => p.liberada && !p.concluida) || puzzles.find((p) => p.liberada) || puzzles[0];
  const [puzzleId, setPuzzleId] = useState(primeiro.id);
  // a linguagem do plano de estudo (com mais de uma trilha de programação, dá para trocar)
  const [linguagem, setLinguagem] = useState(linguagens[0]?.chave || primeiro.linguagem);
  const base = puzzles.find((p) => p.id === puzzleId);
  const versao = base.versoes?.[linguagem] || { linguagem: base.linguagem, blocos: base.blocos, nota: "" };
  const puzzle = { ...base, ...versao };
  return (
    <div className="ar-parsons">
      {linguagens.length > 1 && (
        <div className="ar-linguagens" role="radiogroup" aria-label="Linguagem dos blocos (as do seu plano de estudo)">
          <span className="pf-campo__rotulo">Do seu plano:</span>
          {linguagens.map((l) => (
            <button key={l.chave} type="button" role="radio" aria-checked={linguagem === l.chave} className={`bc-chip${linguagem === l.chave ? " bc-chip--ativo" : ""}`} onClick={() => setLinguagem(l.chave)}>{l.nome}</button>
          ))}
        </div>
      )}
      <div className="ar-fases" role="tablist" aria-label="Quebra-cabeças">
        {puzzles.map((p, i) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.id === puzzleId} className="ar-fase" disabled={!p.liberada} onClick={() => setPuzzleId(p.id)}>
            {p.concluida ? "✅" : p.liberada ? "🧩" : "🔒"} {i + 1}. {p.titulo}
          </button>
        ))}
      </div>
      <Quebra key={`${puzzle.id}:${puzzle.linguagem}`} puzzle={puzzle} aoConferir={aoConferir} />
    </div>
  );
}

function Quebra({ puzzle, aoConferir }) {
  const [blocos, setBlocos] = useState(() => puzzle.blocos.map((b) => ({ ...b, recuo: 0 })));
  const [conferindo, setConferindo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const arrastando = useRef(null);
  const inicio = useRef(Date.now());
  const passo = puzzle.linguagem === "python" ? 4 : 2;

  const mover = (i, para) => setBlocos((l) => {
    if (para < 0 || para >= l.length) return l;
    const nova = [...l];
    const [b] = nova.splice(i, 1);
    nova.splice(para, 0, b);
    return nova;
  });
  const recuar = (i, delta) => setBlocos((l) => l.map((b, j) => (j === i ? { ...b, recuo: Math.max(0, Math.min(RECUO_MAXIMO, b.recuo + delta)) } : b)));

  async function conferir() {
    setConferindo(true);
    const r = await aoConferir({ jogo: "parsons", fase: puzzle.id, linguagem: puzzle.linguagem, resposta: blocos.map((b) => ({ id: b.id, recuo: b.recuo })), tempoMs: Date.now() - inicio.current });
    setConferindo(false);
    setResultado(r);
    if (r?.ok) comemorar(`🧩 Montado!${r.recompensa ? ` +🪙 ${r.recompensa}` : ""}`);
  }

  return (
    <div className="ar-quebra">
      <p className="pf-estat__nota"><strong>{puzzle.titulo}</strong> ({NOMES[puzzle.linguagem] || puzzle.linguagem}) — {puzzle.enunciado}{puzzle.nota ? ` ${puzzle.nota}` : ""}{puzzle.concluida ? " · ✅ já montado" : ""}</p>
      <ol className="ar-blocos" aria-label="Os blocos, na ordem montada">
        {blocos.map((b, i) => (
          <li key={b.id} className="ar-bloco" draggable
            onDragStart={() => { arrastando.current = i; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (arrastando.current !== null) mover(arrastando.current, i); arrastando.current = null; setResultado(null); }}>
            <code className="ar-bloco__texto" style={{ paddingLeft: `${b.recuo * passo * 0.6 + 0.6}em` }}>{b.texto}</code>
            <span className="ar-bloco__botoes">
              <button type="button" onClick={() => { recuar(i, -1); setResultado(null); }} aria-label={`Menos recuo: ${b.texto}`} disabled={!b.recuo}>⇤</button>
              <button type="button" onClick={() => { recuar(i, 1); setResultado(null); }} aria-label={`Mais recuo: ${b.texto}`}>⇥</button>
              <button type="button" onClick={() => { mover(i, i - 1); setResultado(null); }} aria-label={`Subir: ${b.texto}`} disabled={!i}>↑</button>
              <button type="button" onClick={() => { mover(i, i + 1); setResultado(null); }} aria-label={`Descer: ${b.texto}`} disabled={i === blocos.length - 1}>↓</button>
            </span>
          </li>
        ))}
      </ol>
      <div className="ar-terminal__acoes">
        <button type="button" className="pf-botao" disabled={conferindo} onClick={conferir}>{conferindo ? "Conferindo…" : "✔ Conferir"}</button>
      </div>
      {resultado && (
        <div className={`pf-aviso ${resultado.ok ? "pf-aviso--ok" : "pf-aviso--erro"}`} role="status">
          {resultado.ok ? `🧩 Certinho!${resultado.recompensa ? ` +🪙 ${resultado.recompensa} no reino.` : ""}` : `${resultado.certas} de ${resultado.total} linhas no lugar e com o recuo certo. Olhe a ordem e o recuo de novo.`}
        </div>
      )}
    </div>
  );
}
