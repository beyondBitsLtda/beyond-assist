"use client";

// O Rosto (01/11/2026, terceira versão): um retrato "térmico", no estilo da foto que a pessoa
// mandou. O busto (src/lib/rostoDaLisa.js) é desenhado por raymarching num retângulo de tela
// cheia: cada pixel lança um raio, acha a superfície e pinta pelo "calor" — a borda, que a câmera
// vê de lado, é quente (vermelho, laranja, creme); o meio do rosto, de frente, é frio (preto, que
// se funde ao fundo). Por fora, a menor distância do raio até o busto dá o halo branco-lilás →
// ciano. As orelhas e os ombros são quentes por natureza; um grão de filme anda por cima de tudo.
//
//   falando   a mandíbula abre com o volume e a boca e a garganta esquentam no ritmo da voz
//   ouvindo   as orelhas esquentam e pulsam com o que chega; a cabeça inclina
//   pensando  uma onda de calor sobe devagar pelo alto da cabeça
//   pronta    respira, balança devagar e segue o ponteiro do mouse
//
// Cabelo e cores (01/11/2026): cabelo longo ou raspado e a paleta (térmica ou outras cinco), que a
// pessoa escolhe no painel /visual ou no menu "Aparência da Lisa" (lerAjustesDoRosto); a troca
// desliza — o cabelo cresce ou some, as cores mudam devagar. O cabelo é mais frio que a pele por
// dentro e riscado de fios; a borda dele acende como o resto.
//
// A resolução segue a tela (resolucaoDoRosto: a densidade dela, até 1100 px no lado menor no
// computador e 820 no celular) e baixa sozinha se os quadros ficarem lentos. Mesmo contrato dos
// outros visuais: `obterSinal()` a cada quadro → { estado, nivel }.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { criarEnvelope, criarPesos } from "@/lib/visuaisDaLisa.js";
import {
  FORMA, CENTRO_Y, CAMERA, CAIXA, resolucaoDoRosto, criarMovimentoDoRosto, enquadramentoDoRosto,
  coresDoRosto, lerAjustesDoRosto, ajustesValidos, EVENTO_DO_ROSTO, CHAVE_DO_ROSTO,
} from "@/lib/rostoDaLisa.js";

const n = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));
const v3 = (a) => `vec3(${a.map(n).join(", ")})`;

