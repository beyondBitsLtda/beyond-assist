"use client";

// O editor que abre na tela quando a conversa é sobre código (pedido de 24/10/2026): em QUALQUER
// modo do Assistente, se a resposta da Lisa traz código, uma janela de editor aparece — com
// realce de sintaxe e número de linha — e o código é DIGITADO, trecho por trecho, com a
// explicação daquele passo em cima. Não é um modo novo: a janela só aparece quando há código.
//
// É UMA janela para a conversa inteira: cada resposta com código vira uma aba ("#1", "#2"…, com a
// pergunta no título), e as de antes continuam lá — perguntar de novo não apaga nada. Dentro da
// aba, um arquivo por aba menor. Só a resposta mais nova é digitada; as anteriores aparecem
// inteiras. Uma resposta nova com código traz a janela de volta se ela estava fechada.
//
// A leitura da resposta (os trechos, a explicação de cada um, a ordem da digitação) mora em
// src/lib/codigoNaResposta.js, testada por `npm run codigo-check`. Aqui fica só o que precisa do
// navegador: a digitação no tempo, a janela e os botões. A janela é como a de um sistema: arrasta
// para qualquer lugar pela barra de título, aumenta e diminui por qualquer borda ou canto, e abre
// de novo onde e do tamanho que ficou (a geometria mora em src/lib/janelaFlutuante.js). Para ir
// para OUTRO MONITOR, o botão "⧉ destacar" leva o editor para uma janela de verdade do sistema
// (prepararJanelaSeparada, abaixo); fechando ela, o editor volta para a página. A voz não
// lê o código (cleanForSpeech tira os blocos) — ela fala a explicação enquanto o editor digita.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";
import { trechosDaResposta, digitacao, passoDaDigitacao } from "@/lib/codigoNaResposta.js";
import { LinhasDoCodigo } from "./TextoComCodigo.js";
import { caixaGuardada, ajustarCaixa, moverCaixa, redimensionarCaixa } from "@/lib/janelaFlutuante.js";

