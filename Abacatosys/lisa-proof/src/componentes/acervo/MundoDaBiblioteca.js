"use client";

// O MUNDO DA BIBLIOTECA COLABORATIVA (26/10/2026): uma ilha flutuante low poly, no jeito do Reino
// (src/componentes/reino/Mundo3D.js), com uma construção para cada tipo de material — a Torre dos
// Livros, o Observatório dos Artigos, o Auditório das Videoaulas e o Cinema dos Vídeos. Cada uma
// cresce com o nível do acervo dela (andares, cúpula, colunas, letreiro). Na porta de cada uma, quem
// cuida daquele acervo (personagensDoAcervo.js); pela ilha, os avatares de quem mais contribuiu (o
// personagem do Neuro de cada pessoa, em papel recortado) andando entre as construções do que
// trouxeram — a interação sem ser ao vivo: clicando, a tela mostra o que a pessoa trouxe.
//
// Arrastar gira a ilha. Clicar numa construção (ou no rótulo) chama aoEscolher(tipo); num avatar,
// aoContribuidor(id); num funcionário, aoFuncionario(tipo). Sem WebGL, chama aoFalhar(). Com
// "reduzir movimento", ninguém anda e as páginas não voam.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import Neuro from "@/componentes/Neuro.js";
import { svgComoImagem, recorteDePapel } from "@/componentes/reino/papel.js";
import { ORDEM_DOS_TIPOS, CONSTRUCOES_DO_ACERVO, TIPOS_DE_MATERIAL } from "@/dominio/acervo.js";
import { urlDoFuncionario } from "./personagensDoAcervo.js";

const COR = {
  grama: "#7cc46a", gramaEscura: "#5fae55", rocha: "#8d8f99", rochaEscura: "#6f717c", praca: "#e2d3ae",
  pedra: "#ddd5c6", pedraClara: "#ece6da", madeira: "#a0703f", telhado: "#d0463f", ouro: "#f0be45",
  janela: "#3b3b4f", folha: "#4fae63", folhaEscura: "#3c9356", tronco: "#6e4a2a", papel: "#fbf7ee",
};
const LOMBADAS = ["#c8332f", "#2f6fd6", "#f0be45", "#3c9356", "#8b5cf6", "#ea7a2a"];
/** Onde fica cada construção na ilha (ângulo, em graus, a partir da frente). */
const ANGULO = { livro: -50, artigo: 50, videoaula: 130, video: 230 };
const RAIO_DAS_CONSTRUCOES = 4.3;
const posicaoDe = (tipo, raio = RAIO_DAS_CONSTRUCOES) => {
  const a = (ANGULO[tipo] * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(a) * raio, 0, Math.cos(a) * raio);
};

function sorteio(semente) {
  let a = semente | 0 || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashDe = (s) => { let h = 0x811c9dc5; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0; };

// ------------------------------------------------------------------ peças

function criarPecas() {
  const materiais = new Map();
  const mat = (cor, extra = {}) => {
    const chave = cor + JSON.stringify(extra);
    if (!materiais.has(chave)) materiais.set(chave, new THREE.MeshStandardMaterial({ color: cor, flatShading: true, roughness: 0.9, metalness: 0, ...extra }));
    return materiais.get(chave);
  };
  const caixa = (l, a, p, cor, extra) => new THREE.Mesh(new THREE.BoxGeometry(l, a, p), mat(cor, extra));
  const cilindro = (rc, rb, a, cor, lados = 12, extra) => new THREE.Mesh(new THREE.CylinderGeometry(rc, rb, a, lados), mat(cor, extra));
  const cone = (r, a, cor, lados = 10) => new THREE.Mesh(new THREE.ConeGeometry(r, a, lados), mat(cor));
  const esfera = (r, cor, extra) => new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(cor, extra));
  const cupula = (r, cor) => new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(cor));
  const em = (m, x, y, z) => { m.position.set(x, y, z); return m; };
  return { mat, caixa, cilindro, cone, esfera, cupula, em, materiais };
}

