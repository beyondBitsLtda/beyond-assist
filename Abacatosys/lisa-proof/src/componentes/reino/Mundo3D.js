"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Neuro from "@/componentes/Neuro.js";

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
 * Modo simulação: o evento de janela "reino-simular" ({ tipo: "atacar" | "defender", venceu,
 * quartel, torre, aoTerminar }) encena a batalha com soldadinhos, flechas e moedas. A conta da
 * batalha não é feita aqui (é de src/dominio/reino.js); aqui é só o teatro. Quem aceita marca
 * `detail.aceito = true` — sem mundo 3D (ou com "reduzir movimento"), a tela mostra o resultado direto.
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

const LUGARES = {
  castelo: [-0.6, -1.9], mina: [-4.3, -0.7], cofre: [4.1, -0.9], torre: [-3.2, 3.0], quartel: [3.4, 2.9],
};
const PRACA = [0.5, 1.3];
const MURO = { raio: 6.0, meio: Math.PI * 1.25, passo: Math.PI * 0.075 };
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
  return { materiais, janela, mat, malha, caixa, cilindro, cone, bandeira };
}

// ------------------------------------------------------------------ construções (nível 0 a 5)
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
  const h = 0.9 + 0.32 * n;
  const telhado = n >= 5 ? COR.ouro : COR.telhado;
  g.add(p.caixa(1.7, h, 1.5, COR.pedra, 0, h / 2, 0));
  for (const [x, z] of [[-0.7, -0.62], [0, -0.62], [0.7, -0.62], [-0.7, 0.62], [0, 0.62], [0.7, 0.62], [-0.7, 0], [0.7, 0]]) {
    g.add(p.caixa(0.26, 0.22, 0.26, COR.pedra, x, h + 0.11, z));
  }
  g.add(p.caixa(0.44, 0.64, 0.06, COR.porta, 0, 0.32, 0.76));
  for (let i = 0; i < Math.min(3, n); i++) {
    g.add(p.caixa(0.18, 0.24, 0.05, p.janela, -0.5 + i * 0.5, h * 0.66, 0.76));
    g.add(p.caixa(0.05, 0.24, 0.18, p.janela, 0.86, h * 0.66, -0.4 + i * 0.4));
  }
  const cantos = [[0.85, 0.75], [-0.85, 0.75], [0.85, -0.75], [-0.85, -0.75]].slice(0, Math.min(4, n + 1));
  for (const [x, z] of cantos) {
    const ht = h + 0.45;
    g.add(p.cilindro(0.3, 0.34, ht, 7, COR.pedraClara, x, ht / 2, z));
    g.add(p.cone(0.44, 0.75, 7, telhado, x, ht + 0.37, z));
  }
  if (n >= 3) {
    g.add(p.cilindro(0.38, 0.42, 0.7, 8, COR.pedraClara, 0, h + 0.35, 0));
    g.add(p.cone(0.56, 1.0, 8, telhado, 0, h + 1.2, 0));
    p.bandeira(g, 0, h + 1.65, 0, n >= 5 ? COR.ouro : COR.vermelho);
  }
  return g;
}

function mina(p, n) {
  const g = new THREE.Group();
  const morro = p.malha(new THREE.DodecahedronGeometry(1, 0), COR.rocha, 0, 0.42, 0);
  morro.scale.set(1.25, 0.8, 1.05);
  g.add(morro);
  g.add(p.caixa(0.5, 0.55, 0.3, COR.entrada, 0, 0.28, 0.86));
  g.add(p.caixa(0.09, 0.68, 0.09, COR.madeira, -0.3, 0.34, 1.0));
  g.add(p.caixa(0.09, 0.68, 0.09, COR.madeira, 0.3, 0.34, 1.0));
  g.add(p.caixa(0.74, 0.1, 0.12, COR.madeira, 0, 0.68, 1.0));
  g.add(p.caixa(0.05, 0.03, 1.1, COR.trilho, -0.13, 0.02, 1.55));
  g.add(p.caixa(0.05, 0.03, 1.1, COR.trilho, 0.13, 0.02, 1.55));
  g.add(p.caixa(0.42, 0.26, 0.32, COR.madeiraEscura, 0, 0.18, 1.8));
  g.add(p.caixa(0.34, 0.08, 0.24, COR.ouro, 0, 0.34, 1.8));
  const cristais = [[-0.6, 0.78, 0.35], [0.55, 0.82, 0.3], [0, 1.08, -0.15], [-0.4, 0.62, -0.62], [0.72, 0.5, -0.4]];
  cristais.slice(0, n).forEach(([x, y, z], i) => {
    const c = p.malha(new THREE.OctahedronGeometry(0.17, 0), COR.ouro, x, y, z);
    c.rotation.set(0.3 * i, 0.7 * i, 0.2);
    c.scale.y = 1.5;
    g.add(c);
  });
  g.scale.setScalar(0.85 + 0.07 * n);
  return g;
}

