"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";

const STAGE_LABELS = {
  grouping: "🔍 mapeando a estrutura de pastas",
  "scan-imports": "🕸️ seguindo os imports pra achar as conexões reais",
  describe: "🧠 descrevendo cada área",
  overview: "✍️ escrevendo a visão geral",
  render: "📄 montando o documento",
};

/**
 * A Lisa gera um HTML autônomo (com diagrama) documentando a arquitetura de um repositório já
 * indexado (ver /code-repos): áreas do código, o que cada uma faz, e como se relacionam de
 * verdade (grafo de dependência calculado pelos imports, não "achismo" — ver
 * src/lib/archDocs.js). Mesmo padrão retomável em passos de /code-tasks — sem pressa, cada
 * passo tem seu próprio teto de 60s.
 */
export default function ArchDocsPage() {
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null); // { stage, narration }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState(null);

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/arch-docs");
      const data = await res.json();
      if (data.ok) setDocs(data.docs);
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/code-repos").then((r) => r.json()).then((d) => { if (d.ok) setRepos((d.repos || []).filter((r) => r.enabled)); }).catch(() => {});
    loadDocs();
  }, [loadDocs]);

  // Um PASSO da geração (um pedido HTTP com seu próprio teto de 60s — ver runArchDocStep em
  // src/lib/archDocs.js). generate() chama isso em loop, passando o docId adiante, até
  // "step_done" vir com done:true.
  const runStep = async (docId) => {
    const res = await fetch("/api/arch-docs/step", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ docId, repo }),
    });
    if (!res.ok || !res.body) { const e = new Error(`HTTP ${res.status}`); e.docId = docId; throw e; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let stepDone = null;
    let seenDocId = docId;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        let event = "message", data = "";
        for (const line of part.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        let payload;
        try { payload = JSON.parse(data); } catch { continue; }
        if (payload.docId) seenDocId = payload.docId;
        if (event === "stage") setProgress((p) => ({ ...(p || {}), stage: payload.stage }));
        else if (event === "narration") setProgress((p) => ({ ...(p || {}), narration: payload.text }));
        else if (event === "step_done") stepDone = payload;
      }
    }
    // esse passo fechou sem "step_done" — o teto de 60s matou a função no meio dele. Sem
    // pressa: generate() tenta de novo sozinho, retomando pelo mesmo docId.
    if (!stepDone) { const e = new Error("um passo foi cortado no meio (estourou 60s) — tentando de novo"); e.docId = seenDocId; throw e; }
    return stepDone;
  };

  const generate = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    setProgress({ stage: null, narration: "Começando…" });
    try {
      let docId = null;
      let stepResult = null;
      let retries = 0;
      const MAX_RETRIES = 20;
      do {
        try {
          stepResult = await runStep(docId);
          retries = 0;
        } catch (stepErr) {
          docId = stepErr.docId ?? docId;
          retries++;
          if (retries > MAX_RETRIES) throw stepErr;
          setProgress((p) => ({ ...(p || {}), narration: `${stepErr.message} (tentativa ${retries}/${MAX_RETRIES})` }));
          await new Promise((r) => setTimeout(r, Math.min(2000 * retries, 15000)));
          continue;
        }
        docId = stepResult.docId ?? docId;
      } while (!stepResult?.done);
      if (!stepResult.ok) throw new Error(stepResult.error || "não consegui gerar o documento");
      setResult({ docId });
      await loadDocs();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const inputStyle = { ...mono, fontSize: 12, padding: "9px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#000", color: "#eafcff", width: "100%" };
  const labelStyle = { ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginBottom: 6, marginTop: 14 };

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY, marginBottom: 8 }}>◈ MAPA DE ARQUITETURA</div>
      <div style={{ fontSize: 11, color: "rgba(207,239,251,0.5)", marginBottom: 20, lineHeight: 1.5, maxWidth: 640 }}>
        Gera um documento HTML autônomo com as áreas do repositório escolhido, o que cada uma
        faz, e um diagrama de como se conectam de verdade (calculado a partir dos imports reais
        entre os arquivos indexados — não é a IA "achando" a relação).
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,1fr) minmax(320px,1.4fr)", gap: 20, alignItems: "start" }}>
        <div style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: "16px 18px", background: "rgba(0,0,0,0.2)" }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(207,239,251,0.55)" }}>NOVO MAPA</div>

          <div style={labelStyle}>REPOSITÓRIO</div>
          <select value={repo} onChange={(e) => setRepo(e.target.value)} style={inputStyle} disabled={running}>
            <option value="">selecione…</option>
            {repos.map((r) => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
          </select>

          {running && progress && (
            <div style={{ marginTop: 16, padding: "10px 12px", border: `1px solid ${PU}55`, borderRadius: 6, background: "rgba(201,166,255,0.06)" }}>
              <div style={{ fontSize: 10.5, color: PU }}>{progress.stage ? (STAGE_LABELS[progress.stage] || progress.stage) : "iniciando…"}</div>
              {progress.narration && <div style={{ fontSize: 11, color: "rgba(207,239,251,0.7)", marginTop: 6 }}>{progress.narration}</div>}
            </div>
          )}

          {error && <div style={{ ...mono, fontSize: 10, color: OR, marginTop: 10 }}>⚠ {error}</div>}
          {result?.docId && !running && (
            <div style={{ ...mono, fontSize: 10, color: GR, marginTop: 10 }}>
              ✓ pronto — <a href={`/api/arch-docs/${result.docId}/html`} target="_blank" rel="noreferrer" style={{ color: GR }}>abrir documento</a>
            </div>
          )}

          <button
            onClick={generate}
            disabled={running || !repo}
            style={{ ...mono, fontSize: 10.5, letterSpacing: 1.5, padding: "10px 14px", borderRadius: 6, border: `1px solid ${PU}`, background: "rgba(201,166,255,0.1)", color: "#eafcff", cursor: running ? "wait" : "pointer", width: "100%", marginTop: 16 }}
          >
            {running ? "GERANDO…" : "◈ GERAR MAPA DE ARQUITETURA"}
          </button>
        </div>

        <div>
          <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(207,239,251,0.55)", marginBottom: 10 }}>HISTÓRICO</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(docs || []).map((d) => (
              <div key={d.id} style={{ border: "1px solid rgba(var(--accent-rgb),0.14)", borderRadius: 6, padding: "10px 14px", background: "rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "#eafcff" }}>{d.repo}</span>
                  <span style={{ ...mono, fontSize: 9, color: d.status === "done" ? GR : d.status === "error" ? OR : CY }}>{d.status}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "rgba(207,239,251,0.4)", marginTop: 4 }}>{new Date(d.created_at).toLocaleString("pt-BR")}</div>
                {d.status === "done" && (
                  <a href={`/api/arch-docs/${d.id}/html`} target="_blank" rel="noreferrer" style={{ ...mono, fontSize: 10, color: GR, marginTop: 4, display: "inline-block" }}>
                    abrir documento
                  </a>
                )}
                {d.error && <div style={{ ...mono, fontSize: 10, color: OR, marginTop: 4 }}>⚠ {d.error}</div>}
              </div>
            ))}
            {docs && docs.length === 0 && <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)" }}>nenhum mapa gerado ainda.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
