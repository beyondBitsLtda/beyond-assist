"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import Neuro, { usePersonagem } from "@/componentes/Neuro.js";
import { urlDoMonstro, TAMANHO_DOS_MONSTROS } from "@/componentes/reino/monstrosDePapel.js";
import { svgComoImagem, recorteDePapel } from "@/componentes/reino/papel.js";

/**
 * A torre do Modo Domínio em 3D (24/10/2026). Pedidos: "um mapa 3D igual o do Reino, porém sempre
 * uma montanha ou uma grande torre que deve ser escalada", "muito mais detalhes, falta relevo" e
 * "cada adversário é na verdade um andar da torre que o nosso personagem entra para enfrentar".
 *
 * Cada ANDAR é uma sala: parede de pedra com pilastras, frisos, janelas acesas e pedras salientes
 * (na montanha, rocha bruta com pedregulhos), uma porta em arco virada para fora, a sacada na frente
 * dela e uma escada por fora, colada na parede, que sobe até a sacada do andar de cima — as portas
 * giram em volta da torre conforme ela sobe. Dentro da sala: o tapete, as tochas e o CHEFÃO do andar
 * (recorte de papel dos monstros do Reino). Cada andar se enfeita com o tema do seu chefão: gelo,
 * lava, cipós, neon, braseiros, conchas, tábuas ou pedras.
 *
 * A sala do andar de agora fica acesa (uma luz de tocha que tremula); as de cima ficam escuras, com o
 * chefão em silhueta. Andar vencido ganha a bandeira verde na sacada. O Neuro (o recorte de papel do
 * mascote, com o personagem da pessoa) espera na sacada; na luta (`lutando`), ele ENTRA na sala e a
 * câmera entra junto. Cada golpe do roteiro chega pela prop `golpe` ({ k, quem, especial } ou
 * { k, fim: true, venceu }). Quando `atual` sobe, o Neuro sai da sala e sobe a escada até a próxima.
 *
 * Desempenho: tudo o que é fixo vira poucas malhas (as peças são fundidas por material, com a cor em
 * cada vértice); os detalhes finos só nos andares perto do de agora. Arrastar gira a torre e sobe ou
 * desce a vista; clicar num andar chama `aoEscolher(numero)`. Sem WebGL, chama `aoFalhar()`. Com
 * "reduzir movimento", nada anima.
 */

const H = 2.4;              // altura de um andar
const LAJE = 0.24;          // o piso (e a cornija de fora)
const PORTA_L = 1.9;        // largura da porta
const PORTA_A = 1.55;       // altura da porta
const R_DENTRO = 2.75;      // o raio da sala
const PASSO = 1.8;          // quanto a porta gira de um andar para o outro (dá lugar à escada)
const DEGRAUS = 9;
const NEURO = 1.05;         // tamanho do recorte do Neuro
const PERTO = 9;            // andares com todos os detalhes, acima e abaixo do de agora

/** Torre de pedra ou montanha: cada repositório tem a sua (a semente decide). */
export const formaDaTorre = (semente) => ((semente >>> 0) % 2 ? "montanha" : "torre");

/** O tema de cada andar vem do chefão dele: a cor das faixas, a luz da sala e o enfeite. */
const TEMAS = {
  golem: { faixa: "#8d8f99", luz: "#ffd9a0", enfeite: "pedras" },
  ent: { faixa: "#3f8f3a", luz: "#d8ffb8", enfeite: "cipos" },
  ogro: { faixa: "#8a5a2b", luz: "#ffc58a", enfeite: "madeira" },
  ciborgue: { faixa: "#19a7ad", luz: "#a6fbff", enfeite: "neon" },
  cerbero: { faixa: "#7a1f1f", luz: "#ff8f5c", enfeite: "braseiros" },
  golemDeMagma: { faixa: "#d4561c", luz: "#ffa040", enfeite: "lava" },
  kraken: { faixa: "#1d6f8a", luz: "#9fe6ff", enfeite: "conchas" },
  giganteDeGelo: { faixa: "#7cc7f0", luz: "#e0f6ff", enfeite: "gelo" },
  rainhaAlien: { faixa: "#7b3fd1", luz: "#e6b8ff", enfeite: "neon" },
  dragaoDeLava: { faixa: "#b3221a", luz: "#ffb050", enfeite: "lava" },
};

const raioDe = (forma, i, n) => (forma === "torre" ? 3.2 : 5.1 - 1.8 * (n > 1 ? Math.min(1, (i - 1) / (n - 1)) : 0));
const anguloDaPorta = (i) => (i - 1) * PASSO;
const base = (i) => (i - 1) * H;
const direcao = (a) => new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
const tangente = (a) => new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
const distAng = (x, y) => Math.abs(Math.atan2(Math.sin(x - y), Math.cos(x - y)));

function sorteio(semente) {
  let a = semente >>> 0 || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function variar(cor, r, quanto = 0.08) {
  const c = new THREE.Color(cor);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + (r() - 0.5) * quanto)));
  return c;
}

/**
 * Junta as peças fixas por material (cor em cada vértice) e funde no fim: poucas malhas, poucos
 * desenhos. As peças vão em BLOCOS de andares (`grupo`): o bloco fora da vista nem é desenhado, e só
 * os blocos perto da vista fazem sombra.
 */
const ANDARES_POR_BLOCO = 6;
function criarPedreiro() {
  const lotes = {};
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, "YXZ"), p = new THREE.Vector3(), s = new THREE.Vector3();
  return {
    grupo: "base",
    por(lote, geo, cor, { x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (g !== geo) geo.dispose();
      e.set(rx, ry, rz);
      q.setFromEuler(e);
      g.applyMatrix4(m.compose(p.set(x, y, z), q, s.set(sx, sy, sz)));
      const c = cor instanceof THREE.Color ? cor : new THREE.Color(cor);
      const n = g.attributes.position.count;
      const cores = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { cores[k * 3] = c.r; cores[k * 3 + 1] = c.g; cores[k * 3 + 2] = c.b; }
      g.setAttribute("color", new THREE.BufferAttribute(cores, 3));
      (lotes[`${lote}|${this.grupo}`] ||= []).push(g);
    },
    /** [{ lote, grupo, geo }] */
    fundir() {
      const saida = [];
      for (const [k, lista] of Object.entries(lotes)) {
        const [lote, grupo] = k.split("|");
        if (lista.length) saida.push({ lote, grupo, geo: mergeGeometries(lista, false) });
        for (const g of lista) g.dispose();
      }
      return saida;
    },
  };
}

