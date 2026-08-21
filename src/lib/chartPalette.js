// Cores validadas pela skill dataviz (node scripts/validate_palette.js) — modo escuro,
// checadas contra uma superfície quase-preta (perto de #000, mais escura que a superfície
// de referência #1a1a19 da skill; contraste só melhora ao escurecer, então os valores
// documentados pra dark mode seguem válidos aqui).
//
// validate_palette.js "#3987e5,#d95926,#199e70" --mode dark --surface "#000000"
//   → ALL CHECKS PASS (lightness band, chroma floor, CVD ΔE 9.4, normal-vision ΔE 26.5, contraste)
export const CHART = {
  categorical: ["#3987e5", "#d95926", "#199e70", "#c98500"], // slots 1-4, ordem fixa (nunca ciclada)
  status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#e66767" },
};
