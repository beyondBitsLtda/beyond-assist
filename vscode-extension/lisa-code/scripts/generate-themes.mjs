// Gera os temas de cores do VS Code a partir da MESMA paleta que a Lisa usa no Beyond Bits —
// ver src/lib/accentThemes.js (as 6 cores de destaque selecionáveis) e src/lib/theme.js (OR/GR/PU
// fixos + fundo preto/painéis escuros + fonte JetBrains Mono do HUD). Copiado aqui (não
// importado ao vivo) porque essa extensão é um projeto Node/TS separado do Next.js — se a
// paleta do app mudar, atualize as duas listas junto.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ACCENT_THEMES = [
  { name: "Ciano", hex: "#38e1ff" },
  { name: "Azul", hex: "#4f8cff" },
  { name: "Roxo", hex: "#a78bfa" },
  { name: "Rosa", hex: "#ff5ea8" },
  { name: "Vermelho", hex: "#ff5c5c" },
  { name: "Dourado", hex: "#f2c94c" },
];

const FIXED = { orange: "#ff9d3d", green: "#7bd88f", purple: "#c9a6ff", text: "#eafcff", dim: "#cfeffb" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "themes");
mkdirSync(OUT_DIR, { recursive: true });

function alpha(hex, a) {
  // hex "#rrggbb" + alpha 0..1 -> "#rrggbbAA" (VS Code aceita alpha de 2 dígitos no fim do hex)
  const aa = Math.round(a * 255).toString(16).padStart(2, "0");
  return `${hex}${aa}`;
}

