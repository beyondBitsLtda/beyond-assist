"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";

const DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const TASKS_SCOPE = "__tasks__";
const THOUGHTS_SCOPE = "__thoughts__";
const SENTINEL_SCOPE = "__sentinel__";
const DELP_SCOPE = "__delp__";
const GENERAL_SCOPE = "__general__";

/** Mesmo mapeamento de scopeKind → objeto `scope` usado pelo Assistente (ver computeScope em
 * assistant/page.js) — mantém os dois em sintonia sem duplicar a lógica de resolução em si
 * (essa já foi extraída pro backend, ver src/lib/scopeResolver.js). */
function scopeKindToScope(kind, sentinelProjectId) {
  if (kind === GENERAL_SCOPE) return { mode: "general" };
  if (kind === TASKS_SCOPE) return { mode: "panel", range: "auto" };
  if (kind === THOUGHTS_SCOPE) return { mode: "panel", source: "brain" };
  if (kind === SENTINEL_SCOPE) return { mode: "panel", source: "sentinel", projectId: sentinelProjectId || "all" };
  if (kind === DELP_SCOPE) return { mode: "panel", source: "delp" };
  return { mode: "panel", board: kind };
}

function scopeToLabel(scope) {
  if (!scope) return "—";
  if (scope.mode === "general") return "Geral";
  if (scope.source === "brain") return "Pensamentos";
  if (scope.source === "sentinel") return "Chamados (Sentinela)";
  if (scope.source === "delp") return "Tarefas Delp";
  if (scope.range) return "Tarefas (por prazo)";
  if (scope.board) return scope.board;
  return "—";
}

const emptyForm = {
  label: "", timeOfDay: "08:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  mode: "fixed", message: "", scopeKind: GENERAL_SCOPE, sentinelProjectId: "all",
  instruction: "", personaMode: false, enabled: true,
};

