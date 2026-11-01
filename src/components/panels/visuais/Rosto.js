"use client";

// O Rosto (01/11/2026): um busto holográfico feito de linhas de pontos de luz que contornam o rosto
// (src/lib/rostoDaLisa.js), no estilo da referência que a pessoa mandou — azul elétrico, brilho
// forte, a nuca e o lado direito se desfazendo em partículas — e que reage à conversa:
//
//   falando   o queixo abre com o volume da voz, o lábio de cima acompanha, as sobrancelhas marcam
//             as sílabas fortes, a cabeça acompanha a fala e solta mais partículas
//   ouvindo   inclina a cabeça, ergue as sobrancelhas, olha para a frente e às vezes acena
//   pensando  olha para cima, de lado
//   pronta    respira, pisca, passeia o olhar e segue o ponteiro do mouse com os olhos e a cabeça
//
// De vez em quando uma faixa de linhas escorrega para o lado, como num holograma com interferência
// (mais vezes falando; nunca com "reduzir movimento"). A cabeça gira sobre o pescoço; os ombros
// ficam. Duas passadas dos mesmos pontos: uma larga e fraca (o brilho) e uma fina (as linhas).
//
// Mesmo contrato dos outros visuais: `obterSinal()` a cada quadro → { estado, nivel }, e as cores
// do catálogo (coresDe("rosto", estado)). Câmera em perspectiva, como a Esfera.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { coresDe, criarEnvelope, criarPesos } from "@/lib/visuaisDaLisa.js";
import { gerarPontosDoRosto, OLHO, DOBRADICA, PIVO_DA_CABECA, CORTE_Y, TOPO_Y } from "@/lib/rostoDaLisa.js";

const RUIDO = `
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
`;

const f3 = (v) => v.toFixed(3);

