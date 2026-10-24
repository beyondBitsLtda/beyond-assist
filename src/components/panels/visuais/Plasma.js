"use client";

// O Plasma (referência 3 de 24/10/2026): três formas onduladas e translúcidas, uma por cima da
// outra (rosa, roxo, azul), cada uma feita de linhas finas, com a borda acesa e um núcleo claro.
// Com a voz, as ondas crescem e o núcleo acende; ouvindo, elas tremem de leve.

import { useRef } from "react";
import { usarVisual, montarShaderDeTela } from "./motor.js";

const FRAGMENTO = `
  void main(){
    vec2 p = coordenada();
    float r = length(p);
    float a = atan(p.y, p.x);
    float t = uTempo;
    vec3 col = vec3(0.0);
    // macio como a referência: a voz faz a forma ondular, sem virar uma estrela de pontas
    float forca = 0.7 + uAmp * 1.15 + uOuvindo * 0.2;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float fase = t * (0.35 + 0.12 * fk) + fk * 2.1;
      float onda = 0.075 * sin(5.0 * a + fase) + 0.05 * sin(3.0 * a - fase * 1.3 + fk) + 0.035 * sin(7.0 * a + fase * 0.7 + fk * 1.7);
      float raio = 0.86 - 0.08 * fk + onda * forca;
      float rho = r / raio;
      float dentro = smoothstep(1.02, 0.94, rho);
      float linhas = pow(0.5 + 0.5 * cos(rho * 95.0 + fk * 1.3 - t * 0.6), 5.0);
      float borda = anel(rho, 1.0, 0.03);
      vec3 cor = k == 0 ? uC3 : (k == 1 ? uC2 : uC1);
      col += cor * (dentro * (0.06 + 0.32 * linhas) * (0.55 + 0.45 * (1.0 - rho)) + borda * 0.75);
    }
    // o núcleo claro, rosado e quase branco, que acende com a voz
    col += mix(uC1, vec3(1.0), 0.6) * exp(-r * r * 3.2) * (0.45 + uAmp * 0.9);
    col += mix(uC2, uC3, 0.5) * exp(-max(0.0, r - 0.8) * 5.0) * 0.12;
    gl_FragColor = vec4(min(col, vec3(1.0)), clamp(maior(col), 0.0, 1.0));
  }
`;

const montar = montarShaderDeTela(FRAGMENTO);

export default function Plasma({ obterSinal, ocupacao = 0.78 }) {
  const montagem = useRef(null);
  usarVisual(montagem, obterSinal, { id: "plasma", ocupacao, montar });
  return <div ref={montagem} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />;
}
