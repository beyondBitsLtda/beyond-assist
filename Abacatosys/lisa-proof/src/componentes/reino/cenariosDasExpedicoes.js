// O terreno e as estruturas de CADA expedição no mundo 3D (pedido de 22/10/2026: "cada expedição
// vai ter seu próprio terreno 3D e estruturas personalizadas na hora de mostrar o ataque").
//
// O motor de combate continua o mesmo: as construções têm as mesmas chaves e os mesmos lugares
// do reino (src/dominio/combate.js, LUGARES). Aqui só muda o desenho: na ilha de uma expedição, a
// Torre de Arqueiros vira torre de vigia, o Canhão vira catapulta, a Mina vira o tesouro, o Cofre a
// carroça do saque, a Muralha uma paliçada... cada lugar com a sua paleta, o seu chão, o seu céu,
// a sua luz, os seus enfeites e o covil do chefe no lugar da Torre do Neuro.
//
// `p` são as peças do Mundo3D (malha, caixa, cilindro, cone, brilho, bandeira).

import * as THREE from "three";
import { LUGARES, PRACA, RAIO_DA_MURALHA, raioDaIlha } from "@/dominio/combate.js";

const OURO = "#f0be45", OSSO = "#f1efe6", ESCURO = "#1f140c";

function aleatorio(semente) {
  let a = semente;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Os cenários, um por expedição. `chao`: a cor do chão; `paleta`: as cores das estruturas;
 * `cabana`: "tenda" ou "casa"; `estaca`: o material da paliçada; `luz`: céu e sol durante a luta.
 * O céu de fundo fica no CSS (.rn-mundo[data-cenario=...]).
 */
export const CENARIOS = {
  "bosque-cogumelos": {
    chao: "#93d67c", paleta: { madeira: "#a0703f", escura: "#6e4a2a", telhado: "#e53935", pedra: "#cfc7b8", tecido: "#f9a8d4", brilho: "#d9f99d" },
    cabana: "casa", estaca: "madeira", luz: { ceu: "#fff7fb", chao: "#8fd07a", sol: "#fff3dd", forca: 1.6 },
  },
  "vila-goblins": {
    chao: "#a3c76d", paleta: { madeira: "#8a5a2b", escura: "#5d3a1a", telhado: "#6b8e23", pedra: "#9a9486", tecido: "#b45309", brilho: "#fde047" },
    cabana: "casa", estaca: "madeira", luz: { ceu: "#ffffff", chao: "#9cc46a", sol: "#fff0d0", forca: 1.6 },
  },
  "floresta-lobos": {
    chao: "#eef3f7", paleta: { madeira: "#6e4a2a", escura: "#4a3020", telhado: "#f8fafc", pedra: "#94a3b8", tecido: "#475569", brilho: "#bae6fd" },
    cabana: "casa", estaca: "madeira", neve: true, luz: { ceu: "#e0f2fe", chao: "#cbd5e1", sol: "#eaf4ff", forca: 1.5 },
  },
  "acampamento-orc": {
    chao: "#8d6e4f", paleta: { madeira: "#5d4037", escura: "#3e2723", telhado: "#7f1d1d", pedra: "#78716c", tecido: "#991b1b", brilho: "#ff8a1f" },
    cabana: "tenda", estaca: "madeira", luz: { ceu: "#fde3c3", chao: "#8d6e4f", sol: "#ffd9a8", forca: 1.6 },
  },
  "vila-bandidos": {
    chao: "#dcbb80", paleta: { madeira: "#9c6b3f", escura: "#6b4423", telhado: "#b45309", pedra: "#c2a878", tecido: "#1f2937", brilho: "#fbbf24" },
    cabana: "casa", estaca: "madeira", luz: { ceu: "#fff4dc", chao: "#d9b77c", sol: "#ffe7b3", forca: 1.8 },
  },
  "bosque-assombrado": {
    chao: "#4b4559", paleta: { madeira: "#3f3a4a", escura: "#26222e", telhado: "#5b21b6", pedra: "#6b6577", tecido: "#4c1d95", brilho: "#a3e635" },
    cabana: "casa", estaca: "osso", luz: { ceu: "#8b7bb8", chao: "#2a2436", sol: "#c4b5fd", forca: 0.9 },
  },
  "floresta-sombria": {
    chao: "#2f4a35", paleta: { madeira: "#3b2a1e", escura: "#24180f", telhado: "#14532d", pedra: "#4b5548", tecido: "#1e293b", brilho: "#c084fc" },
    cabana: "tenda", estaca: "madeira", luz: { ceu: "#6b8f7a", chao: "#13251a", sol: "#bfd8c8", forca: 0.9 },
  },
  "covil-cerbero": {
    chao: "#3b2b2b", paleta: { madeira: "#2a1c1c", escura: "#140d0d", telhado: "#7f1d1d", pedra: "#3f3a3a", tecido: "#450a0a", brilho: "#f97316" },
    cabana: "tenda", estaca: "pedra", lava: true, luz: { ceu: "#ff9a6b", chao: "#2a0f0a", sol: "#ffb27a", forca: 1.2 },
  },
  // ---- o fundo do mar (Submarino, 23/10/2026): areia, corais, bolhas e luz azulada
  "recife-tritoes": {
    chao: "#f1dca4", paleta: { madeira: "#f472b6", escura: "#9d174d", telhado: "#22d3ee", pedra: "#fde68a", tecido: "#0ea5e9", brilho: "#a5f3fc" },
    cabana: "casa", estaca: "pedra", mar: true, luz: { ceu: "#9be7ff", chao: "#0e7490", sol: "#e0f7ff", forca: 1.3 },
  },
  "cidade-afundada": {
    chao: "#c9b88f", paleta: { madeira: "#64748b", escura: "#334155", telhado: "#0f766e", pedra: "#a7b3c2", tecido: "#155e75", brilho: "#67e8f9" },
    cabana: "casa", estaca: "pedra", mar: true, luz: { ceu: "#5cc4f2", chao: "#0c4a6e", sol: "#c7ecff", forca: 1.15 },
  },
  "fossa-kraken": {
    chao: "#26334a", paleta: { madeira: "#334155", escura: "#0f172a", telhado: "#5b21b6", pedra: "#4b5a70", tecido: "#1e1b4b", brilho: "#22d3ee" },
    cabana: "tenda", estaca: "osso", mar: true, luz: { ceu: "#3b5bb5", chao: "#020617", sol: "#9fc3ff", forca: 0.95 },
  },
  // ---- as montanhas geladas (Dirigível)
  "trilha-yetis": {
    chao: "#f1f5f9", paleta: { madeira: "#78716c", escura: "#44403c", telhado: "#e2e8f0", pedra: "#94a3b8", tecido: "#0369a1", brilho: "#bae6fd" },
    cabana: "casa", estaca: "madeira", neve: true, luz: { ceu: "#e0f2fe", chao: "#cbd5e1", sol: "#f8fafc", forca: 1.6 },
  },
  "ninho-harpias": {
    chao: "#d6d3d1", paleta: { madeira: "#a16207", escura: "#57534e", telhado: "#f8fafc", pedra: "#a8a29e", tecido: "#7c2d12", brilho: "#fde047" },
    cabana: "tenda", estaca: "pedra", neve: true, luz: { ceu: "#c7ddff", chao: "#a8a29e", sol: "#fff7ed", forca: 1.6 },
  },
  "pico-gigante": {
    chao: "#e0f2fe", paleta: { madeira: "#64748b", escura: "#1e293b", telhado: "#bae6fd", pedra: "#7dd3fc", tecido: "#1e40af", brilho: "#e0f2fe" },
    cabana: "casa", estaca: "pedra", neve: true, luz: { ceu: "#9cc8ff", chao: "#bfdbfe", sol: "#eff6ff", forca: 1.45 },
  },
  // ---- os reinos de fogo e lava (Tanque de Magma)
  "forja-diabretes": {
    chao: "#4a332b", paleta: { madeira: "#57534e", escura: "#1c1917", telhado: "#b91c1c", pedra: "#78716c", tecido: "#7f1d1d", brilho: "#f97316" },
    cabana: "casa", estaca: "pedra", lava: true, luz: { ceu: "#fdba74", chao: "#431407", sol: "#fed7aa", forca: 1.3 },
  },
  "rio-de-magma": {
    chao: "#2e2724", paleta: { madeira: "#44403c", escura: "#0c0a09", telhado: "#9a3412", pedra: "#3f3f46", tecido: "#7c2d12", brilho: "#fb923c" },
    cabana: "tenda", estaca: "pedra", lava: true, luz: { ceu: "#fb923c", chao: "#1c0a05", sol: "#ffb27a", forca: 1.2 },
  },
  "trono-dragao": {
    chao: "#211b19", paleta: { madeira: "#292524", escura: "#0c0a09", telhado: "#7f1d1d", pedra: "#2f2b2e", tecido: "#450a0a", brilho: "#facc15" },
    cabana: "tenda", estaca: "osso", lava: true, luz: { ceu: "#ef6a4a", chao: "#1a0503", sol: "#fcb3a0", forca: 1.15 },
  },
  // ---- os planetoides (Nave Estelar): a paleta é sorteada junto com o planetoide (planetoides.js)
  "planetoide-0": {
    chao: "#6d5a8a", paleta: { madeira: "#64748b", escura: "#334155", telhado: "#a78bfa", pedra: "#8b7fa8", tecido: "#4c1d95", brilho: "#a3e635" },
    cabana: "tenda", estaca: "pedra", espaco: true, luz: { ceu: "#c4b5fd", chao: "#2e1065", sol: "#e9d5ff", forca: 1.05 },
  },
  "planetoide-1": {
    chao: "#4d7c4a", paleta: { madeira: "#475569", escura: "#1e293b", telhado: "#22c55e", pedra: "#6b8f71", tecido: "#14532d", brilho: "#f0abfc" },
    cabana: "tenda", estaca: "pedra", espaco: true, luz: { ceu: "#bbf7d0", chao: "#052e16", sol: "#dcfce7", forca: 1.1 },
  },
  "planetoide-2": {
    chao: "#b4532a", paleta: { madeira: "#57534e", escura: "#292524", telhado: "#f97316", pedra: "#c2410c", tecido: "#7c2d12", brilho: "#67e8f9" },
    cabana: "tenda", estaca: "pedra", espaco: true, luz: { ceu: "#fed7aa", chao: "#431407", sol: "#ffedd5", forca: 1.2 },
  },
  "planetoide-3": {
    chao: "#93a7c9", paleta: { madeira: "#475569", escura: "#1e293b", telhado: "#38bdf8", pedra: "#a5b4fc", tecido: "#312e81", brilho: "#fde047" },
    cabana: "tenda", estaca: "pedra", espaco: true, luz: { ceu: "#c7d2fe", chao: "#1e1b4b", sol: "#e0e7ff", forca: 1.1 },
  },
};
/** Replays antigos guardavam só o tipo do lugar: cada tipo tem um cenário padrão. */
const PADRAO_DO_TIPO = {
  bosque: "bosque-cogumelos", vila: "vila-goblins", floresta: "floresta-lobos", acampamento: "acampamento-orc",
  submerso: "recife-tritoes", montanha: "trilha-yetis", vulcao: "forja-diabretes", planetoide: "planetoide-0",
};
export function cenarioDe(defensor) {
  const id = CENARIOS[defensor?.cenario] ? defensor.cenario : PADRAO_DO_TIPO[defensor?.tema] || null;
  return id ? { id, ...CENARIOS[id] } : null;
}

// ------------------------------------------------------------------ as estruturas (as mesmas chaves do motor)

/** Torre de Arqueiros → torre de vigia de madeira, em pernas, com telhadinho. */
function torreDeVigia(p, n, c) {
  const g = new THREE.Group();
  const h = 1.2 + 0.12 * n;
  for (const [x, z] of [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]]) g.add(p.caixa(0.09, h, 0.09, c.escura, x, h / 2, z));
  const x1 = p.caixa(0.08, 0.06, 0.95, c.madeira, 0, h * 0.45, 0); x1.rotation.x = 0.6; g.add(x1);
  g.add(p.caixa(0.95, 0.08, 0.95, c.madeira, 0, h, 0));
  for (const [x, z, w, d] of [[0, -0.45, 0.95, 0.05], [0, 0.45, 0.95, 0.05], [-0.45, 0, 0.05, 0.95], [0.45, 0, 0.05, 0.95]]) g.add(p.caixa(w, 0.22, d, c.madeira, x, h + 0.15, z));
  for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) g.add(p.caixa(0.05, 0.5, 0.05, c.escura, x, h + 0.3, z));
  const teto = p.cone(0.78, 0.5, 4, c.telhado, 0, h + 0.8, 0);
  teto.rotation.y = Math.PI / 4;
  g.add(teto);
  if (n >= 3) p.bandeira(g, 0, h + 1.0, 0, c.tecido);
  if (n >= 4) g.add(p.malha(new THREE.OctahedronGeometry(0.09, 0), p.brilho(c.brilho), 0.3, h + 0.35, 0.3));
  return g;
}

