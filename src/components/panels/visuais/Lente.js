"use client";

// A Lente (referência 1 de 24/10/2026): um disco de vidro escuro com um aro grosso de arco-íris,
// anéis finos por dentro (cada canal de cor num raio um pouco diferente — a aberração cromática),
// a lente pequena no meio e um reflexo em crescente embaixo. Com a voz, os anéis pulsam para fora
// e o reflexo acende; pensando, um brilho gira pelo aro; ouvindo, os anéis respiram.

import { useRef } from "react";
import { usarVisual, montarShaderDeTela } from "./motor.js";

const FRAGMENTO = `
  void main(){
    vec2 p = coordenada();
    float r = length(p);
    float a = atan(p.y, p.x);
    float t = uTempo;
    float pulso = uAmp * 0.05 + uOuvindo * 0.012 * sin(t * 4.0);
    vec3 col = vec3(0.0);

    // o disco: vidro escuro, tingido de leve pela cor de fundo
    float disco = smoothstep(1.0, 0.985, r);
    col += disco * (vec3(0.012, 0.01, 0.02) + uC3 * 0.06 * smoothstep(0.95, 0.15, r));

    // o aro: grosso, com aberração cromática, quente de um lado e frio do outro
    float d = 0.007 + uAmp * 0.006;
    vec3 aro = vec3(anel(r, 0.985 + pulso + d, 0.012), anel(r, 0.985 + pulso, 0.012), anel(r, 0.985 + pulso - d, 0.012));
    vec3 tinta = mix(uC1, uC2, smoothstep(0.2, 1.0, sin(a + 0.6) * 0.5 + 0.5));
    col += aro * mix(vec3(1.0), tinta, 0.55) * (1.1 + uAmp * 0.8);

    // os anéis finos de dentro, mais fortes embaixo
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float R = 0.93 - fi * 0.045 + pulso * (1.0 - fi * 0.2);
      float w = 0.004 + 0.002 * fi;
      vec3 fino = vec3(anel(r, R + d * 0.6, w), anel(r, R, w), anel(r, R - d * 0.6, w));
      float faixa = 0.35 + 0.65 * smoothstep(-0.2, 0.9, -sin(a));
      col += fino * (0.25 - fi * 0.04) * faixa * mix(vec3(1.0), uC2, 0.3);
    }

    // a lente pequena do meio: um aro azulado e o miolo bem escuro
    float rm = 0.3 + pulso * 0.5;
    col += vec3(anel(r, rm + 0.004, 0.005), anel(r, rm, 0.005), anel(r, rm - 0.004, 0.005)) * mix(vec3(0.6, 0.7, 1.0), uC3, 0.4) * 0.9;
    col *= mix(1.0, 0.35, smoothstep(rm, rm - 0.06, r));

    // o reflexo em crescente na metade de baixo, que acende com a voz
    float cres = smoothstep(0.62, 0.48, length(p - vec2(0.0, -0.06))) * smoothstep(0.32, 0.42, length(p - vec2(0.0, 0.14)));
    cres *= smoothstep(0.05, -0.35, p.y);
    col += cres * mix(vec3(1.0), uC3, 0.25) * (0.35 + uAmp * 0.9 + uFalando * 0.15);
    float beira = anel(length(p - vec2(0.0, -0.06)), 0.55, 0.02) * smoothstep(0.0, -0.4, p.y);
    col += beira * vec3(0.3, 0.5, 1.0) * 0.5;

    // pensando: um brilho que gira pelo aro
    float giro = pow(0.5 + 0.5 * cos(a - t * 2.4), 24.0) * anel(r, 0.985, 0.03);
    col += giro * mix(vec3(1.0), uC2, 0.4) * (uPensando * 1.4 + 0.15);

    // o pontinho de luz em cima e o halo fora do disco
    col += anel(length(p - vec2(0.0, 0.58)), 0.0, 0.03) * mix(uC2, uC1, 0.5) * 0.6;
    col += tinta * exp(-max(0.0, r - 1.0) * 18.0) * smoothstep(0.97, 1.02, r) * (0.25 + uAmp * 0.4);

    float alfa = max(clamp(maior(col), 0.0, 1.0), disco * 0.92);
    gl_FragColor = vec4(min(col, vec3(1.0)), alfa);
  }
`;

const montar = montarShaderDeTela(FRAGMENTO);

export default function Lente({ obterSinal, ocupacao = 0.78 }) {
  const montagem = useRef(null);
  usarVisual(montagem, obterSinal, { id: "lente", ocupacao, montar });
  return <div ref={montagem} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />;
}
