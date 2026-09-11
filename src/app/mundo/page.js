"use client";

import { useCallback, useEffect, useState } from "react";
import LisaWorld from "@/components/panels/LisaWorld.js";
import { applyAccentTheme } from "@/lib/accentThemes.js";
import { CY, mono } from "@/lib/theme.js";

// Janela dedicada do Mundo da Lisa. Fica FORA do grupo (panels) de propósito: sem Sidebar e sem
// Topbar, a tela inteira é o terreno dela — que é o ponto de poder deixar isso aberto num canto
// e ir olhando a vida dela acontecer.
//
// Sobre a tela cheia: navegador nenhum deixa uma página entrar em fullscreen sozinha ao
// carregar, só a partir de um gesto. Então a janela já abre do tamanho da tela e o primeiro
// clique aqui dentro pede o fullscreen — mais o botão ⛶, que continua servindo pra sair e voltar.

export default function MundoPage() {
  const [isFull, setIsFull] = useState(false);

  // mesma cor de destaque escolhida no app principal (quem costuma aplicar isso é o Shell, e
  // aqui não tem Shell) — sem isso a janela abriria sempre no ciano padrão
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("accentTheme") || "null");
      if (saved) applyAccentTheme(saved);
    } catch {}
  }, []);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onChange = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    const once = () => { document.documentElement.requestFullscreen?.().catch(() => {}); };
    window.addEventListener("pointerdown", once, { once: true });
    window.addEventListener("keydown", once, { once: true });
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("pointerdown", once);
      window.removeEventListener("keydown", once);
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#03080c", color: "#eafcff", overflow: "hidden" }}>
      <header style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", borderBottom: "1px solid rgba(var(--accent-rgb),0.16)", background: "rgba(var(--accent-rgb),0.03)" }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${CY}`, boxShadow: "0 0 12px rgba(var(--accent-rgb),0.5)", flex: "none" }} />
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>MUNDO DA LISA</div>
        <div style={{ ...mono, fontSize: 9, letterSpacing: 1, color: "rgba(207,239,251,0.4)" }}>arraste pra rolar o terreno</div>
        <button
          onClick={toggleFull}
          style={{ ...mono, fontSize: 10, marginLeft: "auto", padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "transparent", color: "#eafcff", cursor: "pointer", letterSpacing: 1 }}
        >
          {isFull ? "⛶ SAIR DA TELA CHEIA" : "⛶ TELA CHEIA"}
        </button>
        <button
          onClick={() => window.close()}
          style={{ ...mono, fontSize: 10, padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.25)", background: "transparent", color: "rgba(207,239,251,0.6)", cursor: "pointer", letterSpacing: 1 }}
        >
          ✕ FECHAR
        </button>
      </header>

      <LisaWorld fullscreen />
    </div>
  );
}