/** Um número pintado numa plaquinha (o número do andar, ao lado da sacada). */
function plaquinha(texto, destaque) {
  const c = document.createElement("canvas");
  c.width = 96; c.height = 48;
  const x = c.getContext("2d");
  x.fillStyle = destaque ? "#f5c542" : "rgba(17,24,20,0.8)";
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

// ------------------------------------------------------------------ as peças de um andar

const V = (v, y, extra = {}) => ({ x: v.x, y, z: v.z, ...extra });
const ponto = (raio, ang, y) => ({ x: Math.sin(ang) * raio, y, z: Math.cos(ang) * raio });

function construirAndar(P, { i, n, forma, chefao, vencido, atual, concluida, detalhe }) {
  const r = sorteio(i * 7919 + 13);
  const torre = forma === "torre";
  const R = raioDe(forma, i, n), a = anguloDaPorta(i), y0 = base(i);
  const d = direcao(a), t = tangente(a);
  const tema = TEMAS[chefao] || TEMAS.golem;
  const parede = torre ? "#b8b0a0" : "#837b72";
  const clara = torre ? "#d6cfc0" : "#9a9188";
  const alturaParede = H - LAJE;
  const yChao = y0 + LAJE;
  const vaoExt = PORTA_L / R, vaoInt = PORTA_L / R_DENTRO;
  const lados = detalhe ? 44 : 24;

  // o piso (a laje sobra para fora: a cornija)
  P.por("pedra", new THREE.CylinderGeometry(R + 0.3, R + 0.24, LAJE, detalhe ? 36 : 22), variar(torre ? "#9d9585" : "#6f6861", r, 0.05), { y: y0 + LAJE / 2 });
  // a parede de fora, sem o vão da porta, e o pedaço por cima da porta
  P.por("pedra", new THREE.CylinderGeometry(R, R, alturaParede, lados, 1, true, a + vaoExt / 2, Math.PI * 2 - vaoExt), variar(parede, r, 0.06), { y: yChao + alturaParede / 2 });
  const verga = alturaParede - PORTA_A;
  P.por("pedra", new THREE.CylinderGeometry(R, R, verga, 6, 1, true, a - vaoExt / 2, vaoExt), variar(parede, r, 0.06), { y: yChao + PORTA_A + verga / 2 });
  // a parede de dentro (a sala), vista por dentro
  const corDentro = torre ? "#cbb48d" : "#7d7064";
  P.por("dentro", new THREE.CylinderGeometry(R_DENTRO, R_DENTRO, alturaParede, lados, 1, true, a + vaoInt / 2, Math.PI * 2 - vaoInt), corDentro, { y: yChao + alturaParede / 2 });
  P.por("dentro", new THREE.CylinderGeometry(R_DENTRO, R_DENTRO, verga, 6, 1, true, a - vaoInt / 2, vaoInt), corDentro, { y: yChao + PORTA_A + verga / 2 });
  // a espessura da parede na porta: o teto do vão e os batentes
  const meio = (R + R_DENTRO) / 2, espessura = R - R_DENTRO + 0.12;
  P.por("pedra", new THREE.BoxGeometry(PORTA_L + 0.2, 0.1, espessura), clara, V(d.clone().multiplyScalar(meio), yChao + PORTA_A + 0.05, { ry: a }));
  for (const lado of [-1, 1]) {
    const c = d.clone().multiplyScalar(meio).addScaledVector(t, lado * (PORTA_L / 2 + 0.12));
    P.por("pedra", new THREE.BoxGeometry(0.3, PORTA_A, espessura), clara, V(c, yChao + PORTA_A / 2, { ry: a }));
  }

  if (torre) {
    // o arco sobre a porta, com a pedra-chave
    const arco = PORTA_L / 2 + 0.14;
    P.por("pedra", new THREE.TorusGeometry(arco, 0.13, 6, 18, Math.PI), clara, { ...ponto(R + 0.08, a, yChao + PORTA_A), ry: a, sy: 0.42 });
    P.por("pedra", new THREE.BoxGeometry(0.28, 0.36, 0.24), clara, { ...ponto(R + 0.1, a, yChao + PORTA_A + arco * 0.42), ry: a });
    // as pilastras (o relevo vertical), com capitel
    for (let k = 0; k < 6; k++) {
      const ang = a + Math.PI / 6 + (k * Math.PI) / 3;
      if (distAng(ang, a) < vaoExt / 2 + 0.3) continue;
      P.por("pedra", new THREE.BoxGeometry(0.42, alturaParede, 0.3), variar("#a39b8b", r, 0.05), { ...ponto(R + 0.1, ang, yChao + alturaParede / 2), ry: ang });
      P.por("pedra", new THREE.BoxGeometry(0.56, 0.14, 0.42), clara, { ...ponto(R + 0.14, ang, yChao + alturaParede - 0.07), ry: ang });
      P.por("pedra", new THREE.BoxGeometry(0.56, 0.12, 0.42), clara, { ...ponto(R + 0.14, ang, yChao + 0.06), ry: ang });
    }
  } else {
    // a montanha: a porta é a boca de uma caverna, cercada de pedregulhos
    for (let k = 0; k <= 6; k++) {
      const f = (k / 6) * Math.PI;
      const c = d.clone().multiplyScalar(R + 0.12).addScaledVector(t, Math.cos(f) * (PORTA_L / 2 + 0.3));
      const tam = 0.3 + r() * 0.2;
      P.por("pedra", new THREE.DodecahedronGeometry(tam, 0), variar("#77706a", r, 0.1), V(c, yChao + Math.sin(f) * (PORTA_A + 0.22) + 0.05, { ry: r() * 6, rx: r() * 6, sy: 0.8 + r() * 0.4 }));
    }
    // a rocha bruta por fora — só no trecho da parede entre a escada que chega (de baixo) e a que
    // sai do andar de cima, para nenhuma pedra invadir um degrau
    for (let k = 0; k < (detalhe ? 9 : 4); k++) {
      const ang = a + 3.4 + r() * 1.25;
      const tam = 0.45 + r() * 0.55;
      P.por("pedra", new THREE.DodecahedronGeometry(tam, 0), variar("#7a736b", r, 0.12), { ...ponto(R + tam * 0.25, ang, yChao + tam * 0.4 + r() * (alturaParede - tam)), ry: r() * 6, rx: r() * 6, sx: 1.2, sy: 0.7 + r() * 0.5 });
    }
  }

  // a sacada na frente da porta (metade de um disco), com o apoio por baixo
  P.por("pedra", new THREE.CylinderGeometry(1.1, 1.0, 0.22, 16, 1, false, -Math.PI / 2, Math.PI), torre ? clara : "#8a5a35", V(d.clone().multiplyScalar(R), yChao - 0.11, { ry: a }));
  P.por("pedra", new THREE.ConeGeometry(0.55, 0.8, 6), torre ? "#a39b8b" : "#6e4a2a", V(d.clone().multiplyScalar(R + 0.35), y0 - 0.3, { rx: Math.PI, ry: a }));
  for (const f of [-1.2, -0.6, 0, 0.6]) {
    const c = d.clone().multiplyScalar(R).addScaledVector(d, Math.cos(f) * 0.95).addScaledVector(t, Math.sin(f) * 0.95);
    P.por("pedra", new THREE.BoxGeometry(0.08, 0.5, 0.08), torre ? clara : "#6e4a2a", V(c, yChao + 0.25));
  }
  // as tochas dos lados da porta
  for (const lado of [-1, 1]) {
    const c = d.clone().multiplyScalar(R + 0.14).addScaledVector(t, lado * (PORTA_L / 2 + 0.36));
    P.por("pedra", new THREE.BoxGeometry(0.08, 0.32, 0.2), "#3b2f25", V(c, yChao + 1.22, { ry: a }));
    P.por("brilho", new THREE.ConeGeometry(0.075, 0.22, 6), i === atual ? "#ffc35a" : "#ff9d3a", V(c.clone().addScaledVector(d, 0.06), yChao + 1.5));
  }
  // as faixas do chefão, dos lados da porta (a cor do tema), com o emblema
  for (const lado of [-1, 1]) {
    const c = d.clone().multiplyScalar(R + 0.06).addScaledVector(t, lado * (PORTA_L / 2 + 0.78));
    P.por("tecido", new THREE.BoxGeometry(0.42, 1.05, 0.03), tema.faixa, V(c, yChao + 1.28, { ry: a }));
    P.por("tecido", new THREE.BoxGeometry(0.3, 0.3, 0.03), tema.faixa, V(c, yChao + 0.76, { ry: a, rz: Math.PI / 4 }));
    P.por("brilho", new THREE.BoxGeometry(0.13, 0.13, 0.04), "#f5c542", V(c.clone().addScaledVector(d, 0.02), yChao + 1.4, { ry: a, rz: Math.PI / 4 }));
  }
  // a escada até a sacada de cima, colada na parede, com os apoios
  if (i <= n) {
    const de = a + 0.36, ate = a + PASSO - 0.36;
    for (let k = 0; k < DEGRAUS; k++) {
      const f = (k + 0.5) / DEGRAUS;
      const ang = de + f * (ate - de);
      const rk = raioDe(forma, i + f, n);
      const topo = yChao + ((k + 1) / (DEGRAUS + 1)) * H;
      const comprimento = ((rk + 0.72) * (ate - de)) / DEGRAUS * 1.08;
      P.por("pedra", new THREE.BoxGeometry(comprimento, 0.16, 0.85), variar(torre ? "#a69e8e" : "#8a5a35", r, 0.06), { ...ponto(rk + 0.72, ang, topo - 0.08), ry: ang });
      if (detalhe) P.por("pedra", new THREE.BoxGeometry(0.12, 0.3, 0.7), torre ? "#8f8778" : "#5f4128", { ...ponto(rk + 0.4, ang, topo - 0.3), ry: ang });
    }
  }

  if (detalhe) {
    if (torre) {
      // os dentículos debaixo da cornija de cima e as janelas acesas
      for (let k = 0; k < 40; k++) {
        const ang = (k / 40) * Math.PI * 2;
        P.por("pedra", new THREE.BoxGeometry(0.14, 0.12, 0.14), clara, { ...ponto(R + 0.07, ang, y0 + H - 0.08), ry: ang });
      }
      for (const lado of [-0.72, 0.72]) {
        const ang = a + Math.PI + lado;
        P.por("pedra", new THREE.BoxGeometry(0.56, 0.86, 0.1), clara, { ...ponto(R + 0.03, ang, yChao + 1.05), ry: ang });
        P.por("brilho", new THREE.BoxGeometry(0.32, 0.56, 0.05), i <= atual ? "#ffcf73" : "#e0a64a", { ...ponto(R + 0.09, ang, yChao + 1.02), ry: ang });
        P.por("pedra", new THREE.BoxGeometry(0.66, 0.08, 0.22), clara, { ...ponto(R + 0.1, ang, yChao + 0.6), ry: ang });
      }
    }
    // pedras salientes na parede (o relevo das juntas)
    for (let k = 0; k < 10; k++) {
      const ang = a + vaoExt / 2 + 0.4 + r() * (Math.PI * 2 - vaoExt - 0.8);
      P.por("pedra", new THREE.BoxGeometry(0.38 + r() * 0.24, 0.17, 0.07), variar(parede, r, 0.14), { ...ponto(R + 0.03, ang, yChao + 0.2 + r() * (alturaParede - 0.4)), ry: ang });
    }
    enfeitar(P, { tema, r, R, a, d, t, y0, yChao, vaoExt });
    // dentro da sala: o tapete do tema, duas tochas e a tapeçaria do fundo
    P.por("pedra", new THREE.CylinderGeometry(1.45, 1.45, 0.02, 24), new THREE.Color(tema.faixa).multiplyScalar(0.6), { y: yChao + 0.012 });
    for (const lado of [-0.95, 0.95]) {
      const ang = a + Math.PI + lado;
      P.por("pedra", new THREE.BoxGeometry(0.08, 0.3, 0.18), "#3b2f25", { ...ponto(R_DENTRO - 0.1, ang, yChao + 1.3), ry: ang });
      P.por("brilho", new THREE.ConeGeometry(0.07, 0.2, 6), "#ffb347", { ...ponto(R_DENTRO - 0.18, ang, yChao + 1.56) });
    }
    P.por("tecido", new THREE.BoxGeometry(0.8, 1.3, 0.03), tema.faixa, { ...ponto(R_DENTRO - 0.05, a + Math.PI, yChao + 1.2), ry: a + Math.PI });
    P.por("brilho", new THREE.BoxGeometry(0.22, 0.22, 0.04), "#f5c542", { ...ponto(R_DENTRO - 0.08, a + Math.PI, yChao + 1.35), ry: a + Math.PI, rz: Math.PI / 4 });
    mobiliarSala(P, { tema, r, a, d, t, yChao, alturaParede, torre, clara, vaoInt });
  }

  // vencido: a bandeira verde na sacada; o de agora: o aro dourado
  if (vencido) {
    const c = d.clone().multiplyScalar(R + 0.75).addScaledVector(t, -0.5);
    P.por("pedra", new THREE.CylinderGeometry(0.035, 0.035, 1.15, 6), "#6e4a2a", V(c, yChao + 0.58));
    P.por("tecido", new THREE.BoxGeometry(0.52, 0.32, 0.02), "#22c55e", V(c.clone().addScaledVector(t, 0.27), yChao + 1.0, { ry: a }));
  } else if (i === atual && !concluida) {
    P.por("brilho", new THREE.TorusGeometry(1.03, 0.045, 6, 36), "#f5c542", V(d.clone().multiplyScalar(R), yChao + 0.015, { rx: Math.PI / 2 }));
  }
}

/**
 * A sala por dentro: colunas com capitel, os frisos da parede, as lajotas em volta do tapete, o
 * lustre de velas, duas seteiras com a luz do céu e o tema do chefão também do lado de dentro.
 */
function mobiliarSala(P, { tema, r, a, d, t, yChao, alturaParede, torre, clara, vaoInt }) {
  const corColuna = torre ? clara : "#8c8378";
  for (const ang of [a + Math.PI - 0.85, a + Math.PI + 0.85, a + 1.95, a - 1.95]) {
    P.por("pedra", new THREE.CylinderGeometry(0.15, 0.18, alturaParede, 8), corColuna, ponto(R_DENTRO - 0.32, ang, yChao + alturaParede / 2));
    P.por("pedra", new THREE.BoxGeometry(0.42, 0.14, 0.42), corColuna, { ...ponto(R_DENTRO - 0.32, ang, yChao + alturaParede - 0.07), ry: ang });
    P.por("pedra", new THREE.BoxGeometry(0.42, 0.12, 0.42), corColuna, { ...ponto(R_DENTRO - 0.32, ang, yChao + 0.06), ry: ang });
  }
  // os frisos (o relevo da parede de dentro), sem fechar a porta
  for (const y of [yChao + 0.32, yChao + alturaParede - 0.3]) {
    P.por("dentro", new THREE.CylinderGeometry(R_DENTRO - 0.04, R_DENTRO - 0.04, 0.1, 40, 1, true, a + vaoInt / 2 + 0.05, Math.PI * 2 - vaoInt - 0.1), torre ? "#a8916c" : "#62574c", { y });
  }
  // as lajotas em volta do tapete
  for (let k = 0; k < 14; k++) {
    const ang = (k / 14) * Math.PI * 2 + r() * 0.1;
    P.por("pedra", new THREE.BoxGeometry(0.5, 0.025, 0.42), variar(torre ? "#a69a86" : "#6c645b", r, 0.1), { ...ponto(1.95 + r() * 0.25, ang, yChao + 0.012), ry: ang });
  }
  // o lustre: o aro, a corrente e as velas
  P.por("pedra", new THREE.BoxGeometry(0.03, 0.22, 0.03), "#2b2420", { y: yChao + alturaParede - 0.11 });
  P.por("pedra", new THREE.TorusGeometry(0.45, 0.03, 5, 20), "#3a2f25", { y: yChao + alturaParede - 0.24, rx: Math.PI / 2 });
  for (let k = 0; k < 5; k++) {
    const ang = (k / 5) * Math.PI * 2;
    P.por("pedra", new THREE.CylinderGeometry(0.03, 0.03, 0.12, 5), "#efe6d2", ponto(0.45, ang, yChao + alturaParede - 0.18));
    P.por("brilho", new THREE.ConeGeometry(0.03, 0.08, 5), "#ffd27a", ponto(0.45, ang, yChao + alturaParede - 0.08));
  }
  // as seteiras: frestas com a luz do céu
  for (const lado of [-0.42, 0.42]) {
    const ang = a + Math.PI + lado;
    P.por("brilho", new THREE.BoxGeometry(0.1, 0.62, 0.03), "#8ec9ff", { ...ponto(R_DENTRO - 0.02, ang, yChao + 1.25), ry: ang + Math.PI });
  }
  // o tema por dentro
  const solto = () => ({ ang: a + Math.PI + (r() - 0.5) * 2.6, raio: 1.2 + r() * 1.1 });
  switch (tema.enfeite) {
    case "gelo":
      for (let k = 0; k < 6; k++) { const { ang, raio } = solto(); const h = 0.25 + r() * 0.45; P.por("pedra", new THREE.ConeGeometry(0.1, h, 5), "#cfeeff", ponto(raio, ang, yChao + h / 2)); }
      for (let k = 0; k < 8; k++) { const ang = r() * Math.PI * 2; const h = 0.2 + r() * 0.25; P.por("pedra", new THREE.ConeGeometry(0.05, h, 5), "#e3f6ff", { ...ponto(1.4 + r() * 1.1, ang, yChao + alturaParede - h / 2), rx: Math.PI }); }
      break;
    case "lava":
      for (let k = 0; k < 6; k++) { const { ang, raio } = solto(); P.por("brilho", new THREE.BoxGeometry(0.06, 0.012, 0.7), "#ff7a1a", { ...ponto(raio, ang, yChao + 0.03), ry: ang + r() }); }
      break;
    case "cipos":
      for (let k = 0; k < 6; k++) { const ang = r() * Math.PI * 2, len = 0.5 + r() * 0.7; P.por("pedra", new THREE.BoxGeometry(0.04, len, 0.04), "#2f6b2a", ponto(1.4 + r() * 1.0, ang, yChao + alturaParede - len / 2)); P.por("pedra", new THREE.IcosahedronGeometry(0.1, 0), "#4caf50", ponto(1.4 + r() * 1.0, ang, yChao + alturaParede - len)); }
      break;
    case "neon":
      P.por("brilho", new THREE.TorusGeometry(1.55, 0.025, 4, 48), tema.faixa, { y: yChao + 0.03, rx: Math.PI / 2 });
      break;
    case "braseiros":
      for (const lado of [-1, 1]) { const c = d.clone().multiplyScalar(-1.6).addScaledVector(t, lado * 1.2); P.por("pedra", new THREE.CylinderGeometry(0.2, 0.12, 0.2, 8), "#3a2a22", V(c, yChao + 0.38)); P.por("pedra", new THREE.CylinderGeometry(0.04, 0.05, 0.3, 6), "#2b2420", V(c, yChao + 0.15)); P.por("brilho", new THREE.ConeGeometry(0.15, 0.36, 7), "#ff6a2a", V(c, yChao + 0.62)); }
      break;
    case "conchas":
      { const { ang, raio } = solto(); P.por("brilho", new THREE.CylinderGeometry(0.7, 0.7, 0.01, 18), "#3aa7c9", ponto(raio * 0.7, ang, yChao + 0.025)); }
      for (let k = 0; k < 6; k++) { const { ang, raio } = solto(); P.por("pedra", new THREE.SphereGeometry(0.08, 6, 4), r() < 0.5 ? "#e8f1f2" : "#f2a7b6", ponto(raio, ang, yChao + 0.06)); }
      break;
    case "madeira":
      for (let k = 0; k < 3; k++) { const { ang, raio } = solto(); const s = 0.32 + r() * 0.18; P.por("pedra", new THREE.BoxGeometry(s, s, s), "#8a5a2b", { ...ponto(raio, ang, yChao + s / 2), ry: r() * 3 }); }
      break;
    default:
      for (let k = 0; k < 5; k++) { const { ang, raio } = solto(); const s = 0.12 + r() * 0.16; P.por("pedra", new THREE.DodecahedronGeometry(s, 0), variar("#8d8f99", r, 0.1), ponto(raio, ang, yChao + s * 0.6)); }
  }
}

/** O enfeite do tema do chefão, por fora do andar. */
function enfeitar(P, { tema, r, R, a, d, t, y0, yChao, vaoExt }) {
  const livre = () => a + vaoExt / 2 + 0.35 + r() * (Math.PI * 2 - vaoExt - 0.7);
  switch (tema.enfeite) {
    case "gelo":
      for (let k = 0; k < 14; k++) {
        const ang = livre(), len = 0.28 + r() * 0.4;
        P.por("pedra", new THREE.ConeGeometry(0.06, len, 5), "#d6f3ff", { ...ponto(R + 0.22, ang, y0 + H - len / 2 - 0.02), rx: Math.PI });
      }
      for (let k = 0; k < 7; k++) {
        const ang = livre();
        P.por("pedra", new THREE.BoxGeometry(0.42, 0.08, 0.24), "#f4fbff", { ...ponto(R + 0.16, ang, yChao + 0.03), ry: ang });
      }
      break;
    case "lava":
      for (let k = 0; k < 5; k++) {
        const ang = livre(), y = yChao + 0.3 + r() * 1.2;
        for (let s = 0; s < 3; s++) P.por("brilho", new THREE.BoxGeometry(0.05, 0.36, 0.03), "#ff7a1a", { ...ponto(R + 0.03, ang + (s % 2 ? 0.03 : -0.03), y + s * 0.3), ry: ang, rz: s % 2 ? 0.5 : -0.5 });
      }
      P.por("brilho", new THREE.CylinderGeometry(0.35, 0.35, 0.03, 12), "#ff5a1a", V(d.clone().multiplyScalar(R + 0.5).addScaledVector(t, 0.5), yChao + 0.01));
      break;
    case "cipos":
      for (let k = 0; k < 7; k++) {
        const ang = livre(), len = 0.8 + r() * 0.9;
        P.por("pedra", new THREE.BoxGeometry(0.05, len, 0.04), "#2f6b2a", { ...ponto(R + 0.05, ang, y0 + H - len / 2), ry: ang });
        for (let s = 0; s < 3; s++) P.por("pedra", new THREE.IcosahedronGeometry(0.11, 0), "#4caf50", { ...ponto(R + 0.08, ang + 0.03 * (s - 1), y0 + H - (s + 0.5) * (len / 3)) });
      }
      break;
    case "madeira":
      for (let k = 0; k < 5; k++) {
        const ang = livre();
        P.por("pedra", new THREE.BoxGeometry(0.95, 0.13, 0.05), "#7a4b26", { ...ponto(R + 0.06, ang, yChao + 0.4 + r() * 1.3), ry: ang, rz: (r() - 0.5) * 0.3 });
      }
      break;
    case "neon":
      for (const y of [yChao + 0.35, y0 + H - 0.35]) {
        P.por("brilho", new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.05, 44, 1, true, a + vaoExt / 2 + 0.05, Math.PI * 2 - vaoExt - 0.1), tema.faixa, { y });
      }
      break;
    case "braseiros":
      for (const lado of [-1, 1]) {
        const c = d.clone().multiplyScalar(R + 0.5).addScaledVector(t, lado * 0.72);
        P.por("pedra", new THREE.CylinderGeometry(0.04, 0.05, 0.3, 6), "#2b2420", V(c, yChao + 0.15));
        P.por("pedra", new THREE.CylinderGeometry(0.18, 0.1, 0.16, 8), "#3a2a22", V(c, yChao + 0.36));
        P.por("brilho", new THREE.ConeGeometry(0.13, 0.32, 7), "#ff6a2a", V(c, yChao + 0.58));
      }
      break;
    case "conchas":
      for (let k = 0; k < 10; k++) {
        const ang = livre();
        P.por("pedra", new THREE.SphereGeometry(0.07 + r() * 0.06, 7, 5), r() < 0.5 ? "#e8f1f2" : "#7fc7c9", { ...ponto(R + 0.03, ang, yChao + 0.2 + r() * 1.6) });
      }
      for (let k = 0; k < 4; k++) {
        const ang = livre(), len = 0.4 + r() * 0.4;
        P.por("pedra", new THREE.BoxGeometry(0.05, len, 0.04), "#2e8b7a", { ...ponto(R + 0.05, ang, yChao + len / 2), ry: ang, rz: (r() - 0.5) * 0.4 });
      }
      break;
    default:
      for (let k = 0; k < 5; k++) {
        const ang = livre(), tam = 0.18 + r() * 0.18;
        P.por("pedra", new THREE.DodecahedronGeometry(tam, 0), variar("#8d8f99", r, 0.1), { ...ponto(R + tam * 0.6, ang, yChao + tam * 0.6), ry: r() * 6 });
      }
  }
}

