"use client";

// O MUNDO DA BIBLIOTECA COLABORATIVA (26/10/2026): uma ilha flutuante low poly, no jeito do Reino
// (src/componentes/reino/Mundo3D.js), com uma construção para cada tipo de material — a Torre dos
// Livros, o Observatório dos Artigos, o Auditório das Videoaulas e o Cinema dos Vídeos. Cada uma
// cresce com o nível do acervo dela. Na porta de cada uma, quem cuida daquele acervo
// (personagensDoAcervo.js); pela ilha, os avatares de quem mais contribuiu (o personagem do Neuro de
// cada pessoa, em papel recortado) andando entre as construções do que trouxeram — clicando, a tela
// mostra o que a pessoa trouxe.
//
// O TERRENO (26/10/2026, "ponha mais relevo nesse terreno, melhore os modelos, deixe maior"): uma
// malha polar com colinas, um lago com riacho e a cachoeira que cai da borda, o penhasco em camadas
// embaixo, árvores de dois tipos, pedras, flores, postes de luz pelos caminhos de pedra e bancos na
// praça. Onde ficam a praça, os caminhos e as construções, o chão é plano (altura()). Sombras de
// verdade (o sol projeta), nuvens e ilhotas flutuando em volta.
//
// Arrastar gira a ilha. Clicar numa construção (ou no rótulo) chama aoEscolher(tipo); num avatar,
// aoContribuidor(id); num funcionário, aoFuncionario(tipo). Sem WebGL, chama aoFalhar(). Com
// "reduzir movimento", ninguém anda, a água para e a ilha não gira sozinha.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import Neuro from "@/componentes/Neuro.js";
import { svgComoImagem, recorteDePapel } from "@/componentes/reino/papel.js";
import { ORDEM_DOS_TIPOS, CONSTRUCOES_DO_ACERVO, TIPOS_DE_MATERIAL } from "@/dominio/acervo.js";
import { urlDoFuncionario } from "./personagensDoAcervo.js";

const COR = {
  grama: "#7cc46a", gramaClara: "#93d27a", gramaEscura: "#5fae55", terra: "#8a5a3b", terraEscura: "#6b4329",
  rocha: "#8d8f99", rochaEscura: "#6f717c", rochaFunda: "#585a66", areia: "#e2d3ae", pedra: "#ddd5c6", pedraClara: "#efe9dd",
  madeira: "#a0703f", madeiraEscura: "#6e4a2a", telhado: "#d0463f", telhadoEscuro: "#a8352f", ouro: "#f0be45",
  janela: "#2f3346", folha: "#4fae63", folhaEscura: "#3c9356", folhaClara: "#6cc077", tronco: "#6e4a2a", papel: "#fbf7ee",
  agua: "#4aa3df", aguaClara: "#8fd0f5",
};
const LOMBADAS = ["#c8332f", "#2f6fd6", "#f0be45", "#3c9356", "#8b5cf6", "#ea7a2a", "#0e9f9a"];

/** O tamanho da ilha e onde fica cada construção (ângulo, em graus, a partir da frente). */
const RAIO = 9.4;
const ANGULO = { livro: -55, artigo: 55, videoaula: 140, video: 220 };
const RAIO_DAS_CONSTRUCOES = 5.5;
const ESCALA_DAS_CONSTRUCOES = 1.35;
const PRACA = 2.9;
const LAGO = { x: Math.sin(0) * 6.6, z: Math.cos(0) * 6.6, r: 1.45 };
const posicaoDe = (tipo, raio = RAIO_DAS_CONSTRUCOES) => {
  const a = (ANGULO[tipo] * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(a) * raio, 0, Math.cos(a) * raio);
};