function buildTheme(accentHex) {
  const A = accentHex;
  return {
    name: `Lisa HUD`,
    type: "dark",
    colors: {
      "focusBorder": A,
      "foreground": FIXED.text,
      "selection.background": alpha(A, 0.3),

      "editor.background": "#000000",
      "editor.foreground": FIXED.text,
      "editor.lineHighlightBackground": alpha(A, 0.06),
      "editor.selectionBackground": alpha(A, 0.28),
      "editorCursor.foreground": A,
      "editorLineNumber.foreground": alpha(FIXED.dim, 0.35),
      "editorLineNumber.activeForeground": A,
      "editorIndentGuide.background1": alpha(A, 0.08),
      "editorIndentGuide.activeBackground1": alpha(A, 0.25),
      "editorWhitespace.foreground": alpha(A, 0.1),
      "editorWidget.background": "#08131a",
      "editorWidget.border": alpha(A, 0.25),
      "editorSuggestWidget.background": "#08131a",
      "editorSuggestWidget.border": alpha(A, 0.2),
      "editorSuggestWidget.selectedBackground": alpha(A, 0.15),
      "editorGroupHeader.tabsBackground": "#000000",
      "editorGroup.border": alpha(A, 0.12),
      "editorBracketMatch.background": alpha(A, 0.2),
      "editorBracketMatch.border": A,

      "activityBar.background": "#000000",
      "activityBar.foreground": A,
      "activityBar.inactiveForeground": alpha(FIXED.dim, 0.35),
      "activityBar.border": alpha(A, 0.12),
      "activityBarBadge.background": A,
      "activityBarBadge.foreground": "#000000",

      "sideBar.background": "#08131a",
      "sideBar.foreground": alpha(FIXED.dim, 0.85),
      "sideBar.border": alpha(A, 0.1),
      "sideBarTitle.foreground": A,
      "sideBarSectionHeader.background": "#000000",
      "sideBarSectionHeader.foreground": alpha(FIXED.dim, 0.7),
      "list.activeSelectionBackground": alpha(A, 0.15),
      "list.activeSelectionForeground": FIXED.text,
      "list.inactiveSelectionBackground": alpha(A, 0.08),
      "list.hoverBackground": alpha(A, 0.06),
      "list.highlightForeground": A,

      "statusBar.background": "#08131a",
      "statusBar.foreground": alpha(FIXED.dim, 0.85),
      "statusBar.border": alpha(A, 0.12),
      "statusBar.debuggingBackground": FIXED.orange,
      "statusBar.debuggingForeground": "#000000",
      "statusBarItem.remoteBackground": alpha(A, 0.18),
      "statusBarItem.remoteForeground": A,

      "titleBar.activeBackground": "#000000",
      "titleBar.activeForeground": FIXED.text,
      "titleBar.inactiveBackground": "#000000",
      "titleBar.border": alpha(A, 0.1),

      "tab.activeBackground": "#08131a",
      "tab.activeForeground": FIXED.text,
      "tab.activeBorderTop": A,
      "tab.inactiveBackground": "#000000",
      "tab.inactiveForeground": alpha(FIXED.dim, 0.5),
      "tab.border": alpha(A, 0.08),

      "panel.background": "#08131a",
      "panel.border": alpha(A, 0.15),
      "panelTitle.activeForeground": A,
      "panelTitle.activeBorder": A,

      "terminal.background": "#000000",
      "terminal.foreground": FIXED.text,
      "terminal.ansiCyan": A,
      "terminal.ansiBrightCyan": A,
      "terminal.ansiGreen": FIXED.green,
      "terminal.ansiBrightGreen": FIXED.green,
      "terminal.ansiYellow": FIXED.orange,
      "terminal.ansiBrightYellow": FIXED.orange,
      "terminal.ansiMagenta": FIXED.purple,
      "terminal.ansiBrightMagenta": FIXED.purple,
      "terminal.ansiRed": "#ff5c5c",
      "terminal.ansiBrightRed": "#ff7a7a",
      "terminal.ansiBlue": "#4f8cff",
      "terminal.ansiBrightBlue": "#7fb0ff",

      "button.background": A,
      "button.foreground": "#04121a",
      "button.hoverBackground": A,
      "badge.background": A,
      "badge.foreground": "#04121a",
      "progressBar.background": A,

      "input.background": "#08131a",
      "input.border": alpha(A, 0.25),
      "input.foreground": FIXED.text,
      "inputOption.activeBorder": A,
      "dropdown.background": "#08131a",
      "dropdown.border": alpha(A, 0.25),

      "scrollbarSlider.background": alpha(A, 0.2),
      "scrollbarSlider.hoverBackground": alpha(A, 0.32),
      "scrollbarSlider.activeBackground": alpha(A, 0.45),

      "notifications.background": "#08131a",
      "notifications.border": alpha(A, 0.2),
      "gitDecoration.modifiedResourceForeground": FIXED.orange,
      "gitDecoration.addedResourceForeground": FIXED.green,
      "gitDecoration.deletedResourceForeground": "#ff5c5c",
    },
    tokenColors: [
      { settings: { foreground: FIXED.text } },
      { scope: ["comment"], settings: { foreground: alpha(FIXED.dim, 0.45), fontStyle: "italic" } },
      { scope: ["string"], settings: { foreground: FIXED.green } },
      { scope: ["constant.numeric", "constant.language", "constant.character"], settings: { foreground: FIXED.orange } },
      { scope: ["keyword", "storage.type", "storage.modifier", "keyword.control"], settings: { foreground: A, fontStyle: "bold" } },
      { scope: ["entity.name.function", "support.function"], settings: { foreground: FIXED.purple } },
      { scope: ["entity.name.tag", "entity.name.type", "entity.name.class", "support.class"], settings: { foreground: A } },
      { scope: ["variable", "variable.parameter"], settings: { foreground: FIXED.text } },
      { scope: ["variable.other.property", "variable.other.object.property"], settings: { foreground: FIXED.dim } },
      { scope: ["entity.other.attribute-name"], settings: { foreground: FIXED.purple } },
      { scope: ["punctuation", "meta.brace"], settings: { foreground: alpha(FIXED.dim, 0.7) } },
      { scope: ["markup.bold"], settings: { fontStyle: "bold" } },
      { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
      { scope: ["markup.heading"], settings: { foreground: A, fontStyle: "bold" } },
      { scope: ["invalid"], settings: { foreground: "#ff5c5c" } },
    ],
  };
}

for (const { name, hex } of ACCENT_THEMES) {
  const theme = buildTheme(hex);
  const fileName = `lisa-hud-${name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.json`;
  writeFileSync(join(OUT_DIR, fileName), JSON.stringify(theme, null, 2) + "\n", "utf8");
  console.log(`gerado: themes/${fileName} (${name}, ${hex})`);
}
