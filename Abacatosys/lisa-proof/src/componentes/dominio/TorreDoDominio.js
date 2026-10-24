"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import Neuro, { usePersonagem } from "@/componentes/Neuro.js";
import { urlDoMonstro, TAMANHO_DOS_MONSTROS } from "@/componentes/reino/monstrosDePapel.js";
import { svgComoImagem, recorteDePapel } from "@/componentes/reino/papel.js";

/**
 * A torre do Modo Domínio em 3D (24/10/2026): "um mapa 3D igual o do Reino, porém sempre uma
 * montanha ou uma grande torre que deve ser escalada". Os andares sobem em espiral em volta do
 * corpo (torre de pedra ou montanha, sorteado pela semente da torre); cada andar é uma plataforma
 * com o chefão dele em recorte de papel — os mesmos monstros das expedições do Reino. Andar vencido
 * ganha bandeira; o Neuro (o recorte de papel do mascote, com o personagem da pessoa) fica no andar
 * de agora, de frente para o chefão.
 *
 * A luta: a tela manda cada golpe do roteiro (src/dominio/modoDominio.js, roteiroDaLuta) pela
 * prop `golpe` ({ k, quem, especial } ou { k, fim: true, venceu }); o atacante avança, o alvo pisca.
 * Vencendo, o chefão cai; quando a tela troca `atual`, o Neuro pula para o andar de cima.
 *
 * Arrastar gira a torre (para os lados) e sobe ou desce a vista; clicar numa plataforma chama
 * `aoEscolher(numero)`. Sem WebGL, chama `aoFalhar()`. Com "reduzir movimento", nada anima.
 */

const POR_VOLTA = 8;        // plataformas por volta da espiral
const ALTURA = 0.95;        // de um andar ao outro
const RAIO_DA_TORRE = 2.1;
const COR = {
  pedra: "#b9b2a3", pedraEscura: "#8f887a", rocha: "#8d8f99", rochaEscura: "#6f717c", neve: "#f4f7fb",
  grama: "#7cc46a", terra: "#9c6b43", madeira: "#a0703f", telhado: "#c8332f", ouro: "#f5c542",
  caminho: "#e9dcc0", plataforma: "#d8cdb6", vencida: "#22c55e", atual: "#f5c542",
};

/** Torre de pedra ou montanha: cada repositório tem a sua (a semente decide). */
export const formaDaTorre = (semente) => ((semente >>> 0) % 2 ? "montanha" : "torre");

function raioDoCorpo(forma, y, alturaTotal) {
  if (forma === "torre") return RAIO_DA_TORRE;
  const p = Math.min(1, Math.max(0, y / Math.max(1, alturaTotal)));
  return 4.4 - 3.0 * p; // a montanha afina até o pico
}

function posicaoDoAndar(i, n, forma) {
  const y = (i - 1) * ALTURA + 0.55;
  const a = (i - 1) * ((Math.PI * 2) / POR_VOLTA);
  const r = raioDoCorpo(forma, y, n * ALTURA) + 1.05;
  return { v: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), a };
}

/** Um número pintado numa plaquinha (o número do andar, ao lado da plataforma). */
function plaquinha(texto, destaque) {
  const c = document.createElement("canvas");
  c.width = 96; c.height = 48;
  const x = c.getContext("2d");
  x.fillStyle = destaque ? "#f5c542" : "rgba(17,24,20,0.78)";
  x.beginPath(); x.roundRect(4, 6, 88, 36, 12); x.fill();
  x.fillStyle = destaque ? "#111814" : "#ffffff";
  x.font = "700 24px Inter, system-ui, sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(texto, 48, 25);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  s.scale.set(0.62, 0.31, 1);
  return s;
}

