"use client";

// Ritmo e afinação ao vivo (pedido de 31/10/2026): o metrônomo e o microfone no navegador. A tela
// mede (os instantes dos toques, a altura cantada) e o servidor corrige (src/dominio/musica.js).
// Nada é gravado nem enviado além dos números: o som do microfone é analisado ali mesmo e descartado.

import { useEffect, useRef, useState } from "react";
import { criar } from "@/lib/api.js";
import { alturaSustentada, detectarAltura, nomeDaNota, notaDaFrequencia, centsAteANota } from "@/dominio/musica.js";
import { useAviso } from "../Pecas.js";
import { Avaliacao } from "./Retorno.js";
import { Cabecalho, Rodape, reagirACorrecao, audioDaPagina, tocarNotas } from "./Motores.js";

/** Manda as respostas do treino e devolve a correção (uma tentativa só). */
function useCorrecao(desafio) {
  const c = desafio.conteudo;
  const [resultado, setResultado] = useState(desafio.status === "concluido"
    ? { conteudo: c, correcao: desafio.resposta?.correcao, avaliacao: desafio.avaliacao, nota: desafio.nota } : null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();
  async function enviar(respostas) {
    setEnviando(true);
    setErro("");
    try {
      const r = await criar(`/api/desafios/${desafio.id}/enviar`, { respostas });
      setResultado({ conteudo: r.conteudo, correcao: r.resposta.correcao, avaliacao: r.avaliacao, nota: r.nota });
      reagirACorrecao(r, avisar);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }
  return { resultado, enviando, erro, setErro, enviar, Aviso };
}

// ================================================================ ritmo

/** Um clique do metrônomo (forte na cabeça do compasso) ou a batida do padrão, agendados no relógio do áudio. */
function agendarSom(ctx, quando, tipo) {
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.type = tipo === "batida" ? "triangle" : "square";
  osc.frequency.value = tipo === "batida" ? 660 : tipo === "forte" ? 1760 : 1320;
  const volume = tipo === "batida" ? 0.35 : tipo === "forte" ? 0.1 : 0.06;
  const duracao = tipo === "batida" ? 0.12 : 0.05;
  ganho.gain.setValueAtTime(0.0001, quando);
  ganho.gain.exponentialRampToValueAtTime(volume, quando + 0.005);
  ganho.gain.exponentialRampToValueAtTime(0.0001, quando + duracao);
  osc.connect(ganho).connect(ctx.destination);
  osc.start(quando);
  osc.stop(quando + duracao + 0.05);
}

/** O compasso desenhado: 4 tempos de 4 semicolcheias; o padrão em cima e os toques (se houver) embaixo. */
function Compasso({ batidas, toques, msPorTempo, cursor }) {
  const total = 4 * msPorTempo;
  return (
    <div className="ritmo__compasso" aria-hidden="true">
      <div className="ritmo__grade">
        {Array.from({ length: 16 }, (_, k) => (
          <span key={k} className={`ritmo__celula${k % 4 === 0 ? " ritmo__celula--tempo" : ""}${batidas.some((b) => Math.abs(b * 4 - k) < 0.01) ? " ritmo__celula--batida" : ""}`}>
            {k % 4 === 0 ? k / 4 + 1 : ""}
          </span>
        ))}
      </div>
      <div className="ritmo__toques">
        {(toques || []).filter((ms) => ms > -msPorTempo / 2 && ms < total).map((ms, i) => (
          <i key={i} style={{ left: `${Math.max(0, Math.min(100, ((ms + msPorTempo / 8) / total) * 100))}%` }} />
        ))}
        {cursor != null && <b className="ritmo__cursor" style={{ left: `${Math.max(0, Math.min(100, cursor * 100))}%` }} />}
      </div>
    </div>
  );
}

export function TreinoDeRitmo({ desafio }) {
  const c = desafio.conteudo;
  const msPorTempo = 60_000 / c.bpm;
  const inicial = (desafio.resposta?.respostas || []).map((r) => String(r || "").split(",").filter(Boolean).map(Number));
  const [toques, setToques] = useState(() => c.itens.map((_, i) => inicial[i] || null));
  const [tocando, setTocando] = useState(null); // { item, fase: "contagem" | "compasso", cursor }
  const { resultado, enviando, erro, setErro, enviar, Aviso } = useCorrecao(desafio);
  const sessao = useRef(null); // o compasso sendo tocado agora: { item, ctx, inicioDoCompasso, latencia, toques, quadro, fim }

  useEffect(() => () => { cancelAnimationFrame(sessao.current?.quadro); clearTimeout(sessao.current?.fim); }, []);

  function tocar(i, soOuvir) {
    const ctx = audioDaPagina();
    if (!ctx) { setErro("este navegador não toca som"); return; }
    setErro("");
    const spb = msPorTempo / 1000;
    const t0 = ctx.currentTime + 0.15;
    const inicioDoCompasso = t0 + 4 * spb;
    for (let k = 0; k < 4; k++) agendarSom(ctx, t0 + k * spb, k === 0 ? "forte" : "fraco");      // a contagem
    for (let k = 0; k < 4; k++) agendarSom(ctx, inicioDoCompasso + k * spb, k === 0 ? "forte" : "fraco"); // o metrônomo segue
    if (soOuvir) {
      c.itens[i].batidas.forEach((b) => agendarSom(ctx, inicioDoCompasso + b * spb, "batida"));
      return;
    }
    // o som sai do alto-falante um pouco depois de agendado: quem toca junto do que OUVE toca atrasado
    const latencia = Number(ctx.outputLatency) || Number(ctx.baseLatency) || 0;
    const s = { item: i, ctx, inicioDoCompasso, latencia, toques: [] };
    sessao.current = s;
    const passo = () => {
      const agora = ctx.currentTime;
      const fase = agora < inicioDoCompasso ? "contagem" : "compasso";
      setTocando({ item: i, fase, falta: Math.ceil((inicioDoCompasso - agora) / spb), cursor: fase === "compasso" ? (agora - inicioDoCompasso) / (4 * spb) : null });
      s.quadro = requestAnimationFrame(passo);
    };
    s.quadro = requestAnimationFrame(passo);
    s.fim = setTimeout(() => {
      cancelAnimationFrame(s.quadro);
      sessao.current = null;
      setTocando(null);
      setToques((ts) => ts.map((t, n) => (n === i ? s.toques : t)));
    }, (inicioDoCompasso - ctx.currentTime + 4.5 * spb) * 1000);
  }

  function bater() {
    const s = sessao.current;
    if (!s) return;
    const ms = Math.round((s.ctx.currentTime - s.inicioDoCompasso - s.latencia) * 1000);
    if (ms < -msPorTempo / 2) return; // ainda na contagem
    s.toques.push(ms);
    setToques((ts) => ts.map((t, n) => (n === s.item ? [...s.toques] : t)));
  }

  useEffect(() => {
    if (!tocando) return undefined;
    const tecla = (ev) => { if (ev.code === "Space" || ev.key === " ") { ev.preventDefault(); if (!ev.repeat) bater(); } };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [tocando]); // eslint-disable-line react-hooks/exhaustive-deps

  const faltam = toques.filter((t) => !t?.length).length;
  return (
    <div className="desafio">
      <Cabecalho desafio={desafio}>
        <p className="desafio__texto" style={{ margin: 0 }}>
          Compasso de 4 tempos a {c.bpm} batidas por minuto. Em cada item, ouça primeiro; depois toque em <strong>Tocar</strong>: o metrônomo conta 4 e você bate o ritmo no botão grande (ou na barra de espaço). Os quadrados cheios são onde cai cada batida.
        </p>
        <small className="pf-estat__nota" style={{ margin: 0 }}>Fone de ouvido ajuda. O atraso fixo do aparelho é descontado na correção.</small>
      </Cabecalho>
      <form className="pf-cartao motor" onSubmit={(e) => { e.preventDefault(); enviar(toques.map((t) => (t || []).join(","))); }}>
        <ol className="motor__itens">
          {c.itens.map((it, i) => {
            const correcao = resultado?.correcao?.itens?.[i];
            const agora = tocando?.item === i;
            return (
              <li key={i} className={correcao ? (correcao.certo ? "motor__item--certo" : "motor__item--errado") : undefined}>
                <Compasso batidas={it.batidas} toques={toques[i]} msPorTempo={msPorTempo} cursor={agora ? tocando.cursor : null} />
                {!resultado && (
                  agora ? (
                    <button type="button" className="ritmo__pad" onPointerDown={(e) => { e.preventDefault(); bater(); }}>
                      {tocando.fase === "contagem" ? `Prepare… ${tocando.falta}` : "🥁 Bata aqui"}
                    </button>
                  ) : (
                    <div className="pf-acoes">
                      <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={Boolean(tocando) || enviando} onClick={() => tocar(i, true)}>▶ Ouvir</button>
                      <button type="button" className="pf-botao pf-botao--pequeno" disabled={Boolean(tocando) || enviando} onClick={() => tocar(i, false)}>{toques[i]?.length ? "🥁 Tocar de novo" : "🥁 Tocar"}</button>
                      {toques[i]?.length > 0 && <span className="pf-estat__nota" style={{ margin: 0 }}>{toques[i].length} toque{toques[i].length > 1 ? "s" : ""}</span>}
                    </div>
                  )
                )}
                {correcao && <small className="pf-estat__nota">{correcao.certo ? "No tempo! " : ""}{correcao.motivo}</small>}
              </li>
            );
          })}
        </ol>
        {resultado?.correcao?.atraso ? <small className="pf-estat__nota">Descontamos {Math.abs(resultado.correcao.atraso)} ms de {resultado.correcao.atraso > 0 ? "atraso" : "adiantamento"} fixo do aparelho.</small> : null}
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        {!resultado && (
          <div className="pf-acoes" style={{ alignItems: "center" }}>
            <button type="submit" className="pf-botao" disabled={enviando || Boolean(tocando) || faltam > 0}>{enviando ? "Corrigindo…" : "Corrigir"}</button>
            {faltam > 0 && <span className="pf-estat__nota" style={{ margin: 0 }}>Falta tocar {faltam}.</span>}
          </div>
        )}
        <Rodape concluido={Boolean(resultado)} rodada={desafio.rodada} maxRodadas={desafio.maxRodadas} />
      </form>
      {resultado && <Avaliacao avaliacao={resultado.avaliacao} nota={resultado.nota} />}
      {Aviso}
    </div>
  );
}

// ================================================================ afinação

/** A agulha do afinador: de −50 a +50 cents; verde perto do centro. */
function Agulha({ cents }) {
  const c = Math.max(-50, Math.min(50, cents));
  return (
    <div className="afin__agulha" role="meter" aria-valuemin={-50} aria-valuemax={50} aria-valuenow={Math.round(cents)} aria-label="Afinação em cents">
      <span className="afin__centro" />
      <span className={`afin__ponteiro${Math.abs(cents) <= 20 ? " afin__ponteiro--ok" : ""}`} style={{ left: `${50 + c}%` }} />
    </div>
  );
}

export function TreinoDeAfinacao({ desafio }) {
  const c = desafio.conteudo;
  const inicial = desafio.resposta?.respostas || [];
  const [freqs, setFreqs] = useState(() => c.itens.map((_, i) => (Number(inicial[i]) > 0 ? Number(inicial[i]) : null)));
  const [ouvindo, setOuvindo] = useState(null); // { item, agora: Hz | null }
  const { resultado, enviando, erro, setErro, enviar, Aviso } = useCorrecao(desafio);
  const microfone = useRef(null);
  const relogio = useRef(null);
  const itens = resultado?.conteudo?.itens || c.itens;

  useEffect(() => () => {
    clearInterval(relogio.current);
    microfone.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  async function abrirMicrofone() {
    if (microfone.current) return microfone.current;
    const ctx = audioDaPagina();
    if (!ctx || !navigator.mediaDevices?.getUserMedia) throw new Error("este navegador não ouve o microfone");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch {
      throw new Error("o microfone não foi liberado — permita o microfone para o Proof no navegador");
    }
    const analisador = ctx.createAnalyser();
    analisador.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analisador); // só para medir: não vai para o alto-falante
    microfone.current = { stream, analisador, ctx, buffer: new Float32Array(analisador.fftSize) };
    return microfone.current;
  }

  async function cantar(i) {
    setErro("");
    let m;
    try { m = await abrirMicrofone(); } catch (e) { setErro(e.message); return; }
    const leituras = [];
    const inicio = performance.now();
    let primeira = null;
    setOuvindo({ item: i, agora: null });
    clearInterval(relogio.current);
    relogio.current = setInterval(() => {
      m.analisador.getFloatTimeDomainData(m.buffer);
      const f = detectarAltura(m.buffer, m.ctx.sampleRate);
      setOuvindo({ item: i, agora: f });
      const agora = performance.now();
      if (f) { leituras.push(f); primeira = primeira || agora; }
      // 2,5 s de nota depois do primeiro som, ou 7 s no total
      if ((primeira && agora - primeira > 2500) || agora - inicio > 7000) {
        clearInterval(relogio.current);
        setOuvindo(null);
        const final = alturaSustentada(leituras);
        if (final) setFreqs((fs) => fs.map((x, n) => (n === i ? final : x)));
        else setErro("não deu para ouvir uma nota firme — chegue mais perto do microfone e segure a nota por 2 segundos");
      }
    }, 60);
  }

  const faltam = freqs.filter((f) => !f).length;
  return (
    <div className="desafio">
      <Cabecalho desafio={desafio}>
        <p className="desafio__texto" style={{ margin: 0 }}>
          {c.comIntervalo
            ? "Ouça a nota de referência e cante a nota pedida acima dela."
            : "Ouça a nota e cante (ou toque no seu instrumento) a mesma nota."} Vale qualquer oitava. Toque em <strong>Cantar</strong> e segure a nota por uns 2 segundos.
        </p>
        <small className="pf-estat__nota" style={{ margin: 0 }}>🔒 O som do microfone é analisado aqui mesmo e não é gravado nem enviado: vai só a altura medida.</small>
      </Cabecalho>
      <form className="pf-cartao motor" onSubmit={(e) => { e.preventDefault(); enviar(freqs.map((f) => (f ? String(f) : ""))); }}>
        <ol className="motor__itens">
          {itens.map((it, i) => {
            const correcao = resultado?.correcao?.itens?.[i];
            const agora = ouvindo?.item === i ? ouvindo.agora : null;
            // com o alvo à vista (a mesma nota), a agulha mede até ele; no intervalo, até o semitom mais perto
            const centsAgora = agora ? (it.alvo != null ? centsAteANota(agora, it.alvo) : (notaDaFrequencia(agora) - Math.round(notaDaFrequencia(agora))) * 100) : null;
            return (
              <li key={i} className={correcao ? (correcao.certo ? "motor__item--certo" : "motor__item--errado") : undefined}>
                <strong>
                  {it.alvo != null && it.alvo === it.referencia
                    ? `Nota: ${nomeDaNota(it.referencia, false)}`
                    : `Referência: ${nomeDaNota(it.referencia, false)} · cante ${it.pedido}`}
                  {resultado && it.alvo !== it.referencia && it.alvo != null ? ` (${nomeDaNota(it.alvo, false)})` : ""}
                </strong>
                {!resultado && (
                  <div className="pf-acoes" style={{ alignItems: "center" }}>
                    <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={Boolean(ouvindo) || enviando}
                      onClick={() => { if (!tocarNotas([it.referencia], "melodico")) setErro("este navegador não toca som"); }}>▶ Ouvir</button>
                    <button type="button" className="pf-botao pf-botao--pequeno" disabled={Boolean(ouvindo) || enviando} onClick={() => cantar(i)}>
                      {ouvindo?.item === i ? "🎤 Ouvindo…" : freqs[i] ? "🎤 Cantar de novo" : "🎤 Cantar"}
                    </button>
                    {freqs[i] && ouvindo?.item !== i && <span className="pf-estat__nota" style={{ margin: 0 }}>✓ {nomeDaNota(notaDaFrequencia(freqs[i]), false)} ({freqs[i].toLocaleString("pt-BR")} Hz)</span>}
                  </div>
                )}
                {ouvindo?.item === i && (
                  <div className="afin__ao-vivo">
                    <span className="afin__nota">{agora ? nomeDaNota(notaDaFrequencia(agora)) : "…"}</span>
                    {centsAgora != null ? <Agulha cents={centsAgora} /> : <small className="pf-estat__nota" style={{ margin: 0 }}>Cante ou toque agora</small>}
                  </div>
                )}
                {correcao && <small className="pf-estat__nota">{correcao.certo ? `Afinado (${Math.abs(correcao.cents)} cents)` : correcao.motivo}</small>}
              </li>
            );
          })}
        </ol>
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        {!resultado && (
          <div className="pf-acoes" style={{ alignItems: "center" }}>
            <button type="submit" className="pf-botao" disabled={enviando || Boolean(ouvindo) || faltam > 0}>{enviando ? "Corrigindo…" : "Corrigir"}</button>
            {faltam > 0 && <span className="pf-estat__nota" style={{ margin: 0 }}>Falta cantar {faltam}.</span>}
          </div>
        )}
        <Rodape concluido={Boolean(resultado)} rodada={desafio.rodada} maxRodadas={desafio.maxRodadas} />
      </form>
      {resultado && <Avaliacao avaliacao={resultado.avaliacao} nota={resultado.nota} />}
      {Aviso}
    </div>
  );
}