/** Canhão → catapulta: base com rodas, braço e a pedra no balde. */
function catapulta(p, n, c) {
  const g = new THREE.Group();
  g.add(p.caixa(0.95, 0.14, 0.62, c.madeira, 0, 0.26, 0));
  for (const [x, z] of [[-0.36, -0.34], [0.36, -0.34], [-0.36, 0.34], [0.36, 0.34]]) {
    const roda = p.cilindro(0.19, 0.19, 0.08, 10, c.escura, x, 0.19, z);
    roda.rotation.x = Math.PI / 2;
    g.add(roda);
  }
  for (const z of [-0.22, 0.22]) {
    const pe = p.caixa(0.08, 0.55, 0.08, c.escura, -0.1, 0.58, z);
    pe.rotation.z = 0.25;
    g.add(pe);
  }
  const braco = p.caixa(1.05, 0.08, 0.1, c.madeira, 0.05, 0.75, 0);
  braco.rotation.z = -0.5;
  g.add(braco);
  g.add(p.cilindro(0.13, 0.1, 0.1, 8, c.escura, 0.5, 1.02, 0));
  g.add(p.malha(new THREE.DodecahedronGeometry(0.12 + 0.01 * n, 0), c.pedra, 0.5, 1.12, 0));
  if (n >= 3) g.add(p.malha(new THREE.DodecahedronGeometry(0.1, 0), c.pedra, -0.45, 0.4, 0.2));
  return g;
}

/** Mina → o tesouro dos monstros: monte de ouro e o baú. */
function tesouro(p, n, c) {
  const g = new THREE.Group();
  g.add(p.cone(0.55 + 0.04 * n, 0.45, 8, OURO, 0, 0.22, 0));
  for (let i = 0; i < 5 + n; i++) {
    const a = (i / (5 + n)) * Math.PI * 2;
    g.add(p.cilindro(0.08, 0.08, 0.03, 8, OURO, Math.cos(a) * 0.62, 0.02, Math.sin(a) * 0.62));
  }
  g.add(p.caixa(0.55, 0.32, 0.36, c.madeira, 0.15, 0.48, 0.35));
  g.add(p.caixa(0.57, 0.06, 0.38, OURO, 0.15, 0.6, 0.35));
  const tampa = p.caixa(0.55, 0.12, 0.36, c.escura, 0.15, 0.72, 0.22);
  tampa.rotation.x = -0.6;
  g.add(tampa);
  if (n >= 2) g.add(p.malha(new THREE.OctahedronGeometry(0.1, 0), p.brilho(c.brilho), -0.2, 0.62, -0.1));
  return g;
}