const BATIDA_MS = 30;
const CHAVE_DA_CAIXA = "lisa-ide-caixa"; // onde e de que tamanho a janela ficou (só neste navegador)
const tela = () => ({ w: window.innerWidth, h: window.innerHeight });
const curta = (t, n = 26) => { const s = String(t || "").replace(/\s+/g, " ").trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

// as alças de redimensionar: as quatro bordas e os quatro cantos (os cantos por cima das bordas)
const BORDA = 6;
const CANTO = 12; // não chega na bolinha de fechar, que começa 12px para dentro
const ALCAS = [
  ["n", { top: 0, left: CANTO, right: CANTO, height: BORDA, cursor: "ns-resize" }],
  ["s", { bottom: 0, left: CANTO, right: CANTO, height: BORDA, cursor: "ns-resize" }],
  ["e", { right: 0, top: CANTO, bottom: CANTO, width: BORDA, cursor: "ew-resize" }],
  ["w", { left: 0, top: CANTO, bottom: CANTO, width: BORDA, cursor: "ew-resize" }],
  ["nw", { top: 0, left: 0, width: CANTO, height: CANTO, cursor: "nwse-resize" }],
  ["ne", { top: 0, right: 0, width: CANTO, height: CANTO, cursor: "nesw-resize" }],
  ["sw", { bottom: 0, left: 0, width: CANTO, height: CANTO, cursor: "nesw-resize" }],
  ["se", { bottom: 0, right: 0, width: CANTO + 8, height: CANTO + 8, cursor: "nwse-resize" }],
];

const BOTAO = { ...mono, fontSize: 10, padding: "3px 9px", borderRadius: 5, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "transparent", color: "#cfeffb", cursor: "pointer" };

/**
 * A janela separada (pedido de 24/10/2026: "não posso arrastar a janela para outra tela"): uma
 * janela de verdade do sistema, que vai para outro monitor, maximiza e fica atrás ou na frente
 * como qualquer outra. Ela abre vazia (about:blank, mesma origem) e o editor é desenhado lá
 * dentro por um portal do React — o mesmo componente, o mesmo estado, então as respostas novas
 * continuam chegando nela. Aqui ela recebe os estilos e as cores do tema da página.
 */
function prepararJanelaSeparada(win) {
  const d = win.document;
  d.title = "Editor da Lisa";
  d.head.querySelectorAll("link, style").forEach((e) => e.remove());
  for (const el of document.querySelectorAll('link[rel="stylesheet"], style')) {
    const copia = el.cloneNode(true);
    if (el.tagName === "LINK") copia.href = el.href; // endereço completo: a janela nova é about:blank
    d.head.appendChild(copia);
  }
  // a cor de destaque do tema é posta por JS no <html> da página (accentThemes.js): vai junto
  d.documentElement.setAttribute("style", document.documentElement.getAttribute("style") || "");
  d.documentElement.className = document.documentElement.className;
  d.body.className = document.body.className;
  d.body.style.cssText = "margin:0;background:#050b10;overflow:hidden;";
  d.body.replaceChildren();
  const raiz = d.createElement("div");
  d.body.appendChild(raiz);
  return raiz;
}

/**
 * `interacoes`: as respostas da conversa, da mais antiga para a mais nova — [{ id, pergunta, texto }].
 * A última pode estar chegando ainda (`chegando`). As que não têm código não viram aba.
 */
export default function IdeDaLisa({ interacoes = [], chegando = false }) {
  const [ocultas, setOcultas] = useState(() => new Set()); // abas de resposta que a pessoa fechou
  const lista = useMemo(
    () => interacoes
      .filter((it) => !ocultas.has(it.id))
      .map((it) => ({ ...it, ...trechosDaResposta(it.texto) }))
      .filter((it) => it.temCodigo),
    [interacoes, ocultas],
  );
  const ultima = lista.at(-1) || null;

  const [digitados, setDigitados] = useState({}); // id da resposta → caracteres já digitados
  const [puladas, setPuladas] = useState(() => new Set()); // respostas que a pessoa mandou "pular"
  const [semAnimacao, setSemAnimacao] = useState(false);
  const [escolhida, setEscolhida] = useState(null); // a resposta na tela; null = segue a mais nova
  const [aba, setAba] = useState(null); // o arquivo na tela; null = segue o que está sendo digitado
  const [fechada, setFechada] = useState(false);
  const [minimizada, setMinimizada] = useState(false);
  const [maximizada, setMaximizada] = useState(false);
  const [caixa, setCaixa] = useState(null); // { x, y, w, h } — onde está e o tamanho (src/lib/janelaFlutuante.js)
  const [mexendo, setMexendo] = useState(false); // arrastando ou redimensionando agora
  const [copiado, setCopiado] = useState(false);
  const [separada, setSeparada] = useState(null); // { win, raiz } — o editor numa janela do sistema
  const [podeSeparar, setPodeSeparar] = useState(false); // só no computador (no celular, janela é aba)
  const [avisoSeparar, setAvisoSeparar] = useState("");
  const corpoRef = useRef(null);
  const gesto = useRef(null);
  const separadaRef = useRef(null);
  separadaRef.current = separada;

  // a digitação é só da resposta mais nova; as de antes aparecem inteiras
  const pulouUltima = semAnimacao || (ultima && puladas.has(ultima.id));
  const estadoDaUltima = ultima ? digitacao(ultima.trechos, pulouUltima ? Infinity : digitados[ultima.id] || 0) : null;
  const alvoRef = useRef({ id: null, total: 0 });
  alvoRef.current = { id: ultima?.id ?? null, total: estadoDaUltima?.total ?? 0 };

  // quem pediu menos movimento no sistema vê o código inteiro de uma vez
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setSemAnimacao(true);
  }, []);

  // a digitação: anda um pouco a cada batida, sem passar do que já chegou do streaming
  useEffect(() => {
    if (!ultima || pulouUltima) return undefined;
    const id = setInterval(() => {
      setDigitados((m) => {
        const { id: alvo, total } = alvoRef.current;
        const n = m[alvo] || 0;
        const faltam = total - n;
        return faltam > 0 ? { ...m, [alvo]: n + passoDaDigitacao(faltam) } : m;
      });
    }, BATIDA_MS);
    return () => clearInterval(id);
  }, [ultima?.id, pulouUltima]);

  // resposta nova com código: a janela volta (se estava fechada) e mostra ela
  useEffect(() => {
    if (!ultima) return;
    setFechada(false);
    setEscolhida(null);
    setAba(null);
  }, [ultima?.id]);

  // onde a janela nasce: onde você deixou da última vez (guardado neste navegador) ou, na primeira
  // vez, no canto direito
  useEffect(() => {
    if (caixa || !ultima) return;
    let guardada = null;
    try { guardada = JSON.parse(localStorage.getItem(CHAVE_DA_CAIXA) || "null"); } catch { /* sem armazenamento: nasce no canto */ }
    setCaixa(caixaGuardada(guardada, tela()));
  }, [caixa, ultima]);

  // soltou depois de arrastar ou redimensionar: guarda para abrir no mesmo lugar da próxima vez
  useEffect(() => {
    if (mexendo || !caixa) return;
    try { localStorage.setItem(CHAVE_DA_CAIXA, JSON.stringify(caixa)); } catch { /* sem armazenamento: vale só agora */ }
  }, [mexendo, caixa]);

  // a janela do navegador mudou de tamanho: a caixa continua alcançável
  useEffect(() => {
    const ajustar = () => setCaixa((c) => (c ? ajustarCaixa(c, tela()) : c));
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  // janela separada só no computador: no celular, uma "janela" nova é só outra aba
  useEffect(() => {
    setPodeSeparar(!window.matchMedia?.("(pointer: coarse)").matches && window.innerWidth >= 700);
  }, []);

  // a janela separada fechou (pelo X do sistema ou pelo botão): o editor volta para a página. E se
  // a página da Lisa fechar ou recarregar, a janela separada fecha junto (sem ela, ficaria vazia).
  useEffect(() => {
    if (!separada) return undefined;
    const vigia = setInterval(() => { if (separada.win.closed) setSeparada(null); }, 600);
    const fecharJunto = () => { try { separada.win.close(); } catch { /* já fechou */ } };
    window.addEventListener("pagehide", fecharJunto);
    return () => { clearInterval(vigia); window.removeEventListener("pagehide", fecharJunto); };
  }, [separada]);
  useEffect(() => () => { try { separadaRef.current?.win.close(); } catch { /* já fechou */ } }, []);

  // a resposta e o arquivo que estão na tela
  const vista = (escolhida && lista.find((it) => it.id === escolhida)) || ultima;
  const ehUltima = Boolean(vista && ultima && vista.id === ultima.id);
  const estado = vista ? (ehUltima ? estadoDaUltima : digitacao(vista.trechos, Infinity)) : null;
  const mostrado = vista ? (aba != null && aba < vista.trechos.length ? aba : ehUltima ? estado.atual : 0) : 0;
  const trecho = vista?.trechos[mostrado];
  const visivel = estado?.visiveis[mostrado] ?? "";
  const digitandoEste = ehUltima && !estado.terminou && mostrado === estado.atual;

  // seguindo a digitação, o editor rola junto com o código
  useEffect(() => {
    if (aba == null && corpoRef.current) corpoRef.current.scrollTop = corpoRef.current.scrollHeight;
  }, [visivel.length, aba]);

  if (!ultima || !caixa) return null;

  if (fechada && !separada) {
    return (
      <button
        type="button"
        onClick={() => setFechada(false)}
        title="abrir de novo o editor com o código desta conversa"
        style={{
          position: "fixed", right: 20, bottom: 88, zIndex: 190, ...mono, fontSize: 11.5, letterSpacing: 0.5,
          padding: "9px 14px", borderRadius: 999, border: `1px solid ${PU}`, background: "rgba(5,11,16,0.92)",
          color: "#eafcff", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        {"</>"} ver o código da Lisa{lista.length > 1 ? ` (${lista.length})` : ""}
      </button>
    );
  }

  // arrastar (pela barra de título) ou redimensionar (por uma borda ou canto): `tipo` é "mover"
  // ou a direção da borda ("n", "se"...). Funciona com mouse, caneta e dedo (pointer events).
  const comecarGesto = (e, tipo) => {
    if (maximizada || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (tipo !== "mover" && minimizada) return;
    e.preventDefault();
    e.stopPropagation();
    gesto.current = { tipo, x0: e.clientX, y0: e.clientY, inicio: caixa };
    setMexendo(true);
    const mover = (ev) => {
      const g = gesto.current;
      if (!g) return;
      const dx = ev.clientX - g.x0;
      const dy = ev.clientY - g.y0;
      setCaixa(g.tipo === "mover" ? moverCaixa(g.inicio, dx, dy, tela()) : redimensionarCaixa(g.inicio, g.tipo, dx, dy, tela()));
    };
    const soltar = () => {
      gesto.current = null;
      setMexendo(false);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  };

  const copiar = async () => {
    try {
      // da janela onde o editor está (a separada tem o foco quando o botão é clicado lá)
      const onde = corpoRef.current?.ownerDocument?.defaultView || window;
      await onde.navigator.clipboard.writeText(trecho.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* sem permissão de área de transferência: o código continua na tela para selecionar */ }
  };

  // leva o editor para uma janela do sistema, no mesmo lugar e tamanho em que ele está na página
  const separar = () => {
    const borda = Math.max(0, window.outerHeight - window.innerHeight); // a barra do navegador
    const win = window.open("", "lisa-editor",
      `popup=yes,width=${Math.round(caixa.w)},height=${Math.round(caixa.h)},left=${Math.round(window.screenX + caixa.x)},top=${Math.round(window.screenY + borda + caixa.y)}`);
    if (!win) {
      setAvisoSeparar("O navegador bloqueou a janela nova. Libere os pop-ups da Lisa e tente de novo.");
      return;
    }
    setAvisoSeparar("");
    setMaximizada(false);
    setMinimizada(false);
    setSeparada({ win, raiz: prepararJanelaSeparada(win) });
  };
  const juntar = () => {
    try { separada?.win.close(); } catch { /* já fechou */ }
    setSeparada(null);
  };

  const escolher = (id) => { setEscolhida(id === ultima.id ? null : id); setAba(null); };
  const esconder = (id) => {
    setOcultas((s) => new Set([...s, id]));
    if (escolhida === id) setEscolhida(null);
    setAba(null);
  };

  const indice = lista.findIndex((it) => it.id === vista.id);
  const situacao = !ehUltima
    ? `resposta #${indice + 1} · completa`
    : estado.terminou
      ? (chegando ? "a Lisa ainda está escrevendo…" : "pronto")
      : `digitando ${vista.trechos.length > 1 ? `trecho ${estado.atual + 1} de ${vista.trechos.length}` : "o código"}…`;
  const explicacao = trecho?.fala || (estado.terminou && mostrado === vista.trechos.length - 1 ? vista.depois : "");
  const linhas = visivel.split("\n");

  // classes "bb-": a camada de fonte dos painéis não troca a fonte delas (ver TextoComCodigo.js)
  const numeros = (n) => (
    <div className="bb-ide-num" style={{ flex: "none", padding: "10px 10px 10px 14px", textAlign: "right", color: "rgba(207,239,251,0.3)", userSelect: "none", ...mono }}>
      {Array.from({ length: n }, (_, i) => <div key={i} className="bb-ide-num">{i + 1}</div>)}
    </div>
  );
  const cursor = digitandoEste ? <span className="ide-lisa__cursor" aria-hidden="true" /> : null;
  // na página: janela flutuante com alças; separada: ocupa a janela do sistema inteira (quem move
  // e redimensiona é o próprio sistema)
  const naPagina = !separada;

  const janela = (
    <div
      role="dialog"
      aria-label="Editor da Lisa: o código desta conversa"
      className="bb-ide"
      style={naPagina ? {
        position: "fixed", zIndex: 190,
        left: maximizada ? "3vw" : caixa.x, top: maximizada ? "5vh" : caixa.y,
        width: maximizada ? "94vw" : caixa.w,
        height: minimizada ? "auto" : maximizada ? "88vh" : caixa.h,
        display: "flex", flexDirection: "column", overflow: "hidden",
        background: "#050b10", border: `1px solid ${mexendo ? CY : "rgba(var(--accent-rgb),0.3)"}`, borderRadius: 10,
        boxShadow: "0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.4)", ...mono,
        // enquanto arrasta ou redimensiona, nada de selecionar texto sem querer
        userSelect: mexendo ? "none" : undefined,
      } : {
        position: "fixed", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden",
        background: "#050b10", color: "#cfeffb", ...mono,
      }}
    >
      {/* as alças de redimensionar: puxe qualquer borda ou canto (o de baixo à direita tem a marquinha) */}
      {naPagina && !maximizada && !minimizada && ALCAS.map(([direcao, lugar]) => (
        <div key={direcao} aria-hidden="true" onPointerDown={(e) => comecarGesto(e, direcao)}
          style={{ position: "absolute", zIndex: 3, touchAction: "none", ...lugar }} />
      ))}
      {naPagina && !maximizada && !minimizada && (
        <span aria-hidden="true" style={{
          position: "absolute", right: 3, bottom: 3, width: 10, height: 10, zIndex: 2, pointerEvents: "none",
          background: "linear-gradient(135deg, transparent 0 45%, rgba(207,239,251,0.45) 45% 55%, transparent 55% 70%, rgba(207,239,251,0.45) 70% 80%, transparent 80%)",
        }} />
      )}
      <style>{`
        .ide-lisa__cursor { display: inline-block; width: 7px; height: 1.1em; margin-left: 1px; vertical-align: text-bottom;
          background: ${CY}; animation: ide-lisa-piscar 1s steps(1) infinite; }
        @keyframes ide-lisa-piscar { 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .ide-lisa__cursor { animation: none; } }
      `}</style>

      {/* barra de título — arrastável na página; bolinhas de fechar, minimizar e maximizar */}
      <div
        onPointerDown={naPagina ? (e) => comecarGesto(e, "mover") : undefined}
        onDoubleClick={naPagina ? () => setMaximizada((v) => !v) : undefined}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", flex: "none",
          background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(var(--accent-rgb),0.18)",
          cursor: !naPagina || maximizada ? "default" : mexendo ? "grabbing" : "grab", userSelect: "none", touchAction: "none",
        }}
      >
        {naPagina ? (
          <div style={{ display: "flex", gap: 7, flex: "none" }}>
            <span onPointerDown={(e) => e.stopPropagation()} onClick={() => setFechada(true)} title="fechar"
              style={{ width: 11, height: 11, borderRadius: "50%", background: OR, cursor: "pointer", opacity: 0.8 }} />
            <span onPointerDown={(e) => e.stopPropagation()} onClick={() => setMinimizada((v) => !v)} title="minimizar"
              style={{ width: 11, height: 11, borderRadius: "50%", background: "rgba(207,239,251,0.4)", cursor: "pointer" }} />
            <span onPointerDown={(e) => e.stopPropagation()} onClick={() => setMaximizada((v) => !v)} title="maximizar"
              style={{ width: 11, height: 11, borderRadius: "50%", background: GR, cursor: "pointer", opacity: 0.8 }} />
          </div>
        ) : (
          <button type="button" onClick={juntar} title="trazer o editor de volta para a página da Lisa" style={{ ...BOTAO, flex: "none" }}>
            ↩ voltar para a página
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, justifyContent: "center" }}>
          <span style={{ fontSize: 10.5, letterSpacing: 1.5, color: CY, flex: "none" }}>⌨ EDITOR DA LISA</span>
          <span style={{ fontSize: 9.5, color: (ehUltima ? estado.terminou && !chegando : true) ? GR : "rgba(207,239,251,0.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            — {situacao}
          </span>
        </div>
        <div style={{ minWidth: 54, flex: "none", display: "flex", justifyContent: "flex-end" }}>
          {naPagina && podeSeparar && (
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={separar}
              title="abrir o editor numa janela separada — dá para levar para outro monitor, maximizar e deixar ao lado"
              style={{ ...BOTAO, flex: "none" }}>
              ⧉ destacar
            </button>
          )}
        </div>
      </div>
      {avisoSeparar && (
        <div role="alert" onClick={() => setAvisoSeparar("")} style={{ padding: "6px 12px", fontSize: 11, color: OR, background: "rgba(255,157,61,0.08)", borderBottom: "1px solid rgba(255,157,61,0.25)", cursor: "pointer", flex: "none" }}>
          {avisoSeparar}
        </div>
      )}

      {!minimizada && (
        <>
          {/* abas de resposta — uma por interação com código; as de antes continuam aqui */}
          {lista.length > 1 && (
            <div role="tablist" aria-label="Respostas com código" style={{ display: "flex", background: "rgba(0,0,0,0.45)", borderBottom: "1px solid rgba(var(--accent-rgb),0.14)", flex: "none", overflowX: "auto" }}>
              {lista.map((it, i) => {
                const ativa = it.id === vista.id;
                const digitando = it.id === ultima.id && !estadoDaUltima.terminou;
                return (
                  <div key={it.id} style={{
                    display: "flex", alignItems: "center", flex: "none", borderRight: "1px solid rgba(var(--accent-rgb),0.1)",
                    background: ativa ? "rgba(var(--accent-rgb),0.1)" : "transparent", borderBottom: `2px solid ${ativa ? PU : "transparent"}`,
                  }}>
                    <button type="button" role="tab" aria-selected={ativa} onClick={() => escolher(it.id)} title={it.pergunta || `resposta #${i + 1}`}
                      style={{ ...mono, display: "flex", alignItems: "center", gap: 6, padding: "6px 4px 6px 12px", fontSize: 10.5, border: 0, background: "transparent", cursor: "pointer", whiteSpace: "nowrap", color: ativa ? "#eafcff" : "rgba(207,239,251,0.5)" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: digitando ? OR : PU, opacity: ativa ? 1 : 0.6 }} />
                      <b style={{ color: ativa ? PU : "inherit" }}>#{i + 1}</b> {curta(it.pergunta)}
                    </button>
                    <button type="button" onClick={() => esconder(it.id)} title="fechar esta aba" aria-label={`fechar a aba da resposta #${i + 1}`}
                      style={{ ...mono, border: 0, background: "transparent", color: "rgba(207,239,251,0.4)", cursor: "pointer", fontSize: 12, padding: "4px 10px 4px 6px" }}>
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* abas de arquivo da resposta na tela (o arquivo, quando a Lisa disse qual é) */}
          {vista.trechos.length > 1 && (
            <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)", flex: "none", overflowX: "auto" }}>
              {vista.trechos.map((t, i) => {
                const ativa = i === mostrado;
                const digitando = ehUltima && !estado.terminou && i === estado.atual;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAba(digitando ? null : i)}
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "5px 18px 5px 12px", background: "rgba(0,0,0,0.4)", borderTop: "1px solid rgba(var(--accent-rgb),0.14)", flex: "none" }}>
            <span style={{ fontSize: 9.5, color: PU, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {trecho?.arquivo || trecho?.rotulo} · {trecho?.linguagem || "texto"} · {linhas.length} linha(s)
            </span>
            <div style={{ display: "flex", gap: 8, flex: "none" }}>
              {ehUltima && !estado.terminou && (
                <button type="button" onClick={() => setPuladas((s) => new Set([...s, ultima.id]))} title="mostrar o código inteiro agora" style={BOTAO}>
                  ⏩ pular
                </button>
              )}
              <button type="button" onClick={copiar} disabled={!trecho?.codigo} title="copiar este trecho" style={{ ...BOTAO, color: copiado ? GR : "#cfeffb" }}>
                {copiado ? "✓ copiado" : "⧉ copiar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (!separada) return janela;
  // separada: o editor é desenhado na janela do sistema; na página fica só o aviso de onde ele está
  return (
    <>
      {createPortal(janela, separada.raiz)}
      <button
        type="button"
        onClick={juntar}
        title="fechar a janela separada e trazer o editor de volta para cá"
        style={{
          position: "fixed", right: 20, bottom: 88, zIndex: 190, ...mono, fontSize: 11.5, letterSpacing: 0.5,
          padding: "9px 14px", borderRadius: 999, border: `1px solid ${CY}`, background: "rgba(5,11,16,0.92)",
          color: "#eafcff", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        ⧉ editor numa janela separada · trazer de volta
      </button>
    </>
  );
}
