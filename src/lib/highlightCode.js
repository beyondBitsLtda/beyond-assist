// Detecção de linguagem pra realçar a sintaxe do código que a Lisa escreve ao vivo no Modo
// Código (ver src/app/(panels)/assistant/page.js). O realce em si usa <Highlight> de
// "prism-react-renderer" direto no componente (ela devolve os TOKENS já separados por linha,
// então casa perfeito com o gutter de número de linha sem precisar fatiar HTML na mão).
//
// Por que prism-react-renderer e não o pacote "prismjs" puro: os arquivos de linguagem do
// prismjs (prism-jsx.js etc.) esperam uma variável GLOBAL `Prism` já populada quando carregam
// — funciona certinho num <script> solto ou no require() do Node, mas sob o bundler do
// Next.js (client bundle) isso quebrava bem depois do primeiro carregamento, derrubando a
// árvore de componentes inteira (tela toda preta, já que o body do app é preto por padrão) —
// só na hora em que o realce rodava de verdade pela primeira vez (o 1º arquivo sendo escrito).
// O prism-react-renderer empacota o Prism dele mesmo como um módulo comum, sem depender de
// global nenhuma, então não tem esse risco.
"use client";

const LANG_BY_EXT = {
  js: "javascript", mjs: "javascript", cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  css: "css",
  json: "json",
  html: "markup", htm: "markup", xml: "markup", svg: "markup",
  sql: "sql",
  yml: "yaml", yaml: "yaml",
  py: "python",
  md: "markdown",
};

/** Linguagem (no vocabulário do Prism) pra um caminho de arquivo, ou `null` se a extensão não
 * tem gramática reconhecida — quem chama cai pro texto puro (sem cor) nesse caso. */
export function langForPath(path) {
  const ext = String(path || "").split(".").pop().toLowerCase();
  return LANG_BY_EXT[ext] || null;
}
