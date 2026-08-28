"use client";

// Identifica ESTE navegador/dispositivo pros comandos remotos — gerado uma vez e salvo no
// navegador, pra sempre ser o mesmo id entre recarregamentos (e o dispositivo que manda um
// comando saber ignorar o próprio comando).
export function getDeviceId() {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem("deviceId", id);
  }
  return id;
}

// Rotas conhecidas pra "abrir X" por voz/texto — usado tanto pra detectar o comando quanto
// pra navegar quando ele chega de outro dispositivo.
export const NAV_TARGETS = [
  { key: "dashboard", target: "/dashboard", label: "Dashboard", re: /\bdashboard\b/i },
  { key: "quarto", target: "/", label: "Quarto de Guerra", re: /\bquarto\s*de\s*guerra\b/i },
  { key: "boards", target: "/boards", label: "Boards", re: /\bboards?\b/i },
  { key: "tasks", target: "/tasks", label: "Tarefas", re: /\btarefas?\b/i },
  { key: "thoughts", target: "/thoughts", label: "Pensamentos", re: /\bpensamentos?\b/i },
  { key: "sentinel", target: "/sentinel", label: "Sentinela", re: /\bsentinela\b/i },
  { key: "assistant", target: "/assistant", label: "Assistente", re: /\bassistente\b/i },
];

const OPEN_VERB_RE = /\b(abre|abrir|abra|mostra|mostrar|mostre|vai\s*pr[ao]|vai\s*para|ir\s*pr[ao]|ir\s*para|leva\s*pr[ao]|troca\s*pr[ao])\b/i;

/** Reconhece um pedido de "abrir X" localmente (sem gastar chamada do Gemini). */
export function matchNavCommand(text) {
  const q = (text || "").toLowerCase();
  if (!OPEN_VERB_RE.test(q)) return null;
  for (const t of NAV_TARGETS) if (t.re.test(q)) return t;
  return null;
}
