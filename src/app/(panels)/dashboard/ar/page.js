"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";
import { drawArPanel } from "@/lib/arPanelRenderer.js";
import { loadArScreenPayload } from "@/lib/arDashboardData.js";
import { AR_SCREENS, getTabHotspots } from "@/lib/arNav.js";
import ArScanner from "@/components/panels/ArScanner.js";

// Textura do painel — proporção 1600x980 fica legível de longe e não pesa demais como
// textura WebGL num celular. O plano 3D usa a mesma proporção (ver PANEL_W/PANEL_H abaixo).
const TEX_W = 1600, TEX_H = 980;
const PANEL_W = 1.15; // metros — do tamanho de um monitor médio "pendurado" na parede
const PANEL_H = PANEL_W * (TEX_H / TEX_W);
const REFRESH_MS = 45000;
const SCALE_MIN = 0.4, SCALE_MAX = 2.5;
const TAB_HOTSPOTS = getTabHotspots(TEX_W); // fixo — só depende da largura da textura, não dos dados
const TAP_MOVE_PX = 14, TAP_MS = 450; // limites pra distinguir "toque" (navega) de "arrastar" (reposiciona)

/** Raycast do toque na tela até o painel 3D → coordenadas UV → pixel do canvas (1600x980) —
 * é o que permite "apontar pra figura projetada" virar um clique de verdade numa aba. */
function hitTestPanelTap(s, clientX, clientY) {
  if (!s.panel || !s.camera || typeof window === "undefined") return null;
  const ndcX = (clientX / window.innerWidth) * 2 - 1;
  const ndcY = -(clientY / window.innerHeight) * 2 + 1;
  const raycaster = s.raycaster || (s.raycaster = new THREE.Raycaster());
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, s.camera);
  const hits = raycaster.intersectObject(s.panel, false);
  if (!hits.length || !hits[0].uv) return null;
  return { x: hits[0].uv.x * TEX_W, y: (1 - hits[0].uv.y) * TEX_H };
}

/**
 * Dashboard em Realidade Aumentada (WebXR): aponta a câmera pra uma superfície (parede, mesa),
 * fixa o painel ali e ainda ajusta a mão — arrasta com 1 dedo pra mover, belisca com 2 pra
 * redimensionar, gira com 2 dedos pra rotacionar. Só funciona no Chrome/Android (ARCore);
 * WebXR immersive-ar não existe no Safari/iOS (ver aviso abaixo quando não suportado).
 *
 * Fluxo em 2 fases:
 *  1. "aiming" — o painel (semitransparente) segue em tempo real a superfície detectada sob a
 *     mira, tipo um "fantasma" — dá pra ver exatamente onde vai cair ANTES de fixar.
 *  2. "placed" — o painel fica congelado onde foi fixado, e passa a responder a gestos de toque
 *     (arrastar/beliscar/girar) pra ajuste fino, sem depender de acertar o hit-test de novo.
 */