function sorteio(semente) {
  let a = semente | 0 || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashDe = (s) => { let h = 0x811c9dc5; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ o relevo

/** Distância de (x, z) ao segmento a→b (para os caminhos). */
function distAoSegmento(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}
const COLINAS = [
  { a: 180, r: 6.9, h: 1.9, s: 2.2 }, { a: 205, r: 7.6, h: 1.2, s: 1.4 }, { a: 160, r: 7.8, h: 1.1, s: 1.3 },
  { a: 95, r: 7.6, h: 1.0, s: 1.5 }, { a: -95, r: 7.4, h: 1.15, s: 1.6 }, { a: -120, r: 8.2, h: 0.7, s: 1.0 },
  { a: 25, r: 8.4, h: 0.45, s: 0.9 }, { a: -25, r: 8.5, h: 0.5, s: 0.9 },
];
/** O quanto um ponto é "chão plano" (praça, caminhos, lotes das construções): 0 a 1. */
function plano(x, z) {
  const r = Math.hypot(x, z);
  let w = 1 - suave(PRACA, PRACA + 0.7, r);
  for (const t of ORDEM_DOS_TIPOS) {
    const p = posicaoDe(t);
    w = Math.max(w, 1 - suave(2.3, 3.0, Math.hypot(x - p.x, z - p.z)));
    w = Math.max(w, 1 - suave(0.55, 1.05, distAoSegmento(x, z, 0, 0, p.x, p.z)));
  }
  return w;
}
/** A altura do terreno em (x, z). */
function altura(x, z) {
  const r = Math.hypot(x, z);
  let h = 0.12 * Math.sin(x * 1.3 + 0.7) * Math.cos(z * 1.1 - 0.4) + 0.07 * Math.sin(x * 2.9 - z * 2.3);
  for (const c of COLINAS) {
    const a = (c.a * Math.PI) / 180;
    const d = Math.hypot(x - Math.sin(a) * c.r, z - Math.cos(a) * c.r);
    h += c.h * Math.exp(-(d * d) / (c.s * c.s));
  }
  h -= suave(RAIO - 1.6, RAIO, r) * 0.35; // a borda desce um pouco
  const w = plano(x, z);
  h = h * (1 - w) + 0.02 * w;
  // o lago e o riacho até a borda (onde nasce a cachoeira)
  const dl = Math.hypot(x - LAGO.x, z - LAGO.z);
  const riacho = distAoSegmento(x, z, LAGO.x, LAGO.z, 0, RAIO + 0.5);
  const fundo = Math.max(1 - suave(LAGO.r - 0.2, LAGO.r + 0.5, dl), (1 - suave(0.25, 0.6, riacho)) * 0.8);
  h = h * (1 - fundo) - 0.28 * fundo;
  return h;
}

/** A malha do terreno: anéis em volta do centro, com a cor de cada vértice (grama, areia, margem). */
function malhaDoTerreno() {
  const ANEIS = 30, LADOS = 120;
  const pos = [], cor = [], idx = [];
  const c = new THREE.Color();
  const grama = new THREE.Color(COR.grama), clara = new THREE.Color(COR.gramaClara), escura = new THREE.Color(COR.gramaEscura);
  const areia = new THREE.Color(COR.areia), margem = new THREE.Color("#c9b27a");
  const r = sorteio(42);
  pos.push(0, altura(0, 0), 0);
  c.copy(areia); cor.push(c.r, c.g, c.b);
  for (let i = 1; i <= ANEIS; i++) {
    const raio = (i / ANEIS) * RAIO;
    for (let j = 0; j < LADOS; j++) {
      const a = (j / LADOS) * Math.PI * 2;
      const x = Math.sin(a) * raio, z = Math.cos(a) * raio;
      const y = altura(x, z);
      pos.push(x, y, z);
      const w = plano(x, z);
      const dl = Math.hypot(x - LAGO.x, z - LAGO.z);
      c.copy(y > 0.7 ? clara : y < 0.05 ? escura : grama).lerp(clara, Math.min(1, Math.max(0, y - 0.3)) * 0.4);
      c.offsetHSL(0, 0, (r() - 0.5) * 0.04);
      c.lerp(areia, w * 0.92);
      if (dl < LAGO.r + 0.55 || distAoSegmento(x, z, LAGO.x, LAGO.z, 0, RAIO + 0.5) < 0.7) c.lerp(margem, 0.7);
      cor.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < LADOS; j++) idx.push(0, 1 + j, 1 + ((j + 1) % LADOS));
  for (let i = 1; i < ANEIS; i++) {
    const a0 = 1 + (i - 1) * LADOS, a1 = 1 + i * LADOS;
    for (let j = 0; j < LADOS; j++) {
      const j2 = (j + 1) % LADOS;
      idx.push(a0 + j, a1 + j, a1 + j2, a0 + j, a1 + j2, a0 + j2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(cor, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // a saia da borda (terra), da altura da grama até embaixo
  const saia = [], saiaIdx = [];
  for (let j = 0; j <= LADOS; j++) {
    const a = (j / LADOS) * Math.PI * 2;
    const x = Math.sin(a) * RAIO, z = Math.cos(a) * RAIO;
    saia.push(x, altura(x, z), z, x * 0.985, -0.95, z * 0.985);
  }
  for (let j = 0; j < LADOS; j++) { const k = j * 2; saiaIdx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  const gs = new THREE.BufferGeometry();
  gs.setAttribute("position", new THREE.Float32BufferAttribute(saia, 3));
  gs.setIndex(saiaIdx);
  gs.computeVertexNormals();
  return { terreno: g, saia: gs };
}

/** A água da cachoeira: listras que descem (a textura anda), sumindo no fim. */
function texturaDaCachoeira() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 256;
  const x = c.getContext("2d");
  const fundo = x.createLinearGradient(0, 0, 0, 256);
  fundo.addColorStop(0, "rgba(143,208,245,0.95)");
  fundo.addColorStop(1, "rgba(143,208,245,0)");
  x.fillStyle = fundo;
  x.fillRect(0, 0, 64, 256);
  x.globalCompositeOperation = "source-atop";
  for (let i = 0; i < 26; i++) {
    x.fillStyle = `rgba(255,255,255,${0.35 + (i % 3) * 0.2})`;
    x.fillRect((i * 23) % 64, (i * 41) % 256, 3 + (i % 3), 30 + (i % 4) * 12);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Um letreiro (texto numa textura), para o cinema. */
function texturaDeTexto(texto, { cor = "#fff7d6", fundo = "#7f1d1d", largura = 256, alturaT = 72, fonte = "bold 48px Georgia, serif" } = {}) {
  const c = document.createElement("canvas");
  c.width = largura; c.height = alturaT;
  const x = c.getContext("2d");
  x.fillStyle = fundo; x.fillRect(0, 0, largura, alturaT);
  x.fillStyle = cor; x.font = fonte; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(texto, largura / 2, alturaT / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

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
  const esfera = (r, cor, extra, w = 10, h = 8) => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat(cor, extra));
  const cupula = (r, cor, lados = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, lados, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(cor));
  const em = (m, x, y, z) => { m.position.set(x, y, z); return m; };
  /** Uma janela em arco (caixa escura com meio cilindro em cima), virada para +z. */
  const janelaEmArco = (l, a, cor = COR.janela) => {
    const g = new THREE.Group();
    g.add(em(caixa(l, a, 0.06, cor), 0, 0, 0));
    const arco = new THREE.Mesh(new THREE.CylinderGeometry(l / 2, l / 2, 0.06, 10, 1, false, 0, Math.PI), mat(cor));
    arco.rotation.x = Math.PI / 2; arco.rotation.y = Math.PI / 2;
    arco.position.y = a / 2;
    g.add(arco);
    return g;
  };
  return { mat, caixa, cilindro, cone, esfera, cupula, em, janelaEmArco, materiais };
}

/** Põe um objeto em volta de um cilindro (ângulo a, raio r), virado para fora. */
function emVolta(obj, a, r, y) {
  obj.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
  obj.rotation.y = a;
  return obj;
}

/** A Torre dos Livros: base de degraus, andares de estante (lombadas), janelas em arco, sacadas, telhado com agulha. */
function torreDosLivros(p, nivel) {
  const g = new THREE.Group();
  const andares = Math.min(8, 2 + Math.floor(nivel / 1.5));
  const r = 0.95 + nivel * 0.035;
  g.add(p.em(p.cilindro(r + 0.4, r + 0.5, 0.18, COR.pedra, 8), 0, 0.09, 0));
  g.add(p.em(p.cilindro(r + 0.22, r + 0.32, 0.16, COR.pedraClara, 8), 0, 0.26, 0));
  let y = 0.34;
  for (let i = 0; i < andares; i++) {
    const h = 0.62;
    g.add(p.em(p.cilindro(r, r * 1.02, h, COR.pedraClara, 14), 0, y + h / 2, 0));
    const lombadas = 18;
    for (let k = 0; k < lombadas; k++) {
      const a = (k / lombadas) * Math.PI * 2;
      if (i === 0 && Math.abs(Math.sin(a / 2)) < 0.18) continue; // a porta
      const alt = 0.3 + ((k * 7 + i * 3) % 4) * 0.035;
      g.add(emVolta(p.caixa(0.15, alt, 0.09, LOMBADAS[(k + i * 2) % LOMBADAS.length]), a, r + 0.025, y + 0.12 + alt / 2));
    }
    if (i > 0) for (let k = 0; k < 4; k++) g.add(emVolta(p.janelaEmArco(0.16, 0.18), (k / 4) * Math.PI * 2 + Math.PI / 4, r + 0.04, y + 0.45));
    g.add(p.em(p.cilindro(r + 0.07, r + 0.07, 0.07, COR.madeira, 14), 0, y + h, 0));
    if (i % 2 === 1) {
      // a sacada com o parapeito
      g.add(p.em(p.cilindro(r + 0.24, r + 0.24, 0.05, COR.madeiraEscura, 14), 0, y + h + 0.05, 0));
      for (let k = 0; k < 14; k++) g.add(emVolta(p.caixa(0.03, 0.14, 0.03, COR.madeiraEscura), (k / 14) * Math.PI * 2, r + 0.22, y + h + 0.13));
    }
    y += h + 0.07;
  }
  const porta = p.janelaEmArco(0.38, 0.42, "#3a2a1e");
  porta.position.set(0, 0.55, r + 0.04);
  g.add(porta);
  g.add(p.em(p.cilindro(r + 0.12, r + 0.12, 0.1, COR.telhadoEscuro, 14), 0, y + 0.05, 0));
  const alturaDoTelhado = 1.0 + nivel * 0.05;
  g.add(p.em(p.cone(r + 0.38, alturaDoTelhado, COR.telhado, 14), 0, y + 0.1 + alturaDoTelhado / 2, 0));
  y += 0.1 + alturaDoTelhado;
  g.add(p.em(p.cilindro(0.025, 0.04, 0.5, COR.ouro, 6), 0, y + 0.2, 0));
  g.add(p.em(p.esfera(0.09, COR.ouro, { emissive: "#7a5a10", emissiveIntensity: 0.4 }), 0, y + 0.47, 0));
  if (nivel >= 4) {
    const bandeira = p.caixa(0.36, 0.2, 0.02, "#2f6fd6");
    bandeira.position.set(0.2, y + 0.38, 0);
    g.add(bandeira);
  }
  if (nivel >= 6) {
    // o torreão do lado
    const t = new THREE.Group();
    t.add(p.em(p.cilindro(0.38, 0.4, 1.6, COR.pedraClara, 10), 0, 0.8, 0));
    t.add(p.em(p.cone(0.5, 0.7, COR.telhado, 10), 0, 1.95, 0));
    t.add(emVolta(p.janelaEmArco(0.12, 0.14), 0, 0.39, 1.1));
    t.position.set(r + 0.35, 0.34, -0.25);
    g.add(t);
  }
  g.userData.altura = y + 0.6;
  return g;
}

/** O Observatório dos Artigos: base de dois degraus com escada, corpo com nervuras, cúpula com fenda e telescópio. */
function observatorio(p, nivel) {
  const g = new THREE.Group();
  const r = 1.05;
  const h = 1.0 + nivel * 0.1;
  g.add(p.em(p.cilindro(r + 0.45, r + 0.55, 0.2, COR.pedra, 16), 0, 0.1, 0));
  g.add(p.em(p.cilindro(r + 0.25, r + 0.32, 0.18, COR.pedraClara, 16), 0, 0.29, 0));
  for (let k = 0; k < 3; k++) g.add(p.em(p.caixa(0.7, 0.1, 0.22, COR.pedra), 0, 0.05 + k * 0.1, r + 0.62 - k * 0.2));
  g.add(p.em(p.cilindro(r, r * 1.03, h, COR.pedraClara, 16), 0, 0.38 + h / 2, 0));
  for (let k = 0; k < 8; k++) g.add(emVolta(p.caixa(0.08, h, 0.06, "#cfc6b5"), (k / 8) * Math.PI * 2 + Math.PI / 8, r + 0.02, 0.38 + h / 2));
  for (let k = 0; k < 4; k++) g.add(emVolta(p.janelaEmArco(0.2, 0.26), (k / 4) * Math.PI * 2 + Math.PI / 4, r + 0.04, 0.38 + h * 0.62));
  const porta = p.janelaEmArco(0.4, 0.45, "#3a2a1e");
  porta.position.set(0, 0.62, r + 0.05);
  g.add(porta);
  const topo = 0.38 + h;
  g.add(p.em(p.cilindro(r + 0.1, r + 0.1, 0.1, "#8b8f9c", 16), 0, topo + 0.05, 0));
  g.add(p.em(p.cupula(r * 1.02, "#8fa1c4", 18), 0, topo + 0.1, 0));
  for (let k = 0; k < 6; k++) {
    const n = new THREE.Mesh(new THREE.TorusGeometry(r * 1.03, 0.025, 4, 18, Math.PI), p.mat("#6c7a99"));
    n.rotation.y = (k / 6) * Math.PI;
    n.position.y = topo + 0.1;
    g.add(n);
  }
  const fenda = p.em(p.caixa(0.2, 1.0, 0.14, "#1e293b"), 0, topo + 0.55, 0.62);
  fenda.rotation.x = -0.7;
  g.add(fenda);
  if (nivel >= 2) {
    const tubo = p.cilindro(0.1, 0.15, 1.3 + nivel * 0.04, "#d6dce6", 12, { metalness: 0.35, roughness: 0.45 });
    tubo.position.set(0, topo + 0.85, 0.62);
    tubo.rotation.x = -0.95;
    g.add(tubo);
    const anel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 12), p.mat(COR.ouro));
    anel.position.set(0, topo + 0.72, 0.5);
    anel.rotation.x = -0.95 + Math.PI / 2;
    g.add(anel);
  }
  if (nivel >= 4) {
    const lab = (x) => {
      const l = new THREE.Group();
      l.add(p.em(p.caixa(0.95, 0.75, 0.8, COR.pedraClara), 0, 0.375, 0));
      l.add(p.em(p.caixa(1.05, 0.08, 0.9, "#3c6e91"), 0, 0.79, 0));
      l.add(p.em(p.caixa(0.5, 0.26, 0.05, "#7dd3fc", { emissive: "#0c4a6e", emissiveIntensity: 0.5 }), 0, 0.45, 0.42));
      l.position.set(x, 0.2, -0.2);
      return l;
    };
    g.add(lab(-1.5));
    if (nivel >= 7) g.add(lab(1.5));
  }
  if (nivel >= 5) {
    const prato = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.18, 12, 1, true), p.mat("#e5e7eb", { side: THREE.DoubleSide }));
    prato.rotation.x = Math.PI * 0.7;
    prato.position.set(-0.7, topo + 0.95, -0.4);
    g.add(prato);
  }
  if (nivel >= 6) {
    g.add(p.em(p.cilindro(0.015, 0.015, 0.8, "#94a3b8", 5), 0.6, topo + 0.9, -0.4));
    g.add(p.em(p.esfera(0.06, "#ef4444", { emissive: "#991b1b" }), 0.6, topo + 1.32, -0.4));
  }
  g.userData.altura = topo + 1.5;
  return g;
}

/** O Auditório das Videoaulas: estilóbato de três degraus, colunas com capitel, frontão com emblema, tela, alas e cúpula. */
function auditorio(p, nivel) {
  const g = new THREE.Group();
  const largura = 2.3 + Math.min(4, nivel) * 0.1;
  for (let k = 0; k < 3; k++) g.add(p.em(p.caixa(largura + 0.9 - k * 0.22, 0.13, 2.1 - k * 0.14, k % 2 ? COR.pedraClara : COR.pedra), 0, 0.065 + k * 0.13, 0.05));
  const base = 0.39;
  const alt = 1.15 + nivel * 0.045;
  g.add(p.em(p.caixa(largura, alt, 1.25, COR.pedraClara), 0, base + alt / 2, -0.25));
  // a tela da aula, no fundo do pórtico
  g.add(p.em(p.caixa(0.95, 0.56, 0.04, "#1e3a8a", { emissive: "#1d4ed8", emissiveIntensity: 0.45 }), 0, base + alt * 0.58, 0.38));
  const play = new THREE.Mesh(new THREE.CircleGeometry(0.15, 3), p.mat("#f8fafc", { emissive: "#ffffff", emissiveIntensity: 0.5 }));
  play.position.set(0.02, base + alt * 0.58, 0.41);
  g.add(play);
  const colunas = 4 + Math.min(4, Math.floor(nivel / 2));
  for (let i = 0; i < colunas; i++) {
    const x = -largura / 2 + 0.12 + (i * (largura - 0.24)) / Math.max(1, colunas - 1);
    g.add(p.em(p.cilindro(0.085, 0.1, alt - 0.16, "#f7f3ea", 8), x, base + (alt - 0.16) / 2 + 0.08, 0.62));
    g.add(p.em(p.caixa(0.26, 0.08, 0.26, COR.pedra), x, base + 0.04, 0.62));
    g.add(p.em(p.caixa(0.26, 0.08, 0.26, COR.pedra), x, base + alt - 0.04, 0.62));
  }
  const topo = base + alt;
  g.add(p.em(p.caixa(largura + 0.24, 0.16, 1.75, COR.pedra), 0, topo + 0.08, 0));
  g.add(p.em(p.caixa(largura + 0.3, 0.06, 1.8, "#c9b98f"), 0, topo + 0.19, 0));
  const frontao = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, largura + 0.24, 3), p.mat("#d8caa2"));
  frontao.rotation.z = Math.PI / 2;
  frontao.rotation.x = -Math.PI / 2; // o eixo do prisma ao longo da largura, a ponta do triângulo para cima
  frontao.scale.set(1, 1, 0.55);
  frontao.position.set(0, topo + 0.36, 0);
  g.add(frontao);
  const emblema = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 16), p.mat(COR.ouro, { emissive: "#7a5a10", emissiveIntensity: 0.3 }));
  emblema.rotation.x = Math.PI / 2;
  emblema.position.set(0, topo + 0.42, 0.88);
  g.add(emblema);
  if (nivel >= 3) {
    for (const x of [-largura / 2 - 0.05, largura / 2 + 0.05]) {
      g.add(p.em(p.caixa(0.04, 0.7, 0.32, "#1d4ed8"), x, base + alt * 0.62, 0.55));
    }
  }
  if (nivel >= 5) {
    for (const s of [-1, 1]) {
      g.add(p.em(p.caixa(0.75, 0.95, 1.1, COR.pedraClara), s * (largura / 2 + 0.42), base + 0.475, -0.3));
      g.add(p.em(p.caixa(0.85, 0.08, 1.2, "#c9b98f"), s * (largura / 2 + 0.42), base + 0.99, -0.3));
    }
  }
  let altura = topo + 0.95;
  if (nivel >= 8) {
    g.add(p.em(p.cilindro(0.5, 0.55, 0.3, COR.pedraClara, 14), 0, topo + 0.35, -0.35));
    g.add(p.em(p.cupula(0.52, "#6aa0c9"), 0, topo + 0.5, -0.35));
    altura = topo + 1.15;
  }
  g.userData.altura = altura;
  return g;
}

/** O Cinema dos Vídeos: fachada art déco, letreiro vertical, marquise com lâmpadas, cartazes, bilheteria e tapete vermelho. */
function cinema(p, nivel, texturas) {
  const g = new THREE.Group();
  const andares = nivel >= 6 ? 2 : 1;
  const h = 1.25 * andares + nivel * 0.035;
  g.add(p.em(p.caixa(2.6, 0.18, 2.2, COR.pedra), 0, 0.09, 0));
  g.add(p.em(p.caixa(2.2, h, 1.7, "#a3262b"), 0, 0.18 + h / 2, -0.15));
  // o escalonado art déco no alto
  g.add(p.em(p.caixa(1.6, 0.3, 1.5, "#8b1e23"), 0, 0.18 + h + 0.15, -0.2));
  g.add(p.em(p.caixa(1.0, 0.24, 1.3, "#701a1e"), 0, 0.18 + h + 0.42, -0.25));
  // as portas e o tapete vermelho
  g.add(p.em(p.caixa(0.7, 0.62, 0.06, "#2a1416"), 0, 0.5, 0.72));
  g.add(p.em(p.caixa(0.04, 0.6, 0.07, COR.ouro), 0, 0.5, 0.74));
  const tapete = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.2), p.mat("#b91c1c"));
  tapete.rotation.x = -Math.PI / 2;
  tapete.position.set(0, 0.19, 1.25);
  g.add(tapete);
  // a marquise com as lâmpadas
  const yM = 0.18 + 0.95;
  g.add(p.em(p.caixa(2.0, 0.08, 0.7, "#5b1518"), 0, yM, 0.95));
  g.add(p.em(p.caixa(1.8, 0.34, 0.1, "#fde047", { emissive: "#a16207", emissiveIntensity: 0.65 }), 0, yM + 0.22, 0.95 + 0.3));
  const luzes = Math.min(14, 4 + nivel);
  for (let i = 0; i < luzes; i++) {
    const x = -0.85 + (i * 1.7) / Math.max(1, luzes - 1);
    g.add(p.em(p.esfera(0.045, "#fff7d6", { emissive: "#fff2a8", emissiveIntensity: 1.2 }), x, yM + 0.43, 1.27));
    g.add(p.em(p.esfera(0.045, "#fff7d6", { emissive: "#fff2a8", emissiveIntensity: 1.2 }), x, yM + 0.02, 1.27));
  }
  // o letreiro vertical "CINE"
  const lamina = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.42), [p.mat("#701a1e"), p.mat("#701a1e"), p.mat("#701a1e"), p.mat("#701a1e"),
    new THREE.MeshStandardMaterial({ map: texturas.cine, emissive: "#ffffff", emissiveMap: texturas.cine, emissiveIntensity: 0.6 }),
    new THREE.MeshStandardMaterial({ map: texturas.cine, emissive: "#ffffff", emissiveMap: texturas.cine, emissiveIntensity: 0.6 })]);
  lamina.rotation.y = Math.PI / 2;
  lamina.position.set(1.0, 0.18 + h * 0.62 + 0.3, 0.72);
  g.add(lamina);
  // os cartazes dos dois lados da porta
  for (const [x, cor] of [[-0.68, "#2563eb"], [0.68, "#16a34a"]]) {
    g.add(p.em(p.caixa(0.36, 0.5, 0.04, COR.ouro), x, 0.55, 0.71));
    g.add(p.em(p.caixa(0.3, 0.44, 0.05, cor, { emissive: cor, emissiveIntensity: 0.25 }), x, 0.55, 0.72));
  }
  if (nivel >= 2) {
    // a bilheteria
    const b = new THREE.Group();
    b.add(p.em(p.caixa(0.45, 0.6, 0.4, "#7f1d1d"), 0, 0.3, 0));
    b.add(p.em(p.caixa(0.32, 0.2, 0.05, "#bae6fd", { emissive: "#0c4a6e", emissiveIntensity: 0.3 }), 0, 0.42, 0.21));
    b.add(p.em(p.cone(0.36, 0.25, COR.ouro, 4), 0, 0.72, 0));
    b.position.set(-1.05, 0.18, 1.1);
    g.add(b);
  }
  const topo = 0.18 + h + 0.54;
  if (nivel >= 3) {
    const rolo = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.08, 6, 18), p.mat("#334155"));
    rolo.position.set(-0.45, topo + 0.45, -0.3);
    g.add(rolo);
    const eixo = p.em(p.cilindro(0.1, 0.1, 0.12, "#94a3b8", 8), -0.45, topo + 0.45, -0.3);
    eixo.rotation.x = Math.PI / 2;
    g.add(eixo);
    g.add(p.em(p.caixa(0.06, 0.3, 0.06, "#334155"), -0.45, topo + 0.12, -0.3));
  }
  if (nivel >= 9) g.add(p.em(p.caixa(0.22, 1.1, 0.22, "#f472b6", { emissive: "#9d174d", emissiveIntensity: 0.8 }), 0.5, topo + 0.55, -0.3));
  g.userData.altura = topo + (nivel >= 3 ? 1.0 : 0.4);
  return g;
}