/** A Torre dos Livros: andares de estante (lombadas coloridas), telhado em cone, bandeira no alto. */
function torreDosLivros(p, nivel) {
  const g = new THREE.Group();
  const andares = Math.min(7, 2 + Math.floor(nivel / 2));
  const r = 0.85 + nivel * 0.03;
  let y = 0;
  g.add(p.em(p.cilindro(r + 0.15, r + 0.2, 0.25, COR.pedra, 12), 0, 0.125, 0));
  y = 0.25;
  for (let i = 0; i < andares; i++) {
    const h = 0.55;
    g.add(p.em(p.cilindro(r, r, h, COR.pedraClara, 12), 0, y + h / 2, 0));
    // a faixa de lombadas em volta de cada andar
    const lombadas = 14;
    for (let k = 0; k < lombadas; k++) {
      const a = (k / lombadas) * Math.PI * 2;
      const l = p.caixa(0.16, 0.32 + ((k * 7 + i) % 3) * 0.04, 0.08, LOMBADAS[(k + i) % LOMBADAS.length]);
      l.position.set(Math.sin(a) * (r + 0.02), y + 0.26, Math.cos(a) * (r + 0.02));
      l.rotation.y = a;
      g.add(l);
    }
    g.add(p.em(p.cilindro(r + 0.06, r + 0.06, 0.06, COR.madeira, 12), 0, y + h, 0));
    y += h + 0.06;
  }
  g.add(p.em(p.caixa(0.36, 0.5, 0.1, "#3a2a1e"), 0, 0.5, r + 0.02));
  const telhado = p.em(p.cone(r + 0.3, 0.9 + nivel * 0.04, COR.telhado, 12), 0, y + (0.9 + nivel * 0.04) / 2, 0);
  g.add(telhado);
  y += 0.9 + nivel * 0.04;
  if (nivel >= 4) {
    g.add(p.em(p.cilindro(0.02, 0.02, 0.6, COR.madeira, 5), 0, y + 0.3, 0));
    g.add(p.em(p.caixa(0.32, 0.18, 0.02, "#2f6fd6"), 0.17, y + 0.5, 0));
  }
  if (nivel >= 8) g.add(p.em(p.esfera(0.12, COR.ouro, { emissive: "#7a5a10" }), 0, y + 0.66, 0));
  g.userData.altura = y + 0.7;
  return g;
}

/** O Observatório dos Artigos: torre redonda, cúpula com fenda, telescópio, laboratórios do lado. */
function observatorio(p, nivel) {
  const g = new THREE.Group();
  const r = 0.95;
  const h = 0.9 + nivel * 0.09;
  g.add(p.em(p.cilindro(r + 0.15, r + 0.2, 0.25, COR.pedra, 14), 0, 0.125, 0));
  g.add(p.em(p.cilindro(r, r, h, COR.pedraClara, 14), 0, 0.25 + h / 2, 0));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const j = p.caixa(0.18, 0.26, 0.05, COR.janela);
    j.position.set(Math.sin(a) * (r + 0.01), 0.25 + h * 0.6, Math.cos(a) * (r + 0.01));
    j.rotation.y = a;
    g.add(j);
  }
  g.add(p.em(p.caixa(0.36, 0.5, 0.1, "#3a2a1e"), 0, 0.5, r + 0.01));
  const topo = 0.25 + h;
  g.add(p.em(p.cupula(r * 1.02, "#8fa1c4"), 0, topo, 0));
  const fenda = p.em(p.caixa(0.16, 0.9, 0.12, "#1e293b"), 0, topo + 0.4, 0.62);
  fenda.rotation.x = -0.6;
  g.add(fenda);
  if (nivel >= 2) {
    const tubo = p.cilindro(0.09, 0.13, 1.1, "#cbd5e1", 10, { metalness: 0.3, roughness: 0.5 });
    tubo.position.set(0, topo + 0.6, 0.55);
    tubo.rotation.x = -0.9;
    g.add(tubo);
  }
  if (nivel >= 4) {
    g.add(p.em(p.caixa(0.8, 0.6, 0.7, COR.pedra), -1.25, 0.3, 0));
    g.add(p.em(p.caixa(0.86, 0.06, 0.76, "#3c6e91"), -1.25, 0.63, 0));
  }
  if (nivel >= 7) {
    g.add(p.em(p.caixa(0.8, 0.6, 0.7, COR.pedra), 1.25, 0.3, 0));
    g.add(p.em(p.caixa(0.86, 0.06, 0.76, "#3c6e91"), 1.25, 0.63, 0));
  }
  if (nivel >= 6) {
    g.add(p.em(p.cilindro(0.015, 0.015, 0.7, "#94a3b8", 5), -0.5, topo + 0.75, -0.3));
    g.add(p.em(p.esfera(0.06, "#ef4444", { emissive: "#991b1b" }), -0.5, topo + 1.12, -0.3));
  }
  g.userData.altura = topo + 1.2;
  return g;
}

