"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { CY, OR, GR, mono } from "@/lib/theme.js";
import { CHART } from "@/lib/chartPalette.js";
import { drawDashboardPanel } from "@/lib/arCanvasCharts.js";

// Textura do painel — proporção 1600x980 fica legível de longe e não pesa demais como
// textura WebGL num celular. O plano 3D usa a mesma proporção (ver PANEL_W/PANEL_H abaixo).
const TEX_W = 1600, TEX_H = 980;
const PANEL_W = 1.15; // metros — do tamanho de um monitor médio "pendurado" na parede
const PANEL_H = PANEL_W * (TEX_H / TEX_W);
const REFRESH_MS = 45000;

async function loadArData() {
  const [boardsRes, overdueRes, sentinelRes] = await Promise.all([
    fetch("/api/boards-overview").then((r) => r.json()).catch(() => ({ ok: false })),
    fetch("/api/tasks?range=overdue").then((r) => r.json()).catch(() => ({ ok: false })),
    fetch("/api/sentinel/dashboard?project=all").then((r) => r.json()).catch(() => ({ ok: false })),
  ]);
  const boards = boardsRes.ok ? boardsRes.boards || [] : [];
  const overdueTasks = overdueRes.ok ? overdueRes.tasks || [] : [];
  const sentinel = sentinelRes.ok ? sentinelRes : null;

  const kpis = [{ label: "TAREFAS ATRASADAS", value: overdueTasks.length, critical: overdueTasks.length > 0 }];
  if (sentinel) {
    const breached = (sentinel.sla?.responseBreached || 0) + (sentinel.sla?.resolutionBreached || 0);
    const closedLike = (sentinel.byStatus?.["Resolvido"] || 0) + (sentinel.byStatus?.["Fechado"] || 0);
    const total = Object.values(sentinel.byStatus || {}).reduce((s, n) => s + n, 0);
    kpis.push({ label: "SLA ESTOURADO", value: breached, critical: breached > 0 });
    kpis.push({ label: "TICKETS ABERTOS", value: Math.max(0, total - closedLike), critical: false });
  }

  const pieRows = boards.map((b) => ({ key: b.board, label: b.board, value: b.total || 0 }));

  const boardsBarRows = boards
    .map((b) => ({
      key: b.board, label: b.board,
      values: [Math.max(0, (b.open || 0) - (b.overdue || 0)), b.overdue || 0, b.done || 0],
    }))
    .sort((a, b) => (b.values[0] + b.values[1] + b.values[2]) - (a.values[0] + a.values[1] + a.values[2]));
  const barsSeries = [
    { key: "ontime", name: "No prazo", color: CHART.categorical[0] },
    { key: "overdue", name: "Atrasado", color: CHART.status.critical },
    { key: "done", name: "Concluído", color: CHART.categorical[2] },
  ];

  const line = sentinel && sentinel.trend
    ? {
        title: "SENTINELA · ABERTOS × RESOLVIDOS (21D)",
        points: sentinel.trend,
        series: [
          { key: "opened", name: "Abertos", color: CHART.categorical[0] },
          { key: "resolved", name: "Resolvidos", color: CHART.categorical[2] },
        ],
      }
    : null;

  return {
    updatedLabel: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date()),
    kpis,
    pie: { title: "CARDS POR BOARD", rows: pieRows },
    line,
    bars: { title: "CARGA POR BOARD · NO PRAZO × ATRASADO × CONCLUÍDO", rows: boardsBarRows, series: barsSeries },
  };
}

/**
 * Dashboard em Realidade Aumentada (WebXR): aponta a câmera pra uma superfície (parede, mesa),
 * toca na tela pra "fixar" o painel do dashboard ali, e ele fica ancorado enquanto você anda
 * pela sala — como um monitor virtual. Só funciona no Chrome/Android com suporte a ARCore;
 * WebXR immersive-ar não existe no Safari/iOS (ver aviso abaixo quando não suportado).
 */