const CONSTRUIR = { livro: torreDosLivros, artigo: observatorio, videoaula: auditorio, video: cinema };

// ------------------------------------------------------------------ o componente

export default function MundoDaBiblioteca({ estado, contribuidores = [], aoEscolher, aoContribuidor, aoFuncionario, aoFalhar }) {
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const cena = new THREE.Scene();
    cena.fog = new THREE.Fog("#5b3f8a", 34, 70);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 140);
    cena.add(new THREE.HemisphereLight("#fff7e8", "#4b5a45", 1.0));
    const sol = new THREE.DirectionalLight("#fff1d6", 2.1);
    sol.position.set(9, 16, 7);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 });
    sol.shadow.bias = -0.0008;
    sol.shadow.normalBias = 0.03;
    cena.add(sol);
    const contraluz = new THREE.DirectionalLight("#b4a8ff", 0.45);
    contraluz.position.set(-8, 6, -10);
    cena.add(contraluz);

    const p = criarPecas();
    const texturas = { cine: texturaDeTexto("CINE", { largura: 128, alturaT: 384, fonte: "bold 92px Georgia, serif" }), cachoeira: texturaDaCachoeira() };
    // o "CINE" na vertical: uma letra embaixo da outra
    {
      const c = texturas.cine.image;
      const x = c.getContext("2d");
      x.fillStyle = "#701a1e"; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = "#fff7d6"; x.font = "bold 80px Georgia, serif"; x.textAlign = "center"; x.textBaseline = "middle";
      ["C", "I", "N", "E"].forEach((l, i) => x.fillText(l, c.width / 2, 52 + i * 92));
      texturas.cine.needsUpdate = true;
    }
    const sombrear = (obj, recebe = true) => obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = recebe; } });

    const ilha = new THREE.Group();
    cena.add(ilha);

    // ---- o terreno, a saia de terra e o penhasco em camadas
    const { terreno, saia } = malhaDoTerreno();
    const chao = new THREE.Mesh(terreno, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    chao.receiveShadow = true;
    ilha.add(chao);
    ilha.add(new THREE.Mesh(saia, p.mat(COR.terra)));
    const camadas = [[RAIO * 0.985, RAIO * 0.86, 1.1, COR.terraEscura], [RAIO * 0.86, RAIO * 0.62, 1.5, COR.rocha], [RAIO * 0.62, RAIO * 0.34, 1.7, COR.rochaEscura]];
    let yC = -0.95;
    for (const [rc, rb, a, cor] of camadas) {
      ilha.add(p.em(p.cilindro(rc, rb, a, cor, 18), 0, yC - a / 2, 0));
      yC -= a;
    }
    const ponta = p.em(p.cone(RAIO * 0.34, 3.2, COR.rochaFunda, 12), 0, yC - 1.6, 0);
    ponta.rotation.x = Math.PI;
    ilha.add(ponta);
    const rr = sorteio(11);
    for (let i = 0; i < 9; i++) {
      // as pontas de pedra penduradas
      const a = rr() * Math.PI * 2, d = RAIO * (0.45 + rr() * 0.35), tam = 0.6 + rr() * 1.2;
      const c = p.em(p.cone(0.35 + rr() * 0.35, tam, rr() > 0.5 ? COR.rochaEscura : COR.rocha, 6), Math.sin(a) * d, -2.4 - rr() * 1.4 - tam / 2, Math.cos(a) * d);
      c.rotation.x = Math.PI;
      ilha.add(c);
    }

    // ---- a água: o lago, o riacho e a cachoeira que cai da borda
    const matAgua = new THREE.MeshStandardMaterial({ color: COR.agua, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.88, emissive: "#0b3a5c", emissiveIntensity: 0.25 });
    const lago = new THREE.Mesh(new THREE.CircleGeometry(LAGO.r + 0.25, 28), matAgua);
    lago.rotation.x = -Math.PI / 2;
    lago.position.set(LAGO.x, -0.1, LAGO.z);
    ilha.add(lago);
    const comprimento = RAIO - LAGO.z + 0.1;
    const riacho = new THREE.Mesh(new THREE.PlaneGeometry(0.62, comprimento), matAgua);
    riacho.rotation.x = -Math.PI / 2;
    riacho.position.set(0, -0.1, LAGO.z + comprimento / 2);
    ilha.add(riacho);
    const cachoeira = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 5.5), new THREE.MeshBasicMaterial({ map: texturas.cachoeira, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    cachoeira.position.set(0, -0.1 - 2.75, RAIO + 0.12);
    ilha.add(cachoeira);
    const nevoa = [];
    for (let i = 0; i < 5; i++) {
      const n = p.em(new THREE.Mesh(new THREE.SphereGeometry(0.22 + i * 0.05, 8, 6), new THREE.MeshBasicMaterial({ color: "#e0f2fe", transparent: true, opacity: 0.35 })), (i - 2) * 0.16, -5.4 - (i % 2) * 0.2, RAIO + 0.2);
      ilha.add(n);
      nevoa.push(n);
    }
    for (let i = 0; i < 9; i++) {
      // as pedrinhas na margem do lago
      const a = (i / 9) * Math.PI * 2 + 0.3;
      if (Math.abs(Math.sin(a)) < 0.25 && Math.cos(a) > 0) continue; // a saída do riacho
      const pd = p.em(new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + (i % 3) * 0.05), p.mat(i % 2 ? COR.rocha : COR.pedra)), LAGO.x + Math.sin(a) * (LAGO.r + 0.35), 0.0, LAGO.z + Math.cos(a) * (LAGO.r + 0.35));
      ilha.add(pd);
    }

    // ---- a praça: o piso em anéis de pedra, os bancos e o livro aberto no meio
    for (let anel = 0; anel < 2; anel++) {
      const raio = 1.35 + anel * 0.85, n = 18 + anel * 10;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const pedra = p.caixa(0.5, 0.05, 0.36, anel ? COR.pedra : COR.pedraClara);
        ilha.add(emVolta(pedra, a, raio, 0.045));
        pedra.receiveShadow = true;
      }
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4 + 0.35;
      const banco = new THREE.Group();
      banco.add(p.em(p.caixa(0.7, 0.06, 0.24, COR.madeira), 0, 0.26, 0));
      banco.add(p.em(p.caixa(0.7, 0.22, 0.05, COR.madeira), 0, 0.42, -0.11));
      for (const x of [-0.28, 0.28]) banco.add(p.em(p.caixa(0.05, 0.26, 0.2, "#4b5563"), x, 0.13, 0));
      emVolta(banco, a + Math.PI, 2.45, 0);
      banco.position.set(Math.sin(a) * 2.45, 0, Math.cos(a) * 2.45);
      banco.rotation.y = a + Math.PI;
      sombrear(banco);
      ilha.add(banco);
    }
    const monumento = new THREE.Group();
    ilha.add(monumento);

    // ---- os caminhos de pedra e os postes de luz até cada construção
    const lampadas = [];
    for (const tipo of ORDEM_DOS_TIPOS) {
      const alvo = posicaoDe(tipo);
      const dir = alvo.clone().normalize();
      const lado = new THREE.Vector3(-dir.z, 0, dir.x);
      for (let d = PRACA - 0.1; d < RAIO_DAS_CONSTRUCOES - 1.25; d += 0.42) {
        const pd = p.caixa(0.62, 0.05, 0.32, (Math.round(d * 10) % 2) ? COR.pedra : COR.pedraClara);
        pd.position.set(dir.x * d, 0.04, dir.z * d);
        pd.rotation.y = (ANGULO[tipo] * Math.PI) / 180;
        pd.receiveShadow = true;
        ilha.add(pd);
      }
      for (const s of [-1, 1]) {
        const poste = new THREE.Group();
        poste.add(p.em(p.cilindro(0.035, 0.05, 0.95, "#374151", 6), 0, 0.475, 0));
        poste.add(p.em(p.caixa(0.16, 0.04, 0.16, "#374151"), 0, 0.97, 0));
        const lampada = p.em(p.esfera(0.08, "#fff3c4", { emissive: "#ffd36b", emissiveIntensity: 1.4 }), 0, 1.07, 0);
        poste.add(lampada);
        lampadas.push(lampada);
        const pos = dir.clone().multiplyScalar(PRACA + 1.05).addScaledVector(lado, s * 0.62);
        poste.position.copy(pos);
        sombrear(poste);
        ilha.add(poste);
      }
    }

    // ---- as árvores (pinheiros e copas redondas), pedras, arbustos e flores, fora do chão plano
    const r = sorteio(7);
    let plantadas = 0;
    for (let tentativa = 0; tentativa < 900 && plantadas < 64; tentativa++) {
      const a = r() * Math.PI * 2, d = 3.2 + r() * (RAIO - 3.7);
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (plano(x, z) > 0.05 || Math.hypot(x - LAGO.x, z - LAGO.z) < LAGO.r + 0.8 || distAoSegmento(x, z, LAGO.x, LAGO.z, 0, RAIO) < 0.9) continue;
      const y = altura(x, z);
      const tipoDeCoisa = r();
      const coisa = new THREE.Group();
      if (tipoDeCoisa < 0.42) {
        const alto = 0.9 + r() * 0.8;
        coisa.add(p.em(p.cilindro(0.07, 0.1, 0.4, COR.tronco, 6), 0, 0.2, 0));
        for (let k = 0; k < 3; k++) coisa.add(p.em(p.cone(0.55 - k * 0.13, alto * 0.55, k % 2 ? COR.folhaEscura : COR.folha, 7), 0, 0.45 + k * alto * 0.28, 0));
      } else if (tipoDeCoisa < 0.72) {
        coisa.add(p.em(p.cilindro(0.07, 0.11, 0.6, COR.tronco, 6), 0, 0.3, 0));
        const copa = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + r() * 0.2, 0), p.mat(r() > 0.5 ? COR.folhaClara : COR.folha));
        copa.position.y = 0.85;
        coisa.add(copa);
      } else if (tipoDeCoisa < 0.84) {
        const pedra = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + r() * 0.25, 0), p.mat(r() > 0.5 ? COR.rocha : COR.rochaEscura));
        pedra.position.y = 0.1;
        pedra.rotation.set(r(), r(), r());
        coisa.add(pedra);
      } else if (tipoDeCoisa < 0.93) {
        coisa.add(p.em(new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), p.mat(COR.folhaEscura)), 0, 0.15, 0));
      } else {
        const cores = ["#f472b6", "#facc15", "#f8fafc", "#a78bfa"];
        for (let k = 0; k < 6; k++) coisa.add(p.em(p.esfera(0.05, cores[k % cores.length], {}, 6, 4), (r() - 0.5) * 0.5, 0.06, (r() - 0.5) * 0.5));
      }
      coisa.position.set(x, y - 0.03, z);
      coisa.scale.setScalar(0.9 + r() * 0.5);
      sombrear(coisa, false);
      ilha.add(coisa);
      plantadas += 1;
    }

    // ---- as nuvens e as ilhotas em volta
    const nuvens = [];
    const matNuvem = new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 1, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 6; i++) {
      const n = new THREE.Group();
      for (let k = 0; k < 4; k++) n.add(p.em(new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + (k % 2) * 0.35, 0), matNuvem), k * 0.75 - 1.1, (k % 2) * 0.25, (k % 3) * 0.2));
      const a = (i / 6) * Math.PI * 2;
      n.userData = { a, d: 15 + (i % 3) * 3, y: -2.5 + (i % 3) * 3.2, v: 0.02 + (i % 2) * 0.012 };
      cena.add(n);
      nuvens.push(n);
    }
    for (let i = 0; i < 3; i++) {
      const ilhota = new THREE.Group();
      ilhota.add(p.em(p.cilindro(0.9, 0.85, 0.3, COR.grama, 9), 0, 0, 0));
      const pd = p.em(p.cone(0.85, 1.6, COR.rocha, 8), 0, -0.95, 0);
      pd.rotation.x = Math.PI;
      ilhota.add(pd);
      ilhota.add(p.em(p.cone(0.35, 0.8, COR.folha, 7), 0.1, 0.55, 0));
      const a = (i / 3) * Math.PI * 2 + 0.6;
      ilhota.position.set(Math.sin(a) * 14, -1 + i * 1.4, Math.cos(a) * 14 - 2);
      ilhota.userData.base = ilhota.position.y;
      cena.add(ilhota);
      nuvens.push(ilhota);
    }

    // ---- as construções (refeitas quando o nível muda)
    const construcoes = {};
    function montarConstrucao(tipo, nivel) {
      const velha = construcoes[tipo];
      if (velha) { ilha.remove(velha); velha.traverse((o) => o.geometry?.dispose()); }
      const g = CONSTRUIR[tipo](p, Math.max(1, nivel), texturas);
      const pos = posicaoDe(tipo);
      g.position.copy(pos);
      g.scale.setScalar(ESCALA_DAS_CONSTRUCOES);
      g.rotation.y = Math.atan2(-pos.x, -pos.z); // a frente (+z) virada para a praça
      g.userData.altura *= ESCALA_DAS_CONSTRUCOES;
      g.userData.tipo = tipo;
      g.traverse((o) => { o.userData.tipo = tipo; });
      sombrear(g);
      ilha.add(g);
      construcoes[tipo] = g;
    }

    // ---- o papel: funcionários e avatares (planos que sempre olham para a câmera)
    const geoPapel = new THREE.PlaneGeometry(1, 1);
    const matSombra = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.2, depthWrite: false });
    const geoSombra = new THREE.CircleGeometry(0.36, 16);
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
      sombra.position.y = 0.05;
      sombra.scale.setScalar(lado / 1.1);
      grupo.add(sombra);
      plano.position.y = lado / 2;
      folhas.push(grupo);
      return { grupo, plano, tex, m, lado };
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
    for (const tipo of ORDEM_DOS_TIPOS) {
      const f = folhaDePapel(1.55);
      const porta = posicaoDe(tipo, RAIO_DAS_CONSTRUCOES - 2.0);
      const lado = new THREE.Vector3(-porta.z, 0, porta.x).normalize().multiplyScalar(0.95);
      f.grupo.position.copy(porta).add(lado);
      f.plano.userData.funcionario = tipo;
      carregar(f, urlDoFuncionario(CONSTRUCOES_DO_ACERVO[tipo].personagem.id));
      ilha.add(f.grupo);
    }
    let andarilhos = [];
    const texturasDosAvatares = new Map(); // personagem → canvas de papel
    function montarAndarilhos(lista) {
      for (const a of andarilhos) { ilha.remove(a.grupo); a.m.dispose(); a.tex.dispose(); }
      const velhos = new Set(andarilhos.map((a) => a.grupo));
      for (let i = folhas.length - 1; i >= 0; i--) if (velhos.has(folhas[i])) folhas.splice(i, 1);
      andarilhos = lista.map((c, i) => {
        const f = folhaDePapel(1.25);
        f.plano.userData.contribuidor = c.id;
        const ra = sorteio(hashDe(c.id));
        const tipos = ORDEM_DOS_TIPOS.filter((t) => (c.porTipo?.[t] || 0) > 0);
        const casa = tipos.length ? tipos : ORDEM_DOS_TIPOS;
        const ang = ra() * Math.PI * 2, d = 0.6 + ra() * 1.6;
        const inicio = new THREE.Vector3(Math.sin(ang) * d, 0, Math.cos(ang) * d);
        f.grupo.position.copy(inicio);
        const tela = texturasDosAvatares.get(c.personagem);
        if (tela) carregar(f, tela);
        ilha.add(f.grupo);
        return { ...f, id: c.id, personagem: c.personagem, rr: ra, casa, alvo: inicio.clone(), pausa: ra() * 2, olhando: 1, indice: i };
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
        const porta = posicaoDe(t, RAIO_DAS_CONSTRUCOES - 2.2);
        a.alvo.set(porta.x + (a.rr() - 0.5) * 0.8, 0, porta.z + (a.rr() - 0.5) * 0.8);
      } else {
        const ang = a.rr() * Math.PI * 2, d = 0.9 + a.rr() * 1.4;
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
      const longe = l / h < 1.25 ? 1 + (1.25 - l / h) * 0.75 : 1;
      camera.position.set(0, 10.5 * longe, 19.5 * longe);
      camera.lookAt(0, 0.4, 0);
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
      ilha.rotation.y += dx * 0.007;
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
        if (!arrastando) ilha.rotation.y += dt * 0.035;
        texturas.cachoeira.offset.y -= dt * 0.9;
        matAgua.emissiveIntensity = 0.22 + Math.sin(t * 1.7) * 0.06;
        nevoa.forEach((n, i) => { n.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.15); });
        lampadas.forEach((l, i) => { l.material.emissiveIntensity = 1.3 + Math.sin(t * 3 + i) * 0.08; });
        for (const n of nuvens) {
          const u = n.userData;
          if (u.d) { u.a += dt * u.v; n.position.set(Math.sin(u.a) * u.d, u.y + Math.sin(t * 0.4 + u.d) * 0.2, Math.cos(u.a) * u.d); }
          else n.position.y = u.base + Math.sin(t * 0.6 + n.position.x) * 0.25;
        }
        for (const a of andarilhos) {
          if (a.pausa > 0) { a.pausa -= dt; if (a.pausa <= 0) novoAlvo(a); continue; }
          const d = v.copy(a.alvo).sub(a.grupo.position);
          const dist = d.length();
          if (dist < 0.05) { a.pausa = 0.8 + a.rr() * 2; continue; }
          d.normalize().multiplyScalar(Math.min(dist, dt * 0.85));
          a.grupo.position.add(d);
          a.plano.position.y = a.lado / 2 + Math.abs(Math.sin(t * 9 + a.indice)) * 0.06;
        }
      }
      // o papel sempre de frente para a câmera (a ilha só gira em volta do eixo Y)
      for (const f of folhas) f.rotation.y = -ilha.rotation.y;
      // os andarilhos "viram a folha" conforme andam para a esquerda ou a direita da tela
      for (const a of andarilhos) {
        const dirX = Math.cos(ilha.rotation.y) * (a.alvo.x - a.grupo.position.x) + Math.sin(ilha.rotation.y) * (a.alvo.z - a.grupo.position.z);
        if (Math.abs(dirX) > 0.02 && a.pausa <= 0) a.olhando = dirX < 0 ? -1 : 1;
        a.plano.scale.x = a.lado * a.olhando;
      }
      renderer.render(cena, camera);
      // os rótulos das construções acompanham a ilha; quando dois se encostam, o de trás sobe e o
      // da frente fica por cima
      const r3 = el.getBoundingClientRect();
      const pontos = [];
      for (const tipo of ORDEM_DOS_TIPOS) {
        const g = construcoes[tipo], rot = rotulos.current[tipo];
        if (!g || !rot) continue;
        v.set(0, g.userData.altura / ESCALA_DAS_CONSTRUCOES + 0.15, 0);
        g.localToWorld(v);
        v.project(camera);
        pontos.push({ rot, x: ((v.x + 1) / 2) * r3.width, y: ((1 - v.y) / 2) * r3.height, z: v.z, l: rot.offsetWidth || 120, a: rot.offsetHeight || 30 });
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
        pt.rot.style.opacity = pt.z > 1 ? "0" : i >= 2 ? "0.82" : "1";
      });
    };
    laco();

    api.current = {
      montarConstrucao, montarAndarilhos, definirAvatar,
      montarMonumento: (nivel) => {
        while (monumento.children.length) { const c = monumento.children.pop(); c.traverse?.((o) => o.geometry?.dispose()); }
        const alto = 0.35 + nivel * 0.05;
        monumento.add(p.em(p.cilindro(0.75, 0.9, 0.16, COR.pedra, 10), 0, 0.08, 0));
        monumento.add(p.em(p.cilindro(0.5, 0.62, alto, COR.pedraClara, 10), 0, 0.16 + alto / 2, 0));
        const topo = 0.16 + alto;
        const escala = 1.0 + nivel * 0.07;
        const capa = p.caixa(1.2 * escala, 0.06, 0.82 * escala, "#7c2d12");
        capa.position.set(0, topo + 0.04, 0);
        const esq = p.caixa(0.56 * escala, 0.05, 0.76 * escala, COR.papel);
        esq.position.set(-0.27 * escala, topo + 0.14, 0);
        esq.rotation.z = 0.3;
        const dir = esq.clone();
        dir.position.x = 0.27 * escala;
        dir.rotation.z = -0.3;
        const fita = p.caixa(0.05, 0.02, 0.9 * escala, "#dc2626");
        fita.position.set(0.05, topo + 0.2, 0.1);
        monumento.add(capa, esq, dir, fita);
        sombrear(monumento);
      },
    };
    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      io.disconnect();
      cv.removeEventListener("pointerdown", baixo);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      cena.traverse((o) => { o.geometry?.dispose(); });
      for (const m of p.materiais.values()) m.dispose();
      Object.values(texturas).forEach((x) => x.dispose());
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
    <div className="ac-mundo">
      <div ref={caixa} className="ac-mundo__tela" />
      {ORDEM_DOS_TIPOS.map((t) => {
        const c = estado?.construcoes?.[t];
        return (
          <button key={t} type="button" ref={(e) => { rotulos.current[t] = e; }} className="ac-rotulo" onClick={() => aoEscolher?.(t)}>
            <span aria-hidden="true">{TIPOS_DE_MATERIAL[t].icone}</span>
            <span className="ac-rotulo__nome">{CONSTRUCOES_DO_ACERVO[t].nome}</span>
            <span className="ac-rotulo__nivel">nv {c?.nivel || 1}</span>
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
