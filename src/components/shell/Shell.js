"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogProvider } from "./LogProvider.js";
import Sidebar from "./Sidebar.js";
import Topbar from "./Topbar.js";
import NotificationToasts from "./NotificationToasts.js";
import RemoteCommandListener from "./RemoteCommandListener.js";
import { applyAccentTheme } from "@/lib/accentThemes.js";
import { useIsMobile } from "@/lib/useIsMobile.js";

/**
 * Casca compartilhada por todos os painéis: fundo com grid/glow + sidebar + topbar + conteúdo.
 * No mobile (ver globals.css), a sidebar vira um menu off-canvas controlado por `sidebarOpen`
 * — aberto pelo hambúrguer no Topbar, fechado clicando no fundo escurecido ou navegando.
 */
export default function Shell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  // no mobile, o Assistente é uma experiência própria em tela cheia (sem Topbar/Sidebar —
  // ver src/app/(panels)/assistant/page.js) — as outras abas continuam com a casca normal.
  const mobileAssistantFullScreen = isMobile && pathname === "/assistant";

  // no mobile, abrir o app já direto no Assistente (chat) — o Kanban só faz sentido como
  // painel específico que você escolhe visitar, não como tela inicial numa tela pequena
  useEffect(() => {
    if (pathname !== "/") return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 768px)").matches) router.replace("/assistant");
  }, [pathname, router]);

  // aplica a cor de destaque escolhida antes (se houver) assim que o app carrega — o
  // seletor de verdade fica no Topbar, mas isso precisa rodar cedo, antes de qualquer
  // outro componente desenhar, senão pisca a cor padrão por um instante.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem("accentTheme") || "null");
      if (saved) applyAccentTheme(saved);
    } catch {}
  }, []);

  // Assistente no mobile: tela cheia, sem Topbar/Sidebar — a própria página monta os
  // controles dela (sync, voz, tema, escopo). Ainda dentro do LogProvider (o Assistente usa
  // addLog) e com os avisos dentro do app funcionando igual.
  if (mobileAssistantFullScreen) {
    return (
      <LogProvider>
        <div style={{ position: "fixed", inset: 0, background: "#000", fontFamily: "'Rajdhani',sans-serif", color: "#cfeffb", overflow: "hidden" }}>
          {children}
          <NotificationToasts />
          <RemoteCommandListener />
        </div>
      </LogProvider>
    );
  }

  return (
    <LogProvider>
      <div style={{ position: "fixed", inset: 0, background: "#000", fontFamily: "'Rajdhani',sans-serif", color: "#cfeffb", overflow: "hidden", display: "flex" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(var(--accent-rgb),0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--accent-rgb),0.035) 1px, transparent 1px)", backgroundSize: "44px 44px", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "-25%", left: "50%", transform: "translateX(-50%)", width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(var(--accent-rgb),0.10), transparent 62%)", pointerEvents: "none" }} />

        <div
          className={`bb-sidebar-backdrop${sidebarOpen ? " bb-open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />
        <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

        <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</div>
        </div>
        <NotificationToasts />
        <RemoteCommandListener />
      </div>
    </LogProvider>
  );
}
