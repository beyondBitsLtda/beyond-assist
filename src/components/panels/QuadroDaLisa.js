"use client";

// O quadro da Lisa (31/10/2026, BEYOND-0010): "quero que a Lisa desenhe processos na tela usando o
// processmap... eu altero o fluxo e ela interage com esse fluxo, além de esse modo poder funcionar
// junto com a IDE de código".
//
// Quando a pessoa pede um desenho, a página chama /api/diagrama e abre esta janela com o documento
// (`versao`: { doc, chave, colecao }). O quadro é o ProcessMap de public/diagramas, num iframe do
// mesmo endereço, e conversa com a página por window.PonteDoProof (public/diagramas/js/Ponte.js). A
// pessoa mexe à vontade: cada mudança volta para a página (aoMudar, com o documento inteiro), que
// manda o desenho em texto junto das perguntas — a Lisa "vê" o fluxo como ele está. A barra de baixo
// pede uma mudança no desenho (aoPedir). A janela é como a da IDE: arrasta pela barra de título,
// redimensiona pelo canto, maximiza, e convive com o editor de código (fica do outro lado da tela).

import { useEffect, useRef, useState } from "react";
import { CY, OR, GR, mono } from "@/lib/theme.js";
import { ajustarCaixa, moverCaixa, redimensionarCaixa } from "@/lib/janelaFlutuante.js";

const CHAVE_DA_CAIXA = "lisa-quadro-caixa";
const tela = () => ({ w: window.innerWidth, h: window.innerHeight });
const BOTAO = { ...mono, fontSize: 10, padding: "3px 9px", borderRadius: 5, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "transparent", color: "#cfeffb", cursor: "pointer" };
const CAMPO = { ...mono, fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "rgba(0,0,0,0.35)", color: "#eafcff", outline: "none" };

