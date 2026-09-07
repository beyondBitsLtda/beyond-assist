# Lisa Code

Extensão de uso **pessoal** — a Lisa (Beyond Bits) dentro do VS Code: conversa, lê arquivos do
seu workspace e propõe mudanças de código (sempre com diff + sua confirmação antes de gravar em
disco), além de consultar Trello/Tarefas Delp/Sentinela/Pensamentos reais quando você perguntar.

Nunca é publicada na Marketplace nem no Open VSX — fica só como um `.vsix` local, instalado à mão
só na sua própria máquina.

## Configurar o backend (uma vez só)

No Vercel do Beyond Bits, adicione a variável de ambiente `LISA_EXTENSION_TOKEN` com um valor
aleatório só seu (ex.: gere um com `openssl rand -hex 32`). Sem essa variável configurada, as
rotas `/api/lisa-code/*` recusam qualquer pedido.

## Build e instalação local

```bash
cd vscode-extension/lisa-code
npm install
npm run compile
npx vsce package
code --install-extension lisa-code-0.0.1.vsix
```

Pra testar rápido sem empacotar nada, abra esta pasta (`vscode-extension/lisa-code`) no VS Code
e aperte `F5` — abre uma segunda janela do VS Code ("Extension Development Host") já com a
extensão carregada.

## Depois de instalada

1. `Ctrl+Shift+P` → **Lisa Code: Configurar URL do Beyond Bits** → cole a URL do seu deploy
   (ex.: `https://seu-deploy.vercel.app`).
2. `Ctrl+Shift+P` → **Lisa Code: Configurar token pessoal** → cole o MESMO valor de
   `LISA_EXTENSION_TOKEN` que você configurou no Vercel.
3. Abra a view **Lisa Code** no painel do Explorer (barra lateral esquerda) e converse.

`Lisa Code: Nova conversa` limpa o histórico e começa do zero.

## Como funciona a edição de código

A Lisa nunca escreve num arquivo direto. Quando ela propõe uma mudança, a extensão abre um diff
(antes/depois) e pergunta "Aplicar" ou "Rejeitar" — só grava no disco se você aprovar.
