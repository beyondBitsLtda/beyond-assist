// Marcador do "MODO TV" pro reconhecimento de tela no AR (ver src/app/(panels)/dashboard/ar/page.js).
// O WebXR não dá acesso a pixel bruto de câmera pra reconhecer a tela "só de olhar" — por
// privacidade, de propósito, não é limitação de esforço — então a identificação confiável usa
// um QR code discreto (BarcodeDetector, bem suportado no Chrome/Android) em vez de visão
// computacional genérica.
export const AR_MARKER_PREFIX = "bb-ar:v1:";

export function buildArMarkerPayload(deviceId) {
  return `${AR_MARKER_PREFIX}${deviceId || "tv"}`;
}

export function parseArMarkerPayload(raw) {
  if (typeof raw !== "string" || !raw.startsWith(AR_MARKER_PREFIX)) return null;
  const deviceId = raw.slice(AR_MARKER_PREFIX.length);
  return deviceId ? { deviceId } : null;
}
