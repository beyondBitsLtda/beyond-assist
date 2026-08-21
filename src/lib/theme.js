// Paleta e helpers visuais compartilhados por todo o HUD (sidebar, topbar, painéis).
// Extraído de page.js — antes vivia inline numa única tela, agora é usado por vários painéis.

export const CY = "#38e1ff";
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