/** O topo (telhado da torre ou pico da montanha), a sacada do topo, a ilha e as árvores. */
function construirTopoEBase(P, { n, forma, concluida }) {
  const r = sorteio(n * 31 + 7);
  const torre = forma === "torre";
  const yt = n * H;
  const Rt = raioDe(forma, n, n);
  const aTopo = anguloDaPorta(n + 1);
  P.por("pedra", new THREE.CylinderGeometry(Rt + 0.34, Rt + 0.26, LAJE, 36), torre ? "#9d9585" : "#6f6861", { y: yt + LAJE / 2 });
  const yc = yt + LAJE;
  if (torre) {
    P.por("pedra", new THREE.CylinderGeometry(Rt, Rt, 0.32, 44, 1, true), "#b8b0a0", { y: yc + 0.16 });
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      if (distAng(ang, aTopo) < 0.35) continue;
      P.por("pedra", new THREE.BoxGeometry(0.52, 0.5, 0.38), "#c9c1b2", { ...ponto(Rt - 0.02, ang, yc + 0.57), ry: ang });
    }
    P.por("pedra", new THREE.ConeGeometry(Rt - 0.3, 3.6, 18), "#b4473c", { y: yc + 1.8 });
    for (const h of [0.6, 1.3, 2.0, 2.7]) P.por("pedra", new THREE.TorusGeometry((Rt - 0.3) * (1 - h / 3.6) + 0.02, 0.06, 5, 36), "#8e3029", { y: yc + h, rx: Math.PI / 2 });
    P.por("pedra", new THREE.CylinderGeometry(0.04, 0.09, 1.0, 8), "#d4a72c", { y: yc + 4.1 });
  } else {
    const pontos = [new THREE.Vector2(Rt + 0.1, 0)];
    for (let k = 1; k <= 6; k++) pontos.push(new THREE.Vector2(Math.max(0.05, (Rt + 0.1) * (1 - k / 6.4) + (r() - 0.5) * 0.4), k * 0.8));
    pontos.push(new THREE.Vector2(0.01, 5.2));
    P.por("pedra", new THREE.LatheGeometry(pontos, 12), "#7a736b", { y: yc, ry: r() * 6 });
    const neve = pontos.filter((p) => p.y >= 2.2).map((p) => new THREE.Vector2(p.x + 0.06, p.y - 2.2 + 0.0));
    P.por("pedra", new THREE.LatheGeometry([new THREE.Vector2(pontos.find((p) => p.y >= 2.2).x + 0.25, -0.15), ...neve], 12), "#f4f8fb", { y: yc + 2.2 });
  }
  // a sacada do topo (onde o Neuro comemora)
  const dt = direcao(aTopo);
  P.por("pedra", new THREE.CylinderGeometry(1.15, 1.05, 0.22, 16, 1, false, -Math.PI / 2, Math.PI), torre ? "#d6cfc0" : "#8a5a35", V(dt.clone().multiplyScalar(Rt), yc - 0.11, { ry: aTopo }));
  if (concluida) {
    const c = dt.clone().multiplyScalar(Rt + 0.8).addScaledVector(tangente(aTopo), 0.5);
    P.por("pedra", new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), "#d4a72c", V(c, yc + 0.8));
    P.por("tecido", new THREE.BoxGeometry(0.7, 0.44, 0.02), "#f5c542", V(c.clone().addScaledVector(tangente(aTopo), 0.36), yc + 1.38, { ry: aTopo }));
  }

  // a ilha: grama, terra por baixo, pedras, pinheiros e o caminho até a primeira porta
  const R1 = raioDe(forma, 1, n);
  const Rb = R1 + 5.6;
  P.por("pedra", new THREE.CylinderGeometry(Rb, Rb - 0.4, 0.6, 22), "#79b95f", { y: -0.3 });
  P.por("pedra", new THREE.ConeGeometry(Rb - 0.4, 4.4, 22), "#8a6142", { y: -0.6 - 2.2, rx: Math.PI });
  const a1 = anguloDaPorta(1);
  for (let k = 0; k < 12; k++) {
    const ang = a1 + 0.6 + r() * (Math.PI * 2 - 1.2), raio = R1 + 1.8 + r() * (Rb - R1 - 2.4);
    if (k % 2) {
      P.por("pedra", new THREE.CylinderGeometry(0.1, 0.13, 0.5, 6), "#6e4a2a", ponto(raio, ang, 0.25));
      P.por("pedra", new THREE.ConeGeometry(0.62, 1.1, 7), variar("#3f8f3a", r, 0.1), ponto(raio, ang, 0.95));
      P.por("pedra", new THREE.ConeGeometry(0.45, 0.85, 7), variar("#4caf50", r, 0.1), ponto(raio, ang, 1.45));
    } else {
      const tam = 0.3 + r() * 0.45;
      P.por("pedra", new THREE.DodecahedronGeometry(tam, 0), variar("#8d8f99", r, 0.12), { ...ponto(raio, ang, tam * 0.4), ry: r() * 6, sy: 0.7 });
    }
  }
  for (let k = 0; k < 6; k++) {
    P.por("pedra", new THREE.CylinderGeometry(0.34, 0.34, 0.06, 7), "#c9c2b3", ponto(R1 + 1.4 + k * ((Rb - R1 - 2.0) / 6), a1 + (k % 2 ? 0.05 : -0.05), 0.03));
  }
}