/** Cofre → a carroça do saque: rodas, sacos e ouro. */
function carroca(p, n, c) {
  const g = new THREE.Group();
  g.add(p.caixa(0.9, 0.3, 0.6, c.madeira, 0, 0.42, 0));
  for (const x of [-0.3, 0.3]) for (const z of [-0.34, 0.34]) {
    const roda = p.cilindro(0.2, 0.2, 0.07, 10, c.escura, x, 0.22, z);
    roda.rotation.x = Math.PI / 2;
    g.add(roda);
  }
  for (const [x, z] of [[-0.2, -0.1], [0.15, 0.12], [0.05, -0.15]]) g.add(p.malha(new THREE.SphereGeometry(0.17, 8, 6), c.tecido, x, 0.68, z));
  g.add(p.cone(0.18, 0.16, 7, OURO, 0.28, 0.65, -0.1));
  const lanca = p.caixa(0.6, 0.05, 0.05, c.escura, -0.7, 0.32, 0);
  lanca.rotation.z = 0.2;
  g.add(lanca);
  return g;
}

/** Quartel → cabana (ou tenda, nos acampamentos). */
function cabana(p, n, c, estilo) {
  const g = new THREE.Group();
  if (estilo === "tenda") {
    g.add(p.cone(0.75 + 0.03 * n, 1.0, 6, c.tecido, 0, 0.5, 0));
    g.add(p.caixa(0.3, 0.42, 0.04, ESCURO, 0, 0.21, 0.58));
    g.add(p.cilindro(0.03, 0.03, 0.4, 5, c.escura, 0, 1.15, 0));
    if (n >= 2) p.bandeira(g, 0, 1.1, 0, c.telhado);
  } else {
    g.add(p.caixa(1.0, 0.6, 0.85, c.madeira, 0, 0.3, 0));
    const teto = p.cone(0.85, 0.55, 4, c.telhado, 0, 0.88, 0);
    teto.rotation.y = Math.PI / 4;
    g.add(teto);
    g.add(p.caixa(0.26, 0.4, 0.04, ESCURO, 0, 0.2, 0.44));
    g.add(p.caixa(0.2, 0.16, 0.04, p.janela, 0.3, 0.38, 0.44));
    if (n >= 3) g.add(p.caixa(0.14, 0.4, 0.14, c.pedra, 0.32, 1.05, -0.2));
  }
  return g;
}

/** Muralha → paliçada em volta do covil: estacas de madeira, de osso ou de pedra vulcânica. */
function palicada(p, n, c, material) {
  const g = new THREE.Group();
  const [cx, cz] = LUGARES.castelo;
  const quantas = 26;
  const cor = material === "osso" ? OSSO : material === "pedra" ? c.pedra : c.madeira;
  const altura = 0.45 + 0.08 * Math.max(1, n);
  for (let i = 0; i < quantas; i++) {
    const a = (i / quantas) * Math.PI * 2;
    const x = cx + Math.cos(a) * RAIO_DA_MURALHA, z = cz + Math.sin(a) * RAIO_DA_MURALHA;
    const h = altura * (i % 2 ? 0.85 : 1);
    if (material === "pedra") {
      const espinho = p.cone(0.11, h, 5, cor, x, h / 2, z);
      g.add(espinho);
    } else {
      g.add(p.cilindro(0.06, 0.07, h, 6, cor, x, h / 2, z));
      g.add(p.cone(0.065, 0.16, 6, cor, x, h + 0.08, z));
    }
  }
  return g;
}

/** Biblioteca → pedra rúnica, com a runa acesa. */
function pedraRunica(p, n, c) {
  const g = new THREE.Group();
  g.add(p.caixa(0.55, 1.05 + 0.05 * n, 0.28, c.pedra, 0, 0.55, 0));
  g.add(p.caixa(0.22, 0.32, 0.04, p.brilho(c.brilho), 0, 0.68, 0.15));
  g.add(p.malha(new THREE.DodecahedronGeometry(0.16, 0), c.pedra, 0.42, 0.1, 0.2));
  return g;
}

/** Defesa Aérea → balista num poste: atira para cima. */
function balista(p, n, c) {
  const g = new THREE.Group();
  g.add(p.cilindro(0.1, 0.16, 0.9, 6, c.escura, 0, 0.45, 0));
  const arco = p.caixa(1.0, 0.07, 0.08, c.madeira, 0, 1.0, 0);
  arco.rotation.x = -0.6;
  g.add(arco);
  const corpo = p.caixa(0.12, 0.1, 0.8, c.madeira, 0, 1.02, 0.05);
  corpo.rotation.x = -0.6;
  g.add(corpo);
  const flecha = p.cone(0.05, 0.35, 4, c.pedra, 0, 1.28, -0.22);
  flecha.rotation.x = -0.6 - Math.PI / 2;
  g.add(flecha);
  if (n >= 2) g.add(p.caixa(0.5, 0.1, 0.5, c.pedra, 0, 0.05, 0));
  return g;
}

/** Morteiro → caldeirão borbulhando em cima do fogo. */
function caldeirao(p, n, c) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const tora = p.caixa(0.6, 0.07, 0.07, c.escura, 0, 0.04, 0);
    tora.rotation.y = (i * Math.PI) / 3;
    g.add(tora);
  }
  g.add(p.cilindro(0.38, 0.28, 0.5, 10, "#2a2a2e", 0, 0.38, 0));
  g.add(p.cilindro(0.34, 0.34, 0.04, 10, p.brilho(c.brilho), 0, 0.62, 0));
  const bolha = p.malha(new THREE.SphereGeometry(0.07, 6, 4), p.brilho(c.brilho), 0.1, 0.7, 0.05);
  bolha.userData.gira = true;
  g.add(bolha);
  return g;
}

/** Torre Mágica → totem de caras empilhadas, com o cristal flutuando. */
function totem(p, n, c) {
  const g = new THREE.Group();
  const cores = [c.madeira, c.telhado, c.escura, c.madeira];
  const blocos = 3 + (n >= 3 ? 1 : 0);
  for (let i = 0; i < blocos; i++) {
    g.add(p.caixa(0.42, 0.36, 0.42, cores[i % cores.length], 0, 0.18 + i * 0.36, 0));
    g.add(p.caixa(0.08, 0.08, 0.03, ESCURO, -0.1, 0.24 + i * 0.36, 0.22));
    g.add(p.caixa(0.08, 0.08, 0.03, ESCURO, 0.1, 0.24 + i * 0.36, 0.22));
  }
  const asa = p.caixa(1.0, 0.06, 0.12, c.telhado, 0, blocos * 0.36 - 0.12, 0);
  g.add(asa);
  const cristal = p.malha(new THREE.OctahedronGeometry(0.16, 0), p.brilho(c.brilho), 0, blocos * 0.36 + 0.3, 0);
  cristal.userData.gira = true;
  g.add(cristal);
  return g;
}

/** Torre do Raio → obelisco com a ponta brilhando. */
function obelisco(p, n, c) {
  const g = new THREE.Group();
  g.add(p.caixa(0.6, 0.15, 0.6, c.pedra, 0, 0.075, 0));
  g.add(p.cilindro(0.12, 0.26, 1.8, 4, c.pedra, 0, 1.05, 0));
  const ponta = p.malha(new THREE.OctahedronGeometry(0.17, 0), p.brilho(c.brilho), 0, 2.15, 0);
  ponta.userData.gira = true;
  g.add(ponta);
  return g;
}

// ------------------------------------------------------------------ o covil de cada chefe

