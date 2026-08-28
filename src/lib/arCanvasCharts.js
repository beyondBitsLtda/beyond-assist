// Primitivas de desenho do painel AR em Canvas 2D (compostas pelo "chrome" em
// src/lib/arPanelRenderer.js, que monta a moldura + barra de abas + conteúdo de cada tela).
// Não dá pra reaproveitar os componentes SVG (PieChart.js/LineChart.js/HBarChart.js) direto:
// SVG data-URI desenhado num canvas pode "contaminar" a textura e quebrar o uso em WebGL —
// então isso é uma reimplementação enxuta em Canvas 2D dos mesmos tipos de gráfico, com a
// mesma paleta (src/lib/chartPalette.js).

export const INK = "#eafcff";
export const INK_DIM = "rgba(207,239,251,0.55)";
export const INK_FAINT = "rgba(207,239,251,0.3)";
export const LINE = "rgba(207,239,251,0.12)";
export const MONO = "'JetBrains Mono', ui-monospace, monospace";
export const SANS = "'Rajdhani', sans-serif";

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function panelBox(ctx, x, y, w, h, title, accent) {
  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  ctx.fill();
  ctx.strokeStyle = "rgba(207,239,251,0.14)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = accent || "#3fd0f2";
  ctx.font = `600 20px ${MONO}`;
  ctx.textBaseline = "top";
  ctx.fillText(title, x + 22, y + 18);
}

export function drawDonut(ctx, cx, cy, R, r, rows) {
  const total = rows.reduce((s, x) => s + x.value, 0);
  if (!rows.length || total <= 0) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `20px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText("sem dados ainda.", cx, cy);
    ctx.textAlign = "left";
    return;
  }
  const gap = rows.length > 1 ? 0.02 : 0;
  let angle = -Math.PI / 2;
  for (const row of rows) {
    const frac = row.value / total;
    const start = angle + gap / 2;
    const end = angle + frac * Math.PI * 2 - gap / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, start, end);
    ctx.arc(cx, cy, r, end, start, true);
    ctx.closePath();
    ctx.fillStyle = row.color;
    ctx.fill();
    angle += frac * Math.PI * 2;
  }
  ctx.fillStyle = INK;
  ctx.font = `700 44px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(total), cx, cy - 8);
  ctx.fillStyle = INK_DIM;
  ctx.font = `16px ${MONO}`;
  ctx.fillText("total", cx, cy + 26);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function drawLegend(ctx, x, y, w, rows, formatValue) {
  const total = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  let cy = y;
  for (const row of rows) {
    ctx.fillStyle = row.color;
    roundRect(ctx, x, cy, 16, 16, 3);
    ctx.fill();
    ctx.fillStyle = INK_DIM;
    ctx.font = `18px ${SANS}`;
    const pct = total > 0 && row.value != null ? ` · ${Math.round((row.value / total) * 100)}%` : "";
    const label = `${row.label}${row.value != null ? `  ${formatValue(row.value)}${pct}` : ""}`;
    ctx.fillText(label.length > 40 ? label.slice(0, 39) + "…" : label, x + 24, cy + 14);
    cy += 30;
    if (cy > y + w) break; // limite de segurança se vier muita linha
  }
}

export function drawLine(ctx, x, y, w, h, points, series) {
  if (!points.length) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `20px ${SANS}`;
    ctx.fillText("sem dados ainda.", x + w / 2 - 90, y + h / 2);
    return;
  }
  const padL = 46, padR = 10, padT = 10, padB = 34;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const maxY = Math.max(1, ...points.flatMap((p) => series.map((s) => p.values[s.key] || 0)));
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
  const xAt = (i) => x + padL + i * stepX;
  const yAt = (v) => y + padT + plotH - (v / maxY) * plotH;

  // grade
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  [0, 0.5, 1].forEach((f) => {
    const gy = y + padT + plotH * (1 - f);
    ctx.beginPath();
    ctx.moveTo(x + padL, gy);
    ctx.lineTo(x + w - padR, gy);
    ctx.stroke();
  });
  ctx.fillStyle = INK_FAINT;
  ctx.font = `14px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(String(maxY), x + padL - 6, y + padT + 5);
  ctx.fillText("0", x + padL - 6, y + padT + plotH);
  ctx.textAlign = "left";

  for (const s of series) {
    ctx.beginPath();
    points.forEach((p, i) => {
      const px = xAt(i), py = yAt(p.values[s.key] || 0);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // legenda
  let lx = x + padL;
  for (const s of series) {
    ctx.fillStyle = s.color;
    ctx.fillRect(lx, y - 6, 18, 4);
    ctx.fillStyle = INK_DIM;
    ctx.font = `16px ${SANS}`;
    ctx.fillText(s.name, lx + 24, y - 2);
    lx += ctx.measureText(s.name).width + 60;
  }

  // rótulos do eixo X — no máximo ~6
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  ctx.fillStyle = INK_FAINT;
  ctx.font = `13px ${MONO}`;
  ctx.textAlign = "center";
  points.forEach((p, i) => {
    if (i % labelEvery === 0 || i === points.length - 1) ctx.fillText(p.x, xAt(i), y + h - 8);
  });
  ctx.textAlign = "left";
}

export function drawHBars(ctx, x, y, w, h, rows, series, formatValue) {
  if (!rows.length) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `20px ${SANS}`;
    ctx.fillText("sem dados ainda.", x + w / 2 - 90, y + h / 2);
    return;
  }
  const maxValue = Math.max(1, ...rows.flatMap((r) => r.values));
  const labelW = 190, trackW = w - labelW - 90;
  const rowH = Math.min(46, (h - 10) / rows.length);
  const barH = series.length >= 2 ? (rowH - 10) / series.length : rowH - 14;

  rows.forEach((row, ri) => {
    const ry = y + ri * rowH;
    ctx.fillStyle = INK_DIM;
    ctx.font = `16px ${SANS}`;
    const label = row.label.length > 22 ? row.label.slice(0, 21) + "…" : row.label;
    ctx.fillText(label, x, ry + rowH / 2 + 5);

    row.values.forEach((v, si) => {
      const s = series[si];
      const bw = Math.max(2, (v / maxValue) * trackW);
      const by = series.length >= 2 ? ry + 4 + si * (barH + 2) : ry + 7;
      ctx.fillStyle = s.color;
      roundRect(ctx, x + labelW, by, bw, barH, 3);
      ctx.fill();
      if (v > 0) {
        ctx.fillStyle = INK;
        ctx.font = `14px ${MONO}`;
        ctx.fillText(String(v), x + labelW + bw + 8, by + barH - 3);
      }
    });
  });

  if (series.length >= 2) {
    let lx = x + labelW;
    const ly = y - 6;
    for (const s of series) {
      ctx.fillStyle = s.color;
      ctx.fillRect(lx, ly - 10, 14, 14);
      ctx.fillStyle = INK_DIM;
      ctx.font = `14px ${SANS}`;
      ctx.fillText(s.name, lx + 20, ly + 2);
      lx += ctx.measureText(s.name).width + 46;
    }
  }
}