const VERTICE = `
  uniform float uTempo, uAmp, uTam, uAlfa, uBoca, uPisca, uSobrancelha, uSorriso, uSolta, uRevela;
  uniform float uFalhaY, uFalhaAltura, uFalhaX;
  uniform vec2 uOlhar;
  uniform mat3 uCabeca;
  uniform vec3 uC1, uC2, uC3;
  attribute float aAcaso, aRelevo, aMandibula, aLabio, aCanto, aPalpebra, aSobrancelha, aOlho, aCabeca, aCabelo;
  attribute vec2 aIris;
  varying vec3 vCor;
  varying float vAlfa;
  ${RUIDO}
  mat3 giroX(float a){ float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  void main(){
    vec3 p = position;
    vec3 n = normal;
    // o rosto: o queixo gira na dobradiça perto das orelhas (o lábio de baixo vai junto), o lábio de
    // cima sobe, os cantos sorriem, as sobrancelhas sobem, a pálpebra desce e o olho achata piscando
    vec3 eixo = vec3(0.0, ${f3(DOBRADICA.y)}, ${f3(DOBRADICA.z)});
    float ang = uBoca * 0.2 * aMandibula;
    p = eixo + giroX(ang) * (p - eixo);
    n = giroX(ang) * n;
    p.y += uBoca * 0.014 * aLabio;
    p.y += uSorriso * 0.024 * aCanto;
    p.x += sign(p.x) * uSorriso * 0.012 * aCanto;
    p.y += uSobrancelha * 0.045 * aSobrancelha;
    p.y -= uPisca * 0.085 * aPalpebra;
    p.y = mix(p.y, ${f3(OLHO.y)} + (p.y - ${f3(OLHO.y)}) * (1.0 - uPisca * 0.94), aOlho);
    // o cabelo: as linhas ondulam como fios e balançam devagar
    float fio = snoise(vec3(position.x * 3.0, position.y * 11.0, position.z * 3.0) + vec3(uTempo * 0.25, 0.0, uTempo * 0.1));
    p += normal * aCabelo * (0.022 + 0.018 * fio) * (0.6 + 0.4 * fio);

    // a cabeça gira sobre o pescoço; os ombros ficam
    vec3 pivo = vec3(0.0, ${f3(PIVO_DA_CABECA.y)}, ${f3(PIVO_DA_CABECA.z)});
    vec3 rel = p - pivo;
    p = pivo + mix(rel, uCabeca * rel, aCabeca);
    n = normalize(mix(n, uCabeca * n, aCabeca));

    // interferência: uma faixa de linhas escorrega para o lado
    p.x += (1.0 - step(uFalhaAltura, abs(position.y - uFalhaY))) * uFalhaX;

    // a nuca e o lado direito se desfazem: cada ponto solto viaja para longe, some e volta
    float campo = position.x * 1.05 - position.z * 0.55 + 0.3 * snoise(position * 2.3 + vec3(0.0, uTempo * 0.12, 0.0));
    float solta = smoothstep(0.6, 1.2, campo + uSolta) * step(-1.5, position.y);
    float ciclo = fract(uTempo * (0.04 + aAcaso * 0.07) + aAcaso * 7.31);
    vec3 deriva = normalize(vec3(1.0, 0.35 * (fract(aAcaso * 17.0) - 0.4), -0.25 + 0.6 * fract(aAcaso * 29.0)));
    p += deriva * solta * ciclo * (0.35 + 0.9 * fract(aAcaso * 5.0));
    p.xy += vec2(snoise(position * 6.0 + uTempo * 0.5), snoise(position * 6.0 - uTempo * 0.4)) * 0.02 * solta;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 nv = normalize(normalMatrix * n);
    vec3 ver = normalize(-mv.xyz);
    float frente = dot(nv, ver);
    float luz = max(dot(nv, normalize(vec3(-0.35, 0.45, 0.82))), 0.0);
    float borda = pow(1.0 - clamp(frente, 0.0, 1.0), 2.2);
    gl_PointSize = uTam * (0.75 + aAcaso * 0.5) * (5.0 / -mv.z) * (1.0 - solta * ciclo * 0.35);
    gl_Position = projectionMatrix * mv;

    // azul fundo na sombra, o tom do meio na luz, quase branco no brilho, nas cristas e na borda
    vec3 cor = mix(uC3, uC2, smoothstep(0.0, 0.55, luz));
    cor = mix(cor, uC1, clamp(pow(luz, 2.0) * 0.75 + borda * 0.5 + max(aRelevo, 0.0) * 0.55, 0.0, 1.0));
    float visivel = mix(smoothstep(-0.1, 0.2, frente), 1.0, solta);
    float alfa = (0.22 + 0.75 * luz + 0.6 * borda) * visivel * clamp(1.0 + aRelevo * 0.7, 0.15, 1.8);
    alfa *= smoothstep(${f3(CORTE_Y + 0.05)}, ${f3(CORTE_Y + 0.75)}, position.y); // os ombros e o peito somem embaixo
    alfa *= 1.0 - solta * ciclo;
    alfa *= 1.0 + (aLabio + aMandibula * step(0.9, aMandibula)) * uAmp * 0.5;

    // o olho: íris e pupila no lugar para onde ela olha, um brilho fixo, e some piscando
    if (aOlho > 0.5) {
      vec2 o = aIris - uOlhar * 0.42;
      float r = length(o);
      float iris = smoothstep(0.62, 0.52, r) * smoothstep(0.2, 0.3, r);
      float pupila = smoothstep(0.26, 0.18, r);
      float reflexo = smoothstep(0.16, 0.05, length(aIris - vec2(-0.22, 0.26)));
      cor = mix(cor * 0.6, mix(uC1, vec3(1.0), 0.3), iris);
      cor = mix(cor, vec3(1.0), reflexo);
      alfa = (0.2 + iris * 1.2 + reflexo * 1.6) * (1.0 - pupila * 0.9) * (1.0 - uPisca * 0.9);
    }
    // ao aparecer, o busto se materializa de baixo para cima, com uma linha de varredura na frente
    float altura = (position.y - ${f3(CORTE_Y)}) / ${f3(TOPO_Y - CORTE_Y)};
    alfa *= (1.0 - smoothstep(uRevela - 0.04, uRevela, altura)) * (1.0 + 2.5 * exp(-pow((uRevela - altura) * 30.0, 2.0)));
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
  #ifdef BRILHO
    // a passada larga: só uma névoa de luz em volta das linhas
    gl_FragColor = vec4(vCor, vAlfa * exp(-d2 * 9.0));
  #else
    // a passada fina: ponto macio com o miolo quase branco
    float halo = exp(-d2 * 14.0);
    float miolo = exp(-d2 * 80.0);
    gl_FragColor = vec4(vCor + miolo * 0.45, vAlfa * (halo * 0.8 + miolo * 0.6));
  #endif
  }
`;

// a geometria sai uma vez por tamanho de tela (~0,2–0,4s de conta, espalhada pelos quadros) e fica
// guardada para as próximas vezes
// — uma geração só por tamanho, dividida por todos os Rostos abertos (o painel /visual mostra o
// grande e a miniatura ao mesmo tempo): quem estiver animando adianta a conta
const geracoes = new Map(); // chave → { gerador, dados }
const OPCOES = { estreita: { linhas: 60, passo: 0.014, angulos: 220 }, larga: { linhas: 84, passo: 0.0095, angulos: 300 } };
const MS_POR_QUADRO = 10;

