"use client";

// O Anel de partículas (referência 4 de 24/10/2026): milhares de pontos espalhados em volta de um
// anel — densos no meio, mais soltos para fora e para dentro —, do azul de um lado ao magenta do
// outro, cintilando. Com a voz, o anel ondula e se espalha; pensando, gira; ouvindo, respira.

import { useRef } from "react";
import { usarVisual, UNIFORMES } from "./motor.js";

const VERTICE = `
  attribute float aAngulo, aDesvio, aAcaso;
  varying vec3 vCor;
  varying float vAlfa;
  void main(){
    float t = uTempo;
    float ang = aAngulo + t * (0.06 + uPensando * 0.5);
    float onda = uAmp * (0.07 * sin(ang * 6.0 - t * 5.0) + 0.04 * sin(ang * 11.0 + t * 3.0));
    float respira = 0.015 * sin(t * 1.3) + uOuvindo * 0.02 * sin(t * 6.0 + ang * 3.0);
    float raio = 0.78 + respira + onda + aDesvio * (1.0 + uAmp * 1.6) + 0.01 * sin(t * 2.0 + aAcaso * 40.0);
    vec2 pos = vec2(cos(ang), sin(ang)) * raio;
    float m = min(uRes.x, uRes.y);
    gl_Position = vec4(pos.x * uOcup * m / uRes.x, pos.y * uOcup * m / uRes.y, 0.0, 1.0);
    // o ponto cresce com a área (numa prévia pequena e na tela cheia o anel tem a mesma densidade)
    float escala = clamp(m / (480.0 * uPixel), 0.6, 2.2);
    gl_PointSize = uPixel * escala * (1.3 + aAcaso * 2.0) * (0.85 + uAmp * 0.6);
    float lado = 0.5 + 0.5 * sin(aAngulo - 0.8);
    vCor = mix(mix(uC1, uC2, smoothstep(0.0, 0.6, lado)), uC3, smoothstep(0.55, 1.0, lado));
    float brilha = 0.6 + 0.4 * sin(t * (1.5 + aAcaso * 3.0) + aAcaso * 50.0);
    vAlfa = brilha * exp(-abs(aDesvio) * 8.0) * (0.95 + uAmp * 0.6);
  }
`;

const FRAGMENTO = `
  varying vec3 vCor;
  varying float vAlfa;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vCor, vAlfa * smoothstep(0.5, 0.1, d));
  }
`;

// uma normal (Box-Muller): os pontos se juntam perto do anel e rareiam para os lados
const normal = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

function montar({ THREE, cena, uniforms, estreita }) {
  const N = estreita ? 9000 : 20000;
  const angulo = new Float32Array(N);
  const desvio = new Float32Array(N);
  const acaso = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    angulo[i] = Math.random() * Math.PI * 2;
    desvio[i] = normal() * (Math.random() < 0.08 ? 0.2 : 0.055); // um pouco de "poeira" mais longe
    acaso[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3)); // o shader calcula a posição
  geo.setAttribute("aAngulo", new THREE.BufferAttribute(angulo, 1));
  geo.setAttribute("aDesvio", new THREE.BufferAttribute(desvio, 1));
  geo.setAttribute("aAcaso", new THREE.BufferAttribute(acaso, 1));
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: UNIFORMES + VERTICE, fragmentShader: FRAGMENTO,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const pontos = new THREE.Points(geo, material);
  pontos.frustumCulled = false;
  cena.add(pontos);
  return { liberar() { geo.dispose(); material.dispose(); } };
}

export default function Anel({ obterSinal, ocupacao = 0.78 }) {
  const montagem = useRef(null);
  usarVisual(montagem, obterSinal, { id: "anel", ocupacao, montar });
  return <div ref={montagem} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />;
}
