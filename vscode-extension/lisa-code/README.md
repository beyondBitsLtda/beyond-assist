# Lisa Code

Extensão de uso **pessoal** — a Lisa (Beyond Bits) dentro do VS Code: conversa, lê arquivos do
seu workspace, vê os erros do Problems panel, busca texto no projeto inteiro, e propõe mudanças
de código — criar, editar ou apagar arquivo — sempre com diff/confirmação antes de gravar em
disco, além de consultar Trello/Tarefas Delp/Sentinela/Pensamentos reais quando você perguntar.
Também traz 6 temas de cores do VS Code com a mesma paleta do HUD do Beyond Bits.

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
code --install-extension lisa-code-0.0.4.vsix
```

Pra testar rápido sem empacotar nada, abra esta pasta (`vscode-extension/lisa-code`) no VS Code
e aperte `F5` — abre uma segunda janela do VS Code ("Extension Development Host") já com a
extensão carregada.

## Depois de instalada

1. `Ctrl+Shift+P` → **Lisa Code: Configurar URL do Beyond Bits** → cole a URL do seu deploy
   (ex.: `https://seu-deploy.vercel.app`).
2. `Ctrl+Shift+P` → **Lisa Code: Configurar token pessoal** → cole o MESMO valor de
   `LISA_EXTENSION_TOKEN` que você configurou no Vercel.
3. Clique no ícone da Lisa na barra de atividades (esquerda) — abre o chat como um painel ao
   lado do editor (dá pra arrastar a aba pra fora e virar uma janela separada, se quiser).

`Lisa Code: Nova conversa` limpa o histórico e começa do zero.

## Como funciona a edição de código

A Lisa nunca escreve, cria ou apaga um arquivo direto. Quando ela propõe uma mudança, a extensão
abre um diff (antes/depois) e pergunta "Aplicar"/"Criar"/"Apagar" — só mexe no disco se você
aprovar (apagar sempre vai pra lixeira do sistema, nunca é permanente).

## Temas de cores

`Ctrl+Shift+P` → **Preferences: Color Theme** → duas famílias, uma por cor de destaque do
Beyond Bits (Ciano, Azul, Roxo, Rosa, Vermelho, Dourado):

- **Lisa HUD — <cor>**: fundo preto + painéis `#08131a`, igual o app.
- **Lisa Imersivo — <cor>**: o fundo do VS Code inteiro (editor, barras, terminal) fica tingido
  com a própria cor da Lisa bem escurecida — ex.: dourado vira `#110e05`, ciano vira `#041012`.

Gerados por `scripts/generate-themes.mjs`; se a paleta do app mudar, rode
`npm run generate-themes` de novo antes de empacotar.

## Visual completo (tema + fonte)

`Ctrl+Shift+P` → **Lisa Code: Aplicar visual da Lisa (tema + fonte)** → escolhe a cor e o tipo de
fundo, e aplica de uma vez o tema + `editor.fontFamily`/`terminal.integrated.fontFamily`.
**Lisa Code: Restaurar visual anterior** desfaz (o comando guarda o que estava antes).

Um tema de cores do VS Code só controla CORES — fonte é configuração do usuário, por isso vira um
comando e não parte do tema. E o editor do VS Code só usa fonte **instalada no sistema** (ele não
baixa webfont como o navegador faz no Beyond Bits): sem JetBrains Mono instalada, a cadeia cai em
Consolas sem quebrar nada. Se quiser a fonte de verdade na máquina, abra um chamado no GLPI pra TI
avaliar e instalar. Dentro do painel da Lisa a fonte é carregada do Google Fonts (igual o app),
então ali ela aparece correta independente do que está instalado.
