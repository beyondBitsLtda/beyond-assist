"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLog } from "./LogProvider.js";
import { CY, OR, GR, PU, mono, dotColor } from "@/lib/theme.js";
import { runFullSync } from "@/lib/sync.js";

const pad = (n) => String(n).padStart(2, "0");
const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/** "há 3 min" / "há 2 h" a partir de um ISO — usado no indicador de SYNC automático. */
function relTime(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

/** Converte a chave VAPID pública (base64 URL-safe) pro formato que o PushManager espera. */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Barra superior compartilhada por todos os painéis: relógio/uptime, bolinhas de conexão
 * (Supabase/Trello/Gemini) e o botão SYNC (reindexação completa) — migrados de page.js,
 * porque agora são relevantes pra todos os painéis, não só o Assistente.
 */
export default function Topbar({ onToggleSidebar }) {
  const { addLog } = useLog();
  const [clock, setClock] = useState(fmtClock(new Date()));
  const [uptime, setUptime] = useState("00:00:00");
  const [conn, setConn] = useState({ supabase: null, trello: null, gemini: null, sentinel: null });
  const [ingesting, setIngesting] = useState(false);
  const [autoSync, setAutoSync] = useState(null); // status do SYNC automático (pg_cron) — ver /api/sync-status
  const [pushSupported, setPushSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const startRef = useRef(Date.now());

  // relógio + uptime
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      const up = Math.floor((Date.now() - startRef.current) / 1000);
      setClock(fmtClock(d));
      setUptime(`${pad(Math.floor(up / 3600))}:${pad(Math.floor(up / 60) % 60)}:${pad(up % 60)}`);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // health check → bolinhas de conexão
  useEffect(() => {
    let alive = true;
    fetch("/api/health")
      .then((r) => r.json())
      .then((s) => { if (alive) setConn(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // status do SYNC automático (cron do Supabase) — busca ao montar e a cada 30s, pra
  // refletir os ticks (1x/min) sem precisar recarregar a página.
  useEffect(() => {
    let alive = true;
    const check = () => {
      fetch("/api/sync-status")
        .then((r) => r.json())
        .then((s) => { if (alive) setAutoSync(s); })
        .catch(() => {});
    };
    check();
    const id = setInterval(check, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // notificações push: registra o service worker e checa se este dispositivo já está inscrito
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setPushSupported(true);
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  const toggleNotifications = useCallback(async () => {
    if (subBusy || typeof window === "undefined") return;
    setSubBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;

      if (subscribed) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/notifications/subscribe", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {});
          await sub.unsubscribe();
        }
        setSubscribed(false);
        addLog("[PUSH]", CY, "notificações desativadas");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        addLog("[PUSH]", OR, `permissão negada (${permission})`);
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error(
          "NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada nesse deploy. " +
          "Defina em Vercel → Settings → Environment Variables e refaça o deploy " +
          "(variáveis NEXT_PUBLIC_* só entram em vigor em um build novo)."
        );
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSubscribed(true);
      addLog("[PUSH]", GR, "notificações ativadas");
    } catch (err) {
      addLog("[PUSH]", OR, `falha: ${err.message}`);
    } finally {
      setSubBusy(false);
    }
  }, [subscribed, subBusy, addLog]);

  // ---- reindexar via /api/ingest em fatias com paginação (respeita quota Gemini) ----
  const reindex = useCallback(async () => {
    if (ingesting) return;
    setIngesting(true);
    await runFullSync({
      onProgress: (ev) => {
        if (ev.type === "start") addLog("[INGEST]", OR, `→ ${ev.label} · fatia ${ev.pageNum} (offset ${ev.offset})…`);
        else if (ev.type === "chunk") addLog("[INGEST]", GR, `✓ ${ev.label} f${ev.pageNum}: ${ev.processed}/${ev.total} chunks`);
        else if (ev.type === "error") addLog("[INGEST]", OR, `✗ ${ev.label}: ${ev.message}`);
        else if (ev.type === "finished") addLog("[INGEST]", CY, `finalizado · ${ev.grandTotal} chunks indexados`);
      },
    });
    setIngesting(false);
  }, [ingesting, addLog]);

  const connList = [
    { label: "SUPABASE", ok: conn.supabase },
    { label: "TRELLO", ok: conn.trello },
    { label: "GEMINI", ok: conn.gemini },
    { label: "SENTINELA", ok: conn.sentinel },
  ];

  // indicador do SYNC automático (cron do Supabase) — cor/texto conforme o estado atual
  let autoSyncColor = "rgba(207,239,251,0.35)"; // dim: ainda sem dado (carregando ou nunca rodou)
  let autoSyncLabel = "…";
  let autoSyncTitle = "Carregando status do SYNC automático…";
  if (autoSync) {
    if (!autoSync.ok) {
      autoSyncColor = OR;
      autoSyncLabel = "não configurado";
      autoSyncTitle = `Ciclo automático não configurado — rode db/schema.sql e db/cron.sql no Supabase (ver README). Detalhe: ${autoSync.error || "tabela sync_progress não encontrada"}`;
    } else if (!autoSync.started_at) {
      autoSyncColor = "rgba(207,239,251,0.35)";
      autoSyncLabel = "nunca rodou";
      autoSyncTitle = "Nenhum ciclo automático rodou ainda — confira se db/cron.sql foi executado no Supabase.";
    } else if (autoSync.last_error) {
      autoSyncColor = OR;
      autoSyncLabel = relTime(autoSync.updated_at) || "erro";
      autoSyncTitle = `Último erro no ciclo automático: ${autoSync.last_error}`;
    } else if (autoSync.status === "running") {
      autoSyncColor = CY;
      autoSyncLabel = "em andamento";
      autoSyncTitle = `Ciclo em andamento desde ${relTime(autoSync.started_at)} · ${autoSync.grand_total || 0} chunks processados até agora`;
    } else {
      autoSyncColor = GR;
      autoSyncLabel = relTime(autoSync.updated_at) || "ok";
      autoSyncTitle = `Último ciclo automático concluído ${relTime(autoSync.updated_at)} · ${autoSync.grand_total || 0} chunks processados`;
    }
  }

  return (
    <header
      style={{
        position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "14px 26px", borderBottom: "1px solid rgba(56,225,255,0.16)",
        background: "linear-gradient(180deg, rgba(6,20,26,0.6), transparent)",
      }}
    >
      <button
        className="bb-hamburger"
        onClick={onToggleSidebar}
        aria-label="Abrir menu"
        style={{ alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 6, border: "1px solid rgba(56,225,255,0.25)", background: "rgba(56,225,255,0.05)", color: CY, cursor: "pointer", flex: "none" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div className="bb-topbar-row" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flex: 1, ...mono, fontSize: 10, letterSpacing: 1 }}>
        <div style={{ textAlign: "right", marginRight: 8 }}>
          <div style={{ color: "#eafcff", fontSize: 15, letterSpacing: 2 }}>{clock}</div>
          <div style={{ color: "rgba(56,225,255,0.5)", fontSize: 9, letterSpacing: 2 }}>SYS.UPTIME {uptime}</div>
        </div>
        {connList.map((c) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", border: "1px solid rgba(56,225,255,0.18)", borderRadius: 3, background: "rgba(56,225,255,0.03)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor(c.ok), boxShadow: `0 0 8px ${dotColor(c.ok)}`, animation: "bb-dot 1.8s ease-in-out infinite" }} />
            <span style={{ color: "#bfe8f5" }}>{c.label}</span>
          </div>
        ))}
        <div
          title={autoSyncTitle}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", border: "1px solid rgba(56,225,255,0.18)", borderRadius: 3, background: "rgba(56,225,255,0.03)" }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: autoSyncColor, boxShadow: `0 0 8px ${autoSyncColor}`, animation: autoSync?.status === "running" ? "bb-dot 0.9s ease-in-out infinite" : "none" }} />
          <span style={{ color: "#bfe8f5" }}>AUTO-SYNC</span>
          <span style={{ color: "rgba(207,239,251,0.6)" }}>{autoSyncLabel}</span>
        </div>
        <button
          onClick={reindex}
          disabled={ingesting}
          title="Reindexar Trello + Beyond Brain agora mesmo (botão manual — o AUTO-SYNC ao lado roda sozinho 1x/hora)"
          style={{ ...mono, display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", border: `1px solid ${ingesting ? OR : CY}`, borderRadius: 3, background: "rgba(56,225,255,0.06)", color: ingesting ? OR : "#eafcff", cursor: ingesting ? "wait" : "pointer", fontSize: 10, letterSpacing: 2 }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: ingesting ? OR : CY, boxShadow: `0 0 8px ${ingesting ? OR : CY}`, animation: ingesting ? "bb-dot 0.9s ease-in-out infinite" : "none" }} />
          {ingesting ? "SYNCING…" : "◈ SYNC"}
        </button>

        {pushSupported && (
          <button
            onClick={toggleNotifications}
            disabled={subBusy}
            title={subscribed ? "Notificações ativadas (clique pra desativar)" : "Ativar notificações (chamado novo, reaberto, SLA, tarefa atrasada...)"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: "50%",
              border: `1px solid ${subscribed ? PU : "rgba(207,239,251,0.3)"}`,
              background: subscribed ? "rgba(201,166,255,0.08)" : "rgba(56,225,255,0.04)",
              color: subscribed ? PU : "rgba(207,239,251,0.5)",
              cursor: subBusy ? "wait" : "pointer", transition: "all .2s", flex: "none",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              {!subscribed && <line x1="3" y1="3" x2="21" y2="21" stroke={OR} />}
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
