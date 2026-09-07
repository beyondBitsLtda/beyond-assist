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

function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
/** Escurece a cor de destaque até virar fundo — mantém o MATIZ dela (é isso que faz o VS Code
 * inteiro "ficar na cor da Lisa" em vez de preto puro). factor 0.07 ≈ quase preto com o tom. */
function shade(hex, factor) {
  return toHex(toRgb(hex).map((v) => v * factor));
}
/** Clareia até quase branco, mantendo o matiz — pro texto combinar com o fundo tingido
 * (num tema dourado, um branco-azulado ficaria estranho). */
function lighten(hex, factor) {
  return toHex(toRgb(hex).map((v) => v + (255 - v) * factor));
}

/** `tinted` = família "Lisa Imersivo": o fundo do editor/painéis/terminal deixa de ser preto e
 * passa a ser a própria cor de destaque bem escurecida, então a IDE inteira assume o tom da
 * Lisa. Sem isso é a família "Lisa HUD" original (fundo preto + painéis #08131a, igual o app). */
function buildTheme(accentHex, { tinted = false } = {}) {
  const A = accentHex;
  const BG = tinted ? shade(A, 0.07) : "#000000";
  const BG_PANEL = tinted ? shade(A, 0.13) : "#08131a";
  const TEXT = tinted ? lighten(A, 0.9) : FIXED.text;
  const DIM = tinted ? lighten(A, 0.75) : FIXED.dim;
  const ON_ACCENT = tinted ? shade(A, 0.05) : "#04121a"; // texto EM CIMA da cor de destaque (botão, badge)
  return {
    name: tinted ? `Lisa Imersivo` : `Lisa HUD`,
    type: "dark",
    colors: {
      "focusBorder": A,
      "foreground": TEXT,
      "selection.background": alpha(A, 0.3),

      "editor.background": BG,
      "editor.foreground": TEXT,
      "editor.lineHighlightBackground": alpha(A, 0.06),
      "editor.selectionBackground": alpha(A, 0.28),
      "editorCursor.foreground": A,
      "editorLineNumber.foreground": alpha(DIM, 0.35),
      "editorLineNumber.activeForeground": A,
      "editorIndentGuide.background1": alpha(A, 0.08),
      "editorIndentGuide.activeBackground1": alpha(A, 0.25),
      "editorWhitespace.foreground": alpha(A, 0.1),
      "editorWidget.background": BG_PANEL,
      "editorWidget.border": alpha(A, 0.25),
      "editorSuggestWidget.background": BG_PANEL,
      "editorSuggestWidget.border": alpha(A, 0.2),
      "editorSuggestWidget.selectedBackground": alpha(A, 0.15),
      "editorGroupHeader.tabsBackground": BG,
      "editorGroup.border": alpha(A, 0.12),
      "editorBracketMatch.background": alpha(A, 0.2),
      "editorBracketMatch.border": A,

      "activityBar.background": BG,
      "activityBar.foreground": A,
      "activityBar.inactiveForeground": alpha(DIM, 0.35),
      "activityBar.border": alpha(A, 0.12),
      "activityBarBadge.background": A,
      "activityBarBadge.foreground": ON_ACCENT,

      "sideBar.background": BG_PANEL,
      "sideBar.foreground": alpha(DIM, 0.85),
      "sideBar.border": alpha(A, 0.1),
      "sideBarTitle.foreground": A,
      "sideBarSectionHeader.background": BG,
      "sideBarSectionHeader.foreground": alpha(DIM, 0.7),
      "list.activeSelectionBackground": alpha(A, 0.15),
      "list.activeSelectionForeground": TEXT,
      "list.inactiveSelectionBackground": alpha(A, 0.08),
      "list.hoverBackground": alpha(A, 0.06),
      "list.highlightForeground": A,

      "statusBar.background": BG_PANEL,
      "statusBar.foreground": alpha(DIM, 0.85),
      "statusBar.border": alpha(A, 0.12),
      "statusBar.debuggingBackground": FIXED.orange,
      "statusBar.debuggingForeground": ON_ACCENT,
      "statusBarItem.remoteBackground": alpha(A, 0.18),
      "statusBarItem.remoteForeground": A,

      "titleBar.activeBackground": BG,
      "titleBar.activeForeground": TEXT,
      "titleBar.inactiveBackground": BG,
      "titleBar.border": alpha(A, 0.1),

      "tab.activeBackground": BG_PANEL,
      "tab.activeForeground": TEXT,
      "tab.activeBorderTop": A,
      "tab.inactiveBackground": BG,
      "tab.inactiveForeground": alpha(DIM, 0.5),
      "tab.border": alpha(A, 0.08),

      "panel.background": BG_PANEL,
      "panel.border": alpha(A, 0.15),
      "panelTitle.activeForeground": A,
      "panelTitle.activeBorder": A,

      "terminal.background": BG,
      "terminal.foreground": TEXT,
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
      "button.foreground": ON_ACCENT,
      "button.hoverBackground": A,
      "badge.background": A,
      "badge.foreground": ON_ACCENT,
      "progressBar.background": A,

      "input.background": BG_PANEL,
      "input.border": alpha(A, 0.25),
      "input.foreground": TEXT,
      "inputOption.activeBorder": A,
      "dropdown.background": BG_PANEL,
      "dropdown.border": alpha(A, 0.25),

      "scrollbarSlider.background": alpha(A, 0.2),
      "scrollbarSlider.hoverBackground": alpha(A, 0.32),
      "scrollbarSlider.activeBackground": alpha(A, 0.45),

      "notifications.background": BG_PANEL,
      "notifications.border": alpha(A, 0.2),
      "gitDecoration.modifiedResourceForeground": FIXED.orange,
      "gitDecoration.addedResourceForeground": FIXED.green,
      "gitDecoration.deletedResourceForeground": "#ff5c5c",
    },
    tokenColors: [
      { settings: { foreground: TEXT } },
      { scope: ["comment"], settings: { foreground: alpha(DIM, 0.45), fontStyle: "italic" } },
      { scope: ["string"], settings: { foreground: FIXED.green } },
      { scope: ["constant.numeric", "constant.language", "constant.character"], settings: { foreground: FIXED.orange } },
      { scope: ["keyword", "storage.type", "storage.modifier", "keyword.control"], settings: { foreground: A, fontStyle: "bold" } },
      { scope: ["entity.name.function", "support.function"], settings: { foreground: FIXED.purple } },
      { scope: ["entity.name.tag", "entity.name.type", "entity.name.class", "support.class"], settings: { foreground: A } },
      { scope: ["variable", "variable.parameter"], settings: { foreground: TEXT } },
      { scope: ["variable.other.property", "variable.other.object.property"], settings: { foreground: DIM } },
      { scope: ["entity.other.attribute-name"], settings: { foreground: FIXED.purple } },
      { scope: ["punctuation", "meta.brace"], settings: { foreground: alpha(DIM, 0.7) } },
      { scope: ["markup.bold"], settings: { fontStyle: "bold" } },
      { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
      { scope: ["markup.heading"], settings: { foreground: A, fontStyle: "bold" } },
      { scope: ["invalid"], settings: { foreground: "#ff5c5c" } },
    ],
  };
}

const FAMILIES = [
  { slug: "lisa-hud", tinted: false },
  { slug: "lisa-imersivo", tinted: true },
];

for (const { slug, tinted } of FAMILIES) {
  for (const { name, hex } of ACCENT_THEMES) {
    const theme = buildTheme(hex, { tinted });
    const fileName = `${slug}-${name.toLowerCase()}.json`;
    writeFileSync(join(OUT_DIR, fileName), JSON.stringify(theme, null, 2) + "\n", "utf8");
    console.log(`gerado: themes/${fileName} (${name}, ${hex}, fundo ${theme.colors["editor.background"]})`);
  }
}
