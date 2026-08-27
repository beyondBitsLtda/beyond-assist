"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).format(d);
}

const PAGE_SIZE = 30;
const EMPTY_FORM = { subject: "", moment: "", body: "", ref: "" };

const inputStyle = {
  ...mono, fontSize: 12, padding: "9px 11px", borderRadius: 5,
  border: "1px solid rgba(56,225,255,0.2)", background: "#08131a", color: "#eafcff",
  outline: "none", width: "100%",
};

export default function ThoughtsPage() {
  const [thoughts, setThoughts] = useState([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const load = useCallback(async (offset, replace) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/thoughts?limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setThoughts((prev) => (replace ? data.thoughts : [...prev, ...data.thoughts]));
      setNextOffset(data.next_offset);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0, true); }, [load]);

  const submitThought = useCallback(async (e) => {
    e.preventDefault();
    if (saving || !form.subject.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/thoughts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await load(0, true); // nota nova aparece na hora, sem precisar clicar em atualizar
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }, [form, saving, load]);

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ PENSAMENTOS REGISTRADOS</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setFormOpen((v) => !v); setSaveError(null); }}
            style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${formOpen ? PU : "rgba(201,166,255,0.4)"}`, borderRadius: 3, background: formOpen ? "rgba(201,166,255,0.12)" : "rgba(201,166,255,0.05)", color: formOpen ? "#eafcff" : PU, cursor: "pointer" }}
          >
            {formOpen ? "✕ CANCELAR" : "+ NOVA NOTA"}
          </button>
          <button
            onClick={() => load(0, true)}
            disabled={loading}
            title="Recarrega esta tela (já é lida direto do banco, sempre atual)"
            style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(56,225,255,0.06)", color: "#eafcff", cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "…" : "↻ ATUALIZAR"}
          </button>
        </div>
      </div>

      {formOpen && (
        <form
          onSubmit={submitThought}
          style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22, padding: 16, border: "1px solid rgba(201,166,255,0.28)", borderRadius: 8, background: "linear-gradient(160deg, rgba(201,166,255,0.06), rgba(0,0,0,0.2))" }}
        >
          <input
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="Assunto (obrigatório)"
            autoFocus
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={form.moment}
              onChange={(e) => setForm((f) => ({ ...f, moment: e.target.value }))}
              placeholder="Momento (ex.: manhã, reunião X)"
              style={{ ...inputStyle, flex: "1 1 200px" }}
            />
            <input
              value={form.ref}
              onChange={(e) => setForm((f) => ({ ...f, ref: e.target.value }))}
              placeholder="Referência (ex.: nome do projeto)"
              style={{ ...inputStyle, flex: "1 1 200px" }}
            />
          </div>
          <textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Corpo da nota…"
            rows={4}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
          {saveError && <div style={{ ...mono, fontSize: 10.5, color: OR }}>⚠ {saveError}</div>}
          <div>
            <button
              type="submit"
              disabled={saving || !form.subject.trim()}
              style={{ ...mono, fontSize: 10, letterSpacing: 1.5, padding: "8px 18px", border: `1px solid ${GR}`, borderRadius: 4, background: "rgba(74,222,128,0.08)", color: "#eafcff", cursor: saving || !form.subject.trim() ? "not-allowed" : "pointer", opacity: !form.subject.trim() ? 0.5 : 1 }}
            >
              {saving ? "salvando…" : "✓ SALVAR NOTA"}
            </button>
          </div>
        </form>
      )}

      {error && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 16 }}>⚠ {error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {thoughts.map((t) => (
          <div key={t.id} style={{ border: "1px solid rgba(201,166,255,0.28)", borderRadius: 6, padding: "14px 16px", background: "linear-gradient(160deg, rgba(201,166,255,0.05), rgba(0,0,0,0.2))" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "#eafcff" }}>{t.subject}</div>
              <div style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.4)", flex: "none" }}>{fmtDate(t.created_at)}</div>
            </div>
            {t.moment && <div style={{ ...mono, fontSize: 9.5, color: PU, marginTop: 4 }}>{t.moment}</div>}
            {t.body && <div style={{ fontSize: 12.5, color: "rgba(207,239,251,0.8)", marginTop: 8, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{t.body}</div>}
            {t.ref && <div style={{ ...mono, fontSize: 9, color: "rgba(56,225,255,0.5)", marginTop: 8 }}>#{t.ref}</div>}
          </div>
        ))}
        {!loading && thoughts.length === 0 && !error && (
          <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)" }}>nenhum pensamento registrado ainda.</div>
        )}
      </div>

      {nextOffset != null && (
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button
            onClick={() => load(nextOffset, false)}
            disabled={loading}
            style={{ ...mono, fontSize: 9.5, letterSpacing: 1.5, padding: "8px 16px", border: "1px solid rgba(56,225,255,0.25)", borderRadius: 4, background: "transparent", color: "rgba(207,239,251,0.7)", cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "carregando…" : "carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}
