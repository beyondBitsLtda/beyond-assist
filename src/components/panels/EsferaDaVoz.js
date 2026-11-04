"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * A voz da Lisa como uma esfera de pontos que se deforma com o som.
 *
 * `obterSinal()` é chamada A CADA QUADRO (não por render do React — a fala muda 60 vezes por
 * segundo) e devolve `{ estado, nivel }`:
 *   estado: "pronta" | "pensando" | "ouvindo" | "falando"
 *   nivel:  volume 0–1 medido (src/lib/vozAnalisador.js), ou null — aí o movimento é simulado
 *
 * Os pontos ficam numa esfera de Fibonacci (espalhados por igual, sem a costura dos polos), e o
 * shader os empurra para fora com ruído simplex 3D: devagar em repouso, forte e rápido falando.
 * A cor desliza entre as paletas de cada estado; a escala respira com o volume.
 *
 * Mais definição (01/11/2026, "consegue fazer ela ficar uma qualidade melhor?"): o dobro de pontos,
 * menores e macios (com um miolo claro, em vez do disco chapado); um tremor em cada ponto e uma
 * casca com espessura, que desfazem a espiral de Fibonacci que aparecia como "malha"; uma terceira
 * camada de ruído, fina, para a superfície ter detalhe; a borda acesa (luz de contorno), que dá
 * volume; e um brilho bem suave por dentro, atrás dos pontos.
 */
const PALETAS = {
  pronta: ["#7cc4ff", "#4a7dff", "#6a5cff"],
  pensando: ["#a9b8ff", "#6f6cff", "#9b5cff"],
  ouvindo: ["#7cf2dc", "#3fc8e0", "#3f8cff"],
  falando: ["#6ec3ff", "#8f7cff", "#ff7ad9"],
};

const VERTICE = `
  uniform float uTempo, uAmp, uTam, uAlfa;
  uniform vec3 uC1, uC2, uC3;
  attribute float aAcaso, aCasca;
  varying vec3 vCor;
  varying float vAlfa;
  vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + 2.0*C.xxx; vec3 x3 = x0 - 1.0 + 3.0*C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  void main(){
    vec3 n = normalize(position);
    float lento = snoise(n * 1.4 + vec3(0.0, uTempo * 0.22, uTempo * 0.12));
    float rapido = snoise(n * 3.1 - vec3(uTempo * 0.9));
    float fino = snoise(n * 7.5 + vec3(uTempo * 0.35, 0.0, -uTempo * 0.3));
    float desloca = lento * (0.14 + uAmp * 0.42) + rapido * (0.02 + uAmp * 0.2) + fino * (0.008 + uAmp * 0.05);
    vec3 p = n * (1.0 + desloca + aCasca * 0.014);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float frente = dot(normalize(normalMatrix * n), vec3(0.0, 0.0, 1.0));
    float borda = pow(1.0 - abs(frente), 3.0);
    gl_PointSize = uTam * (0.6 + aAcaso * 0.6) * (5.0 / -mv.z) * (1.0 + borda * 0.3);
    gl_Position = projectionMatrix * mv;
    float t = clamp(n.y * 0.5 + 0.5 + desloca * 0.6, 0.0, 1.0);
    vec3 cor = mix(mix(uC3, uC2, smoothstep(0.0, 0.55, t)), uC1, smoothstep(0.55, 1.0, t));
    // a crista da onda e a borda puxam para a cor clara
    vCor = mix(cor, uC1, clamp(borda * 0.55 + smoothstep(0.06, 0.3, desloca) * uAmp, 0.0, 1.0));
    float cintila = 0.82 + 0.18 * sin(uTempo * (1.2 + aAcaso * 2.5) + aAcaso * 60.0);
    vAlfa = (0.1 + 0.72 * smoothstep(-0.35, 0.9, frente) + borda * 0.5) * (0.85 + desloca * 0.6) * cintila * uAlfa;
  }
`;

const FRAGMENTO = `
  varying vec3 vCor;
  varying float vAlfa;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c);
    if (d2 > 0.25) discard;
    // ponto macio com um miolo mais claro (em vez do disco chapado)
    float halo = exp(-d2 * 11.0);
    float miolo = exp(-d2 * 70.0);
    gl_FragColor = vec4(vCor + miolo * 0.3, vAlfa * (halo * 0.85 + miolo * 0.5));
  }
`;

// o brilho por dentro: um disco de luz bem fraco atrás dos pontos, que dá corpo à esfera
const BRILHO_VERTICE = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const BRILHO_FRAGMENTO = `
  uniform float uAmp, uAlfa;
  uniform vec3 uC1, uC2;
  varying vec2 vUv;
  void main(){
    float r = length(vUv - 0.5) * 2.0;
    float a = exp(-r * r * 4.5) * (0.07 + uAmp * 0.12) * uAlfa;
    gl_FragColor = vec4(mix(uC2, uC1, 0.35), a);
  }
`;

