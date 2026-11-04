"use client";

// A Masmorra da Depuração (BEYOND-0023): o herói anda pelo andar (setas do teclado ou os botões); encostou numa
// porta, armadilha ou inimigo, abre o terminal com o bug. Consertou (os testes passam no navegador), o caminho
// abre. Com os dois bugs consertados, a escada leva à conferência do servidor, que grava o andar e paga.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EditorDeCodigo from "@/componentes/codigo/EditorDeCodigo.js";
import { comemorar, reagir } from "@/componentes/Neuro.js";
import Sprite from "./PixelArt.js";
import { rodarNaArena, codigoGuardado, guardarCodigo } from "./rodarNaArena.js";
import { arnesDoBug } from "@/dominio/arena.js";

const PASSOS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const TIPO = { sintaxe: "erro de sintaxe", logica: "erro de lógica", desempenho: "lento demais" };

function lerMapa(mapa) {
  const pos = {};
  mapa.forEach((linha, y) => [...linha].forEach((c, x) => { if ("HABS".includes(c)) pos[c] = [x, y]; }));
  return pos;
}

export default function Masmorra({ andares, aoConferir, aoExplicar }) {
  const primeira = andares.find((a) => a.liberada && !a.concluida) || andares.find((a) => a.liberada) || andares[0];
  const [andarId, setAndarId] = useState(primeira.id);
  const andar = andares.find((a) => a.id === andarId);
  return (
    <div className="ar-masmorra">
      <div className="ar-fases" role="tablist" aria-label="Andares">
        {andares.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={a.id === andarId} className="ar-fase" disabled={!a.liberada} onClick={() => setAndarId(a.id)}>
            {a.concluida ? "✅" : a.liberada ? "🗝️" : "🔒"} {a.nome.split(" · ")[0]}
          </button>
        ))}
      </div>
      <Andar key={andar.id} andar={andar} aoConferir={aoConferir} aoExplicar={aoExplicar} />
    </div>
  );
}

