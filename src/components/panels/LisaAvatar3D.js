"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mono } from "@/lib/theme.js";

const MODEL_URL = "/models/lisa/scene.gltf"; // ver public/models/lisa/license.txt — CC-BY-4.0, crédito obrigatório
const MODE_TINT = { idle: 0x3fd0f2, listening: 0x7bd88f, speaking: 0xff9d3d };

/**
 * "Corpo" 3D da Lisa — modelo estático (sem esqueleto nem blend shapes, ver license.txt: é uma
 * malha única gerada por IA a partir de imagem), então lip-sync de verdade não é possível com
 * ESSE modelo. O que dá pra fazer, e o que isso faz: uma respiração/balanço leve o tempo todo
 * (idle) e um "aceno" mais forte e mais rápido enquanto ela ouve/fala — sincronizado com o
 * `mode` vindo de fora — pra dar sensação de reação à conversa mesmo sem animação de boca.
 *
 * Câmera fica próxima dela por padrão (plano de busto), com OrbitControls habilitado — como eu
 * não tenho como renderizar e ver o resultado antes de entregar, dá pra arrastar/belisc(zoom)
 * pra ajustar o enquadramento na hora, em vez de depender só do valor padrão acertar de primeira.
 */
export default function LisaAvatar3D({ mode = "idle" }) {
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
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20);
    camera.position.set(0, 0.26, 1.0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.25, 0);
    controls.enablePan = false;
    controls.minDistance = 0.35;
    controls.maxDistance = 1.6;
    controls.minPolarAngle = Math.PI * 0.25;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(0.6, 1.1, 1.2);
    scene.add(key);
    // luz de contorno colorida — muda de cor junto com o modo (mesma paleta do resto do app:
    // ciano=idle, verde=ouvindo, laranja=falando), reforçando o estado sem precisar de texto
    const rim = new THREE.DirectionalLight(MODE_TINT.idle, 1.1);
    rim.position.set(-0.6, 0.5, -0.7);
    scene.add(rim);

    const wrapper = new THREE.Group();
    scene.add(wrapper);

    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        wrapper.add(gltf.scene);
        setLoaded(true);
      },
      undefined,
      (err) => { if (!disposed) setError(err?.message || "falha ao carregar o modelo 3D"); }
    );

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
      const t = clock.getElapsedTime();
      const m = modeRef.current;
      rim.color.setHex(MODE_TINT[m] || MODE_TINT.idle);

      // idle: respiração leve o tempo todo. speaking/listening: bob mais rápido/forte por cima
      // — é a "reação à conversa" possível sem esqueleto/blend shape pra lip-sync de verdade.
      const speed = m === "speaking" ? 5.2 : m === "listening" ? 2.6 : 1.1;
      const amp = m === "speaking" ? 0.018 : m === "listening" ? 0.01 : 0.006;
      wrapper.position.y = Math.sin(t * speed) * amp;
      wrapper.rotation.y = Math.sin(t * 0.6) * 0.06 + (m === "speaking" ? Math.sin(t * speed * 0.5) * 0.03 : 0);
      wrapper.rotation.z = m === "listening" ? Math.sin(t * 1.3) * 0.015 : 0;

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
