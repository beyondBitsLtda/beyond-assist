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
//
// "⧉ destacar" (como na IDE): a janela vai para uma janela de verdade do sistema (outro monitor),
// desenhada lá por um portal do React. O iframe nasce de novo na janela nova (e de novo ao voltar),
// então o quadro guarda o desenho como está (`ultimoDoc`, com o que a pessoa mexeu) e reabre ele —
// nada se perde na mudança. Os avisos do quadro chegam pela janela onde o iframe está.
//
// "💾 salvar" (01/11/2026, ProcessMap na Lisa): guarda o desenho num projeto do painel ProcessMap
// (/fluxogramas, SalvarFluxo.js). Dali em diante o quadro grava sozinho o que mudar — o que a pessoa
// mexe e o que a Lisa redesenha a pedido (`versao.mudanca`); um desenho novo (outro pedido de
// desenho) começa sem salvar, para não gravar por cima do fluxo guardado.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CY, OR, GR, mono } from "@/lib/theme.js";
import { ajustarCaixa, moverCaixa, redimensionarCaixa } from "@/lib/janelaFlutuante.js";
import { prepararJanelaSeparada } from "./IdeDaLisa.js";
import SalvarFluxo from "./SalvarFluxo.js";
import { apiDosFluxos, assinaturaDoDesenho, criarSalvador, enderecoDoFluxo, LIMITE_DO_KEEPALIVE } from "@/lib/fluxogramasNoNavegador.js";

const CHAVE_DA_CAIXA = "lisa-quadro-caixa";
const tela = () => ({ w: window.innerWidth, h: window.innerHeight });
const BOTAO = { ...mono, fontSize: 10, padding: "3px 9px", borderRadius: 5, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "transparent", color: "#cfeffb", cursor: "pointer" };
const apiDosFluxosSalvos = apiDosFluxos();
const ESTADO_DO_SALVO = { salvo: "✓ salvo", pendente: "✓ salvo · alterado…", salvando: "salvando…", erro: "⚠ não salvou", conflito: "⚠ mudou em outra aba" };
const CAMPO = { ...mono, fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "rgba(0,0,0,0.35)", color: "#eafcff", outline: "none" };

