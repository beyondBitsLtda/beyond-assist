"use client";

// O Mascote Programável (BEYOND-0023, o "Tamagotchi de código"): a pessoa escreve `decidir(ver)` e o simulador
// roda a função a cada passo (no Worker do navegador, com tempo-limite). A tela anima o rastro; venceu, o
// servidor roda o mesmo simulador no Node e grava o nível.

import { useEffect, useMemo, useRef, useState } from "react";
import EditorDeCodigo from "@/componentes/codigo/EditorDeCodigo.js";
import { comemorar, reagir } from "@/componentes/Neuro.js";
import Sprite from "./PixelArt.js";
import { rodarNaArena, codigoGuardado, guardarCodigo } from "./rodarNaArena.js";
import { arnesDoMascote } from "@/dominio/arena.js";

const GIRO = { N: -90, L: 0, S: 90, O: 180 };

export default function Mascote({ niveis, aoConferir, aoExplicar }) {
  const primeiro = niveis.find((n) => n.liberada && !n.concluida) || niveis.find((n) => n.liberada) || niveis[0];
  const [nivelId, setNivelId] = useState(primeiro.id);
  const nivel = niveis.find((n) => n.id === nivelId);
  return (
    <div className="ar-mascote">
      <div className="ar-fases" role="tablist" aria-label="Níveis">
        {niveis.map((n, i) => (
          <button key={n.id} type="button" role="tab" aria-selected={n.id === nivelId} className="ar-fase" disabled={!n.liberada} onClick={() => setNivelId(n.id)}>
            {n.concluida ? "✅" : n.liberada ? "🐣" : "🔒"} {i + 1}. {n.nome}
          </button>
        ))}
      </div>
      <Nivel key={nivel.id} nivel={nivel} aoConferir={aoConferir} aoExplicar={aoExplicar} />
    </div>
  );
}

