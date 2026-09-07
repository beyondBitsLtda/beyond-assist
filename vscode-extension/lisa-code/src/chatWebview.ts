import * as vscode from "vscode";
import { LisaClient } from "./lisaClient";

export interface ChatHandle {
  clear(): void;
}

/** Liga a lógica da conversa (send/ler eventos/mostrar ferramentas) num webview já criado —
 * usada tanto pelo painel flutuante (LisaPanel) quanto, se algum dia precisar, por outra
 * superfície — pra não duplicar essa lógica em dois lugares. */
export function bindChatMessages(webview: vscode.Webview, client: LisaClient): ChatHandle {
  webview.onDidReceiveMessage(async (msg) => {
    if (msg?.type !== "send" || !msg.text) return;
    const post = (data: unknown) => webview.postMessage(data);
    post({ type: "user-message", text: msg.text });
    try {
      for await (const event of client.send(msg.text)) {
        if (event.type === "text") post({ type: "lisa-text", text: event.text });
        else if (event.type === "tool-start") post({ type: "tool-start", name: event.name });
        else if (event.type === "tool-done") post({ type: "tool-done", name: event.name });
        else if (event.type === "error") post({ type: "lisa-error", message: event.message });
      }
    } catch (err) {
      post({ type: "lisa-error", message: (err as Error).message });
    } finally {
      post({ type: "turn-done" }); // sinal pro orbe do cabeçalho voltar pro estado "idle"
    }
  });
  return { clear: () => webview.postMessage({ type: "clear" }) };
}

/** Visual "HUD estilo Jarvis" — cantos de mira, badge com ponto pulsante, linha de varredura
 * animada no topo, mensagens materializando na tela. Um tema de cores do VS Code é só uma lista
 * de cores (não dá pra ter gráfico/animação nenhuma ali) — aqui é uma página de verdade
 * (webview), então dá pra reaproveitar a MESMA linguagem visual do HUD do Beyond Bits
 * (animações bb-sweep/bb-blink/bb-dot de src/app/globals.css, recriadas aqui porque o webview
 * não compartilha CSS com o app). `--hud` usa a cor de destaque do tema do VS Code ativo
 * (focusBorder) — muda sozinho se o usuário trocar pra um dos temas "Lisa HUD — <cor>". */