const FRAGMENTO = `
  precision highp float;
  uniform vec2 uRes;
  uniform float uRaio, uCentroY;
  uniform float uOcup, uTempo, uGrao, uAquece, uBoca, uCalorBoca, uCalorOrelha, uOnda, uRespira, uCabelo, uDensidade;
  uniform mat3 uCabeca;
  uniform vec3 uC0, uC1, uC2, uC3;
  ${FORMA}

  float acaso(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float ruido(vec2 x){
    vec2 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(acaso(i), acaso(i + vec2(1.0, 0.0)), f.x), mix(acaso(i + vec2(0.0, 1.0)), acaso(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // os fios do cabelo: riscos compridos que descem da raiz (em volta da cabeça, ao longo da altura)
  float fiosEm(vec3 p){
    vec3 q = PIVO + uCabeca * (p - PIVO);
    vec3 h = noCabelo(p, q);
    float a = atan(h.x, h.z);
    return ruido(vec2(a * 14.0, h.y * 1.2)) * 0.6 + ruido(vec2(a * 44.0, h.y * 3.0)) * 0.4;
  }

  // a normal medida com um passo e: com passo largo, é a normal de uma superfície "borrada" — os
  // traços pequenos (órbitas, nariz, boca) só sugerem, como na foto
  vec3 normalEm(vec3 p, float e){
    const vec2 k = vec2(1.0, -1.0);
    float o, f;
    return normalize(k.xyy * forma(p + k.xyy * e, o, f) + k.yyx * forma(p + k.yyx * e, o, f)
      + k.yxy * forma(p + k.yxy * e, o, f) + k.xxx * forma(p + k.xxx * e, o, f));
  }

  // o calor em cor (na térmica: preto → vermelho escuro → laranja → creme → quase branco)
  vec3 rampa(float x){
    vec3 c = mix(vec3(0.0), uC0, smoothstep(0.2, 0.4, x));
    c = mix(c, uC2, smoothstep(0.36, 0.58, x));
    c = mix(c, uC1, smoothstep(0.54, 0.8, x));
    return mix(c, mix(uC1, vec3(1.0), 0.55), smoothstep(0.84, 1.06, x));
  }

  void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * min(uRes.x, uRes.y) * uOcup);
    // o enquadramento (enquadramentoDoRosto): a câmera acompanha o centro, um pouco acima dele
    vec3 ro = vec3(0.0, uCentroY + ${n(Number((CAMERA.y - CENTRO_Y).toFixed(4)))}, ${n(CAMERA.distancia)});
    vec3 rd = normalize(vec3(uv.x * uRaio, uCentroY + uv.y * uRaio, 0.0) - ro);
    // o grão: muda ~24 vezes por segundo, como um filme (parado com "reduzir movimento"); um grão
    // por pixel da tela (não do desenho), para ele não mudar de tamanho com a resolução
    vec2 celula = floor(gl_FragCoord.xy / max(uDensidade, 1.0));
    float grao = acaso(celula + fract(uGrao * 0.1271) * 517.0);
    float grao2 = acaso(celula.yx * 1.37 + fract(uGrao * 0.0731) * 311.0);

    // só marcha quem cruza a caixa do busto
    vec3 inv = 1.0 / (rd + vec3(1e-6));
    vec3 t0 = (${v3(CAIXA.min)} - ro) * inv, t1 = (${v3(CAIXA.max)} - ro) * inv;
    vec3 ta = min(t0, t1), tb = max(t0, t1);
    float entra = max(max(ta.x, ta.y), ta.z), sai = min(min(tb.x, tb.y), tb.z);

    vec3 cor = vec3(0.0);
    float dmin = 9.0, orelhaPerto = 9.0, fioPerto = 9.0, tPerto = 0.0; // a menor distância do raio ao busto (e às orelhas e ao cabelo, ali)
    float y = uCentroY + uv.y * uRaio;
    if (sai > entra) {
      float t = max(entra, 0.0), orelha = 9.0, fio = 9.0, d = 9.0;
      bool achou = false;
      for (int i = 0; i < 80; i++) {
        d = forma(ro + rd * t, orelha, fio);
        if (d < dmin) { dmin = d; orelhaPerto = orelha; fioPerto = fio; tPerto = t; }
        if (d < 0.0015) { achou = true; break; }
        t += d * 0.8;
        if (t > sai) break;
      }
      if (achou) {
        vec3 p = ro + rd * t;
        y = p.y;
        vec3 nn = normalEm(p, 0.07);
        vec3 q = PIVO + uCabeca * (p - PIVO);
        float frente = clamp(dot(nn, -rd), 0.0, 1.0);
        // a borda é quente: quanto mais de lado a câmera vê a superfície, mais calor (uma faixa larga
        // e macia, como na foto: o creme na silhueta, o laranja e o vermelho para dentro)
        float calor = 1.13 - 1.27 * frente;
        // as orelhas, finas, ficam quentes inteiras; esquentam mais ouvindo
        float naOrelha = smoothstep(0.07, 0.0, orelha);
        calor += naOrelha * (0.75 + uCalorOrelha * 0.45 * (0.85 + 0.15 * sin(uTempo * 9.0)));
        // o cabelo (as orelhas, na frente dele, continuam pele)
        float naCabelo = smoothstep(0.03, 0.0, fio) * smoothstep(0.0, 0.03, orelha) * step(0.01, uCabelo);
        // os ombros e o alto do peito são quentes; o meio, embaixo do pescoço, fica na sombra
        float ombro = smoothstep(-1.45, -1.95, p.y) * smoothstep(0.15, 0.7, abs(p.x) + (-1.5 - p.y) * 0.3);
        calor += ombro * 0.8 * (1.0 - naCabelo * 0.6);
        // o pescoço é morno (a garganta, de frente, continua mais escura que as laterais)
        calor += smoothstep(-0.95, -1.15, p.y) * smoothstep(-1.75, -1.45, p.y) * 0.1;
        // o meio do rosto, de frente, é frio; o nariz quase some (de lado, acenderia um risco)
        calor -= smoothstep(0.75, 0.97, frente) * 0.08 * step(-0.95, q.y);
        vec3 dn = (q - vec3(0.0, -0.4, 0.66)) * vec3(6.0, 2.8, 5.0);
        calor -= exp(-dot(dn, dn)) * 0.4;
        // falando: a boca e a garganta esquentam no ritmo da voz
        vec3 db = q - vec3(0.0, -0.73, 0.66);
        float boca = exp(-dot(db * vec3(0.8, 6.0, 1.0), db) * 22.0);
        float garganta = exp(-p.x * p.x * 14.0) * smoothstep(-0.95, -1.12, p.y) * smoothstep(-1.75, -1.4, p.y) * step(0.0, nn.z);
        calor += uCalorBoca * (boca * 0.75 + garganta * 0.55);
        // pensando: uma faixa de calor sobe pelo alto da cabeça, de baixo para cima, e recomeça
        float sobe = fract(uTempo * 0.28);
        float onda = exp(-pow((q.y - mix(-0.25, 1.15, sobe)) * 6.0, 2.0)) * smoothstep(-0.5, 0.2, q.y) * step(-0.95, q.y);
        calor += uOnda * onda * 0.5 * smoothstep(0.0, 0.15, sobe) * smoothstep(1.0, 0.8, sobe);
        // o cabelo é mais frio que a pele por dentro, riscado de fios; a borda dele acende igual
        if (naCabelo > 0.0) calor = mix(calor, calor * 0.72 + 0.2 + (fiosEm(p) - 0.5) * 0.8, naCabelo);
        // o grão mexe na fronteira das cores (o pontilhado da foto)
        calor += (grao - 0.5) * 0.12;
        cor = rampa(calor * uAquece);
      }
    }
    // o halo: fora do busto, quanto mais perto o raio passou, mais luz — branco-lilás colado na
    // borda, ciano um pouco mais longe, sumindo no preto
    if (dmin > 0.0015 && dmin < 1.0) {
      float perto = exp(-dmin * 16.0);
      vec3 lilas = mix(uC1, vec3(0.9, 0.84, 1.0), 0.6);
      vec3 h = mix(lilas, uC3, smoothstep(0.005, 0.04, dmin));
      // ouvindo, o halo em volta das orelhas acende e pulsa com o que chega
      float escuta = min(uCalorOrelha, 1.2) * smoothstep(0.08, 0.0, orelhaPerto - dmin) * (0.8 + 0.2 * sin(uTempo * 9.0));
      // em volta do cabelo, o halo sai em fios (a borda desfiada de um cabelo contra a luz)
      float desfia = 1.0;
      if (uCabelo > 0.01 && fioPerto - dmin < 0.03) desfia = mix(1.0, 0.45 + 1.1 * fiosEm(ro + rd * tPerto), smoothstep(0.03, 0.0, fioPerto - dmin));
      cor += h * (perto * 0.95 * desfia + exp(-dmin * 8.0) * 0.2 + escuta * exp(-dmin * 13.0) * 0.6) * uAquece * (0.85 + 0.3 * grao2);
    }
    // embaixo e dos lados, os ombros somem antes da borda da tela (e do círculo do visual, numa
    // área larga) — nunca um corte seco
    vec2 f = gl_FragCoord.xy / uRes;
    float r = length(vec2(uv.x, min(uv.y, 0.0)));
    cor *= smoothstep(0.0, 0.2, f.y) * smoothstep(0.0, 0.1, f.x) * smoothstep(1.0, 0.9, f.x) * smoothstep(1.32, 1.05, r);
    // o grão do filme por cima de tudo (e um pó leve no fundo, em volta do busto)
    cor *= 0.84 + 0.32 * grao;
    cor += mix(uC1, vec3(1.0), 0.3) * 0.9 * (grao2 * grao2) * 0.035 * smoothstep(1.25, 0.2, length(uv)) * uAquece;
    cor = min(cor, vec3(1.0));
    gl_FragColor = vec4(cor, max(cor.r, max(cor.g, cor.b)));
  }
`;

