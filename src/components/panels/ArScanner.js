"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GR, mono } from "@/lib/theme.js";
import { parseArMarkerPayload } from "@/lib/arMarker.js";
import { loadArKpis } from "@/lib/arDashboardData.js";
import { drawScanOverlay } from "@/lib/qrPseudo3d.js";

const DETECT_MS = 350; // o QR não muda a cada frame — não precisa detectar a 60fps, só reagir rápido o bastante
const AUTO_PROCEED_MS = 500; // detecção estável por esse tempo → já projeta sozinho, sem esperar toque

/**
 * Fase de "reconhecimento": câmera comum (getUserMedia, sem WebXR ainda) procurando o QR do
 * MODO TV (ver src/components/panels/TvArMarker.js) via BarcodeDetector — API nativa do
 * Chrome/Android, bem mais confiável que tentar "reconhecer a tela só de olhar" (o WebXR não
 * dá acesso a pixel bruto de câmera por privacidade, então isso não seria possível de verdade).
 * Assim que o QR fica estável na mira por meio segundo, já entra sozinho em AR e projeta o
 * painel ali — sem precisar tocar em nada (mira → projeta, num gesto só).
 */
export default function ArScanner({ onProceed, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const boxRef = useRef({ scale: 1 });
  const detectorRef = useRef(null);
  const kpisRef = useRef([]);
  const matchedRef = useRef(null); // { deviceId, corners, lastSeen }
  const firstMatchAtRef = useRef(null); // quando o QR atual começou a ser visto sem interrupção
  const proceededRef = useRef(false);
  const rafRef = useRef(null);
  const intervalRef = useRef(null);
  const doProceedRef = useRef(null); // setado depois de declarar stopAndProceed, chamado da tick de detecção

  const [supported, setSupported] = useState(null); // null=checando
  const [status, setStatus] = useState("starting"); // "starting" | "scanning" | "matched" | "error"
  const [err, setErr] = useState(null);

  // mapeamento vídeo→canvas (letterbox, sem cortar nada — precisa ser exato pra desenhar o
  // overlay 3D em cima do QR de verdade, não num lugar aproximado)
  const recalcBox = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return;
    const cw = window.innerWidth, ch = window.innerHeight;
    const scale = Math.min(cw / v.videoWidth, ch / v.videoHeight);
    const w = v.videoWidth * scale, h = v.videoHeight * scale;
    const left = (cw - w) / 2, top = (ch - h) / 2;
    v.style.width = `${w}px`; v.style.height = `${h}px`; v.style.left = `${left}px`; v.style.top = `${top}px`;
    c.width = w; c.height = h; c.style.left = `${left}px`; c.style.top = `${top}px`;
    boxRef.current = { scale };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported("BarcodeDetector" in window);
  }, []);

  useEffect(() => {
    if (supported !== true) return;
    let cancelled = false;
    const onResize = () => recalcBox();
    window.addEventListener("resize", onResize);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play();
        recalcBox();
        detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
        setStatus("scanning");
        loadArKpis().then((k) => { kpisRef.current = k; }).catch(() => {});

        // para a câmera do scanner ANTES de entrar em WebXR — dois consumidores de câmera ao
        // mesmo tempo não são confiáveis no celular (a sessão AR pode falhar em pegar a câmera) —
        // e dispara sozinho quando o QR fica estável, sem esperar toque (ver AUTO_PROCEED_MS)
        const doProceed = () => {
          if (proceededRef.current) return;
          proceededRef.current = true;
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          onProceed?.(matchedRef.current?.deviceId || null);
        };
        doProceedRef.current = doProceed;

        intervalRef.current = setInterval(async () => {
          if (cancelled) return;
          try {
            const codes = await detectorRef.current.detect(v);
            const hit = codes.find((c) => parseArMarkerPayload(c.rawValue));
            if (hit) {
              const info = parseArMarkerPayload(hit.rawValue);
              const { scale } = boxRef.current;
              const corners = hit.cornerPoints.map((p) => ({ x: p.x * scale, y: p.y * scale }));
              matchedRef.current = { deviceId: info.deviceId, corners, lastSeen: performance.now() };
              if (firstMatchAtRef.current == null) firstMatchAtRef.current = performance.now();
              setStatus("matched");
              if (performance.now() - firstMatchAtRef.current >= AUTO_PROCEED_MS) doProceed();
            }
          } catch {
            // detect() pode falhar num frame isolado (câmera ainda ajustando foco/exposição) — tenta de novo no próximo tick
          }
        }, DETECT_MS);

        const draw = () => {
          const ctx = canvasRef.current?.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            const m = matchedRef.current;
            if (m && performance.now() - m.lastSeen < 1200) {
              drawScanOverlay(ctx, m.corners, kpisRef.current, performance.now());
            } else if (m) {
              matchedRef.current = null;
              firstMatchAtRef.current = null; // perdeu antes de estabilizar — precisa recomeçar a contagem
              setStatus("scanning"); // perdeu o QR de vista — volta a procurar
            }
          }
          rafRef.current = requestAnimationFrame(draw);
        };
        rafRef.current = requestAnimationFrame(draw);
      } catch (e) {
        if (!cancelled) { setErr(e?.message || "Não foi possível acessar a câmera."); setStatus("error"); }
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [supported, recalcBox, onProceed]);

  const stopAndProceed = useCallback(() => {
    doProceedRef.current?.();
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <video ref={videoRef} playsInline muted style={{ position: "absolute" }} />
      <canvas ref={canvasRef} style={{ position: "absolute", pointerEvents: "none" }} />

      <div style={{ position: "absolute", top: 18, left: 18, right: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 1, color: "#fff", background: "rgba(0,0,0,0.6)", padding: "8px 12px", borderRadius: 6, maxWidth: 280, lineHeight: 1.5 }}>
          {status === "matched" ? "✅ reconhecido — projetando…" : status === "scanning" ? "🔍 procurando o QR do MODO TV…" : status === "error" ? `⚠ ${err}` : "iniciando câmera…"}
        </div>
        <button onClick={onCancel} style={{ ...mono, fontSize: 11, letterSpacing: 1.5, padding: "8px 14px", border: "1px solid #fff", borderRadius: 6, background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", flex: "none" }}>
          ✕ CANCELAR
        </button>
      </div>

      {supported === false && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ ...mono, fontSize: 12, color: "#fff", textAlign: "center", maxWidth: 320, lineHeight: 1.6 }}>
            ⚠ este navegador não suporta leitura de QR (BarcodeDetector). Use o Chrome no Android, ou volte e escolha "AR direto".
          </div>
        </div>
      )}

      {status === "matched" && (
        <div style={{ position: "absolute", left: 18, right: 18, bottom: 22, display: "flex", justifyContent: "center" }}>
          <button
            onClick={stopAndProceed}
            style={{ ...mono, fontSize: 13, letterSpacing: 2, padding: "14px 28px", borderRadius: 30, border: `1.5px solid ${GR}`, background: "rgba(123,216,143,0.25)", color: "#fff", cursor: "pointer" }}
          >
            ▣ PROJETAR VIA AR
          </button>
        </div>
      )}
    </div>
  );
}
