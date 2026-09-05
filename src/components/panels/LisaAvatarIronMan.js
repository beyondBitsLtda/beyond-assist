"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mono } from "@/lib/theme.js";

// Contrato de arquivos (ver instruções do Mixamo): base.fbx é OBRIGATÓRIO — malha + esqueleto +
// clip "Idle", exportado "With Skin". Os demais são OPCIONAIS ("Without Skin", só esqueleto+clip,
// reaplicados sobre o MESMO esqueleto do base.fbx — funciona pq o Mixamo mantém os nomes dos
// ossos idênticos entre downloads do mesmo personagem) — se não existirem ainda, o avatar some
// fica só na animação "Idle" pro modo correspondente, sem quebrar.
const BASE_URL = "/models/ironman/base.fbx";
const CLIP_URLS = { listening: "/models/ironman/listening.fbx", speaking: "/models/ironman/talking.fbx" };
const MODE_TINT = { idle: 0x3fd0f2, listening: 0x7bd88f, speaking: 0xff9d3d };
const GESTURE_KEYS = ["listening", "speaking"];
const BLEND_RATE = 3.2; // 1/segundos — quão rápido o peso do gesto sobe/desce ao trocar de modo

function loadFBX(url) {
  return new Promise((resolve, reject) => new FBXLoader().load(url, resolve, undefined, reject));
}

// Mixamo às vezes gera um nome de esqueleto novo a cada re-upload/re-rig (prefixo tipo
// "mixamorig" vira "mixamorig1", "mixamorig2"...) — se um clipe extra vier de uma sessão
// diferente da do base.fbx, ele carrega sem erro nenhum mas não anima NADA (nenhum track bate
// com nenhum osso), o que parece exatamente um bug de animação "que não roda". Checando aqui
// dá pra distinguir isso de "arquivo não existe" e avisar na tela em vez de falhar em silêncio.
function clipMatchesSkeleton(clip, boneNames) {
  return clip.tracks.some((t) => boneNames.has(t.name.split(".")[0]));
}

/**
 * "Corpo" 3D alternativo da Lisa — Iron Man rigado (esqueleto de verdade via Mixamo, ver
 * 3d model/IronMan/ e as instruções de rig passadas ao usuário). Ao contrário do LisaAvatar3D
 * (cyborg girl, sem esqueleto), este toca clipes de animação de verdade por modo (idle/ouvindo/
 * falando). Idle toca sempre como base; listening/speaking entram por cima como camadas
 * ADITIVAS de peso 0↔1 (não um crossfade tradicional) — testado e comprovado necessário: com
 * crossfade, um osso que o gesto não cobre (ex.: braço que o clipe de "Talking" não anima)
 * fica sem ninguém definindo ele assim que o idle esvazia, e volta pra pose de bind (T-pose).
 *
 * Escala/enquadramento de fábrica são um chute (nunca vi o resultado renderizado antes de
 * entregar) — por isso o OrbitControls fica ligado, pra ajustar zoom/ângulo na hora.
 */