export default function ScheduledAnnouncementsPage() {
  const [schedules, setSchedules] = useState(null);
  const [error, setError] = useState(null);
  const [panelOptions, setPanelOptions] = useState(["Quarto de Guerra"]);
  const [sentinelProjects, setSentinelProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduled-announcements");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "falha ao carregar agendamentos");
      setSchedules(data.schedules);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/boards-overview").then((r) => r.json()).then((d) => {
      if (d.ok) setPanelOptions(["Quarto de Guerra", ...(d.boards || []).map((b) => b.board)]);
    }).catch(() => {});
    fetch("/api/sentinel/projects").then((r) => r.json()).then((d) => {
      if (d.ok) setSentinelProjects(d.projects || []);
    }).catch(() => {});
  }, []);

  const toggleDay = (d) => {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter((x) => x !== d) : [...f.daysOfWeek, d].sort(),
    }));
  };

  const submit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const body = {
        label: form.label, timeOfDay: form.timeOfDay, daysOfWeek: form.daysOfWeek,
        mode: form.mode, personaMode: form.personaMode, enabled: true,
        message: form.mode === "fixed" ? form.message : undefined,
        scope: form.mode === "report" ? scopeKindToScope(form.scopeKind, form.sentinelProjectId) : undefined,
        instruction: form.mode === "report" ? form.instruction : undefined,
      };
      const res = await fetch("/api/scheduled-announcements", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (s) => {
    await fetch(`/api/scheduled-announcements/${s.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: !s.enabled }),
    });
    load();
  };

  const remove = async (s) => {
    await fetch(`/api/scheduled-announcements/${s.id}`, { method: "DELETE" });
    load();
  };

  const inputStyle = { ...mono, fontSize: 12, padding: "9px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#000", color: "#eafcff", width: "100%" };
  const labelStyle = { ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginBottom: 6, marginTop: 14 };

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY, marginBottom: 20 }}>◈ FALAS AGENDADAS</div>

      {error && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 16 }}>⚠ {error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,1fr) minmax(320px,1.2fr)", gap: 20, alignItems: "start" }}>
        {/* lista */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(schedules || []).map((s) => (
            <div key={s.id} style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: "12px 14px", background: "rgba(0,0,0,0.2)", opacity: s.enabled ? 1 : 0.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, color: "#eafcff", fontWeight: 600 }}>{s.label}</div>
                  <div style={{ ...mono, fontSize: 10, color: "rgba(207,239,251,0.55)", marginTop: 4 }}>
                    {String(s.time_of_day).slice(0, 5)} · {(s.days_of_week || []).length === 7 ? "todo dia" : (s.days_of_week || []).map((d) => DAY_LABELS[d]).join(" ")}
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: s.mode === "report" ? PU : CY, marginTop: 4 }}>
                    {s.mode === "report" ? `📊 relatório · ${scopeToLabel(s.scope)}` : "💬 mensagem fixa"}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(207,239,251,0.6)", marginTop: 6, lineHeight: 1.4 }}>
                    {s.mode === "report" ? s.instruction : s.message}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "none" }}>
                  <button onClick={() => toggleEnabled(s)} style={{ ...mono, fontSize: 9, padding: "5px 8px", borderRadius: 4, border: `1px solid ${s.enabled ? GR : "rgba(var(--accent-rgb),0.25)"}`, background: "transparent", color: s.enabled ? GR : "rgba(207,239,251,0.5)", cursor: "pointer" }}>
                    {s.enabled ? "ON" : "OFF"}
                  </button>
                  <button onClick={() => remove(s)} style={{ ...mono, fontSize: 9, padding: "5px 8px", borderRadius: 4, border: `1px solid ${OR}55`, background: "transparent", color: OR, cursor: "pointer" }}>
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
          {schedules && schedules.length === 0 && (
            <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)" }}>nenhuma fala agendada ainda — crie uma ao lado.</div>
          )}
        </div>

        {/* formulário */}
        <div style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: "16px 18px", background: "rgba(0,0,0,0.2)" }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(207,239,251,0.55)" }}>NOVA FALA AGENDADA</div>

          <div style={labelStyle}>NOME</div>
          <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="ex.: Resumo da manhã" style={inputStyle} />

          <div style={labelStyle}>HORÁRIO (America/Sao_Paulo)</div>
          <input type="time" value={form.timeOfDay} onChange={(e) => setForm((f) => ({ ...f, timeOfDay: e.target.value }))} style={inputStyle} />

          <div style={labelStyle}>DIAS DA SEMANA</div>
          <div style={{ display: "flex", gap: 4 }}>
            {DAY_LABELS.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)} style={{ ...mono, fontSize: 9.5, padding: "6px 8px", borderRadius: 4, border: `1px solid ${form.daysOfWeek.includes(i) ? CY : "rgba(var(--accent-rgb),0.2)"}`, background: form.daysOfWeek.includes(i) ? "rgba(var(--accent-rgb),0.12)" : "transparent", color: form.daysOfWeek.includes(i) ? "#eafcff" : "rgba(207,239,251,0.5)", cursor: "pointer", flex: 1 }}>
                {d}
              </button>
            ))}
          </div>

          <div style={labelStyle}>O QUE A LISA FAZ</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ key: "fixed", label: "💬 fala uma mensagem fixa" }, { key: "report", label: "📊 gera um relatório" }].map((m) => (
              <button key={m.key} onClick={() => setForm((f) => ({ ...f, mode: m.key }))} style={{ ...mono, fontSize: 10, padding: "8px 10px", borderRadius: 6, border: `1px solid ${form.mode === m.key ? CY : "rgba(var(--accent-rgb),0.18)"}`, background: form.mode === m.key ? "rgba(var(--accent-rgb),0.12)" : "transparent", color: form.mode === m.key ? "#eafcff" : "rgba(207,239,251,0.55)", cursor: "pointer", flex: 1 }}>
                {m.label}
              </button>
            ))}
          </div>

          {form.mode === "fixed" ? (
            <>
              <div style={labelStyle}>MENSAGEM</div>
              <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="o que a Lisa vai falar, literalmente" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </>
          ) : (
            <>
              <div style={labelStyle}>ESCOPO</div>
              <select value={form.scopeKind} onChange={(e) => setForm((f) => ({ ...f, scopeKind: e.target.value }))} style={inputStyle}>
                <option value={GENERAL_SCOPE}>Geral</option>
                <option value={TASKS_SCOPE}>Tarefas (por prazo)</option>
                <option value={THOUGHTS_SCOPE}>Pensamentos</option>
                <option value={SENTINEL_SCOPE}>Chamados (Sentinela)</option>
                <option value={DELP_SCOPE}>Tarefas Delp</option>
                {panelOptions.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              {form.scopeKind === SENTINEL_SCOPE && (
                <select value={form.sentinelProjectId} onChange={(e) => setForm((f) => ({ ...f, sentinelProjectId: e.target.value }))} style={{ ...inputStyle, marginTop: 8 }}>
                  <option value="all">Todos os projetos</option>
                  {sentinelProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <div style={labelStyle}>O QUE PEDIR</div>
              <textarea value={form.instruction} onChange={(e) => setForm((f) => ({ ...f, instruction: e.target.value }))} placeholder="ex.: resuma minhas tarefas de hoje e me avise se algo está atrasado" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            <button onClick={() => setForm((f) => ({ ...f, personaMode: !f.personaMode }))} style={{ ...mono, fontSize: 10, padding: "7px 10px", borderRadius: 6, border: `1px solid ${form.personaMode ? PU : "rgba(var(--accent-rgb),0.18)"}`, background: form.personaMode ? "rgba(201,166,255,0.12)" : "transparent", color: form.personaMode ? "#eafcff" : "rgba(207,239,251,0.55)", cursor: "pointer" }}>
              🎭 Modo Persona: {form.personaMode ? "ON" : "OFF"}
            </button>
          </div>

          {saveError && <div style={{ ...mono, fontSize: 10, color: OR, marginTop: 10 }}>⚠ {saveError}</div>}

          <button
            onClick={submit}
            disabled={saving || !form.label.trim() || (form.mode === "fixed" ? !form.message.trim() : !form.instruction.trim())}
            style={{ ...mono, fontSize: 10.5, letterSpacing: 1.5, padding: "10px 14px", borderRadius: 6, border: `1px solid ${CY}`, background: "rgba(var(--accent-rgb),0.1)", color: "#eafcff", cursor: saving ? "wait" : "pointer", width: "100%", marginTop: 16 }}
          >
            {saving ? "SALVANDO…" : "◈ CRIAR AGENDAMENTO"}
          </button>

          <div style={{ fontSize: 10.5, color: "rgba(207,239,251,0.4)", marginTop: 14, lineHeight: 1.5 }}>
            Verificado a cada minuto pelo cron que já roda (mesmo do Sentinela/Trello). Escolher
            um escopo aqui já é o consentimento — não passa pela pergunta "quer que eu leve em
            conta a Delp?" que existe só pra perguntas espontâneas.
          </div>
        </div>
      </div>
    </div>
  );
}
