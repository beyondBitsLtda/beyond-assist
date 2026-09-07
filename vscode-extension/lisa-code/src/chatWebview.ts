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
    }
  });
  return { clear: () => webview.postMessage({ type: "clear" }) };
}

export function getChatHtml(): string {
  return /* html */ `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: var(--vscode-font-family); font-size: 13px; padding: 0; margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); display: flex; flex-direction: column; height: 100vh; }
  #log { flex: 1; overflow-y: auto; padding: 12px; max-width: 760px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  .msg { margin-bottom: 10px; white-space: pre-wrap; line-height: 1.4; }
  .user { color: var(--vscode-textLink-foreground); }
  .lisa { color: var(--vscode-foreground); }
  .tool { color: var(--vscode-descriptionForeground); font-style: italic; font-size: 12px; }
  .error { color: var(--vscode-errorForeground); }
  #inputRow { display: flex; border-top: 1px solid var(--vscode-panel-border); padding: 8px; gap: 8px; max-width: 760px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  #input { flex: 1; resize: none; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 6px; border-radius: 4px; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 14px; cursor: pointer; border-radius: 4px; }
</style>
</head>
<body>
  <div id="log"></div>
  <div id="inputRow">
    <textarea id="input" rows="2" placeholder="Pergunte algo, ou peça pra Lisa mexer no código..."></textarea>
    <button id="send">Enviar</button>
  </div>
<script>
  const vscodeApi = acquireVsCodeApi();
  const log = document.getElementById("log");
  const input = document.getElementById("input");

  function append(cls, text) {
    const div = document.createElement("div");
    div.className = "msg " + cls;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function send() {
    const text = input.value.trim();
    if (!text) return;
    vscodeApi.postMessage({ type: "send", text });
    input.value = "";
  }

  document.getElementById("send").addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.focus();

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "user-message") append("user", "Você: " + msg.text);
    else if (msg.type === "lisa-text") append("lisa", "Lisa: " + msg.text);
    else if (msg.type === "tool-start") append("tool", "🔧 usando: " + msg.name + "...");
    else if (msg.type === "tool-done") append("tool", "✓ " + msg.name + " concluído");
    else if (msg.type === "lisa-error") append("error", "⚠ " + msg.message);
    else if (msg.type === "clear") log.innerHTML = "";
  });
</script>
</body>
</html>`;
}