export default function QuadroDaLisa({ versao, titulo = "", explicacao = "", ocupado = false, aoMudar, aoPedir, aoFechar }) {
  const quadro = useRef(null);
  const importada = useRef(null); // a chave da versão que o quadro já abriu
  const ultimoDoc = useRef(null); // o desenho como está agora (com o que a pessoa mexeu)
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
  const [separada, setSeparada] = useState(null); // { win, raiz } — o quadro numa janela do sistema
  const [podeSeparar, setPodeSeparar] = useState(false);
  const [avisoSeparar, setAvisoSeparar] = useState("");
  const separadaRef = useRef(null);
  separadaRef.current = separada;
  const ponte = () => quadro.current?.contentWindow?.PonteDoProof || null;
  // o fluxo guardado no ProcessMap ({ fluxo, projeto }) e o salvamento automático dele
  const [salvo, setSalvo] = useState(null);
  const salvoRef = useRef(null);
  const salvador = useRef(null);
  const [estadoSalvo, setEstadoSalvo] = useState("salvo");
  const [salvarAberto, setSalvarAberto] = useState(false);
  const vivo = useRef(true);

  /** Passa a gravar sozinho no fluxo guardado (ou para de gravar, com `null`). */
  const ligarSalvo = (r, doc) => {
    salvador.current?.parar();
    salvador.current = null;
    salvoRef.current = r;
    setSalvo(r);
    setEstadoSalvo("salvo");
    if (!r) return;
    const id = r.fluxo.id;
    salvador.current = criarSalvador({
      versao: r.fluxo.versao,
      assinatura: assinaturaDoDesenho(doc),
      gravar: (d, { versao, forcar, saindo }) => apiDosFluxosSalvos.salvar(id, { documento: d, versao, forcar },
        saindo && JSON.stringify(d).length < LIMITE_DO_KEEPALIVE ? { keepalive: true } : undefined),
      aoEstado: (e) => { if (vivo.current && salvoRef.current?.fluxo.id === id) setEstadoSalvo(e.estado); },
    });
  };

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

  // janela separada só no computador: no celular, uma "janela" nova é só outra aba
  useEffect(() => {
    setPodeSeparar(!window.matchMedia?.("(pointer: coarse)").matches && window.innerWidth >= 700);
  }, []);

  /**
   * Abre no quadro o desenho certo: a versão nova que a Lisa mandou ou — quando o iframe acabou de
   * nascer (`deNovo`: destacou, voltou) — o desenho como estava, com o que a pessoa mexeu.
   */
  const importar = (deNovo = false) => {
    const p = ponte();
    const v = versaoRef.current;
    if (!p || !v?.doc) return;
    const mesmaVersao = importada.current === v.chave;
    if (mesmaVersao && !deNovo) return;
    try {
      p.importar(mesmaVersao && ultimoDoc.current ? ultimoDoc.current : v.doc);
      if (v.colecao) p.colecao(v.colecao);
      const novaVersao = !mesmaVersao && importada.current !== null;
      importada.current = v.chave;
      if (salvoRef.current) {
        p.nome(salvoRef.current.fluxo.nome);
        // a Lisa mudou o desenho guardado: grava; um desenho novo não é o guardado: para de gravar
        if (novaVersao && v.mudanca) salvador.current?.mudou(p.exportar());
        else if (novaVersao) ligarSalvo(null);
      }
    } catch { /* desenho estragado: o quadro fica com o de antes */ }
  };
  useEffect(() => { importar(); }, [versao?.chave]);

  // o quadro avisa: pronto (abre o desenho) e cada mudança (o documento inteiro volta para a página).
  // Com o quadro destacado, os avisos chegam pela janela separada (é ela a "mãe" do iframe).
  useEffect(() => {
    function ouvir(e) {
      if (e.source !== quadro.current?.contentWindow || e.data?.origem !== "quadro") return;
      if (e.data.tipo === "pronto") { importar(true); return; }
      // Ctrl+S no quadro: grava já (ou abre o "salvar", se ainda não foi guardado)
      // (o desenho é lido agora: a última mudança ainda pode estar na espera do "mudou")
      if (e.data.tipo === "salvar") {
        const s = salvador.current;
        if (!s) { setSalvarAberto(true); return; }
        try { const d = ponte()?.exportar(); if (d) { ultimoDoc.current = d; s.mudou(d); } } catch { /* grava o que já tinha */ }
        s.agora();
        return;
      }
      if (e.data.tipo !== "mudou") return;
      clearTimeout(espera.current);
      espera.current = setTimeout(() => {
        const p = ponte();
        if (!p) return;
        ultimoDoc.current = p.exportar();
        aoMudarRef.current?.(ultimoDoc.current);
        salvador.current?.mudou(ultimoDoc.current);
      }, 500);
    }
    const outra = separada?.win;
    window.addEventListener("message", ouvir);
    outra?.addEventListener("message", ouvir);
    return () => {
      window.removeEventListener("message", ouvir);
      try { outra?.removeEventListener("message", ouvir); } catch { /* a janela já fechou */ }
      clearTimeout(espera.current);
    };
  }, [separada]);

  // a janela separada fechou (pelo X do sistema ou pelo botão): o quadro volta para a página. E se a
  // página da Lisa fechar ou recarregar, a separada fecha junto (sem ela, ficaria vazia).
  useEffect(() => {
    if (!separada) return undefined;
    const vigia = setInterval(() => { if (separada.win.closed) setSeparada(null); }, 600);
    const fecharJunto = () => { try { separada.win.close(); } catch { /* já fechou */ } };
    window.addEventListener("pagehide", fecharJunto);
    return () => { clearInterval(vigia); window.removeEventListener("pagehide", fecharJunto); };
  }, [separada]);
  useEffect(() => () => { try { separadaRef.current?.win.close(); } catch { /* já fechou */ } }, []);
  // fechar o quadro grava o que faltou; fechar a página manda com keepalive
  useEffect(() => {
    vivo.current = true;
    const sair = () => salvador.current?.sair();
    window.addEventListener("pagehide", sair);
    return () => { vivo.current = false; window.removeEventListener("pagehide", sair); salvador.current?.agora(); };
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

  /** Guarda o desenho como está agora (o iframe vai nascer de novo na outra janela). */
  const guardarAgora = () => {
    try { const p = ponte(); if (p) ultimoDoc.current = p.exportar(); } catch { /* fica o último guardado */ }
  };
  // leva o quadro para uma janela do sistema, no mesmo lugar e tamanho em que ele está na página
  const separar = () => {
    guardarAgora();
    const borda = Math.max(0, window.outerHeight - window.innerHeight); // a barra do navegador
    const win = window.open("", "lisa-quadro",
      `popup=yes,width=${Math.round(caixa.w)},height=${Math.round(caixa.h)},left=${Math.round(window.screenX + caixa.x)},top=${Math.round(window.screenY + borda + caixa.y)}`);
    if (!win) {
      setAvisoSeparar("O navegador bloqueou a janela nova. Libere os pop-ups da Lisa e tente de novo.");
      return;
    }
    setAvisoSeparar("");
    setMaximizada(false);
    setMinimizada(false);
    setSeparada({ win, raiz: prepararJanelaSeparada(win, titulo ? `Quadro da Lisa · ${titulo}` : "Quadro da Lisa") });
  };
  const juntar = () => {
    guardarAgora();
    try { separada?.win.close(); } catch { /* já fechou */ }
    setSeparada(null);
  };

  const pedir = (e) => {
    e.preventDefault();
    const p = pedido.trim();
    if (!p || ocupado) return;
    aoPedir?.(p);
    setPedido("");
  };

  const colecao = versao?.colecao || "flow";
  // na página: janela flutuante com o canto de redimensionar; separada: ocupa a janela do sistema
  // inteira (quem move e redimensiona é o próprio sistema)
  const naPagina = !separada;
  const janela = (
    <div
      role="dialog"
      aria-label="Quadro da Lisa: o processo desenhado"
      style={naPagina ? {
        position: "fixed", zIndex: 189,
        left: maximizada ? "2vw" : caixa.x, top: maximizada ? "4vh" : caixa.y,
        width: maximizada ? "96vw" : caixa.w, height: minimizada ? "auto" : maximizada ? "90vh" : caixa.h,
        display: "flex", flexDirection: "column", overflow: "hidden",
        background: "#050b10", border: `1px solid ${mexendo ? CY : "rgba(var(--accent-rgb),0.3)"}`, borderRadius: 10,
        boxShadow: "0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.4)", ...mono,
        userSelect: mexendo ? "none" : undefined,
      } : {
        position: "fixed", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden",
        background: "#050b10", color: "#cfeffb", ...mono,
      }}
    >
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
            <span onPointerDown={(e) => e.stopPropagation()} onClick={aoFechar} title="fechar o quadro"
              style={{ width: 11, height: 11, borderRadius: "50%", background: OR, cursor: "pointer", opacity: 0.8 }} />
            <span onPointerDown={(e) => e.stopPropagation()} onClick={() => setMinimizada((v) => !v)} title="minimizar"
              style={{ width: 11, height: 11, borderRadius: "50%", background: "rgba(207,239,251,0.4)", cursor: "pointer" }} />
            <span onPointerDown={(e) => e.stopPropagation()} onClick={() => setMaximizada((v) => !v)} title="maximizar"
              style={{ width: 11, height: 11, borderRadius: "50%", background: GR, cursor: "pointer", opacity: 0.8 }} />
          </div>
        ) : (
          <button type="button" onClick={juntar} title="trazer o quadro de volta para a página da Lisa" style={{ ...BOTAO, flex: "none" }}>
            ↩ voltar para a página
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, justifyContent: "center" }}>
          <span style={{ fontSize: 10.5, letterSpacing: 1.5, color: CY, flex: "none" }}>◇ QUADRO DA LISA</span>
          <span style={{ fontSize: 9.5, color: ocupado ? "rgba(207,239,251,0.55)" : GR, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            — {ocupado ? "a Lisa está desenhando…" : titulo ? `${titulo} · mexa à vontade, ela vê o que mudou` : "mexa à vontade, ela vê o que mudou"}
          </span>
        </div>
        <div style={{ position: "relative", minWidth: 54, flex: "none", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
          {salvo ? (
            <>
              <span title={`salvo em ${salvo.projeto?.nome || "um projeto"} — o que mudar aqui é salvo sozinho`}
                style={{ fontSize: 10, color: estadoSalvo === "erro" || estadoSalvo === "conflito" ? OR : GR, whiteSpace: "nowrap", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis" }}>
                {ESTADO_DO_SALVO[estadoSalvo] || "✓ salvo"}{estadoSalvo === "salvo" && salvo.projeto?.nome ? ` · ${salvo.projeto.nome}` : ""}
              </span>
              <a href={enderecoDoFluxo(salvo.fluxo.id)} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}
                title="abrir este fluxograma no painel ProcessMap (outra aba)" style={{ ...BOTAO, flex: "none", textDecoration: "none" }}>
                ↗ ProcessMap
              </a>
            </>
          ) : !minimizada && (
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setSalvarAberto((v) => !v)} aria-expanded={salvarAberto}
              title="guardar este desenho num projeto do ProcessMap — depois disso, o que mudar é salvo sozinho"
              style={{ ...BOTAO, flex: "none", color: GR, borderColor: "rgba(123,216,143,0.4)" }}>
              💾 salvar
            </button>
          )}
          {salvarAberto && !salvo && !minimizada && (
            <SalvarFluxo
              nomeInicial={titulo}
              obterDocumento={() => { try { return ponte()?.exportar() || ultimoDoc.current || versaoRef.current?.doc || null; } catch { return null; } }}
              aoSalvo={(r) => {
                setSalvarAberto(false);
                let doc = null;
                try { ponte()?.nome(r.fluxo.nome); doc = ponte()?.exportar(); } catch { /* o quadro ainda vai abrir */ }
                ligarSalvo(r, doc);
              }}
              aoFechar={() => setSalvarAberto(false)}
            />
          )}
          {naPagina && podeSeparar && (
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={separar}
              title="abrir o quadro numa janela separada — dá para levar para outro monitor, maximizar e deixar ao lado"
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
          {explicacao && (
            <div style={{ display: "flex", gap: 8, padding: "8px 14px", background: "rgba(var(--accent-rgb),0.06)", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)", flex: "none", maxHeight: 90, overflowY: "auto" }}>
              <span style={{ color: CY, flex: "none", fontSize: 12 }}>💬</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "rgba(234,252,255,0.9)", whiteSpace: "pre-wrap", fontFamily: "var(--bb-fonte)" }}>{explicacao}</span>
            </div>
          )}
          <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
            <iframe
              ref={quadro} title="Quadro da Lisa" onLoad={() => importar(true)}
              // endereço completo: na janela separada (about:blank), um caminho relativo não teria base certa
              src={`${window.location.origin}/diagramas/index.html?embutido=1&tema=lisa&colecao=${encodeURIComponent(colecao)}`}
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

      {/* o canto de redimensionar (na página) */}
      {naPagina && !maximizada && !minimizada && (
        <div aria-hidden="true" onPointerDown={(e) => comecarGesto(e, "se")}
          style={{
            position: "absolute", right: 0, bottom: 0, width: 18, height: 18, zIndex: 3, cursor: "nwse-resize", touchAction: "none",
            background: "linear-gradient(135deg, transparent 0 55%, rgba(207,239,251,0.45) 55% 62%, transparent 62% 75%, rgba(207,239,251,0.45) 75% 82%, transparent 82%)",
          }} />
      )}
    </div>
  );

  if (!separada) return janela;
  // separada: o quadro é desenhado na janela do sistema; na página fica só o aviso de onde ele está
  return (
    <>
      {createPortal(janela, separada.raiz)}
      <button
        type="button"
        onClick={juntar}
        title="fechar a janela separada e trazer o quadro de volta para cá"
        style={{
          position: "fixed", left: 20, bottom: 88, zIndex: 189, ...mono, fontSize: 11.5, letterSpacing: 0.5,
          padding: "9px 14px", borderRadius: 999, border: `1px solid ${CY}`, background: "rgba(5,11,16,0.92)",
          color: "#eafcff", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        ◇ quadro numa janela separada · trazer de volta
      </button>
    </>
  );
}