function covil(p, cen) {
  const c = cen.paleta;
  const g = new THREE.Group();
  switch (cen.id) {
    case "bosque-cogumelos": {
      g.add(p.cilindro(0.36, 0.46, 1.2, 8, "#f3e3c3", 0, 0.6, 0));
      const chapeu = p.malha(new THREE.SphereGeometry(1.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), "#e53935", 0, 1.05, 0);
      chapeu.scale.y = 0.75;
      g.add(chapeu);
      for (const [x, y, z] of [[0.45, 1.6, 0.55], [-0.55, 1.55, 0.35], [0.1, 1.8, -0.4], [-0.2, 1.75, 0.75], [0.75, 1.35, -0.3]]) g.add(p.malha(new THREE.SphereGeometry(0.13, 6, 4), "#ffffff", x, y, z));
      g.add(p.caixa(0.28, 0.42, 0.06, "#7c4a2d", 0, 0.22, 0.44));
      g.add(p.caixa(0.16, 0.14, 0.04, p.janela, 0.22, 0.72, 0.4));
      break;
    }
    case "vila-goblins": {
      // a casa torta do chefe goblin, com o telhado remendado e a placa de caveira
      const casa = p.caixa(1.4, 0.95, 1.2, c.madeira, 0, 0.48, 0);
      casa.rotation.z = 0.04;
      g.add(casa);
      const teto = p.cone(1.15, 0.85, 4, c.telhado, 0.05, 1.35, 0);
      teto.rotation.y = Math.PI / 4 + 0.08;
      g.add(teto);
      g.add(p.caixa(0.4, 0.3, 0.05, "#a16207", -0.3, 1.2, 0.58));
      g.add(p.caixa(0.36, 0.56, 0.06, ESCURO, 0.1, 0.28, 0.61));
      g.add(p.malha(new THREE.SphereGeometry(0.13, 8, 6), OSSO, 0.1, 0.78, 0.66));
      g.add(p.caixa(0.18, 0.6, 0.18, c.pedra, -0.45, 1.6, -0.2));
      break;
    }
    case "floresta-lobos": {
      // a toca da alcateia: um morro de pedra com a entrada escura e neve no topo
      const morro = p.malha(new THREE.DodecahedronGeometry(1.05, 1), c.pedra, 0, 0.55, 0);
      morro.scale.set(1.2, 0.75, 1.1);
      g.add(morro);
      const neve = p.malha(new THREE.SphereGeometry(0.72, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), "#f8fafc", 0, 0.95, -0.05);
      neve.scale.set(1.3, 0.55, 1.2);
      g.add(neve);
      const boca = p.malha(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI), ESCURO, 0, 0.05, 0.78);
      boca.rotation.x = -Math.PI / 2;
      g.add(boca);
      for (const [x, z] of [[0.55, 0.95], [-0.5, 1.0]]) {
        const osso = p.cilindro(0.03, 0.03, 0.32, 5, OSSO, x, 0.04, z);
        osso.rotation.z = Math.PI / 2;
        g.add(osso);
      }
      break;
    }
    case "acampamento-orc": {
      // a grande tenda do chefe orc, com chifres e estandarte
      g.add(p.cone(1.2, 1.8, 6, c.tecido, 0, 0.9, 0));
      g.add(p.caixa(0.42, 0.66, 0.05, ESCURO, 0, 0.33, 0.95));
      for (const lado of [-1, 1]) {
        const chifre = p.cone(0.1, 0.55, 5, OSSO, lado * 0.28, 1.85, 0);
        chifre.rotation.z = -lado * 0.6;
        g.add(chifre);
      }
      g.add(p.cilindro(0.05, 0.05, 2.0, 5, c.escura, 1.05, 1.0, 0.5));
      g.add(p.caixa(0.5, 0.36, 0.03, c.telhado, 1.3, 1.7, 0.5));
      g.add(p.malha(new THREE.SphereGeometry(0.15, 8, 6), OSSO, 1.05, 2.08, 0.5));
      break;
    }
    case "vila-bandidos": {
      // o esconderijo: um saloon de fachada alta, com placa e barris
      g.add(p.caixa(1.5, 0.95, 1.1, c.madeira, 0, 0.48, 0));
      g.add(p.caixa(1.6, 0.55, 0.08, c.escura, 0, 1.2, 0.56));
      g.add(p.caixa(0.9, 0.22, 0.04, "#f5deb3", 0, 1.2, 0.61));
      g.add(p.caixa(1.6, 0.06, 0.4, c.escura, 0, 0.75, 0.75));
      for (const x of [-0.7, 0.7]) g.add(p.caixa(0.06, 0.75, 0.06, c.escura, x, 0.37, 0.93));
      g.add(p.caixa(0.36, 0.5, 0.05, ESCURO, 0, 0.25, 0.57));
      for (const x of [-0.95, -1.2]) g.add(p.cilindro(0.16, 0.16, 0.36, 8, "#8a5a2b", x, 0.18, 0.4));
      break;
    }
    case "bosque-assombrado": {
      // a cripta: pedra escura, telhado pontudo e a porta brilhando verde
      g.add(p.caixa(1.3, 1.0, 1.1, c.pedra, 0, 0.5, 0));
      const teto = p.cone(1.05, 0.9, 4, c.escura, 0, 1.45, 0);
      teto.rotation.y = Math.PI / 4;
      g.add(teto);
      g.add(p.caixa(0.42, 0.62, 0.05, p.brilho(c.brilho), 0, 0.31, 0.56));
      g.add(p.malha(new THREE.SphereGeometry(0.16, 8, 6), OSSO, 0, 2.0, 0));
      for (const x of [-0.6, 0.6]) g.add(p.cilindro(0.08, 0.1, 1.1, 6, c.escura, x, 0.55, 0.6));
      break;
    }
    case "floresta-sombria": {
      // a árvore ancestral: tronco enorme, copa escura, olhos acesos e teias
      g.add(p.cilindro(0.6, 0.9, 1.9, 7, c.madeira, 0, 0.95, 0));
      g.add(p.malha(new THREE.DodecahedronGeometry(1.15, 0), c.telhado, 0, 2.3, 0));
      g.add(p.malha(new THREE.DodecahedronGeometry(0.75, 0), "#0f3d23", 0.8, 2.0, 0.2));
      for (const x of [-0.18, 0.18]) g.add(p.malha(new THREE.SphereGeometry(0.07, 6, 4), p.brilho(c.brilho), x, 1.1, 0.68));
      g.add(p.caixa(0.5, 0.5, 0.06, ESCURO, 0, 0.3, 0.72));
      const teia = p.malha(new THREE.CircleGeometry(0.45, 8), new THREE.MeshBasicMaterial({ color: "#e5e7eb", transparent: true, opacity: 0.45, side: THREE.DoubleSide }), 0.55, 1.4, 0.55);
      teia.rotation.y = Math.PI / 4;
      teia.userData.proprio = true;
      g.add(teia);
      break;
    }
    case "covil-cerbero": {
      // o portão do covil: dois pilares de pedra vulcânica, o arco e a lava brilhando lá dentro
      for (const x of [-0.65, 0.65]) g.add(p.caixa(0.45, 1.7, 0.5, c.pedra, x, 0.85, 0));
      g.add(p.caixa(1.75, 0.4, 0.55, c.pedra, 0, 1.85, 0));
      g.add(p.caixa(0.85, 1.4, 0.1, p.brilho(c.brilho), 0, 0.7, -0.05));
      for (const lado of [-1, 1]) {
        const espinho = p.cone(0.14, 0.6, 5, c.escura, lado * 0.75, 2.3, 0);
        espinho.rotation.z = -lado * 0.3;
        g.add(espinho);
      }
      g.add(p.malha(new THREE.SphereGeometry(0.18, 8, 6), OSSO, 0, 2.15, 0.3));
      const chama = p.malha(new THREE.OctahedronGeometry(0.22, 0), p.brilho("#fde047"), 0, 0.3, 0.45);
      chama.scale.y = 1.7;
      chama.userData.gira = true;
      g.add(chama);
      break;
    }
    case "recife-tritoes": {
      // o palácio de concha: uma concha em espiral, corais em volta e a pérola brilhando
      for (let i = 0; i < 5; i++) g.add(p.cilindro(0.95 - i * 0.17, 1.0 - i * 0.17, 0.42, 10, i % 2 ? c.madeira : "#fbcfe8", 0, 0.21 + i * 0.4, 0));
      g.add(p.cone(0.18, 0.5, 8, c.madeira, 0, 2.25, 0));
      g.add(p.malha(new THREE.SphereGeometry(0.22, 10, 8), p.brilho(c.brilho), 0, 0.5, 0.95));
      for (const [x, z, cor] of [[-0.95, 0.6, "#fb7185"], [0.95, 0.5, "#f59e0b"], [0.7, -0.8, "#a78bfa"]]) g.add(p.cone(0.18, 0.9, 5, cor, x, 0.45, z));
      break;
    }
    case "cidade-afundada": {
      // o templo afundado: colunas (uma tombada), o frontão rachado e algas
      for (const x of [-0.75, -0.25, 0.25, 0.75]) g.add(p.cilindro(0.13, 0.15, 1.5, 8, c.pedra, x, 0.75, 0.3));
      const tombada = p.cilindro(0.13, 0.15, 1.5, 8, c.pedra, 1.2, 0.15, -0.5);
      tombada.rotation.z = Math.PI / 2.2;
      g.add(tombada);
      g.add(p.caixa(1.9, 0.22, 0.7, c.pedra, 0, 1.6, 0.3));
      const frontao = p.cone(1.05, 0.5, 3, c.pedra, 0, 1.95, 0.3);
      frontao.rotation.set(Math.PI / 2, 0, 0);
      frontao.scale.set(1, 0.3, 1);
      g.add(frontao);
      g.add(p.caixa(1.4, 1.1, 0.5, c.madeira, 0, 0.55, -0.35));
      for (const x of [-0.95, 0.95]) g.add(p.cilindro(0.03, 0.05, 1.1, 4, "#16a34a", x, 0.55, 0.75));
      break;
    }
    case "fossa-kraken": {
      // a toca do Kraken: um arco de pedra escura, tentáculos saindo e dois olhos acesos
      for (const x of [-0.7, 0.7]) g.add(p.caixa(0.45, 1.5, 0.55, c.pedra, x, 0.75, 0));
      g.add(p.caixa(1.85, 0.45, 0.6, c.pedra, 0, 1.65, 0));
      g.add(p.caixa(0.9, 1.25, 0.08, ESCURO, 0, 0.63, 0.05));
      for (const x of [-0.18, 0.18]) g.add(p.malha(new THREE.SphereGeometry(0.08, 8, 6), p.brilho("#facc15"), x, 0.95, 0.12));
      for (const [x, z, rz] of [[-1.1, 0.5, 0.5], [1.1, 0.4, -0.5], [-0.6, 0.95, 0.3], [0.65, 0.95, -0.3]]) {
        const tentaculo = p.cone(0.12, 1.3, 6, c.telhado, x, 0.55, z);
        tentaculo.rotation.z = rz;
        g.add(tentaculo);
      }
      break;
    }
    case "trilha-yetis": {
      // a caverna de gelo: um morro de neve com a boca escura e pingentes de gelo
      const morro = p.malha(new THREE.DodecahedronGeometry(1.05, 1), "#f8fafc", 0, 0.55, 0);
      morro.scale.set(1.2, 0.8, 1.1);
      g.add(morro);
      const boca = p.malha(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI), ESCURO, 0, 0.05, 0.82);
      boca.rotation.x = -Math.PI / 2;
      g.add(boca);
      for (const x of [-0.3, -0.1, 0.1, 0.3]) { const gelo = p.cone(0.05, 0.25, 4, "#bae6fd", x, 0.38, 0.85); gelo.rotation.x = Math.PI; g.add(gelo); }
      for (const [x, z] of [[0.7, 0.7], [-0.7, 0.75]]) g.add(p.malha(new THREE.OctahedronGeometry(0.16, 0), p.brilho(c.brilho), x, 0.25, z));
      break;
    }
    case "ninho-harpias": {
      // o ninho no alto do pico: uma agulha de pedra com o ninho e os ovos de ouro
      g.add(p.cilindro(0.35, 0.8, 1.6, 7, c.pedra, 0, 0.8, 0));
      const ninho = p.malha(new THREE.TorusGeometry(0.62, 0.2, 6, 12), c.madeira, 0, 1.72, 0);
      ninho.rotation.x = Math.PI / 2;
      g.add(ninho);
      for (const [x, z] of [[-0.18, 0.05], [0.18, -0.05], [0, 0.2]]) { const ovo = p.malha(new THREE.SphereGeometry(0.16, 8, 6), OURO, x, 1.8, z); ovo.scale.y = 1.3; g.add(ovo); }
      g.add(p.cone(0.35, 0.3, 7, "#f8fafc", 0, 0.08, 0));
      break;
    }
    case "pico-gigante": {
      // o trono de gelo do Gigante: blocos de gelo, o espaldar alto e a coroa congelada
      const gelo = new THREE.MeshStandardMaterial({ color: "#bae6fd", flatShading: true, roughness: 0.3, transparent: true, opacity: 0.85 });
      const bloco = (w, h, d, x, y, z) => { const m = p.malha(new THREE.BoxGeometry(w, h, d), gelo, x, y, z); m.userData.proprio = true; g.add(m); };
      bloco(1.6, 0.5, 1.2, 0, 0.25, 0);
      bloco(1.6, 1.6, 0.35, 0, 1.05, -0.45);
      bloco(0.35, 0.9, 1.0, -0.65, 0.7, 0);
      bloco(0.35, 0.9, 1.0, 0.65, 0.7, 0);
      for (let i = 0; i < 5; i++) g.add(p.cone(0.07, 0.25, 4, OURO, -0.3 + i * 0.15, 2.0, -0.45));
      g.add(p.malha(new THREE.OctahedronGeometry(0.15, 0), p.brilho(c.brilho), 0, 1.5, -0.25));
      break;
    }
    case "forja-diabretes": {
      // a forja: o forno com a boca em brasa, a chaminé fumegando e a bigorna na frente
      g.add(p.caixa(1.4, 1.1, 1.1, c.pedra, 0, 0.55, -0.1));
      g.add(p.caixa(0.6, 0.45, 0.06, p.brilho(c.brilho), 0, 0.35, 0.47));
      g.add(p.cilindro(0.22, 0.28, 1.2, 7, c.escura, 0.4, 1.6, -0.3));
      g.add(p.caixa(0.5, 0.2, 0.25, "#52525b", 0, 0.42, 1.0));
      g.add(p.caixa(0.3, 0.3, 0.18, "#3f3f46", 0, 0.2, 1.0));
      const chama = p.malha(new THREE.OctahedronGeometry(0.2, 0), p.brilho("#fde047"), 0.4, 2.35, -0.3);
      chama.scale.y = 1.6;
      chama.userData.gira = true;
      g.add(chama);
      break;
    }
    case "rio-de-magma": {
      // a ponte de obsidiana sobre a lava, com o portal do Golem
      g.add(p.caixa(2.2, 0.08, 1.2, p.brilho(c.brilho), 0, 0.04, 0));
      g.add(p.caixa(2.4, 0.22, 0.7, "#18181b", 0, 0.32, 0));
      for (const x of [-0.9, 0.9]) g.add(p.caixa(0.35, 1.4, 0.45, "#27272a", x, 1.0, 0));
      g.add(p.caixa(2.1, 0.32, 0.5, "#27272a", 0, 1.8, 0));
      for (const x of [-0.5, 0, 0.5]) g.add(p.cone(0.12, 0.45, 4, "#09090b", x, 2.15, 0));
      break;
    }
    case "trono-dragao": {
      // o vulcão do Dragão: o cone com a cratera em brasa e a caveira de dragão na entrada
      g.add(p.cone(1.3, 1.9, 8, c.pedra, 0, 0.95, 0));
      g.add(p.cilindro(0.4, 0.4, 0.1, 8, p.brilho(c.brilho), 0, 1.86, 0));
      g.add(p.caixa(0.55, 0.7, 0.1, p.brilho("#f97316"), 0, 0.35, 1.05));
      g.add(p.malha(new THREE.SphereGeometry(0.26, 8, 6), OSSO, 0, 0.85, 1.1));
      for (const lado of [-1, 1]) { const chifre = p.cone(0.07, 0.4, 5, OSSO, lado * 0.25, 1.1, 1.05); chifre.rotation.z = -lado * 0.7; g.add(chifre); }
      break;
    }
    default:
      if (cen.espaco) {
        // a base alienígena: a cúpula de vidro, o anel de luzes e a antena
        const cupula = new THREE.MeshStandardMaterial({ color: c.brilho, flatShading: true, roughness: 0.2, transparent: true, opacity: 0.55 });
        const dome = p.malha(new THREE.SphereGeometry(0.95, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), cupula, 0, 0.25, 0);
        dome.userData.proprio = true;
        g.add(dome);
        g.add(p.cilindro(1.05, 1.1, 0.25, 14, c.pedra, 0, 0.12, 0));
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(p.malha(new THREE.OctahedronGeometry(0.07, 0), p.brilho(c.telhado), Math.cos(a) * 1.05, 0.28, Math.sin(a) * 1.05)); }
        g.add(p.cilindro(0.03, 0.03, 1.0, 5, c.escura, 0, 1.6, 0));
        const ponta = p.malha(new THREE.OctahedronGeometry(0.12, 0), p.brilho(c.telhado), 0, 2.15, 0);
        ponta.userData.gira = true;
        g.add(ponta);
      } else g.add(p.cone(1.1, 1.6, 6, c.tecido, 0, 0.8, 0));
  }
  return g;
}

