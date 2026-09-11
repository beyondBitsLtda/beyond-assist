"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import { CY, GR, OR, mono } from "@/lib/theme.js";

// IDE do Pair Programming: você e a Lisa editando o MESMO arquivo, no editor do VS Code
// (Monaco) rodando no navegador — com destaque de sintaxe e marcação de erro de verdade
// (o serviço de TypeScript do próprio Monaco, o mesmo do VS Code).
//
// O Monaco é servido de public/monaco (vendorizado), não do CDN padrão do pacote: mesma decisão
// dos modelos do MediaPipe. Rede corporativa bloqueando CDN não pode quebrar a ferramenta.
loader.config({ paths: { vs: "/monaco/vs" } });

const EXT_LANG = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript",
  css: "css", scss: "scss", html: "html", json: "json", md: "markdown",
  yml: "yaml", yaml: "yaml", py: "python", java: "java", cs: "csharp",
  cpp: "cpp", c: "c", h: "cpp", go: "go", rb: "ruby", php: "php", sql: "sql", sh: "shell",
};
const langOf = (path) => EXT_LANG[(path.split(".").pop() || "").toLowerCase()] || "plaintext";

// quanto tempo a "digitação" da Lisa leva pra revelar o arquivo inteiro — é o que faz você VER
// a edição acontecer em vez de o texto trocar num piscar
const TYPE_MS = 1100;

