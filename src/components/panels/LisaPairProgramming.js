"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CY, GR, OR, mono } from "@/lib/theme.js";
import LisaPairIDE from "./LisaPairIDE.js";

// Pair programming: ela pega um repositório SEU de verdade, olha os arquivos, decide uma feature
// pro nível pedido, cria a branch e propõe o plano. A sessão vale pontos quando concluída
// (abrir e abandonar não pontua — ver src/lib/activities.js).

const LEVELS = [
  { key: "facil", label: "Fácil", pts: 30 },
  { key: "medio", label: "Médio", pts: 70 },
  { key: "dificil", label: "Difícil", pts: 150 },
];

export default function LisaPairProgramming({ onMood }) {
  const [repos, setRepos] = useState(null);
  const [repo, setRepo] = useState("");
  const [level, setLevel] = useState("medio");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [closed, setClosed] = useState(null);

  const onMoodRef = useRef(onMood);
  onMoodRef.current = onMood;

  useEffect(() => {
    fetch("/api/pair")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error);
        // prioriza os repositórios já habilitados na tela /code-repos
        const list = (d.repos || []).sort((a, b) => Number(b.enabled) - Number(a.enabled));
        setRepos(list);
        if (list[0]) setRepo(list[0].full_name);
      })
      .catch((err) => setError(err.message));
  }, []);

  const start = useCallback(async () => {
    if (!repo) return;
    setLoading(true);
    setError(null);
    setSession(null);
    setClosed(null);
    onMoodRef.current?.("thinking");
    try {
      const res = await fetch("/api/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start", repo, level }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSession(data);
      onMoodRef.current?.("proud");
    } catch (err) {
      setError(err.message);
      onMoodRef.current?.("worried");
    } finally {
      setLoading(false);
    }
  }, [repo, level]);

  const finish = async (status) => {
    if (!session?.sessionId) return setClosed(status);
    try {
      await fetch("/api/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "close", id: session.sessionId, status }),
      });
      setClosed(status);
      onMoodRef.current?.(status === "concluida" ? "star" : "sad");
    } catch (err) {
      setError(err.message);
    }
  };

  const chip = (active) => ({
    ...mono, fontSize: 9, letterSpacing: 0.5, padding: "5px 9px", borderRadius: 20, cursor: "pointer",
    border: `1px solid ${active ? CY : "rgba(var(--accent-rgb),0.2)"}`,
    background: active ? "rgba(var(--accent-rgb),0.12)" : "transparent",
    color: active ? "#eafcff" : "rgba(207,239,251,0.55)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: session ? "min(96vw, 780px)" : "min(94vw, 460px)" }}>
      {!session && (
        <>
          <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(207,239,251,0.45)" }}>REPOSITÓRIO</div>
          {repos === null ? (
            <div style={{ ...mono, fontSize: 9.5, color: "rgba(207,239,251,0.4)" }}>carregando seus repositórios…</div>
          ) : repos.length === 0 ? (
            <div style={{ ...mono, fontSize: 9.5, color: OR, textAlign: "center" }}>nenhum repositório encontrado — cadastre em REPOSITÓRIOS primeiro</div>
          ) : (
            <select
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              style={{ ...mono, fontSize: 10.5, padding: "7px 9px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "#08131a", color: "#eafcff", width: "100%" }}
            >
              {repos.map((r) => (
                <option key={r.full_name} value={r.full_name}>{r.full_name}{r.enabled ? "" : " (não indexado)"}</option>
              ))}
            </select>
          )}

          <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(207,239,251,0.45)" }}>NÍVEL</div>
          <div style={{ display: "flex", gap: 4 }}>
            {LEVELS.map((l) => (
              <button key={l.key} onClick={() => setLevel(l.key)} disabled={loading} style={chip(level === l.key)} title={`${l.pts} pontos ao concluir`}>
                {l.label} · {l.pts}pts
              </button>
            ))}
          </div>

          <button
            onClick={start}
            disabled={loading || !repo}
            style={{ ...mono, fontSize: 10, letterSpacing: 1.5, padding: "10px 18px", borderRadius: 6, border: `1px solid ${CY}`, background: "rgba(var(--accent-rgb),0.08)", color: "#eafcff", cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "ELA ESTÁ ESCOLHENDO A FEATURE…" : "COMEÇAR SESSÃO"}
          </button>
        </>
      )}

      {error && <div style={{ ...mono, fontSize: 9.5, color: OR, textAlign: "center" }}>⚠ {error}</div>}

      {session && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", padding: 12, borderRadius: 8, border: "1px solid rgba(var(--accent-rgb),0.22)", background: "rgba(var(--accent-rgb),0.04)" }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: 1.5, color: "rgba(207,239,251,0.45)" }}>{session.repo} · nível {level}</div>
          <div style={{ fontSize: 14, lineHeight: 1.4, color: "#eafcff" }}>{session.feature}</div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: "rgba(207,239,251,0.75)" }}>{session.why}</div>

          {session.branch ? (
            <div style={{ ...mono, fontSize: 10, color: GR }}>⎇ branch criada: {session.branch} (de {session.base})</div>
          ) : (
            <div style={{ ...mono, fontSize: 9.5, color: OR }} title={session.branchError || ""}>
              ⚠ não consegui criar a branch — provavelmente o token do GitHub é só de leitura. A feature e o plano valem do mesmo jeito; a branch você cria com a extensão Lisa Code ou na mão.
            </div>
          )}

          <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(207,239,251,0.45)", marginTop: 2 }}>PLANO</div>
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {(session.steps || []).map((s, i) => (
              <li key={i} style={{ fontSize: 12, lineHeight: 1.45, color: "rgba(207,239,251,0.85)" }}>{s}</li>
            ))}
          </ol>

          <div style={{ ...mono, fontSize: 10.5, lineHeight: 1.5, color: CY, padding: "8px 10px", borderRadius: 6, background: "rgba(var(--accent-rgb),0.07)" }}>
            ▶ COMECE POR: {session.firstTask}
          </div>

          {/* a IDE: é aqui que a gente programa junto de verdade */}
          {session.branch ? (
            <>
              <div style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(207,239,251,0.45)", marginTop: 2 }}>EDITOR · {session.branch}</div>
              <LisaPairIDE repo={session.repo} branch={session.branch} onMood={onMood} />
            </>
          ) : (
            <div style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.4)" }}>
              sem branch, sem editor — não vou deixar a gente commitar direto na {session.base}.
            </div>
          )}

          {session.saveError && (
            <div style={{ ...mono, fontSize: 9, color: OR }} title={session.saveError}>⚠ a sessão não foi gravada na tabela (não vai pontuar)</div>
          )}

          {closed ? (
            <div style={{ ...mono, fontSize: 10, letterSpacing: 1.5, color: closed === "concluida" ? GR : "rgba(207,239,251,0.5)" }}>
              {closed === "concluida" ? `SESSÃO CONCLUÍDA · +${LEVELS.find((l) => l.key === level)?.pts} pts` : "SESSÃO ABANDONADA (sem pontos)"}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => finish("concluida")} style={{ ...mono, fontSize: 9.5, letterSpacing: 1, padding: "8px 12px", borderRadius: 6, border: `1px solid ${GR}`, background: "rgba(123,216,143,0.1)", color: "#eafcff", cursor: "pointer" }}>
                ✓ CONCLUÍMOS
              </button>
              <button onClick={() => finish("abandonada")} style={{ ...mono, fontSize: 9.5, letterSpacing: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "transparent", color: "rgba(207,239,251,0.6)", cursor: "pointer" }}>
                ✕ DEIXAR PRA DEPOIS
              </button>
              <button onClick={() => setSession(null)} style={{ ...mono, fontSize: 9.5, letterSpacing: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "transparent", color: "rgba(207,239,251,0.6)", cursor: "pointer" }}>
                OUTRA FEATURE
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
