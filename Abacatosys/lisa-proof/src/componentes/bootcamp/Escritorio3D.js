"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import Neuro from "@/componentes/Neuro.js";
import { svgComoImagem, recorteDePapel } from "@/componentes/reino/papel.js";
import { humorDoCompetidor } from "./Pecas.js";

/**
 * O escritório de TI do Modo Bootcamp em 3D (04/11/2026): um estúdio de reality show escuro, com faixas de neon
 * lima, 8 baias em duas fileiras viradas para a bancada dos 3 jurados e um telão com a rodada. Cada competidor é
 * o Neuro de papel com a skin dele (o mesmo recorte de adesivo do Reino: src/componentes/reino/papel.js), de pé
 * ao lado da baia; o monitor de cada baia mostra a etapa do fluxo do exercício em que ele está.
 *
 * Arrastar gira o estúdio; tocar numa baia (ou no nome em cima dela) chama `aoEscolher(id)`. Sem WebGL, chama
 * `aoFalhar()` e a tela mostra as baias em 2D. Com "reduzir movimento", ninguém balança e a cena só redesenha
 * quando algo muda.
 */

// as 8 baias: duas fileiras de 4, viradas para a bancada (que fica no fundo, em z negativo)
const POSICOES = [[-4.8, -0.2], [-1.6, -0.2], [1.6, -0.2], [4.8, -0.2], [-4.8, 2.7], [-1.6, 2.7], [1.6, 2.7], [4.8, 2.7]];
const POS_DOS_JURADOS = [-1.7, 0, 1.7];

const COR = {
  piso: "#12161b", parede: "#191e25", mesa: "#2b313b", mesaClara: "#3a424e", metal: "#59616d", cadeira: "#20252c",
  neon: "#84cc16", bancada: "#22272f", vidro: "#9fb4c8", ouro: "#f0be45", apagado: "#1a1e24",
};

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

