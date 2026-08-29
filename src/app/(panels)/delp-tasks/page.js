"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";

// Colunas fixas — são os 3 únicos valores de Status que a planilha do PMO usa hoje (ver
// src/lib/delpTasks.js). Uma tarefa com um status diferente/novo cai na coluna "Outros",
// pra nunca sumir silenciosamente de vista se o PMO mudar os nomes de status um dia.
const COLUMNS = [
  { key: "Esperando", label: "ESPERANDO", color: OR },
  { key: "Em progresso", label: "EM PROGRESSO", color: CY },
  { key: "Concluído", label: "CONCLUÍDO", color: GR },
];

// `Buffer` é API do Node — não existe no navegador. Conversão manual pra base64, em pedaços
// (evita "Maximum call stack size exceeded" do spread em arquivos maiores).
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function fmtDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function TaskCard({ task }) {
  const due = fmtDate(task.data_limite);
  const overdue = due && task.status !== "Concluído" && new Date(task.data_limite) < new Date(new Date().toDateString());
  return (
    <div
      style={{
        border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: "10px 12px",
        background: "rgba(0,0,0,0.22)", marginBottom: 8,
      }}
    >
      <div style={{ fontSize: 12.5, color: "#eafcff", lineHeight: 1.35, marginBottom: 6 }}>{task.titulo}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, ...mono, fontSize: 9 }}>
        {task.atribuido_a && task.atribuido_a !== "-" && (
          <span style={{ color: "rgba(207,239,251,0.55)" }}>👤 {task.atribuido_a}</span>
        )}
        {due && (
          <span style={{ color: overdue ? OR : "rgba(207,239,251,0.55)" }}>
            {overdue ? "⚠ " : "🗓 "}{due}
          </span>
        )}
        {task.etapa && task.etapa !== "-" && <span style={{ color: PU }}>{task.etapa}</span>}
        {task.sprint && <span style={{ color: "rgba(207,239,251,0.35)" }}>{task.sprint}</span>}
      </div>
    </div>
  );
}

export default function DelpTasksPage() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/delp-tasks");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "falha ao carregar tarefas");
      setTasks(json.tasks || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const res = await fetch("/api/delp-tasks/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: base64 }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setUploadMsg({ ok: true, text: `${json.count} tarefas carregadas.` });
      await load();
    } catch (err) {
      setUploadMsg({ ok: false, text: err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [load]);

  const grouped = COLUMNS.map((col) => ({ ...col, tasks: (tasks || []).filter((t) => t.status === col.key) }));
  const knownStatuses = new Set(COLUMNS.map((c) => c.key));
  const others = (tasks || []).filter((t) => !knownStatuses.has(t.status));

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ TAREFAS DA DELP · KANBAN</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input ref={fileInputRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(var(--accent-rgb),0.06)", color: "#eafcff", cursor: uploading ? "wait" : "pointer" }}
          >
            {uploading ? "enviando…" : "⇪ TROCAR PLANILHA (.xlsx)"}
          </button>
          <button
            onClick={load}
            disabled={loading}
            style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: "1px solid rgba(var(--accent-rgb),0.3)", borderRadius: 3, background: "transparent", color: "rgba(207,239,251,0.7)", cursor: loading ? "wait" : "pointer" }}
          >
            ↻
          </button>
        </div>
      </div>

      {uploadMsg && (
        <div style={{ ...mono, fontSize: 10, color: uploadMsg.ok ? GR : OR, marginBottom: 12 }}>
          {uploadMsg.ok ? "✓" : "⚠"} {uploadMsg.text}
        </div>
      )}
      {error && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 16 }}>⚠ {error}</div>}

      {!loading && tasks && tasks.length === 0 && !error && (
        <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)", marginTop: 20 }}>
          nenhuma tarefa ainda — envie a planilha exportada do PMO pelo botão acima.
        </div>
      )}

      {tasks && tasks.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, alignItems: "start" }}>
          {grouped.map((col) => (
            <div key={col.key} style={{ border: "1px solid rgba(var(--accent-rgb),0.14)", borderRadius: 8, padding: 12, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: col.color, marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                <span>{col.label}</span>
                <span>{col.tasks.length}</span>
              </div>
              {col.tasks.map((t) => <TaskCard key={t.id} task={t} />)}
              {col.tasks.length === 0 && <div style={{ ...mono, fontSize: 9.5, color: "rgba(207,239,251,0.3)" }}>vazio.</div>}
            </div>
          ))}
          {others.length > 0 && (
            <div style={{ border: "1px solid rgba(var(--accent-rgb),0.14)", borderRadius: 8, padding: 12, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(207,239,251,0.5)", marginBottom: 10 }}>OUTROS</div>
              {others.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