/** Construção que não existe na expedição: nada à vista (nem o lote vazio com placa do reino), só
 *  um marcador invisível para a âncora do rótulo ter onde ficar. */
function nada(p) {
  const g = new THREE.Group();
  const m = p.caixa(0.01, 0.01, 0.01, "#000000", 0, 0, 0);
  m.visible = false;
  g.add(m);
  return g;
}

/** A estrutura da expedição para uma chave do motor (null = sem cenário: use a do reino). */
export function estruturaDaExpedicao(p, chave, nivel, cen) {
  if (!cen) return null;
  const c = cen.paleta;
  if (chave === "muralha") return nivel > 0 ? palicada(p, nivel, c, cen.estaca) : nada(p);
  if (!(nivel > 0)) return nada(p);
  switch (chave) {
    case "castelo": return covil(p, cen);
    case "torre": return torreDeVigia(p, nivel, c);
    case "canhao": return catapulta(p, nivel, c);
    case "mina": return tesouro(p, nivel, c);
    case "cofre": return carroca(p, nivel, c);
    case "quartel": return cabana(p, nivel, c, cen.cabana);
    case "biblioteca": return pedraRunica(p, nivel, c);
    case "defesaAerea": return balista(p, nivel, c);
    case "morteiro": return caldeirao(p, nivel, c);
    case "torreMagica": return totem(p, nivel, c);
    case "torreRaio": return obelisco(p, nivel, c);
    default: return nada(p);
  }
}

