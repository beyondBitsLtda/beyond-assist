"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CY, OR, mono } from "@/lib/theme.js";
import { speakText } from "@/lib/browserVoice.js";
import { useLog } from "./LogProvider.js";

const POLL_MS = 12000; // o cron que detecta agora roda a cada 1 min (não usa Gemini, sem custo de cota) — vale conferir mais rápido também
const TOAST_MS = 9000;
const CRITICAL_TYPES = new Set(["ticket_sla_breach", "trello_task_overdue"]);

/**
 * Avisos DENTRO do app: complementa o push do sistema operacional (que exige permissão e só
 * funciona por fora da aba) — enquanto a aba está aberta e visível, verifica periodicamente
 * se o cron de notificação (a cada 5 min) achou algo novo, mostra um banner na tela e fala
 * em voz alta (mesma voz escolhida no Assistente). Não detecta nada por conta própria — só
 * lê o que já foi gravado em notified_events.
 */
export default function NotificationToasts() {
  const { addLog } = useLog();
  const router = useRouter();
  const [toasts, setToasts] = useState([]);
  const sinceRef = useRef(null);
  const bootstrappedRef = useRef(false);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const check = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    try {
      const qs = sinceRef.current ? `?since=${encodeURIComponent(sinceRef.current)}` : "";
      const res = await fetch(`/api/notifications/recent${qs}`);
      const data = await res.json();
      if (!data.ok) return;

      if (!bootstrappedRef.current) {
        // 1ª checagem desta aba: só estabelece o marco de tempo, não mostra o que já é
        // passado (senão toda vez que abre o app toma uma enxurrada de avisos antigos).
        bootstrappedRef.current = true;
        sinceRef.current = data.now;
        if (typeof window !== "undefined") localStorage.setItem("notifSince", data.now);
        return;
      }

      const events = data.events || [];
      if (!events.length) return;

      sinceRef.current = data.now;
      if (typeof window !== "undefined") localStorage.setItem("notifSince", data.now);

      for (const ev of events) {
        const id = `${ev.event_type}:${ev.entity_id}:${ev.created_at}`;
        const critical = CRITICAL_TYPES.has(ev.event_type);
        setToasts((prev) => [...prev, { id, title: ev.title, body: ev.body, url: ev.url, critical }]);
        addLog("[AVISO]", critical ? OR : CY, ev.title);
        // browserOnly: de propósito — voz do navegador, sem gastar cota do Gemini (o
        // Assistente é quem precisa dela; com várias abas/dispositivos abertos, cada um
        // falaria o mesmo aviso pela voz "premium", multiplicando chamadas à toa).
        speakText(`${ev.title}. ${ev.body || ""}`, { browserOnly: true }).catch(() => {});
        setTimeout(() => dismiss(id), TOAST_MS);
      }
    } catch {
      // silencioso — não é crítico, só tenta de novo no próximo ciclo
    }
  }, [addLog, dismiss]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sinceRef.current = localStorage.getItem("notifSince") || null;
    if (sinceRef.current) bootstrappedRef.current = true; // já tem marco salvo — não precisa "bootstrapar" de novo
    check();
    const id = setInterval(check, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [check]);

  if (!toasts.length) return null;

  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 100, display: "flex", flexDirection: "column", gap: 10, maxWidth: 340 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => { if (t.url) router.push(t.url); dismiss(t.id); }}
          style={{
            ...mono, padding: "12px 14px", borderRadius: 8, cursor: t.url ? "pointer" : "default",
            border: `1px solid ${t.critical ? OR : CY}66`, background: "#08131a",
            boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 16px ${(t.critical ? OR : CY)}22`,
            animation: "bb-slidein .3s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 10, letterSpacing: 1.5, color: t.critical ? OR : CY }}>{t.critical ? "⚠ " : "◈ "}{t.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
              style={{ background: "transparent", border: "none", color: "rgba(207,239,251,0.4)", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
          {t.body && <div style={{ fontSize: 10.5, color: "rgba(207,239,251,0.75)", marginTop: 6, fontFamily: "'Rajdhani',sans-serif" }}>{t.body}</div>}
        </div>
      ))}
    </div>
  );
}
