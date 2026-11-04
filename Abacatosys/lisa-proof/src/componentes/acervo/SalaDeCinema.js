"use client";

// O MODO CINEMA (26/10/2026: "faça um modo de ver o vídeo, ter a opção de cinema, onde mostra os
// avatares nas cadeiras, em uma sala 3D imersiva"): uma sala de cinema em 3D — a tela grande com
// moldura dourada, as cortinas de veludo, o palco, as poltronas em degraus, as arandelas nas paredes
// e o facho do projetor com a poeira dançando. O vídeo (YouTube ou Vimeo) fica NA tela: o iframe é
// desenhado pelo CSS3DRenderer atrás do WebGL, e a tela 3D é um "buraco" transparente (NoBlending
// com opacidade 0), então a perspectiva bate e quem está na frente tapa o vídeo, como num cinema.
//
// A plateia: você, quem trouxe o vídeo e quem frequenta a biblioteca (os contribuidores), cada um
// com o seu personagem do Neuro, em papel recortado. Da poltrona, vemos as silhuetas na frente; em
// "Ver a plateia", a câmera vai para o palco e mostra os rostos (com o nome de cada um).
// Não é ao vivo: é a turma da biblioteca "assistindo junto".

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CSS3DRenderer, CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import Neuro from "@/componentes/Neuro.js";
import { svgComoImagem, recorteDePapel } from "@/componentes/reino/papel.js";

const TELA = { l: 10, a: 5.625, y: 3.7, z: -8.55 };
const FILEIRAS = 7;
const ASSENTOS = [-6.05, -5.0, -3.95, -2.9, -1.85, 1.85, 2.9, 3.95, 5.0, 6.05];
const zDaFileira = (i) => -2.6 + i * 1.55;
const yDaFileira = (i) => i * 0.38;