const VERTICE = "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }";

/**
 * `ajustes` ({ cabelo, paleta }) fixa o cabelo e as cores deste rosto; sem ele, vale o que a pessoa
 * escolheu neste navegador.
 */
export default function Rosto({ obterSinal, ocupacao = 0.78, ajustes: ajustesFixos = null, zoom = 1 }) {
  const montagem = useRef(null);
  const sinalRef = useRef(obterSinal);
  sinalRef.current = obterSinal;
  const fixosRef = useRef(ajustesFixos);
  fixosRef.current = ajustesFixos;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const el = montagem.current;
    if (!el) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
    } catch {
      return undefined; // sem WebGL: o espaço fica vazio, a conversa continua igual
    }
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });

    const cena = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    // o cabelo e as cores escolhidos (e a troca, na hora: nesta aba pelo evento, nas outras pelo storage)
    let escolhidos = lerAjustesDoRosto();
    const aoAjustar = (e) => { escolhidos = e?.detail || lerAjustesDoRosto(); };
    const aoGuardar = (e) => { if (e.key === CHAVE_DO_ROSTO) escolhidos = lerAjustesDoRosto(); };
    window.addEventListener(EVENTO_DO_ROSTO, aoAjustar);
    window.addEventListener("storage", aoGuardar);
    const ajustesAgora = () => (fixosRef.current ? ajustesValidos(fixosRef.current) : escolhidos);
    let ajustes = ajustesAgora();
    const c = coresDoRosto(ajustes.paleta, "pronta");
    const uniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uRaio: { value: enquadramentoDoRosto(zoom).raio },
      uCentroY: { value: enquadramentoDoRosto(zoom).centroY },
      uOcup: { value: ocupacao },
      uTempo: { value: 0 },
      uGrao: { value: 0 },
      uAquece: { value: 0 },
      uBoca: { value: 0 },
      uCalorBoca: { value: 0 },
      uCalorOrelha: { value: 0 },
      uOnda: { value: 0 },
      uRespira: { value: 0 },
      uCabelo: { value: ajustes.cabelo === "longo" ? 1 : 0 },
      uDensidade: { value: 1 },
      uCabeca: { value: new THREE.Matrix3() },
      uC0: { value: new THREE.Color(c[3]) },
      uC1: { value: new THREE.Color(c[0]) },
      uC2: { value: new THREE.Color(c[1]) },
      uC3: { value: new THREE.Color(c[2]) },
    };
    const geo = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: VERTICE, fragmentShader: FRAGMENTO,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.NoBlending,
    });
    const malha = new THREE.Mesh(geo, material);
    malha.frustumCulled = false;
    cena.add(malha);

    // a resolução de desenho: a da tela, com teto no lado menor; se os quadros ficarem lentos, o
    // teto baixa (o celular começa mais baixo: a tela é densa e a placa, menor)
    const celular = Boolean(window.matchMedia?.("(pointer: coarse)").matches);
    let limite = celular ? 820 : 1100;
    const tamanho = new THREE.Vector2();
    const ajustar = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setPixelRatio(resolucaoDoRosto(w, h, window.devicePixelRatio || 1, limite));
      renderer.setSize(w, h, false);
      renderer.getDrawingBufferSize(tamanho);
      uniforms.uRes.value.copy(tamanho);
      uniforms.uDensidade.value = renderer.getPixelRatio();
    };
    const observador = new ResizeObserver(ajustar);
    observador.observe(el);
    ajustar();

    const ponteiro = { x: 0, y: 0, quando: -99 };
    const aoMover = (e) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      ponteiro.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ponteiro.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      ponteiro.quando = performance.now() / 1000;
    };
    window.addEventListener("pointermove", aoMover, { passive: true });

    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const envelope = criarEnvelope();
    const pesos = criarPesos();
    const movimento = criarMovimentoDoRosto();
    const alvoCor = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
    const giro = new THREE.Euler();
    const giroM4 = new THREE.Matrix4();
    let inicio = -1;
    let antes = performance.now() / 1000;
    let lentos = 0; // quadros lentos seguidos (acima de ~30 ms)
    let quadro;

    const animar = (ms) => {
      const t = ms / 1000;
      const dt = Math.min(0.05, Math.max(0, t - antes));
      const gasto = t - antes;
      antes = t;
      if (inicio < 0) inicio = t;
      // aparelho que não dá conta: baixa a resolução de pouco em pouco (até 420 px no lado menor)
      lentos = gasto > 0.034 ? lentos + 1 : Math.max(0, lentos - 1);
      if (lentos > 45 && limite > 420) { limite = Math.max(420, Math.round(limite * 0.85)); lentos = 0; ajustar(); }

      let sinal = { estado: "pronta", nivel: null };
      try { sinal = sinalRef.current?.() || sinal; } catch { /* o sinal nunca derruba o rosto */ }
      const amp = envelope(sinal, t, dt);
      const p = pesos(sinal.estado, dt);
      ajustes = ajustesAgora();
      coresDoRosto(ajustes.paleta, sinal.estado).forEach((cor, i) => alvoCor[i].set(cor));
      const kc = Math.min(1, dt * 2.5);
      uniforms.uC1.value.lerp(alvoCor[0], kc);
      uniforms.uC2.value.lerp(alvoCor[1], kc);
      uniforms.uC3.value.lerp(alvoCor[2], kc);
      uniforms.uC0.value.lerp(alvoCor[3], kc);
      // o zoom desliza (chegar perto é um movimento de câmera, não um salto)
      const quadroAlvo = enquadramentoDoRosto(zoomRef.current);
      const kz = reduzido ? 1 : Math.min(1, dt * 2.5);
      uniforms.uRaio.value += (quadroAlvo.raio - uniforms.uRaio.value) * kz;
      uniforms.uCentroY.value += (quadroAlvo.centroY - uniforms.uCentroY.value) * kz;
      // o cabelo cresce ou some em pouco mais de um segundo
      const cabeloMeta = ajustes.cabelo === "longo" ? 1 : 0;
      const u = uniforms.uCabelo;
      u.value = reduzido ? cabeloMeta : u.value + (cabeloMeta - u.value) * Math.min(1, dt * 2.2);
      if (Math.abs(u.value - cabeloMeta) < 0.002) u.value = cabeloMeta;

      const mv = movimento({ pesos: p, amp: reduzido ? amp * 0.5 : amp, t, dt, ponteiro, reduzido });
      // a cabeça gira; o shader precisa do contrário (do mundo para a cabeça): a transposta
      giro.set(mv.pitch, mv.yaw, mv.roll);
      uniforms.uCabeca.value.setFromMatrix4(giroM4.makeRotationFromEuler(giro)).transpose();
      uniforms.uBoca.value = mv.boca;
      uniforms.uCalorBoca.value = mv.calorBoca;
      uniforms.uCalorOrelha.value = mv.calorOrelha;
      uniforms.uOnda.value = mv.onda;
      uniforms.uRespira.value = mv.respira;
      uniforms.uTempo.value = reduzido ? t * 0.4 : t;
      uniforms.uGrao.value = reduzido ? 0 : Math.floor(t * 24);
      // ao aparecer, o busto "esquenta" do preto até a cor, em pouco mais de um segundo
      uniforms.uAquece.value = reduzido ? 1 : Math.min(1, (t - inicio) / 1.3);
      renderer.render(cena, camera);
      quadro = requestAnimationFrame(animar);
    };
    quadro = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("pointermove", aoMover);
      window.removeEventListener(EVENTO_DO_ROSTO, aoAjustar);
      window.removeEventListener("storage", aoGuardar);
      geo.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [ocupacao]);

  return <div ref={montagem} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />;
}
