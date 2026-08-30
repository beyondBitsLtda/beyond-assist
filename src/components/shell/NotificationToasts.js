"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CY, OR, mono } from "@/lib/theme.js";
import { speakText } from "@/lib/browserVoice.js";
import { cleanForSpeech } from "@/lib/cleanForSpeech.js";
import { useLog } from "./LogProvider.js";

const POLL_MS = 12000; // o cron que detecta agora roda a cada 1 min (não usa Gemini, sem custo de cota) — vale conferir mais rápido também
const TOAST_MS = 9000;
const CRITICAL_TYPES = new Set(["ticket_sla_breach", "trello_task_overdue"]);
// Falas agendadas (ver src/lib/scheduledAnnouncements.js) são um pedido explícito do usuário
// pra soar com a voz de VERDADE da Lisa (Gemini), não a do navegador — ao contrário dos
// outros avisos automáticos (Sentinela/Trello), que continuam de propósito na voz do
// navegador (evita multiplicar chamada de TTS "premium" em cada aba/dispositivo aberto pra
// um aviso que ninguém pediu). Uma fala agendada é diferente: foi o próprio usuário quem
// programou aquele horário — vale a voz premium mesmo com esse custo.
const GEMINI_VOICE_TYPES = new Set(["scheduled_announcement"]);

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
  const inFlightRef = useRef(false); // guarda contra checagens sobrepostas (setInterval + visibilitychange
                                      // podem disparar quase juntos; sem isso, as duas leem o mesmo "since"
                                      // antes de qualquer uma atualizar, e cada uma cria seus próprios toasts
                                      // pros mesmos eventos — daí a duplicação reportada)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const check = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
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
        const spoken = cleanForSpeech(`${ev.title}. ${ev.body || ""}`);
        if (GEMINI_VOICE_TYPES.has(ev.event_type)) {
          // fala agendada: voz de verdade da Lisa (Gemini) — speakText já cai pro navegador
          // sozinho se o Gemini falhar (ver src/lib/browserVoice.js), então isso nunca trava.
          const voiceName = typeof window !== "undefined" ? localStorage.getItem("voiceName") : null;
          speakText(spoken, { voiceName: voiceName || undefined }).catch(() => {});
        } else {
          // demais avisos automáticos: browserOnly de propósito — voz do navegador, sem
          // gastar cota do Gemini (com várias abas/dispositivos abertos, cada um falaria o
          // mesmo aviso pela voz "premium", multiplicando chamadas à toa por algo que
          // ninguém pediu explicitamente).
          speakText(spoken, { browserOnly: true }).catch(() => {});
        }
        setTimeout(() => dismiss(id), TOAST_MS);
      }
    } catch {
      // silencioso — não é crítico, só tenta de novo no próximo ciclo
    } finally {
      inFlightRef.current = false;
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