function sorteio(semente) {
  let a = semente | 0 || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashDe = (s) => { let h = 0x811c9dc5; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0; };

/** Onde cada um senta: você numa poltrona do corredor, quem trouxe perto, a turma espalhada. */
function lugaresDa(plateia, semente) {
  const r = sorteio(hashDe(semente));
  const livres = [];
  for (let f = 0; f < FILEIRAS - 1; f++) for (let s = 0; s < ASSENTOS.length; s++) livres.push([f, s]);
  const tirar = (f, s) => { const i = livres.findIndex(([a, b]) => a === f && b === s); if (i >= 0) livres.splice(i, 1); return [f, s]; };
  return plateia.map((p) => {
    if (p.papel === "voce") return { ...p, lugar: tirar(4, 5) };
    if (p.papel === "autor") return { ...p, lugar: tirar(3, 4) };
    const [f, s] = livres.splice(Math.floor(r() * livres.length), 1)[0];
    return { ...p, lugar: [f, s] };
  });
}

export default function SalaDeCinema({ material, plateia = [], aoSair, aoFalhar }) {
  const caixa = useRef(null);
  const moldes = useRef(null);
  const etiquetas = useRef({});
  const api = useRef(null);
  const [vista, setVista] = useState("tela"); // "tela" | "plateia"
  const [luzes, setLuzes] = useState(false);
  const chamadas = useRef({ aoFalhar });
  chamadas.current = { aoFalhar };
  const sentados = useRef(lugaresDa(plateia, material.id));

  // ---- a sala: uma vez
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
    renderer.setClearColor(0x000000, 0);
    const css = new CSS3DRenderer();
    css.domElement.className = "ac-cinema__css";
    renderer.domElement.className = "ac-cinema__gl";
    el.appendChild(css.domElement);
    el.appendChild(renderer.domElement);

    const cena = new THREE.Scene();
    const cenaCss = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);

    const materiais = [];
    const mat = (cor, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.85, metalness: 0, ...extra }); materiais.push(m); return m; };
    const add = (geo, m, x, y, z, pai = cena) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); pai.add(o); return o; };

    // ---- a sala: paredes, teto, chão
    const parede = mat("#3a1218");
    const sala = new THREE.Mesh(new THREE.BoxGeometry(17, 9, 24), [parede, parede, mat("#1a0b0f"), mat("#2a1114"), mat("#2b0f14"), parede]);
    sala.geometry.scale(-1, 1, 1); // vista de dentro
    sala.position.set(0, 4.5, 2.6);
    cena.add(sala);
    // os painéis acústicos e as arandelas das paredes laterais
    const painel = mat("#4c1820");
    const arandela = mat("#ffd9a0", { emissive: "#ffb05a", emissiveIntensity: 1.2 });
    const arandelas = [];
    for (const lado of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const z = -5 + k * 3.6;
        add(new THREE.BoxGeometry(0.12, 4.2, 2.6), painel, lado * 8.4, 3.6, z);
        const a = add(new THREE.CylinderGeometry(0.22, 0.12, 0.42, 10, 1, true, 0, Math.PI), arandela, lado * 8.38, 5.9, z);
        a.rotation.y = lado > 0 ? -Math.PI / 2 : Math.PI / 2;
        arandelas.push(a);
      }
    }
    // o palco, a moldura dourada e as cortinas
    add(new THREE.BoxGeometry(14, 0.7, 2.6), mat("#5b1c1c"), 0, 0.35, -7.9);
    add(new THREE.BoxGeometry(14.2, 0.12, 2.8), mat("#7a2a22"), 0, 0.72, -7.9);
    const ouro = mat("#d4a537", { metalness: 0.55, roughness: 0.35, emissive: "#3a2a05", emissiveIntensity: 0.4 });
    const borda = 0.22;
    add(new THREE.BoxGeometry(TELA.l + borda * 2, borda, 0.15), ouro, 0, TELA.y + TELA.a / 2 + borda / 2, TELA.z - 0.05);
    add(new THREE.BoxGeometry(TELA.l + borda * 2, borda, 0.15), ouro, 0, TELA.y - TELA.a / 2 - borda / 2, TELA.z - 0.05);
    add(new THREE.BoxGeometry(borda, TELA.a, 0.15), ouro, -TELA.l / 2 - borda / 2, TELA.y, TELA.z - 0.05);
    add(new THREE.BoxGeometry(borda, TELA.a, 0.15), ouro, TELA.l / 2 + borda / 2, TELA.y, TELA.z - 0.05);
    const veludo = mat("#8f1d2c", { roughness: 0.95 });
    const veludoEscuro = mat("#6b1420", { roughness: 0.95 });
    for (const lado of [-1, 1]) {
      for (let k = 0; k < 9; k++) add(new THREE.CylinderGeometry(0.2, 0.24, 7.6, 8), k % 2 ? veludo : veludoEscuro, lado * (5.55 + k * 0.32), 4.4, -8.3 + (k % 2) * 0.12);
    }
    for (let k = 0; k < 30; k++) {
      // a sanefa (a cortina de cima)
      add(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 8), k % 2 ? veludo : veludoEscuro, -8.3 + k * 0.57, 8.0, -8.2);
    }
    // a tela: um buraco transparente — o vídeo (no CSS3D, atrás) aparece por ele
    const buraco = new THREE.Mesh(new THREE.PlaneGeometry(TELA.l, TELA.a), new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide }));
    buraco.position.set(0, TELA.y, TELA.z);
    cena.add(buraco);
    const quadro = document.createElement("div");
    quadro.className = "ac-cinema__quadro";
    quadro.style.width = "1280px";
    quadro.style.height = "720px";
    const iframe = document.createElement("iframe");
    iframe.src = `${material.video.embed}?autoplay=1${material.video.plataforma === "youtube" ? "&rel=0&playsinline=1" : ""}`;
    iframe.title = material.titulo;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    quadro.appendChild(iframe);
    const tela3d = new CSS3DObject(quadro);
    tela3d.position.set(0, TELA.y, TELA.z);
    tela3d.scale.set(TELA.l / 1280, TELA.a / 720, 1);
    cenaCss.add(tela3d);

    // ---- os degraus e as poltronas (instanciadas: 70 poltronas, três peças cada)
    const carpete = mat("#5a1a24", { roughness: 1 });
    for (let f = 0; f < FILEIRAS; f++) {
      add(new THREE.BoxGeometry(16.8, yDaFileira(f) + 0.02, 1.55), carpete, 0, (yDaFileira(f) + 0.02) / 2, zDaFileira(f));
      // as luzinhas do corredor, no chão de cada degrau
      for (const x of [-1.05, 1.05]) add(new THREE.BoxGeometry(0.18, 0.04, 0.08), mat("#ffcf7a", { emissive: "#ffb347", emissiveIntensity: 1.4 }), x, yDaFileira(f) + 0.04, zDaFileira(f) + 0.7);
    }
    const n = FILEIRAS * ASSENTOS.length;
    const estofado = mat("#a3172f", { roughness: 0.9 });
    const encosto = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1.0, 0.16), estofado, n);
    const assento = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.2, 0.72), estofado, n);
    const braco = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.32, 0.75), mat("#3b0d14"), n);
    const m4 = new THREE.Matrix4();
    let i = 0;
    for (let f = 0; f < FILEIRAS; f++) {
      for (const x of ASSENTOS) {
        const y = yDaFileira(f), z = zDaFileira(f);
        m4.makeTranslation(x, y + 0.95, z + 0.36); encosto.setMatrixAt(i, m4);
        m4.makeTranslation(x, y + 0.48, z + 0.02); assento.setMatrixAt(i, m4);
        m4.makeTranslation(x + 0.5, y + 0.62, z + 0.02); braco.setMatrixAt(i, m4);
        i += 1;
      }
    }
    cena.add(encosto, assento, braco);

    // ---- o projetor: a janelinha no fundo, o facho e a poeira
    const janela = add(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ color: "#fff6d8" }), 0, 7.3, 14.08);
    janela.rotation.y = Math.PI;
    const origem = new THREE.Vector3(0, 7.3, 14);
    const alvo = new THREE.Vector3(0, TELA.y, -5.2);
    const comprimento = origem.distanceTo(alvo);
    const facho = new THREE.Mesh(new THREE.CylinderGeometry(0.25, TELA.l * 0.36, comprimento, 4, 1, true),
      new THREE.MeshBasicMaterial({ color: "#cfe3ff", transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    facho.position.copy(origem).add(alvo).multiplyScalar(0.5);
    facho.lookAt(alvo);
    facho.rotateX(-Math.PI / 2); // o eixo do cilindro na direção do facho, a ponta fina no projetor
    facho.rotateY(Math.PI / 4);
    cena.add(facho);
    const poeiraGeo = new THREE.BufferGeometry();
    const pontos = [];
    const rp = sorteio(9);
    for (let k = 0; k < 260; k++) {
      const t = rp();
      const p = origem.clone().lerp(alvo, t);
      const raio = 0.25 + t * TELA.l * 0.3;
      pontos.push(p.x + (rp() - 0.5) * raio * 1.6, p.y + (rp() - 0.5) * raio * 0.9, p.z);
    }
    poeiraGeo.setAttribute("position", new THREE.Float32BufferAttribute(pontos, 3));
    // cada grão de poeira é um pontinho redondo e esfumado (não um quadrado)
    const grao = document.createElement("canvas");
    grao.width = grao.height = 32;
    const gx = grao.getContext("2d");
    const brilho = gx.createRadialGradient(16, 16, 0, 16, 16, 16);
    brilho.addColorStop(0, "rgba(255,255,255,1)");
    brilho.addColorStop(1, "rgba(255,255,255,0)");
    gx.fillStyle = brilho;
    gx.fillRect(0, 0, 32, 32);
    const texturaDoGrao = new THREE.CanvasTexture(grao);
    const poeira = new THREE.Points(poeiraGeo, new THREE.PointsMaterial({ color: "#fff7e0", map: texturaDoGrao, size: 0.06, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    cena.add(poeira);

    // ---- as luzes: a da tela (que pisca com o filme), as arandelas e uma luz de sala bem fraca
    const ambiente = new THREE.HemisphereLight("#ffd9c0", "#1a0508", 0.35);
    cena.add(ambiente);
    const daTela = new THREE.PointLight("#bcd4ff", 26, 26, 1.4);
    daTela.position.set(0, TELA.y - 0.4, TELA.z + 2.2);
    cena.add(daTela);
    const quentes = [-1, 1].map((lado) => { const l = new THREE.PointLight("#ffb46b", 4, 14, 1.6); l.position.set(lado * 7.2, 5.6, 2); cena.add(l); return l; });

    // ---- a plateia: cada um no seu lugar, em papel recortado (silhueta vista de trás; rosto visto do palco)
    const geoPapel = new THREE.PlaneGeometry(1.15, 1.15);
    const pessoas = sentados.current.map((p) => {
      const tex = new THREE.CanvasTexture(document.createElement("canvas"));
      tex.colorSpace = THREE.SRGBColorSpace;
      const rosto = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
      const silhueta = new THREE.MeshBasicMaterial({ map: tex, color: "#050407", transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
      rosto.visible = silhueta.visible = false;
      const plano = new THREE.Mesh(geoPapel, silhueta);
      const [f, s] = p.lugar;
      plano.position.set(ASSENTOS[s], yDaFileira(f) + 1.3, zDaFileira(f) + 0.05); // a cabeça passa do encosto
      cena.add(plano);
      return { ...p, tex, rosto, silhueta, plano, base: plano.position.y, fase: hashDe(p.id) % 100 };
    });
    function definirAvatar(personagem, canvas) {
      for (const p of pessoas) {
        if (p.personagem !== personagem) continue;
        p.tex.image = canvas; p.tex.needsUpdate = true;
        p.rosto.visible = p.silhueta.visible = true;
      }
    }

    // ---- a câmera: da poltrona (a tela) ou do palco (a plateia), com uma transição suave
    const POSES = {
      tela: { pos: new THREE.Vector3(0, yDaFileira(FILEIRAS - 1) + 2.0, zDaFileira(FILEIRAS - 1) + 1.0), olha: new THREE.Vector3(0, TELA.y - 0.15, TELA.z) },
      plateia: { pos: new THREE.Vector3(0, 3.6, -6.2), olha: new THREE.Vector3(0, 2.0, 5) },
    };
    const atual = { pos: POSES.tela.pos.clone(), olha: POSES.tela.olha.clone() };
    let destino = "tela";
    let modoDeLuz = false;

    function medir() {
      const l = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(l, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      css.setSize(l, h);
      camera.aspect = l / h;
      camera.fov = l / h < 1 ? 70 : 50; // em pé (celular) abre mais
      camera.updateProjectionMatrix();
    }
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);

    const relogio = new THREE.Clock();
    const v = new THREE.Vector3();
    let quadroDoLaco = 0;
    const laco = () => {
      quadroDoLaco = requestAnimationFrame(laco);
      const dt = Math.min(0.05, relogio.getDelta());
      const t = relogio.elapsedTime;
      const pose = POSES[destino];
      const k = calmo ? 1 : 1 - Math.pow(0.04, dt);
      atual.pos.lerp(pose.pos, k);
      atual.olha.lerp(pose.olha, k);
      camera.position.copy(atual.pos);
      if (!calmo && destino === "tela") camera.position.y += Math.sin(t * 0.5) * 0.02; // a respiração de quem assiste
      camera.lookAt(atual.olha);
      const doPalco = destino === "plateia";
      for (const p of pessoas) {
        p.plano.material = doPalco ? p.rosto : p.silhueta;
        p.plano.rotation.y = doPalco ? Math.PI : 0;
        if (!calmo) p.plano.position.y = p.base + Math.sin(t * 1.3 + p.fase) * 0.015;
      }
      if (!calmo) {
        daTela.intensity = (modoDeLuz ? 20 : 26) + Math.sin(t * 7.1) * 2.2 + Math.sin(t * 2.3) * 3;
        poeira.rotation.z = Math.sin(t * 0.1) * 0.01;
        poeira.position.y = Math.sin(t * 0.3) * 0.05;
      }
      renderer.render(cena, camera);
      css.render(cenaCss, camera);
      // os nomes da plateia (só vistos do palco)
      const r = el.getBoundingClientRect();
      for (const p of pessoas) {
        const e = etiquetas.current[p.id];
        if (!e) continue;
        v.copy(p.plano.position); v.y += 0.72;
        v.project(camera);
        const visivel = doPalco && v.z < 1 && atual.pos.distanceTo(POSES.plateia.pos) < 0.6;
        e.style.opacity = visivel ? "1" : "0";
        e.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * r.width}px, ${((1 - v.y) / 2) * r.height}px)`;
      }
    };
    laco();

    api.current = {
      definirAvatar,
      verPlateia: (sim) => { destino = sim ? "plateia" : "tela"; },
      acenderLuzes: (sim) => {
        modoDeLuz = sim;
        ambiente.intensity = sim ? 1.1 : 0.35;
        quentes.forEach((l) => { l.intensity = sim ? 14 : 4; });
        arandelas.forEach((a) => { a.material.emissiveIntensity = sim ? 2.2 : 1.2; });
      },
    };
    return () => {
      cancelAnimationFrame(quadroDoLaco);
      observador.disconnect();
      cena.traverse((o) => { o.geometry?.dispose(); });
      materiais.forEach((m) => m.dispose());
      texturaDoGrao.dispose();
      pessoas.forEach((p) => { p.tex.dispose(); p.rosto.dispose(); p.silhueta.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
      css.domElement.remove();
      api.current = null;
    };
  }, [material]);

  useEffect(() => { api.current?.verPlateia(vista === "plateia"); }, [vista]);
  useEffect(() => { api.current?.acenderLuzes(luzes); }, [luzes]);

  // os personagens viram papel (o SVG do Neuro, fora da tela)
  const personagens = [...new Set(sentados.current.map((p) => p.personagem))];
  const chaveDosPersonagens = personagens.join(",");
  useEffect(() => {
    let cancelado = false;
    const id = requestAnimationFrame(async () => {
      for (const nome of chaveDosPersonagens.split(",").filter(Boolean)) {
        const svg = moldes.current?.querySelector(`[data-personagem="${nome}"] svg`);
        if (!svg) continue;
        try {
          const img = await svgComoImagem(svg);
          if (!cancelado) api.current?.definirAvatar(nome, recorteDePapel(img));
        } catch { /* sem a folha, a poltrona fica vazia */ }
      }
    });
    return () => { cancelado = true; cancelAnimationFrame(id); };
  }, [chaveDosPersonagens]);

  // Esc sai; o foco vai para o botão de sair
  const sair = useRef(null);
  useEffect(() => {
    sair.current?.focus({ preventScroll: true });
    const tecla = (e) => { if (e.key === "Escape" && !document.fullscreenElement) aoSair(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoSair]);

  const raiz = useRef(null);
  const telaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else raiz.current?.requestFullscreen?.().catch(() => {});
  };
  const autor = sentados.current.find((p) => p.papel === "autor");
  const turma = sentados.current.filter((p) => p.papel === "frequentador").length;

  return (
    <div ref={raiz} className="ac-cinema" role="dialog" aria-modal="true" aria-label={`Modo cinema: ${material.titulo}`}>
      <div ref={caixa} className="ac-cinema__sala" />
      {sentados.current.map((p) => (
        <span key={p.id} ref={(e) => { etiquetas.current[p.id] = e; }} className={`ac-cinema__nome ac-cinema__nome--${p.papel}`}>
          {p.papel === "voce" ? "Você" : p.nome}{p.papel === "autor" ? " · trouxe" : ""}
        </span>
      ))}
      <div className="ac-cinema__topo">
        <div className="ac-cinema__titulo">
          <span className="ac-cinema__selo">🎬 Modo cinema</span>
          <strong>{material.titulo}</strong>
          {material.autores && <small>{material.autores}</small>}
        </div>
        <div className="ac-cinema__acoes">
          <button type="button" onClick={() => setVista(vista === "tela" ? "plateia" : "tela")}>{vista === "tela" ? "👀 Ver a plateia" : "🎞️ Voltar para a tela"}</button>
          <button type="button" aria-pressed={luzes} onClick={() => setLuzes(!luzes)}>{luzes ? "🌑 Apagar as luzes" : "💡 Acender as luzes"}</button>
          <button type="button" onClick={telaCheia}>⛶ Tela cheia</button>
          <button ref={sair} type="button" className="ac-cinema__sair" onClick={aoSair}>✕ Sair</button>
        </div>
      </div>
      <p className="ac-cinema__girar">📱↻ Gire o celular para a tela ficar maior</p>
      <p className="ac-cinema__plateia">
        Na plateia: você{autor ? `, ${autor.nome} (que trouxe o vídeo)` : " (que trouxe o vídeo)"}{turma ? ` e ${turma} ${turma === 1 ? "frequentador" : "frequentadores"} da biblioteca` : ""}.
      </p>
      <div ref={moldes} className="ac-mundo__moldes" aria-hidden="true">
        {personagens.map((nome) => <div key={nome} data-personagem={nome}><Neuro personagem={nome} humor="feliz" tamanho={160} /></div>)}
      </div>
    </div>
  );
}
