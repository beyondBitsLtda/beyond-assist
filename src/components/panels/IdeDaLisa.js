"use client";

// O editor que abre na tela quando a conversa é sobre código (pedido de 24/10/2026): em QUALQUER
// modo do Assistente, se a resposta da Lisa traz código, uma janela de editor aparece — com
// realce de sintaxe e número de linha — e o código é DIGITADO, trecho por trecho, com a
// explicação daquele passo em cima. Não é um modo novo: a janela só aparece quando há código.
//
// A leitura da resposta (os trechos, a explicação de cada um, a ordem da digitação) mora em
// src/lib/codigoNaResposta.js, testada por `npm run codigo-check`. Aqui fica só o que precisa do
// navegador: a digitação no tempo, a janela arrastável e os botões. A voz não lê o código
// (cleanForSpeech tira os blocos) — ela fala a explicação enquanto o editor digita.
//
// Quem usa passa `key` diferente a cada resposta nova: o estado (digitação, aba, fechada) zera.

import { useEffect, useMemo, useRef, useState } from "react";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";
import { trechosDaResposta, digitacao, passoDaDigitacao } from "@/lib/codigoNaResposta.js";
import { LinhasDoCodigo } from "./TextoComCodigo.js";

const BATIDA_MS = 30;

export default function IdeDaLisa({ texto, chegando = false }) {
  const { trechos, depois, temCodigo } = useMemo(() => trechosDaResposta(texto), [texto]);
  const [digitados, setDigitados] = useState(0);
  const [pulou, setPulou] = useState(false);
  const [aba, setAba] = useState(null); // null = segue o trecho que está sendo digitado
  const [fechada, setFechada] = useState(false);
  const [minimizada, setMinimizada] = useState(false);
  const [maximizada, setMaximizada] = useState(false);
  const [pos, setPos] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const corpoRef = useRef(null);
  const arrasto = useRef(null);

  const estado = digitacao(trechos, pulou ? Infinity : digitados);
  const totalRef = useRef(0);
  totalRef.current = estado.total;

  // quem pediu menos movimento no sistema vê o código inteiro de uma vez
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPulou(true);
  }, []);

  // a digitação: anda um pouco a cada batida, sem passar do que já chegou do streaming
  useEffect(() => {
    if (!temCodigo || pulou) return undefined;
    const id = setInterval(() => {
      setDigitados((d) => {
        const faltam = totalRef.current - d;
        return faltam > 0 ? d + passoDaDigitacao(faltam) : d;
      });
    }, BATIDA_MS);
    return () => clearInterval(id);
  }, [temCodigo, pulou]);

  // onde a janela nasce: no canto direito, sem cobrir a conversa; no celular, a largura toda
  useEffect(() => {
    if (pos || !temCodigo) return;
    const largura = Math.min(window.innerWidth - 16, 640);
    setPos({ x: Math.max(8, window.innerWidth - largura - 24), y: window.innerWidth < 700 ? 64 : 84 });
  }, [pos, temCodigo]);

  const mostrado = aba != null && aba < trechos.length ? aba : estado.atual;
  const trecho = trechos[mostrado];
  const visivel = estado.visiveis[mostrado] ?? "";
  const digitandoEste = !estado.terminou && mostrado === estado.atual;

  // seguindo a digitação, o editor rola junto com o código
  useEffect(() => {
    if (aba == null && corpoRef.current) corpoRef.current.scrollTop = corpoRef.current.scrollHeight;
  }, [visivel.length, aba]);

  if (!temCodigo || !pos) return null;

  if (fechada) {
    return (
      <button
        type="button"
        onClick={() => setFechada(false)}
        title="abrir de novo o editor com o código desta resposta"
        style={{
          position: "fixed", right: 20, bottom: 88, zIndex: 190, ...mono, fontSize: 11.5, letterSpacing: 0.5,
          padding: "9px 14px", borderRadius: 999, border: `1px solid ${PU}`, background: "rgba(5,11,16,0.92)",
          color: "#eafcff", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        {"</>"} ver o código da Lisa
      </button>
    );
  }

  const comecarArrasto = (e) => {
    if (maximizada || e.button !== 0) return;
    arrasto.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    const mover = (ev) => {
      if (!arrasto.current) return;
      setPos({
        x: Math.min(Math.max(0, ev.clientX - arrasto.current.dx), window.innerWidth - 120),
        y: Math.min(Math.max(0, ev.clientY - arrasto.current.dy), window.innerHeight - 40),
      });
    };
    const soltar = () => {
      arrasto.current = null;
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(trecho.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* sem permissão de área de transferência: o código continua na tela para selecionar */ }
  };

  const situacao = estado.terminou
    ? (chegando ? "a Lisa ainda está escrevendo…" : "pronto")
    : `digitando ${trechos.length > 1 ? `trecho ${estado.atual + 1} de ${trechos.length}` : "o código"}…`;
  const explicacao = trecho?.fala || (estado.terminou && mostrado === trechos.length - 1 ? depois : "");
  const linhas = visivel.split("\n");

  // classes "bb-": a camada de fonte dos painéis não troca a fonte delas (ver TextoComCodigo.js)
  const numeros = (n) => (
    <div className="bb-ide-num" style={{ flex: "none", padding: "10px 10px 10px 14px", textAlign: "right", color: "rgba(207,239,251,0.3)", userSelect: "none", ...mono }}>
      {Array.from({ length: n }, (_, i) => <div key={i} className="bb-ide-num">{i + 1}</div>)}
    </div>
  );
  const cursor = digitandoEste ? <span className="ide-lisa__cursor" aria-hidden="true" /> : null;

  return (
    <div
      role="dialog"
      aria-label="Editor da Lisa: o código desta resposta"
      className="bb-ide"
      style={{
        position: "fixed", zIndex: 190,
        left: maximizada ? "3vw" : pos.x, top: maximizada ? "5vh" : pos.y,
        width: maximizada ? "94vw" : "min(calc(100vw - 16px), 640px)",
        height: minimizada ? "auto" : maximizada ? "88vh" : "min(62vh, 480px)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        background: "#050b10", border: "1px solid rgba(var(--accent-rgb),0.3)", borderRadius: 10,
        boxShadow: "0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.4)", ...mono,
      }}
    >
      <style>{`
        .ide-lisa__cursor { display: inline-block; width: 7px; height: 1.1em; margin-left: 1px; vertical-align: text-bottom;
          background: ${CY}; animation: ide-lisa-piscar 1s steps(1) infinite; }
        @keyframes ide-lisa-piscar { 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .ide-lisa__cursor { animation: none; } }
      `}</style>

      {/* barra de título — arrastável; bolinhas de fechar, minimizar e maximizar */}
      <div
        onPointerDown={comecarArrasto}
        onDoubleClick={() => setMaximizada((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", flex: "none",
          background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(var(--accent-rgb),0.18)",
          cursor: maximizada ? "default" : "grab", userSelect: "none", touchAction: "none",
        }}
      >
        <div style={{ display: "flex", gap: 7, flex: "none" }}>
          <span onPointerDown={(e) => e.stopPropagation()} onClick={() => setFechada(true)} title="fechar"
            style={{ width: 11, height: 11, borderRadius: "50%", background: OR, cursor: "pointer", opacity: 0.8 }} />
          <span onPointerDown={(e) => e.stopPropagation()} onClick={() => setMinimizada((v) => !v)} title="minimizar"
            style={{ width: 11, height: 11, borderRadius: "50%", background: "rgba(207,239,251,0.4)", cursor: "pointer" }} />
          <span onPointerDown={(e) => e.stopPropagation()} onClick={() => setMaximizada((v) => !v)} title="maximizar"
            style={{ width: 11, height: 11, borderRadius: "50%", background: GR, cursor: "pointer", opacity: 0.8 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, justifyContent: "center" }}>
          <span style={{ fontSize: 10.5, letterSpacing: 1.5, color: CY, flex: "none" }}>⌨ EDITOR DA LISA</span>
          <span style={{ fontSize: 9.5, color: estado.terminou && !chegando ? GR : "rgba(207,239,251,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            — {situacao}
          </span>
        </div>
        <div style={{ width: 54, flex: "none" }} />
      </div>

      {!minimizada && (
        <>
          {/* abas — uma por trecho (o arquivo, quando a Lisa disse qual é) */}
          {trechos.length > 1 && (
            <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)", flex: "none", overflowX: "auto" }}>
              {trechos.map((t, i) => {
                const ativa = i === mostrado;
                const digitando = !estado.terminou && i === estado.atual;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAba(i === estado.atual && !estado.terminou ? null : i)}
                    title={t.arquivo || t.rotulo}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: 11, whiteSpace: "nowrap",
                      cursor: "pointer", flex: "none", border: 0, borderRight: "1px solid rgba(var(--accent-rgb),0.08)",
                      borderTop: `2px solid ${ativa ? CY : "transparent"}`, ...mono,
                      color: ativa ? "#eafcff" : "rgba(207,239,251,0.45)", background: ativa ? "rgba(var(--accent-rgb),0.08)" : "transparent",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: digitando ? OR : estado.visiveis[i] ? GR : "rgba(207,239,251,0.25)" }} />
                    {t.rotulo}
                  </button>
                );
              })}
            </div>
          )}

          {/* a explicação do passo que está na tela — o que a Lisa está fazendo neste trecho */}
          {explicacao && (
            <div style={{ display: "flex", gap: 8, padding: "8px 14px", background: "rgba(var(--accent-rgb),0.06)", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)", flex: "none", maxHeight: 96, overflowY: "auto" }}>
              <span style={{ color: CY, flex: "none", fontSize: 12 }}>💬</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "rgba(234,252,255,0.9)", whiteSpace: "pre-wrap", fontFamily: "var(--bb-fonte)" }}>{explicacao}</span>
            </div>
          )}

          {/* o editor — número de linha e o código com realce, digitado */}
          <div ref={corpoRef} onWheel={() => setAba((a) => (a == null ? mostrado : a))} style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#050b10" }}>
            <div className="bb-ide-num" style={{ display: "flex", fontSize: 12, lineHeight: 1.6 }}>
              {numeros(linhas.length)}
              {/* sem quebrar linha (rola para o lado, como num editor): a numeração fica alinhada */}
              <pre style={{ margin: 0, padding: "10px 14px 10px 6px", whiteSpace: "pre", color: "#cfeffb", flex: 1, ...mono }}>
                <LinhasDoCodigo codigo={visivel} linguagem={trecho?.linguagem} fim={cursor} />
              </pre>
            </div>
          </div>

          {/* barra de status — linguagem, linhas e os botões */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "5px 12px", background: "rgba(0,0,0,0.4)", borderTop: "1px solid rgba(var(--accent-rgb),0.14)", flex: "none" }}>
            <span style={{ fontSize: 9.5, color: PU, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {trecho?.arquivo || trecho?.rotulo} · {trecho?.linguagem || "texto"} · {linhas.length} linha(s)
            </span>
            <div style={{ display: "flex", gap: 8, flex: "none" }}>
              {!estado.terminou && (
                <button type="button" onClick={() => setPulou(true)} title="mostrar o código inteiro agora"
                  style={{ ...mono, fontSize: 10, padding: "3px 9px", borderRadius: 5, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "transparent", color: "#cfeffb", cursor: "pointer" }}>
                  ⏩ pular
                </button>
              )}
              <button type="button" onClick={copiar} disabled={!trecho?.codigo} title="copiar este trecho"
                style={{ ...mono, fontSize: 10, padding: "3px 9px", borderRadius: 5, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "transparent", color: copiado ? GR : "#cfeffb", cursor: "pointer" }}>
                {copiado ? "✓ copiado" : "⧉ copiar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