function Nivel({ nivel, aoConferir, aoExplicar }) {
  const [codigo, setCodigo] = useState(() => codigoGuardado(`mascote:${nivel.id}`, nivel.codigoInicial));
  const [rodando, setRodando] = useState(false);
  const [quadro, setQuadro] = useState(null); // { x, y, dir, comidas: Set, i }
  const [resultado, setResultado] = useState(null);
  const [salvo, setSalvo] = useState(null);
  const [explicacao, setExplicacao] = useState(null);
  const relogio = useRef(null);
  const inicio = useRef(Date.now());
  const comidasDoMapa = useMemo(() => nivel.mapa.flatMap((l, y) => [...l].map((c, x) => (c === "C" ? `${x},${y}` : null)).filter(Boolean)), [nivel.mapa]);
  useEffect(() => () => clearInterval(relogio.current), []);

  const pos = quadro || { x: nivel.inicio.x, y: nivel.inicio.y, dir: nivel.inicio.dir, comidas: new Set(), caiu: false };

  async function rodar() {
    clearInterval(relogio.current);
    setRodando(true);
    setResultado(null);
    setSalvo(null);
    setExplicacao(null);
    setQuadro(null);
    const r = await rodarNaArena(arnesDoMascote(nivel.id, codigo));
    const res = r.resultado || { venceu: false, motivo: r.erros.join(" ") || "o código não rodou — tem um laço que não termina?", rastro: [] };
    // anima o rastro, passo a passo (sem movimento: vai direto para o fim)
    const rastro = res.rastro || [];
    const comidas = new Set();
    const aplicar = (p) => {
      if (p.comeu) {
        const d = { N: [0, -1], L: [1, 0], S: [0, 1], O: [-1, 0] }[p.dir];
        comidas.add(`${p.x + d[0]},${p.y + d[1]}`);
      }
      setQuadro({ x: p.x, y: p.y, dir: p.dir, comidas: new Set(comidas), caiu: Boolean(p.caiu || p.bateu) });
    };
    const terminar = async () => {
      setRodando(false);
      setResultado({ ...res, logs: r.logs, erros: r.erros });
      if (res.venceu) {
        reagir("comemorando", "O mascote comeu tudo! 🍎", 3000);
        const s = await aoConferir({ jogo: "mascote", fase: nivel.id, codigo, tempoMs: Date.now() - inicio.current });
        setSalvo(s);
        if (s?.ok && s.recompensa) comemorar(`🐣 Nível vencido! +🪙 ${s.recompensa}`);
      }
    };
    if (!rastro.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rastro.forEach(aplicar);
      return terminar();
    }
    let i = 0;
    relogio.current = setInterval(() => {
      aplicar(rastro[i]);
      i++;
      if (i >= rastro.length) { clearInterval(relogio.current); terminar(); }
    }, Math.max(90, Math.min(260, 6000 / rastro.length)));
  }

  async function explicar() {
    setExplicacao({ carregando: true });
    const r = await aoExplicar({ jogo: "mascote", fase: nivel.id, codigo, erro: resultado?.motivo || "" });
    setExplicacao(r || null);
  }

  return (
    <div className="ar-nivel">
      <p className="pf-estat__nota"><strong>{nivel.nome}</strong> · a ideia: {nivel.ideia} · até {nivel.maxPassos} passos{nivel.concluida ? " · ✅ já vencido (dá para jogar de novo)" : ""}</p>
      <div className="ar-nivel__grade">
        <div className="ar-mapa ar-mapa--grama" style={{ gridTemplateColumns: `repeat(${nivel.mapa[0].length}, 1fr)` }} aria-label="O mundo do mascote">
          {nivel.mapa.flatMap((linha, y) => [...linha].map((c, x) => {
            const aqui = pos.x === x && pos.y === y;
            const comida = c === "C" && !pos.comidas.has(`${x},${y}`);
            return (
              <div key={`${x}-${y}`} className={`ar-celula${c === "#" ? " ar-celula--parede" : c === "~" ? " ar-celula--agua" : ""}`}>
                {aqui ? <span className={pos.caiu ? "ar-mascote__ai" : ""}><Sprite nome="mascote" tamanho="100%" girar={GIRO[pos.dir]} titulo="o mascote" /></span>
                  : comida ? <Sprite nome="comida" tamanho="85%" titulo="comida" /> : null}
              </div>
            );
          }))}
        </div>
        <div className="ar-nivel__codigo">
          <EditorDeCodigo valor={codigo} aoMudar={(c) => { setCodigo(c); guardarCodigo(`mascote:${nivel.id}`, c); }} linguagem="javascript" aoCtrlEnter={rodar} rotulo="A função decidir do mascote" />
          <div className="ar-terminal__acoes">
            <button type="button" className="pf-botao" disabled={rodando} onClick={rodar}>{rodando ? "O mascote está andando…" : "▶ Rodar"}</button>
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => { setCodigo(nivel.codigoInicial); guardarCodigo(`mascote:${nivel.id}`, nivel.codigoInicial); }}>Recomeçar o código</button>
          </div>
          <p className="ar-dica">💡 {nivel.dica}</p>
        </div>
      </div>
      {resultado && (
        <div className={`pf-aviso ${resultado.venceu ? "pf-aviso--ok" : "pf-aviso--erro"}`} role="status">
          {resultado.venceu ? `🍎 Comeu tudo em ${resultado.passos} passos!` : `😵 ${resultado.motivo}`}
          {resultado.venceu && salvo && (salvo.ok ? (salvo.recompensa ? ` Nível gravado: +🪙 ${salvo.recompensa}.` : " Nível gravado.") : " (o servidor não confirmou — rode de novo)")}
          {!resultado.venceu && (
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={explicacao?.carregando} onClick={explicar}>🧠 A Lisa explica</button>
          )}
        </div>
      )}
      {resultado?.logs?.length > 0 && <pre className="ar-console">{resultado.logs.join("\n")}</pre>}
      {explicacao && !explicacao.carregando && <div className="ar-explicacao"><strong>🧠 A Lisa:</strong> {explicacao.explicacao} <em>{explicacao.ondeOlhar}</em></div>}
      {explicacao?.carregando && <p className="pf-estat__nota">A Lisa está lendo o seu código…</p>}
      <p className="pf-estat__nota">{comidasDoMapa.length} comida(s) no mapa · o mascote vê <code>ver.frente</code>, <code>ver.esquerda</code> e <code>ver.direita</code>.</p>
    </div>
  );
}