function cofre(p, n) {
  const g = new THREE.Group();
  g.add(p.caixa(1.3, 0.85, 1.1, "#efe4cc", 0, 0.425, 0));
  g.add(p.caixa(1.38, 0.1, 1.18, COR.ouro, 0, 0.86, 0));
  g.add(p.malha(new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), COR.ouro, 0, 0.9, 0));
  g.add(p.caixa(0.34, 0.5, 0.05, "#8a6a1f", 0, 0.25, 0.56));
  for (const x of [-0.45, 0.45]) g.add(p.cilindro(0.07, 0.07, 0.8, 6, "#f6efe0", x, 0.4, 0.6));
  const pilhas = [[0.9, 0.4], [1.08, 0.02], [0.92, -0.36], [-0.9, 0.38], [-1.05, -0.05]];
  pilhas.slice(0, n).forEach(([x, z], i) => {
    const hh = 0.08 * (2 + i);
    g.add(p.cilindro(0.14, 0.14, hh, 8, COR.ouro, x, hh / 2, z));
  });
  g.scale.setScalar(0.85 + 0.05 * n);
  return g;
}

function torre(p, n) {
  const g = new THREE.Group();
  const h = 1.1 + 0.3 * n;
  g.add(p.cilindro(0.56, 0.62, 0.32, 6, COR.pedra, 0, 0.16, 0));
  g.add(p.cilindro(0.42, 0.52, h, 6, COR.madeira, 0, h / 2, 0));
  g.add(p.cilindro(0.74, 0.74, 0.12, 6, COR.madeiraEscura, 0, h + 0.06, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(p.caixa(0.06, 0.32, 0.06, COR.madeiraEscura, Math.cos(a) * 0.64, h + 0.28, Math.sin(a) * 0.64));
  }
  if (n >= 2) g.add(p.cone(0.86, 0.75, 6, COR.telhadoVerde, 0, h + 0.82, 0));
  if (n >= 4) p.bandeira(g, 0, h + 1.15, 0, COR.vermelho);
  // o alvo de treino ao lado
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
  const tendas = [[0, 0], [-0.9, -0.55], [0.85, -0.6]].slice(0, Math.min(3, Math.ceil(n / 2)));
  tendas.forEach(([x, z], i) => {
    const t = p.cone(0.62, 0.95, 4, i % 2 ? COR.vermelho : COR.lona, x, 0.475, z);
    t.rotation.y = Math.PI / 4;
    g.add(t);
    g.add(p.caixa(0.22, 0.34, 0.04, COR.porta, x, 0.17, z + 0.44));
  });
  g.add(p.cilindro(0.03, 0.03, 1.7, 6, COR.madeiraEscura, 0.85, 0.85, 0.6));
  g.add(p.caixa(0.46, 0.28, 0.03, COR.vermelho, 1.09, 1.52, 0.6));
  if (n >= 2) {
    g.add(p.cilindro(0.07, 0.07, 0.7, 6, COR.madeira, -0.85, 0.35, 0.7));
    g.add(p.caixa(0.5, 0.07, 0.07, COR.madeira, -0.85, 0.52, 0.7));
    g.add(p.malha(new THREE.IcosahedronGeometry(0.14, 0), COR.placa, -0.85, 0.82, 0.7));
  }
  if (n >= 4) {
    g.add(p.caixa(0.7, 0.08, 0.1, COR.madeiraEscura, 0, 0.5, 0.95));
    for (let i = 0; i < 4; i++) g.add(p.cilindro(0.02, 0.02, 0.9, 4, "#9aa3ad", -0.27 + i * 0.18, 0.45, 0.98));
  }
  return g;
}

/** O muro contorna a parte de trás da ilha: mais trechos e torres a cada nível. */
function muralha(p, n) {
  const g = new THREE.Group();
  const trechos = n === 0 ? 6 : 2 + n * 2;
  const inicio = MURO.meio - (trechos * MURO.passo) / 2;
  const pos = (a) => [Math.cos(a) * MURO.raio, Math.sin(a) * MURO.raio];
  if (n === 0) {
    for (let i = 0; i <= trechos; i++) {
      const [x, z] = pos(inicio + i * MURO.passo);
      g.add(p.caixa(0.07, 0.36, 0.07, COR.madeira, x, 0.18, z));
    }
    const [x, z] = pos(MURO.meio);
    g.add(p.caixa(0.06, 0.5, 0.06, COR.madeira, x * 0.92, 0.25, z * 0.92));
    g.add(p.caixa(0.44, 0.26, 0.04, COR.placa, x * 0.92, 0.5, z * 0.92));
    return g;
  }
  const h = 0.45 + 0.12 * n;
  const comprimento = 2 * MURO.raio * Math.sin(MURO.passo / 2) + 0.04;
  for (let i = 0; i < trechos; i++) {
    const a = inicio + (i + 0.5) * MURO.passo;
    const [x, z] = pos(a);
    const t = p.caixa(comprimento, h, 0.36, COR.pedra, x, h / 2, z);
    t.rotation.y = -a + Math.PI / 2;
    g.add(t);
    const ameia = p.caixa(comprimento * 0.4, 0.16, 0.38, COR.pedra, x, h + 0.08, z);
    ameia.rotation.y = t.rotation.y;
    g.add(ameia);
  }
  const torres = [0, trechos];
  if (n >= 3) for (let i = 4; i < trechos; i += 4) torres.push(i);
  for (const i of torres) {
    const [x, z] = pos(inicio + i * MURO.passo);
    g.add(p.cilindro(0.3, 0.34, h + 0.4, 6, COR.pedraClara, x, (h + 0.4) / 2, z));
    g.add(p.cone(0.42, 0.55, 6, COR.telhado, x, h + 0.68, z));
  }
  return g;
}

const CONSTRUTORES = { castelo, mina, cofre, torre, quartel, muralha };

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
  if (chave === "muralha") return new THREE.Vector3(Math.cos(MURO.meio) * MURO.raio, topo + 0.35, Math.sin(MURO.meio) * MURO.raio);
  const [x, z] = LUGARES[chave];
  return new THREE.Vector3(x, topo + 0.35, z);
}

