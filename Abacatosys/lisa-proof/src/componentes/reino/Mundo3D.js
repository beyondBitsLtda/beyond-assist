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
    <div className="rn-mundo" ref={caixa}>
      {construcoes.map((c) => (
        <button key={c.chave} type="button" className={`rn-mundo__rotulo${c.nivel === 0 ? " rn-mundo__rotulo--vazio" : ""}`}
          ref={(n) => { rotulos.current[c.chave] = n; }}
          onClick={() => aoEscolher?.(c.chave)}
          aria-label={`${c.nome}, ${c.nivel ? `nível ${c.nivel}` : "ainda não construída"} — ver a construção`}>
          <span aria-hidden="true">{c.emoji}</span> {c.nivel ? `nv ${c.nivel}` : "construir"}
        </button>
      ))}
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