export default function TorreDoDominio({ andares = [], atual = 1, concluida = false, semente = 1, golpe = null, humor = "normal", aoEscolher, aoFalhar, children }) {
  const caixa = useRef(null);
  const molde = useRef(null);
  const api = useRef(null);
  const personagem = usePersonagem();
  const aoEscolherRef = useRef(aoEscolher);
  aoEscolherRef.current = aoEscolher;

  // ---- a cena: monta uma vez
  useEffect(() => {
    const el = caixa.current;
    let renderizador;
    try {
      renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      if (!renderizador.getContext()) throw new Error("sem WebGL");
    } catch {
      aoFalhar?.();
      return undefined;
    }
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderizador.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderizador.domElement.setAttribute("aria-hidden", "true");
    renderizador.domElement.className = "dm-torre__tela";
    el.prepend(renderizador.domElement);

    const cena = new THREE.Scene();
    // a névoa do longe tem a cor do céu de fundo (src/app/dominio.css), no tema claro e no escuro
    cena.fog = new THREE.Fog(document.documentElement.dataset.tema === "escuro" ? "#22324d" : "#e2f0fc", 26, 60);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    cena.add(new THREE.HemisphereLight("#ffffff", "#7fb36a", 1.15));
    const sol = new THREE.DirectionalLight("#fff3dd", 1.6);
    sol.position.set(8, 20, 6);
    cena.add(sol);

    const geoPapel = new THREE.PlaneGeometry(1, 1);
    const descartaveis = new Set(); // geometrias, materiais e texturas a liberar no fim
    const guardar = (o) => { descartaveis.add(o); return o; };
    guardar(geoPapel);

    // os recortes de papel dos chefões: um material por monstro (carrega uma vez)
    const materiaisDosChefoes = new Map(); // tipo → { mat, copias } (a cópia é a do chefão que luta: pisca sozinha)
    function materialDoChefao(tipo, copia = false) {
      let item = materiaisDosChefoes.get(tipo);
      if (!item) {
        const tex = guardar(new THREE.CanvasTexture(document.createElement("canvas")));
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = guardar(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
        mat.visible = false;
        item = { mat, copias: [] };
        const img = new Image();
        img.onload = () => {
          tex.image = recorteDePapel(img);
          tex.needsUpdate = true;
          mat.visible = true;
          for (const c of item.copias) c.visible = true;
        };
        img.src = urlDoMonstro(tipo);
        materiaisDosChefoes.set(tipo, item);
      }
      if (!copia) return item.mat;
      const c = guardar(item.mat.clone());
      c.visible = item.mat.visible;
      item.copias.push(c);
      return c;
    }

    // o Neuro de papel (a textura vem do molde, em definirNeuro)
    const texNeuro = guardar(new THREE.CanvasTexture(document.createElement("canvas")));
    texNeuro.colorSpace = THREE.SRGBColorSpace;
    const matNeuro = guardar(new THREE.MeshBasicMaterial({ map: texNeuro, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
    matNeuro.visible = false;
    const neuro = new THREE.Mesh(geoPapel, matNeuro);
    neuro.scale.set(1.05, 1.05, 1);
    cena.add(neuro);

    // ---- estado
    const estado = {
      n: 0, forma: "torre", atual: 1, concluida: false,
      andares: [], plataformas: [], chefaoAtual: null, matChefaoAtual: null,
      angulo: 0, alvoAngulo: 0, vistaY: 0, alvoVistaY: 0, desvioAngulo: 0, desvioY: 0,
      neuroBase: new THREE.Vector3(), chefaoBase: new THREE.Vector3(),
    };
    const papeis = []; // tudo que é recorte (fica de frente para a câmera)
    let corpo = null, enfeites = null;
    const animacoes = [];
    const animar = (duracao, passo, atraso = 0) => {
      if (semMovimento) { passo(1); return; }
      animacoes.push({ inicio: performance.now() + atraso, duracao, passo });
    };

    // ---- o corpo (torre ou montanha), o chão e o topo
    function montarCorpo() {
      if (corpo) { cena.remove(corpo); corpo.traverse((m) => { m.geometry?.dispose(); }); }
      corpo = new THREE.Group();
      const H = Math.max(1, estado.n) * ALTURA + 0.8;
      const chao = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 6.2, 1, 10), guardar(new THREE.MeshStandardMaterial({ color: COR.grama, flatShading: true })));
      chao.position.y = -0.5;
      const terra = new THREE.Mesh(new THREE.ConeGeometry(6.2, 3.2, 10), guardar(new THREE.MeshStandardMaterial({ color: COR.terra, flatShading: true })));
      terra.rotation.x = Math.PI;
      terra.position.y = -2.6;
      corpo.add(chao, terra);

      if (estado.forma === "torre") {
        const matPedra = guardar(new THREE.MeshStandardMaterial({ color: COR.pedra, flatShading: true }));
        const tronco = new THREE.Mesh(new THREE.CylinderGeometry(RAIO_DA_TORRE, RAIO_DA_TORRE + 0.35, H + 1, 12), matPedra);
        tronco.position.y = (H + 1) / 2 - 0.5;
        corpo.add(tronco);
        const matFaixa = guardar(new THREE.MeshStandardMaterial({ color: COR.pedraEscura, flatShading: true }));
        for (let y = POR_VOLTA * ALTURA; y < H; y += POR_VOLTA * ALTURA) {
          const faixa = new THREE.Mesh(new THREE.TorusGeometry(RAIO_DA_TORRE + 0.04, 0.09, 6, 24), matFaixa);
          faixa.rotation.x = Math.PI / 2;
          faixa.position.y = y;
          corpo.add(faixa);
        }
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          const ameia = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), matPedra);
          ameia.position.set(Math.cos(a) * RAIO_DA_TORRE, H + 0.7, Math.sin(a) * RAIO_DA_TORRE);
          ameia.rotation.y = -a;
          corpo.add(ameia);
        }
        // as janelinhas acesas, em volta do tronco (uma malha só, instanciada: a torre de 100 andares tem centenas)
        const geoJanela = new THREE.BoxGeometry(0.26, 0.4, 0.1);
        const matJanela = guardar(new THREE.MeshStandardMaterial({ color: "#3a2f1f", emissive: "#ffc861", emissiveIntensity: 0.55, flatShading: true }));
        const posicoes = [];
        for (let y = 1.3; y < H - 0.4; y += 1.7) {
          for (let k = 0; k < 5; k++) posicoes.push({ y, a: (k / 5) * Math.PI * 2 + y * 0.9 });
        }
        if (posicoes.length) {
          const janelas = new THREE.InstancedMesh(geoJanela, matJanela, posicoes.length);
          const m = new THREE.Object3D();
          posicoes.forEach(({ y, a }, i) => {
            m.position.set(Math.cos(a) * (RAIO_DA_TORRE + 0.04), y, Math.sin(a) * (RAIO_DA_TORRE + 0.04));
            m.rotation.set(0, Math.PI / 2 - a, 0);
            m.updateMatrix();
            janelas.setMatrixAt(i, m.matrix);
          });
          corpo.add(janelas);
        }
        const telhado = new THREE.Mesh(new THREE.ConeGeometry(RAIO_DA_TORRE * 0.92, 2.2, 12), guardar(new THREE.MeshStandardMaterial({ color: COR.telhado, flatShading: true })));
        telhado.position.y = H + 1.6;
        corpo.add(telhado);
      } else {
        // a montanha: um perfil que afina até o pico, girado (low poly), com neve no alto
        const pontos = [new THREE.Vector2(4.9, -0.6)];
        for (let y = 0; y <= H; y += Math.max(1.2, H / 14)) pontos.push(new THREE.Vector2(raioDoCorpo("montanha", y, H) + (y > 0 && y < H - 1 ? (Math.sin(y * 3.1) * 0.18) : 0), y));
        pontos.push(new THREE.Vector2(0.9, H + 0.6), new THREE.Vector2(0.01, H + 1.9));
        const montanha = new THREE.Mesh(new THREE.LatheGeometry(pontos, 11), guardar(new THREE.MeshStandardMaterial({ color: COR.rocha, flatShading: true })));
        corpo.add(montanha);
        const yNeve = Math.max(0, H * 0.78);
        const rNeve = raioDoCorpo("montanha", yNeve, H) + 0.08;
        const neve = new THREE.Mesh(new THREE.ConeGeometry(rNeve, H + 1.95 - yNeve, 11), guardar(new THREE.MeshStandardMaterial({ color: COR.neve, flatShading: true })));
        neve.position.y = yNeve + (H + 1.95 - yNeve) / 2;
        corpo.add(neve);
      }
      // o farol do topo: acende dourado quando a torre é conquistada
      const farol = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), guardar(new THREE.MeshStandardMaterial({
        color: estado.concluida ? COR.ouro : "#9ca3af", emissive: estado.concluida ? "#f59e0b" : "#000000", emissiveIntensity: estado.concluida ? 0.9 : 0, flatShading: true,
      })));
      farol.position.y = H + (estado.forma === "torre" ? 3.1 : 2.5);
      farol.userData.gira = true;
      corpo.add(farol);
      cena.add(corpo);
    }

    // ---- as plataformas, o caminho, os chefões e as bandeiras
    function montarAndares() {
      if (enfeites) {
        cena.remove(enfeites);
        enfeites.traverse((m) => { if (m.isSprite) { m.material.map?.dispose(); m.material.dispose(); } else if (m.geometry && m.geometry !== geoPapel) m.geometry.dispose(); });
      }
      papeis.length = 0;
      papeis.push(neuro);
      enfeites = new THREE.Group();
      estado.plataformas = [];
      estado.chefaoAtual = null;
      estado.matChefaoAtual = null;
      const n = estado.n;
      if (!n) { cena.add(enfeites); return; }
      const matPlataforma = guardar(new THREE.MeshStandardMaterial({ color: COR.plataforma, flatShading: true }));
      const matVencida = guardar(new THREE.MeshStandardMaterial({ color: "#bfe8c9", flatShading: true }));
      const matAtual = guardar(new THREE.MeshStandardMaterial({ color: COR.atual, emissive: "#f59e0b", emissiveIntensity: 0.35, flatShading: true }));
      const matMastro = guardar(new THREE.MeshStandardMaterial({ color: COR.madeira, flatShading: true }));
      const matBandeira = guardar(new THREE.MeshStandardMaterial({ color: COR.vencida, flatShading: true, side: THREE.DoubleSide }));
      const geoPlataforma = new THREE.CylinderGeometry(0.95, 0.8, 0.26, 8);
      const geoMastro = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5);
      const geoBandeira = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.42, -0.12, 0), new THREE.Vector3(0, -0.26, 0)]);
      geoBandeira.computeVertexNormals();
      const geoAnel = new THREE.TorusGeometry(1.02, 0.05, 6, 24);

      const pontosDoCaminho = [];
      for (let i = 1; i <= n; i++) {
        const { v, a } = posicaoDoAndar(i, n, estado.forma);
        const dados = estado.andares[i - 1] || { numero: i };
        const ehAtual = i === estado.atual && !estado.concluida;
        const p = new THREE.Mesh(geoPlataforma, ehAtual ? matAtual : dados.vencido ? matVencida : matPlataforma);
        p.position.copy(v);
        p.userData.numero = i;
        enfeites.add(p);
        estado.plataformas[i] = { pos: v, a };
        pontosDoCaminho.push(new THREE.Vector3(v.x * 0.97, v.y + 0.08, v.z * 0.97));

        const placa = plaquinha(String(i), ehAtual);
        const fora = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        placa.position.copy(v).addScaledVector(fora, 1.05).add(new THREE.Vector3(0, -0.28, 0));
        enfeites.add(placa);

        const topo = v.y + 0.13;
        if (dados.vencido) {
          const mastro = new THREE.Mesh(geoMastro, matMastro);
          mastro.position.set(v.x, topo + 0.4, v.z);
          const bandeira = new THREE.Mesh(geoBandeira, matBandeira);
          bandeira.position.set(v.x, topo + 0.78, v.z);
          bandeira.rotation.y = -a;
          enfeites.add(mastro, bandeira);
        } else if (dados.chefao) {
          const final = i === n;
          const lado = ehAtual ? (estado.concluida ? 0 : 1) : 0;
          const tamanho = Math.min(2.2, (TAMANHO_DOS_MONSTROS[dados.chefao] || 1.6) * (final ? 0.82 : 0.62) * (ehAtual ? 1 : 0.85));
          const mat = materialDoChefao(dados.chefao, ehAtual);
          if (ehAtual) estado.matChefaoAtual = mat;
          const s = new THREE.Mesh(geoPapel, mat);
          s.scale.set(tamanho, tamanho, 1);
          const t = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
          s.position.copy(v).addScaledVector(t, -0.42 * lado).add(new THREE.Vector3(0, 0.13 + tamanho / 2 - tamanho * 0.06, 0));
          s.userData.base = s.position.clone();
          enfeites.add(s);
          papeis.push(s);
          if (ehAtual) { estado.chefaoAtual = s; estado.chefaoBase.copy(s.position); }
        }
        if (ehAtual) {
          const anel = new THREE.Mesh(geoAnel, matAtual);
          anel.rotation.x = Math.PI / 2;
          anel.position.set(v.x, v.y + 0.14, v.z);
          enfeites.add(anel);
        }
      }
      if (pontosDoCaminho.length > 1) {
        const curva = new THREE.CatmullRomCurve3(pontosDoCaminho);
        const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, Math.min(800, n * 8), 0.07, 5), guardar(new THREE.MeshStandardMaterial({ color: COR.caminho, flatShading: true })));
        enfeites.add(tubo);
      }
      cena.add(enfeites);
      posicionarNeuro(false);
    }

    /** O Neuro no andar de agora (no topo, se a torre foi conquistada), de frente para o chefão. */
    function posicionarNeuro(pulando) {
      const i = estado.concluida ? estado.n : estado.atual;
      const pl = estado.plataformas[i];
      if (!pl) { neuro.visible = false; return; }
      neuro.visible = true;
      const t = new THREE.Vector3(-Math.sin(pl.a), 0, Math.cos(pl.a));
      const alvo = pl.pos.clone().addScaledVector(t, estado.concluida ? 0 : 0.42).add(new THREE.Vector3(0, 0.13 + 0.5, 0));
      estado.neuroBase.copy(alvo);
      neuro.rotation.z = 0;
      if (!pulando || semMovimento) { neuro.position.copy(alvo); return; }
      const de = neuro.position.clone();
      animar(900, (k) => {
        neuro.position.lerpVectors(de, alvo, k);
        neuro.position.y += Math.sin(k * Math.PI) * 1.1;
      });
    }

    /** A câmera olha o andar `i` (de frente para a plataforma, um pouco de lado). */
    function mirar(i, suave) {
      const pl = estado.plataformas[Math.max(1, Math.min(estado.n || 1, i))];
      estado.alvoAngulo = (pl ? pl.a : 0) + 0.42;
      estado.alvoVistaY = pl ? pl.pos.y : 0;
      estado.desvioAngulo = 0;
      estado.desvioY = 0;
      if (!suave || semMovimento) { estado.angulo = estado.alvoAngulo; estado.vistaY = estado.alvoVistaY; }
    }

    // ---- a luta
    function golpear(g) {
      const chefao = estado.chefaoAtual;
      if (!chefao || !g) return;
      if (g.fim) {
        if (g.venceu) {
          const base = chefao.scale.x;
          animar(800, (k) => {
            chefao.rotation.z = k * 1.4;
            const s = base * (1 - k * 0.9);
            chefao.scale.set(s, s, 1);
            chefao.position.y = estado.chefaoBase.y - k * 0.4;
          });
        } else {
          animar(700, (k) => { neuro.rotation.z = Math.sin(k * Math.PI) * 0.5; neuro.position.y = estado.neuroBase.y - Math.sin(k * Math.PI) * 0.15; });
        }
        return;
      }
      const ehNeuro = g.quem === "neuro";
      const atacante = ehNeuro ? neuro : chefao;
      const de = ehNeuro ? estado.neuroBase.clone() : estado.chefaoBase.clone();
      const para = ehNeuro ? estado.chefaoBase.clone() : estado.neuroBase.clone();
      animar(460, (k) => { atacante.position.lerpVectors(de, para, Math.sin(k * Math.PI) * 0.5); });
      const matAlvo = ehNeuro ? estado.matChefaoAtual : matNeuro;
      const alvo = ehNeuro ? chefao : neuro;
      const baseAlvo = ehNeuro ? estado.chefaoBase.clone() : estado.neuroBase.clone();
      const cor = g.especial ? new THREE.Color("#fde047") : new THREE.Color("#ff6b6b");
      animar(380, (k) => {
        if (matAlvo) matAlvo.color.copy(cor).lerp(new THREE.Color("#ffffff"), k);
        alvo.position.x = baseAlvo.x + Math.sin(k * Math.PI * 6) * 0.06 * (1 - k);
      }, 200);
      if (g.especial) faiscas(baseAlvo);
    }

    /** Estrelinhas do golpe especial. */
    function faiscas(onde) {
      const mat = guardar(new THREE.MeshBasicMaterial({ color: "#fde047" }));
      const geo = guardar(new THREE.OctahedronGeometry(0.07, 0));
      const pedacos = Array.from({ length: 10 }, (_, k) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(onde);
        m.userData.dir = new THREE.Vector3(Math.cos(k * 0.63), 0.6 + (k % 3) * 0.3, Math.sin(k * 0.63));
        cena.add(m);
        return m;
      });
      animar(600, (k) => {
        for (const m of pedacos) { m.position.copy(onde).addScaledVector(m.userData.dir, k * 0.9); m.scale.setScalar(1 - k); }
        if (k >= 1) for (const m of pedacos) cena.remove(m);
      }, 220);
    }

    // ---- o Neuro de papel
    function definirNeuro(canvas) {
      texNeuro.image = canvas;
      texNeuro.needsUpdate = true;
      matNeuro.visible = true;
    }

    // ---- arrastar, clicar
    const raio = new THREE.Raycaster();
    let arrasto = null;
    function aoApertar(e) {
      arrasto = { x: e.clientX, y: e.clientY, moveu: false, angulo: estado.desvioAngulo, vista: estado.desvioY };
      renderizador.domElement.setPointerCapture?.(e.pointerId);
    }
    function aoMover(e) {
      if (!arrasto) return;
      const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) arrasto.moveu = true;
      estado.desvioAngulo = arrasto.angulo + dx * 0.008;
      const topo = Math.max(0, (estado.n - 1) * ALTURA);
      estado.desvioY = Math.max(-estado.alvoVistaY, Math.min(topo - estado.alvoVistaY + 2, arrasto.vista + dy * 0.03));
    }
    function aoSoltar(e) {
      if (arrasto && !arrasto.moveu) {
        const r = renderizador.domElement.getBoundingClientRect();
        raio.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
        const alvo = enfeites ? raio.intersectObjects(enfeites.children, false).find((h) => h.object.userData.numero) : null;
        if (alvo) aoEscolherRef.current?.(alvo.object.userData.numero);
      }
      arrasto = null;
    }
    const tela = renderizador.domElement;
    tela.addEventListener("pointerdown", aoApertar);
    tela.addEventListener("pointermove", aoMover);
    tela.addEventListener("pointerup", aoSoltar);
    tela.addEventListener("pointercancel", () => { arrasto = null; });

    // ---- tamanho e visibilidade
    function ajustar() {
      const w = el.clientWidth || 600, h = el.clientHeight || 400;
      renderizador.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const observador = new ResizeObserver(ajustar);
    observador.observe(el);
    ajustar();
    let visivel = true;
    const vigia = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; });
    vigia.observe(el);

    // ---- o laço
    let quadro = 0;
    const relogio = performance.now();
    function laco(agora) {
      quadro = requestAnimationFrame(laco);
      if (!visivel || document.hidden) return;
      for (let k = animacoes.length - 1; k >= 0; k--) {
        const a = animacoes[k];
        if (agora < a.inicio) continue;
        const t = Math.min(1, (agora - a.inicio) / a.duracao);
        a.passo(t);
        if (t >= 1) animacoes.splice(k, 1);
      }
      const suave = semMovimento ? 1 : 0.08;
      estado.angulo += (estado.alvoAngulo + estado.desvioAngulo - estado.angulo) * suave;
      estado.vistaY += (estado.alvoVistaY + estado.desvioY - estado.vistaY) * suave;
      const H = estado.n * ALTURA;
      // tela estreita (celular): a câmera recua, para caber a plataforma e o vizinho de cima
      const recuo = camera.aspect < 0.8 ? 1.55 : camera.aspect < 1.3 ? 1.2 : 1;
      const distancia = (raioDoCorpo(estado.forma, estado.vistaY, H) + 9.5) * recuo;
      camera.position.set(Math.cos(estado.angulo) * distancia, estado.vistaY + 3.4, Math.sin(estado.angulo) * distancia);
      camera.lookAt(0, estado.vistaY + 0.5, 0);
      const s = (agora - relogio) / 1000;
      for (const p of papeis) {
        p.rotation.y = Math.atan2(camera.position.x - p.position.x, camera.position.z - p.position.z);
      }
      if (!semMovimento && !animacoes.length) {
        if (neuro.visible) neuro.position.y = estado.neuroBase.y + Math.sin(s * 2.4) * 0.04;
        if (estado.chefaoAtual) estado.chefaoAtual.position.y = estado.chefaoBase.y + Math.sin(s * 1.9 + 1) * 0.05;
      }
      corpo?.traverse((m) => { if (m.userData.gira) m.rotation.y = s * 0.8; });
      renderizador.render(cena, camera);
    }
    quadro = requestAnimationFrame(laco);

    api.current = {
      montar({ andares: lista, atual: agora, concluida: fim, forma }) {
        const mudouForma = forma !== estado.forma || lista.length !== estado.n || fim !== estado.concluida;
        estado.andares = lista;
        estado.n = lista.length;
        estado.atual = Math.max(1, Math.min(lista.length || 1, agora));
        estado.concluida = fim;
        estado.forma = forma;
        if (mudouForma || !corpo) montarCorpo();
        montarAndares();
        mirar(estado.concluida ? estado.n : estado.atual, false);
      },
      definirAtual(i) {
        const pulou = i !== estado.atual;
        estado.atual = Math.max(1, Math.min(estado.n || 1, i));
        if (!pulou) return;
        montarAndares();
        const pl = estado.plataformas[estado.atual - 1];
        if (pl) neuro.position.copy(pl.pos).add(new THREE.Vector3(0, 0.63, 0));
        posicionarNeuro(true);
        mirar(estado.atual, true);
      },
      definirNeuro,
      golpear,
      centralizar() { mirar(estado.concluida ? estado.n : estado.atual, true); },
      mover(dy) {
        const topo = Math.max(0, (estado.n - 1) * ALTURA);
        estado.desvioY = Math.max(-estado.alvoVistaY, Math.min(topo - estado.alvoVistaY + 2, estado.desvioY + dy));
      },
    };

    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      vigia.disconnect();
      api.current = null;
      if (enfeites) enfeites.traverse((m) => { if (m.isSprite) { m.material.map?.dispose(); m.material.dispose(); } else if (m.geometry && m.geometry !== geoPapel) m.geometry.dispose(); });
      corpo?.traverse((m) => m.geometry?.dispose());
      for (const d of descartaveis) d.dispose?.();
      renderizador.dispose();
      tela.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- os andares (remonta quando um andar é vencido ou a torre muda)
  const chave = andares.map((a) => `${a.chefao || ""}${a.vencido ? "+" : ""}`).join(",");
  const atualRef = useRef(atual);
  useEffect(() => {
    api.current?.montar({ andares, atual: atualRef.current, concluida, forma: formaDaTorre(semente) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, concluida, semente]);

  // ---- subiu de andar: o Neuro pula
  useEffect(() => {
    if (atualRef.current !== atual) {
      atualRef.current = atual;
      api.current?.definirAtual(atual);
    }
  }, [atual]);

  // ---- a luta: um golpe por vez, mandado pela tela
  useEffect(() => {
    if (golpe) api.current?.golpear(golpe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [golpe?.k]);

  // ---- o Neuro: redesenha a folha quando o humor ou o personagem mudam
  useEffect(() => {
    let cancelado = false;
    const id = requestAnimationFrame(async () => {
      const svg = molde.current?.querySelector("svg");
      if (!svg) return;
      try {
        const img = await svgComoImagem(svg);
        if (!cancelado) api.current?.definirNeuro(recorteDePapel(img));
      } catch { /* sem a folha nova, fica a anterior */ }
    });
    return () => { cancelado = true; cancelAnimationFrame(id); };
  }, [humor, personagem]);

  return (
    <div className="dm-torre" ref={caixa}>
      <div className="dm-torre__controles">
        <button type="button" className="dm-torre__botao" aria-label="Ver mais acima" onClick={() => api.current?.mover(2.5)}>▲</button>
        <button type="button" className="dm-torre__botao" aria-label="Voltar ao andar de agora" onClick={() => api.current?.centralizar()}>📍</button>
        <button type="button" className="dm-torre__botao" aria-label="Ver mais abaixo" onClick={() => api.current?.mover(-2.5)}>▼</button>
      </div>
      {children}
      {/* o molde do Neuro de papel: fora da tela, sem foco, só para copiar o desenho */}
      <div className="dm-torre__molde" ref={molde} inert aria-hidden="true">
        <Neuro humor={humor} tamanho={200} />
      </div>
    </div>
  );
}
