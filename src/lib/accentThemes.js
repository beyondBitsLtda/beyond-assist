// Cores de destaque disponíveis pro seletor de tema (ver Topbar.js). Evita verde e laranja
// de propósito — essas já têm significado fixo no HUD (verde = ok/sucesso, laranja =
// aviso/erro), então usá-las como destaque geral confundiria os status com o tema.
export const ACCENT_THEMES = [
  { name: "Branco", hex: "#ffffff", rgb: "255,255,255" },
  { name: "Ciano", hex: "#38e1ff", rgb: "56,225,255" },
  { name: "Azul", hex: "#4f8cff", rgb: "79,140,255" },
  { name: "Roxo", hex: "#a78bfa", rgb: "167,139,250" },
  { name: "Rosa", hex: "#ff5ea8", rgb: "255,94,168" },
  { name: "Vermelho", hex: "#ff5c5c", rgb: "255,92,92" },
  { name: "Dourado", hex: "#f2c94c", rgb: "242,201,76" },
];

export const DEFAULT_ACCENT = ACCENT_THEMES[0];

/** Aplica um tema (hex+rgb) nas variáveis CSS globais — usado tanto ao carregar (Shell.js)
 * quanto ao trocar no seletor (Topbar.js). */
export function applyAccentTheme(theme) {
  if (typeof document === "undefined" || !theme?.hex || !theme?.rgb) return;
  document.documentElement.style.setProperty("--accent-hex", theme.hex);
  document.documentElement.style.setProperty("--accent-rgb", theme.rgb);
}