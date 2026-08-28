// Desenha a reação "pop-up 3D" sobre a pré-visualização de câmera (Canvas 2D puro, sem WebXR
// — essa fase roda ANTES de entrar em AR de verdade, ver src/app/(panels)/dashboard/ar/page.js)
// no instante em que o QR do MODO TV é reconhecido: um contorno pulsante no marcador + umas
// barrinhas com "cara de 3D" (extrusão falsa via poligono, sem engine 3D nenhuma) flutuando
// acima dele, com os KPIs reais.

const INK = "#eafcff";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

function lerp(a, b, t) { return a + (b - a) * t; }
function pt(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }

/** Um "bloco 3D" barato: 3 faces (frente/topo/lado) via poligono, sem geometria 3D real. */
function drawBlock(ctx, baseX, baseY, w, h, depth, color) {
  const dx = depth * 0.55, dy = -depth * 0.4; // vetor de "profundidade" falso (isométrico simples)
  // face frontal
  ctx.beginPath();
  ctx.rect(baseX, baseY - h, w, h);
  ctx.fillStyle = color;
  ctx.fill();
  // topo
  ctx.beginPath();
  ctx.moveTo(baseX, baseY - h);
  ctx.lineTo(baseX + dx, baseY - h + dy);
  ctx.lineTo(baseX + w + dx, baseY - h + dy);
  ctx.lineTo(baseX + w, baseY - h);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();
  // lado
  ctx.beginPath();
  ctx.moveTo(baseX + w, baseY - h);
  ctx.lineTo(baseX + w + dx, baseY - h + dy);
  ctx.lineTo(baseX + w + dx, baseY + dy);
  ctx.lineTo(baseX + w, baseY);
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fill();
}

/**
 * corners: 4 pontos {x,y} em espaço do canvas (já escalados), na ordem que o BarcodeDetector
 * devolve (tipicamente TL,TR,BR,BL — não é garantido entre navegadores, mas serve só de
 * referência visual aproximada, não precisão de tracking).
 */
export function drawScanOverlay(ctx, corners, kpis, tMs) {
  if (!corners || corners.length < 4) return;
  const [tl, tr, br, bl] = corners;
  const cx = (tl.x + tr.x + br.x + bl.x) / 4;
  const cy = (tl.y + tr.y + br.y + bl.y) / 4;
  const markerW = Math.hypot(tr.x - tl.x, tr.y - tl.y) || 60;
  const up = { x: (tl.x - bl.x) / 2 + (tr.x - br.x) / 2, y: (tl.y - bl.y) / 2 + (tr.y - br.y) / 2 };
  const upLen = Math.hypot(up.x, up.y) || 1;
  const upN = { x: up.x / upLen, y: up.y / upLen };

  // contorno pulsante no marcador detectado
  const pulse = 0.5 + 0.5 * Math.sin(tMs / 260);
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y); ctx.closePath();
  ctx.strokeStyle = `rgba(63,208,242,${0.55 + 0.35 * pulse})`;
  ctx.lineWidth = 3;
  ctx.stroke();

  // barrinhas "3D" flutuando acima do marcador, uma por KPI
  const scale = Math.max(0.5, Math.min(2.2, markerW / 90));
  const barW = 26 * scale, gap = 14 * scale;
  const totalW = kpis.length * barW + (kpis.length - 1) * gap;
  const originX = cx - totalW / 2;
  const originY = cy - upN.y * (markerW * 1.6 + 40 * scale) - 20 * scale * (1 - pulse * 0.15);
  const maxVal = Math.max(1, ...kpis.map((k) => k.value));
  const colors = ["#3987e5", "#e66767", "#d95926", "#199e70"];

  kpis.forEach((k, i) => {
    const h = 18 * scale + (k.value / maxVal) * 70 * scale;
    const bx = originX + i * (barW + gap);
    drawBlock(ctx, bx, originY, barW, h, barW * 0.8, k.critical ? "#e66767" : colors[i % colors.length]);
    ctx.fillStyle = INK;
    ctx.font = `700 ${13 * scale}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.fillText(String(k.value), bx + barW / 2, originY - h - 8 * scale);
    ctx.font = `${9 * scale}px ${MONO}`;
    ctx.fillStyle = "rgba(234,252,255,0.75)";
    const label = k.label.length > 14 ? k.label.slice(0, 13) + "…" : k.label;
    ctx.fillText(label, bx + barW / 2, originY + 14 * scale);
    ctx.textAlign = "left";
  });
}