export default function DashboardArPage() {
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const xr = useRef({}); // guarda tudo que é imperativo (renderer, scene, session, refs do three.js) fora do ciclo do React

  const [supported, setSupported] = useState(null); // null=checando, true/false
  const [active, setActive] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.xr) { setSupported(false); return; }
    navigator.xr.isSessionSupported("immersive-ar").then(setSupported).catch(() => setSupported(false));
  }, []);

  const lastDataRef = useRef(null); // último dado carregado — usado pra redesenhar a prévia assim que ela remonta (ex: ao sair do AR)

  // busca os dados reais (mesmas fontes ao vivo do Dashboard normal) e redesenha a textura;
  // roda de cara (pra prévia) e continua rodando enquanto a sessão AR estiver ativa.
  const refreshData = useCallback(async () => {
    try {
      const data = await loadArData();
      lastDataRef.current = data;
      const canvas = xr.current.texCanvas || previewCanvasRef.current;
      if (canvas) {
        drawDashboardPanel(canvas, data);
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
      if (lastDataRef.current) drawDashboardPanel(node, lastDataRef.current);
    }
  }, []);

  useEffect(() => {
    document.fonts?.ready?.then(refreshData) ?? refreshData();
    const id = setInterval(refreshData, REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshData]);

  const cleanupAr = useCallback(() => {
    const s = xr.current;
    if (s.renderer) s.renderer.setAnimationLoop(null);
    if (s.hitTestSource) { s.hitTestSource.cancel?.(); s.hitTestSource = null; }
    if (s.renderer?.domElement?.parentNode) s.renderer.domElement.parentNode.removeChild(s.renderer.domElement);
    if (s.renderer) s.renderer.dispose();
    xr.current = {};
    setActive(false);
    setPlaced(false);
  }, []);

  useEffect(() => () => cleanupAr(), [cleanupAr]); // garante limpeza se sair da página com a sessão aberta

  const startAr = useCallback(async () => {
    setErr(null);
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
        new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2),
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
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
      );
      panel.visible = false;
      panel.matrixAutoUpdate = true;
      scene.add(panel);

      xr.current = { renderer, scene, camera, reticle, panel, texture, texCanvas };

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

      const controller = renderer.xr.getController(0);
      controller.addEventListener("select", () => {
        if (!reticle.visible) return;
        panel.position.setFromMatrixPosition(reticle.matrix);
        panel.quaternion.setFromRotationMatrix(reticle.matrix);
        panel.visible = true;
        setPlaced(true);
      });
      scene.add(controller);

      renderer.setAnimationLoop((_ts, frame) => {
        if (frame && xr.current.hitTestSource) {
          const results = frame.getHitTestResults(xr.current.hitTestSource);
          if (results.length > 0) {
            const pose = results[0].getPose(referenceSpace);
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
          } else {
            reticle.visible = false;
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
  }, [cleanupAr, refreshData]);

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
            <div style={{ position: "absolute", top: 18, left: 18, right: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ ...mono, fontSize: 11, letterSpacing: 1.5, color: "#fff", background: "rgba(0,0,0,0.55)", padding: "8px 12px", borderRadius: 6, maxWidth: 260 }}>
                {placed ? "◈ painel fixado — toque de novo pra reposicionar" : "◈ aponte pra uma parede ou mesa e toque na tela pra fixar o painel"}
              </div>
              <button
                onClick={stopAr}
                style={{ ...mono, fontSize: 11, letterSpacing: 1.5, padding: "8px 14px", border: "1px solid #fff", borderRadius: 6, background: "rgba(0,0,0,0.55)", color: "#fff", cursor: "pointer" }}
              >
                ✕ SAIR
              </button>
            </div>
          </>
        )}
      </div>

      {!active && (
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
              <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 16, maxWidth: 560, color: "rgba(207,239,251,0.8)" }}>
                Aponte a câmera pra uma parede ou mesa, toque na tela pra fixar o painel ali, e ele fica "pendurado"
                enquanto você anda pela sala — os mesmos gráficos do Dashboard normal (cards por board, carga por
                board, tendência do Sentinela), atualizando sozinho a cada {Math.round(REFRESH_MS / 1000)}s.
              </div>
              <button
                onClick={startAr}
                style={{ ...mono, fontSize: 12, letterSpacing: 2, padding: "12px 22px", border: `1px solid ${GR}`, borderRadius: 6, background: "rgba(123,216,143,0.12)", color: GR, cursor: "pointer", marginBottom: 20 }}
              >
                ▣ INICIAR AR
              </button>
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
