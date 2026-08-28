"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { getDeviceId } from "@/lib/deviceId.js";
import { buildArMarkerPayload } from "@/lib/arMarker.js";
import { mono } from "@/lib/theme.js";

/**
 * QR discreto no canto do MODO TV — é o que deixa o modo AR reconhecer "esta é a tela do
 * Beyond Bits" de forma confiável (ver src/app/(panels)/dashboard/ar/page.js e
 * src/lib/arMarker.js: WebXR não dá acesso a pixel bruto de câmera pra reconhecer sem
 * marcador, então isso substitui "visão computacional genérica" por algo que realmente
 * funciona — BarcodeDetector é bem suportado no Chrome/Android).
 */
export default function TvArMarker() {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const payload = buildArMarkerPayload(getDeviceId());
    QRCode.toCanvas(canvasRef.current, payload, { width: 96, margin: 1, color: { dark: "#000000", light: "#ffffff" } }).catch(() => {});
  }, []);

  return (
    <div
      style={{
        position: "fixed", right: 18, bottom: 18, zIndex: 40,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        padding: 8, borderRadius: 8, background: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      <canvas ref={canvasRef} width={96} height={96} style={{ display: "block" }} />
      <div style={{ ...mono, fontSize: 7.5, letterSpacing: 1, color: "#000" }}>ESCANEIE NO AR</div>
    </div>
  );
}
