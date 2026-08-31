// Realce de sintaxe pro código que a Lisa escreve ao vivo no Modo Código (ver
// src/app/(panels)/assistant/page.js) — client-side, via Prism (leve, sem CSS próprio: as
// cores vêm do tema do próprio app, ver TOKEN_COLORS abaixo, não do "Dark+" do VS Code).
"use client";

import Prism from "prismjs";
// ordem importa — cada um espera que sua dependência já esteja carregada em Prism.languages
// (jsx precisa de javascript, tsx precisa de jsx+typescript; os dois vêm de "prismjs" puro).
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-tsx.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-sql.js";
import "prismjs/components/prism-yaml.js";
import "prismjs/components/prism-python.js";

const LANG_BY_EXT = {
  js: "javascript", mjs: "javascript", cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  css: "css",
  json: "json",
  html: "markup", htm: "markup", xml: "markup", svg: "markup",
  sh: "bash", bash: "bash",
  sql: "sql",
  yml: "yaml", yaml: "yaml",
  py: "python",
};

export function langForPath(path) {
  const ext = String(path || "").split(".").pop().toLowerCase();
  return LANG_BY_EXT[ext] || null;
}

/** HTML já com os `<span class="token ...">` do Prism — seguro pra dangerouslySetInnerHTML
 * (o Prism escapa o texto na tokenização, é literalmente pra isso que ele serve). `null` se a
 * extensão do arquivo não tem gramática reconhecida — quem chama cai pro texto puro nesse caso. */
export function highlightCode(content, path) {
  const lang = langForPath(path);
  const grammar = lang && Prism.languages[lang];
  if (!grammar) return null;
  try {
    return Prism.highlight(content, grammar, lang);
  } catch {
    return null;
  }
}
