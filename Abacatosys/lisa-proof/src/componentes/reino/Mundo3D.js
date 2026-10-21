"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Neuro, { usePersonagem } from "@/componentes/Neuro.js";
import { LUGARES, PRACA, RAIO_DA_MURALHA, montarCombate, passo as passoDoCombate, resultadoDo, DT, DURACAO_MAXIMA, raioDaIlha } from "@/dominio/combate.js";
import { CONSTRUCOES } from "@/dominio/reino.js";

/**
 * O Reino em 3D: uma ilha flutuante low poly com as construções, e o Neuro como um recorte de
 * papel 2D andando por ela (o jeito do Paper Mario: sempre de frente para a câmera, e quando
 * muda de lado ele "vira a folha").
 *
 * Tudo é desenhado com formas simples do Three.js (caixa, cilindro, cone), sem arquivo de
 * modelo para baixar: cada construção cresce com o nível — mais torres, cristais, tendas, muro.
 * O Neuro sai do próprio SVG do mascote (src/componentes/Neuro.js), renderizado fora da tela e
 * copiado para uma textura, com a borda branca de adesivo. Assim ele muda de humor junto com o
 * resto do app: `reagir("feliz", "...")` também chega aqui.
 *
 * Arrastar gira a ilha; clicar numa construção (ou no rótulo dela) chama `aoEscolher(chave)`.
 * Batalha: o evento de janela "reino-combate" ({ entrada, papel: "atacante" | "defensor",
 * resultado, titulo, aoTerminar }) roda na ilha o mesmo motor do servidor (src/dominio/combate.js)
 * e desenha cada passo. Quem ataca vê a ilha do rival. Quem aceita marca `detail.aceito = true` —
 * sem mundo 3D (ou com "reduzir movimento"), a tela mostra o resultado direto.
 * Sem WebGL, chama `aoFalhar()` e a tela volta para a vista plana. Com "reduzir movimento", o
 * Neuro fica parado na praça e as nuvens não andam.
 */

// ------------------------------------------------------------------ cores do mundo
const COR = {
  grama: "#7cc46a", gramaEscura: "#5fae55", terra: "#9c6b43", rocha: "#8d8f99", rochaEscura: "#6f717c",
  pedra: "#ddd5c6", pedraClara: "#ece6da", madeira: "#a0703f", madeiraEscura: "#6e4a2a", telhado: "#d0463f",
  ouro: "#f0be45", lona: "#efe6d2", vermelho: "#c8332f", folha: "#4fae63", folhaEscura: "#3c9356",
  praca: "#e2d3ae", porta: "#3a2a1e", entrada: "#2a2420", trilho: "#6b6b6b", placa: "#e2c58f", telhadoVerde: "#3f8f5a",
};

const FALAS = ["Faz cócegas! 😆", "Esse reino tá ficando lindo!", "Bora estudar pra construir mais? 🧠", "Ei! Eu sou de papel, cuidado! 📄", "Vamos invadir alguém hoje? ⚔️"];

function aleatorio(semente) {
  let a = semente;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ------------------------------------------------------------------ peças
function criarPecas() {
  const materiais = new Map();
  const janela = new THREE.MeshStandardMaterial({ color: "#3b3b4f", flatShading: true, roughness: 0.6, emissive: "#000000" });
  const mat = (cor) => {
    if (!materiais.has(cor)) materiais.set(cor, new THREE.MeshStandardMaterial({ color: cor, flatShading: true, roughness: 0.92, metalness: 0 }));
    return materiais.get(cor);
  };
  const brilho = (cor) => {
    const chave = `brilho:${cor}`;
    if (!materiais.has(chave)) materiais.set(chave, new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 0.9, flatShading: true, roughness: 0.4 }));
    return materiais.get(chave);
  };
  const malha = (geo, cor, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, typeof cor === "string" ? mat(cor) : cor);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const caixa = (w, h, d, cor, x, y, z) => malha(new THREE.BoxGeometry(w, h, d), cor, x, y, z);
  const cilindro = (rt, rb, h, seg, cor, x, y, z) => malha(new THREE.CylinderGeometry(rt, rb, h, seg), cor, x, y, z);
  const cone = (r, h, seg, cor, x, y, z) => malha(new THREE.ConeGeometry(r, h, seg), cor, x, y, z);
  const bandeira = (g, x, y, z, cor) => {
    g.add(cilindro(0.025, 0.025, 0.6, 5, COR.madeiraEscura, x, y + 0.3, z));
    g.add(caixa(0.34, 0.2, 0.02, cor, x + 0.18, y + 0.5, z));
  };
  return { materiais, janela, mat, brilho, malha, caixa, cilindro, cone, bandeira };
}

// ------------------------------------------------------------------ construções (nível 0 a 5)
// Cada nível tem um ACABAMENTO próprio, igual para todas as construções — dá para ver de longe o
// nível de cada uma: madeira e palha (1), pedra e telha vermelha (2), pedra clara com bandeiras
// (3), pedra reforçada, telhado azul e ouro (4), mármore, telhado dourado e cristal que brilha (5).
// Em cima disso, cada construção ganha peças próprias a cada nível.
const ACABAMENTOS = [
  null,
  { parede: "#b07a45", clara: "#c99560", telhado: "#d9b26f", detalhe: "#6e4a2a", metal: "#7a7f87", bandeira: "#c8332f" },
  { parede: "#cfc7b8", clara: "#e2dccf", telhado: "#c0392b", detalhe: "#8a7f6f", metal: "#7a7f87", bandeira: "#c8332f" },
  { parede: "#e8e2d6", clara: "#f4f0e8", telhado: "#2e7d4f", detalhe: "#a89b84", metal: "#9aa3ad", bandeira: "#2f6fd6" },
  { parede: "#8f96a3", clara: "#aab1bd", telhado: "#2f4f9e", detalhe: "#f0be45", metal: "#f0be45", bandeira: "#7c4dff" },
  { parede: "#f7f4ee", clara: "#ffffff", telhado: "#f0be45", detalhe: "#f0be45", metal: "#f0be45", bandeira: "#7c4dff", brilho: "#8be9ff" },
];
const A = (n) => ACABAMENTOS[Math.max(1, Math.min(5, n || 1))];

/** Os enfeites do nível: bandeira (3+), faixa de ouro (4+), cristal flutuando (5). */
function enfeitar(p, g, n, topo, largura = 1) {
  const a = A(n);
  if (n >= 3) p.bandeira(g, 0, topo, 0, a.bandeira);
  if (n >= 4) g.add(p.cilindro(0.55 * largura, 0.55 * largura, 0.05, 10, COR.ouro, 0, Math.max(0.3, topo * 0.45), 0));
  if (n >= 5) {
    const c = p.malha(new THREE.OctahedronGeometry(0.16, 0), p.brilho(a.brilho), 0, topo + 0.95, 0);
    c.scale.y = 1.6;
    c.userData.gira = true;
    g.add(c);
  }
}

function terrenoVazio(p) {
  const g = new THREE.Group();
  g.add(p.caixa(1.5, 0.05, 1.5, "#b48b5a", 0, 0.025, 0));
  for (const [x, z] of [[-0.68, -0.68], [0.68, -0.68], [-0.68, 0.68], [0.68, 0.68]]) g.add(p.caixa(0.07, 0.36, 0.07, COR.madeira, x, 0.18, z));
  g.add(p.caixa(0.06, 0.5, 0.06, COR.madeira, 0.3, 0.25, 0.56));
  g.add(p.caixa(0.44, 0.26, 0.04, COR.placa, 0.3, 0.5, 0.58));
  return g;
}

function castelo(p, n) {
  const g = new THREE.Group();
  const a = A(n);
  const h = 0.9 + 0.32 * n;
  g.add(p.caixa(1.7, h, 1.5, a.parede, 0, h / 2, 0));
  for (const [x, z] of [[-0.7, -0.62], [0, -0.62], [0.7, -0.62], [-0.7, 0.62], [0, 0.62], [0.7, 0.62], [-0.7, 0], [0.7, 0]]) {
    // nível 1 é paliçada de madeira: estacas pontudas em vez de ameias
    if (n === 1) g.add(p.cone(0.12, 0.3, 5, a.detalhe, x, h + 0.15, z));
    else g.add(p.caixa(0.26, 0.22, 0.26, a.parede, x, h + 0.11, z));
  }
  g.add(p.caixa(0.44, 0.64, 0.06, COR.porta, 0, 0.32, 0.76));
  if (n >= 2) g.add(p.caixa(0.56, 0.08, 0.08, a.detalhe, 0, 0.68, 0.78));
  for (let i = 0; i < Math.min(3, n); i++) {
    g.add(p.caixa(0.18, 0.24, 0.05, p.janela, -0.5 + i * 0.5, h * 0.66, 0.76));
    g.add(p.caixa(0.05, 0.24, 0.18, p.janela, 0.86, h * 0.66, -0.4 + i * 0.4));
  }
  const cantos = [[0.85, 0.75], [-0.85, 0.75], [0.85, -0.75], [-0.85, -0.75]].slice(0, Math.min(4, n + 1));
  for (const [x, z] of cantos) {
    const ht = h + 0.45;
    g.add(p.cilindro(0.3, 0.34, ht, 7, a.clara, x, ht / 2, z));
    g.add(p.cone(0.44, 0.75, 7, a.telhado, x, ht + 0.37, z));
  }
  if (n >= 3) {
    g.add(p.cilindro(0.38, 0.42, 0.7, 8, a.clara, 0, h + 0.35, 0));
    g.add(p.cone(0.56, 1.0, 8, a.telhado, 0, h + 1.2, 0));
  }
  if (n >= 4) g.add(p.caixa(1.76, 0.07, 1.56, COR.ouro, 0, h - 0.05, 0));
  if (n >= 3) p.bandeira(g, 0, h + 1.65, 0, a.bandeira);
  if (n >= 5) {
    const c = p.malha(new THREE.OctahedronGeometry(0.2, 0), p.brilho(a.brilho), 0, h + 2.6, 0);
    c.scale.y = 1.6; c.userData.gira = true;
    g.add(c);
  }
  return g;
}

