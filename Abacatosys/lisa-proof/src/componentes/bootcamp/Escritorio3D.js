"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import Neuro from "@/componentes/Neuro.js";
import { svgComoImagem, recorteDePapel } from "@/componentes/reino/papel.js";
import { humorDoCompetidor } from "./Pecas.js";
import DesenhoDoJurado, { DesenhoDaApresentadora } from "./Jurados.js";

/**
 * O escritório de TI do Modo Bootcamp em 3D (04/11/2026): um estúdio de reality show com 8 baias em duas fileiras
 * viradas para a bancada dos 3 jurados, e um telão com a rodada. Cada competidor é o Neuro de papel com a skin dele
 * (o recorte de adesivo do Reino: src/componentes/reino/papel.js), de pé ao lado da baia; o monitor de cada baia
 * mostra a etapa do fluxo do exercício. Os jurados são os desenhos de ./Jurados.js, num palco atrás da bancada
 * (no chão, a bancada escondia os três).
 *
 * `cenario`: um dos 5 ambientes (neon, datacenter, orbital, loft, cyber) — troca o piso, as paredes, as luzes e a
 * decoração sem remontar as baias.
 * `palco`: a avaliação ao vivo — { id: o competidor que vai até a bancada, juradoAtivo: o jurado que fala }. O
 * avatar anda pelo corredor até a frente da bancada (e volta quando sai do palco), a câmera se aproxima e o jurado
 * que fala cresce um pouco. `humores` troca o humor de quem estiver na lista ({ [id]: humor, "jurado:kernel": ... }).
 *
 * Arrastar gira o estúdio; tocar numa baia chama `aoEscolher(id)`. Sem WebGL, chama `aoFalhar()`. Com "reduzir
 * movimento", ninguém balança, o avatar vai direto ao lugar e a câmera não desliza.
 */

// as 8 baias: duas fileiras de 4, viradas para a bancada (que fica no fundo, em z negativo)
const POSICOES = [[-4.8, -0.2], [-1.6, -0.2], [1.6, -0.2], [4.8, -0.2], [-4.8, 2.7], [-1.6, 2.7], [1.6, 2.7], [4.8, 2.7]];
const POS_DOS_JURADOS = [-2.1, 0, 2.1];
const IDS_DOS_JURADOS = ["kernel", "vetor", "sintaxe"];
const Z_DOS_JURADOS = -4.5;
const ALTURA_DO_PALCO = 0.5;
const PALCO = { x: 0, z: -2.55 };       // onde o competidor para, na frente da bancada
const CORREDOR_Z = 1.25;                 // o corredor entre as duas fileiras
const VELOCIDADE = 3.4;                  // unidades por segundo, andando
// a despedida: a porta de saída fica no fim do corredor, na parede da direita, com a apresentadora ao lado
// (o competidor para um pouco à esquerda da porta e a apresentadora fica à direita: vistos da câmera da despedida,
// os dois aparecem lado a lado, sem um tapar o outro)
const SAIDA = { x: 8.0, z: 0.8 };
const FORA = { x: 11.2, z: CORREDOR_Z };
const POS_DA_APRESENTADORA = { x: 9.35, z: 2.0 };
// a grande final: as duas baias no centro e a arquibancada nos dois lados, com todos os outros torcendo
const POS_DA_FINAL = [[-2.6, 0.4], [2.6, 0.4]];
const DEGRAUS = [{ dx: 7.4, h: 0.3 }, { dx: 8.4, h: 0.6 }, { dx: 9.4, h: 0.9 }];
const ASSENTOS = (() => {
  const lista = [];
  for (const degrau of DEGRAUS) for (const z of [-0.2, 1.4, 3.0]) for (const lado of [-1, 1]) lista.push({ x: lado * degrau.dx, z, y: degrau.h });
  return lista;
})();
const APRESENTADORA_NA_FINAL = { x: -4.4, z: -2.4 };

const COR = { mesa: "#2b313b", mesaClara: "#3a424e", metal: "#59616d", cadeira: "#20252c", bancada: "#22272f", vidro: "#9fb4c8", ouro: "#f0be45" };
const COR_DO_TIME = { azul: "#2563eb", laranja: "#ea580c" };

// a cor do monitor pela etapa do fluxo
const TELA = {
  leitura: { cor: "#94a3b8", rotulo: "ENUNCIADO" },
  analise: { cor: "#38bdf8", rotulo: "ANÁLISE" },
  ambiente: { cor: "#a78bfa", rotulo: "AMBIENTE" },
  codigo: { cor: "#60a5fa", rotulo: "CÓDIGO" },
  testes: { cor: "#facc15", rotulo: "TESTES" },
  revisao: { cor: "#84cc16", rotulo: "ENVIADO" },
  fim: { cor: "#84cc16", rotulo: "AVALIADO" },
};

// ------------------------------------------------------------------ os 5 cenários
const CENARIOS_3D = {
  neon: { fundo: "#0b0e12", piso: "#12161b", parede: "#191e25", acento: "#84cc16", grade: ["#2e3a1c", "#1c2218"], hemi: ["#d6e6ff", "#141910", 1.05], luzJurados: "#9be12f", brilhoPiso: [0.4, 0.3] },
  datacenter: { fundo: "#060b14", piso: "#101826", parede: "#0f1a2b", acento: "#38bdf8", grade: ["#1e3a5f", "#13233a"], hemi: ["#cfe8ff", "#0a1220", 1.0], luzJurados: "#60a5fa", brilhoPiso: [0.35, 0.4] },
  orbital: { fundo: "#02030a", piso: "#cfd6e0", parede: "#e3e8ef", acento: "#22d3ee", grade: ["#aab4c3", "#c2cad6"], hemi: ["#ffffff", "#8892a6", 1.2], luzJurados: "#67e8f9", brilhoPiso: [0.5, 0.15] },
  loft: { fundo: "#1d120d", piso: "#7a5234", parede: "#8f4431", acento: "#f59e0b", grade: null, hemi: ["#ffe7c7", "#3b2414", 1.15], luzJurados: "#fbbf24", brilhoPiso: [0.75, 0.05] },
  cyber: { fundo: "#07020f", piso: "#0d0b1a", parede: "#140f26", acento: "#e879f9", grade: ["#3b1d4a", "#1a1030"], hemi: ["#f5d0fe", "#0b0618", 0.9], luzJurados: "#f0abfc", brilhoPiso: [0.15, 0.75] },
};

