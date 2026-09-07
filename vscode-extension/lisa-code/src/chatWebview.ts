import * as vscode from "vscode";
import { LisaClient } from "./lisaClient";
import { gitSnapshot } from "./gitContext";

export interface ChatHandle {
  clear(): void;
  dispose(): void;
}

const NO_BASE = "— sem comparação —";

/** Liga a lógica da conversa (send/ler eventos/mostrar ferramentas) num webview já criado —
 * usada tanto pelo painel flutuante (LisaPanel) quanto, se algum dia precisar, por outra
 * superfície — pra não duplicar essa lógica em dois lugares. */
export function bindChatMessages(webview: vscode.Webview, client: LisaClient): ChatHandle {
  const post = (data: unknown) => webview.postMessage(data);

  /** manda pro painel o estado atual da barra de contexto (branch, base de comparação e qual
   * arquivo está aberto) — chamado no início, quando o usuário troca algo, e quando ele muda
   * de arquivo no editor. */
  const postContext = async () => {
    const snap = await gitSnapshot();
    const ed = vscode.window.activeTextEditor;
    post({
      type: "context",
      branch: snap.branch || null,
      base: client.getCompareBase() || null,
      file: ed ? vscode.workspace.asRelativePath(ed.document.uri, false) : null,
      includeFile: client.getIncludeEditorContext(),
    });
  };

  const disposables: vscode.Disposable[] = [
    vscode.window.onDidChangeActiveTextEditor(() => void postContext()),
  ];

  webview.onDidReceiveMessage(async (msg) => {
    if (msg?.type === "pick-branch") {
      const snap = await gitSnapshot();
      if (!snap.available) {
        vscode.window.showWarningMessage(`Lisa Code: ${snap.error}`);
        return;
      }
      const picked = await vscode.window.showQuickPick([NO_BASE, ...(snap.branches || [])], {
        title: "Branch de comparação (não faz checkout — é só referência pra Lisa)",
        placeHolder: snap.branch ? `você está em: ${snap.branch}` : undefined,
      });
      if (picked === undefined) return;
      client.setCompareBase(picked === NO_BASE ? undefined : picked);
      await postContext();
      return;
    }

    if (msg?.type === "toggle-file-context") {
      client.setIncludeEditorContext(!client.getIncludeEditorContext());
      await postContext();
      return;
    }

    if (msg?.type === "ready") {
      await postContext();
      return;
    }

    if (msg?.type !== "send" || !msg.text) return;
    post({ type: "user-message", text: msg.text });
    try {
      for await (const event of client.send(msg.text)) {
        if (event.type === "text") post({ type: "lisa-text", text: event.text });
        else if (event.type === "tool-start") post({ type: "tool-start", name: event.name, args: event.args });
        else if (event.type === "tool-done") post({ type: "tool-done", name: event.name });
        else if (event.type === "progress") post({ type: "progress", percent: event.percent, status: event.status });
        else if (event.type === "error") post({ type: "lisa-error", message: event.message });
      }
    } catch (err) {
      post({ type: "lisa-error", message: (err as Error).message });
    } finally {
      post({ type: "turn-done" }); // sinal pro orbe do cabeçalho voltar pro estado "idle"
    }
  });
  return {
    clear: () => webview.postMessage({ type: "clear" }),
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
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
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet" />
<style>
  :root { --hud: var(--vscode-focusBorder, #38e1ff); }
  * { box-sizing: border-box; }
  body {
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, var(--vscode-editor-font-family), monospace;
    font-size: 13px; padding: 0; margin: 0; color: var(--vscode-foreground);
    background: transparent; height: 100vh; position: relative; overflow: hidden;
  }

  /* camada de fundo (grade + manchas de luz derivando) — é o que aparece ATRÁS do vidro; sem
     ela o blur não teria nada pra desfocar e a translucidez não leria como vidro. */
  .backdrop { position: fixed; inset: 0; overflow: hidden; z-index: 0; }
  .backdrop::before {
    content: ""; position: absolute; inset: -20%; opacity: 0.05;
    background-image: linear-gradient(var(--hud) 1px, transparent 1px), linear-gradient(90deg, var(--hud) 1px, transparent 1px);
    background-size: 34px 34px;
  }
  .blob { position: absolute; width: 46vmin; height: 46vmin; border-radius: 50%; background: var(--hud); filter: blur(60px); opacity: 0.2; }
  .blob.b1 { top: -12vmin; left: -8vmin; animation: hud-drift1 18s ease-in-out infinite alternate; }
  .blob.b2 { bottom: -14vmin; right: -10vmin; animation: hud-drift2 22s ease-in-out infinite alternate; }
  @keyframes hud-drift1 { to { transform: translate(6vmin, 8vmin) scale(1.15); } }
  @keyframes hud-drift2 { to { transform: translate(-7vmin, -6vmin) scale(1.1); } }

  /* o "card flutuante": translúcido + blur do que está atrás + sombra + oscilação lenta.
     Atenção: isso é vidro DENTRO do painel — o VS Code não tem transparência de janela, então
     não é see-through até o código/desktop, e sim até esta camada .backdrop aqui. */
  .card {
    position: absolute; inset: 10px; z-index: 1; display: flex; flex-direction: column;
    border-radius: 14px; overflow: hidden;
    border: 1px solid var(--hud);
    border: 1px solid color-mix(in srgb, var(--hud) 28%, transparent);
    background: var(--vscode-editor-background);
    background: color-mix(in srgb, var(--vscode-editor-background) 62%, transparent);
    backdrop-filter: blur(16px) saturate(1.25);
    -webkit-backdrop-filter: blur(16px) saturate(1.25);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.03);
    animation: hud-float 7s ease-in-out infinite;
  }
  @keyframes hud-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

  @media (prefers-reduced-motion: reduce) {
    .card, .blob, .sweep::after { animation: none; }
  }

  .corner { position: absolute; width: 16px; height: 16px; border-color: var(--hud); opacity: 0.55; pointer-events: none; z-index: 5; }
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
  #headerTitle { font-family: 'Rajdhani', 'JetBrains Mono', sans-serif; font-size: 15px; font-weight: 600; letter-spacing: 4px; color: var(--hud); margin-top: 2px; }
  #headerStatus { font-size: 9px; letter-spacing: 1.5px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 6px; }
  .status-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--hud); animation: hud-blink 1.4s steps(1) infinite; }
  @keyframes hud-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.15; } }

  /* barra de contexto — o que a Lisa está "vendo": branch, base de comparação, arquivo aberto */
  #contextBar { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; padding: 8px 14px 2px; }
  .chip {
    font-family: inherit; font-size: 9.5px; letter-spacing: 0.5px; padding: 3px 9px; border-radius: 20px;
    background: transparent; color: var(--vscode-descriptionForeground); max-width: 240px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    border: 1px solid var(--hud);
    border: 1px solid color-mix(in srgb, var(--hud) 30%, transparent);
  }
  .chip.clickable { cursor: pointer; }
  .chip.clickable:hover { border-color: var(--hud); color: var(--hud); }
  .chip.on { color: var(--hud); border-color: var(--hud); background: color-mix(in srgb, var(--hud) 10%, transparent); }
  .chip.off { opacity: 0.45; }

  #progressWrap { padding: 10px 18px 0; max-width: 760px; margin: 0 auto; width: 100%; display: none; }
  #progressWrap.show { display: block; }
  #progressStatus { font-size: 10px; letter-spacing: 0.5px; color: var(--vscode-descriptionForeground); margin-bottom: 5px; display: flex; justify-content: space-between; gap: 8px; }
  #progressPct { color: var(--hud); font-weight: bold; flex: none; }
  #progressTrack { height: 4px; background: rgba(127, 127, 127, 0.18); border-radius: 2px; overflow: hidden; }
  #progressFill { height: 100%; width: 0%; background: var(--hud); box-shadow: 0 0 6px var(--hud); transition: width 0.4s ease; }

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
  <div class="backdrop"><span class="blob b1"></span><span class="blob b2"></span></div>
  <span id="hudColorProbe" style="color: var(--hud); display: none;"></span>

  <div class="card">
    <div class="sweep"></div>
    <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>

    <div id="header">
      <canvas id="orb"></canvas>
      <div id="headerTitle">◈ LISA CODE</div>
      <div id="headerStatus"><span class="status-dot"></span>SISTEMA ATIVO</div>
    </div>

    <div id="contextBar">
      <span class="chip" id="chipBranch" title="Branch em que você está agora">⎇ —</span>
      <span class="chip clickable off" id="chipCompare" title="Escolher branch de comparação — só referência pra Lisa, NÃO faz checkout">⇄ comparar…</span>
      <span class="chip clickable" id="chipFile" title="Incluir o arquivo aberto (e a seleção) no contexto da conversa">📄 —</span>
    </div>

    <div id="progressWrap">
      <div id="progressStatus"><span id="progressLabel"></span><span id="progressPct">0%</span></div>
      <div id="progressTrack"><div id="progressFill"></div></div>
    </div>

    <div id="log"></div>
    <div id="inputRow">
      <textarea id="input" rows="2" placeholder="Pergunte algo, ou peça pra Lisa mexer no código..."></textarea>
      <button id="send">ENVIAR</button>
    </div>
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

  // narração rica por ferramenta — o que ela tá fazendo e ONDE, não só o nome técnico da função
  function describeTool(name, args) {
    args = args || {};
    if (name === "read_file") return "Lendo " + args.path;
    if (name === "propose_edit") return "Editando " + args.path + (args.explanation ? " — " + args.explanation : "");
    if (name === "create_file") return "Criando " + args.path + (args.explanation ? " — " + args.explanation : "");
    if (name === "delete_file") return "Apagando " + args.path + (args.explanation ? " — " + args.explanation : "");
    if (name === "search_workspace") return "Buscando \\"" + args.query + "\\" no workspace" + (args.glob ? " (" + args.glob + ")" : "");
    if (name === "get_problems") return "Vendo erros do editor" + (args.path ? " em " + args.path : "");
    if (name === "list_pending_work") return "Consultando " + (args.source || "Beyond Bits");
    return name;
  }
  let lastToolDesc = "";

  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");
  const progressPct = document.getElementById("progressPct");

  function setProgress(percent, status) {
    progressWrap.classList.add("show");
    progressFill.style.width = Math.max(0, Math.min(100, percent)) + "%";
    progressPct.textContent = Math.round(percent) + "%";
    progressLabel.textContent = status || "";
  }
  function hideProgress() {
    progressWrap.classList.remove("show");
    progressFill.style.width = "0%";
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

  const chipBranch = document.getElementById("chipBranch");
  const chipCompare = document.getElementById("chipCompare");
  const chipFile = document.getElementById("chipFile");
  chipCompare.addEventListener("click", () => vscodeApi.postMessage({ type: "pick-branch" }));
  chipFile.addEventListener("click", () => vscodeApi.postMessage({ type: "toggle-file-context" }));

  function shortPath(p) {
    if (!p) return null;
    const parts = p.split("/");
    return parts.length > 2 ? ".../" + parts.slice(-2).join("/") : p;
  }

  function setContext(ctx) {
    chipBranch.textContent = "⎇ " + (ctx.branch || "sem git");
    chipBranch.classList.toggle("off", !ctx.branch);

    chipCompare.textContent = ctx.base ? "⇄ vs " + ctx.base : "⇄ comparar…";
    chipCompare.classList.toggle("on", !!ctx.base);
    chipCompare.classList.toggle("off", !ctx.base);

    chipFile.textContent = "📄 " + (shortPath(ctx.file) || "nenhum arquivo");
    chipFile.title = ctx.includeFile
      ? "Arquivo aberto ENTRA no contexto (clique pra desligar)" + (ctx.file ? " — " + ctx.file : "")
      : "Arquivo aberto NÃO entra no contexto (clique pra ligar)";
    chipFile.classList.toggle("on", !!ctx.includeFile);
    chipFile.classList.toggle("off", !ctx.includeFile);
  }

  vscodeApi.postMessage({ type: "ready" }); // pede o estado inicial da barra de contexto

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
    else if (msg.type === "tool-start") { lastToolDesc = describeTool(msg.name, msg.args); appendTool(lastToolDesc + "...", false); }
    else if (msg.type === "tool-done") appendTool((lastToolDesc || msg.name) + " — concluído", true);
    else if (msg.type === "progress") setProgress(msg.percent, msg.status);
    else if (msg.type === "context") setContext(msg);
    else if (msg.type === "lisa-error") append("error", "⚠ ERRO", msg.message);
    else if (msg.type === "turn-done") {
      window.__lisaOrbSetMode?.("idle");
      if (progressWrap.classList.contains("show")) setTimeout(hideProgress, 1200);
    }
    else if (msg.type === "clear") { log.innerHTML = ""; hideProgress(); }
  });
</script>
</body>
</html>`;
}