/** O Auditório das Videoaulas: um salão de colunas com frontão, alas e, no alto, uma cúpula. */
function auditorio(p, nivel) {
  const g = new THREE.Group();
  const largura = 1.9 + Math.min(4, nivel) * 0.08;
  g.add(p.em(p.caixa(largura + 0.5, 0.2, 1.9, COR.pedra), 0, 0.1, 0));
  g.add(p.em(p.caixa(largura + 0.3, 0.12, 1.7, COR.pedraClara), 0, 0.26, 0));
  const alturaDoSalao = 1.0 + nivel * 0.04;
  g.add(p.em(p.caixa(largura, alturaDoSalao, 1.2, COR.pedraClara), 0, 0.32 + alturaDoSalao / 2, -0.15));
  const colunas = 2 + Math.min(4, Math.floor(nivel / 2));
  for (let i = 0; i < colunas; i++) {
    const x = -largura / 2 + 0.15 + (i * (largura - 0.3)) / Math.max(1, colunas - 1);
    g.add(p.em(p.cilindro(0.08, 0.09, alturaDoSalao, "#f7f3ea", 8), x, 0.32 + alturaDoSalao / 2, 0.55));
  }
  const topo = 0.32 + alturaDoSalao;
  g.add(p.em(p.caixa(largura + 0.2, 0.12, 1.5, COR.pedra), 0, topo + 0.06, 0));
  const frontao = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, largura + 0.2, 3), p.mat("#c9b98f"));
  frontao.rotation.z = Math.PI / 2;
  frontao.rotation.x = -Math.PI / 2; // o eixo do prisma ao longo da largura, a ponta do triângulo para cima
  frontao.scale.set(1, 1, 0.55);
  frontao.position.set(0, topo + 0.38, 0.0);
  g.add(frontao);
  // a tela da aula, na parede do fundo do pórtico
  g.add(p.em(p.caixa(0.7, 0.42, 0.04, "#1e3a8a", { emissive: "#1e3a8a", emissiveIntensity: 0.35 }), 0, 0.32 + alturaDoSalao * 0.6, 0.46));
  const play = new THREE.Mesh(new THREE.CircleGeometry(0.12, 3), p.mat("#f8fafc", { emissive: "#ffffff", emissiveIntensity: 0.4 }));
  play.position.set(0.01, 0.32 + alturaDoSalao * 0.6, 0.49);
  g.add(play);
  if (nivel >= 5) {
    g.add(p.em(p.caixa(0.6, 0.8, 1.0, COR.pedraClara), -largura / 2 - 0.35, 0.32 + 0.4, -0.25));
    g.add(p.em(p.caixa(0.6, 0.8, 1.0, COR.pedraClara), largura / 2 + 0.35, 0.32 + 0.4, -0.25));
  }
  let altura = topo + 0.75;
  if (nivel >= 8) {
    g.add(p.em(p.cupula(0.45, "#6aa0c9"), 0, topo + 0.12, -0.3));
    altura = topo + 0.7;
  }
  g.userData.altura = altura;
  return g;
}

