"use client";

// O Rosto (01/11/2026): os pontos da Esfera pousados num rosto (src/lib/rostoDaLisa.js) que reage
// à conversa. Falando, o queixo abre com o volume da voz, o lábio de cima acompanha e as
// sobrancelhas marcam as sílabas fortes; ouvindo, ela inclina a cabeça, ergue as sobrancelhas,
// olha para a frente e às vezes acena ("hum-hum"); pensando, olha para cima, de lado; parada,
// respira, pisca, passeia o olhar e segue o ponteiro do mouse com os olhos e um pouco com a cabeça.
//
// Mesmo contrato dos outros visuais: `obterSinal()` a cada quadro → { estado, nivel }, e as cores
// do catálogo (coresDe("rosto", estado)). Câmera em perspectiva, como a Esfera.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { coresDe, criarEnvelope, criarPesos } from "@/lib/visuaisDaLisa.js";
import { pontosDoRosto, OLHO, DOBRADICA } from "@/lib/rostoDaLisa.js";

const VERTICE = `
  uniform float uTempo, uAmp, uTam, uAlfa, uBoca, uPisca, uSobrancelha, uSorriso;
  uniform vec2 uOlhar;
  uniform vec3 uC1, uC2, uC3;
  attribute float aAcaso, aRelevo, aMandibula, aLabio, aCanto, aPalpebra, aSobrancelha, aOlho;
  attribute vec2 aIris;
  varying vec3 vCor;
  varying float vAlfa;
  mat3 giroX(float a){ float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  void main(){
    vec3 p = position;
    vec3 n = normal;
    // o queixo gira na dobradiça perto das orelhas; o lábio de baixo vai junto (peso 1)
    vec3 eixo = vec3(0.0, ${DOBRADICA.y.toFixed(3)}, ${DOBRADICA.z.toFixed(3)});
    float ang = uBoca * 0.2 * aMandibula;
    p = eixo + giroX(ang) * (p - eixo);
    n = giroX(ang) * n;
    p.y += uBoca * 0.014 * aLabio;
    p.y += uSorriso * 0.024 * aCanto;
    p.x += sign(p.x) * uSorriso * 0.012 * aCanto;
    p.y += uSobrancelha * 0.045 * aSobrancelha;
    p.y -= uPisca * 0.085 * aPalpebra;
    // piscar: o olho achata na linha do meio
    p.y = mix(p.y, ${OLHO.y.toFixed(3)} + (p.y - ${OLHO.y.toFixed(3)}) * (1.0 - uPisca * 0.94), aOlho);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 nv = normalize(normalMatrix * n);
    vec3 ver = normalize(-mv.xyz);
    float frente = dot(nv, ver);
    float luz = max(dot(nv, normalize(vec3(-0.35, 0.45, 0.82))), 0.0);
    float borda = pow(1.0 - clamp(frente, 0.0, 1.0), 2.4);
    gl_PointSize = uTam * (0.6 + aAcaso * 0.6) * (5.0 / -mv.z);
    gl_Position = projectionMatrix * mv;

    float h = clamp((position.y + 1.1) / 2.1, 0.0, 1.0);
    vec3 cor = mix(mix(uC3, uC2, smoothstep(0.0, 0.55, h)), uC1, smoothstep(0.55, 1.0, h));
    // as cristas (nariz, lábios, sobrancelhas) acendem e clareiam; as dobras (boca, órbitas) apagam
    cor = mix(cor, uC1, clamp(borda * 0.7 + max(aRelevo, 0.0) * 0.6, 0.0, 1.0));
    float alfa = (0.05 + 0.8 * pow(luz, 1.4) + 0.7 * borda) * smoothstep(-0.08, 0.22, frente);
    alfa *= clamp(1.0 + aRelevo * 1.1, 0.08, 2.2);
    alfa *= smoothstep(-1.2, -0.82, position.y); // o pescoço some embaixo
    // a boca acende um pouco com a voz
    alfa *= 1.0 + (aLabio + aMandibula * step(0.9, aMandibula)) * uAmp * 0.6;

    // o olho: íris e pupila no lugar para onde ela olha, um brilho fixo, e some piscando
    if (aOlho > 0.5) {
      vec2 o = aIris - uOlhar * 0.42;
      float r = length(o);
      float iris = smoothstep(0.62, 0.52, r) * smoothstep(0.2, 0.3, r);
      float pupila = smoothstep(0.26, 0.18, r);
      float reflexo = smoothstep(0.16, 0.05, length(aIris - vec2(-0.22, 0.26)));
      cor = mix(cor * 0.6, mix(uC1, vec3(1.0), 0.25), iris);
      cor = mix(cor, vec3(1.0), reflexo);
      alfa = (0.25 + iris * 1.1 + reflexo * 1.6) * (1.0 - pupila * 0.85) * (1.0 - uPisca * 0.9);
    }
    float cintila = 0.85 + 0.15 * sin(uTempo * (1.0 + aAcaso * 2.2) + aAcaso * 47.0);
    vCor = cor;
    vAlfa = alfa * cintila * uAlfa;
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
    float halo = exp(-d2 * 16.0);
    float miolo = exp(-d2 * 90.0);
    gl_FragColor = vec4(vCor + miolo * 0.35, vAlfa * (halo * 0.8 + miolo * 0.45));
  }
`;