function mina(p, n) {
  const g = new THREE.Group();
  const a = A(n);
  const morro = p.malha(new THREE.DodecahedronGeometry(1, 0), COR.rocha, 0, 0.42, 0);
  morro.scale.set(1.25, 0.8, 1.05);
  g.add(morro);
  g.add(p.caixa(0.5, 0.55, 0.3, COR.entrada, 0, 0.28, 0.86));
  g.add(p.caixa(0.09, 0.68, 0.09, a.parede, -0.3, 0.34, 1.0));
  g.add(p.caixa(0.09, 0.68, 0.09, a.parede, 0.3, 0.34, 1.0));
  g.add(p.caixa(0.74, 0.1, 0.12, a.detalhe, 0, 0.68, 1.0));
  g.add(p.caixa(0.05, 0.03, 1.1, COR.trilho, -0.13, 0.02, 1.55));
  g.add(p.caixa(0.05, 0.03, 1.1, COR.trilho, 0.13, 0.02, 1.55));
  g.add(p.caixa(0.42, 0.26, 0.32, a.detalhe, 0, 0.18, 1.8));
  g.add(p.caixa(0.34, 0.08, 0.24, COR.ouro, 0, 0.34, 1.8));
  if (n >= 3) { g.add(p.cilindro(0.04, 0.04, 0.9, 5, a.detalhe, 0.55, 1.1, 0.4)); g.add(p.caixa(0.5, 0.05, 0.05, a.detalhe, 0.35, 1.5, 0.4)); } // guindaste
  const cristais = [[-0.6, 0.78, 0.35], [0.55, 0.82, 0.3], [0, 1.08, -0.15], [-0.4, 0.62, -0.62], [0.72, 0.5, -0.4]];
  cristais.slice(0, n).forEach(([x, y, z], i) => {
    const c = p.malha(new THREE.OctahedronGeometry(0.17, 0), n >= 5 ? p.brilho("#ffd34d") : COR.ouro, x, y, z);
    c.rotation.set(0.3 * i, 0.7 * i, 0.2);
    c.scale.y = 1.5;
    g.add(c);
  });
  g.scale.setScalar(0.85 + 0.07 * n);
  return g;
}

function cofre(p, n) {
  const g = new THREE.Group();
  const a = A(n);
  g.add(p.caixa(1.3, 0.85, 1.1, a.clara, 0, 0.425, 0));
  g.add(p.caixa(1.38, 0.1, 1.18, a.metal, 0, 0.86, 0));
  g.add(p.malha(new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), n >= 4 ? COR.ouro : a.telhado, 0, 0.9, 0));
  g.add(p.caixa(0.34, 0.5, 0.05, a.metal, 0, 0.25, 0.56));
  for (const x of [-0.45, 0.45]) g.add(p.cilindro(0.07, 0.07, 0.8, 6, a.parede, x, 0.4, 0.6));
  const pilhas = [[0.9, 0.4], [1.08, 0.02], [0.92, -0.36], [-0.9, 0.38], [-1.05, -0.05]];
  pilhas.slice(0, n).forEach(([x, z], i) => {
    const hh = 0.08 * (2 + i);
    g.add(p.cilindro(0.14, 0.14, hh, 8, COR.ouro, x, hh / 2, z));
  });
  if (n >= 5) { const c = p.malha(new THREE.OctahedronGeometry(0.14, 0), p.brilho(a.brilho), 0, 1.75, 0); c.scale.y = 1.6; c.userData.gira = true; g.add(c); }
  g.scale.setScalar(0.85 + 0.05 * n);
  return g;
}

function torre(p, n) {
  const g = new THREE.Group();
  const a = A(n);
  const h = 1.1 + 0.3 * n;
  g.add(p.cilindro(0.56, 0.62, 0.32, 6, a.clara, 0, 0.16, 0));
  g.add(p.cilindro(0.42, 0.52, h, 6, a.parede, 0, h / 2, 0));
  g.add(p.cilindro(0.74, 0.74, 0.12, 6, a.detalhe, 0, h + 0.06, 0));
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    g.add(p.caixa(0.06, 0.32, 0.06, a.detalhe, Math.cos(ang) * 0.64, h + 0.28, Math.sin(ang) * 0.64));
  }
  if (n >= 2) g.add(p.cone(0.86, 0.75, 6, a.telhado, 0, h + 0.82, 0));
  enfeitar(p, g, n, h + 1.15, 0.9);
  g.add(p.caixa(0.05, 0.5, 0.05, COR.madeira, 0.95, 0.25, 0.35));
  const alvo = p.cilindro(0.24, 0.24, 0.05, 12, "#f4f1ea", 0.95, 0.55, 0.38);
  alvo.rotation.x = Math.PI / 2;
  g.add(alvo);
  const miolo = p.cilindro(0.1, 0.1, 0.06, 10, COR.vermelho, 0.95, 0.55, 0.39);
  miolo.rotation.x = Math.PI / 2;
  g.add(miolo);
  return g;
}

function quartel(p, n) {
  const g = new THREE.Group();
  const a = A(n);
  const tendas = [[0, 0], [-0.9, -0.55], [0.85, -0.6]].slice(0, Math.min(3, Math.ceil(n / 2)));
  tendas.forEach(([x, z], i) => {
    const t = p.cone(0.62, 0.95, 4, i % 2 ? a.bandeira : a.clara, x, 0.475, z);
    t.rotation.y = Math.PI / 4;
    g.add(t);
    g.add(p.caixa(0.22, 0.34, 0.04, COR.porta, x, 0.17, z + 0.44));
  });
  g.add(p.cilindro(0.03, 0.03, 1.7, 6, a.detalhe, 0.85, 0.85, 0.6));
  g.add(p.caixa(0.46, 0.28, 0.03, a.bandeira, 1.09, 1.52, 0.6));
  if (n >= 2) {
    g.add(p.cilindro(0.07, 0.07, 0.7, 6, COR.madeira, -0.85, 0.35, 0.7));
    g.add(p.caixa(0.5, 0.07, 0.07, COR.madeira, -0.85, 0.52, 0.7));
    g.add(p.malha(new THREE.IcosahedronGeometry(0.14, 0), COR.placa, -0.85, 0.82, 0.7));
  }
  if (n >= 3) for (let i = 0; i < 7; i++) g.add(p.cone(0.06, 0.4, 4, a.detalhe, -1.2 + i * 0.4, 0.2, -1.05)); // paliçada
  if (n >= 4) {
    g.add(p.caixa(0.7, 0.08, 0.1, a.detalhe, 0, 0.5, 0.95));
    for (let i = 0; i < 4; i++) g.add(p.cilindro(0.02, 0.02, 0.9, 4, a.metal, -0.27 + i * 0.18, 0.45, 0.98));
  }
  if (n >= 5) { const c = p.malha(new THREE.OctahedronGeometry(0.16, 0), p.brilho(a.brilho), 0.85, 2.0, 0.6); c.scale.y = 1.6; c.userData.gira = true; g.add(c); }
  return g;
}

/** A muralha cerca a Torre do Neuro: paliçada de madeira no nível 1, depois pedra cada vez mais alta. */
function muralha(p, n) {
  const g = new THREE.Group();
  const a = A(n);
  const [cx, cz] = LUGARES.castelo;
  const trechos = 16;
  const passoA = (Math.PI * 2) / trechos;
  const pos = (ang) => [cx + Math.cos(ang) * RAIO_DA_MURALHA, cz + Math.sin(ang) * RAIO_DA_MURALHA];
  if (n === 0) {
    for (let i = 0; i < trechos; i += 2) {
      const [x, z] = pos(i * passoA);
      g.add(p.caixa(0.07, 0.32, 0.07, COR.madeira, x, 0.16, z));
    }
    return g;
  }
  const h = 0.35 + 0.1 * n;
  const comprimento = 2 * RAIO_DA_MURALHA * Math.sin(passoA / 2) + 0.05;
  for (let i = 0; i < trechos; i++) {
    const ang = (i + 0.5) * passoA;
    const [x, z] = pos(ang);
    const trecho = p.caixa(comprimento, h, 0.3, a.parede, x, h / 2, z);
    trecho.rotation.y = -ang + Math.PI / 2;
    g.add(trecho);
    if (n === 1) g.add(p.cone(0.09, 0.22, 4, a.detalhe, x, h + 0.11, z));
    else if (i % 2 === 0) {
      const ameia = p.caixa(comprimento * 0.4, 0.14, 0.32, a.parede, x, h + 0.07, z);
      ameia.rotation.y = trecho.rotation.y;
      g.add(ameia);
    }
    if (n >= 4 && i % 4 === 0) { const faixa = p.caixa(comprimento, 0.05, 0.32, COR.ouro, x, h * 0.6, z); faixa.rotation.y = trecho.rotation.y; g.add(faixa); }
  }
  const torres = n >= 3 ? 4 : 2;
  for (let i = 0; i < torres; i++) {
    const [x, z] = pos((i / torres) * Math.PI * 2 + Math.PI / 4);
    g.add(p.cilindro(0.24, 0.28, h + 0.35, 6, a.clara, x, (h + 0.35) / 2, z));
    g.add(p.cone(0.34, 0.45, 6, a.telhado, x, h + 0.58, z));
  }
  return g;
}

/** O Canhão: base que muda com o nível e um cano que vira para o alvo durante a batalha. */
function canhao(p, n) {
  const g = new THREE.Group();
  const a = A(n);
  g.add(p.cilindro(0.5, 0.6, 0.3, 8, a.clara, 0, 0.15, 0));
  if (n >= 3) g.add(p.cilindro(0.62, 0.62, 0.06, 8, a.detalhe, 0, 0.31, 0));
  const cano = new THREE.Group();
  cano.position.y = 0.42;
  const corDoTubo = n >= 4 ? a.metal : "#3a3f47";
  const tubo = p.cilindro(0.12 + 0.01 * n, 0.16 + 0.01 * n, 0.85, 8, corDoTubo, 0, 0.12, 0.28);
  tubo.rotation.x = Math.PI / 2.4;
  cano.add(p.caixa(0.36, 0.22, 0.4, a.detalhe, 0, 0, 0), tubo);
  if (n >= 3) {
    const tubo2 = p.cilindro(0.1, 0.13, 0.75, 8, corDoTubo, 0.2, 0.1, 0.24);
    tubo2.rotation.x = Math.PI / 2.4;
    cano.add(tubo2);
    tubo.position.x = -0.12;
  }
  g.add(cano);
  g.userData.cano = cano;
  for (let i = 0; i < Math.min(4, n + 1); i++) g.add(p.malha(new THREE.SphereGeometry(0.08, 6, 4), "#30343b", 0.45 - i * 0.12, 0.06, -0.45));
  if (n >= 5) { const c = p.malha(new THREE.OctahedronGeometry(0.12, 0), p.brilho(a.brilho), 0, 1.3, 0); c.scale.y = 1.6; c.userData.gira = true; g.add(c); }
  return g;
}

/** Biblioteca: produz moedas. Um andar a mais no nível 3, cúpula no 4, livros mágicos no 5. */
function biblioteca(p, n) {
  const g = new THREE.Group();
  const a = A(n);
  const h = 0.8 + (n >= 3 ? 0.5 : 0);
  g.add(p.caixa(1.3, h, 1.0, a.clara, 0, h / 2, 0));
  const telhado = p.cone(0.95, 0.6, 4, a.telhado, 0, h + 0.3, 0);
  telhado.rotation.y = Math.PI / 4;
  telhado.scale.set(1, 1, 0.8);
  g.add(telhado);
  for (const x of [-0.45, -0.15, 0.15, 0.45]) g.add(p.cilindro(0.05, 0.05, h * 0.85, 6, a.parede, x, h * 0.43, 0.55));
  g.add(p.caixa(0.3, 0.45, 0.05, COR.porta, 0, 0.23, 0.51));
  const cores = ["#c0392b", "#2f6fd6", "#2e7d4f", "#7c4dff", "#f0be45"];
  for (let i = 0; i < n + 1; i++) g.add(p.caixa(0.32, 0.08, 0.22, cores[i % 5], 0.95, 0.04 + i * 0.085, 0.2));
  if (n >= 4) g.add(p.malha(new THREE.SphereGeometry(0.32, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), COR.ouro, 0, h + 0.55, 0));
  if (n >= 5) for (let i = 0; i < 3; i++) { const l = p.caixa(0.2, 0.05, 0.14, p.brilho(cores[i + 2]), -0.5 + i * 0.5, h + 1.1 + (i % 2) * 0.15, 0); l.userData.gira = true; g.add(l); }
  return g;
}