function texturaDeCanvas(w, h, desenhar) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  desenhar(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ceuDeEstrelas(ctx, w, h, comPlaneta) {
  ctx.fillStyle = "#02030a";
  ctx.fillRect(0, 0, w, h);
  let a = 7;
  const s = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + s() * 0.7})`;
    ctx.fillRect(s() * w, s() * h, s() < 0.1 ? 2 : 1, s() < 0.1 ? 2 : 1);
  }
  if (comPlaneta) {
    const g = ctx.createRadialGradient(w * 0.7, h * 1.05, h * 0.1, w * 0.7, h * 1.05, h * 0.75);
    g.addColorStop(0, "#60a5fa");
    g.addColorStop(0.6, "#1d4ed8");
    g.addColorStop(1, "rgba(29,78,216,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(w * 0.7, h * 1.05, h * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function silhuetaDaCidade(ctx, w, h, { ceu, predio, janela, chance }) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  ceu.forEach((c, i) => g.addColorStop(i / (ceu.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  let a = 11;
  const s = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  for (let x = 0; x < w;) {
    const largura = 30 + s() * 70;
    const altura = h * (0.25 + s() * 0.55);
    ctx.fillStyle = predio;
    ctx.fillRect(x, h - altura, largura, altura);
    for (let jy = h - altura + 8; jy < h - 6; jy += 12) {
      for (let jx = x + 6; jx < x + largura - 6; jx += 10) {
        if (s() < chance) { ctx.fillStyle = janela[Math.floor(s() * janela.length)]; ctx.fillRect(jx, jy, 5, 6); }
      }
    }
    x += largura + 4;
  }
}

function tijolos(ctx, w, h) {
  ctx.fillStyle = "#5b2a1f";
  ctx.fillRect(0, 0, w, h);
  const altura = 22, largura = 56;
  for (let y = 0, linha = 0; y < h; y += altura, linha++) {
    for (let x = linha % 2 ? -largura / 2 : 0; x < w; x += largura) {
      const tom = 120 + ((x * 7 + y * 3) % 40);
      ctx.fillStyle = `rgb(${tom + 30}, ${Math.round(tom * 0.45)}, ${Math.round(tom * 0.32)})`;
      ctx.fillRect(x + 2, y + 2, largura - 4, altura - 4);
    }
  }
}

function letreiro(ctx, w, h, texto, cor) {
  ctx.fillStyle = "#07020f";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = cor;
  ctx.lineWidth = 8;
  ctx.shadowColor = cor;
  ctx.shadowBlur = 24;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.fillStyle = cor;
  ctx.font = `900 ${Math.round(h * 0.5)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, w / 2, h / 2 + 4);
}

/**
 * Monta o ambiente do cenário: piso, paredes, luz e a decoração própria. Devolve { grupo, animar(t), descartar() }.
 * `p`: as peças (caixa, material); `neon`: o material de neon, que muda de cor com o cenário.
 */
function montarAmbiente(id, p, neon) {
  const c = CENARIOS_3D[id] || CENARIOS_3D.neon;
  const g = new THREE.Group();
  const texturas = [];
  const anima = [];
  const tex = (...a) => { const t = texturaDeCanvas(...a); texturas.push(t); return t; };
  neon.color.set(c.acento);
  neon.emissive.set(c.acento);

  // piso, grade e paredes
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(22, 18), new THREE.MeshStandardMaterial({ color: c.piso, roughness: c.brilhoPiso[0], metalness: c.brilhoPiso[1] }));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  g.add(piso);
  if (c.grade) {
    const grade = new THREE.GridHelper(22, 22, c.grade[0], c.grade[1]);
    grade.position.y = 0.005;
    g.add(grade);
  }
  const parede = new THREE.MeshStandardMaterial({ color: c.parede, roughness: 0.85 });
  g.add(p.caixa(22, 6.4, 0.3, parede, 0, 3.2, -6));
  for (const x of [-10.8, 10.8]) g.add(p.caixa(0.3, 6.4, 14, parede, x, 3.2, 1));
  g.add(p.caixa(22, 0.08, 0.06, neon, 0, 0.25, -5.83));
  g.add(p.caixa(22, 0.08, 0.06, neon, 0, 6.0, -5.83));
  for (const x of [-10.8, 10.8]) g.add(p.caixa(0.06, 0.08, 14, neon, x - Math.sign(x) * 0.17, 0.25, 1));

  const plano = (w, h, mapa, x, y, z, ry = 0, basico = true) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basico ? new THREE.MeshBasicMaterial({ map: mapa }) : new THREE.MeshStandardMaterial({ map: mapa, roughness: 0.9 }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
    return m;
  };

  if (id === "datacenter") {
    // fileiras de servidores nas paredes, com os LEDs piscando
    const rack = new THREE.MeshStandardMaterial({ color: "#151c27", roughness: 0.5, metalness: 0.6 });
    const leds = ["#22c55e", "#38bdf8", "#f59e0b"].map((cor) => new THREE.MeshBasicMaterial({ color: cor }));
    const geoLed = new THREE.BoxGeometry(0.06, 0.04, 0.02);
    const colocar = (x, z, ry) => {
      const r = p.caixa(0.9, 2.6, 0.8, rack, x, 1.3, z);
      r.rotation.y = ry;
      g.add(r);
      for (let i = 0; i < 14; i++) {
        const led = new THREE.Mesh(geoLed, leds[i % 3]);
        const lado = new THREE.Vector3(((i % 4) - 1.5) * 0.18, 0.3 + Math.floor(i / 4) * 0.5, 0.41).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
        led.position.set(x + lado.x, lado.y, z + lado.z);
        led.rotation.y = ry;
        g.add(led);
        anima.push((t) => { led.visible = Math.sin(t * (2 + (i % 5)) + x * 3 + i) > -0.4; });
      }
    };
    for (const x of [-9.2, -8.2, -7.2, 7.2, 8.2, 9.2]) colocar(x, -5.3, 0);
    for (const z of [-3.6, -2.6, 3.4, 4.4, 5.4]) { colocar(-10.2, z, Math.PI / 2); colocar(10.2, z, -Math.PI / 2); }
    texturas.push({ dispose: () => { geoLed.dispose(); rack.dispose(); leds.forEach((m) => m.dispose()); } });
  }

  if (id === "orbital") {
    // as janelas redondas com as estrelas (e a Terra) e os painéis com faixa ciano
    const estrelas = tex(512, 512, (ctx, w, h) => ceuDeEstrelas(ctx, w, h, true));
    const estrelas2 = tex(512, 512, (ctx, w, h) => ceuDeEstrelas(ctx, w, h, false));
    for (const [x, mapa] of [[-7, estrelas], [7, estrelas2]]) {
      const j = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({ map: mapa }));
      j.position.set(x, 3.4, -5.83);
      g.add(j);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.12, 10, 48), new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.7, roughness: 0.3 }));
      aro.position.set(x, 3.4, -5.8);
      g.add(aro);
    }
    for (const x of [-10.62, 10.62]) {
      plano(10, 2.6, estrelas2, x, 3.4, 1, x < 0 ? Math.PI / 2 : -Math.PI / 2);
      for (const y of [1.9, 4.9]) g.add(p.caixa(0.05, 0.06, 10, neon, x, y, 1));
    }
  }

  if (id === "loft") {
    // a parede de tijolinho, o janelão com o pôr do sol, plantas e luminárias
    const tijolo = tex(1024, 512, tijolos);
    tijolo.wrapS = tijolo.wrapT = THREE.RepeatWrapping;
    tijolo.repeat.set(2, 1);
    plano(21.6, 6.3, tijolo, 0, 3.2, -5.84, 0, false);
    const porDoSol = tex(1024, 384, (ctx, w, h) => silhuetaDaCidade(ctx, w, h, { ceu: ["#4c1d95", "#db2777", "#f97316", "#fcd34d"], predio: "#2a1726", janela: ["#fde68a", "#fbbf24"], chance: 0.12 }));
    for (const x of [-10.62, 10.62]) {
      plano(9, 3.4, porDoSol, x, 3.1, 1, x < 0 ? Math.PI / 2 : -Math.PI / 2);
      g.add(p.caixa(0.08, 0.12, 9.2, "#1f2937", x, 1.38, 1));
      g.add(p.caixa(0.08, 0.12, 9.2, "#1f2937", x, 4.82, 1));
    }
    const vaso = new THREE.MeshStandardMaterial({ color: "#e7e5e4", roughness: 0.8 });
    const folha = new THREE.MeshStandardMaterial({ color: "#4d7c0f", roughness: 0.9, flatShading: true });
    for (const [x, z] of [[-9.6, -5.2], [9.6, -5.2], [-9.6, 5.8], [9.6, 5.8], [-6.4, -5.2], [6.4, -5.2]]) {
      g.add(p.malha(new THREE.CylinderGeometry(0.32, 0.24, 0.6, 12), vaso, x, 0.3, z));
      const copa = p.malha(new THREE.IcosahedronGeometry(0.62, 0), folha, x, 1.05, z);
      copa.scale.y = 1.3;
      g.add(copa);
    }
    for (const x of [-4.8, -1.6, 1.6, 4.8]) {
      g.add(p.caixa(0.02, 1.4, 0.02, "#1f2937", x, 5.6, 1.25));
      const lampada = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.36, 16, 1, true), new THREE.MeshStandardMaterial({ color: "#1f2937", side: THREE.DoubleSide }));
      lampada.position.set(x, 4.8, 1.25);
      g.add(lampada);
      const luz = new THREE.PointLight("#ffb86b", 3.2, 7, 1.6);
      luz.position.set(x, 4.5, 1.25);
      g.add(luz);
    }
  }

  if (id === "cyber") {
    // a cidade de noite nas paredes, os letreiros e a chuva
    const noite = tex(1024, 384, (ctx, w, h) => silhuetaDaCidade(ctx, w, h, { ceu: ["#05010d", "#1e0b3a", "#3b0764"], predio: "#0b0618", janela: ["#22d3ee", "#e879f9", "#a78bfa"], chance: 0.22 }));
    for (const x of [-10.62, 10.62]) plano(13, 4.6, noite, x, 3.2, 1, x < 0 ? Math.PI / 2 : -Math.PI / 2);
    for (const [texto, cor, x, y, w] of [["CODE", "#e879f9", -7, 3.6, 3.2], ["404", "#22d3ee", 7, 4.2, 2.6], ["BYTE BAR", "#a78bfa", 7, 2.4, 3.4]]) {
      plano(w, w * 0.36, tex(512, 184, (ctx, cw, ch) => letreiro(ctx, cw, ch, texto, cor)), x, y, -5.82);
      const luz = new THREE.PointLight(cor, 4, 6, 1.8);
      luz.position.set(x, y, -5);
      g.add(luz);
    }
    const qtd = 700;
    const pos = new Float32Array(qtd * 3);
    for (let i = 0; i < qtd; i++) { pos[i * 3] = (Math.random() - 0.5) * 21; pos[i * 3 + 1] = Math.random() * 6; pos[i * 3 + 2] = (Math.random() - 0.5) * 13 + 1; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const chuva = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#93c5fd", size: 0.05, transparent: true, opacity: 0.55 }));
    g.add(chuva);
    let antes = 0;
    anima.push((t) => {
      const dt = Math.min(0.05, t - antes);
      antes = t;
      for (let i = 0; i < qtd; i++) { pos[i * 3 + 1] -= dt * 7; if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 6; }
      geo.attributes.position.needsUpdate = true;
    });
  }

  return {
    grupo: g, cor: c,
    animar: (t) => { for (const f of anima) f(t); },
    descartar: () => {
      g.traverse((o) => { o.geometry?.dispose(); if (o.material && o.material !== neon) { o.material.map?.dispose(); o.material.dispose(); } });
      for (const t of texturas) t.dispose();
    },
  };
}

