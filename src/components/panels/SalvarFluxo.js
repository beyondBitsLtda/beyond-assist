"use client";

// O "salvar" do quadro da Lisa (01/11/2026): guarda o desenho que ela fez num projeto do ProcessMap
// (/fluxogramas) — um que já existe ou um novo, criado junto. Abre por cima do quadro, ancorado no
// botão; depois de salvo, o quadro segue gravando sozinho as mudanças (QuadroDaLisa.js).

import { useEffect, useState } from "react";
import { CY, OR, GR, mono } from "@/lib/theme.js";
import { apiDosFluxos } from "@/lib/fluxogramasNoNavegador.js";

const api = apiDosFluxos();
const NOVO = "__novo__";
const CAMPO = { ...mono, fontSize: 12, padding: "6px 9px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.3)", background: "rgba(0,0,0,0.4)", color: "#eafcff", outline: "none", width: "100%", boxSizing: "border-box" };
const ROTULO = { fontSize: 10.5, letterSpacing: 0.5, color: "rgba(207,239,251,0.65)", display: "grid", gap: 4 };
const BOTAO = { ...mono, fontSize: 11, padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.3)", background: "transparent", color: "#cfeffb", cursor: "pointer" };

/**
 * `nomeInicial`: o título do desenho. `obterDocumento()`: o desenho como está agora no quadro.
 * `aoSalvo({ fluxo, projeto })` quando gravou; `aoFechar()` para cancelar.
 */
export default function SalvarFluxo({ nomeInicial = "", obterDocumento, aoSalvo, aoFechar }) {
  const [projetos, setProjetos] = useState(null);
  const [projetoId, setProjetoId] = useState("");
  const [projetoNovo, setProjetoNovo] = useState("");
  const [nome, setNome] = useState(nomeInicial || "Fluxo da Lisa");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.listar()
      .then((ps) => {
        if (!vivo) return;
        setProjetos(ps);
        // o projeto mexido por último; sem nenhum, já abre o campo do projeto novo
        setProjetoId(ps[0]?.id || NOVO);
      })
      .catch((err) => { if (vivo) { setProjetos([]); setProjetoId(NOVO); setErro(`Não consegui ler os projetos: ${err.message}`); } });
    return () => { vivo = false; };
  }, []);

  async function salvar(e) {
    e.preventDefault();
    if (salvando) return;
    const n = nome.trim();
    const novo = projetoId === NOVO;
    if (!n) { setErro("Dê um nome ao fluxograma."); return; }
    if (novo && !projetoNovo.trim()) { setErro("Dê um nome ao projeto novo."); return; }
    setSalvando(true);
    setErro("");
    try {
      const documento = obterDocumento();
      if (!documento) throw new Error("o quadro ainda não abriu");
      const r = await api.criar({ documento, nome: n, origem: "lisa", ...(novo ? { projetoNovo: projetoNovo.trim() } : { projetoId }) });
      aoSalvo?.(r);
    } catch (err) {
      setErro(`Não salvou: ${err.message}`);
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={salvar}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Escape") aoFechar?.(); }}
      role="dialog" aria-label="Salvar o desenho num projeto"
      style={{
        position: "absolute", top: "calc(100% + 6px)", right: 8, zIndex: 20, width: 300, maxWidth: "calc(100vw - 32px)",
        display: "grid", gap: 10, padding: 14, borderRadius: 10, background: "#08131a", border: `1px solid ${CY}`,
        boxShadow: "0 16px 44px rgba(0,0,0,0.6)", color: "#eafcff", cursor: "default", ...mono,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 1.2, color: CY }}>◇ SALVAR NO PROCESSMAP</div>
      <label style={ROTULO}>
        Nome do fluxograma
        <input autoFocus value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} style={CAMPO} />
      </label>
      <label style={ROTULO}>
        Projeto
        <select value={projetoId} disabled={projetos === null} onChange={(e) => setProjetoId(e.target.value)} style={CAMPO}>
          {projetos === null && <option value="">carregando…</option>}
          {projetos?.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          <option value={NOVO}>+ projeto novo…</option>
        </select>
      </label>
      {projetoId === NOVO && (
        <label style={ROTULO}>
          Nome do projeto novo
          <input value={projetoNovo} maxLength={80} placeholder="ex.: Compras" onChange={(e) => setProjetoNovo(e.target.value)} style={CAMPO} />
        </label>
      )}
      {erro && <div role="alert" style={{ fontSize: 11.5, color: OR, lineHeight: 1.4 }}>{erro}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={aoFechar} style={BOTAO}>cancelar</button>
        <button type="submit" disabled={salvando || projetos === null}
          style={{ ...BOTAO, color: GR, borderColor: "rgba(123,216,143,0.45)", opacity: salvando || projetos === null ? 0.55 : 1 }}>
          {salvando ? "salvando…" : "salvar"}
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: "rgba(207,239,251,0.5)", lineHeight: 1.45 }}>
        Depois de salvo, o que você ou a Lisa mudarem no quadro também é salvo sozinho.
      </div>
    </form>
  );
}
