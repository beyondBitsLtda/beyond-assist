"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CY, mono } from "@/lib/theme.js";

const ITEMS = [
  { href: "/dashboard", label: "DASHBOARD", glyph: "▧" },
  { href: "/", label: "QUARTO DE GUERRA", glyph: "◈" },
  { href: "/boards", label: "BOARDS", glyph: "▦" },
  { href: "/tasks", label: "TAREFAS", glyph: "⏱" },
  { href: "/thoughts", label: "PENSAMENTOS", glyph: "✎" },
  { href: "/sentinel", label: "SENTINELA", glyph: "◆" },
  { href: "/news", label: "NOTÍCIAS & CLIMA", glyph: "📰" },
  { href: "/delp-tasks", label: "TAREFAS DELP", glyph: "🏢" },
  { href: "/scheduled-announcements", label: "FALAS AGENDADAS", glyph: "⏰" },
  { href: "/code-repos", label: "REPOSITÓRIOS", glyph: "🐙" },
  { href: "/map-of-deploy", label: "MAP OF DEPLOY", glyph: "🚀" },
  { href: "/code-tasks", label: "TAREFAS DE CÓDIGO", glyph: "🛠️" },
  { href: "/arch-docs", label: "MAPA DE ARQUITETURA", glyph: "🗺️" },
  { href: "/test-mode", label: "MODO DE TESTES", glyph: "🧪" },
  { href: "/sync-status", label: "PROGRESSO DO SYNC", glyph: "📊" },
  { href: "/assistant", label: "ASSISTENTE", glyph: "◉" },
  { href: "/gemini-keys", label: "CHAVES GEMINI", glyph: "🔑" },
];

// A tela do iMac agora existe nos dois lugares, por caminhos diferentes: em casa ela é
// embutida direto; na nuvem, o painel entrega o endereço próprio que o túnel publica. Por
// isso o item vale sempre — o painel é que decide qual das duas coisas mostrar.
const ITENS = [...ITEMS, { href: "/maquina", label: "TELA DO SERVIDOR", glyph: "🖥️" }];

export default function Sidebar({ open = false, onNavigate }) {
  const pathname = usePathname();

  return (
    <aside
      className={`bb-sidebar${open ? " bb-open" : ""}`}
      style={{
        borderRight: "1px solid rgba(var(--accent-rgb),0.16)",
        display: "flex", flexDirection: "column",
        background: "linear-gradient(180deg, rgba(6,20,26,0.6), transparent)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid rgba(var(--accent-rgb),0.12)" }}>
        <div style={{ width: 24, height: 24, border: "1.5px solid var(--accent-hex)", borderRadius: "50%", boxShadow: "0 0 14px rgba(var(--accent-rgb),0.5)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <div style={{ width: 8, height: 8, background: CY, borderRadius: "50%", boxShadow: "0 0 8px var(--accent-hex)" }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 3, color: "#eafcff", lineHeight: 1 }}>BEYOND</div>
          <div style={{ ...mono, fontSize: 8, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.6)", marginTop: 3 }}>BITS</div>
        </div>
      </div>

      {/* `minHeight: 0` é o que permite o nav encolher dentro do flex e, aí sim, rolar. Sem
          ele o flex dá ao nav a altura do conteúdo inteiro, a lista vaza pra fora da tela e os
          últimos itens ficam inalcançáveis — não tem barra de rolagem porque não há transbordo:
          o transbordo é da janela. */}
      <nav
        className="bb-sidebar-nav"
        style={{ display: "flex", flexDirection: "column", padding: "10px 0", gap: 2, flex: 1, minHeight: 0, overflowY: "auto" }}
      >
        {ITENS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", flex: "none",
                color: active ? "#eafcff" : "rgba(207,239,251,0.55)",
                background: active ? "rgba(var(--accent-rgb),0.08)" : "transparent",
                borderLeft: active ? `2px solid ${CY}` : "2px solid transparent",
              }}
            >
              <span style={{ ...mono, fontSize: 12, color: active ? CY : "rgba(var(--accent-rgb),0.4)" }}>{item.glyph}</span>
              <span style={{ ...mono, fontSize: 10.5, letterSpacing: 1.5 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