export default function DashboardArPage() {
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const xr = useRef({}); // guarda tudo que é imperativo (renderer, scene, session, refs do three.js, gestos) fora do ciclo do React

  const [supported, setSupported] = useState(null); // null=checando, true/false
  const [phase, setPhase] = useState("landing"); // "landing" | "scanning" | (WebXR ativo, ver `active`)
  const [active, setActive] = useState(false);
  const [arMode, setArMode] = useState("aiming"); // "aiming" | "placed"
  const [reticleVisible, setReticleVisible] = useState(false);
  const [pairedWith, setPairedWith] = useState(null); // deviceId do QR reconhecido no scanner (null = AR direto, sem parear)
  const [activeScreen, setActiveScreen] = useState("dashboard"); // aba do painel projetado — ver src/lib/arNav.js
  const activeScreenRef = useRef("dashboard"); // espelha activeScreen pros closures do refreshData/onPointerUp (evita estado velho)
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.xr) { setSupported(false); return; }
    navigator.xr.isSessionSupported("immersive-ar").then(setSupported).catch(() => setSupported(false));
  }, []);

  const lastDataRef = useRef(null); // último payload carregado — usado pra redesenhar a prévia assim que ela remonta (ex: ao sair do AR)

  // busca os dados reais da aba ATIVA (mesmas fontes ao vivo do Dashboard normal, ver
  // src/lib/arDashboardData.js) e redesenha a textura; roda de cara (pra prévia), de novo
  // sempre que a aba muda (ver useEffect abaixo), e continua rodando enquanto o AR está ativo.
  const refreshData = useCallback(async () => {
    try {
      const data = await loadArScreenPayload(activeScreenRef.current);
      lastDataRef.current = data;
      const canvas = xr.current.texCanvas || previewCanvasRef.current;
      if (canvas) {
        const { hotspots } = drawArPanel(canvas, data);
        xr.current.hotspots = hotspots;
        if (xr.current.texture) xr.current.texture.needsUpdate = true;
      }
    } catch {
      // silencioso — só tenta de novo no próximo ciclo, não derruba a sessão AR por causa disso
    }
  }, []);

  // ref-callback (não useRef simples): a prévia desmonta/remonta quando entra e sai do AR,
  // então precisa redimensionar e redesenhar a cada montagem, não só uma vez no mount do componente.
  const setPreviewCanvas = useCallback((node) => {
    previewCanvasRef.current = node;
    if (node) {
      node.width = TEX_W;
      node.height = TEX_H;
      if (lastDataRef.current) drawArPanel(node, lastDataRef.current);
    }
  }, []);

  useEffect(() => {
    document.fonts?.ready?.then(refreshData) ?? refreshData();
    const id = setInterval(refreshData, REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshData]);

  // trocar de aba (toque numa aba do painel, ou pelos botões da tela de pouso) busca na hora,
  // sem esperar os 45s do ciclo automático — sensação de navegação, não de "esperar carregar".
  useEffect(() => {
    activeScreenRef.current = activeScreen;
    refreshData();
  }, [activeScreen, refreshData]);

  const cleanupAr = useCallback(() => {
    const s = xr.current;
    if (s.renderer) s.renderer.setAnimationLoop(null);
    if (s.hitTestSource) { s.hitTestSource.cancel?.(); s.hitTestSource = null; }
    if (s.transientHitTestSource) { s.transientHitTestSource.cancel?.(); s.transientHitTestSource = null; }
    if (s.renderer?.domElement?.parentNode) s.renderer.domElement.parentNode.removeChild(s.renderer.domElement);
    if (s.renderer) s.renderer.dispose();
    xr.current = {};
    setActive(false);
    setArMode("aiming");
    setReticleVisible(false);
    setPhase("landing");
    setPairedWith(null);
    setActiveScreen("dashboard");
  }, []);

  useEffect(() => () => cleanupAr(), [cleanupAr]); // garante limpeza se sair da página com a sessão aberta

  // fixa o painel na pose atual da mira — reseta escala/giro (sempre parte "do zero" ao fixar,
  // o ajuste fino por gesto acontece DEPOIS, na fase "placed")
  const lockPanel = useCallback(() => {
    const s = xr.current;
    if (!s.reticle?.visible || !s.panel) return;
    s.panel.position.setFromMatrixPosition(s.reticle.matrix);
    s.panel.quaternion.setFromRotationMatrix(s.reticle.matrix);
    s.panel.scale.setScalar(1);
    s.panel.visible = true;
    s.panel.material.opacity = 1;
    s.mode = "placed";
    setArMode("placed");
  }, []);

  // volta a fase de mira: o painel passa a seguir a superfície detectada em tempo real de novo
  // (e volta a ficar semitransparente — o "fantasma" que distingue mira de fixado)
  const repositionPanel = useCallback(() => {
    const s = xr.current;
    s.mode = "aiming";
    if (s.panel) s.panel.material.opacity = 0.6;
    setArMode("aiming");
  }, []);

  // ---- gestos de toque na fase "placed": TOQUE RÁPIDO (sem arrastar) numa aba navega — ver
  // onPointerUp/hitTestPanelTap; 1 dedo ARRASTANDO gruda em qualquer superfície real (parede,
  // mesa, o que a câmera enxergar, via WebXR Transient Input Hit Test), 2 dedos beliscam
  // (zoom) e giram. O arrasto só "confirma" depois de mexer um pouco (TAP_MOVE_PX) — senão
  // TODO toque, mesmo parado, já reposicionaria o painel antes de dar tempo de virar clique. ----
  const onPointerDown = useCallback((e) => {
    if (xr.current.mode !== "placed") return;
    const g = (xr.current.gesture ||= { pointers: new Map(), downInfo: new Map() });
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    g.downInfo.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    g.singleDragConfirmed = false;
    if (g.pointers.size >= 2) { g.pinchDist = null; g.pinchAngle = null; } // recomeça do zero pra não "pular"
  }, []);

  const onPointerMove = useCallback((e) => {
    const s = xr.current;
    if (s.mode !== "placed" || !s.panel || !s.camera) return;
    const g = s.gesture;
    if (!g || !g.pointers.has(e.pointerId)) return;
    const prev = g.pointers.get(e.pointerId);
    const curr = { x: e.clientX, y: e.clientY };

    if (g.pointers.size === 1) {
      const down = g.downInfo?.get(e.pointerId);
      const moved = down ? Math.hypot(curr.x - down.x, curr.y - down.y) : 999;
      if (moved > TAP_MOVE_PX) g.singleDragConfirmed = true; // passou do limiar — não é mais toque, é arrasto de verdade
      if (g.singleDragConfirmed && s.transientHitTestSource) {
        // com suporte a hit-test por toque, o loop de animação já move o painel seguindo a
        // superfície real sob o dedo a cada frame (ver startAr) — não precisa de nada aqui.
        // Sem suporte (fallback), desliza aproximado dentro do próprio plano onde foi fixado.
      } else if (g.singleDragConfirmed) {
        const camPos = new THREE.Vector3();
        s.camera.getWorldPosition(camPos);
        const dist = camPos.distanceTo(s.panel.position);
        const sens = dist * 0.0018;
        const dx = curr.x - prev.x, dy = curr.y - prev.y;
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(s.panel.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(s.panel.quaternion);
        s.panel.position.addScaledVector(right, dx * sens);
        s.panel.position.addScaledVector(up, -dy * sens);
      }
    } else if (g.pointers.size === 2) {
      // 2 dedos: belisca pra redimensionar, gira pra rotacionar em torno do próprio painel —
      // os dois ao mesmo tempo, como no álbum de fotos de qualquer celular.
      g.pointers.set(e.pointerId, curr);
      const pts = [...g.pointers.values()];
      const [p1, p2] = pts;
      const dist2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const angle2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      if (g.pinchDist != null) {
        const ratio = dist2 / g.pinchDist;
        const newScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, s.panel.scale.x * ratio));
        s.panel.scale.setScalar(newScale);
      }
      if (g.pinchAngle != null) {
        const deltaAngle = angle2 - g.pinchAngle;
        s.panel.rotateOnAxis(new THREE.Vector3(0, 0, 1), -deltaAngle);
      }
      g.pinchDist = dist2;
      g.pinchAngle = angle2;
      return; // já atualizou os dois pointers acima
    }
    g.pointers.set(e.pointerId, curr);
  }, []);

  const onPointerUp = useCallback((e) => {
    const s = xr.current;
    const g = s.gesture;
    if (!g) return;
    const wasSingle = g.pointers.size === 1 && g.pointers.has(e.pointerId) && !g.singleDragConfirmed;
    const down = g.downInfo?.get(e.pointerId);
    g.pointers.delete(e.pointerId);
    g.downInfo?.delete(e.pointerId);
    if (g.pointers.size < 2) { g.pinchDist = null; g.pinchAngle = null; }

    // toque rápido (sem arrastar de verdade) numa aba do painel = navega — "apontar pra
    // figura projetada" virando clique de verdade, via raycast 3D → UV → hotspot da aba.
    if (s.mode === "placed" && wasSingle && down) {
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const dt = performance.now() - down.t;
      if (moved < TAP_MOVE_PX && dt < TAP_MS) {
        const pt = hitTestPanelTap(s, e.clientX, e.clientY);
        if (pt) {
          const hit = TAB_HOTSPOTS.find((h) => pt.x >= h.x && pt.x <= h.x + h.w && pt.y >= h.y && pt.y <= h.y + h.h);
          if (hit) setActiveScreen(hit.key);
        }
      }
    }
  }, []);

  const startAr = useCallback(async (deviceId = null) => {
    setErr(null);
    setPairedWith(deviceId);
    try {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled = true;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      containerRef.current.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.06, 0.075, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x3fd0f2 })
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);

      const texCanvas = document.createElement("canvas");
      texCanvas.width = TEX_W;
      texCanvas.height = TEX_H;
      if (previewCanvasRef.current) texCanvas.getContext("2d").drawImage(previewCanvasRef.current, 0, 0);
      const texture = new THREE.CanvasTexture(texCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(PANEL_W, PANEL_H),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
      );
      panel.visible = false;
      scene.add(panel);

      // veio do scanner de QR (deviceId != null): fixa sozinho assim que achar uma superfície
      // válida na mesma mira, em vez de esperar um toque em FIXAR — "mira no QR e já projeta".
      xr.current = { renderer, scene, camera, reticle, panel, texture, texCanvas, mode: "aiming", autoLock: deviceId != null };

      const sessionInit = {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: overlayRef.current },
      };
      const session = await navigator.xr.requestSession("immersive-ar", sessionInit);
      xr.current.session = session;
      session.addEventListener("end", () => cleanupAr());

      renderer.xr.setReferenceSpaceType("local");
      await renderer.xr.setSession(session);

      const referenceSpace = await session.requestReferenceSpace("local");
      const viewerSpace = await session.requestReferenceSpace("viewer");
      const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      xr.current.hitTestSource = hitTestSource;
      xr.current.referenceSpace = referenceSpace;

      // hit-test "por toque": pra arrastar o painel pra QUALQUER superfície real (parede,
      // mesa, o que for) seguindo o dedo, em vez de só deslizar no próprio plano onde foi
      // fixado — é o que faz "arrastar até a parede" funcionar de verdade.
      try {
        xr.current.transientHitTestSource = await session.requestHitTestSourceForTransientInput({ profile: "generic-touchscreen" });
      } catch {
        xr.current.transientHitTestSource = null; // sem suporte nesse aparelho — arrastar continua funcionando, só sem "grudar" na superfície
      }

      const tmpMat = new THREE.Matrix4(); // reusado no arrasto por hit-test, evita alocar por frame

      let lastReticleVisible = false;
      renderer.setAnimationLoop((_ts, frame) => {
        const s = xr.current;
        if (frame && s.hitTestSource) {
          const results = frame.getHitTestResults(s.hitTestSource);
          if (results.length > 0) {
            const pose = results[0].getPose(referenceSpace);
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
          } else {
            reticle.visible = false;
          }
          if (reticle.visible !== lastReticleVisible) {
            lastReticleVisible = reticle.visible;
            setReticleVisible(reticle.visible);
          }
        }
        // fase "aiming": o painel-fantasma segue a mira ao vivo, pra você ver exatamente
        // onde vai cair antes de tocar em FIXAR — é essa prévia que faltava antes.
        if (s.mode === "aiming") {
          if (reticle.visible) {
            panel.visible = true;
            panel.position.setFromMatrixPosition(reticle.matrix);
            panel.quaternion.setFromRotationMatrix(reticle.matrix);
            // veio do QR: fixa sozinho na 1ª superfície válida encontrada na mesma mira —
            // "aponta pro QR e já projeta", sem esperar um toque em FIXAR.
            if (s.autoLock) { s.autoLock = false; lockPanel(); }
          } else {
            panel.visible = false;
          }
        } else if (s.mode === "placed" && s.gesture?.singleDragConfirmed && s.transientHitTestSource && frame) {
          // arrastando com 1 dedo: gruda o painel na superfície real embaixo do dedo, a cada
          // frame — funciona em parede, mesa, qualquer coisa que a câmera reconheça, não só
          // no plano onde ele foi fixado originalmente.
          const hits = frame.getHitTestResultsForTransientInput(s.transientHitTestSource);
          if (hits.length > 0 && hits[0].results.length > 0) {
            const pose = hits[0].results[0].getPose(referenceSpace);
            tmpMat.fromArray(pose.transform.matrix);
            panel.position.setFromMatrixPosition(tmpMat);
            panel.quaternion.setFromRotationMatrix(tmpMat);
          }
        }
        renderer.render(scene, camera);
      });

      setActive(true);
      refreshData();
    } catch (e) {
      setErr(e?.message || "Não foi possível iniciar a sessão de AR.");
      cleanupAr();
    }
  }, [cleanupAr, refreshData, lockPanel]);

  const stopAr = useCallback(() => {
    xr.current.session?.end?.().catch(() => cleanupAr());
  }, [cleanupAr]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#04070a", overflow: "hidden" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* raiz do dom-overlay: só isso fica visível por cima da câmera durante a sessão AR */}
      <div ref={overlayRef} style={{ position: "fixed", inset: 0, pointerEvents: active ? "auto" : "none" }}>
        {active && (
          <>
            {/* camada full-screen que captura os gestos de arrastar/beliscar/girar na fase
                "placed" — fica atrás dos cartões de UI abaixo na ordem do DOM, então não
                atrapalha os botões (eles ficam por cima onde se sobrepõem). */}
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{ position: "absolute", inset: 0, touchAction: "none" }}
            />

            <div style={{ position: "absolute", top: 18, left: 18, right: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ ...mono, fontSize: 11, letterSpacing: 1, color: "#fff", background: "rgba(0,0,0,0.6)", padding: "8px 12px", borderRadius: 6, maxWidth: 280, lineHeight: 1.5 }}>
                {pairedWith && <div style={{ color: GR, fontSize: 9.5, marginBottom: 3 }}>🔗 pareado via QR</div>}
                {arMode === "aiming"
                  ? reticleVisible
                    ? "◈ mova o celular pra ajustar — toque em FIXAR quando estiver no lugar certo"
                    : "◈ procurando uma superfície… aponte pra uma parede ou mesa bem iluminada"
                  : "◈ fixado — toque numa aba do painel pra navegar · arraste com 1 dedo pra mover (gruda na parede/mesa), belisque/gire com 2 dedos"}
              </div>
              <button
                onClick={stopAr}
                style={{ ...mono, fontSize: 11, letterSpacing: 1.5, padding: "8px 14px", border: "1px solid #fff", borderRadius: 6, background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", flex: "none" }}
              >
                ✕ SAIR
              </button>
            </div>

            <div style={{ position: "absolute", left: 18, right: 18, bottom: 22, display: "flex", justifyContent: "center", gap: 10 }}>
              {arMode === "aiming" ? (
                <button
                  onClick={lockPanel}
                  disabled={!reticleVisible}
                  style={{
                    ...mono, fontSize: 13, letterSpacing: 2, padding: "14px 28px", borderRadius: 30,
                    border: `1.5px solid ${reticleVisible ? GR : "rgba(255,255,255,0.3)"}`,
                    background: reticleVisible ? "rgba(123,216,143,0.25)" : "rgba(255,255,255,0.08)",
                    color: reticleVisible ? "#fff" : "rgba(255,255,255,0.45)",
                    cursor: reticleVisible ? "pointer" : "not-allowed",
                  }}
                >
                  🔒 FIXAR AQUI
                </button>
              ) : (
                <>
                  <button
                    onClick={repositionPanel}
                    style={{ ...mono, fontSize: 11.5, letterSpacing: 1.5, padding: "12px 18px", borderRadius: 24, border: `1.5px solid ${CY}`, background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer" }}
                  >
                    ✎ REPOSICIONAR
                  </button>
                  <button
                    onClick={() => { if (xr.current.panel) xr.current.panel.scale.setScalar(1); }}
                    style={{ ...mono, fontSize: 11.5, letterSpacing: 1.5, padding: "12px 18px", borderRadius: 24, border: `1.5px solid ${PU}`, background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer" }}
                  >
                    ↺ TAMANHO
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {!active && phase === "scanning" && (
        <ArScanner
          onProceed={(deviceId) => { setPhase("landing"); startAr(deviceId); }}
          onCancel={() => setPhase("landing")}
        />
      )}

      {!active && phase === "landing" && (
        <div style={{ position: "relative", zIndex: 2, height: "100%", overflowY: "auto", padding: "28px 24px", color: "#cfeffb", fontFamily: "'Rajdhani',sans-serif" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ ...mono, fontSize: 12, letterSpacing: 3, color: CY }}>◈ DASHBOARD · MODO AR</div>
            <Link href="/dashboard" style={{ ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(207,239,251,0.6)", textDecoration: "none" }}>← voltar</Link>
          </div>

          {supported === null && (
            <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.6)" }}>verificando suporte a AR neste aparelho…</div>
          )}

          {supported === false && (
            <div style={{ border: `1px solid ${OR}55`, borderRadius: 8, padding: "16px 18px", background: "rgba(217,89,38,0.08)", maxWidth: 520 }}>
              <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: OR, marginBottom: 8 }}>⚠ AR NÃO DISPONÍVEL NESTE APARELHO/NAVEGADOR</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                O modo AR usa WebXR, que hoje só existe no <strong>Chrome no Android</strong> (com suporte a ARCore).
                iPhone/Safari não suportam essa tecnologia no navegador — só via app nativo. Abra esta página no
                celular Android, no Chrome, pra usar o modo AR.
              </div>
            </div>
          )}

          {supported === true && (
            <>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 8, maxWidth: 560, color: "rgba(207,239,251,0.8)" }}>
                Se tiver o <strong>MODO TV</strong> do Dashboard aberto numa TV/monitor da sala, aponte a câmera pro QR
                que aparece no canto dele — a Lisa reconhece que é o dashboard e já mostra uns KPIs "flutuando" em
                cima da tela antes mesmo de entrar em AR de verdade.
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 10, maxWidth: 560, color: "rgba(207,239,251,0.55)" }}>
                Depois (com ou sem QR), o painel aparece "fantasma" seguindo a mira em tempo real — toque em
                FIXAR quando estiver no lugar certo, e ajuste com gestos: arrastar (1 dedo, gruda em parede/mesa),
                redimensionar e girar (2 dedos).
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 16, maxWidth: 560, color: "rgba(207,239,251,0.55)" }}>
                O painel projetado tem abas — toque numa delas, apontando pra própria figura, pra navegar entre{" "}
                {AR_SCREENS.map((s) => s.label.toLowerCase()).join(", ")}. Dados ao vivo, atualizando sozinho a
                cada {Math.round(REFRESH_MS / 1000)}s.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                <button
                  onClick={() => setPhase("scanning")}
                  style={{ ...mono, fontSize: 12, letterSpacing: 2, padding: "12px 22px", border: `1px solid ${CY}`, borderRadius: 6, background: "rgba(var(--accent-rgb),0.1)", color: CY, cursor: "pointer" }}
                >
                  🔍 ESCANEAR TELA
                </button>
                <button
                  onClick={() => startAr()}
                  style={{ ...mono, fontSize: 12, letterSpacing: 2, padding: "12px 22px", border: `1px solid ${GR}`, borderRadius: 6, background: "rgba(123,216,143,0.12)", color: GR, cursor: "pointer" }}
                >
                  ▣ AR DIRETO (SEM QR)
                </button>
              </div>
              {err && <div style={{ ...mono, fontSize: 10.5, color: OR, marginBottom: 16 }}>⚠ {err}</div>}
              <div style={{ ...mono, fontSize: 9, letterSpacing: 1.5, color: "rgba(207,239,251,0.4)", marginBottom: 8 }}>PRÉVIA DO PAINEL</div>
              <div style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 10, overflow: "hidden", maxWidth: 640 }}>
                <canvas ref={setPreviewCanvas} style={{ width: "100%", height: "auto", display: "block" }} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