// ------------------------------------------------------------------ o componente

export default function TorreDoDominio({ andares = [], atual = 1, concluida = false, semente = 1, golpe = null, lutando = false, humor = "normal", aoEscolher, aoFalhar, children }) {
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
    renderizador.shadowMap.enabled = true;
    renderizador.shadowMap.type = THREE.PCFShadowMap;
    renderizador.domElement.setAttribute("aria-hidden", "true");
    renderizador.domElement.className = "dm-torre__tela";
    el.prepend(renderizador.domElement);

    const escuro = document.documentElement.dataset.tema === "escuro";
    const cena = new THREE.Scene();
    // a névoa do longe tem a cor do céu de fundo (src/app/dominio.css), no tema claro e no escuro
    cena.fog = new THREE.Fog(escuro ? "#22324d" : "#e2f0fc", 30, 75);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
    cena.add(new THREE.HemisphereLight("#ffffff", "#6f8f5a", escuro ? 0.85 : 1.0));
    const sol = new THREE.DirectionalLight("#fff3dd", escuro ? 1.25 : 1.55);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60 });
    sol.shadow.bias = -0.0006;
    sol.shadow.normalBias = 0.03;
    cena.add(sol, sol.target);
    // a luz da sala do andar de agora (a tocha que tremula)
    const luzDaSala = new THREE.PointLight("#ffd9a0", 9, 7.5, 1.4);
    cena.add(luzDaSala);

    const materiais = {
      pedra: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 }),
      dentro: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.BackSide }),
      brilho: new THREE.MeshBasicMaterial({ vertexColors: true }),
      tecido: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide }),
    };
    const geoPapel = new THREE.PlaneGeometry(1, 1);
    const descartaveis = new Set([geoPapel, ...Object.values(materiais)]);
    const guardar = (o) => { descartaveis.add(o); return o; };

    // os recortes de papel dos chefões: um material por monstro; cada andar usa uma cópia (o de agora pisca, os de cima ficam em silhueta)
    const texturasDosChefoes = new Map();
    function materialDoChefao(tipo) {
      let item = texturasDosChefoes.get(tipo);
      if (!item) {
        const tex = guardar(new THREE.CanvasTexture(document.createElement("canvas")));
        tex.colorSpace = THREE.SRGBColorSpace;
        item = { tex, pronta: false, materiais: [] };
        const img = new Image();
        img.onload = () => {
          tex.image = recorteDePapel(img);
          tex.needsUpdate = true;
          item.pronta = true;
          for (const m of item.materiais) m.visible = true;
        };
        img.src = urlDoMonstro(tipo);
        texturasDosChefoes.set(tipo, item);
      }
      const mat = guardar(new THREE.MeshBasicMaterial({ map: item.tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
      mat.visible = item.pronta;
      item.materiais.push(mat);
      return mat;
    }

    // o Neuro de papel (a textura vem do molde, em definirNeuro)
    const texNeuro = guardar(new THREE.CanvasTexture(document.createElement("canvas")));
    texNeuro.colorSpace = THREE.SRGBColorSpace;
    const matNeuro = guardar(new THREE.MeshBasicMaterial({ map: texNeuro, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }));
    matNeuro.visible = false;
    const neuro = new THREE.Mesh(geoPapel, matNeuro);
    neuro.scale.set(NEURO, NEURO, 1);
    cena.add(neuro);

    // o farol do topo: acende dourado quando a torre é conquistada
    const matFarol = guardar(new THREE.MeshStandardMaterial({ color: "#9ca3af", flatShading: true }));
    const farol = new THREE.Mesh(guardar(new THREE.OctahedronGeometry(0.42, 0)), matFarol);
    cena.add(farol);

    // ---- estado
    const estado = {
      n: 0, forma: "torre", atual: 1, concluida: false, andares: [], modo: "fora",
      desvioAngulo: 0, desvioY: 0, tremor: 0,
      neuroBase: new THREE.Vector3(), chefaoBase: new THREE.Vector3(), chefaoAtual: null, matChefaoAtual: null,
      camAng: 0, camDist: 14, camY: 6, camOlhar: new THREE.Vector3(0, 2, 0), fov: 38, iniciou: false,
    };
    let fixos = [];           // as malhas fundidas
    let moveis = new THREE.Group(); // chefões e plaquinhas
    cena.add(moveis);
    const papeis = [neuro];
    const animacoes = [];
    const animar = (duracao, passo, atraso = 0) => {
      if (semMovimento) { passo(1); return; }
      animacoes.push({ inicio: performance.now() + atraso, duracao, passo });
    };

    // as posições de cada andar (sacada, dentro da sala, o chefão, a escada)
    const R = (i) => raioDe(estado.forma, i, estado.n);
    function lugares(i) {
      const a = anguloDaPorta(i), d = direcao(a), t = tangente(a), yChao = base(i) + LAJE;
      return {
        a, d, t, yChao,
        sacada: d.clone().multiplyScalar(R(i) + 0.55).setY(yChao + NEURO / 2),
        dentro: d.clone().multiplyScalar(0.95).addScaledVector(t, 0.55).setY(yChao + NEURO / 2),
        chefao: d.clone().multiplyScalar(-0.55).addScaledVector(t, -0.12),
      };
    }
    function degraus(i) {
      const a = anguloDaPorta(i), de = a + 0.36, ate = a + PASSO - 0.36, yChao = base(i) + LAJE;
      return Array.from({ length: DEGRAUS }, (_, k) => {
        const f = (k + 0.5) / DEGRAUS, ang = de + f * (ate - de);
        return new THREE.Vector3(Math.sin(ang) * (raioDe(estado.forma, i + f, estado.n) + 0.72), yChao + ((k + 1) / (DEGRAUS + 1)) * H + NEURO / 2, Math.cos(ang) * (raioDe(estado.forma, i + f, estado.n) + 0.72));
      });
    }
    const andarDoFoco = () => (estado.concluida ? estado.n + 1 : estado.atual);

    // ---- as peças fixas
    function montarFixos() {
      for (const m of fixos) { cena.remove(m); m.geometry.dispose(); }
      fixos = [];
      if (!estado.n) return;
      const P = criarPedreiro();
      for (let i = 1; i <= estado.n; i++) {
        const dados = estado.andares[i - 1] || {};
        P.grupo = String(Math.floor((i - 1) / ANDARES_POR_BLOCO));
        construirAndar(P, {
          i, n: estado.n, forma: estado.forma, chefao: dados.chefao, vencido: dados.vencido, atual: estado.atual,
          concluida: estado.concluida, detalhe: Math.abs(i - andarDoFoco()) <= PERTO,
        });
      }
      P.grupo = "topo";
      construirTopoEBase(P, { n: estado.n, forma: estado.forma, concluida: estado.concluida });
      const blocoDoFoco = Math.floor((Math.min(andarDoFoco(), estado.n) - 1) / ANDARES_POR_BLOCO);
      for (const { lote, grupo, geo } of P.fundir()) {
        const m = new THREE.Mesh(geo, materiais[lote]);
        const perto = grupo === "topo" || Math.abs(Number(grupo) - blocoDoFoco) <= 1;
        m.castShadow = perto && (lote === "pedra" || lote === "tecido");
        m.receiveShadow = lote !== "brilho";
        m.userData.fixo = true;
        cena.add(m);
        fixos.push(m);
      }
      const yt = estado.n * H + LAJE;
      farol.position.set(0, yt + (estado.forma === "torre" ? 4.9 : 5.9), 0);
      matFarol.color.set(estado.concluida ? "#f5c542" : "#9ca3af");
      matFarol.emissive.set(estado.concluida ? "#f59e0b" : "#000000");
      matFarol.emissiveIntensity = estado.concluida ? 0.9 : 0;
    }

    // ---- os chefões (o de agora aceso, os de cima em silhueta) e as plaquinhas
    function montarMoveis() {
      cena.remove(moveis);
      moveis.traverse((m) => { if (m.isSprite) { m.material.map?.dispose(); m.material.dispose(); } });
      moveis = new THREE.Group();
      cena.add(moveis);
      papeis.length = 0;
      papeis.push(neuro);
      estado.chefaoAtual = null;
      estado.matChefaoAtual = null;
      const foco = andarDoFoco();
      for (let i = 1; i <= estado.n; i++) {
        const dados = estado.andares[i - 1] || {};
        const L = lugares(i);
        const ehAtual = i === estado.atual && !estado.concluida;
        if (Math.abs(i - foco) <= 14) {
          const placa = plaquinha(String(i), ehAtual);
          placa.position.copy(L.d.clone().multiplyScalar(R(i) + 1.3).addScaledVector(L.t, -0.75)).setY(L.yChao + 0.2);
          moveis.add(placa);
        }
        const mostrar = !dados.vencido && dados.chefao && (ehAtual || (i > estado.atual && i <= estado.atual + 12) || i === estado.n);
        if (!mostrar) continue;
        const tamanho = Math.min(i === estado.n ? 2.0 : 1.85, (TAMANHO_DOS_MONSTROS[dados.chefao] || 1.6) * (i === estado.n ? 0.95 : 0.78));
        const mat = materialDoChefao(dados.chefao);
        if (!ehAtual) mat.color.set("#34343f");
        const s = new THREE.Mesh(geoPapel, mat);
        s.scale.set(tamanho, tamanho, 1);
        s.position.copy(L.chefao).setY(L.yChao + tamanho / 2 - tamanho * 0.05);
        s.userData.numero = i;
        moveis.add(s);
        papeis.push(s);
        if (ehAtual) { estado.chefaoAtual = s; estado.matChefaoAtual = mat; estado.chefaoBase.copy(s.position); }
      }
      // a luz da sala de agora, na cor do tema
      const L = lugares(Math.min(estado.n, estado.atual));
      const tema = TEMAS[estado.andares[Math.min(estado.n, estado.atual) - 1]?.chefao] || TEMAS.golem;
      luzDaSala.color.set(tema.luz);
      luzDaSala.position.copy(L.d.clone().multiplyScalar(0.3)).setY(L.yChao + 1.6);
      luzDaSala.visible = !estado.concluida;
    }

    /** O Neuro na sacada do andar de agora (ou na sacada do topo, se a torre foi conquistada). */
    function posicionarNeuro() {
      const i = andarDoFoco();
      if (!estado.n) { neuro.visible = false; return; }
      neuro.visible = true;
      neuro.rotation.z = 0;
      const alvo = i > estado.n
        ? direcao(anguloDaPorta(i)).multiplyScalar(R(estado.n) + 0.55).setY(estado.n * H + LAJE + NEURO / 2)
        : (estado.modo === "dentro" ? lugares(i).dentro : lugares(i).sacada);
      estado.neuroBase.copy(alvo);
      neuro.position.copy(alvo);
    }

    /**
     * A câmera, em volta da torre (ângulo, distância e altura — por isso ela contorna a torre ao
     * subir, em vez de atravessar a parede): por fora, na altura da porta do andar, para ver o chefão
     * lá dentro; na luta, dentro da sala, vendo o Neuro e o chefão de lado. Entre os dois, ela passa
     * pela porta.
     */
    function alvoDaCamera(saida) {
      const i = andarDoFoco();
      const rI = R(Math.min(i, estado.n || 1));
      const a = anguloDaPorta(i);
      const yChao = i > estado.n ? estado.n * H + LAJE : base(i) + LAJE;
      if (estado.modo === "dentro" && i <= estado.n) {
        const L = lugares(i);
        saida.ang = a - 0.16;
        saida.dist = R_DENTRO - 0.3;
        saida.y = yChao + 1.3;
        saida.olhar.copy(L.dentro).add(L.chefao).multiplyScalar(0.5).setY(yChao + 0.8);
        saida.fov = 62;
        return;
      }
      const recuo = camera.aspect < 0.8 ? 1.5 : camera.aspect < 1.3 ? 1.18 : 1;
      saida.ang = a + 0.24 + estado.desvioAngulo;
      saida.dist = (rI + 9.5) * recuo;
      saida.y = yChao + 1.9 + estado.desvioY;
      saida.olhar.set(Math.sin(saida.ang) * rI * 0.25, yChao + 1.0 + estado.desvioY, Math.cos(saida.ang) * rI * 0.25);
      saida.fov = 40;
    }

    // ---- a luta: entrar na sala, os golpes, o fim
    function definirLuta(sim) {
      if (!estado.n || estado.concluida) return;
      const L = lugares(estado.atual);
      estado.modo = sim ? "dentro" : "fora";
      const de = neuro.position.clone();
      const para = sim ? L.dentro : L.sacada;
      estado.neuroBase.copy(para);
      animar(850, (k) => { neuro.position.lerpVectors(de, para, k); neuro.position.y = para.y + Math.abs(Math.sin(k * Math.PI * 4)) * 0.08; });
    }

    function golpear(g) {
      const chefao = estado.chefaoAtual;
      if (!chefao || !g) return;
      if (g.fim) {
        if (g.venceu) {
          const base0 = chefao.scale.x;
          animar(900, (k) => {
            chefao.rotation.z = k * 1.5;
            const s = base0 * (1 - k * 0.92);
            chefao.scale.set(s, s, 1);
            chefao.position.y = estado.chefaoBase.y - k * 0.5;
          });
          faiscas(estado.chefaoBase, "#f5c542");
        } else {
          animar(800, (k) => { neuro.rotation.z = Math.sin(k * Math.PI) * 0.55; neuro.position.y = estado.neuroBase.y - Math.sin(k * Math.PI) * 0.15; });
        }
        return;
      }
      const ehNeuro = g.quem === "neuro";
      const atacante = ehNeuro ? neuro : chefao;
      const de = ehNeuro ? estado.neuroBase.clone() : estado.chefaoBase.clone();
      const para = ehNeuro ? estado.chefaoBase.clone() : estado.neuroBase.clone();
      animar(460, (k) => { atacante.position.lerpVectors(de, para, Math.sin(k * Math.PI) * 0.55); });
      const matAlvo = ehNeuro ? estado.matChefaoAtual : matNeuro;
      const alvo = ehNeuro ? chefao : neuro;
      const baseAlvo = ehNeuro ? estado.chefaoBase.clone() : estado.neuroBase.clone();
      const cor = g.especial ? new THREE.Color("#fde047") : new THREE.Color("#ff6b6b");
      animar(380, (k) => {
        if (matAlvo) matAlvo.color.copy(cor).lerp(new THREE.Color("#ffffff"), k);
        alvo.position.x = baseAlvo.x + Math.sin(k * Math.PI * 6) * 0.06 * (1 - k);
      }, 200);
      setTimeout(() => { estado.tremor = ehNeuro ? 0.05 : 0.11; }, semMovimento ? 0 : 230);
      if (g.especial) faiscas(baseAlvo, "#fde047");
    }

    /** Estrelinhas do golpe especial (e da queda do chefão). */
    function faiscas(onde, cor) {
      const mat = guardar(new THREE.MeshBasicMaterial({ color: cor }));
      const geo = guardar(new THREE.OctahedronGeometry(0.07, 0));
      const pedacos = Array.from({ length: 12 }, (_, k) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(onde);
        m.userData.dir = new THREE.Vector3(Math.cos(k * 0.52), 0.5 + (k % 3) * 0.3, Math.sin(k * 0.52));
        cena.add(m);
        return m;
      });
      animar(650, (k) => {
        for (const m of pedacos) { m.position.copy(onde).addScaledVector(m.userData.dir, k * 0.9); m.scale.setScalar(1 - k); }
        if (k >= 1) for (const m of pedacos) cena.remove(m);
      }, 220);
    }

    /** Venceu e subiu: o Neuro sai da sala, sobe a escada por fora e para na sacada de cima. */
    function subir(de, ate) {
      const caminho = [neuro.position.clone()];
      if (de <= estado.n) caminho.push(lugares(de).sacada.clone(), ...degraus(de));
      caminho.push(ate > estado.n
        ? direcao(anguloDaPorta(ate)).multiplyScalar(R(estado.n) + 0.55).setY(estado.n * H + LAJE + NEURO / 2)
        : lugares(ate).sacada.clone());
      const curva = new THREE.CatmullRomCurve3(caminho);
      const fim = caminho.at(-1);
      estado.neuroBase.copy(fim);
      animar(2600, (k) => {
        neuro.position.copy(curva.getPointAt(k));
        neuro.position.y += Math.abs(Math.sin(k * Math.PI * DEGRAUS)) * 0.06;
      });
    }

    function definirNeuro(canvas) {
      texNeuro.image = canvas;
      texNeuro.needsUpdate = true;
      matNeuro.visible = true;
    }

    // ---- arrastar, clicar
    const raio = new THREE.Raycaster();
    let arrasto = null;
    const tela = renderizador.domElement;
    tela.addEventListener("pointerdown", (e) => {
      arrasto = { x: e.clientX, y: e.clientY, moveu: false, angulo: estado.desvioAngulo, vista: estado.desvioY };
      tela.setPointerCapture?.(e.pointerId);
    });
    tela.addEventListener("pointermove", (e) => {
      if (!arrasto || estado.modo === "dentro") return;
      const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) arrasto.moveu = true;
      estado.desvioAngulo = arrasto.angulo - dx * 0.008;
      mover(0, arrasto.vista + dy * 0.035);
    });
    tela.addEventListener("pointerup", (e) => {
      if (arrasto && !arrasto.moveu) {
        const r = tela.getBoundingClientRect();
        raio.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
        const acerto = raio.intersectObjects([...fixos, ...moveis.children], false)[0];
        if (acerto) {
          const numero = acerto.object.userData.numero || Math.floor(acerto.point.y / H) + 1;
          if (numero >= 1 && numero <= estado.n) aoEscolherRef.current?.(numero);
        }
      }
      arrasto = null;
    });
    tela.addEventListener("pointercancel", () => { arrasto = null; });
    function mover(_dy, absoluto) {
      const i = andarDoFoco();
      const yFoco = Math.min(i, estado.n + 1) * H - H;
      const topo = estado.n * H + 2;
      estado.desvioY = Math.max(-yFoco, Math.min(topo - yFoco, absoluto));
    }

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
    const alvo = { ang: 0, dist: 14, y: 4, olhar: new THREE.Vector3(), fov: 40 };
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
      alvoDaCamera(alvo);
      const suave = semMovimento || !estado.iniciou ? 1 : 0.07;
      estado.iniciou = true;
      estado.camAng += Math.atan2(Math.sin(alvo.ang - estado.camAng), Math.cos(alvo.ang - estado.camAng)) * suave;
      estado.camDist += (alvo.dist - estado.camDist) * suave;
      estado.camY += (alvo.y - estado.camY) * suave;
      estado.camOlhar.lerp(alvo.olhar, suave);
      estado.fov += (alvo.fov - estado.fov) * suave;
      camera.position.set(Math.sin(estado.camAng) * estado.camDist, estado.camY, Math.cos(estado.camAng) * estado.camDist);
      if (estado.tremor > 0.001) {
        camera.position.x += (Math.random() - 0.5) * estado.tremor;
        camera.position.y += (Math.random() - 0.5) * estado.tremor;
        estado.tremor *= 0.85;
      }
      if (Math.abs(camera.fov - estado.fov) > 0.01) { camera.fov = estado.fov; camera.updateProjectionMatrix(); }
      camera.lookAt(estado.camOlhar);
      // a sombra do sol segue a vista
      sol.target.position.copy(estado.camOlhar);
      sol.position.copy(estado.camOlhar).add(new THREE.Vector3(9, 16, 7));
      const s = (agora - relogio) / 1000;
      for (const p of papeis) p.rotation.y = Math.atan2(camera.position.x - p.position.x, camera.position.z - p.position.z);
      if (!semMovimento) {
        luzDaSala.intensity = 9 + Math.sin(s * 11) * 0.8 + Math.sin(s * 23) * 0.5;
        if (!animacoes.length) {
          if (neuro.visible) neuro.position.y = estado.neuroBase.y + Math.sin(s * 2.4) * 0.035;
          if (estado.chefaoAtual) estado.chefaoAtual.position.y = estado.chefaoBase.y + Math.sin(s * 1.9 + 1) * 0.045;
        }
        farol.rotation.y = s * 0.8;
      }
      renderizador.render(cena, camera);
    }
    quadro = requestAnimationFrame(laco);

    api.current = {
      montar({ andares: lista, atual: agora, concluida: fim, forma }) {
        estado.andares = lista;
        estado.n = lista.length;
        estado.atual = Math.max(1, Math.min(lista.length || 1, agora));
        estado.concluida = fim;
        estado.forma = forma;
        montarFixos();
        montarMoveis();
        if (!animacoes.length) posicionarNeuro();
      },
      definirAtual(i) {
        const antes = estado.atual;
        estado.atual = Math.max(1, Math.min(estado.n || 1, i));
        if (estado.atual === antes) return;
        estado.modo = "fora";
        estado.desvioAngulo = 0;
        estado.desvioY = 0;
        montarFixos();
        montarMoveis();
        if (estado.atual === antes + 1 && !semMovimento) subir(antes, estado.concluida ? estado.n + 1 : estado.atual);
        else posicionarNeuro();
      },
      definirLuta,
      definirNeuro,
      golpear,
      centralizar() { estado.desvioAngulo = 0; estado.desvioY = 0; },
      mover(dy) { mover(0, estado.desvioY + dy); },
    };

    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      vigia.disconnect();
      api.current = null;
      for (const m of fixos) m.geometry.dispose();
      moveis.traverse((m) => { if (m.isSprite) { m.material.map?.dispose(); m.material.dispose(); } });
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

  // ---- subiu de andar: o Neuro sobe a escada
  useEffect(() => {
    if (atualRef.current !== atual) {
      atualRef.current = atual;
      api.current?.definirAtual(atual);
    }
  }, [atual]);

  // ---- a luta: o Neuro entra na sala (e a câmera junto); os golpes vêm um por vez
  useEffect(() => { api.current?.definirLuta(Boolean(lutando)); }, [lutando]);
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
        <button type="button" className="dm-torre__botao" aria-label="Ver mais acima" onClick={() => api.current?.mover(3)}>▲</button>
        <button type="button" className="dm-torre__botao" aria-label="Voltar ao andar de agora" onClick={() => api.current?.centralizar()}>📍</button>
        <button type="button" className="dm-torre__botao" aria-label="Ver mais abaixo" onClick={() => api.current?.mover(-3)}>▼</button>
      </div>
      {children}
      {/* o molde do Neuro de papel: fora da tela, sem foco, só para copiar o desenho */}
      <div className="dm-torre__molde" ref={molde} inert aria-hidden="true">
        <Neuro humor={humor} tamanho={200} />
      </div>
    </div>
  );
}