// a geometria sai uma vez por tamanho (gerar 30 mil pontos leva ~0,2s)
const geometrias = new Map();
function dadosDoRosto(n) {
  if (!geometrias.has(n)) geometrias.set(n, pontosDoRosto(n));
  return geometrias.get(n);
}

const RAIO = 1.22; // o rosto cabe num círculo deste raio, centrado em CENTRO_Y
const CENTRO_Y = -0.14;

export default function Rosto({ obterSinal, ocupacao = 0.78 }) {
  const montagem = useRef(null);
  const sinalRef = useRef(obterSinal);
  sinalRef.current = obterSinal;

  useEffect(() => {
    const el = montagem.current;
    if (!el) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return undefined; // sem WebGL: o espaço fica vazio, a conversa continua igual
    }
    const pixel = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(pixel);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const estreita = window.innerWidth < 768;
    const dados = dadosDoRosto(estreita ? 14000 : 30000);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(dados.posicoes, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(dados.normais, 3));
    geo.setAttribute("aIris", new THREE.BufferAttribute(dados.iris, 2));
    geo.setAttribute("aAcaso", new THREE.BufferAttribute(dados.acaso, 1));
    geo.setAttribute("aRelevo", new THREE.BufferAttribute(dados.relevo, 1));
    geo.setAttribute("aMandibula", new THREE.BufferAttribute(dados.mandibula, 1));
    geo.setAttribute("aLabio", new THREE.BufferAttribute(dados.labio, 1));
    geo.setAttribute("aCanto", new THREE.BufferAttribute(dados.canto, 1));
    geo.setAttribute("aPalpebra", new THREE.BufferAttribute(dados.palpebra, 1));
    geo.setAttribute("aSobrancelha", new THREE.BufferAttribute(dados.sobrancelha, 1));
    geo.setAttribute("aOlho", new THREE.BufferAttribute(dados.olho, 1));

    const c = coresDe("rosto", "pronta");
    const uniforms = {
      uTempo: { value: 0 },
      uAmp: { value: 0.1 },
      uTam: { value: 2.2 * pixel },
      uAlfa: { value: estreita ? 1.4 : 1.25 },
      uBoca: { value: 0 },
      uPisca: { value: 0 },
      uSobrancelha: { value: 0 },
      uSorriso: { value: 0.3 },
      uOlhar: { value: new THREE.Vector2(0, 0) },
      uC1: { value: new THREE.Color(c[0]) },
      uC2: { value: new THREE.Color(c[1]) },
      uC3: { value: new THREE.Color(c[2]) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: VERTICE, fragmentShader: FRAGMENTO,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const pontos = new THREE.Points(geo, material);
    pontos.frustumCulled = false;
    // a cabeça gira em volta do próprio centro (o pescoço), não da origem
    const cabeca = new THREE.Group();
    cabeca.position.y = -CENTRO_Y;
    pontos.position.y = 0;
    cabeca.add(pontos);
    cena.add(cabeca);

    // o rosto ocupa `ocupacao` do lado menor da área, como a Esfera
    const ajustar = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const metade = THREE.MathUtils.degToRad(camera.fov / 2);
      const alvoNaAltura = RAIO / (Math.tan(metade) * ocupacao);
      const alvoNaLargura = RAIO / (Math.tan(metade) * camera.aspect * ocupacao);
      camera.position.set(0, 0, Math.max(alvoNaAltura, alvoNaLargura));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      // o ponto acompanha o tamanho do rosto na tela (numa prévia pequena não vira borrão)
      const lado = Math.min(w, h);
      uniforms.uTam.value = pixel * THREE.MathUtils.clamp(lado / 420, 0.7, 1.8) * (estreita ? 2.8 : 2.5);
    };
    const observador = new ResizeObserver(ajustar);
    observador.observe(el);
    ajustar();

    // o ponteiro do mouse: os olhos (e um pouco a cabeça) seguem quando ela está parada ou ouvindo
    const ponteiro = { x: 0, y: 0, quando: -99 };
    const aoMover = (e) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      ponteiro.x = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.5, 1.5);
      ponteiro.y = THREE.MathUtils.clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1.5, 1.5);
      ponteiro.quando = performance.now() / 1000;
    };
    window.addEventListener("pointermove", aoMover, { passive: true });

    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const envelope = criarEnvelope();
    const pesos = criarPesos();
    const alvoCor = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
    const suave = (atual, meta, dt, rapidez) => atual + (meta - atual) * Math.min(1, dt * rapidez);
    const m = {
      boca: 0, pisca: 0, sobr: 0, sorriso: 0.3, olharX: 0, olharY: 0,
      yaw: 0, pitch: 0, roll: 0, acena: 0,
    };
    let proximaPiscada = 1.5;
    let piscando = -1; // início da piscada em curso
    let piscarDeNovo = false;
    let proximoOlhar = 0.8;
    let olharAlvo = [0, 0];
    let proximoAceno = 3;
    let antes = performance.now() / 1000;
    let quadro;

    const animar = (ms) => {
      const t = ms / 1000;
      const dt = Math.min(0.05, Math.max(0, t - antes));
      antes = t;
      let sinal = { estado: "pronta", nivel: null };
      try { sinal = sinalRef.current?.() || sinal; } catch { /* o sinal nunca derruba o rosto */ }
      const amp = envelope(sinal, t, dt);
      const p = pesos(sinal.estado, dt);
      coresDe("rosto", sinal.estado).forEach((cor, i) => alvoCor[i].set(cor));
      const kc = Math.min(1, dt * 2.5);
      uniforms.uC1.value.lerp(alvoCor[0], kc);
      uniforms.uC2.value.lerp(alvoCor[1], kc);
      uniforms.uC3.value.lerp(alvoCor[2], kc);

      // a boca: abre com o volume quando ela fala (o envelope já sobe rápido e desce devagar)
      const bocaMeta = p.falando * THREE.MathUtils.clamp((amp - 0.1) * 1.5, 0, 1);
      m.boca = suave(m.boca, bocaMeta, dt, bocaMeta > m.boca ? 22 : 12);

      // piscar: a cada 2,5–6s, às vezes duas seguidas; 0,16s cada
      if (piscando < 0 && t > proximaPiscada) { piscando = t; piscarDeNovo = Math.random() < 0.2; }
      if (piscando >= 0) {
        const f = Math.max(0, (t - piscando) / 0.16); // a segunda piscada começa um instante depois
        m.pisca = f < 0.5 ? f * 2 : Math.max(0, 2 - f * 2);
        if (f >= 1) {
          piscando = piscarDeNovo ? t + 0.08 : -1;
          if (piscarDeNovo) piscarDeNovo = false;
          else proximaPiscada = t + 2.5 + Math.random() * 3.5;
        }
      }

      // o olhar: passeia (sacadas) parada e falando; ouvindo, olha para quem fala; pensando, para cima
      const ponteiroVivo = t - ponteiro.quando < 4;
      if (t > proximoOlhar) {
        olharAlvo = [(Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.4];
        proximoOlhar = t + 0.9 + Math.random() * 2.2;
      }
      let ox = olharAlvo[0] * (p.pronta + p.falando * 0.5);
      let oy = olharAlvo[1] * (p.pronta + p.falando * 0.5);
      if (ponteiroVivo) {
        const seguir = p.pronta + p.ouvindo;
        ox = ox * (1 - seguir) + ponteiro.x * 0.8 * seguir;
        oy = oy * (1 - seguir) + ponteiro.y * 0.7 * seguir;
      }
      ox += p.pensando * 0.55;
      oy += p.pensando * 0.75;
      m.olharX = suave(m.olharX, THREE.MathUtils.clamp(ox, -1, 1), dt, 18);
      m.olharY = suave(m.olharY, THREE.MathUtils.clamp(oy, -1, 1), dt, 18);

      // sobrancelhas: sobem ouvindo, um pouco pensando, e marcam as sílabas fortes falando
      const sobrMeta = p.ouvindo * 0.75 + p.pensando * 0.35 + p.falando * THREE.MathUtils.clamp((amp - 0.45) * 1.6, 0, 0.7);
      m.sobr = suave(m.sobr, sobrMeta, dt, 6);
      m.sorriso = suave(m.sorriso, p.pronta * 0.45 + p.ouvindo * 0.3 + p.falando * 0.2, dt, 2);

      // a cabeça: respira e balança parada; inclina ouvindo (e acena de vez em quando); olha para
      // cima pensando; acompanha a fala com pequenos movimentos
      if (sinal.estado === "ouvindo" && t > proximoAceno) { m.acena = 1; proximoAceno = t + 3 + Math.random() * 3; }
      m.acena = Math.max(0, m.acena - dt * 1.6);
      const aceno = Math.sin((1 - m.acena) * Math.PI * 2) * m.acena * 0.07;
      const ponteiroCabeca = ponteiroVivo ? (p.pronta + p.ouvindo) : 0;
      const yawMeta = Math.sin(t * 0.31) * 0.12 * (p.pronta + p.falando * 0.6) + p.pensando * (0.22 + Math.sin(t * 0.4) * 0.08)
        + ponteiroCabeca * ponteiro.x * 0.22 + p.falando * Math.sin(t * 1.7) * amp * 0.06;
      const pitchMeta = Math.sin(t * 0.23) * 0.04 - p.pensando * 0.14 - ponteiroCabeca * ponteiro.y * 0.12
        + p.falando * Math.sin(t * 3.1) * amp * 0.05 + aceno + p.ouvindo * 0.04;
      const rollMeta = p.ouvindo * 0.11 + Math.sin(t * 0.19) * 0.025 + p.pensando * -0.05;
      m.yaw = suave(m.yaw, yawMeta, dt, 3);
      m.pitch = suave(m.pitch, pitchMeta, dt, 4);
      m.roll = suave(m.roll, rollMeta, dt, 2.5);
      const calma = reduzido ? 0.35 : 1;
      cabeca.rotation.set(m.pitch * calma, m.yaw * calma, m.roll * calma);
      cabeca.position.y = -CENTRO_Y + Math.sin(t * 1.1) * 0.008 * calma; // respiração
      cabeca.scale.setScalar(1 + p.ouvindo * 0.025);

      uniforms.uTempo.value = reduzido ? t * 0.3 : t;
      uniforms.uAmp.value = reduzido ? amp * 0.4 : amp;
      uniforms.uBoca.value = m.boca;
      uniforms.uPisca.value = m.pisca;
      uniforms.uSobrancelha.value = m.sobr;
      uniforms.uSorriso.value = m.sorriso;
      uniforms.uOlhar.value.set(m.olharX, m.olharY);
      renderer.render(cena, camera);
      quadro = requestAnimationFrame(animar);
    };
    quadro = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("pointermove", aoMover);
      geo.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [ocupacao]);

  return <div ref={montagem} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />;
}