/** Defesa Aérea: torre de lançadores, mais tubos a cada nível; radar no 3. */
function defesaAerea(p, n) {
  const g = new THREE.Group();
  const a = A(n);
  g.add(p.cilindro(0.55, 0.62, 0.35, 6, a.clara, 0, 0.17, 0));
  g.add(p.cilindro(0.3, 0.4, 0.5, 6, a.parede, 0, 0.6, 0));
  const lancador = new THREE.Group();
  lancador.position.y = 0.95;
  lancador.add(p.caixa(0.5, 0.25, 0.4, a.detalhe, 0, 0, 0));
  const tubos = Math.min(4, 1 + n);
  for (let i = 0; i < tubos; i++) {
    const tubo = p.cilindro(0.06, 0.06, 0.6, 6, n >= 4 ? a.metal : "#e8e8e8", -0.18 + (i % 2) * 0.36, 0.25, -0.05 + Math.floor(i / 2) * 0.18);
    tubo.rotation.x = -0.5;
    lancador.add(tubo);
    lancador.add(p.cone(0.06, 0.12, 6, COR.vermelho, tubo.position.x, 0.58, tubo.position.z - 0.17));
  }
  g.add(lancador);
  g.userData.cano = lancador;
  if (n >= 3) {
    const radar = p.malha(new THREE.SphereGeometry(0.22, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), "#d8dde3", 0.5, 0.75, -0.35);
    radar.rotation.x = Math.PI / 1.4;
    g.add(radar);
  }
  enfeitar(p, g, n, 1.25, 0.9);
  return g;
}

/** Morteiro: sacos de areia, um tubo largo apontando para o céu e bombas empilhadas. */
function morteiro(p, n) {
  const g = new THREE.Group();
  const a = A(n);
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    g.add(p.malha(new THREE.SphereGeometry(0.17, 6, 4), n >= 3 ? a.parede : "#c9b38a", Math.cos(ang) * 0.6, 0.12, Math.sin(ang) * 0.6));
  }
  if (n >= 3) for (let i = 0; i < 10; i++) { const ang = ((i + 0.5) / 10) * Math.PI * 2; g.add(p.malha(new THREE.SphereGeometry(0.15, 6, 4), a.clara, Math.cos(ang) * 0.6, 0.3, Math.sin(ang) * 0.6)); }
  const cano = new THREE.Group();
  cano.position.y = 0.3;
  const tubo = p.cilindro(0.2 + 0.015 * n, 0.25 + 0.015 * n, 0.55, 10, n >= 4 ? a.metal : "#3a3f47", 0, 0.2, 0.05);
  tubo.rotation.x = -0.35;
  cano.add(p.cilindro(0.3, 0.3, 0.12, 8, a.detalhe, 0, 0, 0), tubo);
  g.add(cano);
  g.userData.cano = cano;
  for (let i = 0; i < Math.min(5, n + 1); i++) g.add(p.malha(new THREE.SphereGeometry(0.1, 6, 4), "#22252a", -0.35 + (i % 3) * 0.12, 0.1 + Math.floor(i / 3) * 0.16, -0.35));
  enfeitar(p, g, n, 0.9, 1.1);
  return g;
}

/** Torre Mágica: torre fina com um orbe roxo flutuando e anéis que aumentam com o nível. */
function torreMagica(p, n) {
  const g = new THREE.Group();
  const a = A(n);
  const h = 1.3 + 0.25 * n;
  g.add(p.cilindro(0.5, 0.58, 0.3, 8, a.clara, 0, 0.15, 0));
  g.add(p.cilindro(0.28, 0.4, h, 8, a.parede, 0, h / 2, 0));
  g.add(p.cone(0.5, 0.7, 8, "#5b3fa8", 0, h + 0.35, 0));
  const orbe = p.malha(new THREE.IcosahedronGeometry(0.2, 1), p.brilho("#b388ff"), 0, h + 1.05, 0);
  orbe.userData.gira = true;
  g.add(orbe);
  for (let i = 0; i < Math.min(3, Math.ceil(n / 2)); i++) {
    const anel = p.malha(new THREE.TorusGeometry(0.32 + i * 0.08, 0.02, 4, 16), p.brilho("#d1b3ff"), 0, h + 1.05, 0);
    anel.rotation.x = Math.PI / 2 + i * 0.5;
    anel.userData.gira = true;
    g.add(anel);
  }
  if (n >= 4) g.add(p.cilindro(0.42, 0.42, 0.05, 8, COR.ouro, 0, h * 0.6, 0));
  if (n >= 3) p.bandeira(g, 0.35, h - 0.2, 0, a.bandeira);
  return g;
}

/** Torre do Raio: torre escura com bobinas e uma ponta que brilha. */
function torreRaio(p, n) {
  const g = new THREE.Group();
  const a = A(n);
  const h = 1.6 + 0.25 * n;
  g.add(p.cilindro(0.55, 0.65, 0.35, 6, a.clara, 0, 0.17, 0));
  g.add(p.cilindro(0.22, 0.34, h, 6, "#3a3f47", 0, h / 2, 0));
  for (let i = 0; i < 2 + n; i++) {
    const bobina = p.malha(new THREE.TorusGeometry(0.3 - i * 0.025, 0.04, 4, 12), a.metal === "#7a7f87" ? "#b87333" : a.metal, 0, 0.5 + i * ((h - 0.6) / (2 + n)), 0);
    bobina.rotation.x = Math.PI / 2;
    g.add(bobina);
  }
  const ponta = p.malha(new THREE.OctahedronGeometry(0.18, 0), p.brilho("#ffe066"), 0, h + 0.2, 0);
  ponta.userData.gira = true;
  g.add(ponta);
  if (n >= 3) p.bandeira(g, 0.3, h - 0.4, 0, a.bandeira);
  return g;
}

const CONSTRUTORES = { castelo, mina, cofre, torre, canhao, quartel, muralha, biblioteca, defesaAerea, morteiro, torreMagica, torreRaio };

function construir(p, chave, nivel) {
  const g = nivel > 0 || chave === "muralha" ? CONSTRUTORES[chave](p, nivel) : terrenoVazio(p);
  if (chave !== "muralha") {
    const [x, z] = LUGARES[chave];
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(PRACA[0] - x, PRACA[1] - z) * 0.5; // vira um pouco para a praça
  }
  g.userData.escalaBase = g.scale.x;
  g.traverse((o) => { o.userData.chave = chave; });
  return g;
}

function ancoraDe(chave, grupo) {
  const topo = new THREE.Box3().setFromObject(grupo).max.y;
  if (chave === "muralha") return new THREE.Vector3(LUGARES.castelo[0] + 1.24, Math.max(topo, 0.6) + 0.35, LUGARES.castelo[1] + 1.24);
  const [x, z] = LUGARES[chave];
  return new THREE.Vector3(x, topo + 0.35, z);
}

// ------------------------------------------------------------------ a ilha
/** A ilha do tamanho do Terreno: chão, praça, caminhos até as construções que cabem nela, árvores na beirada. */
function ilha(p, terreno = 0) {
  const g = new THREE.Group();
  const R = raioDaIlha(terreno);
  const cabe = (chave) => (CONSTRUCOES[chave]?.terreno || 0) <= terreno;
  const ondular = (geo) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const a = Math.atan2(z, x);
      const f = 1 + 0.04 * Math.sin(a * 3 + 1) + 0.03 * Math.sin(a * 5);
      pos.setX(i, x * f);
      pos.setZ(i, z * f);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const lados = 11 + 2 * terreno;
  const grama = p.malha(ondular(new THREE.CylinderGeometry(R + 0.1, R + 0.1, 0.25, lados)), COR.grama, 0, -0.125, 0);
  const terra = p.malha(ondular(new THREE.CylinderGeometry(R, R - 0.7, 1.0, lados)), COR.terra, 0, -0.75, 0);
  const fundo = p.malha(ondular(new THREE.ConeGeometry(R - 0.7, 3.2 + 0.3 * terreno, lados)), COR.rochaEscura, 0, -2.85 - 0.15 * terreno, 0);
  fundo.rotation.x = Math.PI;
  g.add(grama, terra, fundo);

  // praça e pedrinhas até cada construção
  g.add(p.cilindro(1.3, 1.3, 0.06, 9, COR.praca, PRACA[0], 0.03, PRACA[1]));
  for (const [chave, [x, z]] of Object.entries(LUGARES)) {
    if (!cabe(chave)) continue;
    for (let t = 0.3; t < 0.75; t += 0.15) {
      const px = PRACA[0] + (x - PRACA[0]) * t, pz = PRACA[1] + (z - PRACA[1]) * t;
      g.add(p.cilindro(0.17, 0.17, 0.04, 6, COR.praca, px, 0.02, pz));
    }
  }

  // árvores, pedras e arbustos, sempre no mesmo lugar
  const r = aleatorio(42);
  const arvore = (x, z, s) => {
    g.add(p.cilindro(0.08 * s, 0.11 * s, 0.45 * s, 5, COR.madeiraEscura, x, 0.22 * s, z));
    g.add(p.cone(0.48 * s, 0.75 * s, 6, COR.folha, x, 0.75 * s, z));
    g.add(p.cone(0.36 * s, 0.6 * s, 6, COR.folhaEscura, x, 1.12 * s, z));
  };
  const longeDasConstrucoes = (x, z, folga) => Object.entries(LUGARES).every(([chave, [lx, lz]]) => !cabe(chave) || Math.hypot(lx - x, lz - z) > folga);
  for (let i = 0; i < 9 + 5 * terreno; i++) {
    const a = (i % 2 ? Math.PI * (0.55 + r() * 0.3) : Math.PI * (1.6 + r() * 0.6)) + (r() - 0.5) * 0.2;
    const raio = R - 1.7 + r() * 1.3;
    const x = Math.cos(a) * raio, z = Math.sin(a) * raio;
    if (longeDasConstrucoes(x, z, 1.4)) arvore(x, z, 0.85 + r() * 0.5);
  }
  for (let i = 0; i < 7 + 3 * terreno; i++) {
    const a = r() * Math.PI * 2, raio = 2 + r() * (R - 2.4);
    const x = Math.cos(a) * raio, z = Math.sin(a) * raio;
    const longe = longeDasConstrucoes(x, z, 1.5) && Math.hypot(PRACA[0] - x, PRACA[1] - z) > 1.6;
    if (!longe) continue;
    const pedra = p.malha(new THREE.DodecahedronGeometry(0.18 + r() * 0.16, 0), i % 2 ? COR.rocha : COR.gramaEscura, x, 0.08, z);
    pedra.scale.y = 0.7;
    g.add(pedra);
  }
  return g;
}

