"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";

// Precisa bater com MAX_FILES_PER_TASK em src/lib/codeTasks.js (não dá pra importar de lá
// direto — aquele módulo puxa segredo de servidor, quebraria num componente client). Sem
// limitar aqui, dava pra marcar mais arquivo do que o backend aceita, e o excesso era
// cortado em silêncio (em qualquer ordem) — foi assim que accentThemes.js e globals.css
// sumiram do contexto mesmo estando marcados, só porque vieram depois na lista.
const MAX_FILES = 6;

/**
 * A Lisa PROPÕE mudança de código: escolhe repositório + branch base, descreve o pedido, ela
 * cria uma branch nova, aplica os arquivos e abre um Pull Request — nunca mescla sozinha (ver
 * src/lib/codeTasks.js). Exige GITHUB_TOKEN com permissão de ESCRITA (Contents + Pull
 * requests: Read and write), diferente da indexação/leitura em /code-repos.
 */
export default function CodeTasksPage() {
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState("");
  const [branches, setBranches] = useState([]);
  const [baseBranch, setBaseBranch] = useState("");
  const [instruction, setInstruction] = useState("");
  const [codeFiles, setCodeFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileFilter, setFileFilter] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/code-tasks");
      const data = await res.json();
      if (data.ok) setTasks(data.tasks);
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/code-repos").then((r) => r.json()).then((d) => { if (d.ok) setRepos((d.repos || []).filter((r) => r.enabled)); }).catch(() => {});
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    setBaseBranch("");
    setBranches([]);
    setCodeFiles([]);
    setSelectedFiles([]);
    if (!repo) return;
    fetch(`/api/code-repos/branches?repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setBranches(d.branches || []);
          const found = repos.find((r) => r.full_name === repo);
          setBaseBranch(found?.default_branch && d.branches.includes(found.default_branch) ? found.default_branch : d.branches[0] || "");
        }
      })
      .catch(() => {});
    fetch(`/api/code-repos/files?repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCodeFiles(d.files || []); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  const toggleFile = (path) => {
    setSelectedFiles((sel) => {
      if (sel.includes(path)) return sel.filter((p) => p !== path);
      if (sel.length >= MAX_FILES) return sel; // no limite, ignora — nunca deixa passar do que o backend aceita
      return [...sel, path];
    });
  };

  // Um PASSO da tarefa (um pedido HTTP com seu próprio teto de 60s — ver runCodeTaskStep em
  // src/lib/codeTasks.js). submit() chama isso em loop, passando o taskId adiante, até o
  // evento "step_done" vir com done:true — assim a tarefa inteira nunca fica presa a uma
  // única janela de 60s, mesmo tocando vários arquivos ou com o Gemini mais lento.
  const runStep = async (taskId) => {
    const res = await fetch("/api/code-tasks/step", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId, repo, baseBranch, instruction, filePaths: selectedFiles }),
    });
    if (!res.ok || !res.body) { const e = new Error(`HTTP ${res.status}`); e.taskId = taskId; throw e; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let stepDone = null;
    let seenTaskId = taskId; // capturado do 1º evento com taskId (não só do step_done) — pra
    // conseguir RETOMAR pelo mesmo taskId se a conexão cair antes do passo terminar.
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
        if (payload.taskId) seenTaskId = payload.taskId;
        if (event === "stage") setResult((r) => ({ ...(r || {}), stage: payload.stage }));
        else if (event === "step_done") stepDone = payload;
      }
    }
    // esse passo fechou sem "step_done" — o teto de 60s matou a função no meio dele (raro,
    // já que cada passo agora é bem menor que a tarefa toda, mas ainda possível com o Gemini
    // mais lento que o normal). submit() tenta de novo automaticamente, sem pressa.
    if (!stepDone) { const e = new Error("um passo da tarefa foi cortado no meio (estourou 60s) — tentando de novo"); e.taskId = seenTaskId; throw e; }
    return stepDone;
  };

  const submit = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      let taskId = null;
      let stepResult = null;
      // sem pressa: se UM passo isolado falhar, tenta de novo sozinho (retomando pelo mesmo
      // taskId) em vez de desistir — só joga o erro pro usuário depois de várias falhas SEGUIDAS.
      let retries = 0;
      const MAX_RETRIES = 20;
      do {
        try {
          stepResult = await runStep(taskId);
          retries = 0;
        } catch (stepErr) {
          taskId = stepErr.taskId ?? taskId;
          retries++;
          if (retries > MAX_RETRIES) throw stepErr;
          setResult((r) => ({ ...(r || {}), lastRetry: `${stepErr.message} (tentativa ${retries}/${MAX_RETRIES})` }));
          await new Promise((r) => setTimeout(r, Math.min(2000 * retries, 15000)));
          continue;
        }
        taskId = stepResult.taskId ?? taskId;
      } while (!stepResult?.done);
      if (!stepResult.ok) throw new Error(stepResult.error || "não consegui completar a tarefa");
      setResult(stepResult);
      setInstruction("");
      setSelectedFiles([]);
      await loadTasks();
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
      <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY, marginBottom: 8 }}>◈ TAREFAS DE CÓDIGO</div>
      <div style={{ fontSize: 11, color: "rgba(207,239,251,0.5)", marginBottom: 20, lineHeight: 1.5, maxWidth: 640 }}>
        A Lisa nunca commita direto na branch escolhida — ela cria uma branch nova a partir
        dela, aplica as mudanças lá, e abre um Pull Request de volta. Mesclar é sempre manual,
        feito por você no GitHub.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px,1fr) minmax(320px,1.4fr)", gap: 20, alignItems: "start" }}>
        <div style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: "16px 18px", background: "rgba(0,0,0,0.2)" }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(207,239,251,0.55)" }}>NOVA TAREFA</div>

          <div style={labelStyle}>REPOSITÓRIO</div>
          <select value={repo} onChange={(e) => setRepo(e.target.value)} style={inputStyle}>
            <option value="">selecione…</option>
            {repos.map((r) => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
          </select>

          <div style={labelStyle}>BRANCH BASE (de onde a branch nova vai partir, e pra onde volta o PR)</div>
          <select value={baseBranch} onChange={(e) => setBaseBranch(e.target.value)} disabled={!repo} style={inputStyle}>
            <option value="">{repo ? "selecione…" : "escolha um repositório primeiro"}</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>

          <div style={labelStyle}>O QUE VOCÊ QUER</div>
          <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="ex.: corrige o bug em X, adiciona um botão que faz Y" rows={4} style={{ ...inputStyle, resize: "vertical" }} />

          <div style={labelStyle}>
            ARQUIVOS (opcional, no máx. {MAX_FILES} — garante que entrem no contexto, além do que a busca semântica achar sozinha)
          </div>
          {repo ? (
            <>
              <input
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                placeholder={`filtrar entre ${codeFiles.length} arquivos indexados…`}
                style={{ ...inputStyle, marginBottom: 6 }}
              />
              <div style={{ fontSize: 10.5, color: selectedFiles.length >= MAX_FILES ? OR : PU, marginBottom: 6 }}>
                {selectedFiles.length}/{MAX_FILES} selecionado(s){selectedFiles.length ? `: ${selectedFiles.join(", ")}` : ""}
                {selectedFiles.length >= MAX_FILES && " — limite atingido, desmarque algum pra trocar"}
              </div>
              <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid rgba(var(--accent-rgb),0.12)", borderRadius: 6, padding: "6px 8px" }}>
                {codeFiles
                  .filter((f) => !fileFilter.trim() || f.toLowerCase().includes(fileFilter.toLowerCase()))
                  .slice(0, 200)
                  .map((f) => {
                    const checked = selectedFiles.includes(f);
                    const disabled = !checked && selectedFiles.length >= MAX_FILES;
                    return (
                      <label key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 11.5, color: disabled ? "rgba(207,239,251,0.35)" : "#eafcff", cursor: disabled ? "not-allowed" : "pointer" }}>
                        <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleFile(f)} />
                        {f}
                      </label>
                    );
                  })}
                {codeFiles.length === 0 && <div style={{ ...mono, fontSize: 10, color: "rgba(207,239,251,0.4)" }}>nenhum arquivo indexado ainda pra esse repositório.</div>}
              </div>
            </>
          ) : (
            <div style={{ ...mono, fontSize: 10, color: "rgba(207,239,251,0.4)" }}>escolha um repositório primeiro</div>
          )}

          {error && <div style={{ ...mono, fontSize: 10, color: OR, marginTop: 10 }}>⚠ {error}</div>}
          {result?.ok && (
            <div style={{ ...mono, fontSize: 10, color: GR, marginTop: 10, lineHeight: 1.6 }}>
              ✓ PR aberto: <a href={result.pr_url} target="_blank" rel="noreferrer" style={{ color: GR }}>{result.pr_url}</a>
              <br />arquivos: {result.files?.join(", ")}
            </div>
          )}

          <button
            onClick={submit}
            disabled={running || !repo || !baseBranch || !instruction.trim()}
            style={{ ...mono, fontSize: 10.5, letterSpacing: 1.5, padding: "10px 14px", borderRadius: 6, border: `1px solid ${PU}`, background: "rgba(201,166,255,0.1)", color: "#eafcff", cursor: running ? "wait" : "pointer", width: "100%", marginTop: 16 }}
          >
            {running ? "GERANDO E ABRINDO PR…" : "◈ CRIAR PULL REQUEST"}
          </button>
        </div>

        <div>
          <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(207,239,251,0.55)", marginBottom: 10 }}>HISTÓRICO</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(tasks || []).map((t) => (
              <div key={t.id} style={{ border: "1px solid rgba(var(--accent-rgb),0.14)", borderRadius: 6, padding: "10px 14px", background: "rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "#eafcff" }}>{t.repo} <span style={{ color: "rgba(207,239,251,0.4)" }}>→ {t.base_branch}</span></span>
                  <span style={{ ...mono, fontSize: 9, color: t.status === "done" ? GR : t.status === "error" ? OR : CY }}>{t.status}</span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(207,239,251,0.6)", marginTop: 4 }}>{t.instruction}</div>
                {t.pr_url && <a href={t.pr_url} target="_blank" rel="noreferrer" style={{ ...mono, fontSize: 10, color: GR, marginTop: 4, display: "inline-block" }}>{t.pr_url}</a>}
                {t.error && <div style={{ ...mono, fontSize: 10, color: OR, marginTop: 4 }}>⚠ {t.error}</div>}
              </div>
            ))}
            {tasks && tasks.length === 0 && <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)" }}>nenhuma tarefa ainda.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
