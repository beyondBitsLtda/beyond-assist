"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";

const POLL_MS = 8000;
const SOURCE_LABELS = { trello: "TRELLO", brain: "BEYOND BRAIN", github: "CÓDIGO (GITHUB)" };

/**
 * Visão ao vivo do progresso do SYNC automático (pg_cron, ver /api/cron/sync) — o que já
 * está indexado de verdade (tabela documents) por fonte, e detalhado por repositório no
 * caso do GitHub (a fonte com mais itens e mais lenta de terminar). Não dispara nada, só lê.
 */
export default function SyncStatusPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState("name"); // "name" | "count"

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sync-status");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "falha ao carregar status");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, POLL_MS); return () => clearInterval(id); }, [load]);

  if (!data && !error) return <div style={{ padding: "24px 28px", ...mono, fontSize: 11, color: "rgba(207,239,251,0.5)" }}>carregando…</div>;

  const running = data?.status === "running";
  const statusColor = running ? CY : data?.last_error ? OR : GR;
  const enabledRepos = (data?.repos || []).filter((r) => r.enabled);
  const disabledRepos = (data?.repos || []).filter((r) => !r.enabled);
  const sortedEnabled = [...enabledRepos].sort((a, b) =>
    sort === "count" ? b.indexed_count - a.indexed_count : a.full_name.localeCompare(b.full_name)
  );
  const reposWithZero = enabledRepos.filter((r) => r.indexed_count === 0).length;

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY, marginBottom: 20 }}>◈ PROGRESSO DO SYNC</div>

      {error && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 16 }}>⚠ {error}</div>}

      {data && (
        <>
          {/* status geral */}
          <div style={{ border: `1px solid ${statusColor}55`, borderRadius: 8, padding: "16px 18px", background: "rgba(0,0,0,0.2)", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: statusColor, boxShadow: `0 0 10px ${statusColor}`, animation: running ? "bb-flicker 2s infinite" : "none" }} />
              <span style={{ ...mono, fontSize: 12, letterSpacing: 1.5, color: "#eafcff" }}>
                {running ? "SINCRONIZANDO" : "OCIOSO"}
              </span>
              {data.currentStepLabel && running && (
                <span style={{ ...mono, fontSize: 10, color: "rgba(207,239,251,0.6)" }}>— passo atual: {data.currentStepLabel}</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "rgba(207,239,251,0.5)", display: "flex", gap: 18, flexWrap: "wrap" }}>
              <span>total processado neste ciclo: {data.grand_total ?? 0}</span>
              {data.started_at && <span>iniciado: {new Date(data.started_at).toLocaleString("pt-BR")}</span>}
              {data.totalSteps ? <span>passo {(data.step_index ?? 0) + 1} de {data.totalSteps}</span> : null}
            </div>
            {data.last_error && <div style={{ ...mono, fontSize: 10.5, color: OR, marginTop: 8 }}>⚠ último erro: {data.last_error}</div>}
          </div>

          {/* totais por fonte */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
            {["trello", "brain", "github"].map((src) => {
              const total = data.sourceTotals?.find((s) => s.source === src)?.total || 0;
              return (
                <div key={src} style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: "14px 16px", background: "linear-gradient(160deg, rgba(var(--accent-rgb),0.04), rgba(0,0,0,0.2))" }}>
                  <div style={{ ...mono, fontSize: 9.5, letterSpacing: 2, color: "rgba(207,239,251,0.55)", marginBottom: 8 }}>{SOURCE_LABELS[src]}</div>
                  <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: total > 0 ? GR : "rgba(207,239,251,0.35)" }}>{total}</div>
                  <div style={{ fontSize: 10.5, color: "rgba(207,239,251,0.45)", marginTop: 4 }}>pedaços indexados</div>
                </div>
              );
            })}
          </div>

          {/* detalhe por repositório */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(207,239,251,0.55)" }}>
              REPOSITÓRIOS ({enabledRepos.length - reposWithZero} de {enabledRepos.length} com algo indexado)
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ key: "name", label: "A-Z" }, { key: "count", label: "MAIS INDEXADO" }].map((s) => (
                <button key={s.key} onClick={() => setSort(s.key)} style={{ ...mono, fontSize: 9, padding: "5px 10px", borderRadius: 4, border: `1px solid ${sort === s.key ? CY : "rgba(var(--accent-rgb),0.2)"}`, background: sort === s.key ? "rgba(var(--accent-rgb),0.1)" : "transparent", color: sort === s.key ? "#eafcff" : "rgba(207,239,251,0.5)", cursor: "pointer" }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 20 }}>
            {sortedEnabled.map((r) => (
              <div key={r.full_name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 5, background: r.isCurrent ? "rgba(35,98,211,0.12)" : "rgba(255,255,255,0.02)", border: r.isCurrent ? `1px solid ${CY}55` : "1px solid transparent" }}>
                <span style={{ fontSize: 12.5, color: "#eafcff" }}>{r.full_name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {r.isCurrent && <span style={{ ...mono, fontSize: 9, color: CY }}>🔄 sincronizando agora</span>}
                  <span style={{ ...mono, fontSize: 11, color: r.indexed_count > 0 ? GR : "rgba(207,239,251,0.35)" }}>{r.indexed_count} pedaços</span>
                </div>
              </div>
            ))}
          </div>

          {disabledRepos.length > 0 && (
            <>
              <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(207,239,251,0.35)", marginBottom: 10 }}>
                DESABILITADOS ({disabledRepos.length}) — não entram no ciclo de sync
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {disabledRepos.map((r) => (
                  <div key={r.full_name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", opacity: 0.5 }}>
                    <span style={{ fontSize: 12, color: "#eafcff" }}>{r.full_name}</span>
                    <span style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)" }}>{r.indexed_count} pedaços</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ ...mono, fontSize: 9.5, color: "rgba(207,239,251,0.35)", marginTop: 18 }}>
            atualiza sozinho a cada {POLL_MS / 1000}s.
          </div>
        </>
      )}
    </div>
  );
}