export function getChatHtml(): string {
  return /* html */ `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  :root { --hud: var(--vscode-focusBorder, #38e1ff); }
  * { box-sizing: border-box; }
  body {
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, var(--vscode-editor-font-family), monospace;
    font-size: 13px; padding: 0; margin: 0; color: var(--vscode-foreground);
    background: var(--vscode-editor-background); display: flex; flex-direction: column;
    height: 100vh; position: relative; overflow: hidden;
  }

  .corner { position: fixed; width: 16px; height: 16px; border-color: var(--hud); opacity: 0.55; pointer-events: none; z-index: 5; }
  .corner.tl { top: 8px; left: 8px; border-top: 2px solid; border-left: 2px solid; }
  .corner.tr { top: 8px; right: 8px; border-top: 2px solid; border-right: 2px solid; }
  .corner.bl { bottom: 8px; left: 8px; border-bottom: 2px solid; border-left: 2px solid; }
  .corner.br { bottom: 8px; right: 8px; border-bottom: 2px solid; border-right: 2px solid; }

  .sweep { position: absolute; top: 0; left: 0; right: 0; height: 2px; overflow: hidden; z-index: 4; }
  .sweep::after {
    content: ""; position: absolute; top: 0; bottom: 0; width: 40%;
    background: linear-gradient(90deg, transparent, var(--hud), transparent);
    animation: hud-sweep 3.2s linear infinite;
  }
  @keyframes hud-sweep { from { left: -40%; } to { left: 100%; } }

  #header {
    display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 18px 12px;
    border-bottom: 1px solid var(--hud);
    border-bottom: 1px solid color-mix(in srgb, var(--hud) 20%, transparent);
  }
  #orb { width: 84px; height: 84px; }
  #headerTitle { font-size: 11px; letter-spacing: 3px; color: var(--hud); margin-top: 2px; }
  #headerStatus { font-size: 9px; letter-spacing: 1.5px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 6px; }
  .status-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--hud); animation: hud-blink 1.4s steps(1) infinite; }
  @keyframes hud-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.15; } }

  #log { flex: 1; overflow-y: auto; padding: 14px 18px; max-width: 760px; margin: 0 auto; width: 100%; }
  .msg { margin-bottom: 12px; white-space: pre-wrap; line-height: 1.5; animation: hud-slidein 0.25s ease; }
  @keyframes hud-slidein { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
  .msg .tag { font-size: 9px; letter-spacing: 2px; opacity: 0.6; display: block; margin-bottom: 2px; }
  .user { color: var(--vscode-textLink-foreground); text-align: right; }
  .user .tag { text-align: right; }
  .lisa { color: var(--vscode-foreground); padding-left: 10px;
    border-left: 2px solid var(--hud);
    border-left: 2px solid color-mix(in srgb, var(--hud) 45%, transparent);
  }
  .lisa .tag { color: var(--hud); }
  .tool { color: var(--vscode-descriptionForeground); font-size: 11px; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; }
  .tool .ring { width: 9px; height: 9px; border-radius: 50%; animation: hud-spin 0.8s linear infinite; flex: none;
    border: 1.5px solid var(--hud); border-top-color: var(--hud);
    border-color: color-mix(in srgb, var(--hud) 55%, transparent); border-top-color: var(--hud);
  }
  @keyframes hud-spin { to { transform: rotate(360deg); } }
  .tool.done .ring { display: none; }
  .error { color: var(--vscode-errorForeground); }

  #inputRow { display: flex; padding: 10px; gap: 8px; max-width: 760px; margin: 0 auto; width: 100%;
    border-top: 1px solid var(--hud);
    border-top: 1px solid color-mix(in srgb, var(--hud) 20%, transparent);
  }
  #input { flex: 1; resize: none; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 7px 9px; border-radius: 4px; font-family: inherit; }
  #input:focus { outline: none; border-color: var(--hud); }
  button { background: var(--hud); color: var(--vscode-button-foreground, #04121a); border: none; padding: 7px 16px; cursor: pointer; border-radius: 4px; font-family: inherit; letter-spacing: 1px; font-size: 11px; }
  button:hover { filter: brightness(1.1); }
</style>
</head>
<body>
  <div class="sweep"></div>
  <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>

  <div id="header">
    <canvas id="orb"></canvas>
    <div id="headerTitle">◈ LISA CODE</div>
    <div id="headerStatus"><span class="status-dot"></span>SISTEMA ATIVO</div>
  </div>
  <span id="hudColorProbe" style="color: var(--hud); display: none;"></span>

  <div id="log"></div>
  <div id="inputRow">
    <textarea id="input" rows="2" placeholder="Pergunte algo, ou peça pra Lisa mexer no código..."></textarea>
    <button id="send">ENVIAR</button>
  </div>
<script>
  const vscodeApi = acquireVsCodeApi();
  const log = document.getElementById("log");
  const input = document.getElementById("input");

  function append(cls, tag, text) {
    const div = document.createElement("div");
    div.className = "msg " + cls;
    const tagEl = document.createElement("span");
    tagEl.className = "tag";
    tagEl.textContent = tag;
    const body = document.createElement("div");
    body.textContent = text;
    div.appendChild(tagEl);
    div.appendChild(body);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function appendTool(text, done) {
    const div = document.createElement("div");
    div.className = "msg tool" + (done ? " done" : "");
    div.innerHTML = '<span class="ring"></span><span></span>';
    div.querySelector("span:last-child").textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function send() {
    const text = input.value.trim();
    if (!text) return;
    vscodeApi.postMessage({ type: "send", text });
    input.value = "";
    window.__lisaOrbSetMode?.("active");
  }

  document.getElementById("send").addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.focus();

  // "orbe" central — MESMO algoritmo do visualizador de voz do Beyond Bits (canvasRef em
  // assistant/page.js): raios ondulando ao redor de um núcleo com glow + anéis de pulso quando
  // ativo. Aqui só 2 estados (idle/active) em vez de idle/listening/speaking — a extensão não
  // tem um "ouvindo" separado, só "parada" ou "trabalhando na resposta".
  (function () {
    const cv = document.getElementById("orb");
    const ctx = cv.getContext("2d");
    const probe = document.getElementById("hudColorProbe");
    let mode = "idle";
    window.__lisaOrbSetMode = (m) => { mode = m; };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const SIZE = 84;
    cv.width = SIZE * dpr; cv.height = SIZE * dpr;
    cv.style.width = SIZE + "px"; cv.style.height = SIZE + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const NB = 40;
    let phase = 0;

    function draw() {
      const w = SIZE, h = SIZE, cx = w / 2, cy = h / 2;
      const base = Math.min(w, h) * 0.26;
      ctx.clearRect(0, 0, w, h);
      const now = performance.now() / 1000;

      const rgbText = getComputedStyle(probe).color; // "rgb(r, g, b)" — resolve a cor do tema ativo
      const m3 = /rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/.exec(rgbText);
      const accentRgb = m3 ? m3[1] + "," + m3[2] + "," + m3[3] : "56,225,255";
      const accentCss = "rgb(" + accentRgb + ")";

      let amp, speed, coreGlow;
      if (mode === "idle") { amp = 0.1; speed = 0.6; coreGlow = 0.5 + 0.2 * Math.sin(now * 1.6); }
      else { amp = 0.72; speed = 3.6; coreGlow = 0.9; }
      phase += 0.016 * speed;

      for (let i = 0; i < NB; i++) {
        const ang = (i / NB) * Math.PI * 2;
        const seed = i * 0.35;
        let mag = Math.sin(seed * 1.3 + phase * 2.1) * 0.5
                + Math.sin(seed * 2.7 - phase * 1.4) * 0.3
                + Math.sin(seed * 0.7 + phase * 3.3) * 0.2;
        mag = (mag + 1) / 2;
        if (mode === "idle") mag = 0.15 + mag * 0.12;
        const len = base * (0.14 + mag * amp);
        const x1 = cx + Math.cos(ang) * base, y1 = cy + Math.sin(ang) * base;
        const x2 = cx + Math.cos(ang) * (base + len), y2 = cy + Math.sin(ang) * (base + len);
        const g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, "rgba(" + accentRgb + ",0.85)");
        g.addColorStop(1, mag > 0.7 ? "rgba(255,157,61,0.95)" : "rgba(" + accentRgb + ",0.15)");
        ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }

      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 0.95);
      gr.addColorStop(0, "rgba(" + accentRgb + "," + (0.3 * coreGlow) + ")");
      gr.addColorStop(0.5, "rgba(" + accentRgb + "," + (0.1 * coreGlow) + ")");
      gr.addColorStop(1, "rgba(" + accentRgb + ",0)");
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(cx, cy, base * 0.95, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = "rgba(" + accentRgb + "," + (0.55 + coreGlow * 0.4) + ")";
      ctx.lineWidth = 1.6; ctx.shadowBlur = 14; ctx.shadowColor = accentCss;
      ctx.beginPath(); ctx.arc(cx, cy, base * 0.7, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;

      if (mode !== "idle") {
        for (let k = 0; k < 3; k++) {
          const prog = ((now * 1.1 + k / 3) % 1);
          const rr = base * (0.7 + prog * 1.5);
          ctx.strokeStyle = "rgba(" + accentRgb + "," + ((1 - prog) * 0.35) + ")";
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
        }
      }

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  })();

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "user-message") append("user", "VOCÊ", msg.text);
    else if (msg.type === "lisa-text") append("lisa", "LISA", msg.text);
    else if (msg.type === "tool-start") appendTool("analisando: " + msg.name + "...", false);
    else if (msg.type === "tool-done") appendTool(msg.name + " concluído", true);
    else if (msg.type === "lisa-error") append("error", "⚠ ERRO", msg.message);
    else if (msg.type === "turn-done") window.__lisaOrbSetMode?.("idle");
    else if (msg.type === "clear") log.innerHTML = "";
  });
</script>
</body>
</html>`;
}
