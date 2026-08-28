import { CHART } from "@/lib/chartPalette.js";
import { getTabHotspots } from "@/lib/arNav.js";
import { roundRect, panelBox, drawDonut, drawLegend, drawLine, drawHBars, INK, INK_DIM, INK_FAINT, MONO, SANS } from "@/lib/arCanvasCharts.js";

const BG_TOP = "#0b1216";
const BG_BOTTOM = "#04070a";
const BODY_Y = 92; // abaixo da barra de abas

function drawChrome(ctx, W, H, updatedLabel) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, BG_TOP);
  grad.addColorStop(1, BG_BOTTOM);
  roundRect(ctx, 0, 0, W, H, 26);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "rgba(63,208,242,0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = INK_FAINT;
  ctx.font = `16px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(updatedLabel || "", W - 24, 20);
  ctx.textAlign = "left";
}

function drawTabs(ctx, tabs, activeKey) {
  for (const t of tabs) {
    const active = t.key === activeKey;
    roundRect(ctx, t.x, t.y, t.w, t.h, 10);
    ctx.fillStyle = active ? "rgba(63,208,242,0.22)" : "rgba(255,255,255,0.03)";
    ctx.fill();
    ctx.strokeStyle = active ? "#3fd0f2" : "rgba(207,239,251,0.16)";
    ctx.lineWidth = active ? 2 : 1.5;
    ctx.stroke();
    ctx.fillStyle = active ? "#eafcff" : "rgba(207,239,251,0.6)";
    ctx.font = `700 15px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${t.glyph} ${t.label}`, t.x + t.w / 2, t.y + t.h / 2 + 1);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawDashboardBody(ctx, W, H, data) {
  const kpiY = BODY_Y, kpiH = 96;
  const kpis = data.kpis || [];
  const kpiW = kpis.length ? (W - 68 - (kpis.length - 1) * 18) / kpis.length : 0;
  kpis.forEach((k, i) => {
    const kx = 34 + i * (kpiW + 18);
    roundRect(ctx, kx, kpiY, kpiW, kpiH, 12);
    ctx.fillStyle = k.critical ? "rgba(230,103,103,0.10)" : "rgba(255,255,255,0.03)";
    ctx.fill();
    ctx.strokeStyle = k.critical ? "rgba(230,103,103,0.5)" : "rgba(207,239,251,0.16)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = k.critical ? "#e66767" : INK;
    ctx.font = `700 40px ${MONO}`;
    ctx.fillText(String(k.value), kx + 20, kpiY + 46);
    ctx.fillStyle = INK_DIM;
    ctx.font = `15px ${MONO}`;
    ctx.fillText(k.label, kx + 20, kpiY + 76);
  });

  const chartsY = kpiY + kpiH + 24;
  const chartsH = 340;
  const leftW = W * 0.42, rightW = W - leftW - 34 * 2 - 20;
  const leftX = 34, rightX = leftX + leftW + 20;

  panelBox(ctx, leftX, chartsY, leftW, chartsH, data.pie?.title || "", "#3987e5");
  const rows = (data.pie?.rows || []).map((r, i) => ({ ...r, color: CHART.categorical[i % CHART.categorical.length] }));
  drawDonut(ctx, leftX + leftW * 0.32, chartsY + chartsH / 2 + 12, 108, 62, rows);
  drawLegend(ctx, leftX + leftW * 0.6, chartsY + 70, chartsH - 90, rows, (n) => String(n));

  if (data.line) {
    panelBox(ctx, rightX, chartsY, rightW, chartsH, data.line.title, "#199e70");
    drawLine(ctx, rightX + 10, chartsY + 56, rightW - 20, chartsH - 70, data.line.points, data.line.series);
  } else if (data.bars) {
    panelBox(ctx, rightX, chartsY, rightW, chartsH, data.bars.title, "#d95926");
    drawHBars(ctx, rightX + 22, chartsY + 66, rightW - 44, chartsH - 90, data.bars.rows, data.bars.series, (n) => String(n));
  }

  // barra inferior — só desenha se tiver as duas coisas acima (senão já usou "bars" em cima)
  if (data.line && data.bars) {
    const barsY = chartsY + chartsH + 24;
    const barsH = H - barsY - 30;
    panelBox(ctx, leftX, barsY, W - leftX * 2, barsH, data.bars.title, "#d95926");
    drawHBars(ctx, leftX + 22, barsY + 66, W - leftX * 2 - 44, barsH - 90, data.bars.rows, data.bars.series, (n) => String(n));
  }
}

/** Lista genérica — usada pelas abas BOARDS/TAREFAS/SENTINELA/PENSAMENTOS: título + linhas
 * de {title, subtitle, meta, critical}. Sem detalhe/drill-down nessa 1ª versão — só troca de
 * aba é interativo por enquanto. */
function drawListBody(ctx, W, H, list) {
  const x = 34, y = BODY_Y + 6, w = W - 68, h = H - y - 30;
  ctx.fillStyle = "#3fd0f2";
  ctx.font = `700 22px ${MONO}`;
  ctx.fillText(list.title || "", x, y + 14);

  const rows = list.rows || [];
  if (!rows.length) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `20px ${SANS}`;
    ctx.fillText(list.emptyMsg || "nada por aqui.", x, y + 66);
    return;
  }

  const maxRows = 9;
  const shown = rows.slice(0, maxRows);
  const rowH = Math.min(84, (h - 50) / shown.length);
  let ry = y + 48;
  for (const r of shown) {
    roundRect(ctx, x, ry, w, rowH - 10, 8);
    ctx.fillStyle = r.critical ? "rgba(230,103,103,0.10)" : "rgba(255,255,255,0.025)";
    ctx.fill();
    ctx.strokeStyle = r.critical ? "rgba(230,103,103,0.4)" : "rgba(207,239,251,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = r.critical ? "#e66767" : INK;
    ctx.font = `600 19px ${SANS}`;
    const title = (r.title || "").length > 54 ? r.title.slice(0, 53) + "…" : r.title || "";
    ctx.fillText(title, x + 18, ry + rowH * 0.36);

    ctx.fillStyle = INK_DIM;
    ctx.font = `14px ${MONO}`;
    ctx.fillText(r.subtitle || "", x + 18, ry + rowH * 0.72);

    if (r.meta) {
      ctx.fillStyle = r.critical ? "#e66767" : INK_DIM;
      ctx.font = `14px ${MONO}`;
      ctx.textAlign = "right";
      ctx.fillText(r.meta, x + w - 16, ry + rowH * 0.55);
      ctx.textAlign = "left";
    }
    ry += rowH;
  }
  if (rows.length > maxRows) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `14px ${MONO}`;
    ctx.fillText(`+ ${rows.length - maxRows} mais…`, x, ry + 6);
  }
}

/**
 * Desenha o painel AR inteiro (moldura + barra de abas + conteúdo da aba ativa) e devolve os
 * retângulos clicáveis das abas — usados pra converter um toque em 3D (raycast → UV → pixel do
 * canvas) de volta em "qual aba foi tocada" (ver dashboard/ar/page.js).
 *
 * payload: { screen, updatedLabel, dashboard: {...}|null, list: {title,rows,emptyMsg}|null }
 */
export function drawArPanel(canvas, payload) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  drawChrome(ctx, W, H, payload.updatedLabel);

  const tabs = getTabHotspots(W);
  drawTabs(ctx, tabs, payload.screen);

  if (payload.screen === "dashboard" && payload.dashboard) {
    drawDashboardBody(ctx, W, H, payload.dashboard);
  } else if (payload.list) {
    drawListBody(ctx, W, H, payload.list);
  }

  return { hotspots: tabs };
}