function Andar({ andar, aoConferir, aoExplicar }) {
  const pos = useMemo(() => lerMapa(andar.mapa), [andar.mapa]);
  const [heroi, setHeroi] = useState(pos.H);
  const [consertados, setConsertados] = useState(() => new Set(andar.concluida ? andar.bugs.map((b) => b.id) : []));
  const [aberto, setAberto] = useState(null); // o bug no terminal
  const [codigos, setCodigos] = useState(() => Object.fromEntries(andar.bugs.map((b) => [b.id, codigoGuardado(`masmorra:${b.id}`, b.codigo)])));
  const [conferindo, setConferindo] = useState(false);
  const [fim, setFim] = useState(null);
  const inicio = useRef(Date.now());
  const mapaRef = useRef(null);
  const bugNa = useMemo(() => ({ A: andar.bugs[0], B: andar.bugs[1] }), [andar.bugs]);
  const heroiRef = useRef(heroi);
  heroiRef.current = heroi;

  const mover = useCallback((dx, dy) => {
    if (aberto) return;
    const [x, y] = heroiRef.current;
    const nx = x + dx, ny = y + dy;
    const c = andar.mapa[ny]?.[nx];
    if (!c || c === "#") return;
    if ((c === "A" || c === "B") && !consertados.has(bugNa[c].id)) { setAberto(bugNa[c].id); return; }
    setHeroi([nx, ny]);
  }, [aberto, andar.mapa, consertados, bugNa]);

  useEffect(() => {
    const el = mapaRef.current;
    if (!el) return undefined;
    const tecla = (e) => { const p = PASSOS[e.key]; if (p) { e.preventDefault(); mover(p[0], p[1]); } };
    el.addEventListener("keydown", tecla);
    return () => el.removeEventListener("keydown", tecla);
  }, [mover]);

  const naEscada = heroi[0] === pos.S[0] && heroi[1] === pos.S[1];
  async function concluir() {
    setConferindo(true);
    const r = await aoConferir({ jogo: "masmorra", fase: andar.id, codigos, tempoMs: Date.now() - inicio.current });
    setConferindo(false);
    if (r) setFim(r);
  }

  const consertar = (bugId) => {
    setConsertados((s) => new Set([...s, bugId]));
    setAberto(null);
    comemorar("🗝️ Bug consertado! O caminho abriu.");
    setTimeout(() => mapaRef.current?.focus(), 50);
  };

  return (
    <div className="ar-andar">
      <p className="pf-estat__nota">{andar.nome} — {andar.concluida ? "andar concluído (dá para jogar de novo)." : "ande até os bugs (setas do teclado ou os botões) e conserte o código para passar."}</p>
      <div className={`ar-mapa ar-mapa--${andar.paleta}`} ref={mapaRef} tabIndex={0} aria-label="Mapa do andar: use as setas do teclado para andar"
        style={{ gridTemplateColumns: `repeat(${andar.mapa[0].length}, 1fr)` }}>
        {andar.mapa.flatMap((linha, y) => [...linha].map((c, x) => {
          const aqui = heroi[0] === x && heroi[1] === y;
          const bug = c === "A" || c === "B" ? bugNa[c] : null;
          const vivo = bug && !consertados.has(bug.id);
          return (
            <div key={`${x}-${y}`} className={`ar-celula${c === "#" ? " ar-celula--parede" : ""}`}>
              {aqui ? <Sprite nome="heroi" tamanho="100%" titulo="o herói" />
                : vivo ? <button type="button" className="ar-obstaculo" onClick={() => setAberto(bug.id)} aria-label={`${bug.nome} (${TIPO[bug.tipo]}) — abrir o terminal`}><Sprite nome={bug.obstaculo} tamanho="100%" /></button>
                : bug ? <Sprite nome="brilho" tamanho="70%" />
                : c === "S" ? <Sprite nome="escada" tamanho="100%" titulo="a escada" /> : null}
            </div>
          );
        }))}
      </div>
      <div className="ar-controles">
        <div className="ar-dpad" aria-label="Andar">
          <button type="button" onClick={() => mover(0, -1)} aria-label="Para cima">▲</button>
          <button type="button" onClick={() => mover(-1, 0)} aria-label="Para a esquerda">◀</button>
          <button type="button" onClick={() => mover(1, 0)} aria-label="Para a direita">▶</button>
          <button type="button" onClick={() => mover(0, 1)} aria-label="Para baixo">▼</button>
        </div>
        <div className="ar-placar">
          {andar.bugs.map((b) => <span key={b.id} className="pf-pilula">{consertados.has(b.id) ? "✅" : "🐛"} {b.nome}</span>)}
        </div>
      </div>
      {naEscada && consertados.size === andar.bugs.length && !fim && (
        <div className="pf-cartao ar-chegada">
          <strong>🪜 Você chegou à escada!</strong> O servidor confere o seu código e grava o andar.
          <button type="button" className="pf-botao" disabled={conferindo} onClick={concluir}>{conferindo ? "Conferindo…" : "Concluir o andar"}</button>
        </div>
      )}
      {fim && (
        <div className={`pf-aviso ${fim.ok ? "pf-aviso--ok" : "pf-aviso--erro"}`} role="status">
          {fim.ok ? `🏆 Andar concluído!${fim.recompensa ? ` +🪙 ${fim.recompensa} no reino.` : ""}` : "O servidor não confirmou um dos consertos — rode os testes de novo."}
        </div>
      )}
      {aberto && (
        <Terminal bug={andar.bugs.find((b) => b.id === aberto)} codigo={codigos[aberto]} fase={andar.id}
          aoMudar={(c) => { setCodigos((t) => ({ ...t, [aberto]: c })); guardarCodigo(`masmorra:${aberto}`, c); }}
          aoConsertar={() => consertar(aberto)} aoFechar={() => { setAberto(null); setTimeout(() => mapaRef.current?.focus(), 50); }} aoExplicar={aoExplicar} />
      )}
    </div>
  );
}

