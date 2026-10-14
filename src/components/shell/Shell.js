"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogProvider } from "./LogProvider.js";
import Topbar from "./Topbar.js";
import NotificationToasts from "./NotificationToasts.js";
import RemoteCommandListener from "./RemoteCommandListener.js";
import { applyAccentTheme } from "@/lib/accentThemes.js";
import { useIsMobile } from "@/lib/useIsMobile.js";

/**
 * Casca compartilhada por todos os painéis: fundo preto, topo e conteúdo.
 *
 * Revisão visual (out/2026): saíram a barra lateral (os painéis agora ficam no menu "Painéis" do
 * topo, agrupados — src/lib/navegacao.js), a grade de fundo e o brilho radial. Fundo preto puro,
 * e o conteúdo ocupa a largura toda.
 */
export default function Shell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  // no mobile, o Assistente é uma experiência própria em tela cheia (sem Topbar/Sidebar —
  // ver src/app/(panels)/assistant/page.js) — as outras abas continuam com a casca normal.
  const mobileAssistantFullScreen = isMobile && pathname === "/assistant";
  // Dashboard AR também precisa da tela toda (câmera + canvas WebXR) — Sidebar/Topbar por
  // cima só atrapalhariam a visão da câmera, e o próprio /dashboard/ar já desenha sua navegação.
  const fullScreenNoChrome = mobileAssistantFullScreen || pathname === "/dashboard/ar";

  // no mobile, abrir o app já direto no Assistente (chat) — o Kanban só faz sentido como
  // painel específico que você escolhe visitar, não como tela inicial numa tela pequena.
  // Só força esse redirect na 1ª entrada da sessão — senão o atalho "Outros painéis" do
  // Assistente mobile (que pode levar de volta pra "/") ficaria preso num loop de redirect.
  useEffect(() => {
    if (pathname !== "/") return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("bb-entered")) return;
    sessionStorage.setItem("bb-entered", "1");
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
  if (fullScreenNoChrome) {
    return (
      <LogProvider>
        <div className="bb-app" style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
          {children}
          <NotificationToasts />
          <RemoteCommandListener />
        </div>
      </LogProvider>
    );
  }

  return (
    <LogProvider>
      <div className="bb-app" style={{ position: "fixed", inset: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Topbar />
        {/* bb-painel: a camada de revisão visual dos painéis (fonte, espaçamento, superfícies — ver
            globals.css). O Assistente já nasceu no visual novo e fica de fora. */}
        <div className={pathname === "/assistant" ? "bb-conteudo" : "bb-conteudo bb-painel"} style={{ flex: 1, minHeight: 0, overflow: "auto", position: "relative" }}>{children}</div>
        <NotificationToasts />
        <RemoteCommandListener />
      </div>
    </LogProvider>
  );
}