// ------------------------------------------------------------------ as telas

function desenharMonitor(canvas, p) {
  const c = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const t = TELA[p?.etapa];
  c.fillStyle = "#0b0e12";
  c.fillRect(0, 0, w, h);
  if (!t || p.eliminado) {
    c.fillStyle = "#2a3038";
    c.font = "bold 22px sans-serif";
    c.fillText(p?.eliminado ? "ELIMINADO" : "EM ESPERA", 14, h / 2 + 8);
    return;
  }
  // "linhas de código" de mentira, com a cor da etapa salpicada
  for (let i = 0; i < 7; i++) {
    c.fillStyle = i % 3 === 0 ? t.cor : "rgba(255,255,255,0.2)";
    c.fillRect(14 + (i % 2) * 16, 14 + i * 13, 50 + ((i * 41) % 130), 6);
  }
  c.fillStyle = t.cor;
  c.fillRect(0, h - 38, w, 38);
  c.fillStyle = "#0d1a02";
  c.font = "bold 21px sans-serif";
  const extra = p.testes ? ` ${p.testes.passados}/${p.testes.total}` : "";
  c.fillText(`${t.rotulo}${extra}`, 12, h - 12);
}

function desenharTelao(canvas, { titulo, subtitulo }, acento = "#84cc16") {
  const c = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#0d1309");
  g.addColorStop(1, "#141a22");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = acento;
  c.globalAlpha = 0.6;
  c.lineWidth = 6;
  c.strokeRect(8, 8, w - 16, h - 16);
  c.globalAlpha = 1;
  c.fillStyle = acento;
  c.font = "900 92px sans-serif";
  c.textAlign = "center";
  c.fillText("BOOTCAMP", w / 2, h * 0.44);
  c.fillStyle = "#f2f5ee";
  c.font = "bold 40px sans-serif";
  c.fillText(String(titulo || "").slice(0, 40), w / 2, h * 0.68);
  c.fillStyle = "rgba(242,245,238,0.7)";
  c.font = "600 30px sans-serif";
  c.fillText(String(subtitulo || "").slice(0, 56), w / 2, h * 0.85);
}

/**
 * O caminho de onde o boneco está até o destino, sempre pelo corredor entre as fileiras (ninguém atravessa as
 * baias): sai para o corredor, anda por ele até a altura do destino e segue até lá.
 */
function caminhoAte(pos, destino) {
  return [
    new THREE.Vector3(pos.x, 0, pos.z),
    new THREE.Vector3(pos.x, 0, CORREDOR_Z),
    new THREE.Vector3(destino.x, 0, CORREDOR_Z),
    new THREE.Vector3(destino.x, 0, destino.z),
  ];
}

function placaDeSaida(ctx, w, h) {
  ctx.fillStyle = "#14532d";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#4ade80";
  ctx.font = "900 70px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SAÍDA  ➜", w / 2, h / 2 + 4);
}

