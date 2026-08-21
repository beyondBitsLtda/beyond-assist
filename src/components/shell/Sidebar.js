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
  { href: "/assistant", label: "ASSISTENTE", glyph: "◉" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        position: "relative", zIndex: 2, width: 208, flex: "none",
        borderRight: "1px solid rgba(56,225,255,0.16)",
        display: "flex", flexDirection: "column",
        background: "linear-gradient(180deg, rgba(6,20,26,0.6), transparent)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid rgba(56,225,255,0.12)" }}>
        <div style={{ width: 24, height: 24, border: "1.5px solid #38e1ff", borderRadius: "50%", boxShadow: "0 0 14px rgba(56,225,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <div style={{ width: 8, height: 8, background: CY, borderRadius: "50%", boxShadow: "0 0 8px #38e1ff" }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 3, color: "#eafcff", lineHeight: 1 }}>BEYOND</div>
          <div style={{ ...mono, fontSize: 8, letterSpacing: 2, color: "rgba(56,225,255,0.6)", marginTop: 3 }}>BITS</div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", padding: "10px 0", gap: 2 }}>
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 18px",
                color: active ? "#eafcff" : "rgba(207,239,251,0.55)",
                background: active ? "rgba(56,225,255,0.08)" : "transparent",
                borderLeft: active ? `2px solid ${CY}` : "2px solid transparent",
              }}
            >
              <span style={{ ...mono, fontSize: 12, color: active ? CY : "rgba(56,225,255,0.4)" }}>{item.glyph}</span>
              <span style={{ ...mono, fontSize: 10.5, letterSpacing: 1.5 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
