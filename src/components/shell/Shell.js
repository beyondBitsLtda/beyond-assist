"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogProvider } from "./LogProvider.js";
import Sidebar from "./Sidebar.js";
import Topbar from "./Topbar.js";

/**
 * Casca compartilhada por todos os painéis: fundo com grid/glow + sidebar + topbar + conteúdo.
 * No mobile (ver globals.css), a sidebar vira um menu off-canvas controlado por `sidebarOpen`
 * — aberto pelo hambúrguer no Topbar, fechado clicando no fundo escurecido ou navegando.
 */
export default function Shell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // no mobile, abrir o app já direto no Assistente (chat) — o Kanban só faz sentido como
  // painel específico que você escolhe visitar, não como tela inicial numa tela pequena
  useEffect(() => {
    if (pathname !== "/") return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 768px)").matches) router.replace("/assistant");
  }, [pathname, router]);

  return (
    <LogProvider>
      <div style={{ position: "fixed", inset: 0, background: "#000", fontFamily: "'Rajdhani',sans-serif", color: "#cfeffb", overflow: "hidden", display: "flex" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(56,225,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(56,225,255,0.035) 1px, transparent 1px)", backgroundSize: "44px 44px", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "-25%", left: "50%", transform: "translateX(-50%)", width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,225,255,0.10), transparent 62%)", pointerEvents: "none" }} />

        <div
          className={`bb-sidebar-backdrop${sidebarOpen ? " bb-open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />
        <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

        <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</div>
        </div>
      </div>
    </LogProvider>
  );
}