/** Os pontos do busto, se já prontos; senão adianta a geração por `ms` milissegundos. */
function adiantarGeracao(chave, ms) {
  if (!geracoes.has(chave)) geracoes.set(chave, { gerador: gerarPontosDoRosto(OPCOES[chave]), dados: null });
  const g = geracoes.get(chave);
  const fim = performance.now() + ms;
  while (!g.dados && performance.now() < fim) {
    const passo = g.gerador.next();
    if (passo.done) g.dados = passo.value;
  }
  return g.dados;
}

const RAIO = 1.72; // o busto cabe num círculo deste raio, centrado em CENTRO_Y
const CENTRO_Y = -0.46;

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
    const chave = estreita ? "estreita" : "larga";

    const c = coresDe("rosto", "pronta");
    const uniforms = {
      uTempo: { value: 0 },
      uAmp: { value: 0.1 },
      uTam: { value: 1.8 * pixel },
      uAlfa: { value: estreita ? 1.6 : 1.45 },
      uBoca: { value: 0 },
      uPisca: { value: 0 },
      uSobrancelha: { value: 0 },
      uSorriso: { value: 0.3 },
      uSolta: { value: 0 },
      uRevela: { value: 0 },
      uFalhaY: { value: 9 },
      uFalhaAltura: { value: 0 },
      uFalhaX: { value: 0 },
      uOlhar: { value: new THREE.Vector2(0, 0) },
      uCabeca: { value: new THREE.Matrix3() },
      uC1: { value: new THREE.Color(c[0]) },
      uC2: { value: new THREE.Color(c[1]) },
      uC3: { value: new THREE.Color(c[2]) },
    };
    // a passada do brilho divide tudo com a das linhas, menos o tamanho e a força do ponto
    const uniformsDoBrilho = { ...uniforms, uTam: { value: 0 }, uAlfa: { value: 0 } };
    const material = (u, defines) => new THREE.ShaderMaterial({
      uniforms: u, vertexShader: VERTICE, fragmentShader: FRAGMENTO, defines,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const materialDasLinhas = material(uniforms, {});
    const materialDoBrilho = material(uniformsDoBrilho, { BRILHO: "" });
    const busto = new THREE.Group();
    busto.position.y = -CENTRO_Y;
    cena.add(busto);
    let geo = null;
    let surgiuEm = -1; // quando a geometria ficou pronta (começa a revelação)
    const montarPontos = (dados) => {
      geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(dados.posicoes, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(dados.normais, 3));
      geo.setAttribute("aIris", new THREE.BufferAttribute(dados.iris, 2));
      for (const [atributo, campo] of [
        ["aAcaso", "acaso"], ["aRelevo", "relevo"], ["aMandibula", "mandibula"], ["aLabio", "labio"], ["aCanto", "canto"],
        ["aPalpebra", "palpebra"], ["aSobrancelha", "sobrancelha"], ["aOlho", "olho"], ["aCabeca", "cabeca"], ["aCabelo", "cabelo"],
      ]) geo.setAttribute(atributo, new THREE.BufferAttribute(dados[campo], 1));
      const brilho = new THREE.Points(geo, materialDoBrilho);
      const linhas = new THREE.Points(geo, materialDasLinhas);
      brilho.frustumCulled = false;
      linhas.frustumCulled = false;
      brilho.renderOrder = 0;
      linhas.renderOrder = 1;
      busto.add(brilho, linhas);
    };
    const prontos = adiantarGeracao(chave, 0);
    if (prontos) montarPontos(prontos);

    // o busto ocupa `ocupacao` do lado menor da área, como a Esfera
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
      // o ponto acompanha o tamanho do busto na tela, mais que proporcional: numa prévia pequena as
      // linhas ficam perto umas das outras e, grossas, viravam uma massa
      const escala = THREE.MathUtils.clamp((Math.min(w, h) / 560) ** 1.3, 0.45, 1.8);
      uniforms.uTam.value = pixel * escala * (estreita ? 3.0 : 2.9);
      uniformsDoBrilho.uTam.value = uniforms.uTam.value * 3.2;
      uniformsDoBrilho.uAlfa.value = uniforms.uAlfa.value * 0.11;
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
    const giro = new THREE.Euler();
    const giroM4 = new THREE.Matrix4();
    const suave = (atual, meta, dt, rapidez) => atual + (meta - atual) * Math.min(1, dt * rapidez);
    const m = { boca: 0, pisca: 0, sobr: 0, sorriso: 0.3, olharX: 0, olharY: 0, yaw: 0, pitch: 0, roll: 0, acena: 0, solta: 0 };
    let proximaPiscada = 1.5;
    let piscando = -1; // início da piscada em curso
    let piscarDeNovo = false;
    let proximoOlhar = 0.8;
    let olharAlvo = [0, 0];
    let proximoAceno = 3;
    let proximaFalha = 2.5;
    let falhaAte = -1;
    let antes = performance.now() / 1000;
    let quadro;

    const animar = (ms) => {
      const t = ms / 1000;
      const dt = Math.min(0.05, Math.max(0, t - antes));
      antes = t;
      // gerando o busto: só alguns milissegundos por quadro, para a tela não travar
      if (!geo) {
        const dados = adiantarGeracao(chave, MS_POR_QUADRO);
        if (dados) montarPontos(dados);
      }
      if (geo && surgiuEm < 0) surgiuEm = t;
      uniforms.uRevela.value = surgiuEm < 0 ? 0 : reduzido ? 1.2 : Math.min(1.2, (t - surgiuEm) / 1.3);
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
      m.sorriso = suave(m.sorriso, p.pronta * 0.22 + p.ouvindo * 0.15 + p.falando * 0.1, dt, 2);
      // falando, solta mais partículas; ouvindo, recolhe
      m.solta = suave(m.solta, p.falando * amp * 0.22 - p.ouvindo * 0.08, dt, 4);

      // a cabeça: balança parada; inclina ouvindo (e acena de vez em quando); olha para cima
      // pensando; acompanha a fala com pequenos movimentos
      if (sinal.estado === "ouvindo" && t > proximoAceno) { m.acena = 1; proximoAceno = t + 3 + Math.random() * 3; }
      m.acena = Math.max(0, m.acena - dt * 1.6);
      const aceno = Math.sin((1 - m.acena) * Math.PI * 2) * m.acena * 0.07;
      const ponteiroCabeca = ponteiroVivo ? (p.pronta + p.ouvindo) : 0;
      const yawMeta = Math.sin(t * 0.31) * 0.14 * (p.pronta + p.falando * 0.6) + p.pensando * (0.24 + Math.sin(t * 0.4) * 0.08)
        + ponteiroCabeca * ponteiro.x * 0.26 + p.falando * Math.sin(t * 1.7) * amp * 0.07;
      const pitchMeta = Math.sin(t * 0.23) * 0.04 - p.pensando * 0.16 - ponteiroCabeca * ponteiro.y * 0.14
        + p.falando * Math.sin(t * 3.1) * amp * 0.06 + aceno + p.ouvindo * 0.05;
      const rollMeta = p.ouvindo * 0.12 + Math.sin(t * 0.19) * 0.03 - p.pensando * 0.05;
      m.yaw = suave(m.yaw, yawMeta, dt, 3);
      m.pitch = suave(m.pitch, pitchMeta, dt, 4);
      m.roll = suave(m.roll, rollMeta, dt, 2.5);
      const calma = reduzido ? 0.35 : 1;
      giro.set(m.pitch * calma, m.yaw * calma, m.roll * calma);
      uniforms.uCabeca.value.setFromMatrix4(giroM4.makeRotationFromEuler(giro));
      // o busto inteiro mexe pouco: respira e acompanha um quarto do giro da cabeça; a câmera fica
      // um pouco abaixo (visto de cima, o alto da cabeça e os ombros viravam anéis)
      busto.rotation.set(-0.07, m.yaw * 0.25 * calma, 0);
      busto.position.y = -CENTRO_Y + Math.sin(t * 1.1) * 0.008 * calma;

      // interferência: de 3 a 8s parada, de 1,5 a 4s falando; dura um instante
      if (!reduzido && t > proximaFalha) {
        falhaAte = t + 0.07 + Math.random() * 0.1;
        uniforms.uFalhaY.value = -1.6 + Math.random() * 2.6;
        uniforms.uFalhaAltura.value = 0.03 + Math.random() * 0.1;
        uniforms.uFalhaX.value = (Math.random() < 0.5 ? -1 : 1) * (0.03 + Math.random() * 0.06);
        proximaFalha = t + (sinal.estado === "falando" ? 1.5 + Math.random() * 2.5 : 3 + Math.random() * 5);
      }
      if (t > falhaAte) uniforms.uFalhaX.value = 0;

      uniforms.uTempo.value = reduzido ? t * 0.3 : t;
      uniforms.uAmp.value = reduzido ? amp * 0.4 : amp;
      uniforms.uBoca.value = m.boca;
      uniforms.uPisca.value = m.pisca;
      uniforms.uSobrancelha.value = m.sobr;
      uniforms.uSorriso.value = m.sorriso;
      uniforms.uSolta.value = m.solta;
      uniforms.uOlhar.value.set(m.olharX, m.olharY);
      renderer.render(cena, camera);
      quadro = requestAnimationFrame(animar);
    };
    quadro = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("pointermove", aoMover);
      geo?.dispose();
      materialDasLinhas.dispose();
      materialDoBrilho.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [ocupacao]);

  return <div ref={montagem} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />;
}
