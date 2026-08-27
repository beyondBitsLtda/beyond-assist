// Paleta e helpers visuais compartilhados por todo o HUD (sidebar, topbar, painéis).
// Extraído de page.js — antes vivia inline numa única tela, agora é usado por vários painéis.

// Referencia a variável CSS em vez de um hex fixo — trocável pelo seletor de tema no Topbar
// (ver src/lib/accentThemes.js). rgba(56,225,255,...) espalhados pelo app também foram
// convertidos pra rgba(var(--accent-rgb),...), que acompanham a mesma troca automaticamente.
export const CY = "var(--accent-hex)";
export const OR = "#ff9d3d";
export const GR = "#7bd88f";
export const PU = "#c9a6ff";

export const mono = { fontFamily: "'JetBrains Mono',monospace" };

/** Cor da bolinha de status de conexão: null = desconhecido, true = ok, false = falhou. */
export const dotColor = (ok) => (ok == null ? "rgba(207,239,251,0.35)" : ok ? GR : OR);

/** Medidor tipo "barra de sinal" em texto (usado no card de similaridade do RAG). */
export const meterFor = (pct) => {
  const filled = Math.round((pct || 0) / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
};