export default function LisaAvatarIronMan({ mode = "idle" }) {
  const containerRef = useRef(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  // diagnóstico visível na tela (sem precisar abrir o console) — ver clipMatchesSkeleton acima
  const [clipStatus, setClipStatus] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const scene = new THREE.Scene();
    // near/far MUITO abertos: a escala real do FBX só se sabe depois de carregado (unidade do
    // Mixamo pode sair em "metros" ou em "centímetros-tratados-como-metro" dependendo do
    // pipeline) — plano de câmera provisório aqui, o enquadramento de verdade é recalculado
    // depois do load a partir do bounding box real do modelo (ver fitCameraToBust abaixo).
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000);
    camera.position.set(0, 0, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI * 0.15;
    controls.maxPolarAngle = Math.PI * 0.7;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(0.8, 2.2, 1.6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(MODE_TINT.idle, 1.2);
    rim.position.set(-0.9, 1.0, -1.2);
    scene.add(rim);

    const wrapper = new THREE.Group();
    scene.add(wrapper);

    let mixer = null;
    const actions = {}; // actions.idle = base absoluto, sempre com peso 1. actions.listening /
    // actions.speaking = camadas ADITIVAS por cima, peso 0↔1 conforme o modo (ver animate()).

    (async () => {
      try {
        const base = await loadFBX(BASE_URL);
        if (disposed) return;
        wrapper.add(base);

        // enquadramento de verdade: mede o modelo JÁ CARREGADO (em vez de chutar unidades) e
        // mira num ponto proporcional à altura real dele — ~82% da altura total cai perto do
        // peito/queixo, é o "plano de busto" pedido, funcionando não importa em que escala o
        // FBX tenha vindo do Mixamo.
        const box = new THREE.Box3().setFromObject(base);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const height = size.y || 1;
        const bustY = box.min.y + height * 0.82;
        controls.target.set(center.x, bustY, center.z);
        camera.position.set(center.x, bustY, center.z + height * 0.42);
        camera.near = Math.max(height * 0.005, 0.001);
        camera.far = height * 50;
        camera.updateProjectionMatrix();
        controls.minDistance = height * 0.15;
        controls.maxDistance = height * 2.5;
        controls.update();

        // o Mixamo devolveu tudo com UMA cor só (viu no teste real: armadura inteira cinza/
        // branca) — ele descarta as cores originais do IronMan.mtl porque eram cores lisas
        // (Kd), sem imagem de textura de verdade, e o pipeline de rig dele não preserva isso.
        // Sem o mapeamento original por peça, não dá pra recuperar EXATAMENTE quais faces eram
        // vermelhas/douradas/prateadas — mas dá pra aproximar: em pose de base (T-pose), a
        // cabeça fica no topo e mãos/braços ficam esticados pras laterais, então pinta de
        // dourado quem estiver perto do topo (capacete) ou bem afastado do eixo central
        // (mãos/braços) e o resto de vermelho — parecido com o esquema real do Homem de Ferro
        // (corpo vermelho, capacete/mãos dourados), em vez de um vermelho liso sem variação.
        const colorsSeen = new Set();
        base.traverse((obj) => {
          if (obj.isMesh && obj.material) {
            for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
              if (mat.color) colorsSeen.add(mat.color.getHexString());
            }
          }
        });
        if (colorsSeen.size <= 1) {
          const RED = new THREE.Color(0xa11d1d);
          const GOLD = new THREE.Color(0xc9a227);
          const worldPos = new THREE.Vector3();
          base.updateWorldMatrix(true, true);
          base.traverse((obj) => {
            if (!obj.isMesh) return;
            const geo = obj.geometry;
            const pos = geo?.attributes?.position;
            if (!pos) return;
            const colorsArr = new Float32Array(pos.count * 3);
            for (let i = 0; i < pos.count; i++) {
              worldPos.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(obj.matrixWorld);
              const ly = (worldPos.y - box.min.y) / height;
              const lx = Math.abs(worldPos.x - center.x) / (size.x || 1);
              const c = ly > 0.9 || lx > 0.42 ? GOLD : RED;
              colorsArr[i * 3] = c.r; colorsArr[i * 3 + 1] = c.g; colorsArr[i * 3 + 2] = c.b;
            }
            geo.setAttribute("color", new THREE.BufferAttribute(colorsArr, 3));
            // "skinning" não existe mais como propriedade de material nessa versão do Three.js
            // (deformação por esqueleto é automática pra qualquer SkinnedMesh) — só o resto.
            obj.material = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.35 });
          });
        }

        mixer = new THREE.AnimationMixer(base);
        // idle é a base ABSOLUTA — toca pra sempre, peso 1, nunca esvazia. É o que evita a
        // pose virar T-pose: se um gesto por cima não cobrir um osso, esse osso continua
        // recebendo o valor do idle (nunca fica "sem ninguém animando ele").
        if (base.animations[0]) {
          actions.idle = mixer.clipAction(base.animations[0]);
          actions.idle.play();
        }
        setLoaded(true);

        const boneNames = new Set();
        base.traverse((obj) => { if (obj.isBone) boneNames.add(obj.name); });

        // clipes extras são opcionais — se o arquivo ainda não existir (usuário não baixou do
        // Mixamo ainda), ignora em silêncio e o modo correspondente cai pro "idle" acima. Mas se
        // o arquivo existir e carregar SEM bater com nenhum osso do esqueleto do base.fbx (rig
        // de sessões diferentes do Mixamo, ver clipMatchesSkeleton), avisa em vez de ficar mudo.
        //
        // Convertidos pra ADITIVOS (relativos ao próprio 1º frame do clipe, ver
        // THREE.AnimationUtils.makeClipAdditive) e tocados por cima do idle o tempo todo, com
        // peso 0 até a vez deles (ver animate() abaixo) — bug real encontrado testando: com
        // crossfade tradicional (idle perde peso, gesto ganha), qualquer osso que o gesto não
        // anime (ex.: "Talking" pode não mexer nos braços) fica sem ninguém definindo o valor
        // dele assim que o idle esvazia, e o Three.js volta esse osso pra pose de bind — que É
        // a T-pose. Aditivo resolve isso: osso não coberto simplesmente recebe delta zero,
        // continua com o que o idle já tinha definido, nunca "esquece" a pose.
        const status = {};
        await Promise.all(
          Object.entries(CLIP_URLS).map(async ([key, url]) => {
            try {
              const obj = await loadFBX(url);
              if (disposed) return;
              const clip = obj.animations[0];
              if (!clip) { status[key] = "arquivo sem clipe de animação"; return; }
              if (!clipMatchesSkeleton(clip, boneNames)) { status[key] = "esqueleto incompatível com o base.fbx (baixe de novo na mesma sessão do Mixamo)"; return; }
              THREE.AnimationUtils.makeClipAdditive(clip);
              const action = mixer.clipAction(clip);
              action.blendMode = THREE.AdditiveAnimationBlendMode;
              action.setEffectiveWeight(0);
              action.play();
              actions[key] = action;
              status[key] = "ok";
            } catch {
              status[key] = "não encontrado — ainda não enviado";
            }
          })
        );
        if (!disposed) setClipStatus(status);
      } catch (err) {
        if (!disposed) setError(err?.message || "falha ao carregar o modelo 3D");
      }
    })();

    const resize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf;
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const m = modeRef.current;
      rim.color.setHex(MODE_TINT[m] || MODE_TINT.idle);
      // sobe o peso do gesto do modo atual, desce o dos outros — suave, não precisa saber se o
      // clipe já carregou ou não (actions[k] só existe quando carrega com sucesso, ver acima).
      for (const k of GESTURE_KEYS) {
        const action = actions[k];
        if (!action) continue;
        const target = m === k ? 1 : 0;
        const w = action.getEffectiveWeight();
        action.setEffectiveWeight(w + (target - w) * Math.min(1, dt * BLEND_RATE));
      }
      mixer?.update(dt);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat) => {
            for (const k of ["map", "normalMap", "metalnessMap", "roughnessMap"]) if (mat[k]) mat[k].dispose();
            mat.dispose();
          });
        }
      });
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {!loaded && !error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", ...mono, fontSize: 10.5, letterSpacing: 1.5, color: "rgba(207,239,251,0.5)", pointerEvents: "none" }}>
          carregando modelo 3D…
        </div>
      )}
      {error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", ...mono, fontSize: 10, color: "#e66767", pointerEvents: "none" }}>
          ⚠ não consegui carregar o modelo 3D ({error})
        </div>
      )}
      {clipStatus && (
        <div style={{ position: "absolute", top: 4, left: 4, ...mono, fontSize: 8.5, lineHeight: 1.5, color: "rgba(207,239,251,0.45)", pointerEvents: "none" }}>
          {Object.entries(clipStatus).map(([key, status]) => (
            <div key={key} style={{ color: status === "ok" ? "rgba(123,216,143,0.6)" : "rgba(255,157,61,0.7)" }}>
              {key}: {status}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
