"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, GR, mono } from "@/lib/theme.js";

/**
 * Gerencia quais repositórios do GitHub a Lisa indexa por embeddings (ver
 * src/lib/ingest/github.js) — mesmo pipeline de sincronização do Trello/Beyond Brain, só
 * mais uma fonte (source='github' na tabela `documents`). Não mostra código nenhum aqui,
 * só a lista de repositórios e se cada um está habilitado pra entrar no ciclo de SYNC.
 */
export default function CodeReposPage() {
  const [repos, setRepos] = useState(null);
  const [error, setError] = useState(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoverMsg, setDiscoverMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/code-repos");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "falha ao carregar repositórios");
      setRepos(data.repos);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const discover = async () => {
    setDiscovering(true);
    setDiscoverMsg(null);
    try {
      const res = await fetch("/api/code-repos", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRepos(data.repos);
      setDiscoverMsg({ ok: true, text: `${data.found} repositórios encontrados.` });
    } catch (err) {
      setDiscoverMsg({ ok: false, text: err.message });
    } finally {
      setDiscovering(false);
    }
  };

  const toggle = async (repo) => {
    setRepos((rs) => rs.map((r) => (r.id === repo.id ? { ...r, enabled: !r.enabled } : r)));
    await fetch(`/api/code-repos/${repo.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: !repo.enabled }),
    }).catch(() => load()); // se a chamada falhar, desfaz o otimismo recarregando de verdade
  };

  const enabledCount = (repos || []).filter((r) => r.enabled).length;

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ REPOSITÓRIOS DE CÓDIGO</div>
        <button
          onClick={discover}
          disabled={discovering}
          style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(var(--accent-rgb),0.06)", color: "#eafcff", cursor: discovering ? "wait" : "pointer" }}
        >
          {discovering ? "BUSCANDO…" : "↻ REDESCOBRIR"}
        </button>
      </div>

      <div style={{ fontSize: 11, color: "rgba(207,239,251,0.5)", marginBottom: 16, lineHeight: 1.5 }}>
        {repos ? `${enabledCount} de ${repos.length} repositórios habilitados` : "carregando…"} — os habilitados entram no
        ciclo normal de SYNC (mesmo botão/cron do Trello e Beyond Brain), um passo por repositório.
        Desligar um aqui só para de indexá-lo daqui pra frente; não apaga o que já foi indexado.
      </div>

      {discoverMsg && (
        <div style={{ ...mono, fontSize: 10, color: discoverMsg.ok ? GR : OR, marginBottom: 12 }}>
          {discoverMsg.ok ? "✓" : "⚠"} {discoverMsg.text}
        </div>
      )}
      {error && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 16 }}>⚠ {error}</div>}

      {repos && repos.length === 0 && (
        <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)" }}>
          nenhum repositório ainda — clique em "↻ REDESCOBRIR" pra consultar o GitHub (precisa de GITHUB_TOKEN configurado).
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(repos || []).map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(var(--accent-rgb),0.14)", borderRadius: 6, padding: "10px 14px", background: "rgba(0,0,0,0.2)", opacity: r.enabled ? 1 : 0.5 }}>
            <div>
              <span style={{ fontSize: 13, color: "#eafcff" }}>{r.full_name}</span>
              {r.private && <span style={{ ...mono, fontSize: 8.5, color: "rgba(207,239,251,0.4)", marginLeft: 8 }}>PRIVADO</span>}
              {!r.default_branch && <span style={{ ...mono, fontSize: 8.5, color: OR, marginLeft: 8 }}>sem branch padrão</span>}
            </div>
            <button
              onClick={() => toggle(r)}
              style={{ ...mono, fontSize: 9, padding: "5px 10px", borderRadius: 4, border: `1px solid ${r.enabled ? GR : "rgba(var(--accent-rgb),0.25)"}`, background: "transparent", color: r.enabled ? GR : "rgba(207,239,251,0.5)", cursor: "pointer", flex: "none" }}
            >
              {r.enabled ? "ON" : "OFF"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