// ------------------------------------------------------------------ a ilha
function ilha(p) {
  const g = new THREE.Group();
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
  const grama = p.malha(ondular(new THREE.CylinderGeometry(7.1, 7.1, 0.25, 11)), COR.grama, 0, -0.125, 0);
  const terra = p.malha(ondular(new THREE.CylinderGeometry(7.0, 6.3, 1.0, 11)), COR.terra, 0, -0.75, 0);
  const fundo = p.malha(ondular(new THREE.ConeGeometry(6.3, 3.2, 11)), COR.rochaEscura, 0, -2.85, 0);
  fundo.rotation.x = Math.PI;
  g.add(grama, terra, fundo);

  // praça e pedrinhas até cada construção
  g.add(p.cilindro(1.3, 1.3, 0.06, 9, COR.praca, PRACA[0], 0.03, PRACA[1]));
  for (const [x, z] of Object.values(LUGARES)) {
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
  for (let i = 0; i < 9; i++) {
    const a = (i < 5 ? Math.PI * (0.55 + r() * 0.3) : Math.PI * (1.75 + r() * 0.35)) + (r() - 0.5) * 0.1;
    const raio = 5.3 + r() * 1.3;
    arvore(Math.cos(a) * raio, Math.sin(a) * raio, 0.85 + r() * 0.5);
  }
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, raio = 2 + r() * 4.6;
    const x = Math.cos(a) * raio, z = Math.sin(a) * raio;
    const longe = Object.values(LUGARES).every(([lx, lz]) => Math.hypot(lx - x, lz - z) > 1.5) && Math.hypot(PRACA[0] - x, PRACA[1] - z) > 1.6;
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
    n.userData = { a, raio: 9 + r() * 2.5, y: 2.6 + r() * 1.8 };
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
    mundo.add(ilha(p));
    const grupoNuvens = nuvens(p);
    cena.add(mundo, grupoNuvens);

    // construções
    const predios = new Map(); // chave → { grupo, nivel, ancora, nasceu }
    const camadaPredios = new THREE.Group();
    mundo.add(camadaPredios);
    const descartar = (o) => o.traverse((m) => m.geometry?.dispose());
    function atualizarConstrucoes(lista) {
      for (const { chave, nivel } of lista) {
        const atual = predios.get(chave);
        if (atual && atual.nivel === nivel) continue;
        if (atual) { camadaPredios.remove(atual.grupo); descartar(atual.grupo); }
        const grupo = construir(p, chave, nivel);
        camadaPredios.add(grupo);
        predios.set(chave, { grupo, nivel, ancora: ancoraDe(chave, grupo), nasceu: atual ? performance.now() : 0 });
      }
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
      for (const x of [-7.4, 7.4]) for (const y of [-2.0, 3.6]) for (const z of [-7.4, 7.4]) cantos.push(new THREE.Vector3(x, y, z));
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

    // ---- modo simulação: a batalha encenada (~10 s). A conta é do domínio; aqui é só o teatro.
    const geo = {
      corpo: new THREE.ConeGeometry(0.15, 0.38, 6),
      cabeca: new THREE.IcosahedronGeometry(0.1, 0),
      elmo: new THREE.ConeGeometry(0.1, 0.12, 6),
      lanca: new THREE.CylinderGeometry(0.012, 0.012, 0.55, 4),
      escudo: new THREE.CylinderGeometry(0.11, 0.11, 0.03, 8).rotateZ(Math.PI / 2),
      mastro: new THREE.CylinderGeometry(0.012, 0.012, 0.75, 4),
      pano: new THREE.BoxGeometry(0.02, 0.18, 0.28),
      flecha: new THREE.CylinderGeometry(0.016, 0.016, 0.45, 4).rotateX(Math.PI / 2),
      moeda: new THREE.CylinderGeometry(0.11, 0.11, 0.035, 10),
      fumaca: new THREE.IcosahedronGeometry(0.26, 0),
      faisca: new THREE.OctahedronGeometry(0.07, 0),
      casco: new THREE.CylinderGeometry(0.5, 0.3, 0.42, 6),
      conves: new THREE.BoxGeometry(1.7, 0.08, 0.62),
      mastroNavio: new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5),
      vela: new THREE.BoxGeometry(0.05, 0.75, 0.9),
      balao: new THREE.SphereGeometry(0.62, 8, 6),
      corda: new THREE.CylinderGeometry(0.01, 0.01, 0.75, 3),
    };
    const v3 = ([x, z], y = 0) => new THREE.Vector3(x, y, z);
    const BORDA = new THREE.Vector3(5.3, 0, 4.7);
    const FORA = BORDA.clone().normalize();
    const LADO = new THREE.Vector3(-FORA.z, 0, FORA.x);
    // a doca fica no alto: a beirada da frente é a parte de baixo do quadro, e o navio sumia ali
    const DOCA = BORDA.clone().addScaledVector(FORA, 1.1).setY(0.9);
    const LONGE = DOCA.clone().addScaledVector(FORA, 11).addScaledVector(LADO, 3).setY(4.5);
    const suave = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
    const fase = (tt, de, ate) => suave((tt - de) / (ate - de));
    let sim = null;
    let tremor = 0;
    let zoomAlvo = 1;

    function soldado(cor, portaBandeira) {
      const g = new THREE.Group();
      const boneco = new THREE.Group();
      const corpo = new THREE.Mesh(geo.corpo, p.mat(cor)); corpo.position.y = 0.19;
      const cabeca = new THREE.Mesh(geo.cabeca, p.mat("#f2d3b1")); cabeca.position.y = 0.45;
      const elmo = new THREE.Mesh(geo.elmo, p.mat("#9aa3ad")); elmo.position.y = 0.55;
      const escudo = new THREE.Mesh(geo.escudo, p.mat(cor)); escudo.position.set(-0.15, 0.22, 0.05);
      boneco.add(corpo, cabeca, elmo, escudo);
      if (portaBandeira) {
        const mastro = new THREE.Mesh(geo.mastro, p.mat(COR.madeiraEscura)); mastro.position.set(0.15, 0.45, 0);
        const pano = new THREE.Mesh(geo.pano, p.mat(cor)); pano.position.set(0.15, 0.72, 0.14);
        boneco.add(mastro, pano);
        boneco.userData.pano = pano;
      } else {
        const lanca = new THREE.Mesh(geo.lanca, p.mat("#8a8f98")); lanca.position.set(0.15, 0.33, 0);
        boneco.add(lanca);
        boneco.userData.lanca = lanca;
      }
      boneco.scale.setScalar(1.7);
      g.add(boneco);
      g.traverse((m) => { m.castShadow = true; });
      g.userData.boneco = boneco;
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
      for (const [x, z] of [[-0.6, 0.2], [0.6, 0.2], [-0.6, -0.2], [0.6, -0.2]]) {
        const c = new THREE.Mesh(geo.corda, p.mat("#c9b38a"));
        c.position.set(x * 0.8, 1.55, z);
        c.rotation.z = x > 0 ? -0.35 : 0.35;
        g.add(c);
      }
      g.traverse((m) => { m.castShadow = true; });
      g.scale.setScalar(1.05);
      return g;
    }

    /** O navio voa de `de` para `para` (u de 0 a 1), olhando para onde vai, balançando. */
    function voar(n, de, para, u, tt, inclinado = 0) {
      const a = suave(u);
      n.position.lerpVectors(de, para, a);
      n.position.y += Math.sin(a * Math.PI) * 1.2 + Math.sin(tt * 2.5) * 0.06;
      const frente = new THREE.Vector3().subVectors(para, de).setY(0);
      if (frente.lengthSq() > 0.001) n.rotation.y = Math.atan2(frente.x, frente.z) - Math.PI / 2;
      n.rotation.z = Math.sin(tt * 2) * 0.04 + inclinado;
    }

    // efeitos de vida curta: fumaça, faíscas, moedas
    function fumaca(grupo, onde, n = 6, cor = "#ffffff") {
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(geo.fumaca, new THREE.MeshStandardMaterial({ color: cor, flatShading: true, transparent: true, opacity: 0.85, roughness: 1, emissive: cor, emissiveIntensity: 0.25 }));
        m.userData = { proprio: true, idade: 0, vida: 0.9 + Math.random() * 0.4, vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2), tipo: "fumaca" };
        m.position.copy(onde).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4));
        grupo.add(m);
        sim.efeitos.push(m);
      }
    }
    function faiscas(grupo, onde, n = 14, cor = "#ffd34d", forca = 3) {
      const mat = p.mat(cor);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(geo.faisca, mat);
        const a = Math.random() * Math.PI * 2;
        m.userData = { idade: 0, vida: 0.6 + Math.random() * 0.4, vel: new THREE.Vector3(Math.cos(a) * forca * Math.random(), forca * (0.5 + Math.random()), Math.sin(a) * forca * Math.random()), tipo: "faisca" };
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
          m.parent?.remove(m);
          if (d.proprio) m.material.dispose();
          return false;
        }
        m.position.addScaledVector(d.vel, dt);
        if (d.tipo === "faisca") { d.vel.y -= 9 * dt; m.scale.setScalar(1 - u); m.rotation.x += dt * 8; }
        else { d.vel.multiplyScalar(0.96); m.scale.setScalar(0.6 + u * 1.2); m.material.opacity = 0.85 * (1 - u); }
        return true;
      });
    }

    const falar = (humor, fala) => window.dispatchEvent(new CustomEvent("neuro", { detail: { humor, fala, duracao: 3000 } }));

    function encerrarSimulacao() {
      if (!sim) return;
      mundo.remove(sim.grupo);
      sim.grupo.traverse((m) => { if (m.userData?.proprio) m.material.dispose(); });
      const castelo = predios.get("castelo")?.grupo;
      if (castelo) castelo.position.set(LUGARES.castelo[0], 0, LUGARES.castelo[1]);
      const fim = sim.aoTerminar;
      sim = null;
      zoomAlvo = 1;
      tremor = 0;
      legendaRef.current?.(null);
      sujo = true;
      fim?.();
    }

    function iniciarSimulacao({ tipo, venceu, quartel = 0, torre: nivelTorre = 0, aoTerminar }) {
      if (sim) { const antigo = sim.aoTerminar; sim.aoTerminar = null; encerrarSimulacao(); antigo?.(); }
      const grupo = new THREE.Group();
      mundo.add(grupo);
      const atacando = tipo === "atacar";
      const cor = atacando ? "#2f6fd6" : "#c8332f";
      const qtd = atacando ? 4 + Math.min(4, quartel) : 7;
      const casa = atacando ? v3(LUGARES.quartel).add(new THREE.Vector3(-0.5, 0, -0.5)) : v3(LUGARES.castelo).add(new THREE.Vector3(0.3, 0, 1.15));
      const caminho = new THREE.Vector3().subVectors(casa, BORDA).normalize();
      const lateral = new THREE.Vector3(-caminho.z, 0, caminho.x);
      const soldados = Array.from({ length: qtd }, (_, i) => {
        const g = soldado(cor, i === 0);
        const fila = Math.floor(i / 3), coluna = (i % 3) - 1;
        g.userData.desvio = lateral.clone().multiplyScalar(coluna * 0.42).addScaledVector(caminho, -fila * 0.45);
        g.scale.setScalar(0.001);
        grupo.add(g);
        return g;
      });
      const barco = navio(cor);
      barco.visible = false;
      grupo.add(barco);

      // quem cai, e quando; as flechas saem dos Arqueiros (ou da Torre do Neuro, sem arqueiros)
      const mortos = atacando ? [] : venceu ? [2, 5] : soldados.map((_, i) => i);
      const mortes = new Map(mortos.map((i, k) => [i, venceu ? 4.0 + k * 1.0 : 3.5 + (k * 2.3) / Math.max(1, mortos.length - 1)]));
      const atirador = nivelTorre > 0 ? v3(LUGARES.torre, 1.5 + 0.3 * nivelTorre) : v3(LUGARES.castelo, 2.1);
      const flechas = [];
      if (!atacando) {
        for (const [i, quando] of mortes) flechas.push({ alvo: i, parte: quando - 0.55, acerta: true });
        const rajadas = 3 + Math.min(4, nivelTorre); // mais arqueiros, mais flechas no céu
        for (let k = 0; k < rajadas * 2; k++) flechas.push({ alvo: k % qtd, parte: 3.0 + (k * 2.8) / (rajadas * 2), acerta: false, erro: new THREE.Vector3((Math.random() - 0.5) * 1.4, 0, (Math.random() - 0.5) * 1.4) });
        for (const fl of flechas) { fl.malha = new THREE.Mesh(geo.flecha, p.mat(COR.madeiraEscura)); fl.malha.visible = false; grupo.add(fl.malha); }
      }

      const cofrePos = v3(LUGARES.cofre, 0.5);
      const moedas = [];
      if (venceu) {
        for (let k = 0; k < 16; k++) {
          const m = new THREE.Mesh(geo.moeda, p.mat(COR.ouro));
          m.visible = false;
          m.castShadow = true;
          grupo.add(m);
          moedas.push({ malha: m, atraso: k * 0.07, lado: (k % 5) * 0.25 - 0.5 });
        }
      }
      const inicioMoedas = atacando ? 9.0 : 7.0;
      const moedasDe = atacando ? DOCA.clone().setY(0.6) : cofrePos;
      const moedasPara = atacando ? cofrePos : DOCA.clone().setY(0.6);
      const voltam = atacando ? (venceu ? qtd : Math.max(1, Math.floor(qtd / 3))) : 0;
      const duracao = atacando ? 11.0 : venceu ? 10.8 : 8.2;
      const marcos = new Set();
      const umaVez = (chave, fn) => { if (!marcos.has(chave)) { marcos.add(chave); fn(); } };
      const legenda = (titulo, texto) => legendaRef.current?.({ alerta: atacando ? "ataque" : "defesa", titulo, texto, duracao });
      const pos = new THREE.Vector3();
      const castelo = () => predios.get("castelo")?.grupo;

      function marchar(g, de, para, u, tt, i, correndo = false) {
        const d = g.userData.desvio;
        const a = suave(u);
        pos.lerpVectors(de, para, a).add(d);
        const anda = u > 0 && u < 1;
        const ritmo = correndo ? 17 : 11;
        g.position.set(pos.x, anda ? Math.abs(Math.sin(tt * ritmo + i * 0.7)) * 0.08 : 0, pos.z);
        g.rotation.y = Math.atan2(para.x - de.x, para.z - de.z);
        const b = g.userData.boneco;
        b.rotation.z = anda ? Math.sin(tt * ritmo + i * 0.7) * 0.12 : 0;
        b.rotation.x = correndo && anda ? 0.3 : 0;
        if (b.userData.pano) b.userData.pano.rotation.y = Math.sin(tt * 6) * 0.3;
      }
      const aparecer = (g, tt, de) => g.scale.setScalar(Math.max(0.001, fase(tt, de, de + 0.35)));

      function atualizar(tt, dt) {
        atualizarEfeitos(dt);
        if (atacando) roteiroDeAtaque(tt); else roteiroDeDefesa(tt);
        for (const m of moedas) {
          const u = (tt - inicioMoedas - m.atraso) / 1.1;
          m.malha.visible = u > 0 && u < 1;
          if (!m.malha.visible) continue;
          m.malha.position.lerpVectors(moedasDe, moedasPara, u);
          m.malha.position.addScaledVector(LADO, m.lado * Math.sin(u * Math.PI));
          m.malha.position.y += Math.sin(u * Math.PI) * 1.8;
          m.malha.rotation.set(tt * 7, tt * 5, 0);
        }
        if (tt >= duracao) encerrarSimulacao();
      }

      // ---------------- defesa: navio inimigo, desembarque, flechas, portão, saque, fuga
      function roteiroDeDefesa(tt) {
        umaVez("alerta", () => { legenda("⚠️ SEU REINO ESTÁ SENDO ATACADO!", "Um navio inimigo se aproxima…"); zoomAlvo = 0.88; });
        barco.visible = true;
        if (tt < 2.4) voar(barco, LONGE, DOCA, fase(tt, 0.2, 2.4), tt);
        else if (!venceu ? tt < 6.2 : tt < 9.4) voar(barco, DOCA, DOCA, 1, tt);
        else voar(barco, DOCA, LONGE, fase(tt, venceu ? 9.4 : 6.2, venceu ? 10.8 : 8.0), tt);

        if (tt > 2.4) umaVez("desembarque", () => {
          legenda("⚠️ SEU REINO ESTÁ SENDO ATACADO!", "Os invasores desembarcaram!");
          falar("surpreso", "Invasores! Às armas! 🏹");
          fumaca(grupo, BORDA, 8);
        });
        if (tt > 3.0) umaVez("flechas", () => legenda("⚠️ SEU REINO ESTÁ SENDO ATACADO!", nivelTorre > 0 ? "Os Arqueiros abrem fogo! 🏹" : "A Torre do Neuro atira flechas! 🏹"));

        soldados.forEach((g, i) => {
          const morte = mortes.get(i);
          if (morte != null && tt >= morte) {
            const u = fase(tt, morte, morte + 0.3);
            g.userData.boneco.rotation.x = (-u * Math.PI) / 2;
            if (tt > morte + 0.9) umaVez(`poof${i}`, () => fumaca(grupo, g.position, 3, "#d9d9d9"));
            g.scale.setScalar(Math.max(0.001, 1 - fase(tt, morte + 0.9, morte + 1.2)));
            return;
          }
          if (tt < 2.4) { g.scale.setScalar(0.001); return; }
          if (tt < 2.9) { // pulam do navio para a ilha
            const u = fase(tt, 2.4, 2.9);
            pos.lerpVectors(DOCA, BORDA, u).add(g.userData.desvio);
            g.position.set(pos.x, Math.sin(u * Math.PI) * 0.5 + DOCA.y * (1 - u), pos.z);
            aparecer(g, tt, 2.4);
            return;
          }
          g.scale.setScalar(1);
          if (tt < 6.0) { marchar(g, BORDA, casa, (tt - 2.9) / 3.1, tt, i, tt > 5.0); return; }
          if (tt < 8.2) { // no portão: golpes de lança
            marchar(g, BORDA, casa, 1, tt, i);
            const b = g.userData.boneco;
            if (b.userData.lanca) b.userData.lanca.position.z = Math.max(0, Math.sin(tt * 14 + i)) * 0.15;
            return;
          }
          marchar(g, casa, BORDA, (tt - 8.2) / 1.0, tt, i, true); // fogem com o saque
          if (tt > 9.2) { const u = fase(tt, 9.2, 9.5); pos.lerpVectors(BORDA, DOCA, u); g.position.set(pos.x + g.userData.desvio.x, DOCA.y * u + Math.sin(u * Math.PI) * 0.5, pos.z + g.userData.desvio.z); g.scale.setScalar(Math.max(0.001, 1 - u)); }
        });

        for (const fl of flechas) {
          const u = (tt - fl.parte) / 0.55;
          fl.malha.visible = u > 0 && u < 1;
          if (!fl.malha.visible) continue;
          const alvo = soldados[fl.alvo];
          const chegada = alvo.position.clone().add(fl.acerta ? new THREE.Vector3(0, 0.3, 0) : fl.erro);
          const atual = new THREE.Vector3().lerpVectors(atirador, chegada, u);
          atual.y += Math.sin(u * Math.PI) * 1.4;
          const prox = new THREE.Vector3().lerpVectors(atirador, chegada, Math.min(1, u + 0.05));
          prox.y += Math.sin(Math.min(1, u + 0.05) * Math.PI) * 1.4;
          fl.malha.position.copy(atual);
          fl.malha.lookAt(prox);
          if (!fl.acerta && u > 0.95) umaVez(`chao${fl.parte}`, () => faiscas(grupo, chegada.clone().setY(0.05), 4, "#c9b38a", 1.2));
        }

        if (venceu) {
          if (tt > 6.0) umaVez("portao", () => {
            legenda("⚠️ SEU REINO ESTÁ SENDO ATACADO!", "Os invasores chegaram aos portões!");
            tremor = 0.9; zoomAlvo = 1.12;
          });
          if (tt > 6.0 && tt < 7.4) {
            umaVez(`faisca${Math.floor(tt * 5)}`, () => faiscas(grupo, casa.clone().setY(0.4), 8));
            const c = castelo();
            if (c) c.position.set(LUGARES.castelo[0] + Math.sin(tt * 40) * 0.04, 0, LUGARES.castelo[1] + Math.cos(tt * 37) * 0.04);
          } else if (castelo()) castelo().position.set(LUGARES.castelo[0], 0, LUGARES.castelo[1]);
          if (tt > 7.0) umaVez("saque", () => { legenda("💥 O REINO CAIU", "Estão saqueando o Cofre! 🪙"); falar("triste", "Levaram moedas do reino…"); zoomAlvo = 0.92; });
          if (tt > 8.2) umaVez("fuga", () => legenda("💥 O REINO CAIU", "Eles fogem com o saque…"));
        } else {
          if (tt > 5.9) umaVez("vitoria", () => {
            legenda("🛡️ VITÓRIA! O REINO RESISTIU", "O último invasor caiu. O navio foge vazio!");
            falar("comemorando", "Defendemos o reino! 🛡️");
            zoomAlvo = 1;
          });
          for (const [k, quando] of [[0, 6.1], [1, 6.5], [2, 6.9], [3, 7.3]]) {
            if (tt > quando) umaVez(`fogos${k}`, () => faiscas(grupo, v3(LUGARES.castelo, 3.2 + k * 0.2).addScaledVector(LADO, (k - 1.5) * 0.6), 18, k % 2 ? "#ffd34d" : "#7cc46a", 3.5));
          }
        }
      }

      // ---------------- ataque: formação, embarque, viagem, batalha ao longe, volta, saque
      function roteiroDeAtaque(tt) {
        umaVez("alerta", () => { legenda("⚔️ BATALHA EM ANDAMENTO", "Tropas, formar!"); zoomAlvo = 0.88; soldados.forEach((g) => fumaca(grupo, casa.clone().add(g.userData.desvio), 1)); });
        barco.visible = true;
        const subida = DOCA.clone().setY(-2.6);
        if (tt < 3.4) voar(barco, subida, DOCA, fase(tt, 0, 1.2), tt);
        else if (tt < 5.2) voar(barco, DOCA, LONGE, fase(tt, 3.4, 5.2), tt);
        else if (tt < 7.2) { voar(barco, LONGE, LONGE, 1, tt); barco.visible = false; }
        else if (tt < 10.0) voar(barco, LONGE, DOCA, fase(tt, 7.2, 8.8), tt, venceu ? 0 : 0.35);
        else voar(barco, DOCA, subida, fase(tt, 10.0, 10.9), tt);

        if (tt > 0.8) umaVez("marcha", () => legenda("⚔️ BATALHA EM ANDAMENTO", "As tropas marcham para o navio"));
        if (tt > 3.4) umaVez("parte", () => { legenda("⚔️ BATALHA EM ANDAMENTO", "Rumo ao reino rival! ⛵"); falar("pensando", "Lá vão eles… ⚔️"); });
        if (tt > 5.2) umaVez("longe", () => legenda("⚔️ BATALHA EM ANDAMENTO", "A batalha está acontecendo no reino rival…"));
        if (tt > 5.2 && tt < 7.2) {
          umaVez(`clarao${Math.floor(tt * 4)}`, () => {
            const onde = LONGE.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, -1.5 + Math.random(), (Math.random() - 0.5) * 1.6));
            faiscas(grupo, onde, 10, Math.random() > 0.5 ? "#ffb347" : "#ffd34d", 2.5);
            if (Math.random() > 0.5) fumaca(grupo, onde, 2, "#9a9a9a");
          });
        }
        if (tt > 7.2) umaVez("volta", () => legenda("⚔️ BATALHA EM ANDAMENTO", venceu ? "O navio está voltando… vitorioso!" : "O navio está voltando… avariado"));
        if (!venceu && tt > 7.2 && tt < 8.8) umaVez(`rastro${Math.floor(tt * 5)}`, () => fumaca(grupo, barco.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 1, "#6b6b6b"));
        if (tt > 9.0) umaVez("fim", () => {
          if (venceu) { legenda("🏆 VITÓRIA!", "Trouxemos o saque para o Cofre! 🪙"); falar("comemorando", "Vitória! Trouxemos moedas! 🪙"); faiscas(grupo, cofrePos.clone().setY(1.6), 20, "#ffd34d", 3); }
          else { legenda("💥 DERROTA", "A defesa deles segurou… voltaram poucos."); falar("triste", "Perdemos dessa vez…"); }
        });

        soldados.forEach((g, i) => {
          if (tt < 2.8) { aparecer(g, tt, 0.1 + i * 0.05); marchar(g, casa, BORDA, (tt - 0.6) / 2.2, tt, i); return; }
          if (tt < 3.3) { // embarcam
            const u = fase(tt, 2.8, 3.3);
            pos.lerpVectors(BORDA, DOCA, u).add(g.userData.desvio);
            g.position.set(pos.x, DOCA.y * u + Math.sin(u * Math.PI) * 0.5, pos.z);
            g.scale.setScalar(Math.max(0.001, 1 - u));
            return;
          }
          if (tt < 8.8 || i >= voltam) { g.scale.setScalar(0.001); return; }
          if (tt < 9.2) { // desembarcam os que voltaram
            const u = fase(tt, 8.8, 9.2);
            pos.lerpVectors(DOCA, BORDA, u).add(g.userData.desvio);
            g.position.set(pos.x, DOCA.y * (1 - u) + Math.sin(u * Math.PI) * 0.5, pos.z);
            g.scale.setScalar(Math.max(0.001, u));
            return;
          }
          g.scale.setScalar(Math.max(0.001, 1 - fase(tt, 10.6, 10.95)));
          marchar(g, BORDA, casa, (tt - 9.2) / 1.4, tt, i);
        });
      }

      sim = { grupo, inicio: performance.now(), atualizar, aoTerminar, efeitos: [] };
    }

    const aoSimular = (e) => {
      if (semMovimento || !e.detail) return;
      e.detail.aceito = true;
      iniciarSimulacao(e.detail);
    };
    window.addEventListener("reino-simular", aoSimular);

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
      window.removeEventListener("reino-simular", aoSimular);
      if (sim) {
        mundo.remove(sim.grupo);
        sim.grupo.traverse((m) => { if (m.userData?.proprio) m.material.dispose(); });
        sim = null;
      }
      for (const g of Object.values(geo)) g.dispose();
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
  }, [humorAtual]);

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
      {construcoes.map((c) => (
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