function nuvens(p) {
  const g = new THREE.Group();
  // um pouco de brilho próprio: na sombra, nuvem branca virava pedra cinza
  const branco = new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 1, emissive: "#ffffff", emissiveIntensity: 0.4 });
  const r = aleatorio(7);
  for (let i = 0; i < 5; i++) {
    const n = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + r() * 0.35, 0), branco);
      b.position.set(k * 0.6 - 0.6, r() * 0.2, r() * 0.3);
      n.add(b);
    }
    const a = (i / 5) * Math.PI * 2 + r();
    n.userData = { a, raioBase: 9 + r() * 2.5, raio: 0, y: 2.6 + r() * 1.8 };
    n.userData.raio = n.userData.raioBase;
    n.position.set(Math.cos(a) * n.userData.raio, n.userData.y, Math.sin(a) * n.userData.raio);
    g.add(n);
  }
  p.materiais.set("nuvem", branco);
  return g;
}

// ------------------------------------------------------------------ o Neuro de papel
/** Copia o SVG do Neuro (com as cores calculadas pelo CSS) para uma imagem. */
function svgComoImagem(svg) {
  const copia = svg.cloneNode(true);
  const originais = svg.querySelectorAll("*");
  const copias = copia.querySelectorAll("*");
  originais.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const c = copias[i];
    for (const prop of ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "display"]) {
      const v = cs.getPropertyValue(prop);
      if (v) c.setAttribute(prop, v);
    }
    if (el.classList.contains("neuro__sombra")) c.setAttribute("display", "none");
    c.removeAttribute("class");
    c.removeAttribute("style");
  });
  copia.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copia.setAttribute("width", "400");
  copia.setAttribute("height", "400");
  copia.removeAttribute("class");
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(copia));
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = erro;
    img.src = url;
  });
}

/** A imagem com borda branca de adesivo e uma sombrinha de papel. */
function recorteDePapel(img) {
  const T = 512, margem = 30, lado = T - margem * 2;
  const silhueta = (cor) => {
    const c = document.createElement("canvas");
    c.width = c.height = T;
    const x = c.getContext("2d");
    x.drawImage(img, margem, margem, lado, lado);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = cor;
    x.fillRect(0, 0, T, T);
    return c;
  };
  const c = document.createElement("canvas");
  c.width = c.height = T;
  const ctx = c.getContext("2d");
  const sombra = silhueta("rgba(0,0,0,0.18)");
  const branca = silhueta("#ffffff");
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.drawImage(sombra, Math.cos(a) * 11 + 2, Math.sin(a) * 11 + 5);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.drawImage(branca, Math.cos(a) * 10, Math.sin(a) * 10);
  }
  ctx.drawImage(img, margem, margem, lado, lado);
  return c;
}