export default function Escritorio3D({ participantes, jurados, apresentadora = null, campeaoId = null, telao, avaliando = false, cenario = "neon", palco = null, humores = null, final = null, aoEscolher, aoFalhar }) {
  const caixa = useRef(null);
  const moldes = useRef(null);
  const api = useRef(null);
  const rotulos = useRef({});
  const ultimo = useRef({ aoEscolher });
  ultimo.current = { aoEscolher };

  // ---- a cena: monta uma vez
  useEffect(() => {
    const el = caixa.current;
    let renderizador;
    try {
      renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      if (!renderizador.getContext()) throw new Error("sem WebGL");
    } catch {
      aoFalhar?.();
      return undefined;
    }
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let sujo = true, quadroId = 0, visivel = true;
    renderizador.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderizador.shadowMap.enabled = true;
    renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    renderizador.domElement.setAttribute("aria-hidden", "true");
    el.prepend(renderizador.domElement);

    const cena = new THREE.Scene();
    cena.fog = new THREE.Fog("#0b0e12", 16, 30);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    const vista = {
      geral: { pos: new THREE.Vector3(0, 8.2, 12.2), olhar: new THREE.Vector3(0, 0.95, -0.3) },
      palco: { pos: new THREE.Vector3(0, 4.2, 3.6), olhar: new THREE.Vector3(0, 1.25, -3.3) },
      // a despedida: a câmera vira para a porta de saída, onde a apresentadora espera
      saida: { pos: new THREE.Vector3(4.6, 3.2, 6.4), olhar: new THREE.Vector3(8.7, 1.1, 1.3) },
      // a grande final: um pouco mais aberta, para caber a arquibancada dos dois lados
      final: { pos: new THREE.Vector3(0, 7.6, 14.2), olhar: new THREE.Vector3(0, 1.3, 0.4) },
    };
    const olharAtual = vista.geral.olhar.clone();
    camera.position.copy(vista.geral.pos);
    camera.lookAt(olharAtual);

    cena.add(new THREE.AmbientLight("#ffffff", 0.35));
    const hemi = new THREE.HemisphereLight("#d6e6ff", "#141910", 1.05);
    cena.add(hemi);
    const luz = new THREE.DirectionalLight("#ffffff", 1.6);
    luz.position.set(5, 12, 8);
    luz.castShadow = true;
    luz.shadow.mapSize.set(1024, 1024);
    Object.assign(luz.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
    luz.shadow.bias = -0.0008;
    cena.add(luz);
    const luzDosJurados = new THREE.PointLight("#9be12f", 6, 9, 1.6);
    luzDosJurados.position.set(0, 3.4, -3);
    cena.add(luzDosJurados);
    // o holofote da avaliação ao vivo, em cima de quem está no palco
    const holofote = new THREE.SpotLight("#ffffff", 0, 9, 0.42, 0.6, 1.2);
    holofote.position.set(PALCO.x, 6, PALCO.z + 1.2);
    holofote.target.position.set(PALCO.x, 0, PALCO.z);
    cena.add(holofote, holofote.target);

    const materiais = new Map();
    const mat = (cor, extra = {}) => {
      const chave = `${cor}|${JSON.stringify(extra)}`;
      if (!materiais.has(chave)) materiais.set(chave, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7, metalness: 0.15, ...extra }));
      return materiais.get(chave);
    };
    const malha = (geo, material, x, y, z) => {
      const m = new THREE.Mesh(geo, typeof material === "string" ? mat(material) : material);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const caixaDe = (w, h, d, material, x, y, z) => malha(new THREE.BoxGeometry(w, h, d), material, x, y, z);
    const pecas = { caixa: caixaDe, malha, mat };
    const neon = new THREE.MeshStandardMaterial({ color: "#84cc16", emissive: "#84cc16", emissiveIntensity: 1.2, roughness: 0.7 });

    const estudio = new THREE.Group();
    cena.add(estudio);

    // ---- o ambiente (o cenário), trocado sem remontar o resto
    let ambiente = null;
    function definirCenario(id) {
      if (ambiente) { estudio.remove(ambiente.grupo); ambiente.descartar(); }
      ambiente = montarAmbiente(id, pecas, neon);
      estudio.add(ambiente.grupo);
      renderizador.setClearColor(ambiente.cor.fundo);
      cena.fog.color.set(ambiente.cor.fundo);
      hemi.color.set(ambiente.cor.hemi[0]);
      hemi.groundColor.set(ambiente.cor.hemi[1]);
      hemi.intensity = ambiente.cor.hemi[2];
      luzDosJurados.color.set(ambiente.cor.luzJurados);
      desenharTelao(telaoCanvas, ultimoTelao, ambiente.cor.acento);
      telaoTex.needsUpdate = true;
      sujo = true;
    }

    // o telão com a rodada
    const telaoCanvas = document.createElement("canvas");
    telaoCanvas.width = 1024;
    telaoCanvas.height = 384;
    let ultimoTelao = {};
    const telaoTex = new THREE.CanvasTexture(telaoCanvas);
    telaoTex.colorSpace = THREE.SRGBColorSpace;
    const telaoMalha = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshBasicMaterial({ map: telaoTex }));
    telaoMalha.position.set(0, 3.75, -5.82);
    estudio.add(telaoMalha);
    estudio.add(caixaDe(8.3, 3.3, 0.1, COR.mesa, 0, 3.75, -5.9));

    // a bancada (mais baixa) e o palco dos jurados atrás dela
    estudio.add(caixaDe(7.2, ALTURA_DO_PALCO, 1.6, COR.mesaClara, 0, ALTURA_DO_PALCO / 2, Z_DOS_JURADOS - 0.1));
    estudio.add(caixaDe(7.2, 0.05, 0.05, neon, 0, ALTURA_DO_PALCO, Z_DOS_JURADOS + 0.7));
    estudio.add(caixaDe(6.4, 0.85, 1.0, COR.bancada, 0, 0.425, -3.7));
    estudio.add(caixaDe(6.6, 0.07, 1.2, COR.mesaClara, 0, 0.89, -3.7));
    estudio.add(caixaDe(6.4, 0.06, 0.04, neon, 0, 0.68, -3.18));
    for (const x of POS_DOS_JURADOS) estudio.add(caixaDe(0.5, 0.06, 0.32, COR.ouro, x, 0.95, -3.45));

    // a porta de saída no fim do corredor (parede da direita) e a placa acesa em cima
    const porta = new THREE.Group();
    porta.position.set(10.62, 0, CORREDOR_Z);
    porta.add(caixaDe(0.1, 2.4, 1.6, "#0b0e12", 0, 1.2, 0));
    porta.add(caixaDe(0.16, 2.5, 0.1, COR.metal, 0, 1.25, -0.85));
    porta.add(caixaDe(0.16, 2.5, 0.1, COR.metal, 0, 1.25, 0.85));
    porta.add(caixaDe(0.16, 0.1, 1.8, COR.metal, 0, 2.5, 0));
    const placaTex = texturaDeCanvas(512, 128, placaDeSaida);
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: placaTex }));
    placa.position.set(-0.1, 2.85, 0);
    placa.rotation.y = -Math.PI / 2;
    porta.add(placa);
    const luzDaSaida = new THREE.PointLight("#4ade80", 2.5, 5, 1.6);
    luzDaSaida.position.set(-0.8, 2.6, 0);
    porta.add(luzDaSaida);
    estudio.add(porta);

    // ---- a grande final: a arquibancada nos dois lados, o confete dourado e os holofotes nos dois finalistas
    const arquibancada = new THREE.Group();
    const ouroAceso = mat(COR.ouro, { emissive: COR.ouro, emissiveIntensity: 0.7 });
    for (const lado of [-1, 1]) {
      for (const d of DEGRAUS) arquibancada.add(caixaDe(1.0, d.h, 5.2, "#2a2f38", lado * d.dx, d.h / 2, 1.4));
      arquibancada.add(caixaDe(0.06, 0.06, 5.2, ouroAceso, lado * (DEGRAUS[0].dx - 0.5), DEGRAUS[0].h + 0.02, 1.4));
    }
    arquibancada.visible = false;
    estudio.add(arquibancada);
    const qtdConfete = 320;
    const posConfete = new Float32Array(qtdConfete * 3);
    const corConfete = new Float32Array(qtdConfete * 3);
    const paleta = ["#f0be45", "#84cc16", "#e879f9", "#38bdf8", "#ffffff"].map((c) => new THREE.Color(c));
    for (let i = 0; i < qtdConfete; i++) {
      posConfete.set([(Math.random() - 0.5) * 16, Math.random() * 6, (Math.random() - 0.5) * 10 + 0.5], i * 3);
      const c = paleta[i % paleta.length];
      corConfete.set([c.r, c.g, c.b], i * 3);
    }
    const geoConfete = new THREE.BufferGeometry();
    geoConfete.setAttribute("position", new THREE.BufferAttribute(posConfete, 3));
    geoConfete.setAttribute("color", new THREE.BufferAttribute(corConfete, 3));
    const confete = new THREE.Points(geoConfete, new THREE.PointsMaterial({ size: 0.1, vertexColors: true }));
    confete.visible = false;
    estudio.add(confete);
    const holofotesDaFinal = POS_DA_FINAL.map(([x, z]) => {
      const s = new THREE.SpotLight("#ffd77a", 0, 10, 0.5, 0.6, 1.2);
      s.position.set(x, 6.5, z + 1.5);
      s.target.position.set(x, 0, z);
      estudio.add(s, s.target);
      return s;
    });

    // ---- os bonecos de papel (competidores e jurados), sempre de frente para a câmera
    const geoPapel = new THREE.PlaneGeometry(1.5, 1.5);
    geoPapel.translate(0, 0.75, 0);
    const bonecos = new Map(); // id → { malha, material, base, y0, escala, caminho, trecho, andando }
    function boneco(id, x, z, { escala = 1, y0 = 0 } = {}) {
      if (bonecos.has(id)) return bonecos.get(id);
      const material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(document.createElement("canvas")), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
      material.visible = false;
      const m = new THREE.Mesh(geoPapel, material);
      m.position.set(x, y0, z);
      m.scale.setScalar(escala);
      m.castShadow = true;
      estudio.add(m);
      const b = { malha: m, material, base: { x, z }, y0, escala, caminho: null, andando: false, digitando: false };
      bonecos.set(id, b);
      return b;
    }
    IDS_DOS_JURADOS.forEach((id, i) => boneco(`jurado:${id}`, POS_DOS_JURADOS[i], Z_DOS_JURADOS, { escala: 1.45, y0: ALTURA_DO_PALCO }));
    boneco("apresentadora", POS_DA_APRESENTADORA.x, POS_DA_APRESENTADORA.z, { escala: 1.2 });

    /** Põe o boneco para andar por um caminho (ou teleporta, com "reduzir movimento"); `aoChegar` roda no fim. */
    function andar(b, pontos, aoChegar = null) {
      b.aoChegar = aoChegar;
      if (semMovimento) {
        const fim = pontos[pontos.length - 1];
        b.malha.position.x = fim.x;
        b.malha.position.z = fim.z;
        b.caminho = null;
        aoChegar?.();
        sujo = true;
        return;
      }
      b.caminho = { pontos, i: 0 };
      b.andando = true;
    }

    // ---- as baias
    const baias = [];
    POSICOES.forEach(([x, z], i) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.add(caixaDe(2.2, 0.08, 1.0, COR.mesaClara, 0, 0.78, 0));
      for (const [dx, dz] of [[-1, -0.42], [1, -0.42], [-1, 0.42], [1, 0.42]]) g.add(caixaDe(0.06, 0.76, 0.06, COR.metal, dx, 0.38, dz));
      // a divisória de vidro, baixa e sem neon: vista do alto, a faixa acesa cortava os avatares da fileira de trás
      const vidro = new THREE.MeshStandardMaterial({ color: COR.vidro, transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.1 });
      const fundo = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 0.04), vidro);
      fundo.position.set(0, 1.1, -0.52);
      g.add(fundo);
      const telaCanvas = document.createElement("canvas");
      telaCanvas.width = 256;
      telaCanvas.height = 160;
      const telaTex = new THREE.CanvasTexture(telaCanvas);
      telaTex.colorSpace = THREE.SRGBColorSpace;
      g.add(caixaDe(0.98, 0.62, 0.05, COR.mesa, -0.35, 1.22, -0.25));
      const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.56), new THREE.MeshBasicMaterial({ map: telaTex }));
      tela.position.set(-0.35, 1.22, -0.22);
      g.add(tela);
      g.add(caixaDe(0.08, 0.3, 0.08, COR.metal, -0.35, 0.95, -0.28));
      g.add(caixaDe(0.6, 0.03, 0.2, COR.cadeira, -0.35, 0.83, 0.12));
      g.add(caixaDe(0.55, 0.08, 0.55, COR.cadeira, -0.35, 0.5, 0.75));
      g.add(caixaDe(0.55, 0.6, 0.08, COR.cadeira, -0.35, 0.82, 1.02));
      const ouro = mat(COR.ouro, { metalness: 0.8, roughness: 0.25, emissive: COR.ouro, emissiveIntensity: 0.25 });
      const trofeu = new THREE.Group();
      trofeu.add(caixaDe(0.22, 0.06, 0.22, ouro, 0, 0, 0));
      const taca = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.06, 0.26, 12), ouro);
      taca.position.y = 0.17;
      trofeu.add(taca);
      trofeu.position.set(0.55, 0.86, -0.2);
      trofeu.visible = false;
      g.add(trofeu);
      // o piso colorido do time, na prova em equipe
      const placa = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9), new THREE.MeshBasicMaterial({ color: "#2563eb", transparent: true, opacity: 0.32 }));
      placa.rotation.x = -Math.PI / 2;
      placa.position.set(0.15, 0.012, 0.3);
      placa.visible = false;
      g.add(placa);
      g.traverse((m) => { m.userData.baia = i; });
      estudio.add(g);
      baias.push({ grupo: g, telaCanvas, telaTex, tela, trofeu, fundo, placa, participante: null });
    });

    // ---- girar arrastando; tocar numa baia escolhe o competidor
    let arrastando = false, inicioX = 0, giroInicial = 0, moveu = false;
    const raio = new THREE.Raycaster();
    const ponteiro = new THREE.Vector2();
    const canvas = renderizador.domElement;
    function aoApertar(e) { arrastando = true; moveu = false; inicioX = e.clientX; giroInicial = estudio.rotation.y; canvas.setPointerCapture?.(e.pointerId); }
    function aoMover(e) {
      if (!arrastando) return;
      const dx = e.clientX - inicioX;
      if (Math.abs(dx) > 4) moveu = true;
      estudio.rotation.y = Math.max(-0.7, Math.min(0.7, giroInicial + dx * 0.005));
      sujo = true;
    }
    function aoSoltar(e) {
      if (!arrastando) return;
      arrastando = false;
      if (moveu) return;
      const r = canvas.getBoundingClientRect();
      ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raio.setFromCamera(ponteiro, camera);
      const alvo = raio.intersectObjects(baias.map((b) => b.grupo), true).find((h) => h.object.userData.baia !== undefined);
      const p = alvo ? baias[alvo.object.userData.baia].participante : null;
      if (p) ultimo.current.aoEscolher?.(p.id);
    }
    canvas.addEventListener("pointerdown", aoApertar);
    canvas.addEventListener("pointermove", aoMover);
    canvas.addEventListener("pointerup", aoSoltar);
    canvas.addEventListener("pointercancel", () => { arrastando = false; });

    // ---- tamanho
    function enquadrar() {
      const w = el.clientWidth || 600, h = el.clientHeight || 380;
      renderizador.setSize(w, h, false);
      camera.aspect = w / h;
      // no celular (retrato) a câmera recua para caberem as 4 baias da fileira
      const retrato = w < h * 1.2;
      vista.geral.pos.set(0, retrato ? 11 : 8.2, retrato ? 16.5 : 12.2);
      vista.palco.pos.set(0, retrato ? 5 : 4.2, retrato ? 6.4 : 3.6);
      vista.saida.pos.set(retrato ? 3.2 : 4.6, retrato ? 4 : 3.2, retrato ? 9 : 6.4);
      vista.final.pos.set(0, retrato ? 11 : 7.6, retrato ? 19 : 14.2);
      camera.updateProjectionMatrix();
      sujo = true;
    }
    const observa = new ResizeObserver(enquadrar);
    observa.observe(el);
    enquadrar();
    const observaVisao = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) sujo = true; });
    observaVisao.observe(el);

    // ---- os rótulos em HTML acompanham os bonecos
    const v = new THREE.Vector3();
    function posicionar(n, x, y, z) {
      v.set(x, y, z).applyMatrix4(estudio.matrixWorld).project(camera);
      n.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * el.clientWidth}px, ${((1 - v.y) / 2) * el.clientHeight}px)`;
    }
    function posicionarRotulos() {
      for (const [id, b] of bonecos) {
        const n = rotulos.current[id];
        // o dos jurados fica colado na cabeça (mais alto, invadia a legenda do telão)
        const folga = id.startsWith("jurado:") ? -0.05 : 0.2;
        if (n) posicionar(n, b.malha.position.x, b.malha.position.y + 1.5 * b.malha.scale.y + folga, b.malha.position.z);
      }
    }

    // ---- o laço
    const relogio = new THREE.Clock();
    let antes = 0;
    // local: "bancada" (o code review), "saida" (a entrevista de despedida na porta) ou "fora" (foi embora);
    // falando: quem fala agora na despedida ("apresentadora" ou "competidor")
    const estado = { noPalco: null, juradoAtivo: null, local: null, falando: null, final: null };
    const estaFalando = (id) => (id.startsWith("jurado:") && estado.juradoAtivo && id === `jurado:${estado.juradoAtivo}`)
      || (id === "apresentadora" && estado.falando === "apresentadora")
      || (id === estado.noPalco && estado.falando === "competidor");
    function quadro() {
      quadroId = requestAnimationFrame(quadro);
      if (!visivel) return;
      const t = relogio.getElapsedTime();
      // tudo anda pelo tempo, não pelos quadros: num aparelho lento a caminhada e a câmera não ficam mais lentas
      const dt = Math.min(0.1, t - antes);
      antes = t;
      const suave = (taxa) => 1 - Math.pow(1 - taxa, dt * 60);

      // quem está andando segue o caminho
      for (const b of bonecos.values()) {
        if (!b.caminho) continue;
        const { pontos } = b.caminho;
        const alvo = pontos[b.caminho.i + 1];
        if (!alvo) {
          b.caminho = null;
          b.andando = false;
          const chegou = b.aoChegar;
          b.aoChegar = null;
          chegou?.();
          continue;
        }
        const pos = b.malha.position;
        const dx = alvo.x - pos.x, dz = alvo.z - pos.z;
        const dist = Math.hypot(dx, dz);
        const passo = VELOCIDADE * dt;
        if (dist <= passo) { pos.x = alvo.x; pos.z = alvo.z; b.caminho.i++; } else { pos.x += (dx / dist) * passo; pos.z += (dz / dist) * passo; }
        sujo = true;
      }

      if (!semMovimento) {
        for (const [id, b] of bonecos) {
          const falando = estaFalando(id);
          const alvoEscala = b.escala * (falando ? 1.14 : 1) * (id === estado.noPalco && !b.andando ? 1.12 : 1);
          b.malha.scale.setScalar(THREE.MathUtils.lerp(b.malha.scale.x, alvoEscala, suave(0.15)));
          b.malha.position.y = b.y0 + (b.andando ? Math.abs(Math.sin(t * 11)) * 0.12
            : b.torcendo ? Math.abs(Math.sin(t * 5 + b.base.z * 2 + b.base.x)) * 0.24
            : falando ? Math.abs(Math.sin(t * 6)) * 0.06
            : b.digitando ? Math.abs(Math.sin(t * 7 + b.base.x)) * 0.05
            : Math.sin(t * 1.6 + b.base.x) * 0.015);
        }
        if (estado.final) {
          for (let i = 0; i < qtdConfete; i++) {
            posConfete[i * 3 + 1] -= dt * (0.9 + (i % 5) * 0.25);
            posConfete[i * 3] += Math.sin(t * 2 + i) * dt * 0.3;
            if (posConfete[i * 3 + 1] < 0) posConfete[i * 3 + 1] = 6;
          }
          geoConfete.attributes.position.needsUpdate = true;
        }
        luzDosJurados.intensity = (api.current?.avaliando ? 9 : 6) + Math.sin(t * 2) * 0.6;
        ambiente?.animar(t);
        sujo = true;
      } else {
        for (const [id, b] of bonecos) b.malha.scale.setScalar(b.escala * (estaFalando(id) ? 1.14 : 1));
      }

      // a câmera vai (e volta) do palco, e vira para a porta na despedida
      const alvoVista = !estado.noPalco ? (estado.final ? vista.final : vista.geral) : estado.local === "bancada" ? vista.palco : vista.saida;
      for (const s of holofotesDaFinal) s.intensity = estado.final && !estado.noPalco ? 30 : 0;
      if (semMovimento) { camera.position.copy(alvoVista.pos); olharAtual.copy(alvoVista.olhar); }
      else if (camera.position.distanceTo(alvoVista.pos) > 0.01 || olharAtual.distanceTo(alvoVista.olhar) > 0.01) {
        camera.position.lerp(alvoVista.pos, suave(0.06));
        olharAtual.lerp(alvoVista.olhar, suave(0.06));
        sujo = true;
      }
      holofote.intensity = THREE.MathUtils.lerp(holofote.intensity, estado.noPalco && estado.local === "bancada" ? 40 : 0, semMovimento ? 1 : suave(0.1));

      if (!sujo) return;
      sujo = false;
      camera.lookAt(olharAtual);
      // o lookAt do three já desconta o giro do estúdio (o pai); só precisa da matriz dele em dia
      estudio.updateMatrixWorld();
      for (const b of bonecos.values()) b.malha.lookAt(camera.position.x, b.malha.position.y, camera.position.z);
      renderizador.render(cena, camera);
      posicionarRotulos();
    }

    definirCenario("neon");
    quadro();

    api.current = {
      avaliando: false,
      definirCenario,
      definirParticipantes(lista, campeao) {
        const porBaia = new Map(lista.map((p) => [p.baia, p]));
        baias.forEach((b, i) => {
          const p = porBaia.get(i) || null;
          b.participante = p;
          desenharMonitor(b.telaCanvas, p);
          b.telaTex.needsUpdate = true;
          b.trofeu.visible = Boolean(p && p.id === campeao);
          b.fundo.material.opacity = p && !p.eliminado ? 0.16 : 0.06;
          // a prova em equipe: o piso da baia na cor do time
          b.placa.visible = Boolean(p?.equipe);
          if (p?.equipe) b.placa.material.color.set(COR_DO_TIME[p.equipe] || "#2563eb");
          const [x, z] = POSICOES[i];
          if (p) {
            const bo = boneco(p.id, x + 0.6, z + 0.55);
            bo.digitando = p.etapa === "codigo" && !p.eliminado;
            bo.eliminado = p.eliminado;
            // na final, quem está na arquibancada torce aceso (não apagado como eliminado)
            const naArquibancada = estado.final && !estado.final.includes(p.id);
            bo.malha.material.opacity = p.eliminado && !naArquibancada && estado.noPalco !== p.id ? 0.45 : 1;
          }
        });
        sujo = true;
      },
      /** A grande final: as baias dos dois finalistas no centro e todos os outros na arquibancada, torcendo. */
      definirFinal(dados) {
        const ids = dados?.finalistas?.length ? dados.finalistas : null;
        estado.final = ids;
        arquibancada.visible = Boolean(ids);
        confete.visible = Boolean(ids) && !semMovimento;
        porta.visible = !ids;
        const host = bonecos.get("apresentadora");
        const hp = ids ? APRESENTADORA_NA_FINAL : POS_DA_APRESENTADORA;
        host.base = { x: hp.x, z: hp.z };
        host.malha.position.set(hp.x, host.y0, hp.z);
        let assento = 0;
        baias.forEach((b, i) => {
          const p = b.participante;
          const [x, z] = POSICOES[i];
          const naFinal = ids && p ? ids.indexOf(p.id) : -1;
          if (!ids) { b.grupo.position.set(x, 0, z); b.grupo.visible = true; }
          else if (naFinal >= 0) { b.grupo.position.set(POS_DA_FINAL[naFinal][0], 0, POS_DA_FINAL[naFinal][1]); b.grupo.visible = true; }
          else b.grupo.visible = false;
          const bo = p && bonecos.get(p.id);
          if (!bo) return;
          if (!ids) { bo.base = { x: x + 0.6, z: z + 0.55 }; bo.y0 = 0; bo.torcendo = false; }
          else if (naFinal >= 0) { bo.base = { x: POS_DA_FINAL[naFinal][0] + 0.6, z: POS_DA_FINAL[naFinal][1] + 0.55 }; bo.y0 = 0; bo.torcendo = false; }
          else {
            const a = ASSENTOS[assento++ % ASSENTOS.length];
            bo.base = { x: a.x, z: a.z };
            bo.y0 = a.y;
            bo.torcendo = true;
            bo.malha.material.opacity = 1;
          }
          if (!bo.caminho && estado.noPalco !== p.id) bo.malha.position.set(bo.base.x, bo.y0, bo.base.z);
        });
        sujo = true;
      },
      definirTelao(dados) {
        ultimoTelao = dados || {};
        desenharTelao(telaoCanvas, ultimoTelao, ambiente?.cor.acento);
        telaoTex.needsUpdate = true;
        sujo = true;
      },
      definirFolha(id, folha) {
        const b = bonecos.get(id);
        if (!b) return;
        b.material.map.image = folha;
        b.material.map.needsUpdate = true;
        b.material.visible = true;
        sujo = true;
      },
      /**
       * O palco da avaliação ao vivo: quem está na cena, qual jurado fala e onde ele está — "bancada" (o code
       * review), "saida" (a entrevista de despedida com a apresentadora, na porta) ou "fora" (foi embora).
       */
      definirPalco(id, juradoAtivo, local = "bancada", falando = null) {
        if (estado.noPalco !== id) {
          const antigo = estado.noPalco && bonecos.get(estado.noPalco);
          if (antigo) {
            // quem foi embora reaparece direto na baia (apagado, se saiu do torneio); os outros voltam andando
            if (!antigo.malha.visible) {
              antigo.malha.position.set(antigo.base.x, antigo.y0, antigo.base.z);
              antigo.malha.visible = true;
              antigo.caminho = null;
            } else {
              andar(antigo, caminhoAte(antigo.malha.position, antigo.base));
            }
            antigo.malha.material.opacity = antigo.eliminado ? 0.45 : 1;
          }
          const novo = id && bonecos.get(id);
          if (novo) { novo.malha.material.opacity = 1; novo.malha.visible = true; andar(novo, caminhoAte(novo.malha.position, PALCO)); }
          estado.noPalco = id || null;
          estado.local = id ? "bancada" : null;
        }
        const b = id && bonecos.get(id);
        if (b && local !== estado.local) {
          if (local === "saida") andar(b, caminhoAte(b.malha.position, SAIDA));
          else if (local === "fora") andar(b, [new THREE.Vector3(b.malha.position.x, 0, b.malha.position.z), new THREE.Vector3(FORA.x, 0, FORA.z)], () => { b.malha.visible = false; sujo = true; });
          else andar(b, caminhoAte(b.malha.position, PALCO));
          estado.local = local;
        }
        estado.juradoAtivo = juradoAtivo || null;
        estado.falando = falando || null;
        sujo = true;
      },
      marcarAvaliando(sim) { this.avaliando = sim; sujo = true; },
    };
    // os dados que já chegaram antes da cena
    window.dispatchEvent(new CustomEvent("bootcamp-escritorio-pronto"));

    return () => {
      cancelAnimationFrame(quadroId);
      observa.disconnect();
      observaVisao.disconnect();
      canvas.removeEventListener("pointerdown", aoApertar);
      canvas.removeEventListener("pointermove", aoMover);
      canvas.removeEventListener("pointerup", aoSoltar);
      api.current = null;
      ambiente?.descartar();
      // descartar duas vezes o mesmo material (os compartilhados) não faz mal no three
      cena.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) { o.material.map?.dispose(); o.material.dispose(); }
      });
      neon.dispose();
      telaoTex.dispose();
      renderizador.dispose();
      canvas.remove();
    };
    // a cena nasce uma vez; os dados entram pelos efeitos abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- os dados: participantes, telão, avaliação, cenário e palco
  const chave = JSON.stringify(participantes.map((p) => [p.id, p.baia, p.etapa, p.eliminado, p.enviada, p.testes?.passados, p.testes?.total]));
  const chaveDoTelao = JSON.stringify(telao || {});
  const noPalco = palco?.id || null;
  const juradoAtivo = palco?.juradoAtivo || null;
  const local = palco?.local || "bancada";
  const falando = palco?.falando || null;
  const chaveDaFinal = (final?.finalistas || []).join("|");
  const chaveDosTimes = participantes.map((p) => p.equipe || "").join("|");
  useEffect(() => {
    const aplicar = () => {
      api.current?.definirParticipantes(participantes, campeaoId);
      api.current?.definirFinal(final);
      api.current?.definirTelao(telao);
      api.current?.marcarAvaliando(avaliando);
    };
    aplicar();
    window.addEventListener("bootcamp-escritorio-pronto", aplicar);
    return () => window.removeEventListener("bootcamp-escritorio-pronto", aplicar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, chaveDoTelao, campeaoId, avaliando, chaveDaFinal, chaveDosTimes]);
  useEffect(() => {
    const aplicar = () => api.current?.definirCenario(cenario);
    aplicar();
    window.addEventListener("bootcamp-escritorio-pronto", aplicar);
    return () => window.removeEventListener("bootcamp-escritorio-pronto", aplicar);
  }, [cenario]);
  useEffect(() => { api.current?.definirPalco(noPalco, juradoAtivo, local, falando); }, [noPalco, juradoAtivo, local, falando]);

  // ---- as folhas de papel: redesenha quando a skin ou o humor de alguém muda
  const naArquibancada = (p) => Boolean(final?.finalistas?.length) && !final.finalistas.includes(p.id);
  const humorDe = (p) => humores?.[p.id] || (naArquibancada(p) ? "comemorando" : humorDoCompetidor(p, campeaoId));
  const humorDoJurado = (id) => humores?.[`jurado:${id}`] || (avaliando ? "pensando" : "normal");
  const humorDaApresentadora = humores?.apresentadora || "normal";
  const chaveDosHumores = [
    ...participantes.map((p) => `${p.id}:${p.skin}:${humorDe(p)}`),
    ...jurados.map((j) => `${j.id}:${humorDoJurado(j.id)}`),
    `apresentadora:${humorDaApresentadora}`,
  ].join("|");
  useEffect(() => {
    let cancelado = false;
    const id = requestAnimationFrame(async () => {
      const nos = moldes.current?.querySelectorAll("[data-molde]") || [];
      for (const n of nos) {
        const svg = n.querySelector("svg");
        if (!svg) continue;
        try {
          const img = await svgComoImagem(svg);
          if (cancelado) return;
          api.current?.definirFolha(n.dataset.molde, recorteDePapel(img));
        } catch { /* sem a folha, o boneco fica escondido */ }
      }
    });
    return () => { cancelado = true; cancelAnimationFrame(id); };
  }, [chaveDosHumores]);

  return (
    <div className={`bc-escritorio bc-escritorio--${cenario}`} ref={caixa}>
      {participantes.map((p) => (
        <button key={p.id} type="button" ref={(n) => { rotulos.current[p.id] = n; }}
          className={`bc-escritorio__rotulo${p.souEu ? " bc-escritorio__rotulo--eu" : ""}${p.eliminado ? " bc-escritorio__rotulo--fora" : ""}${noPalco === p.id ? " bc-escritorio__rotulo--palco" : ""}`}
          onClick={() => aoEscolher?.(p.id)} aria-label={`${p.nome}${p.souEu ? " (você)" : ""}: ${p.eliminado ? "eliminado" : p.enviada ? "enviou" : p.etapa || "aguardando"} — ver a baia`}>
          {p.id === campeaoId && <span aria-hidden="true">🏆</span>}
          {p.salvo && !naArquibancada(p) && <span aria-hidden="true" title="salvo desta prova">🛡️</span>}
          {p.tipo === "npc" && <span aria-hidden="true">🤖</span>}
          {p.souEu ? "Você" : p.nome}
          {p.insignias?.length > 0 && <span className="bc-escritorio__insignias" aria-hidden="true">{p.insignias.length}🎖️</span>}
        </button>
      ))}
      <span ref={(n) => { rotulos.current.apresentadora = n; }}
        className={`bc-escritorio__rotulo bc-escritorio__rotulo--apresentadora${falando === "apresentadora" ? " bc-escritorio__rotulo--falando" : ""}`}>
        🎤 {apresentadora?.nome || "Clara Compila"}
      </span>
      {jurados.map((j) => (
        <span key={j.id} ref={(n) => { rotulos.current[`jurado:${j.id}`] = n; }}
          className={`bc-escritorio__rotulo bc-escritorio__rotulo--jurado${juradoAtivo === j.id ? " bc-escritorio__rotulo--falando" : ""}`}
          title={j.nome}>
          {j.emoji} {j.nome.replace(/^Chef\s+/, "")}
        </span>
      ))}
      {avaliando && <div className="bc-escritorio__aviso" role="status">⚖️ Os jurados estão avaliando…</div>}
      {!noPalco && <span className="bc-escritorio__dica" aria-hidden="true">arraste para girar · toque numa baia</span>}
      {/* os moldes de papel: fora da tela, sem foco, só para copiar o desenho */}
      <div className="bc-escritorio__moldes" ref={moldes} inert aria-hidden="true">
        {participantes.map((p) => (
          <div key={p.id} data-molde={p.id}><Neuro personagem={p.skin} humor={humorDe(p)} tamanho={200} /></div>
        ))}
        {jurados.map((j) => (
          <div key={j.id} data-molde={`jurado:${j.id}`}><DesenhoDoJurado id={j.id} humor={humorDoJurado(j.id)} tamanho={200} /></div>
        ))}
        <div data-molde="apresentadora"><DesenhoDaApresentadora humor={humorDaApresentadora} tamanho={200} /></div>
      </div>
    </div>
  );
}