function desenharTelao(canvas, { titulo, subtitulo }) {
  const c = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#0d1309");
  g.addColorStop(1, "#141a22");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(132,204,22,0.55)";
  c.lineWidth = 6;
  c.strokeRect(8, 8, w - 16, h - 16);
  c.fillStyle = "#84cc16";
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

export default function Escritorio3D({ participantes, jurados, campeaoId = null, telao, avaliando = false, aoEscolher, aoFalhar }) {
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
    renderizador.setClearColor("#0b0e12");
    renderizador.domElement.setAttribute("aria-hidden", "true");
    el.prepend(renderizador.domElement);

    const cena = new THREE.Scene();
    cena.fog = new THREE.Fog("#0b0e12", 16, 30);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    camera.position.set(0, 8.2, 12.2);
    camera.lookAt(0, 0.6, -0.2);

    cena.add(new THREE.AmbientLight("#ffffff", 0.35));
    cena.add(new THREE.HemisphereLight("#d6e6ff", "#141910", 1.05));
    const luz = new THREE.DirectionalLight("#ffffff", 1.6);
    luz.position.set(5, 12, 8);
    luz.castShadow = true;
    luz.shadow.mapSize.set(1024, 1024);
    Object.assign(luz.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
    luz.shadow.bias = -0.0008;
    cena.add(luz);
    const luzDosJurados = new THREE.PointLight("#9be12f", 6, 9, 1.6);
    luzDosJurados.position.set(0, 3.2, -3);
    cena.add(luzDosJurados);

    const materiais = new Map();
    const mat = (cor, extra = {}) => {
      const chave = `${cor}|${JSON.stringify(extra)}`;
      if (!materiais.has(chave)) materiais.set(chave, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7, metalness: 0.15, ...extra }));
      return materiais.get(chave);
    };
    const neon = mat(COR.neon, { emissive: COR.neon, emissiveIntensity: 1.2 });
    const caixaDe = (w, h, d, material, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === "string" ? mat(material) : material);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    const estudio = new THREE.Group();
    cena.add(estudio);

    // piso, grade de neon fraca e paredes
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(22, 18), mat(COR.piso, { roughness: 0.4, metalness: 0.3 }));
    piso.rotation.x = -Math.PI / 2;
    piso.receiveShadow = true;
    estudio.add(piso);
    const grade = new THREE.GridHelper(22, 22, "#2e3a1c", "#1c2218");
    grade.position.y = 0.005;
    estudio.add(grade);
    estudio.add(caixaDe(22, 6, 0.3, COR.parede, 0, 3, -6));
    estudio.add(caixaDe(22, 0.08, 0.06, neon, 0, 0.25, -5.83));
    estudio.add(caixaDe(22, 0.08, 0.06, neon, 0, 5.6, -5.83));
    for (const x of [-10.8, 10.8]) {
      estudio.add(caixaDe(0.3, 6, 14, COR.parede, x, 3, 1));
      estudio.add(caixaDe(0.06, 0.08, 14, neon, x - Math.sign(x) * 0.17, 0.25, 1));
    }

    // o telão com a rodada
    const telaoCanvas = document.createElement("canvas");
    telaoCanvas.width = 1024;
    telaoCanvas.height = 384;
    const telaoTex = new THREE.CanvasTexture(telaoCanvas);
    telaoTex.colorSpace = THREE.SRGBColorSpace;
    const telaoMalha = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshBasicMaterial({ map: telaoTex }));
    telaoMalha.position.set(0, 3.5, -5.83);
    estudio.add(telaoMalha);
    estudio.add(caixaDe(8.3, 3.3, 0.1, COR.mesa, 0, 3.5, -5.92));

    // a bancada dos jurados
    estudio.add(caixaDe(6.4, 1.0, 1.0, COR.bancada, 0, 0.5, -3.7));
    estudio.add(caixaDe(6.6, 0.08, 1.2, COR.mesaClara, 0, 1.04, -3.7));
    estudio.add(caixaDe(6.4, 0.06, 0.04, neon, 0, 0.82, -3.18));
    for (const x of POS_DOS_JURADOS) estudio.add(caixaDe(0.5, 0.06, 0.32, COR.ouro, x, 1.1, -3.4));

    // ---- os bonecos de papel (competidores e jurados), sempre de frente para a câmera
    const geoPapel = new THREE.PlaneGeometry(1.5, 1.5);
    geoPapel.translate(0, 0.75, 0);
    const bonecos = new Map(); // id → { malha, material, base }
    function boneco(id, x, z, escala = 1) {
      if (bonecos.has(id)) return bonecos.get(id);
      const material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(document.createElement("canvas")), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
      material.visible = false;
      const malha = new THREE.Mesh(geoPapel, material);
      malha.position.set(x, 0, z);
      malha.scale.setScalar(escala);
      malha.castShadow = true;
      estudio.add(malha);
      const b = { malha, material, base: { x, z } };
      bonecos.set(id, b);
      return b;
    }
    POS_DOS_JURADOS.forEach((x, i) => boneco(`jurado:${i}`, x, -4.45, 1.05));

    // ---- as baias
    const baias = [];
    POSICOES.forEach(([x, z], i) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.add(caixaDe(2.2, 0.08, 1.0, COR.mesaClara, 0, 0.78, 0));
      for (const [dx, dz] of [[-1, -0.42], [1, -0.42], [-1, 0.42], [1, 0.42]]) g.add(caixaDe(0.06, 0.76, 0.06, COR.metal, dx, 0.38, dz));
      // as divisórias de vidro, com a quina de neon
      const vidro = new THREE.MeshStandardMaterial({ color: COR.vidro, transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.1 });
      const fundo = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 0.04), vidro);
      fundo.position.set(0, 1.25, -0.52);
      g.add(fundo);
      g.add(caixaDe(2.3, 0.04, 0.05, neon, 0, 1.7, -0.52));
      // o monitor
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
      // a cadeira
      g.add(caixaDe(0.55, 0.08, 0.55, COR.cadeira, -0.35, 0.5, 0.75));
      g.add(caixaDe(0.55, 0.6, 0.08, COR.cadeira, -0.35, 0.82, 1.02));
      // o troféu do campeão (aparece só nele)
      const trofeu = new THREE.Group();
      trofeu.add(caixaDe(0.22, 0.06, 0.22, mat(COR.ouro, { metalness: 0.8, roughness: 0.25, emissive: COR.ouro, emissiveIntensity: 0.25 }), 0, 0, 0));
      const taca = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.06, 0.26, 12), mat(COR.ouro, { metalness: 0.8, roughness: 0.25, emissive: COR.ouro, emissiveIntensity: 0.25 }));
      taca.position.y = 0.17;
      trofeu.add(taca);
      trofeu.position.set(0.55, 0.86, -0.2);
      trofeu.visible = false;
      g.add(trofeu);
      // o alvo do toque: a baia inteira
      g.traverse((m) => { m.userData.baia = i; });
      estudio.add(g);
      baias.push({ grupo: g, telaCanvas, telaTex, tela, trofeu, fundo, ancora: new THREE.Vector3(x, 2.65, z), participante: null });
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
      camera.position.set(0, w < h * 1.2 ? 11 : 8.2, w < h * 1.2 ? 16.5 : 12.2);
      camera.lookAt(0, 0.6, 0.2);
      camera.updateProjectionMatrix();
      sujo = true;
    }
    const observa = new ResizeObserver(enquadrar);
    observa.observe(el);
    enquadrar();
    const observaVisao = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) sujo = true; });
    observaVisao.observe(el);

    // ---- os rótulos em HTML acompanham as baias
    const v = new THREE.Vector3();
    function posicionarRotulos() {
      const w = el.clientWidth, h = el.clientHeight;
      baias.forEach((b, i) => {
        const n = rotulos.current[`baia:${i}`];
        if (!n) return;
        v.copy(b.ancora).applyMatrix4(estudio.matrixWorld).project(camera);
        n.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      });
      POS_DOS_JURADOS.forEach((x, i) => {
        const n = rotulos.current[`jurado:${i}`];
        if (!n) return;
        v.set(x, 2.25, -4.45).applyMatrix4(estudio.matrixWorld).project(camera);
        n.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      });
    }

    // ---- o laço
    const relogio = new THREE.Clock();
    function quadro() {
      quadroId = requestAnimationFrame(quadro);
      if (!visivel) return;
      const t = relogio.getElapsedTime();
      if (!semMovimento) {
        for (const [id, b] of bonecos) {
          const digitando = b.digitando && !id.startsWith("jurado");
          b.malha.position.y = digitando ? Math.abs(Math.sin(t * 7 + b.base.x)) * 0.05 : Math.sin(t * 1.6 + b.base.x) * 0.015;
        }
        luzDosJurados.intensity = (api.current?.avaliando ? 9 : 6) + Math.sin(t * 2) * 0.6;
        sujo = true;
      }
      if (!sujo) return;
      sujo = false;
      // o lookAt do three já desconta o giro do estúdio (o pai); só precisa da matriz dele em dia
      estudio.updateMatrixWorld();
      for (const b of bonecos.values()) b.malha.lookAt(camera.position.x, b.malha.position.y, camera.position.z);
      renderizador.render(cena, camera);
      posicionarRotulos();
    }
    quadro();

    api.current = {
      avaliando: false,
      definirParticipantes(lista, campeao) {
        const porBaia = new Map(lista.map((p) => [p.baia, p]));
        baias.forEach((b, i) => {
          const p = porBaia.get(i) || null;
          b.participante = p;
          desenharMonitor(b.telaCanvas, p);
          b.telaTex.needsUpdate = true;
          b.trofeu.visible = Boolean(p && p.id === campeao);
          b.fundo.material.opacity = p && !p.eliminado ? 0.16 : 0.06;
          const [x, z] = POSICOES[i];
          if (p) {
            const bo = boneco(p.id, x + 0.6, z + 0.55);
            bo.digitando = p.etapa === "codigo" && !p.eliminado;
            bo.malha.material.opacity = p.eliminado ? 0.45 : 1;
          }
        });
        sujo = true;
      },
      definirTelao(dados) {
        desenharTelao(telaoCanvas, dados || {});
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
      // descartar duas vezes o mesmo material (os compartilhados) não faz mal no three
      cena.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) { o.material.map?.dispose(); o.material.dispose(); }
      });
      telaoTex.dispose();
      renderizador.dispose();
      canvas.remove();
    };
    // a cena nasce uma vez; os dados entram pelos efeitos abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- os dados: participantes, telão e avaliação
  const chave = JSON.stringify(participantes.map((p) => [p.id, p.baia, p.etapa, p.eliminado, p.enviada, p.testes?.passados, p.testes?.total]));
  const chaveDoTelao = JSON.stringify(telao || {});
  useEffect(() => {
    const aplicar = () => {
      api.current?.definirParticipantes(participantes, campeaoId);
      api.current?.definirTelao(telao);
      api.current?.marcarAvaliando(avaliando);
    };
    aplicar();
    window.addEventListener("bootcamp-escritorio-pronto", aplicar);
    return () => window.removeEventListener("bootcamp-escritorio-pronto", aplicar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, chaveDoTelao, campeaoId, avaliando]);

  // ---- as folhas de papel: redesenha quando a skin ou o humor de alguém muda
  const humores = participantes.map((p) => `${p.id}:${p.skin}:${humorDoCompetidor(p, campeaoId)}`).join("|");
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
  }, [humores, avaliando]);

  return (
    <div className="bc-escritorio" ref={caixa}>
      {participantes.map((p) => (
        <button key={p.id} type="button" ref={(n) => { rotulos.current[`baia:${p.baia}`] = n; }}
          className={`bc-escritorio__rotulo${p.souEu ? " bc-escritorio__rotulo--eu" : ""}${p.eliminado ? " bc-escritorio__rotulo--fora" : ""}`}
          onClick={() => aoEscolher?.(p.id)} aria-label={`${p.nome}${p.souEu ? " (você)" : ""}: ${p.eliminado ? "eliminado" : p.enviada ? "enviou" : p.etapa || "aguardando"} — ver a baia`}>
          {p.id === campeaoId && <span aria-hidden="true">🏆</span>}
          {p.tipo === "npc" && <span aria-hidden="true">🤖</span>}
          {p.souEu ? "Você" : p.nome}
        </button>
      ))}
      {jurados.map((j, i) => (
        <span key={j.id} className="bc-escritorio__rotulo bc-escritorio__rotulo--jurado" ref={(n) => { rotulos.current[`jurado:${i}`] = n; }}>
          {j.emoji} {j.nome}
        </span>
      ))}
      {avaliando && <div className="bc-escritorio__aviso" role="status">⚖️ Os jurados estão avaliando…</div>}
      <span className="bc-escritorio__dica" aria-hidden="true">arraste para girar · toque numa baia</span>
      {/* os moldes do Neuro de papel: fora da tela, sem foco, só para copiar o desenho */}
      <div className="bc-escritorio__moldes" ref={moldes} inert aria-hidden="true">
        {participantes.map((p) => (
          <div key={p.id} data-molde={p.id}><Neuro personagem={p.skin} humor={humorDoCompetidor(p, campeaoId)} tamanho={200} /></div>
        ))}
        {jurados.map((j, i) => (
          <div key={j.id} data-molde={`jurado:${i}`}><Neuro personagem={j.personagem} humor={avaliando ? "pensando" : "normal"} tamanho={200} /></div>
        ))}
      </div>
    </div>
  );
}
