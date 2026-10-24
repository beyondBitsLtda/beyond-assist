"use client";

// O motor comum dos visuais da Lisa em WebGL (src/lib/visuaisDaLisa.js tem o catálogo): o
// renderizador transparente, o tamanho, o laço de quadros com o envelope da voz e as cores do
// estado deslizando. Quem usa só diz o que desenhar.
//
// Todo desenho trabalha no "espaço da Lisa": o círculo de raio 1 é o visual inteiro, e ele ocupa
// `ocupacao` do lado menor da área (o mesmo enquadramento da Esfera de pontos).

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { coresDe, criarEnvelope, criarPesos } from "@/lib/visuaisDaLisa.js";

/**
 * Liga um visual a uma <div>: `montar({ THREE, cena, uniforms, estreita, pixel })` cria o desenho
 * e devolve { quadro?(t, dt, amp, estado), liberar() }. `obterSinal()` é chamada a cada quadro e
 * devolve { estado, nivel } (o mesmo contrato da EsferaDaVoz).
 */
export function usarVisual(montagem, obterSinal, { id, ocupacao = 0.78, montar }) {
  const sinalRef = useRef(obterSinal);
  sinalRef.current = obterSinal;

  useEffect(() => {
    const el = montagem.current;
    if (!el) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
    } catch {
      return undefined; // sem WebGL: o espaço fica vazio, a conversa continua igual
    }
    const pixel = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(pixel);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });

    const cena = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10); // os desenhos já saem em coordenadas de tela
    const estreita = window.innerWidth < 768;
    const c = coresDe(id, "pronta");
    const uniforms = {
      uTempo: { value: 0 },
      uAmp: { value: 0.1 },
      uOcup: { value: ocupacao },
      uRes: { value: new THREE.Vector2(1, 1) },
      uPixel: { value: pixel },
      uC1: { value: new THREE.Color(c[0]) },
      uC2: { value: new THREE.Color(c[1]) },
      uC3: { value: new THREE.Color(c[2]) },
      uPronta: { value: 1 },
      uOuvindo: { value: 0 },
      uPensando: { value: 0 },
      uFalando: { value: 0 },
    };
    const desenho = montar({ THREE, cena, uniforms, estreita, pixel });

    const ajustar = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w * pixel, h * pixel);
    };
    const observador = new ResizeObserver(ajustar);
    observador.observe(el);
    ajustar();

    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const envelope = criarEnvelope();
    const pesos = criarPesos();
    const alvo = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
    let antes = performance.now() / 1000;
    let quadro;

    const animar = (ms) => {
      const t = ms / 1000;
      const dt = Math.min(0.05, Math.max(0, t - antes));
      antes = t;
      let sinal = { estado: "pronta", nivel: null };
      try { sinal = sinalRef.current?.() || sinal; } catch { /* o sinal nunca derruba o visual */ }
      const amp = envelope(sinal, t, dt);
      const p = pesos(sinal.estado, dt);
      coresDe(id, sinal.estado).forEach((cor, i) => alvo[i].set(cor));
      const k = Math.min(1, dt * 2.5);
      uniforms.uC1.value.lerp(alvo[0], k);
      uniforms.uC2.value.lerp(alvo[1], k);
      uniforms.uC3.value.lerp(alvo[2], k);
      uniforms.uAmp.value = reduzido ? amp * 0.4 : amp;
      uniforms.uTempo.value = reduzido ? t * 0.3 : t;
      uniforms.uPronta.value = p.pronta;
      uniforms.uOuvindo.value = p.ouvindo;
      uniforms.uPensando.value = p.pensando;
      uniforms.uFalando.value = p.falando;
      desenho.quadro?.(t, dt, amp, sinal.estado);
      renderer.render(cena, camera);
      quadro = requestAnimationFrame(animar);
    };
    quadro = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      desenho.liberar?.();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [id, ocupacao]);
}

/** O que todo shader dos visuais recebe (vale no de vértice e no de pixel). */
export const UNIFORMES = `
  uniform vec2 uRes;
  uniform float uTempo, uAmp, uOcup, uPixel, uPronta, uOuvindo, uPensando, uFalando;
  uniform vec3 uC1, uC2, uC3;
`;

/** Para os shaders de pixel: os uniformes e umas contas de uso comum. */
export const CABECALHO = `${UNIFORMES}
  // o pixel no espaço da Lisa: o círculo de raio 1 é o visual inteiro
  vec2 coordenada(){ return (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * min(uRes.x, uRes.y) * uOcup); }
  // um anel suave de raio \`raio\` (1 em cima dele, caindo para os lados)
  float anel(float r, float raio, float largura){ float d = (r - raio) / largura; return exp(-d * d); }
  float maior(vec3 c){ return max(c.r, max(c.g, c.b)); }
`;

const VERTICE_DE_TELA = "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }";

/**
 * Um desenho de tela cheia: um retângulo cobrindo a área e um fragment shader que pinta cada
 * pixel. O shader escreve a cor JÁ multiplicada pela opacidade (sem mistura), que é o que a tela
 * transparente espera.
 */
export function montarShaderDeTela(fragmento) {
  return ({ THREE, cena, uniforms }) => {
    const geo = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: VERTICE_DE_TELA, fragmentShader: CABECALHO + fragmento,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.NoBlending,
    });
    const malha = new THREE.Mesh(geo, material);
    malha.frustumCulled = false;
    cena.add(malha);
    return { liberar() { geo.dispose(); material.dispose(); } };
  };
}