/** O Cinema dos Vídeos: paredes vermelhas, letreiro com luzes, rolo de filme no telhado. */
function cinema(p, nivel) {
  const g = new THREE.Group();
  const andares = nivel >= 6 ? 2 : 1;
  const h = 1.05 * andares + nivel * 0.03;
  g.add(p.em(p.caixa(2.1, 0.2, 1.9, COR.pedra), 0, 0.1, 0));
  g.add(p.em(p.caixa(1.8, h, 1.5, "#a3262b"), 0, 0.2 + h / 2, -0.1));
  g.add(p.em(p.caixa(0.5, 0.6, 0.06, "#2a1416"), 0, 0.5, 0.66));
  // o letreiro e as luzes em volta dele
  const yL = 0.2 + Math.min(h - 0.2, 0.95);
  g.add(p.em(p.caixa(1.6, 0.34, 0.12, "#fde047", { emissive: "#a16207", emissiveIntensity: 0.6 }), 0, yL, 0.7));
  const luzes = Math.min(12, 3 + nivel);
  for (let i = 0; i < luzes; i++) {
    const x = -0.75 + (i * 1.5) / Math.max(1, luzes - 1);
    g.add(p.em(p.esfera(0.045, "#fff7d6", { emissive: "#fff2a8", emissiveIntensity: 1 }), x, yL + 0.22, 0.75));
  }
  let topo = 0.2 + h;
  g.add(p.em(p.caixa(1.9, 0.08, 1.6, "#5b1518"), 0, topo + 0.04, -0.1));
  if (nivel >= 3) {
    const rolo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 6, 16), p.mat("#334155"));
    rolo.position.set(0.45, topo + 0.48, -0.2);
    g.add(rolo);
    const eixo = p.em(p.cilindro(0.1, 0.1, 0.1, "#94a3b8", 8), 0.45, topo + 0.48, -0.2);
    eixo.rotation.x = Math.PI / 2;
    g.add(eixo);
    g.add(p.em(p.caixa(0.06, 0.4, 0.06, "#334155"), 0.45, topo + 0.2, -0.2));
  }
  if (nivel >= 9) g.add(p.em(p.caixa(0.22, 1.0, 0.22, "#f472b6", { emissive: "#9d174d", emissiveIntensity: 0.7 }), -0.6, topo + 0.5, -0.2));
  g.userData.altura = topo + (nivel >= 3 ? 0.9 : 0.3);
  return g;
}

const CONSTRUIR = { livro: torreDosLivros, artigo: observatorio, videoaula: auditorio, video: cinema };

// ------------------------------------------------------------------ o componente