export default function EsferaDaVoz({ obterSinal, ocupacao = 0.78 }) {
  const montagem = useRef(null);
  const sinalRef = useRef(obterSinal);
  sinalRef.current = obterSinal;

  useEffect(() => {
    const el = montagem.current;
    if (!el) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // sem WebGL: o espaço fica vazio, a conversa continua igual
    }
    const pixel = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(pixel);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);

    const estreita = window.innerWidth < 768;
    const N = estreita ? 12000 : 24000;
    const posicoes = new Float32Array(N * 3);
    const acaso = new Float32Array(N);
    const casca = new Float32Array(N);
    const ouro = Math.PI * (3 - Math.sqrt(5));
    // o tremor: meia distância entre vizinhos, para a espiral de Fibonacci não aparecer
    const tremor = Math.sqrt((4 * Math.PI) / N) * 0.5;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = ouro * i;
      const x = Math.cos(t) * r + (Math.random() - 0.5) * tremor;
      const yy = y + (Math.random() - 0.5) * tremor;
      const z = Math.sin(t) * r + (Math.random() - 0.5) * tremor;
      const tam = Math.hypot(x, yy, z) || 1;
      posicoes[i * 3] = x / tam;
      posicoes[i * 3 + 1] = yy / tam;
      posicoes[i * 3 + 2] = z / tam;
      acaso[i] = Math.random();
      casca[i] = (Math.random() + Math.random()) - 1; // -1..1, mais perto de 0
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
    geo.setAttribute("aAcaso", new THREE.BufferAttribute(acaso, 1));
    geo.setAttribute("aCasca", new THREE.BufferAttribute(casca, 1));

    const uniforms = {
      uTempo: { value: 0 },
      uAmp: { value: 0.1 },
      // com o dobro de pontos (somando luz), cada um brilha menos
      uAlfa: { value: estreita ? 1.15 : 1.05 },
      uTam: { value: 2.3 * pixel },
      uC1: { value: new THREE.Color(PALETAS.pronta[0]) },
      uC2: { value: new THREE.Color(PALETAS.pronta[1]) },
      uC3: { value: new THREE.Color(PALETAS.pronta[2]) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: VERTICE, fragmentShader: FRAGMENTO,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pontos = new THREE.Points(geo, material);
    const brilhoGeo = new THREE.PlaneGeometry(2.6, 2.6);
    const brilhoMaterial = new THREE.ShaderMaterial({
      uniforms, vertexShader: BRILHO_VERTICE, fragmentShader: BRILHO_FRAGMENTO,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const brilho = new THREE.Mesh(brilhoGeo, brilhoMaterial);
    brilho.renderOrder = -1;
    cena.add(brilho);
    cena.add(pontos);

    // A esfera ocupa `ocupacao` do lado MENOR da área: a câmera se afasta o quanto for preciso.
    const ajustar = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const metade = THREE.MathUtils.degToRad(camera.fov / 2);
      const alvoNaAltura = 1 / (Math.tan(metade) * ocupacao);
      const alvoNaLargura = 1 / (Math.tan(metade) * camera.aspect * ocupacao);
      camera.position.set(0, 0, Math.max(alvoNaAltura, alvoNaLargura) * 1.12);
      camera.updateProjectionMatrix();
      // o ponto cresce com a área: numa prévia pequena e na tela cheia, a esfera tem a mesma textura
      // (antes era fixo, e a esfera grande ficava rala)
      uniforms.uTam.value = (estreita ? 2.2 : 2.4) * pixel * THREE.MathUtils.clamp(Math.min(w, h) / 480, 0.75, 1.7);
    };
    const observador = new ResizeObserver(ajustar);
    observador.observe(el);
    ajustar();

    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const alvo = PALETAS.pronta.map((c) => new THREE.Color(c));
    let amp = 0.1;
    let antes = performance.now() / 1000;
    let silaba = 0;
    let proxima = 0;
    let quadro;

    const animar = (ms) => {
      const t = ms / 1000;
      const dt = Math.min(0.05, t - antes);
      antes = t;
      let sinal = { estado: "pronta", nivel: null };
      try { sinal = sinalRef.current?.() || sinal; } catch { /* o sinal nunca derruba a esfera */ }
      const estado = PALETAS[sinal.estado] ? sinal.estado : "pronta";

      let meta;
      if (typeof sinal.nivel === "number") {
        meta = 0.08 + sinal.nivel * 0.95;
      } else if (estado === "falando") {
        if (t > proxima) { silaba = Math.random() < 0.15 ? 0.05 : 0.35 + Math.random() * 0.65; proxima = t + 0.09 + Math.random() * 0.16; }
        meta = silaba;
      } else if (estado === "ouvindo") {
        meta = 0.18 + 0.12 * Math.max(0, Math.sin(t * 5.3) * Math.sin(t * 1.7));
      } else if (estado === "pensando") {
        meta = 0.14 + 0.08 * Math.sin(t * 2.6);
      } else {
        meta = 0.08 + 0.04 * Math.sin(t * 0.9);
      }
      amp += (meta - amp) * Math.min(1, dt * (meta > amp ? 14 : 5));

      PALETAS[estado].forEach((c, i) => alvo[i].set(c));
      uniforms.uC1.value.lerp(alvo[0], Math.min(1, dt * 2.5));
      uniforms.uC2.value.lerp(alvo[1], Math.min(1, dt * 2.5));
      uniforms.uC3.value.lerp(alvo[2], Math.min(1, dt * 2.5));
      uniforms.uAmp.value = reduzido ? amp * 0.4 : amp;
      uniforms.uTempo.value = reduzido ? t * 0.3 : t;
      const giro = estado === "pensando" ? 0.22 : 0.08;
      pontos.rotation.y += dt * giro;
      pontos.rotation.x = Math.sin(t * 0.13) * 0.18;
      pontos.scale.setScalar(1 + amp * 0.06);
      brilho.scale.setScalar(1 + amp * 0.1);
      renderer.render(cena, camera);
      quadro = requestAnimationFrame(animar);
    };
    quadro = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      geo.dispose();
      material.dispose();
      brilhoGeo.dispose();
      brilhoMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [ocupacao]);

  return <div ref={montagem} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />;
}
