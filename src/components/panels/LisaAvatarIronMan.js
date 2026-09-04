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
const FADE_S = 0.4;

function loadFBX(url) {
  return new Promise((resolve, reject) => new FBXLoader().load(url, resolve, undefined, reject));
}

/**
 * "Corpo" 3D alternativo da Lisa — Iron Man rigado (esqueleto de verdade via Mixamo, ver
 * 3d model/IronMan/ e as instruções de rig passadas ao usuário). Ao contrário do LisaAvatar3D
 * (cyborg girl, sem esqueleto), este toca clipes de animação de verdade por modo (idle/ouvindo/
 * falando), com crossfade entre eles — gesto real, não só balanço/respiração simulados.
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 30);
    // Mixamo exporta os personagens numa altura padrão (~1.7-1.8 unidades = pés em y=0, cabeça
    // lá em cima) — então plano de busto começa mirando por volta do peito/queixo, não no chão.
    camera.position.set(0, 1.5, 0.85);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.45, 0);
    controls.enablePan = false;
    // zoom livre: perto o bastante pra encarar o capacete, longe o bastante pra ver o corpo inteiro
    controls.minDistance = 0.35;
    controls.maxDistance = 3.6;
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
    const actions = {};
    let currentAction = null;
    const fadeTo = (action) => {
      if (!action || action === currentAction) return;
      const prev = currentAction;
      currentAction = action;
      if (prev) prev.fadeOut(FADE_S);
      action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(FADE_S).play();
    };

    (async () => {
      try {
        const base = await loadFBX(BASE_URL);
        if (disposed) return;
        wrapper.add(base);
        mixer = new THREE.AnimationMixer(base);
        if (base.animations[0]) {
          actions.idle = mixer.clipAction(base.animations[0]);
          fadeTo(actions.idle);
        }
        setLoaded(true);

        // clipes extras são opcionais — se o arquivo ainda não existir (usuário não baixou do
        // Mixamo ainda), ignora em silêncio e o modo correspondente cai pro "idle" acima.
        await Promise.all(
          Object.entries(CLIP_URLS).map(async ([key, url]) => {
            try {
              const obj = await loadFBX(url);
              if (disposed || !obj.animations[0]) return;
              actions[key] = mixer.clipAction(obj.animations[0]);
            } catch {
              // arquivo ainda não entregue — sem problema, fica no idle pra esse modo
            }
          })
        );
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
    let lastMode = null;
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const m = modeRef.current;
      rim.color.setHex(MODE_TINT[m] || MODE_TINT.idle);
      if (m !== lastMode) {
        lastMode = m;
        fadeTo(actions[m] || actions.idle);
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
    </div>
  );
}
