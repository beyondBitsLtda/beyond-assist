// As linguagens que o Proof sabe colorir, e como carregar cada uma.
//
// Cada linguagem é um import dinâmico: o pacote dela só desce para o navegador quando aparece um
// código naquela linguagem. Quem estuda JavaScript nunca baixa o analisador de C++.
//
// O nome vem da IA ("javascript", "C", "c#", "Python 3"...) ou da cerca do bloco (```js), então
// a chave é normalizada antes: minúsculas, sem versão, com os apelidos de sempre.

import { StreamLanguage } from "@codemirror/language";

const legado = (carregar) => async () => StreamLanguage.define(await carregar());

const CARREGADORES = {
  javascript: async () => (await import("@codemirror/lang-javascript")).javascript(),
  jsx: async () => (await import("@codemirror/lang-javascript")).javascript({ jsx: true }),
  typescript: async () => (await import("@codemirror/lang-javascript")).javascript({ typescript: true }),
  tsx: async () => (await import("@codemirror/lang-javascript")).javascript({ typescript: true, jsx: true }),
  python: async () => (await import("@codemirror/lang-python")).python(),
  java: async () => (await import("@codemirror/lang-java")).java(),
  cpp: async () => (await import("@codemirror/lang-cpp")).cpp(),
  sql: async () => (await import("@codemirror/lang-sql")).sql(),
  html: async () => (await import("@codemirror/lang-html")).html(),
  css: async () => (await import("@codemirror/lang-css")).css(),
  php: async () => (await import("@codemirror/lang-php")).php(),
  json: async () => (await import("@codemirror/lang-json")).json(),
  go: async () => (await import("@codemirror/lang-go")).go(),
  rust: async () => (await import("@codemirror/lang-rust")).rust(),
  csharp: legado(async () => (await import("@codemirror/legacy-modes/mode/clike")).csharp),
  kotlin: legado(async () => (await import("@codemirror/legacy-modes/mode/clike")).kotlin),
  dart: legado(async () => (await import("@codemirror/legacy-modes/mode/clike")).dart),
  shell: legado(async () => (await import("@codemirror/legacy-modes/mode/shell")).shell),
  ruby: legado(async () => (await import("@codemirror/legacy-modes/mode/ruby")).ruby),
  swift: legado(async () => (await import("@codemirror/legacy-modes/mode/swift")).swift),
  yaml: legado(async () => (await import("@codemirror/legacy-modes/mode/yaml")).yaml),
  // o caderno (25/10/2026): Markdown com os blocos ```js coloridos pela linguagem de cada um
  markdown: async () => {
    const [{ markdown, markdownLanguage }, { LanguageDescription }] = await Promise.all([
      import("@codemirror/lang-markdown"),
      import("@codemirror/language"),
    ]);
    return markdown({
      base: markdownLanguage,
      codeLanguages: (info) => {
        const chave = chaveDaLinguagem(info);
        if (!chave || chave === "markdown") return null;
        return LanguageDescription.of({ name: chave, load: () => carregarLinguagem(chave) });
      },
    });
  },
};

const APELIDOS = {
  js: "javascript", node: "javascript", nodejs: "javascript", ecmascript: "javascript", "javascript moderno": "javascript",
  ts: "typescript", py: "python", python3: "python",
  c: "cpp", "c++": "cpp", cc: "cpp", h: "cpp", hpp: "cpp",
  "c#": "csharp", cs: "csharp", "c sharp": "csharp",
  mysql: "sql", postgresql: "sql", postgres: "sql", sqlite: "sql", plsql: "sql", tsql: "sql",
  htm: "html", xml: "html", scss: "css", kt: "kotlin",
  bash: "shell", sh: "shell", zsh: "shell", terminal: "shell", console: "shell",
  rb: "ruby", golang: "go", rs: "rust",
  md: "markdown", yml: "yaml",
};

/** "Python 3.12" → "python"; "C" → "cpp"; algo desconhecido → "" (o código sai sem cor, mas sai). */
export function chaveDaLinguagem(nome) {
  const n = String(nome || "").toLowerCase().trim().replace(/\s*\d+(\.\d+)*$/, "").trim();
  if (CARREGADORES[n]) return n;
  return APELIDOS[n] || "";
}

/** O rótulo que aparece no canto do bloco: o nome como a pessoa reconhece. */
const ROTULOS = { javascript: "JavaScript", typescript: "TypeScript", jsx: "JSX", tsx: "TSX", python: "Python", java: "Java", cpp: "C/C++", sql: "SQL", html: "HTML", css: "CSS", php: "PHP", json: "JSON", go: "Go", rust: "Rust", csharp: "C#", kotlin: "Kotlin", dart: "Dart", shell: "Terminal", ruby: "Ruby", swift: "Swift", yaml: "YAML", markdown: "Markdown" };
export function rotuloDaLinguagem(nome) {
  const chave = chaveDaLinguagem(nome);
  if (chave === "cpp" && String(nome || "").trim().toLowerCase() === "c") return "C";
  return ROTULOS[chave] || String(nome || "").trim();
}

const prontas = new Map();
/** A extensão do CodeMirror da linguagem (LanguageSupport ou StreamLanguage), ou null. */
export function carregarLinguagem(nome) {
  const chave = chaveDaLinguagem(nome);
  if (!chave) return Promise.resolve(null);
  if (!prontas.has(chave)) prontas.set(chave, CARREGADORES[chave]().catch(() => null));
  return prontas.get(chave);
}
