"use client";

// O passo a passo e o gráfico de arrastar (31/10/2026): a resolução linha a linha, conferida no
// servidor (src/dominio/passos.js), e os pontos no plano cartesiano (src/dominio/grafico.js).

import { useRef, useState } from "react";
import { analisar, FORMAS } from "@/dominio/expressao.js";
import { lerLinhas } from "@/dominio/passos.js";
import { LIMITE_DO_PLANO, inicioDosPontos, lerPontos } from "@/dominio/grafico.js";
import { Avaliacao } from "./Retorno.js";
import { Cabecalho, Rodape } from "./Motores.js";
import { useCorrecao } from "./MotoresDeMusica.js";

// ================================================================ passo a passo

/** O que não dá para ler numa linha (antes de enviar, para não perder a tentativa por um parêntese). */
function avisoDaLinha(linha, item) {
  const partes = linha.split(item.tipo === "equacao" ? /=|\bou\b|;|,\s*(?=[a-z]\s*=)/i : /$^/).map((p) => p.trim()).filter(Boolean);
  if (item.tipo === "equacao" && !linha.includes("=")) return "falta o sinal de igual";
  for (const p of partes) {
    try { analisar(p, item.variavel || "x"); } catch (e) { return e.message; }
  }
  return "";
}

export function PassoAPasso({ desafio }) {
  const c = desafio.conteudo;
  const inicial = desafio.resposta?.respostas || [];
  const [textos, setTextos] = useState(() => c.itens.map((_, i) => String(inicial[i] || "")));
  const { resultado, enviando, erro, enviar, Aviso } = useCorrecao(desafio);
  const itens = resultado?.conteudo?.itens || c.itens;
  const vazios = textos.filter((t) => !lerLinhas(t).length).length;

  return (
    <div className="desafio">
      <Cabecalho desafio={desafio}>
        <p className="desafio__texto" style={{ margin: 0 }}>
          {c.instrucoes || "Resolva escrevendo uma linha por passo."} Cada linha é conferida com a anterior: se errar, a correção mostra a linha em que o erro nasceu.
        </p>
        <small className="pf-estat__nota" style={{ margin: 0 }}>Use ^ para potência (x^2), * ou nada para multiplicar, sqrt() para raiz. Na equação, termine isolando o x: <code>x = 4</code> ou <code>x = 2 ou x = 3</code>.</small>
      </Cabecalho>
      <form className="pf-cartao motor" onSubmit={(e) => { e.preventDefault(); enviar(textos); }}>
        <ol className="motor__itens">
          {itens.map((it, i) => {
            const correcao = resultado?.correcao?.itens?.[i];
            const linhas = lerLinhas(textos[i]);
            return (
              <li key={i} className={correcao ? (correcao.certo ? "motor__item--certo" : "motor__item--errado") : undefined}>
                <span>{it.enunciado}: <code className="passos__inicio">{it.inicio}</code>{it.tipo === "expressao" && <small className="pf-estat__nota"> · forma pedida: {FORMAS[it.forma]}</small>}</span>
                {!resultado ? (
                  <>
                    <textarea className="pf-campo__entrada motor__entrada" rows={Math.min(8, Math.max(3, linhas.length + 1))} value={textos[i]} disabled={enviando}
                      aria-label={`Resolução do problema ${i + 1}, uma linha por passo`} spellCheck={false}
                      placeholder={it.tipo === "equacao" ? "2x = 11 - 3\nx = 4" : "x^2 + 6x + 9 - 9\nx(x + 6)"}
                      onChange={(e) => setTextos((ts) => ts.map((t, n) => (n === i ? e.target.value : t)))} />
                    {linhas.map((l, k) => { const aviso = avisoDaLinha(l, it); return aviso ? <small key={k} className="motor__aviso">Linha {k + 1}: {aviso}</small> : null; })}
                  </>
                ) : (
                  <ol className="passos__linhas">
                    {linhas.map((l, k) => {
                      const marca = correcao?.linhas?.[k];
                      return (
                        <li key={k} className={marca ? (marca.ok ? "passos__linha--ok" : "passos__linha--erro") : "passos__linha--nao"}>
                          <code>{l}</code> {marca ? (marca.ok ? "✓" : "✗") : ""}
                        </li>
                      );
                    })}
                  </ol>
                )}
                {correcao && !correcao.certo && <small className="pf-estat__nota">{correcao.motivo}</small>}
                {resultado && it.tipo === "expressao" && it.resposta && <small className="pf-estat__nota">Uma resposta: <code>{it.resposta}</code></small>}
              </li>
            );
          })}
        </ol>
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        {!resultado && (
          <div className="pf-acoes" style={{ alignItems: "center" }}>
            <button type="submit" className="pf-botao" disabled={enviando || vazios > 0}>{enviando ? "Conferindo…" : "Conferir os passos"}</button>
            {vazios > 0 && <span className="pf-estat__nota" style={{ margin: 0 }}>Falta resolver {vazios}.</span>}
          </div>
        )}
        <Rodape concluido={Boolean(resultado)} rodada={desafio.rodada} maxRodadas={desafio.maxRodadas} />
      </form>
      {resultado && <Avaliacao avaliacao={resultado.avaliacao} nota={resultado.nota} />}
      {Aviso}
    </div>
  );
}