// ------------------------------------------------------------------ o componente
export default function Mundo3D({ construcoes, humor = "normal", aoEscolher, aoFalhar }) {
  const caixa = useRef(null);
  const molde = useRef(null);
  const rotulos = useRef({});
  const fala = useRef(null);
  const api = useRef(null);
  const [reacao, setReacao] = useState(null);
  const [texto, setTexto] = useState("");
  const [legenda, setLegenda] = useState(null);
  const legendaRef = useRef(null);
  legendaRef.current = setLegenda;
  const humorAtual = reacao?.humor || humor;
  const personagem = usePersonagem(); // trocou de personagem no Reino: a folha de papel é redesenhada
  const construcoesRef = useRef(construcoes);
  construcoesRef.current = construcoes;
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
    let sujo = true, visivel = true, quadroId = 0, antes = performance.now();
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderizador.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderizador.shadowMap.enabled = true;
    renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    renderizador.domElement.setAttribute("aria-hidden", "true");
    el.prepend(renderizador.domElement);

    const cena = new THREE.Scene();
    const p = criarPecas();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    const ceu = new THREE.HemisphereLight("#ffffff", "#7fb36a", 1.1);
    const sol = new THREE.DirectionalLight("#fff3dd", 1.7);
    sol.position.set(6, 11, 5);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
    sol.shadow.bias = -0.0008;
    cena.add(ceu, sol);

    const mundo = new THREE.Group();
    const ilhaAtual = { grupo: ilha(p, 0), terreno: 0 };
    mundo.add(ilhaAtual.grupo);
    const grupoNuvens = nuvens(p);
    /** Troca a ilha quando o Terreno muda (o meu, ou o do rival durante a minha invasão). */
    function definirTerreno(terreno) {
      const tt = Math.max(0, Math.min(3, terreno || 0));
      if (tt === ilhaAtual.terreno) return;
      mundo.remove(ilhaAtual.grupo);
      ilhaAtual.grupo.traverse((m) => m.geometry?.dispose());
      ilhaAtual.grupo = ilha(p, tt);
      ilhaAtual.terreno = tt;
      mundo.add(ilhaAtual.grupo);
      for (const n of grupoNuvens.children) n.userData.raio = n.userData.raioBase + 1.3 * tt;
      if (typeof enquadrar === "function") enquadrar();
      sujo = true;
    }
    cena.add(mundo, grupoNuvens);

    // construções
    const predios = new Map(); // chave → { grupo, nivel, ancora, nasceu }
    const camadaPredios = new THREE.Group();
    mundo.add(camadaPredios);
    const descartar = (o) => o.traverse((m) => m.geometry?.dispose());
    let girando = [];
    function atualizarConstrucoes(lista, animar = true) {
      for (const { chave, nivel } of lista) {
        if (chave === "terreno") { definirTerreno(nivel); continue; }
        if (!CONSTRUTORES[chave]) continue;
        const atual = predios.get(chave);
        if (atual && atual.nivel === nivel) continue;
        if (atual) { camadaPredios.remove(atual.grupo); descartar(atual.grupo); }
        const grupo = construir(p, chave, nivel);
        camadaPredios.add(grupo);
        predios.set(chave, { grupo, nivel, ancora: ancoraDe(chave, grupo), nasceu: atual && animar ? performance.now() : 0 });
      }
      girando = [];
      for (const info of predios.values()) info.grupo.traverse((o) => { if (o.userData.gira) girando.push(o); });
      sujo = true;
    }

    // o Neuro de papel
    const neuro = new THREE.Group();
    const textura = new THREE.CanvasTexture(document.createElement("canvas"));
    textura.colorSpace = THREE.SRGBColorSpace;
    const folha = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({ map: textura, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide })
    );
    folha.position.y = 0.75;
    folha.visible = false;
    folha.userData.neuro = true;
    const sombraNeuro = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.2, depthWrite: false }));
    sombraNeuro.rotation.x = -Math.PI / 2;
    sombraNeuro.position.y = 0.04;
    neuro.add(folha, sombraNeuro);
    neuro.position.set(PRACA[0], 0, PRACA[1]);
    mundo.add(neuro);

    const destinos = Object.values(LUGARES).map(([x, z]) => [PRACA[0] + (x - PRACA[0]) * 0.55, PRACA[1] + (z - PRACA[1]) * 0.55]);
    destinos.push(PRACA);
    const andar = { destino: null, espera: 1.5, viradoPara: 1, pulo: 0, vy: 0 };

    // câmera: orbita em volta do centro; o enquadramento cabe a ilha em qualquer ângulo
    const vista = { azimute: Math.PI / 4, alvoAzimute: Math.PI / 4, elevacao: 0.56, distancia: 30 };
    const centro = new THREE.Vector3(0, 0.2, 0);
    let enquadre = { meiaL: 8, meiaA: 5, cy: 0 };
    function posicionarCamera() {
      const { azimute: a, elevacao: e, distancia: d } = vista;
      camera.position.set(Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d).add(centro);
      camera.lookAt(centro);
      camera.updateMatrixWorld();
    }
    function enquadrar() {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      const aspecto = w / h;
      const cantos = [];
      const R = raioDaIlha(ilhaAtual.terreno) + 0.4;
      for (const x of [-R, R]) for (const y of [-2.0, 3.6]) for (const z of [-R, R]) cantos.push(new THREE.Vector3(x, y, z));
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const guardado = vista.azimute;
      for (let i = 0; i < 12; i++) {
        vista.azimute = (i / 12) * Math.PI * 2;
        posicionarCamera();
        for (const c of cantos) {
          const v = c.clone().applyMatrix4(camera.matrixWorldInverse);
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        }
      }
      vista.azimute = guardado;
      let meiaL = ((maxX - minX) / 2) * 0.68; // a ilha é redonda: as quinas da caixa sobram
      let meiaA = ((maxY - minY) / 2) * 0.68;
      if (meiaL / meiaA > aspecto) meiaA = meiaL / aspecto; else meiaL = meiaA * aspecto;
      enquadre = { meiaL, meiaA, cy: (maxY + minY) / 2 };
      Object.assign(camera, { left: -meiaL, right: meiaL, top: meiaA + enquadre.cy, bottom: -meiaA + enquadre.cy });
      camera.updateProjectionMatrix();
      renderizador.setSize(w, h, false);
      posicionarCamera();
      sujo = true;
    }

    // tema: dia ou noite, seguindo o atributo data-tema do app
    function aplicarTema() {
      const noite = document.documentElement.dataset.tema === "escuro";
      ceu.color.set(noite ? "#6a7bb0" : "#ffffff");
      ceu.groundColor.set(noite ? "#1e3324" : "#7fb36a");
      ceu.intensity = noite ? 0.7 : 1.1;
      sol.color.set(noite ? "#b9c8ff" : "#fff3dd");
      sol.intensity = noite ? 0.8 : 1.7;
      p.janela.color.set(noite ? "#ffcf6b" : "#3b3b4f");
      p.janela.emissive.set(noite ? "#ffb347" : "#000000");
      p.janela.emissiveIntensity = noite ? 0.9 : 0;
      sujo = true;
    }
    const observaTema = new MutationObserver(aplicarTema);
    observaTema.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    aplicarTema();

    // rótulos e balão: HTML por cima do canvas, reposicionados a cada quadro
    const projetar = (v) => {
      const c = v.clone().project(camera);
      return [((c.x + 1) / 2) * el.clientWidth, ((1 - c.y) / 2) * el.clientHeight];
    };
    function posicionarRotulos() {
      for (const [chave, info] of predios) {
        const r = rotulos.current[chave];
        if (!r) continue;
        const [x, y] = projetar(info.ancora);
        r.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
      if (fala.current) {
        const [x, y] = projetar(new THREE.Vector3(neuro.position.x, 1.85, neuro.position.z));
        fala.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    }

    // arrastar para girar; tocar sem arrastar escolhe
    const raio = new THREE.Raycaster();
    const ponteiro = { ativo: false, x0: 0, a0: 0, moveu: 0 };
    function alvoNoPonto(ev) {
      const r = renderizador.domElement.getBoundingClientRect();
      const v = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raio.setFromCamera(v, camera);
      const hit = raio.intersectObjects([folha, ...camadaPredios.children], true)[0];
      if (!hit) return null;
      if (hit.object.userData.neuro) return { neuro: true };
      return hit.object.userData.chave ? { chave: hit.object.userData.chave } : null;
    }
    const tela = renderizador.domElement;
    const aoApertar = (ev) => { ponteiro.ativo = true; ponteiro.x0 = ev.clientX; ponteiro.a0 = vista.alvoAzimute; ponteiro.moveu = 0; tela.setPointerCapture?.(ev.pointerId); };
    const aoMover = (ev) => {
      if (ponteiro.ativo) {
        const dx = ev.clientX - ponteiro.x0;
        ponteiro.moveu = Math.max(ponteiro.moveu, Math.abs(dx));
        if (ponteiro.moveu > 4) { vista.alvoAzimute = ponteiro.a0 - dx * 0.009; vista.azimute = vista.alvoAzimute; posicionarCamera(); sujo = true; }
        return;
      }
      const alvo = alvoNoPonto(ev);
      tela.style.cursor = alvo ? "pointer" : "grab";
    };
    const aoSoltar = (ev) => {
      if (!ponteiro.ativo) return;
      ponteiro.ativo = false;
      if (ponteiro.moveu > 4) return;
      const alvo = alvoNoPonto(ev);
      if (alvo?.chave) aoEscolherRef.current?.(alvo.chave);
      else if (alvo?.neuro) {
        andar.vy = 4.2;
        window.dispatchEvent(new CustomEvent("neuro", { detail: { humor: "feliz", fala: FALAS[Math.floor(Math.random() * FALAS.length)], duracao: 2600 } }));
      }
    };
    tela.addEventListener("pointerdown", aoApertar);
    tela.addEventListener("pointermove", aoMover);
    tela.addEventListener("pointerup", aoSoltar);
    tela.addEventListener("pointercancel", () => { ponteiro.ativo = false; });

    const v3 = ([x, z], y = 0) => new THREE.Vector3(x, y, z);
    // ---- a batalha na ilha: roda o MESMO motor do servidor (src/dominio/combate.js) e desenha
    // cada passo — tropas andando, flechas, balas de canhão, fogo de dragão, barras de vida e
    // construções virando ruína. Como o motor é determinístico, a luta é a mesma que o servidor
    // decidiu; o placar final que aparece é sempre o do servidor (`resultado`).
    const geo = {
      corpo: new THREE.ConeGeometry(0.15, 0.38, 6),
      cabeca: new THREE.IcosahedronGeometry(0.1, 0),
      elmo: new THREE.ConeGeometry(0.1, 0.12, 6),
      cabelo: new THREE.IcosahedronGeometry(0.11, 0),
      lanca: new THREE.CylinderGeometry(0.012, 0.012, 0.55, 4),
      escudo: new THREE.CylinderGeometry(0.11, 0.11, 0.03, 8).rotateZ(Math.PI / 2),
      arco: new THREE.TorusGeometry(0.14, 0.014, 4, 10, Math.PI),
      punho: new THREE.IcosahedronGeometry(0.1, 0),
      asa: new THREE.BoxGeometry(0.62, 0.03, 0.3),
      corpoDragao: new THREE.SphereGeometry(0.3, 8, 6),
      focinho: new THREE.ConeGeometry(0.12, 0.32, 6).rotateX(Math.PI / 2),
      cauda: new THREE.ConeGeometry(0.1, 0.5, 5).rotateX(-Math.PI / 2),
      flecha: new THREE.CylinderGeometry(0.016, 0.016, 0.45, 4).rotateX(Math.PI / 2),
      bala: new THREE.SphereGeometry(0.1, 8, 6),
      fogo: new THREE.IcosahedronGeometry(0.17, 0),
      livro: new THREE.BoxGeometry(0.18, 0.05, 0.13),
      fumaca: new THREE.IcosahedronGeometry(0.26, 0),
      faisca: new THREE.OctahedronGeometry(0.07, 0),
      entulho: new THREE.DodecahedronGeometry(0.22, 0),
      casco: new THREE.CylinderGeometry(0.5, 0.3, 0.42, 6),
      conves: new THREE.BoxGeometry(1.7, 0.08, 0.62),
      mastroNavio: new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5),
      vela: new THREE.BoxGeometry(0.05, 0.75, 0.9),
      balao: new THREE.SphereGeometry(0.62, 8, 6),
      heroi: new THREE.PlaneGeometry(1.3, 1.3),
      aureola: new THREE.TorusGeometry(0.09, 0.015, 4, 12),
      chapeu: new THREE.ConeGeometry(0.12, 0.3, 6),
      missil: new THREE.CylinderGeometry(0.035, 0.05, 0.36, 6).rotateX(Math.PI / 2),
      feixe: new THREE.CylinderGeometry(0.03, 0.03, 1, 5).rotateX(Math.PI / 2),
    };
    const matBarra = {
      fundo: new THREE.SpriteMaterial({ color: "#111814", opacity: 0.7, transparent: true, depthTest: false }),
      aliado: new THREE.SpriteMaterial({ color: "#22c55e", depthTest: false }),
      inimigo: new THREE.SpriteMaterial({ color: "#ef4444", depthTest: false }),
      predio: new THREE.SpriteMaterial({ color: "#f59e0b", depthTest: false }),
    };
    const matFogo = new THREE.MeshStandardMaterial({ color: "#ff7a1a", emissive: "#ff5a00", emissiveIntensity: 1.2, flatShading: true });
    const AZUL = "#2f6fd6", VERMELHO = "#c8332f";
    const FORA = new THREE.Vector3(5.3, 0, 4.7).normalize();
    const LADO = new THREE.Vector3(-FORA.z, 0, FORA.x);
    let BORDA, DOCA, LONGE;
    function pontosDaIlha(terreno) {
      const escala = (raioDaIlha(terreno) - 0.1) / 7.1;
      BORDA = new THREE.Vector3(5.3 * escala, 0, 4.7 * escala);
      DOCA = BORDA.clone().addScaledVector(FORA, 1.1).setY(0.9);
      LONGE = DOCA.clone().addScaledVector(FORA, 11).addScaledVector(LADO, 3).setY(4.5);
    }
    pontosDaIlha(0);
    const VELOCIDADE = 2.5;     // segundos de batalha por segundo de tela
    const INTRO = 2.2;          // o navio chegando
    const suave = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
    let sim = null;
    let tremor = 0;
    let zoomAlvo = 1;

    function barra(largura) {
      const g = new THREE.Group();
      const fundo = new THREE.Sprite(matBarra.fundo); fundo.center.set(0, 0.5); fundo.scale.set(largura, 0.09, 1);
      const cheio = new THREE.Sprite(matBarra.aliado); cheio.center.set(0, 0.5); cheio.scale.set(largura, 0.07, 1);
      fundo.renderOrder = 10; cheio.renderOrder = 11;
      g.add(fundo, cheio);
      g.userData = { cheio, largura };
      g.visible = false;
      return g;
    }
    const direitaDaCamera = new THREE.Vector3();
    function posicionarBarra(b, x, y, z, fracao, material) {
      b.visible = fracao < 1 && fracao > 0;
      if (!b.visible) return;
      const L = b.userData.largura;
      b.position.set(x - direitaDaCamera.x * (L / 2), y, z - direitaDaCamera.z * (L / 2));
      b.userData.cheio.scale.x = Math.max(0.001, L * fracao);
      b.userData.cheio.material = material;
    }

    function boneco(tipo, cor) {
      const g = new THREE.Group();
      const b = new THREE.Group();
      g.add(b);
      g.userData.boneco = b;
      if (tipo === "balao") {
        const bola = new THREE.Mesh(geo.corpoDragao, p.mat(cor)); bola.scale.set(1.5, 1.7, 1.5); bola.position.y = 0.45;
        const cesta = new THREE.Mesh(geo.livro, p.mat(COR.madeira)); cesta.scale.set(1.4, 3, 1.8); cesta.position.y = -0.15;
        const bomba = new THREE.Mesh(geo.bala, p.mat("#22252a")); bomba.position.y = -0.32;
        b.add(bola, cesta, bomba);
        b.scale.setScalar(1.1);
        b.position.y = 2.0;
        b.userData.altura = 2.0;
      } else if (tipo === "curandeira") {
        const corpo = new THREE.Mesh(geo.corpo, p.mat("#f4f1ea")); corpo.position.y = 0.19;
        const cabeca = new THREE.Mesh(geo.cabeca, p.mat("#f2d3b1")); cabeca.position.y = 0.45;
        const aureola = new THREE.Mesh(geo.aureola, p.brilho("#ffe066")); aureola.position.y = 0.62; aureola.rotation.x = Math.PI / 2;
        const asaE = new THREE.Mesh(geo.asa, p.mat("#ffffff")); asaE.scale.set(0.6, 1, 0.8); asaE.position.set(-0.22, 0.32, -0.08);
        const asaD = new THREE.Mesh(geo.asa, p.mat("#ffffff")); asaD.scale.set(0.6, 1, 0.8); asaD.position.set(0.22, 0.32, -0.08);
        const faixa = new THREE.Mesh(geo.escudo, p.mat(cor)); faixa.position.set(0, 0.22, 0.12);
        b.add(corpo, cabeca, aureola, asaE, asaD, faixa);
        b.userData.asas = [asaE, asaD];
        b.scale.setScalar(1.8);
        b.position.y = 1.6;
        b.userData.altura = 1.6;
      } else if (tipo === "dragao") {
        const corpo = new THREE.Mesh(geo.corpoDragao, p.mat(cor)); corpo.scale.set(1.0, 0.9, 1.7);
        const focinho = new THREE.Mesh(geo.focinho, p.mat(cor)); focinho.position.set(0, 0.08, 0.6);
        const cauda = new THREE.Mesh(geo.cauda, p.mat(cor)); cauda.position.set(0, 0, -0.65);
        const asaE = new THREE.Mesh(geo.asa, p.mat("#3b2a4a")); asaE.position.set(-0.42, 0.12, 0);
        const asaD = new THREE.Mesh(geo.asa, p.mat("#3b2a4a")); asaD.position.set(0.42, 0.12, 0);
        b.add(corpo, focinho, cauda, asaE, asaD);
        b.userData.asas = [asaE, asaD];
        b.scale.setScalar(1.15);
        b.position.y = 1.7;
        b.userData.altura = 1.7;
      } else if (tipo === "gigante") {
        const corpo = new THREE.Mesh(geo.corpo, p.mat(cor)); corpo.position.y = 0.19;
        const cabeca = new THREE.Mesh(geo.cabeca, p.mat("#e9c39a")); cabeca.position.y = 0.45;
        const pe = new THREE.Mesh(geo.punho, p.mat("#e9c39a")); pe.position.set(-0.17, 0.2, 0.06);
        const pd = new THREE.Mesh(geo.punho, p.mat("#e9c39a")); pd.position.set(0.17, 0.2, 0.06);
        b.add(corpo, cabeca, pe, pd);
        b.scale.setScalar(3.0);
      } else {
        const corpo = new THREE.Mesh(geo.corpo, p.mat(cor)); corpo.position.y = 0.19;
        const cabeca = new THREE.Mesh(geo.cabeca, p.mat("#f2d3b1")); cabeca.position.y = 0.45;
        b.add(corpo, cabeca);
        if (tipo === "mago") {
          corpo.material = p.mat("#5b3fa8");
          const chapeu = new THREE.Mesh(geo.chapeu, p.mat("#3b2a7a")); chapeu.position.y = 0.6;
          const cajado = new THREE.Mesh(geo.lanca, p.mat(COR.madeiraEscura)); cajado.position.set(0.15, 0.3, 0);
          const orbe = new THREE.Mesh(geo.cabeca, p.brilho("#b388ff")); orbe.scale.setScalar(0.7); orbe.position.set(0.15, 0.6, 0);
          const capa = new THREE.Mesh(geo.escudo, p.mat(cor)); capa.position.set(0, 0.3, -0.1); capa.scale.set(1.5, 1.5, 1.5);
          b.add(chapeu, cajado, orbe, capa);
        } else if (tipo === "bombardeiro") {
          corpo.material = p.mat(cor);
          const bomba = new THREE.Mesh(geo.bala, p.mat("#22252a")); bomba.scale.setScalar(1.6); bomba.position.set(0, 0.72, 0);
          const pavio = new THREE.Mesh(geo.lanca, p.brilho("#ffb347")); pavio.scale.set(1, 0.25, 1); pavio.position.set(0, 0.92, 0);
          b.add(bomba, pavio);
          b.scale.setScalar(1.5);
          g.add(b);
          g.traverse((m) => { m.castShadow = true; });
          return g;
        } else if (tipo === "arqueira") {
          const cabelo = new THREE.Mesh(geo.cabelo, p.mat("#7a3b1f")); cabelo.position.set(0, 0.49, -0.03); cabelo.scale.set(1, 0.8, 1.1);
          const arco = new THREE.Mesh(geo.arco, p.mat(COR.madeiraEscura)); arco.position.set(0.15, 0.3, 0.05); arco.rotation.set(0, Math.PI / 2, Math.PI / 2);
          b.add(cabelo, arco);
          corpo.scale.set(0.85, 1, 0.85);
        } else {
          const elmo = new THREE.Mesh(geo.elmo, p.mat("#9aa3ad")); elmo.position.y = 0.55;
          const escudo = new THREE.Mesh(geo.escudo, p.mat(cor)); escudo.position.set(-0.15, 0.22, 0.05);
          const lanca = new THREE.Mesh(geo.lanca, p.mat("#8a8f98")); lanca.position.set(0.15, 0.33, 0);
          b.add(elmo, escudo, lanca);
          b.userData.lanca = lanca;
        }
        b.scale.setScalar(1.7);
      }
      g.traverse((m) => { m.castShadow = true; });
      return g;
    }

    function navio(corDaVela) {
      const g = new THREE.Group();
      const casco = new THREE.Mesh(geo.casco, p.mat(COR.madeira)); casco.scale.set(1, 1, 2.2); casco.rotation.y = Math.PI / 2;
      const conves = new THREE.Mesh(geo.conves, p.mat(COR.madeiraEscura)); conves.position.y = 0.22;
      const mastro = new THREE.Mesh(geo.mastroNavio, p.mat(COR.madeiraEscura)); mastro.position.y = 0.85;
      const vela = new THREE.Mesh(geo.vela, p.mat(corDaVela)); vela.position.set(0.05, 0.95, 0); vela.rotation.y = Math.PI / 2;
      const balao = new THREE.Mesh(geo.balao, p.mat(corDaVela)); balao.position.y = 2.0; balao.scale.set(1.4, 0.85, 0.9);
      g.add(casco, conves, mastro, vela, balao);
      g.traverse((m) => { m.castShadow = true; });
      g.scale.setScalar(1.05);
      return g;
    }
    function voar(n, de, para, u, tt) {
      const a = suave(u);
      n.position.lerpVectors(de, para, a);
      n.position.y += Math.sin(a * Math.PI) * 1.2 + Math.sin(tt * 2.5) * 0.06;
      const frente = new THREE.Vector3().subVectors(para, de).setY(0);
      if (frente.lengthSq() > 0.001) n.rotation.y = Math.atan2(frente.x, frente.z) - Math.PI / 2;
      n.rotation.z = Math.sin(tt * 2) * 0.04;
    }

    function fumaca(grupo, onde, n = 6, cor = "#ffffff") {
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(geo.fumaca, new THREE.MeshStandardMaterial({ color: cor, flatShading: true, transparent: true, opacity: 0.85, roughness: 1, emissive: cor, emissiveIntensity: 0.25 }));
        m.userData = { proprio: true, idade: 0, vida: 0.9 + Math.random() * 0.4, vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2), tipo: "fumaca" };
        m.position.copy(onde).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4));
        grupo.add(m);
        sim.efeitos.push(m);
      }
    }
    function faiscas(grupo, onde, n = 10, cor = "#ffd34d", forca = 3) {
      const mat = p.mat(cor);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(geo.faisca, mat);
        const a = Math.random() * Math.PI * 2;
        m.userData = { idade: 0, vida: 0.5 + Math.random() * 0.4, vel: new THREE.Vector3(Math.cos(a) * forca * Math.random(), forca * (0.5 + Math.random()), Math.sin(a) * forca * Math.random()), tipo: "faisca" };
        m.position.copy(onde);
        grupo.add(m);
        sim.efeitos.push(m);
      }
    }
    function atualizarEfeitos(dt) {
      sim.efeitos = sim.efeitos.filter((m) => {
        const d = m.userData;
        d.idade += dt;
        const u = d.idade / d.vida;
        if (u >= 1) {
          if (d.tipo === "tiro" && d.area) { faiscas(d.grupo, d.para.clone().setY(0.25), 10, d.area, 2.2); fumaca(d.grupo, d.para.clone(), 2, "#bdbdbd"); }
          m.parent?.remove(m); if (d.proprio) m.material.dispose(); return false;
        }
        if (d.tipo === "feixe") return true;
        if (d.tipo === "tiro") {
          const a = Math.min(1, u);
          m.position.lerpVectors(d.de, d.para, a);
          m.position.y += Math.sin(a * Math.PI) * d.arco;
          const prox = new THREE.Vector3().lerpVectors(d.de, d.para, Math.min(1, a + 0.05));
          prox.y += Math.sin(Math.min(1, a + 0.05) * Math.PI) * d.arco;
          if (d.mira) m.lookAt(prox); else m.rotation.x += dt * 10;
          return true;
        }
        m.position.addScaledVector(d.vel, dt);
        if (d.tipo === "faisca") { d.vel.y -= 9 * dt; m.scale.setScalar(1 - u); m.rotation.x += dt * 8; }
        else { d.vel.multiplyScalar(0.96); m.scale.setScalar(0.6 + u * 1.2); m.material.opacity = 0.85 * (1 - u); }
        return true;
      });
    }
    const TIROS = {
      flecha: { geo: () => geo.flecha, mat: () => p.mat(COR.madeiraEscura), vida: 0.26, arco: 0.6, mira: true },
      bala: { geo: () => geo.bala, mat: () => p.mat("#30343b"), vida: 0.32, arco: 0.35 },
      fogo: { geo: () => geo.fogo, mat: () => matFogo, vida: 0.26, arco: 0 },
      livro: { geo: () => geo.livro, mat: () => p.mat("#7c4dff"), vida: 0.26, arco: 0.5 },
      missil: { geo: () => geo.missil, mat: () => p.mat("#e8e8e8"), vida: 0.35, arco: 0.9, mira: true, rastro: true },
      morteiro: { geo: () => geo.bala, mat: () => p.mat("#22252a"), vida: 0.7, arco: 3.0, area: "#ffb347" },
      magia: { geo: () => geo.fogo, mat: () => p.brilho("#b388ff"), vida: 0.3, arco: 0.2, area: "#d1b3ff" },
      bomba: { geo: () => geo.bala, mat: () => p.mat("#22252a"), vida: 0.3, arco: 0, area: "#ffb347" },
    };
    function feixe(grupo, de, para) {
      const m = new THREE.Mesh(geo.feixe, p.brilho("#ffe066"));
      m.position.lerpVectors(de, para, 0.5);
      m.scale.set(1, 1, de.distanceTo(para));
      m.lookAt(para);
      m.userData = { tipo: "feixe", idade: 0, vida: 0.12, vel: new THREE.Vector3() };
      grupo.add(m);
      sim.efeitos.push(m);
    }
    function tiro(grupo, armaDoTiro, de, para) {
      if (armaDoTiro === "raio") { feixe(grupo, de, para); faiscas(grupo, para, 4, "#ffe066", 1.5); return; }
      const d = TIROS[armaDoTiro] || TIROS.flecha;
      const g = d.geo();
      const mat = d.mat();
      const m = new THREE.Mesh(g, mat);
      m.position.copy(de);
      m.userData = { tipo: "tiro", idade: 0, vida: d.vida, de: de.clone(), para: para.clone(), arco: d.arco, mira: Boolean(d.mira), area: d.area || null, grupo };
      grupo.add(m);
      sim.efeitos.push(m);
    }

    const falar = (humor, fala) => window.dispatchEvent(new CustomEvent("neuro", { detail: { humor, fala, duracao: 3000 } }));
    const estrelasTexto = (n) => (n ? "⭐".repeat(n) : "nenhuma estrela");

    function encerrarSimulacao() {
      if (!sim) return;
      mundo.remove(sim.grupo);
      sim.grupo.traverse((m) => { if (m.userData?.proprio) m.material.dispose(); });
      for (const info of predios.values()) info.grupo.visible = true;
      if (sim.ilhaTrocada) atualizarConstrucoes(construcoesRef.current, false);
      neuro.visible = true;
      const fim = sim.aoTerminar;
      sim = null;
      zoomAlvo = 1;
      tremor = 0;
      legendaRef.current?.(null);
      sujo = true;
      fim?.();
    }

    function iniciarCombate({ entrada, papel, resultado, titulo, aoTerminar }) {
      if (sim) { const antigo = sim.aoTerminar; sim.aoTerminar = null; encerrarSimulacao(); antigo?.(); }
      const souAtacante = papel === "atacante";
      const meuLado = souAtacante ? "ataque" : "defesa";
      const grupo = new THREE.Group();
      mundo.add(grupo);
      const e = montarCombate(entrada);
      // quem ataca vê a ilha do rival: troca as construções pelas dele durante a batalha
      const ilhaTrocada = souAtacante;
      if (ilhaTrocada) {
        const n = entrada.defensor.construcoes;
        atualizarConstrucoes([{ chave: "terreno", nivel: n.terreno || 0 }, ...Object.keys(CONSTRUTORES).map((chave) => ({ chave, nivel: n[chave] || 0 }))], false);
      }
      pontosDaIlha(entrada.defensor.construcoes.terreno || 0);
      neuro.visible = false;
      const barco = navio(souAtacante ? AZUL : VERMELHO);
      grupo.add(barco);
      const corpos = new Map();   // id da unidade → { malha, barra, x, z }
      const barrasDePredio = new Map(); // id do prédio → barra
      for (const pr of [...e.predios, ...(e.muralha ? [e.muralha] : [])]) { const b = barra(1.1); grupo.add(b); barrasDePredio.set(pr.id, b); }
      const fala = { ultima: "" };
      const legenda = (t, texto) => {
        const chave = t + texto;
        if (chave === fala.ultima) return;
        fala.ultima = chave;
        legendaRef.current?.({ alerta: souAtacante ? "ataque" : "defesa", titulo: t, texto, duracao: INTRO + DURACAO_MAXIMA / VELOCIDADE, pular: true });
      };
      const tituloBase = titulo || (souAtacante ? "⚔️ INVASÃO EM ANDAMENTO" : "⚠️ SEU REINO ESTÁ SENDO ATACADO!");
      legenda(tituloBase, souAtacante ? "O navio leva as suas tropas ao reino rival…" : "Um navio inimigo se aproxima…");
      zoomAlvo = 0.9;

      const posDe = (id) => {
        if (id.startsWith("p-")) {
          const chave = id.slice(2);
          if (chave === "muralha") return new THREE.Vector3(e.castelo.x + 1.2, 0.6, e.castelo.z + 1.2);
          const [x, z] = LUGARES[chave];
          return new THREE.Vector3(x, chave === "torre" ? 1.6 : chave === "castelo" ? 1.8 : chave === "canhao" ? 0.6 : 0.6, z);
        }
        const c = corpos.get(id);
        const u = e.unidades.find((o) => o.id === id);
        return new THREE.Vector3(c ? c.malha.position.x : u?.x || 0, u?.tipo === "balao" ? 2.0 : u?.voa ? 1.9 : 0.4, c ? c.malha.position.z : u?.z || 0);
      };

      function aplicar(ev) {
        for (const x of ev) {
          if (x.tipo === "entrou") {
            const u = e.unidades.find((o) => o.id === x.id);
            const cor = u.lado === meuLado ? AZUL : VERMELHO;
            let malha;
            if (u.tipo === "heroi") {
              malha = new THREE.Group();
              const folhaHeroi = new THREE.Mesh(geo.heroi, folha.material);
              folhaHeroi.position.y = 0.55;
              malha.add(folhaHeroi);
              malha.userData.folha = folhaHeroi;
            } else malha = boneco(u.tipo, cor);
            malha.position.set(u.x, 0, u.z);
            grupo.add(malha);
            const b = barra(u.tipo === "gigante" || u.tipo === "dragao" ? 0.9 : 0.55);
            grupo.add(b);
            corpos.set(u.id, { malha, barra: b, x: u.x, z: u.z, golpe: 0 });
            if (u.lado === "ataque") fumaca(grupo, new THREE.Vector3(u.x, 0, u.z), 1);
          } else if (x.tipo === "golpe" || x.tipo === "tiro") {
            const de = posDe(x.de), para = posDe(x.para);
            if (x.arma === "golpe") {
              const c = corpos.get(x.de);
              if (c) c.golpe = 0.12;
              faiscas(grupo, para.clone().setY(0.5), 3, "#ffe08a", 1.4);
            } else if (x.arma === "explosao") {
              faiscas(grupo, para.clone().setY(0.4), 22, "#ff7a1a", 3.5);
              fumaca(grupo, para.clone(), 6, "#9a9a9a");
              tremor = Math.max(tremor, 0.45);
            } else tiro(grupo, x.arma, de.clone().setY(de.y + 0.2), para);
            if (x.de.startsWith("p-")) {
              const c = predios.get(x.de.slice(2))?.grupo;
              if (c?.userData.cano) c.userData.cano.rotation.y = Math.atan2(para.x - c.position.x, para.z - c.position.z) - c.rotation.y;
            }
          } else if (x.tipo === "cura") {
            const c = corpos.get(x.de);
            if (c) faiscas(grupo, c.malha.position.clone().setY(1.2), 6, "#7cfc9a", 1.2);
          } else if (x.tipo === "caiu") {
            const c = corpos.get(x.id);
            if (c) { c.caiu = 0.001; fumaca(grupo, c.malha.position.clone(), 2, "#d9d9d9"); }
          } else if (x.tipo === "destruido") {
            const chave = x.id.slice(2);
            const info = predios.get(chave);
            const onde = chave === "muralha" ? new THREE.Vector3(e.castelo.x, 0, e.castelo.z) : v3(LUGARES[chave]);
            if (info) info.grupo.visible = false;
            for (let k = 0; k < (chave === "castelo" ? 9 : 5); k++) {
              const pedra = new THREE.Mesh(geo.entulho, p.mat(k % 2 ? "#6f6a63" : "#8b857c"));
              const raio = chave === "muralha" ? 1.75 : 0.5;
              const a = (k / 5) * Math.PI * 2;
              pedra.position.set(onde.x + Math.cos(a) * raio * (0.5 + Math.random() * 0.5), 0.1, onde.z + Math.sin(a) * raio * (0.5 + Math.random() * 0.5));
              pedra.rotation.set(Math.random() * 3, Math.random() * 3, 0);
              pedra.castShadow = true;
              grupo.add(pedra);
            }
            fumaca(grupo, onde, chave === "castelo" ? 14 : 8, "#bdbdbd");
            faiscas(grupo, onde.clone().setY(0.8), 12, "#ffb347", 3);
            tremor = chave === "castelo" ? 1.0 : 0.5;
            if (chave === "castelo") {
              legenda(tituloBase, "A Torre do Neuro caiu! ⭐");
              falar(souAtacante ? "comemorando" : "triste", souAtacante ? "Derrubamos a Torre deles! ⭐" : "Nossa Torre caiu…");
            }
          } else if (x.tipo === "guarnicao") {
            legenda(tituloBase, "As tropas de defesa saíram da Torre do Neuro!");
            if (!souAtacante) falar("surpreso", "Guarnição, ao ataque! 🛡️");
          }
        }
      }
      sim = { grupo, inicio: performance.now(), aoTerminar, efeitos: [], ilhaTrocada, acumulado: 0, fimEm: null };

      function terminar() {
        if (sim.fimEm != null) return;
        const r = resultado || resultadoDo(e);
        sim.fimEm = (performance.now() - sim.inicio) / 1000;
        const venceuQuemJoga = souAtacante ? r.estrelas > 0 : r.estrelas === 0;
        legendaRef.current?.({
          alerta: venceuQuemJoga ? "vitoria" : "derrota",
          titulo: souAtacante ? (r.estrelas ? `${estrelasTexto(r.estrelas)} VITÓRIA!` : "💥 A INVASÃO FALHOU") : (r.estrelas ? `💥 O REINO CAIU · ${estrelasTexto(r.estrelas)}` : "🛡️ VITÓRIA! O REINO RESISTIU"),
          texto: `${r.destruicao}% destruído${r.saque ? ` · ${souAtacante ? "saque" : "perdemos"} 🪙 ${r.saque}` : ""}`,
          duracao: 2.6,
        });
        falar(venceuQuemJoga ? "comemorando" : "triste", venceuQuemJoga ? (souAtacante ? "Vitória! 🏆" : "Defendemos o reino! 🛡️") : (souAtacante ? "Não deu dessa vez…" : "Levaram moedas…"));
        if (venceuQuemJoga) for (let k = 0; k < 4; k++) faiscas(grupo, new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random(), (Math.random() - 0.5) * 4), 16, k % 2 ? "#ffd34d" : "#7cc46a", 3.5);
        zoomAlvo = 1;
      }
      sim.pular = () => { while (!e.fim) aplicar(passoDoCombate(e)); terminar(); };

      sim.atualizar = (tt, dt) => {
        atualizarEfeitos(dt);
        direitaDaCamera.set(Math.cos(vista.azimute), 0, -Math.sin(vista.azimute));
        // o navio: chega, espera e vai embora no fim
        // depois de desembarcar, o navio sai de cena (parado na frente, ele tapava a luta)
        if (tt < INTRO) voar(barco, LONGE, DOCA, tt / INTRO, tt);
        else if (tt < INTRO + 2.6) voar(barco, DOCA, LONGE, (tt - INTRO) / 2.6, tt);
        else barco.visible = false;

        if (tt >= INTRO && !e.fim) {
          if (!sim.desembarcou) { sim.desembarcou = true; legenda(tituloBase, "As tropas desembarcaram!"); zoomAlvo = 1.15; }
          sim.acumulado += dt * VELOCIDADE;
          let passos = 0;
          while (sim.acumulado >= DT && !e.fim && passos < 8) { aplicar(passoDoCombate(e)); sim.acumulado -= DT; passos++; }
          const r = resultadoDo(e);
          legenda(tituloBase, `${estrelasTexto(r.estrelas)} · ${r.destruicao}% destruído · ${Math.ceil(e.t)} s`);
          if (e.fim) terminar();
        }

        // tropas: andam até a posição do motor, balançam, golpeiam, caem
        for (const u of e.unidades) {
          const c = corpos.get(u.id);
          if (!c) continue;
          const m = c.malha;
          const dx = u.x - m.position.x, dz = u.z - m.position.z;
          const anda = Math.abs(dx) + Math.abs(dz) > 0.004;
          m.position.x += dx * Math.min(1, dt * 12);
          m.position.z += dz * Math.min(1, dt * 12);
          const b = m.userData.boneco;
          if (m.userData.folha) { m.userData.folha.rotation.y = vista.azimute; m.userData.folha.position.y = 0.55 + (anda ? Math.abs(Math.sin(tt * 10)) * 0.08 : 0); }
          if (b) {
            if (anda) m.rotation.y = Math.atan2(dx, dz);
            if (u.voa) { for (const asa of b.userData.asas || []) asa.rotation.z = Math.sin(tt * 9) * 0.5 * (asa.position.x > 0 ? 1 : -1); b.position.y = (b.userData.altura || 1.7) + Math.sin(tt * 3 + u.x) * 0.1; }
            else { b.rotation.z = anda ? Math.sin(tt * 12 + u.x) * 0.12 : 0; m.position.y = anda ? Math.abs(Math.sin(tt * 12 + u.z)) * 0.06 : 0; }
            if (c.golpe > 0) { c.golpe -= dt; b.position.z = c.golpe > 0 ? 0.12 : 0; if (b.userData.lanca) b.userData.lanca.rotation.x = c.golpe > 0 ? 0.8 : 0; }
          }
          if (c.caiu) {
            c.caiu += dt;
            if (b) b.rotation.x = -Math.min(1, c.caiu / 0.3) * (Math.PI / 2);
            m.scale.setScalar(Math.max(0.001, 1 - Math.max(0, c.caiu - 0.7) / 0.35));
            c.barra.visible = false;
            continue;
          }
          const alto = u.tipo === "balao" ? 3.4 : u.voa ? 2.6 : u.tipo === "gigante" ? 1.6 : u.tipo === "heroi" ? 1.35 : 0.95;
          posicionarBarra(c.barra, m.position.x, alto, m.position.z, u.vida / u.vidaMax, u.lado === meuLado ? matBarra.aliado : matBarra.inimigo);
        }
        // barras das construções (só aparecem quando apanham)
        for (const pr of [...e.predios, ...(e.muralha ? [e.muralha] : [])]) {
          const b = barrasDePredio.get(pr.id);
          if (!pr.vivo) { b.visible = false; continue; }
          const pos = pr.chave === "muralha" ? new THREE.Vector3(e.castelo.x + 1.24, 0, e.castelo.z + 1.24) : v3(LUGARES[pr.chave]);
          const topo = predios.get(pr.chave)?.ancora?.y ?? 1.5;
          posicionarBarra(b, pos.x, (pr.chave === "muralha" ? 1.1 : topo) + 0.1, pos.z, pr.vida / pr.vidaMax, souAtacante ? matBarra.inimigo : matBarra.predio);
        }
        if (sim.fimEm != null && tt - sim.fimEm > 2.8) encerrarSimulacao();
      };
    }

    const aoCombate = (e) => {
      if (semMovimento || !e.detail) return;
      e.detail.aceito = true;
      iniciarCombate(e.detail);
    };
    window.addEventListener("reino-combate", aoCombate);
    const aoPular = () => sim?.pular?.();
    window.addEventListener("reino-combate-pular", aoPular);

    // o laço: só desenha com a tela visível
    const observaVisao = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; });
    observaVisao.observe(el);
    const direita = new THREE.Vector3();
    function passo(agora) {
      quadroId = requestAnimationFrame(passo);
      const dt = Math.min(0.05, (agora - antes) / 1000);
      antes = agora;
      if (!visivel || document.hidden) return;

      // giro suave dos botões
      if (Math.abs(vista.alvoAzimute - vista.azimute) > 0.001) {
        vista.azimute += (vista.alvoAzimute - vista.azimute) * Math.min(1, dt * 8);
        posicionarCamera();
        sujo = true;
      }

      // construção nova "nasce" com um pulinho
      for (const info of predios.values()) {
        if (!info.nasceu) continue;
        const t = Math.min(1, (agora - info.nasceu) / 600);
        // cresce passando um pouco do tamanho e volta (efeito "boing")
        const s = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 2.5) * 0.45;
        info.grupo.scale.setScalar(info.grupo.userData.escalaBase * s);
        if (t >= 1) info.nasceu = 0;
        sujo = true;
      }

      if (folha.visible) {
        // o papel sempre de frente para a câmera
        folha.rotation.y = vista.azimute;
        direita.set(Math.cos(vista.azimute), 0, -Math.sin(vista.azimute));
        let andando = false;
        if (!semMovimento) {
          if (!andar.destino) {
            andar.espera -= dt;
            if (andar.espera <= 0) {
              const opcoes = destinos.filter((d) => Math.hypot(d[0] - neuro.position.x, d[1] - neuro.position.z) > 0.8);
              andar.destino = opcoes[Math.floor(Math.random() * opcoes.length)];
            }
          } else {
            const dx = andar.destino[0] - neuro.position.x, dz = andar.destino[1] - neuro.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 0.05) { andar.destino = null; andar.espera = 1.5 + Math.random() * 3; }
            else {
              const v = Math.min(dist, 1.15 * dt);
              neuro.position.x += (dx / dist) * v;
              neuro.position.z += (dz / dist) * v;
              const lado = dx * direita.x + dz * direita.z;
              if (Math.abs(lado) > 0.01) andar.viradoPara = lado > 0 ? 1 : -1;
              andando = true;
            }
          }
          // a folha "vira" passando pela espessura zero, como papel
          folha.scale.x += (andar.viradoPara - folha.scale.x) * Math.min(1, dt * 7);
          // pulo (cutucada)
          andar.vy -= 12 * dt;
          andar.pulo = Math.max(0, andar.pulo + andar.vy * dt);
          if (andar.pulo === 0) andar.vy = 0;
          // nuvens
          for (const n of grupoNuvens.children) {
            n.userData.a += dt * 0.02;
            n.position.set(Math.cos(n.userData.a) * n.userData.raio, n.userData.y, Math.sin(n.userData.a) * n.userData.raio);
          }
        }
        const t = agora / 1000;
        const passinho = andando ? Math.abs(Math.sin(t * 9)) * 0.08 : 0;
        folha.position.y = 0.75 + passinho + andar.pulo;
        folha.rotation.z = andando ? Math.sin(t * 9) * 0.05 : 0;
        folha.scale.y = andando || semMovimento ? 1 : 1 + Math.sin(t * 2.2) * 0.015;
        sombraNeuro.scale.setScalar(1 - Math.min(0.5, andar.pulo * 0.4));
        if (!semMovimento) sujo = true;
      }

      if (Math.abs(camera.zoom - zoomAlvo) > 0.001) {
        camera.zoom += (zoomAlvo - camera.zoom) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
        sujo = true;
      }
      if (tremor > 0) {
        tremor = Math.max(0, tremor - dt * 1.4);
        posicionarCamera();
        if (tremor > 0) {
          camera.position.x += (Math.random() - 0.5) * tremor * 0.25;
          camera.position.y += (Math.random() - 0.5) * tremor * 0.25;
          camera.updateMatrixWorld();
        }
        sujo = true;
      }
      if (!semMovimento && girando.length) for (const o of girando) o.rotation.y += dt * 1.6;

      if (sim) {
        sim.atualizar((agora - sim.inicio) / 1000, dt);
        sujo = true;
      }

      if (sujo) {
        renderizador.render(cena, camera);
        posicionarRotulos();
        sujo = false;
      }
    }

    const observaTamanho = new ResizeObserver(enquadrar);
    observaTamanho.observe(el);
    enquadrar();
    quadroId = requestAnimationFrame(passo);

    api.current = {
      atualizarConstrucoes,
      definirNeuro(canvas) {
        textura.image = canvas;
        textura.needsUpdate = true;
        folha.visible = true;
        sujo = true;
      },
      girar(delta) { vista.alvoAzimute += delta; },
    };

    return () => {
      cancelAnimationFrame(quadroId);
      window.removeEventListener("reino-combate", aoCombate);
      window.removeEventListener("reino-combate-pular", aoPular);
      if (sim) {
        mundo.remove(sim.grupo);
        sim.grupo.traverse((m) => { if (m.userData?.proprio) m.material.dispose(); });
        sim = null;
      }
      for (const g of Object.values(geo)) g.dispose();
      for (const m of Object.values(matBarra)) m.dispose();
      matFogo.dispose();
      observaTamanho.disconnect();
      observaVisao.disconnect();
      observaTema.disconnect();
      cena.traverse((o) => { o.geometry?.dispose(); });
      for (const m of p.materiais.values()) m.dispose();
      p.janela.dispose();
      folha.material.dispose();
      sombraNeuro.material.dispose();
      textura.dispose();
      renderizador.dispose();
      renderizador.forceContextLoss?.();
      renderizador.domElement.remove();
      api.current = null;
    };
    // a cena nasce uma vez; as mudanças chegam pelos efeitos abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- níveis das construções
  useEffect(() => {
    api.current?.atualizarConstrucoes(construcoes);
  }, [construcoes]);

  // ---- o Neuro: redesenha a folha quando o humor muda
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
  }, [humorAtual, personagem]);

  // ---- reações vindas de qualquer tela: reagir("feliz", "+10!")
  useEffect(() => {
    let timer;
    function aoReagir(e) {
      const { humor: h, fala: f, duracao = 3800 } = e.detail || {};
      setReacao({ humor: h });
      setTexto(f || "");
      clearTimeout(timer);
      timer = setTimeout(() => { setReacao(null); setTexto(""); }, duracao);
    }
    window.addEventListener("neuro", aoReagir);
    return () => { window.removeEventListener("neuro", aoReagir); clearTimeout(timer); };
  }, []);

  return (
    <div className={`rn-mundo${legenda ? " rn-mundo--batalha" : ""}`} ref={caixa}>
      {construcoes.filter((c) => c.chave !== "terreno" && (!CONSTRUCOES[c.chave]?.terreno || (construcoes.find((x) => x.chave === "terreno")?.nivel || 0) >= CONSTRUCOES[c.chave].terreno)).map((c) => (
        <button key={c.chave} type="button" className={`rn-mundo__rotulo${c.nivel === 0 ? " rn-mundo__rotulo--vazio" : ""}`}
          ref={(n) => { rotulos.current[c.chave] = n; }}
          onClick={() => aoEscolher?.(c.chave)}
          aria-label={`${c.nome}, ${c.nivel ? `nível ${c.nivel}` : "ainda não construída"} — ver a construção`}>
          <span aria-hidden="true">{c.emoji}</span> {c.nivel ? `nv ${c.nivel}` : "construir"}
        </button>
      ))}
      {legenda && (
        <div className={`rn-mundo__alerta rn-mundo__alerta--${legenda.alerta}`} role="alert">
          <strong className="rn-mundo__alerta-titulo">{legenda.titulo}</strong>
          <span className="rn-mundo__alerta-texto">{legenda.texto}</span>
          <span className="rn-mundo__progresso" aria-hidden="true">
            <span key={legenda.alerta + legenda.duracao} style={{ animationDuration: `${legenda.duracao}s` }} />
          </span>
          {legenda.pular && (
            <button type="button" className="rn-mundo__pular" onClick={() => window.dispatchEvent(new CustomEvent("reino-combate-pular"))}>⏭ Pular para o resultado</button>
          )}
        </div>
      )}
      <div ref={fala} className={`rn-mundo__fala${texto ? " rn-mundo__fala--visivel" : ""}`} role="status">{texto}</div>
      <div className="rn-mundo__giro">
        <button type="button" onClick={() => api.current?.girar(Math.PI / 4)} aria-label="Girar o reino para a esquerda">⟲</button>
        <button type="button" onClick={() => api.current?.girar(-Math.PI / 4)} aria-label="Girar o reino para a direita">⟳</button>
      </div>
      <span className="rn-mundo__dica" aria-hidden="true">arraste para girar · toque numa construção</span>
      {/* o molde do Neuro de papel: fora da tela, sem foco, só para copiar o desenho */}
      <div className="rn-mundo__molde" ref={molde} inert aria-hidden="true">
        <Neuro humor={humorAtual} tamanho={200} />
      </div>
    </div>
  );
}
