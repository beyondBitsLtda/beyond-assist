# Monaco vendorizado

Editor do VS Code usado na IDE do pair programming (`src/components/panels/LisaPairIDE.js`).

- **Origem:** `node_modules/monaco-editor/min/vs` da versão **0.56.0** (mesma fixada no `package.json`).
- **Por que aqui e não no CDN:** `@monaco-editor/react` puxa do jsDelivr por padrão. Servindo daqui,
  a IDE não quebra se o CDN cair ou for bloqueado na rede. Mesma decisão dos modelos do MediaPipe
  em `public/mediapipe/`. Quem aponta pra cá é o `loader.config({ paths: { vs: "/monaco/vs" } })`
  no topo do `LisaPairIDE.js`.
- **O que foi retirado da cópia:**
  - `vs/nls/lang/` — traduções da interface do editor. Só são buscadas se alguém definir
    `availableLanguages["*"]`, o que não fazemos (ver `vs/nls.messages-loader.js`).
  - `vs/language/` (7,7 MB) — layout **legado** dos workers. No empacotamento do 0.56 o worker de
    verdade vem de `vs/assets/*.worker-*.js`; as strings `vs/language/typescript/tsWorker` que
    sobraram em `tsMode-*.js` são só o `moduleId` (rótulo), porque o `createWorker` já passa a URL
    do bundle. Conferido em navegador headless: com a pasta fora, o editor carrega, o worker de
    TS/JS marca os erros normalmente e nenhuma requisição falha.

**Ao atualizar a versão:** recopie `min/vs` inteiro, refaça esses dois cortes e confira que os
erros de sintaxe ainda aparecem no editor — é justamente o que o `vs/assets/ts.worker-*.js` entrega.