// ================================================================ gráfico

const L = LIMITE_DO_PLANO;
const tela = (x, y) => [x + L + 1, L + 1 - y]; // o plano de −6 a 6 numa caixa de 14 × 14
const menos = (n) => (n < 0 ? `−${Math.abs(n)}` : String(n));

/** O plano com a grade, os eixos, os pontos arrastáveis, a reta deles e (depois de corrigir) a parábola. */
function Plano({ item, pontos, aoMover, travado, coeficientes }) {
  const svg = useRef(null);
  const arrastando = useRef(null);
  const paraPlano = (ev) => {
    const ctm = svg.current?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    const lim = (v) => Math.max(-L, Math.min(L, Math.round(v)));
    return [lim(p.x - L - 1), lim(L + 1 - p.y)];
  };
  const linhas = [];
  for (let k = -L; k <= L; k++) {
    const [a] = tela(k, 0);
    const [, b] = tela(0, k);
    linhas.push(<line key={`v${k}`} x1={a} y1={1} x2={a} y2={2 * L + 1} className={k === 0 ? "grafico__eixo" : "grafico__grade"} />);
    linhas.push(<line key={`h${k}`} x1={1} y1={b} x2={2 * L + 1} y2={b} className={k === 0 ? "grafico__eixo" : "grafico__grade"} />);
  }
  // a reta pelos dois pontos, esticada até a borda
  let reta = null;
  if (item.tipo === "reta" && pontos.length === 2 && (pontos[0][0] !== pontos[1][0] || pontos[0][1] !== pontos[1][1])) {
    const [[x1, y1], [x2, y2]] = pontos;
    const ext = (t) => tela(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    const [a, b] = ext(-20), [c, d] = ext(20);
    reta = <line x1={a} y1={b} x2={c} y2={d} className="grafico__reta" />;
  }
  let parabola = null;
  if (coeficientes) {
    const pts = [];
    for (let x = -L; x <= L + 0.001; x += 0.1) {
      const y = coeficientes[0] * x * x + coeficientes[1] * x + coeficientes[2];
      if (y >= -L - 1 && y <= L + 1) pts.push(tela(x, y).join(","));
    }
    parabola = <polyline points={pts.join(" ")} className="grafico__parabola" />;
  }
  return (
    <svg ref={svg} viewBox={`0 0 ${2 * L + 2} ${2 * L + 2}`} className="grafico__plano" role="group" aria-label={`Plano cartesiano: ${item.pedido}`}
      onPointerMove={(ev) => { if (arrastando.current == null || travado) return; const p = paraPlano(ev); if (p) aoMover(arrastando.current, p); }}
      onPointerUp={() => { arrastando.current = null; }} onPointerLeave={() => { arrastando.current = null; }}>
      {linhas}
      {parabola}
      {reta}
      {pontos.map(([x, y], k) => {
        const [cx, cy] = tela(x, y);
        return (
          <circle key={k} cx={cx} cy={cy} r={0.45} className={`grafico__ponto${travado ? "" : " grafico__ponto--solto"}`} tabIndex={travado ? -1 : 0}
            aria-label={`Ponto ${k + 1} em (${menos(x)}, ${menos(y)}) — use as setas para mover`}
            onPointerDown={(ev) => { if (travado) return; ev.preventDefault(); ev.currentTarget.setPointerCapture?.(ev.pointerId); arrastando.current = k; }}
            onKeyDown={(ev) => {
              if (travado) return;
              const passo = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[ev.key];
              if (!passo) return;
              ev.preventDefault();
              aoMover(k, [Math.max(-L, Math.min(L, x + passo[0])), Math.max(-L, Math.min(L, y + passo[1]))]);
            }} />
        );
      })}
    </svg>
  );
}

export function Grafico({ desafio }) {
  const c = desafio.conteudo;
  const inicial = desafio.resposta?.respostas || [];
  const [pontos, setPontos] = useState(() => c.itens.map((it, i) => {
    const lidos = lerPontos(inicial[i]);
    return lidos.length === it.pontos ? lidos : inicioDosPontos(it.pontos);
  }));
  const [mexidos, setMexidos] = useState(() => c.itens.map((_, i) => Boolean(inicial[i])));
  const { resultado, enviando, erro, enviar, Aviso } = useCorrecao(desafio);
  const itens = resultado?.conteudo?.itens || c.itens;
  const mover = (i) => (k, p) => {
    setPontos((ps) => ps.map((lista, n) => (n === i ? lista.map((q, j) => (j === k ? p : q)) : lista)));
    setMexidos((ms) => ms.map((m, n) => (n === i ? true : m)));
  };
  const faltam = mexidos.filter((m) => !m).length;

  return (
    <div className="desafio">
      <Cabecalho desafio={desafio}>
        <p className="desafio__texto" style={{ margin: 0 }}>Arraste os pontos no plano (eles encaixam nos números inteiros). No teclado: Tab escolhe o ponto e as setas movem.</p>
      </Cabecalho>
      <form className="pf-cartao motor" onSubmit={(e) => { e.preventDefault(); enviar(pontos.map((ps) => ps.map((p) => p.join(",")).join(";"))); }}>
        <ol className="motor__itens grafico__itens">
          {itens.map((it, i) => {
            const correcao = resultado?.correcao?.itens?.[i];
            return (
              <li key={i} className={correcao ? (correcao.certo ? "motor__item--certo" : "motor__item--errado") : undefined}>
                <strong>{it.pedido}</strong>
                <Plano item={it} pontos={pontos[i]} aoMover={mover(i)} travado={Boolean(resultado) || enviando} coeficientes={resultado ? it.coeficientes : null} />
                <small className="pf-estat__nota">{pontos[i].map(([x, y]) => `(${menos(x)}, ${menos(y)})`).join(" e ")}</small>
                {correcao && !correcao.certo && <small className="pf-estat__nota">{correcao.motivo}</small>}
              </li>
            );
          })}
        </ol>
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        {!resultado && (
          <div className="pf-acoes" style={{ alignItems: "center" }}>
            <button type="submit" className="pf-botao" disabled={enviando}>{enviando ? "Conferindo…" : "Conferir"}</button>
            {faltam > 0 && <span className="pf-estat__nota" style={{ margin: 0 }}>Você ainda não mexeu em {faltam} {faltam === 1 ? "gráfico" : "gráficos"}.</span>}
          </div>
        )}
        <Rodape concluido={Boolean(resultado)} rodada={desafio.rodada} maxRodadas={desafio.maxRodadas} />
      </form>
      {resultado && <Avaliacao avaliacao={resultado.avaliacao} nota={resultado.nota} />}
      {Aviso}
    </div>
  );
}
