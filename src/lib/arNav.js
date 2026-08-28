// Abas do painel AR — apontar+tocar numa delas troca o que está desenhado no painel projetado
// (ver src/lib/arPanelRenderer.js e src/app/(panels)/dashboard/ar/page.js). É "navegar pela
// aplicação" dentro do AR: não abre as páginas de verdade (o WebXR não permite DOM interativo
// numa textura 3D), troca o conteúdo desenhado na MESMA textura — mesma ideia de um controle
// remoto com abas, não um navegador embutido.
export const AR_SCREENS = [
  { key: "dashboard", glyph: "▧", label: "DASHBOARD" },
  { key: "boards", glyph: "▦", label: "BOARDS" },
  { key: "tasks", glyph: "⏱", label: "TAREFAS" },
  { key: "sentinel", glyph: "◆", label: "SENTINELA" },
  { key: "thoughts", glyph: "✎", label: "PENSAMENTOS" },
];

const TAB_Y = 14, TAB_H = 46, TAB_GAP = 10, TAB_MARGIN = 34;

/**
 * Retângulos clicáveis da barra de abas, em coordenadas do canvas (0..texW / 0..texH) — a
 * MESMA fonte usada tanto pra desenhar a barra (arPanelRenderer.js) quanto pra testar o toque
 * (dashboard/ar/page.js: raycast 3D → UV → aqui), então nunca desalinham entre si.
 */
export function getTabHotspots(texW) {
  const n = AR_SCREENS.length;
  const tabW = (texW - TAB_MARGIN * 2 - TAB_GAP * (n - 1)) / n;
  return AR_SCREENS.map((s, i) => ({
    key: s.key, glyph: s.glyph, label: s.label,
    x: TAB_MARGIN + i * (tabW + TAB_GAP), y: TAB_Y, w: tabW, h: TAB_H,
  }));
}