export default function MundoDaBiblioteca({ estado, contribuidores = [], aoEscolher, aoContribuidor, aoFuncionario, aoFalhar, altura = 420 }) {
  const caixa = useRef(null);
  const rotulos = useRef({});
  const moldes = useRef(null);
  const api = useRef(null);
  const chamadas = useRef({ aoEscolher, aoContribuidor, aoFuncionario, aoFalhar });
  chamadas.current = { aoEscolher, aoContribuidor, aoFuncionario, aoFalhar };

  // ---- a cena: uma vez
  useEffect(() => {
    const el = caixa.current;
    if (!el) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      chamadas.current.aoFalhar?.();
      return undefined;
    }
    const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);
    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 9.5, 15.5);
    camera.lookAt(0, 0.6, 0);
    cena.add(new THREE.HemisphereLight("#ffffff", "#5c6b4f", 1.1));
    const sol = new THREE.DirectionalLight("#fff5e0", 1.6);
    sol.position.set(6, 12, 8);
    cena.add(sol);

    const p = criarPecas();
    const ilha = new THREE.Group();
    cena.add(ilha);
    // a ilha: o gramado, a rocha embaixo, a praça e os caminhos até cada construção
    ilha.add(p.em(p.cilindro(7, 6.6, 0.6, COR.grama, 28), 0, -0.3, 0));
    const rocha = p.em(p.cone(6.6, 4.2, COR.rocha, 14), 0, -2.7, 0);
    rocha.rotation.x = Math.PI;
    ilha.add(rocha);
    const ponta = p.em(p.cone(3.2, 2.4, COR.rochaEscura, 9), 1.5, -4.3, 0.5);
    ponta.rotation.x = Math.PI;
    ilha.add(ponta);
    ilha.add(p.em(p.cilindro(2.2, 2.2, 0.05, COR.praca, 24), 0, 0.02, 0));
    for (const tipo of ORDEM_DOS_TIPOS) {
      const alvo = posicaoDe(tipo, 3.1);
      const caminho = p.caixa(0.7, 0.04, 2.3, COR.praca);
      caminho.position.set(alvo.x * 0.62, 0.02, alvo.z * 0.62);
      caminho.rotation.y = (ANGULO[tipo] * Math.PI) / 180;
      ilha.add(caminho);
    }
    // o livro aberto no meio da praça (cresce com o nível da biblioteca)
    const monumento = new THREE.Group();
    ilha.add(monumento);
    // as árvores da borda
    const r = sorteio(7);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2;
      if (ORDEM_DOS_TIPOS.some((t) => Math.abs(((a * 180) / Math.PI - ((ANGULO[t] + 360) % 360) + 540) % 360 - 180) < 22)) continue;
      const d = 6.1 + r() * 0.5;
      const arv = new THREE.Group();
      arv.add(p.em(p.cilindro(0.08, 0.1, 0.4, COR.tronco, 6), 0, 0.2, 0));
      arv.add(p.em(p.cone(0.45 + r() * 0.2, 1.0 + r() * 0.4, r() > 0.5 ? COR.folha : COR.folhaEscura, 7), 0, 0.85, 0));
      arv.position.set(Math.sin(a) * d, 0, Math.cos(a) * d);
      ilha.add(arv);
    }
    // as páginas voando em volta
    const paginas = [];
    const matPagina = new THREE.MeshStandardMaterial({ color: COR.papel, side: THREE.DoubleSide, flatShading: true, roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.42), matPagina);
      pg.userData = { a: (i / 7) * Math.PI * 2, raio: 2.4 + (i % 3) * 0.9, y: 2.2 + (i % 4) * 0.5, v: 0.12 + (i % 3) * 0.05 };
      ilha.add(pg);
      paginas.push(pg);
    }

    // ---- as construções (refeitas quando o nível muda)
    const construcoes = {};
    const alvosDeClique = [];
    function montarConstrucao(tipo, nivel) {
      const velha = construcoes[tipo];
      if (velha) { ilha.remove(velha); velha.traverse((o) => o.geometry?.dispose()); }
      const g = CONSTRUIR[tipo](p, Math.max(1, nivel));
      const pos = posicaoDe(tipo);
      g.position.copy(pos);
      g.rotation.y = Math.atan2(-pos.x, -pos.z); // a frente (+z) virada para a praça
      g.userData.tipo = tipo;
      g.traverse((o) => { o.userData.tipo = tipo; });
      ilha.add(g);
      construcoes[tipo] = g;
    }

    // ---- o papel: funcionários e avatares (planos que sempre olham para a câmera)
    const geoPapel = new THREE.PlaneGeometry(1, 1);
    const matSombra = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.18, depthWrite: false });
    const geoSombra = new THREE.CircleGeometry(0.32, 14);
    const folhas = [];
    function folhaDePapel(lado) {
      const tex = new THREE.CanvasTexture(document.createElement("canvas"));
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
      m.visible = false;
      const plano = new THREE.Mesh(geoPapel, m);
      plano.scale.set(lado, lado, 1);
      const grupo = new THREE.Group();
      grupo.add(plano);
      const sombra = new THREE.Mesh(geoSombra, matSombra);
      sombra.rotation.x = -Math.PI / 2;
      sombra.position.y = 0.03;
      grupo.add(sombra);
      plano.position.y = lado / 2;
      grupo.userData.plano = plano;
      folhas.push(grupo);
      return { grupo, plano, tex, m };
    }
    const carregar = (alvo, origem) => {
      if (typeof origem === "string") {
        const img = new Image();
        img.onload = () => { alvo.tex.image = recorteDePapel(img); alvo.tex.needsUpdate = true; alvo.m.visible = true; };
        img.src = origem;
      } else if (origem) {
        alvo.tex.image = origem; alvo.tex.needsUpdate = true; alvo.m.visible = true;
      }
    };
    const funcionarios = {};
    for (const tipo of ORDEM_DOS_TIPOS) {
      const f = folhaDePapel(1.15);
      const porta = posicaoDe(tipo, RAIO_DAS_CONSTRUCOES - 1.45);
      const lado = new THREE.Vector3(-porta.z, 0, porta.x).normalize().multiplyScalar(0.75);
      f.grupo.position.copy(porta).add(lado);
      f.plano.userData.funcionario = tipo;
      carregar(f, urlDoFuncionario(CONSTRUCOES_DO_ACERVO[tipo].personagem.id));
      ilha.add(f.grupo);
      funcionarios[tipo] = f;
    }
    let andarilhos = [];
    const texturasDosAvatares = new Map(); // personagem → canvas de papel
    function montarAndarilhos(lista) {
      for (const a of andarilhos) { ilha.remove(a.grupo); a.m.dispose(); a.tex.dispose(); }
      const velhos = new Set(andarilhos.map((a) => a.grupo));
      for (let i = folhas.length - 1; i >= 0; i--) if (velhos.has(folhas[i])) folhas.splice(i, 1);
      andarilhos = lista.map((c, i) => {
        const f = folhaDePapel(0.95);
        f.plano.userData.contribuidor = c.id;
        const rr = sorteio(hashDe(c.id));
        const tipos = ORDEM_DOS_TIPOS.filter((t) => (c.porTipo?.[t] || 0) > 0);
        const casa = tipos.length ? tipos : ORDEM_DOS_TIPOS;
        const inicio = new THREE.Vector3((rr() - 0.5) * 3, 0, (rr() - 0.5) * 3);
        f.grupo.position.copy(inicio);
        const tela = texturasDosAvatares.get(c.personagem);
        if (tela) carregar(f, tela);
        ilha.add(f.grupo);
        return { ...f, id: c.id, personagem: c.personagem, rr, casa, alvo: inicio.clone(), pausa: rr() * 2, olhando: 1, indice: i };
      });
    }
    function definirAvatar(personagem, canvas) {
      texturasDosAvatares.set(personagem, canvas);
      for (const a of andarilhos) if (a.personagem === personagem) carregar(a, canvas);
    }
    function novoAlvo(a) {
      // vai até a porta de uma construção do que trouxe, ou dá uma volta pela praça
      if (a.rr() < 0.55) {
        const t = a.casa[Math.floor(a.rr() * a.casa.length)];
        const porta = posicaoDe(t, RAIO_DAS_CONSTRUCOES - 1.6);
        a.alvo.set(porta.x + (a.rr() - 0.5) * 0.9, 0, porta.z + (a.rr() - 0.5) * 0.9);
      } else {
        const ang = a.rr() * Math.PI * 2, d = 0.6 + a.rr() * 1.4;
        a.alvo.set(Math.sin(ang) * d, 0, Math.cos(ang) * d);
      }
      a.pausa = 1 + a.rr() * 2.5;
    }

    // ---- tamanho, arrastar e clicar
    function medir() {
      const l = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(l, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = l / h;
      // no celular (retrato) a câmera se afasta para a ilha caber
      const longe = l / h < 1 ? 1 + (1 - l / h) * 0.9 : 1;
      camera.position.set(0, 9.5 * longe, 15.5 * longe);
      camera.lookAt(0, 0.6, 0);
      camera.updateProjectionMatrix();
    }
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);

    let arrastando = null;
    let girou = 0;
    const raio = new THREE.Raycaster();
    const ponteiro = new THREE.Vector2();
    const baixo = (e) => { arrastando = { x: e.clientX }; girou = 0; };
    const mover = (e) => {
      if (!arrastando) return;
      const dx = e.clientX - arrastando.x;
      arrastando.x = e.clientX;
      girou += Math.abs(dx);
      ilha.rotation.y += dx * 0.008;
    };
    const soltar = (e) => {
      const foiClique = arrastando && girou < 6;
      arrastando = null;
      if (!foiClique) return;
      const r2 = renderer.domElement.getBoundingClientRect();
      ponteiro.set(((e.clientX - r2.left) / r2.width) * 2 - 1, -((e.clientY - r2.top) / r2.height) * 2 + 1);
      raio.setFromCamera(ponteiro, camera);
      const acertos = raio.intersectObjects(ilha.children, true);
      for (const hit of acertos) {
        const u = hit.object.userData;
        if (u.contribuidor) return chamadas.current.aoContribuidor?.(u.contribuidor);
        if (u.funcionario) return chamadas.current.aoFuncionario?.(u.funcionario);
        if (u.tipo) return chamadas.current.aoEscolher?.(u.tipo);
      }
      return undefined;
    };
    const cv = renderer.domElement;
    cv.style.touchAction = "pan-y";
    cv.addEventListener("pointerdown", baixo);
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);

    // ---- o laço
    let visivel = true;
    const io = new IntersectionObserver(([x]) => { visivel = x.isIntersecting; });
    io.observe(el);
    const relogio = new THREE.Clock();
    const v = new THREE.Vector3();
    let quadro = 0;
    const laco = () => {
      quadro = requestAnimationFrame(laco);
      if (!visivel || document.hidden) return;
      const dt = Math.min(0.05, relogio.getDelta());
      const t = relogio.elapsedTime;
      if (!calmo) {
        if (!arrastando) ilha.rotation.y += dt * 0.04;
        for (const pg of paginas) {
          const u = pg.userData;
          u.a += dt * u.v;
          pg.position.set(Math.sin(u.a) * u.raio, u.y + Math.sin(t * 1.3 + u.raio) * 0.25, Math.cos(u.a) * u.raio);
          pg.rotation.set(Math.sin(t + u.raio) * 0.6, u.a * 2, Math.cos(t * 0.8 + u.y) * 0.4);
        }
        for (const a of andarilhos) {
          if (a.pausa > 0) { a.pausa -= dt; if (a.pausa <= 0) novoAlvo(a); continue; }
          const d = v.copy(a.alvo).sub(a.grupo.position);
          const dist = d.length();
          if (dist < 0.05) { a.pausa = 0.8 + a.rr() * 2; continue; }
          d.normalize().multiplyScalar(Math.min(dist, dt * 0.7));
          a.grupo.position.add(d);
          a.plano.position.y = 0.475 + Math.abs(Math.sin(t * 9 + a.indice)) * 0.05;
        }
      }
      // o papel sempre de frente para a câmera (a ilha só gira em volta do eixo Y)
      for (const f of folhas) {
        f.rotation.y = -ilha.rotation.y;
      }
      // os andarilhos "viram a folha" conforme andam para a esquerda ou a direita da tela
      for (const a of andarilhos) {
        const dirX = Math.cos(ilha.rotation.y) * (a.alvo.x - a.grupo.position.x) + Math.sin(ilha.rotation.y) * (a.alvo.z - a.grupo.position.z);
        if (Math.abs(dirX) > 0.02 && a.pausa <= 0) a.olhando = dirX < 0 ? -1 : 1;
        a.plano.scale.x = 0.95 * a.olhando;
      }
      renderer.render(cena, camera);
      // os rótulos das construções acompanham a ilha; quando dois se encostam, o de trás sobe e o
      // da frente fica por cima
      const r3 = el.getBoundingClientRect();
      const pontos = [];
      for (const tipo of ORDEM_DOS_TIPOS) {
        const g = construcoes[tipo], rot = rotulos.current[tipo];
        if (!g || !rot) continue;
        v.set(0, g.userData.altura + 0.3, 0);
        g.localToWorld(v);
        v.project(camera);
        pontos.push({ rot, x: ((v.x + 1) / 2) * r3.width, y: ((1 - v.y) / 2) * r3.height, z: v.z, l: rot.offsetWidth || 140, a: rot.offsetHeight || 40 });
      }
      pontos.sort((a, b) => a.z - b.z); // da frente para trás
      for (let i = 0; i < pontos.length; i++) {
        for (let j = 0; j < i; j++) {
          const f = pontos[j], t2 = pontos[i];
          if (Math.abs(f.x - t2.x) < (f.l + t2.l) / 2 && Math.abs(f.y - t2.y) < (f.a + t2.a) / 2) t2.y = f.y - (f.a + t2.a) / 2 - 2;
        }
      }
      pontos.forEach((pt, i) => {
        const x = Math.min(r3.width - pt.l / 2 - 4, Math.max(pt.l / 2 + 4, pt.x)); // nunca passa da borda
        pt.rot.style.transform = `translate(-50%, -100%) translate(${x}px, ${Math.max(pt.a + 4, pt.y)}px)`;
        pt.rot.style.zIndex = String(10 - i);
        pt.rot.style.opacity = pt.z > 1 ? "0" : "1";
      });
    };
    laco();

    api.current = { montarConstrucao, montarAndarilhos, definirAvatar, montarMonumento: (nivel) => {
      while (monumento.children.length) { const c = monumento.children.pop(); c.geometry?.dispose(); }
      const pedestal = p.em(p.cilindro(0.45, 0.55, 0.3 + nivel * 0.04, COR.pedra, 10), 0, (0.3 + nivel * 0.04) / 2, 0);
      monumento.add(pedestal);
      const topo = 0.3 + nivel * 0.04;
      const escala = 0.8 + nivel * 0.06;
      const esq = p.caixa(0.5 * escala, 0.04, 0.7 * escala, COR.papel);
      esq.position.set(-0.24 * escala, topo + 0.12, 0);
      esq.rotation.z = 0.35;
      const dir = esq.clone();
      dir.position.x = 0.24 * escala;
      dir.rotation.z = -0.35;
      const capa = p.caixa(1.05 * escala, 0.05, 0.74 * escala, "#7c2d12");
      capa.position.set(0, topo + 0.03, 0);
      monumento.add(capa, esq, dir);
    } };
    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      io.disconnect();
      cv.removeEventListener("pointerdown", baixo);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      cena.traverse((o) => { o.geometry?.dispose(); });
      for (const m of p.materiais.values()) m.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  // ---- os níveis das construções e da biblioteca
  const niveis = ORDEM_DOS_TIPOS.map((t) => estado?.construcoes?.[t]?.nivel || 1).join(",");
  const nivelDaBiblioteca = estado?.nivel || 1;
  useEffect(() => {
    const n = niveis.split(",").map(Number);
    ORDEM_DOS_TIPOS.forEach((t, i) => api.current?.montarConstrucao(t, n[i]));
    api.current?.montarMonumento(nivelDaBiblioteca);
  }, [niveis, nivelDaBiblioteca]);

  // ---- os avatares de quem contribuiu
  const chave = contribuidores.map((c) => `${c.id}:${c.personagem}`).join("|");
  useEffect(() => {
    api.current?.montarAndarilhos(contribuidores);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  const personagens = [...new Set(contribuidores.map((c) => c.personagem))];
  const chaveDosPersonagens = personagens.join(",");
  useEffect(() => {
    let cancelado = false;
    const id = requestAnimationFrame(async () => {
      for (const nome of chaveDosPersonagens ? chaveDosPersonagens.split(",") : []) {
        const svg = moldes.current?.querySelector(`[data-personagem="${nome}"] svg`);
        if (!svg) continue;
        try {
          const img = await svgComoImagem(svg);
          if (!cancelado) api.current?.definirAvatar(nome, recorteDePapel(img));
        } catch { /* sem a folha, o avatar fica invisível */ }
      }
    });
    return () => { cancelado = true; cancelAnimationFrame(id); };
  }, [chaveDosPersonagens]);

  return (
    <div className="ac-mundo" style={{ height: altura }}>
      <div ref={caixa} className="ac-mundo__tela" />
      {ORDEM_DOS_TIPOS.map((t) => {
        const c = estado?.construcoes?.[t];
        return (
          <button key={t} type="button" ref={(e) => { rotulos.current[t] = e; }} className="ac-rotulo" onClick={() => aoEscolher?.(t)}>
            <span aria-hidden="true">{TIPOS_DE_MATERIAL[t].icone}</span> {CONSTRUCOES_DO_ACERVO[t].nome}
            <small>nível {c?.nivel || 1}</small>
          </button>
        );
      })}
      {/* os moldes dos avatares: o SVG do Neuro de cada personagem, fora da tela, vira papel no 3D */}
      <div ref={moldes} className="ac-mundo__moldes" aria-hidden="true">
        {personagens.map((nome) => <div key={nome} data-personagem={nome}><Neuro personagem={nome} humor="feliz" tamanho={160} /></div>)}
      </div>
    </div>
  );
}