export default function LisaPairIDE({ repo, branch, onMood }) {
  const [files, setFiles] = useState(null);
  const [filter, setFilter] = useState("");
  const [path, setPath] = useState(null);
  const [value, setValue] = useState("");
  const [original, setOriginal] = useState(""); // como estava ao abrir — base do "alterado?"
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(null); // 'tree' | 'file' | 'edit' | 'save'
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null); // explicação da última edição dela
  const [problems, setProblems] = useState([]);
  const [saved, setSaved] = useState(false);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const typingRef = useRef(null);
  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;

  const call = useCallback(
    async (body) => {
      const res = await fetch("/api/pair", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo, branch, ...body }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      return data;
    },
    [repo, branch]
  );

  // lista os arquivos da branch
  useEffect(() => {
    if (!repo || !branch) return;
    setBusy("tree");
    call({ action: "tree" })
      .then((d) => setFiles(d.files))
      .catch((err) => setError(err.message))
      .finally(() => setBusy(null));
  }, [repo, branch, call]);

  useEffect(() => () => clearInterval(typingRef.current), []);

  const openFile = async (p) => {
    clearInterval(typingRef.current);
    setBusy("file");
    setError(null);
    setNote(null);
    setSaved(false);
    try {
      const d = await call({ action: "file", path: p });
      setPath(p);
      setValue(d.content);
      setOriginal(d.content);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  /** Revela o novo conteúdo aos poucos — a "edição em tempo real" que dá pra assistir. */
  const typeIn = (text) => {
    clearInterval(typingRef.current);
    const steps = 28;
    let i = 0;
    typingRef.current = setInterval(() => {
      i++;
      const upto = Math.round((text.length * i) / steps);
      setValue(text.slice(0, upto));
      if (i >= steps) {
        clearInterval(typingRef.current);
        setValue(text); // garante o conteúdo exato no fim, sem depender do arredondamento
      }
    }, TYPE_MS / steps);
  };

  const askLisa = async () => {
    if (!path || !instruction.trim()) return;
    setBusy("edit");
    setError(null);
    setNote(null);
    setSaved(false);
    onMoodRef.current?.("thinking");
    try {
      const d = await call({ action: "edit", path, content: value, instruction });
      setNote(d.explanation);
      if (d.changed && d.newContent !== value) {
        typeIn(d.newContent);
        onMoodRef.current?.("proud");
      } else {
        onMoodRef.current?.("confused"); // ela decidiu não mexer — a explicação diz o porquê
      }
      setInstruction("");
    } catch (err) {
      setError(err.message);
      onMoodRef.current?.("worried");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!path) return;
    setBusy("save");
    setError(null);
    try {
      await call({ action: "save", path, content: value, message: `pair: ${path}` });
      setOriginal(value);
      setSaved(true);
      onMoodRef.current?.("star");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  // erros/avisos vêm do próprio Monaco (serviço de TS/JS), não de heurística nossa
  const onMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    const refresh = () => {
      const model = editor.getModel();
      if (!model) return;
      setProblems(
        monaco.editor
          .getModelMarkers({ resource: model.uri })
          .filter((m) => m.severity >= monaco.MarkerSeverity.Warning)
          .slice(0, 30)
      );
    };
    monaco.editor.onDidChangeMarkers(refresh);
    refresh();
  };

  const dirty = value !== original;
  const shown = (files || []).filter((f) => !filter || f.toLowerCase().includes(filter.toLowerCase())).slice(0, 60);
  const errCount = problems.filter((p) => p.severity === 8).length;
  const warnCount = problems.length - errCount;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* seletor de arquivo */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={files ? `buscar em ${files.length} arquivos…` : "carregando arquivos…"}
          style={{ ...mono, fontSize: 10, flex: 1, minWidth: 140, padding: "6px 8px", borderRadius: 5, border: "1px solid rgba(var(--accent-rgb),0.22)", background: "#08131a", color: "#eafcff" }}
        />
        {path && (
          <span style={{ ...mono, fontSize: 9.5, color: dirty ? OR : "rgba(207,239,251,0.5)" }} title={path}>
            {path.split("/").slice(-1)[0]}{dirty ? " •" : ""}
          </span>
        )}
      </div>

      {!path && (
        <div style={{ maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, border: "1px solid rgba(var(--accent-rgb),0.14)", borderRadius: 6, padding: 4 }}>
          {shown.length === 0 && <div style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.35)", padding: 6 }}>{files ? "nenhum arquivo com esse nome" : "…"}</div>}
          {shown.map((f) => (
            <button
              key={f}
              onClick={() => openFile(f)}
              style={{ ...mono, fontSize: 9.5, textAlign: "left", padding: "5px 7px", borderRadius: 4, border: "none", background: "transparent", color: "rgba(207,239,251,0.8)", cursor: "pointer" }}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {path && (
        <>
          <div style={{ border: "1px solid rgba(var(--accent-rgb),0.22)", borderRadius: 6, overflow: "hidden" }}>
            <Editor
              height="340px"
              theme="vs-dark"
              path={path}
              language={langOf(path)}
              value={value}
              onChange={(v) => setValue(v ?? "")}
              onMount={onMount}
              options={{
                fontSize: 12,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                automaticLayout: true,
              }}
            />
          </div>

          {/* erros e avisos reais do editor */}
          <div style={{ ...mono, fontSize: 9, letterSpacing: 0.5, display: "flex", gap: 10, color: "rgba(207,239,251,0.5)" }}>
            <span style={{ color: errCount ? OR : "rgba(207,239,251,0.4)" }}>{errCount} erro(s)</span>
            <span>{warnCount} aviso(s)</span>
            <button onClick={() => { setPath(null); setNote(null); }} style={{ ...mono, fontSize: 9, marginLeft: "auto", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(var(--accent-rgb),0.2)", background: "transparent", color: "rgba(207,239,251,0.6)", cursor: "pointer" }}>
              trocar arquivo
            </button>
          </div>
          {problems.slice(0, 3).map((p, i) => (
            <div key={i} style={{ ...mono, fontSize: 9, color: p.severity === 8 ? OR : "rgba(207,239,251,0.5)" }}>
              linha {p.startLineNumber}: {p.message.slice(0, 120)}
            </div>
          ))}

          {/* pedir pra ela mexer */}
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askLisa()}
              placeholder="peça algo: 'extrai isso numa função', 'corrige o erro da linha 12'…"
              disabled={busy === "edit"}
              style={{ ...mono, fontSize: 10, flex: 1, padding: "8px 9px", borderRadius: 5, border: "1px solid rgba(var(--accent-rgb),0.22)", background: "#08131a", color: "#eafcff" }}
            />
            <button
              onClick={askLisa}
              disabled={busy === "edit" || !instruction.trim()}
              style={{ ...mono, fontSize: 9.5, letterSpacing: 1, padding: "8px 12px", borderRadius: 5, border: `1px solid ${CY}`, background: "rgba(var(--accent-rgb),0.1)", color: "#eafcff", cursor: busy === "edit" ? "wait" : "pointer" }}
            >
              {busy === "edit" ? "…" : "PEDIR"}
            </button>
          </div>

          {note && <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "#eafcff", padding: "8px 10px", borderRadius: 6, background: "rgba(var(--accent-rgb),0.06)" }}>{note}</div>}

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={save}
              disabled={busy === "save" || !dirty}
              title={branch ? `commita em ${branch}` : "sem branch — a sessão abriu sem ela"}
              style={{ ...mono, fontSize: 9.5, letterSpacing: 1, padding: "8px 12px", borderRadius: 5, border: `1px solid ${dirty ? GR : "rgba(var(--accent-rgb),0.2)"}`, background: dirty ? "rgba(123,216,143,0.1)" : "transparent", color: dirty ? "#eafcff" : "rgba(207,239,251,0.4)", cursor: dirty ? "pointer" : "default" }}
            >
              {busy === "save" ? "SALVANDO…" : `SALVAR NA BRANCH`}
            </button>
            {saved && <span style={{ ...mono, fontSize: 9, color: GR }}>commitado em {branch}</span>}
            {!dirty && !saved && <span style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.35)" }}>nada alterado</span>}
          </div>
        </>
      )}

      {error && <div style={{ ...mono, fontSize: 9.5, color: OR }}>⚠ {error}</div>}
    </div>
  );
}