// ------------------------------------------------------------------ o terreno e os enfeites

/** O chão e os enfeites do lugar, longe das construções e da praia de desembarque. */
export function terrenoDaExpedicao(p, cen, construcoes) {
  const g = new THREE.Group();
  const c = cen.paleta;
  const terreno = construcoes?.terreno || 0;
  const R = raioDaIlha(terreno);
  // o chão do lugar cobre a grama da ilha inteira, borda incluída: mesmo número de lados e a mesma
  // ondulação da ilha do Mundo3D (função ilha), um tiquinho maior e mais alto
  const lados = 11 + 2 * terreno;
  const geo = new THREE.CylinderGeometry(R + 0.115, R + 0.115, 0.262, lados);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const f = 1 + 0.04 * Math.sin(a * 3 + 1) + 0.03 * Math.sin(a * 5);
    pos.setX(i, x * f);
    pos.setZ(i, z * f);
  }
  geo.computeVertexNormals();
  g.add(p.malha(geo, cen.chao, 0, -0.119, 0));
  const r = aleatorio(cen.id.length * 977 + terreno * 31);
  const ocupado = Object.entries(LUGARES).filter(([chave]) => (construcoes?.[chave] || 0) > 0).map(([, l]) => l);
  const livre = (x, z, folga) => ocupado.every(([lx, lz]) => Math.hypot(lx - x, lz - z) > folga) && Math.hypot(PRACA[0] - x, PRACA[1] - z) > 1.5
    && Math.hypot(LUGARES.castelo[0] - x, LUGARES.castelo[1] - z) > RAIO_DA_MURALHA + 0.5;
  const naPraia = (a) => { const b = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return b > 0.05 && b < 1.55; };
  const lugares = (n, de, ate, folga) => {
    const lista = [];
    for (let i = 0; i < n * 5 && lista.length < n; i++) {
      const a = r() * Math.PI * 2;
      if (naPraia(a)) continue;
      const raio = de + r() * (ate - de);
      const x = Math.cos(a) * raio, z = Math.sin(a) * raio;
      if (livre(x, z, folga)) lista.push([x, z, 0.8 + r() * 0.5]);
    }
    return lista;
  };

  // peças de enfeite
  const pinheiro = (x, z, s, cor = "#2f6b3a", neve = false) => {
    g.add(p.cilindro(0.07 * s, 0.1 * s, 0.4 * s, 5, c.escura, x, 0.2 * s, z));
    g.add(p.cone(0.5 * s, 0.9 * s, 6, cor, x, 0.75 * s, z));
    g.add(p.cone(0.36 * s, 0.7 * s, 6, neve ? "#f8fafc" : "#24563a", x, 1.2 * s, z));
  };
  const arvoreRedonda = (x, z, s, cor) => {
    g.add(p.cilindro(0.07 * s, 0.1 * s, 0.5 * s, 5, c.escura, x, 0.25 * s, z));
    g.add(p.malha(new THREE.DodecahedronGeometry(0.45 * s, 0), cor, x, 0.8 * s, z));
  };
  const arvoreMorta = (x, z, s) => {
    g.add(p.cilindro(0.06 * s, 0.11 * s, 1.1 * s, 5, c.escura, x, 0.55 * s, z));
    for (const [ang, h] of [[0.7, 0.75], [-0.8, 0.95], [2.2, 0.6]]) {
      const galho = p.cilindro(0.025 * s, 0.04 * s, 0.5 * s, 4, c.escura, x + Math.cos(ang) * 0.18 * s, h * s, z + Math.sin(ang) * 0.18 * s);
      galho.rotation.z = Math.cos(ang) * 0.9;
      galho.rotation.x = Math.sin(ang) * 0.9;
      g.add(galho);
    }
  };
  const cogumelo = (x, z, s, cor) => {
    g.add(p.cilindro(0.06 * s, 0.08 * s, 0.28 * s, 6, "#f3e3c3", x, 0.14 * s, z));
    const ch = p.malha(new THREE.SphereGeometry(0.2 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), cor, x, 0.26 * s, z);
    ch.scale.y = 0.7;
    g.add(ch);
  };
  const casinha = (x, z, s, parede, teto, plano = false) => {
    const casa = new THREE.Group();
    casa.add(p.caixa(0.7 * s, 0.5 * s, 0.6 * s, parede, 0, 0.25 * s, 0));
    if (plano) casa.add(p.caixa(0.78 * s, 0.08 * s, 0.68 * s, teto, 0, 0.54 * s, 0));
    else { const t = p.cone(0.6 * s, 0.45 * s, 4, teto, 0, 0.72 * s, 0); t.rotation.y = Math.PI / 4; casa.add(t); }
    casa.add(p.caixa(0.16 * s, 0.26 * s, 0.03, ESCURO, 0, 0.13 * s, 0.31 * s));
    casa.position.set(x, 0, z);
    casa.rotation.y = Math.atan2(-x, -z);
    g.add(casa);
  };
  const tenda = (x, z, s, cor) => g.add(p.cone(0.45 * s, 0.75 * s, 5, cor, x, 0.37 * s, z));
  const fogueira = (x, z) => {
    for (let i = 0; i < 3; i++) { const t = p.caixa(0.5, 0.08, 0.08, c.escura, x, 0.05, z); t.rotation.y = (i * Math.PI) / 3; g.add(t); }
    const ch = p.malha(new THREE.OctahedronGeometry(0.16, 0), p.brilho("#ff8a1f"), x, 0.24, z);
    ch.scale.y = 1.6;
    ch.userData.gira = true;
    g.add(ch);
  };
  const caveira = (x, z) => {
    g.add(p.cilindro(0.05, 0.05, 1.2, 5, c.escura, x, 0.6, z));
    g.add(p.malha(new THREE.SphereGeometry(0.13, 8, 6), OSSO, x, 1.3, z));
  };
  const ossos = (x, z) => {
    const o = p.cilindro(0.03, 0.03, 0.3, 5, OSSO, x, 0.04, z);
    o.rotation.z = Math.PI / 2;
    o.rotation.y = r() * Math.PI;
    g.add(o);
  };
  const pedra = (x, z, s, cor = c.pedra) => {
    const m = p.malha(new THREE.DodecahedronGeometry(0.22 * s, 0), cor, x, 0.1 * s, z);
    m.scale.y = 0.7;
    g.add(m);
  };
  const coral = (x, z, s, cor) => {
    for (let k = 0; k < 3; k++) {
      const ramo = p.cone(0.09 * s, (0.5 + r() * 0.4) * s, 5, cor, x + (k - 1) * 0.12 * s, 0.25 * s, z + (r() - 0.5) * 0.15);
      ramo.rotation.z = (k - 1) * 0.35;
      g.add(ramo);
    }
  };
  const alga = (x, z, s) => { for (let k = 0; k < 3; k++) g.add(p.cilindro(0.025 * s, 0.04 * s, (0.7 + r() * 0.6) * s, 4, k % 2 ? "#16a34a" : "#15803d", x + k * 0.08, 0.4 * s, z)); };
  const bolha = (x, z) => {
    const m = p.malha(new THREE.SphereGeometry(0.05 + r() * 0.06, 8, 6), new THREE.MeshStandardMaterial({ color: "#e0f7ff", transparent: true, opacity: 0.55, roughness: 0.1 }), x, 0.5 + r() * 1.6, z);
    m.userData.proprio = true;
    g.add(m);
  };
  const estrela = (x, z) => { const m = p.malha(new THREE.OctahedronGeometry(0.14, 0), "#fb923c", x, 0.04, z); m.scale.y = 0.25; m.rotation.y = r() * Math.PI; g.add(m); };
  const cristalDeGelo = (x, z, s) => { const m = p.malha(new THREE.OctahedronGeometry(0.16 * s, 0), p.brilho("#bae6fd"), x, 0.22 * s, z); m.scale.y = 1.8; g.add(m); };
  const poca = (x, z) => g.add(p.cilindro(0.45 + r() * 0.3, 0.45, 0.05, 9, p.brilho(c.brilho), x, 0.03, z));
  const cratera = (x, z, s) => {
    const borda = p.malha(new THREE.TorusGeometry(0.35 * s, 0.08 * s, 5, 10), c.pedra, x, 0.03, z);
    borda.rotation.x = Math.PI / 2;
    g.add(borda);
    g.add(p.cilindro(0.3 * s, 0.3 * s, 0.02, 10, c.escura, x, 0.015, z));
  };
  const plantaAlien = (x, z, s) => {
    g.add(p.cilindro(0.03 * s, 0.05 * s, 0.8 * s, 5, c.tecido, x, 0.4 * s, z));
    g.add(p.malha(new THREE.SphereGeometry(0.12 * s, 8, 6), p.brilho(c.telhado), x, 0.85 * s, z));
  };
  const vagalume = (x, z, cor) => {
    const l = p.malha(new THREE.OctahedronGeometry(0.06, 0), p.brilho(cor), x, 0.6 + r() * 0.6, z);
    l.userData.gira = true;
    g.add(l);
  };

  switch (cen.id) {
    case "bosque-cogumelos":
      for (const [x, z, s] of lugares(10, R - 2.0, R - 0.5, 1.2)) arvoreRedonda(x, z, s, r() > 0.5 ? "#6fbf5a" : "#4fae63");
      for (const [x, z, s] of lugares(22, 1.6, R - 0.6, 1.0)) cogumelo(x, z, s * 1.4, ["#e53935", "#f59e0b", "#8b5cf6", "#ec4899"][Math.floor(r() * 4)]);
      for (const [x, z] of lugares(14, 1.5, R - 0.5, 0.8)) g.add(p.malha(new THREE.SphereGeometry(0.06, 6, 4), ["#fde047", "#f9a8d4", "#ffffff"][Math.floor(r() * 3)], x, 0.06, z));
      for (const [x, z] of lugares(8, 1.5, R - 0.8, 0.9)) vagalume(x, z, c.brilho);
      break;
    case "vila-goblins":
      for (const [x, z, s] of lugares(7, R - 2.3, R - 0.9, 1.6)) casinha(x, z, s, c.madeira, r() > 0.5 ? c.telhado : "#a16207");
      for (const [x, z] of lugares(5, 2, R - 1.2, 1.3)) { g.add(p.cilindro(0.22, 0.26, 0.3, 8, "#e7c86b", x, 0.15, z)); g.add(p.cone(0.24, 0.18, 8, "#d9b44a", x, 0.39, z)); }
      for (const [x, z] of lugares(4, 2.2, R - 1.4, 1.5)) for (let k = 0; k < 3; k++) g.add(p.caixa(0.7, 0.06, 0.12, "#6b4f2a", x, 0.03, z + (k - 1) * 0.22));
      for (const [x, z, s] of lugares(6, R - 1.6, R - 0.5, 1.2)) arvoreRedonda(x, z, s, "#4fae63");
      break;
    case "floresta-lobos":
      for (const [x, z, s] of lugares(28, R - 2.3, R - 0.5, 1.1)) pinheiro(x, z, s * 1.15, "#2f6b3a", true);
      for (const [x, z, s] of lugares(8, 1.8, R - 1.0, 1.2)) pedra(x, z, s, "#cbd5e1");
      for (const [x, z] of lugares(6, 1.6, R - 1.0, 1.0)) ossos(x, z);
      break;
    case "acampamento-orc":
      for (const [x, z, s] of lugares(7, R - 2.2, R - 0.9, 1.5)) tenda(x, z, s, r() > 0.5 ? c.tecido : "#a16207");
      for (const [x, z] of lugares(6, 1.8, R - 1.0, 1.3)) caveira(x, z);
      for (const [x, z] of lugares(3, 2, R - 1.5, 1.6)) fogueira(x, z);
      for (const [x, z] of lugares(10, 1.5, R - 0.6, 0.9)) ossos(x, z);
      for (const [x, z] of lugares(6, R - 1.1, R - 0.6, 1.0)) { const e = p.cone(0.07, 0.6, 4, c.madeira, x, 0.25, z); e.rotation.z = 0.4; g.add(e); }
      break;
    case "vila-bandidos":
      for (const [x, z, s] of lugares(7, R - 2.3, R - 0.9, 1.6)) casinha(x, z, s, c.pedra, c.madeira, true);
      for (const [x, z] of lugares(8, 1.6, R - 0.8, 1.0)) g.add(p.cilindro(0.15, 0.15, 0.34, 8, "#8a5a2b", x, 0.17, z));
      for (const [x, z, s] of lugares(6, R - 1.6, R - 0.5, 1.2)) {
        g.add(p.cilindro(0.1 * s, 0.11 * s, 0.75 * s, 6, "#3f7a3a", x, 0.37 * s, z));
        g.add(p.cilindro(0.06 * s, 0.06 * s, 0.3 * s, 6, "#3f7a3a", x + 0.14 * s, 0.45 * s, z));
      }
      for (const [x, z, s] of lugares(6, 1.6, R - 1.0, 1.1)) pedra(x, z, s, "#c2a878");
      break;
    case "bosque-assombrado":
      for (const [x, z, s] of lugares(12, R - 2.2, R - 0.5, 1.1)) arvoreMorta(x, z, s * 1.2);
      for (const [x, z] of lugares(9, 1.8, R - 1.0, 1.1)) {
        const lapide = p.caixa(0.3, 0.42, 0.08, c.pedra, x, 0.21, z);
        lapide.rotation.y = r() * 0.6 - 0.3;
        lapide.rotation.z = r() * 0.2 - 0.1;
        g.add(lapide);
      }
      for (const [x, z] of lugares(6, 1.6, R - 0.8, 1.0)) g.add(p.malha(new THREE.SphereGeometry(0.17, 8, 6), "#ea580c", x, 0.14, z));
      for (const [x, z] of lugares(12, 1.5, R - 0.6, 0.8)) vagalume(x, z, c.brilho);
      break;
    case "floresta-sombria":
      for (const [x, z, s] of lugares(22, R - 2.4, R - 0.5, 1.1)) pinheiro(x, z, s * 1.35, "#163a24");
      for (const [x, z, s] of lugares(10, 1.6, R - 0.8, 1.0)) cogumelo(x, z, s * 1.3, "#7c3aed");
      for (const [x, z] of lugares(7, 1.8, R - 1.0, 1.2)) {
        const teia = p.malha(new THREE.CircleGeometry(0.32, 8), new THREE.MeshBasicMaterial({ color: "#e5e7eb", transparent: true, opacity: 0.4, side: THREE.DoubleSide }), x, 0.45, z);
        teia.rotation.y = r() * Math.PI;
        teia.userData.proprio = true;
        g.add(teia);
      }
      for (const [x, z] of lugares(10, 1.5, R - 0.6, 0.8)) vagalume(x, z, c.brilho);
      break;
    case "covil-cerbero":
      for (const [x, z, s] of lugares(14, 1.6, R - 0.6, 1.1)) pedra(x, z, s * 1.4, r() > 0.5 ? c.pedra : "#1c1917");
      for (const [x, z] of lugares(10, 1.6, R - 0.7, 1.0)) {
        const rach = p.caixa(0.08, 0.02, 0.6 + r() * 0.6, p.brilho(c.brilho), x, 0.03, z);
        rach.rotation.y = r() * Math.PI;
        g.add(rach);
      }
      for (const [x, z] of lugares(4, 2, R - 1.4, 1.5)) fogueira(x, z);
      for (const [x, z] of lugares(10, 1.5, R - 0.6, 0.9)) ossos(x, z);
      for (const [x, z, s] of lugares(6, R - 1.4, R - 0.5, 1.2)) g.add(p.cone(0.2 * s, 0.9 * s, 5, "#1c1917", x, 0.45 * s, z));
      break;
    case "recife-tritoes":
    case "cidade-afundada":
    case "fossa-kraken": {
      const fundo = cen.id === "fossa-kraken";
      const corais = fundo ? ["#5b21b6", "#0e7490", "#334155"] : ["#fb7185", "#f59e0b", "#a78bfa", "#f472b6", "#34d399"];
      for (const [x, z, s] of lugares(fundo ? 10 : 18, 1.6, R - 0.5, 1.0)) coral(x, z, s, corais[Math.floor(r() * corais.length)]);
      for (const [x, z, s] of lugares(14, R - 2.0, R - 0.4, 0.9)) alga(x, z, s);
      for (const [x, z] of lugares(16, 1.5, R - 0.5, 0.7)) bolha(x, z);
      for (const [x, z] of lugares(6, 1.8, R - 0.8, 1.0)) estrela(x, z);
      if (cen.id === "cidade-afundada") for (const [x, z, s] of lugares(6, 2, R - 1.0, 1.4)) { g.add(p.cilindro(0.12 * s, 0.14 * s, 0.6 * s, 7, c.pedra, x, 0.3 * s, z)); pedra(x + 0.3, z, s, c.pedra); }
      if (fundo) for (const [x, z] of lugares(10, 1.6, R - 0.6, 0.9)) vagalume(x, z, c.brilho);
      break;
    }
    case "trilha-yetis":
    case "ninho-harpias":
    case "pico-gigante": {
      for (const [x, z, s] of lugares(cen.id === "ninho-harpias" ? 10 : 22, R - 2.3, R - 0.5, 1.1)) pinheiro(x, z, s * 1.1, "#2f6b3a", true);
      for (const [x, z, s] of lugares(10, 1.8, R - 0.8, 1.1)) { pedra(x, z, s * 1.4, c.pedra); g.add(p.malha(new THREE.SphereGeometry(0.16 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), "#f8fafc", x, 0.12 * s, z)); }
      for (const [x, z, s] of lugares(cen.id === "pico-gigante" ? 12 : 5, 1.6, R - 0.8, 1.0)) cristalDeGelo(x, z, s);
      if (cen.id === "ninho-harpias") for (const [x, z, s] of lugares(6, R - 1.6, R - 0.5, 1.4)) g.add(p.cone(0.35 * s, 1.4 * s, 6, c.pedra, x, 0.7 * s, z));
      break;
    }
    case "forja-diabretes":
    case "rio-de-magma":
    case "trono-dragao": {
      for (const [x, z, s] of lugares(12, 1.6, R - 0.6, 1.1)) pedra(x, z, s * 1.4, r() > 0.5 ? c.pedra : "#1c1917");
      for (const [x, z] of lugares(cen.id === "rio-de-magma" ? 16 : 10, 1.6, R - 0.7, 1.0)) {
        const rach = p.caixa(0.08, 0.02, 0.6 + r() * 0.6, p.brilho(c.brilho), x, 0.03, z);
        rach.rotation.y = r() * Math.PI;
        g.add(rach);
      }
      for (const [x, z] of lugares(cen.id === "rio-de-magma" ? 5 : 3, 2, R - 1.4, 1.6)) poca(x, z);
      for (const [x, z] of lugares(3, 2, R - 1.4, 1.5)) fogueira(x, z);
      for (const [x, z, s] of lugares(7, R - 1.4, R - 0.5, 1.2)) g.add(p.cone(0.2 * s, 0.9 * s, 5, "#18181b", x, 0.45 * s, z));
      if (cen.id === "trono-dragao") for (const [x, z] of lugares(8, 1.5, R - 0.6, 0.9)) ossos(x, z);
      break;
    }
    default:
      if (cen.espaco) {
        for (const [x, z, s] of lugares(9, 1.8, R - 0.8, 1.2)) cratera(x, z, s);
        for (const [x, z, s] of lugares(12, 1.6, R - 0.6, 1.0)) g.add(p.malha(new THREE.OctahedronGeometry(0.14 * s, 0), p.brilho(c.brilho), x, 0.18 * s, z));
        for (const [x, z, s] of lugares(10, R - 2.0, R - 0.5, 1.0)) plantaAlien(x, z, s);
        for (const [x, z, s] of lugares(8, 1.6, R - 0.8, 1.0)) pedra(x, z, s * 1.2, c.pedra);
      }
      break;
  }
  return g;
}
