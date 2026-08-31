// Cores de destaque disponíveis pro seletor de tema (ver Topbar.js), configuradas para a paleta monocromática (preto, branco e tons de cinza).
export const ACCENT_THEMES = [
  { name: "Branco", hex: "#ffffff", rgb: "255,255,255" },
  { name: "Cinza Claro", hex: "#d1d5db", rgb: "209,213,219" },
  { name: "Cinza", hex: "#9ca3af", rgb: "156,163,175" },
  { name: "Cinza Escuro", hex: "#4b5563", rgb: "75,85,99" },
  { name: "Grafite", hex: "#1f2937", rgb: "31,41,55" },
  { name: "Preto", hex: "#000000", rgb: "0,0,0" },
];

export const DEFAULT_ACCENT = ACCENT_THEMES[0];

/** Aplica um tema (hex+rgb) nas variáveis CSS globais — usado tanto ao carregar (Shell.js)
 * quanto ao trocar no seletor (Topbar.js). */
export function applyAccentTheme(theme) {
  if (typeof document === "undefined" || !theme?.hex || !theme?.rgb) return;
  document.documentElement.style.setProperty("--accent-hex", theme.hex);
  document.documentElement.style.setProperty("--accent-rgb", theme.rgb);
}