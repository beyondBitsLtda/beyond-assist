"use client";

// O Orbe de vidro (referência 2 de 24/10/2026): uma esfera de vidro escuro com fitas iridescentes
// (roxo, azul, dourado) girando por dentro, a borda clara do vidro e o brilho da luz em cima.
// Com a voz, as fitas se torcem e acendem; pensando, giram mais rápido.

import { useRef } from "react";
import { usarVisual, montarShaderDeTela } from "./motor.js";

const FRAGMENTO = `
  mat3 giroY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 giroX(float a){ float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  // a cor iridescente: desliza entre as três cores do estado
  vec3 iris(float x){
    x = fract(x);
    vec3 c = mix(uC1, uC2, smoothstep(0.0, 0.5, x));
    c = mix(c, uC3, smoothstep(0.55, 0.8, x));
    return mix(c, uC1, smoothstep(0.8, 1.0, x));
  }
  void main(){
    vec2 p = coordenada();
    float r = length(p);
    float t = uTempo;
    vec3 col = vec3(0.0);
    float esfera = smoothstep(1.0, 0.99, r);
    if (r < 1.0) {
      vec3 n = vec3(p, sqrt(1.0 - r * r));
      float vel = 0.18 + uPensando * 0.35 + uAmp * 0.25;
      vec3 q = giroY(t * vel) * giroX(0.5 + 0.15 * sin(t * 0.3)) * n;
      // as fitas: duas famílias de faixas finas, torcidas por ondas que mudam com o tempo e com a
      // voz, que se cruzam por dentro do vidro (como na referência)
      float torce = sin(q.x * 2.4 + t * 0.5) * 0.9 + sin(q.z * 3.1 - t * 0.4) * 0.5 + uAmp * 0.8 * sin(q.y * 6.0 + t * 3.0);
      float f1 = q.y * 2.2 + 0.55 * torce;
      float f2 = (q.x * 0.8 + q.z * 1.6) * 1.8 + 0.5 * sin(q.y * 3.0 + t * 0.6) + uAmp * 0.6 * sin(q.x * 5.0 - t * 2.0);
      float b1 = sin(f1 * 3.1416);
      float b2 = sin(f2 * 3.1416);
      float frente = n.z;
      vec3 cor1 = iris(f1 * 0.3 + q.x * 0.12 + t * 0.03);
      vec3 cor2 = iris(f2 * 0.3 + 0.45 + t * 0.02);
      col += vec3(0.02, 0.01, 0.05) + uC2 * 0.04;
      col += cor1 * smoothstep(0.55, 1.0, b1) * (0.3 + 0.4 * frente) * (0.8 + uAmp * 0.7);
      col += cor2 * smoothstep(0.62, 1.0, b2) * (0.22 + 0.3 * frente) * (0.8 + uAmp * 0.7);
      col += mix(cor1, vec3(1.0), 0.5) * pow(1.0 - abs(b1), 18.0) * (0.45 + uAmp * 1.1);
      col += mix(cor2, vec3(1.0), 0.5) * pow(1.0 - abs(b2), 18.0) * (0.3 + uAmp * 0.9);
      // a borda do vidro e o brilho da luz
      float fres = pow(1.0 - frente, 2.6);
      col += mix(uC1, uC2, 0.5 + 0.5 * p.y) * fres * 0.9;
      vec3 luz = normalize(vec3(-0.5, 0.6, 0.8));
      float espec = pow(max(dot(reflect(-luz, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0);
      col += vec3(1.0) * espec * 0.9;
      col *= esfera;
    }
    col += mix(uC1, uC2, 0.5) * exp(-max(0.0, r - 1.0) * 14.0) * smoothstep(0.98, 1.01, r) * (0.3 + uAmp * 0.5);
    float alfa = max(clamp(maior(col), 0.0, 1.0), esfera * 0.95);
    gl_FragColor = vec4(min(col, vec3(1.0)), alfa);
  }
`;

const montar = montarShaderDeTela(FRAGMENTO);

export default function Orbe({ obterSinal, ocupacao = 0.78 }) {
  const montagem = useRef(null);
  usarVisual(montagem, obterSinal, { id: "orbe", ocupacao, montar });
  return <div ref={montagem} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />;
}