/** O mini terminal de depuração: o bug, o editor, os testes rodando na hora e a explicação da Lisa. */
function Terminal({ bug, codigo, fase, aoMudar, aoConsertar, aoFechar, aoExplicar }) {
  const [rodando, setRodando] = useState(false);
  const [saida, setSaida] = useState(null);
  const [explicacao, setExplicacao] = useState(null);
  const [verDica, setVerDica] = useState(false);

  async function rodar() {
    setRodando(true);
    setExplicacao(null);
    const r = await rodarNaArena(arnesDoBug(bug.id, codigo));
    setSaida(r);
    setRodando(false);
    if (r.resultado?.length && r.resultado.every((t) => t.ok)) { reagir("comemorando", "Todos os testes passaram! 🎉", 3000); setTimeout(aoConsertar, 900); }
  }
  async function explicar() {
    const erro = saida?.erros?.join("\n") || saida?.resultado?.map((t, i) => (t.ok ? "" : `teste ${i + 1}: ${t.erro || `deu ${JSON.stringify(t.obtido)}, esperava ${bug.testes[i].esperado}${t.lento ? " (lento demais)" : ""}`}`)).filter(Boolean).join("\n") || "";
    setExplicacao({ carregando: true });
    const r = await aoExplicar({ jogo: "masmorra", fase, bug: bug.id, codigo, erro });
    setExplicacao(r || null);
  }

  return (
    <section className="pf-cartao ar-terminal" aria-label={`Terminal: ${bug.nome}`}>
      <div className="ar-terminal__topo">
        <Sprite nome={bug.obstaculo} tamanho={40} />
        <div>
          <h3>{bug.nome} <span className="pf-pilula">{TIPO[bug.tipo]}</span></h3>
          <p className="pf-estat__nota">{bug.enunciado.replace(/`/g, "")}</p>
        </div>
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={aoFechar}>Fechar</button>
      </div>
      <table className="ar-testes">
        <thead><tr><th scope="col">{bug.funcao}(…)</th><th scope="col">esperado</th><th scope="col">deu</th></tr></thead>
        <tbody>
          {bug.testes.map((t, i) => {
            const r = saida?.resultado?.[i];
            return (
              <tr key={i} className={r ? (r.ok ? "ar-testes--ok" : "ar-testes--erro") : ""}>
                <td><code>{t.entrada}</code></td><td><code>{t.esperado}</code></td>
                <td>{r ? (r.ok ? `✔ ${r.ms} ms` : r.erro ? `✘ ${r.erro}` : `✘ ${JSON.stringify(r.obtido)}${r.lento ? ` (${r.ms} ms: lento)` : ""}`) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <EditorDeCodigo valor={codigo} aoMudar={aoMudar} linguagem="javascript" aoCtrlEnter={rodar} rotulo={`Código de ${bug.funcao}`} />
      <div className="ar-terminal__acoes">
        <button type="button" className="pf-botao" disabled={rodando} onClick={rodar}>{rodando ? "Rodando…" : "▶ Rodar os testes"}</button>
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setVerDica((v) => !v)}>💡 Dica</button>
        {saida && !(saida.resultado?.every((t) => t.ok)) && (
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={explicacao?.carregando} onClick={explicar}>🧠 A Lisa explica o erro</button>
        )}
      </div>
      {verDica && <p className="ar-dica">💡 {bug.dica}</p>}
      {saida?.erros?.length > 0 && <pre className="ar-console ar-console--erro">{saida.erros.join("\n")}</pre>}
      {saida?.logs?.length > 0 && <pre className="ar-console">{saida.logs.join("\n")}</pre>}
      {saida && !saida.resultado && !saida.erros.length && <p className="pf-estat__nota">Os testes não chegaram a rodar — o código tem um laço que não termina?</p>}
      {explicacao && !explicacao.carregando && (
        <div className="ar-explicacao"><strong>🧠 A Lisa:</strong> {explicacao.explicacao} <em>{explicacao.ondeOlhar}</em></div>
      )}
      {explicacao?.carregando && <p className="pf-estat__nota">A Lisa está lendo o seu código…</p>}
    </section>
  );
}