export default function QuadroDaLisa({ versao, titulo = "", explicacao = "", ocupado = false, aoMudar, aoPedir, aoFechar }) {
  const quadro = useRef(null);
  const importada = useRef(null); // a chave da versão que o quadro já abriu
  const versaoRef = useRef(versao);
  versaoRef.current = versao;
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;
  const espera = useRef(null);
  const gesto = useRef(null);
  const [caixa, setCaixa] = useState(null);
  const [maximizada, setMaximizada] = useState(false);
  const [minimizada, setMinimizada] = useState(false);
  const [mexendo, setMexendo] = useState(false);
  const [pedido, setPedido] = useState("");
  const ponte = () => quadro.current?.contentWindow?.PonteDoProof || null;

  // onde a janela nasce: onde ficou da última vez ou, na primeira, à esquerda (a IDE nasce à direita)
  useEffect(() => {
    let guardada = null;
    try { guardada = JSON.parse(localStorage.getItem(CHAVE_DA_CAIXA) || "null"); } catch { /* sem armazenamento */ }
    const t = tela();
    const inicial = { x: 16, y: 64, w: Math.min(980, Math.round(t.w * 0.6)), h: Math.min(660, Math.round(t.h * 0.74)) };
    const valida = guardada && ["x", "y", "w", "h"].every((k) => Number.isFinite(guardada[k]));
    setCaixa(ajustarCaixa(valida ? guardada : inicial, t));
  }, []);
  useEffect(() => {
    if (mexendo || !caixa) return;
    try { localStorage.setItem(CHAVE_DA_CAIXA, JSON.stringify(caixa)); } catch { /* vale só agora */ }
  }, [mexendo, caixa]);
  useEffect(() => {
    const ajustar = () => setCaixa((c) => (c ? ajustarCaixa(c, tela()) : c));
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  /** Abre no quadro a versão que a Lisa mandou (se ele já carregou e se ainda não abriu esta). */
  const importar = () => {
    const p = ponte();
    const v = versaoRef.current;
    if (!p || !v?.doc || importada.current === v.chave) return;
    try {
      p.importar(v.doc);
      if (v.colecao) p.colecao(v.colecao);
      importada.current = v.chave;
    } catch { /* desenho estragado: o quadro fica com o de antes */ }
  };
  useEffect(() => { importar(); }, [versao?.chave]);

  // o quadro avisa: pronto (abre a versão) e cada mudança (o documento inteiro volta para a página)
  useEffect(() => {
    function ouvir(e) {
      if (e.source !== quadro.current?.contentWindow || e.data?.origem !== "quadro") return;
      if (e.data.tipo === "pronto") { importar(); return; }
      if (e.data.tipo !== "mudou") return;
      clearTimeout(espera.current);
      espera.current = setTimeout(() => { const p = ponte(); if (p) aoMudarRef.current?.(p.exportar()); }, 500);
    }
    window.addEventListener("message", ouvir);
    return () => { window.removeEventListener("message", ouvir); clearTimeout(espera.current); };
  }, []);

  if (!caixa) return null;

  // arrastar pela barra de título ou redimensionar pelo canto; o iframe não pode comer o arrasto
  const comecarGesto = (e, tipo) => {
    if (maximizada || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.stopPropagation();
    gesto.current = { tipo, x0: e.clientX, y0: e.clientY, inicio: caixa };
    setMexendo(true);
    const mover = (ev) => {
      const g = gesto.current;
      if (!g) return;
      const dx = ev.clientX - g.x0, dy = ev.clientY - g.y0;
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

  const pedir = (e) => {
    e.preventDefault();
    const p = pedido.trim();
    if (!p || ocupado) return;
    aoPedir?.(p);
    setPedido("");
  };

  const colecao = versao?.colecao || "flow";
  return (
    <div
      role="dialog"
      aria-label="Quadro da Lisa: o processo desenhado"
      style={{
        position: "fixed", zIndex: 189,
        left: maximizada ? "2vw" : caixa.x, top: maximizada ? "4vh" : caixa.y,
        width: maximizada ? "96vw" : caixa.w, height: minimizada ? "auto" : maximizada ? "90vh" : caixa.h,
        display: "flex", flexDirection: "column", overflow: "hidden",
        background: "#050b10", border: `1px solid ${mexendo ? CY : "rgba(var(--accent-rgb),0.3)"}`, borderRadius: 10,
        boxShadow: "0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.4)", ...mono,
        userSelect: mexendo ? "none" : undefined,
      }}
    >
      {/* barra de título — arrastável; bolinhas de fechar, minimizar e maximizar */}
      <div
        onPointerDown={(e) => comecarGesto(e, "mover")}
        onDoubleClick={() => setMaximizada((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", flex: "none",
          background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(var(--accent-rgb),0.18)",
          cursor: maximizada ? "default" : mexendo ? "grabbing" : "grab", userSelect: "none", touchAction: "none",
        }}
      >
        <div style={{ display: "flex", gap: 7, flex: "none" }}>
          <span onPointerDown={(e) => e.stopPropagation()} onClick={aoFechar} title="fechar o quadro"
            style={{ width: 11, height: 11, borderRadius: "50%", background: OR, cursor: "pointer", opacity: 0.8 }} />
          <span onPointerDown={(e) => e.stopPropagation()} onClick={() => setMinimizada((v) => !v)} title="minimizar"
            style={{ width: 11, height: 11, borderRadius: "50%", background: "rgba(207,239,251,0.4)", cursor: "pointer" }} />
          <span onPointerDown={(e) => e.stopPropagation()} onClick={() => setMaximizada((v) => !v)} title="maximizar"
            style={{ width: 11, height: 11, borderRadius: "50%", background: GR, cursor: "pointer", opacity: 0.8 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, justifyContent: "center" }}>
          <span style={{ fontSize: 10.5, letterSpacing: 1.5, color: CY, flex: "none" }}>◇ QUADRO DA LISA</span>
          <span style={{ fontSize: 9.5, color: ocupado ? "rgba(207,239,251,0.55)" : GR, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            — {ocupado ? "a Lisa está desenhando…" : titulo ? `${titulo} · mexa à vontade, ela vê o que mudou` : "mexa à vontade, ela vê o que mudou"}
          </span>
        </div>
      </div>

      {!minimizada && (
        <>
          {explicacao && (
            <div style={{ display: "flex", gap: 8, padding: "8px 14px", background: "rgba(var(--accent-rgb),0.06)", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)", flex: "none", maxHeight: 90, overflowY: "auto" }}>
              <span style={{ color: CY, flex: "none", fontSize: 12 }}>💬</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "rgba(234,252,255,0.9)", whiteSpace: "pre-wrap", fontFamily: "var(--bb-fonte)" }}>{explicacao}</span>
            </div>
          )}
          <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
            <iframe
              ref={quadro} title="Quadro da Lisa" onLoad={importar}
              src={`/diagramas/index.html?embutido=1&tema=lisa&colecao=${encodeURIComponent(colecao)}`}
              // enquanto arrasta a janela, o iframe não pode engolir o movimento do mouse
              style={{ display: "block", width: "100%", height: "100%", border: 0, pointerEvents: mexendo ? "none" : undefined }}
            />
            {ocupado && (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(5,11,16,0.55)", color: "#eafcff", fontSize: 13, letterSpacing: 0.5 }}>
                ◇ a Lisa está desenhando…
              </div>
            )}
          </div>
          <form onSubmit={pedir} style={{ display: "flex", gap: 8, padding: "7px 24px 7px 10px", background: "rgba(var(--accent-rgb),0.05)", borderTop: "1px solid rgba(var(--accent-rgb),0.14)", flex: "none" }}>
            <input value={pedido} onChange={(e) => setPedido(e.target.value)} disabled={ocupado}
              placeholder="Peça uma mudança no desenho: inclua a aprovação do diretor, separe em raias…"
              aria-label="pedir à Lisa uma mudança no desenho" style={{ ...CAMPO, flex: 1, minWidth: 0 }} />
            <button type="submit" disabled={ocupado || !pedido.trim()} title="a Lisa redesenha a partir do que está no quadro (o que você arrumou fica no lugar)"
              style={{ ...BOTAO, color: GR, borderColor: "rgba(123,216,143,0.4)", opacity: ocupado || !pedido.trim() ? 0.5 : 1 }}>
              ✦ pedir à Lisa
            </button>
          </form>
        </>
      )}

      {/* o canto de redimensionar */}
      {!maximizada && !minimizada && (
        <div aria-hidden="true" onPointerDown={(e) => comecarGesto(e, "se")}
          style={{
            position: "absolute", right: 0, bottom: 0, width: 18, height: 18, zIndex: 3, cursor: "nwse-resize", touchAction: "none",
            background: "linear-gradient(135deg, transparent 0 55%, rgba(207,239,251,0.45) 55% 62%, transparent 62% 75%, rgba(207,239,251,0.45) 75% 82%, transparent 82%)",
          }} />
      )}
    </div>
  );
}
