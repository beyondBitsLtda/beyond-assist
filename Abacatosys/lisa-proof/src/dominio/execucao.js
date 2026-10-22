// O "Rodar" do exercício do dia: onde o código de cada linguagem roda (pedido de 21/10/2026).
//
// JavaScript e SQL rodam no próprio navegador, num Worker com tempo-limite: é instantâneo e o
// código não sai do aparelho. As outras linguagens (C, Python, PHP, Java...) vão pelo servidor do
// Proof até o Wandbox (wandbox.org), um compilador on-line gratuito: compilador de verdade, com a
// saída certa. O interpretador de C que roda no navegador (JSCPP) foi testado e descartado — não
// aceita `struct` e chegou a imprimir a saída errada, o que confundiria quem está aprendendo.
//
// Puro (sem rede): testado em scripts/dominio-check.mjs.

export const EXECUCAO = {
  javascript: { onde: "navegador", rotulo: "JavaScript" },
  sql: { onde: "navegador", rotulo: "SQL (SQLite)" },
  c: { onde: "servidor", compilador: "gcc-13.2.0-c", rotulo: "C (gcc 13)" },
  cpp: { onde: "servidor", compilador: "gcc-13.2.0", rotulo: "C++ (gcc 13)" },
  python: { onde: "servidor", compilador: "cpython-3.12.7", rotulo: "Python 3.12" },
  php: { onde: "servidor", compilador: "php-8.3.12", rotulo: "PHP 8.3" },
  java: { onde: "servidor", compilador: "openjdk-jdk-21+35", rotulo: "Java 21" },
  csharp: { onde: "servidor", compilador: "mono-6.12.0.199", rotulo: "C# (Mono)" },
  typescript: { onde: "servidor", compilador: "typescript-5.6.2", rotulo: "TypeScript 5.6" },
  go: { onde: "servidor", compilador: "go-1.23.2", rotulo: "Go 1.23" },
  rust: { onde: "servidor", compilador: "rust-1.82.0", rotulo: "Rust 1.82" },
  ruby: { onde: "servidor", compilador: "ruby-3.4.9", rotulo: "Ruby 3.4" },
  swift: { onde: "servidor", compilador: "swift-6.0.1", rotulo: "Swift 6" },
  shell: { onde: "servidor", compilador: "bash", rotulo: "Bash" },
};

const APELIDOS = {
  js: "javascript", node: "javascript", nodejs: "javascript", "node.js": "javascript", ecmascript: "javascript",
  "javascript moderno": "javascript", jsx: "javascript",
  py: "python", python3: "python", "c++": "cpp", cc: "cpp", "c#": "csharp", cs: "csharp", "c sharp": "csharp",
  mysql: "sql", postgresql: "sql", postgres: "sql", sqlite: "sql", plsql: "sql", tsql: "sql", "sql server": "sql",
  ts: "typescript", golang: "go", rs: "rust", rb: "ruby", bash: "shell", sh: "shell", terminal: "shell",
};

function chaveDe(nome) {
  const n = String(nome || "").toLowerCase().trim().replace(/\s*\d+(\.\d+)*$/, "").trim();
  return EXECUCAO[n] ? n : APELIDOS[n] || "";
}

// Quando o exercício não diz a linguagem, o tema da trilha costuma dizer ("JavaScript do Zero",
// "Programação em C do Zero"). A ordem importa: TypeScript antes de JavaScript antes de Java,
// e C++/C# antes do C sozinho.
const PELO_TEMA = [
  [/typescript/i, "typescript"], [/javascript|\bjs\b|node\.?js/i, "javascript"], [/python/i, "python"],
  [/\bphp\b/i, "php"], [/\bsql\b|sqlite|postgres|mysql|supabase/i, "sql"], [/c#|c sharp|\.net/i, "csharp"],
  [/c\+\+/i, "cpp"], [/\bjava\b/i, "java"], [/\bgolang\b|\bgo\b(?= |$)/i, "go"], [/\brust\b/i, "rust"],
  [/\bruby\b/i, "ruby"], [/\bswift\b/i, "swift"], [/\bbash\b|shell script/i, "shell"], [/(^|\s)c(\s|$)/i, "c"],
];

/** Onde roda o exercício: { chave, onde, rotulo, compilador? } — ou null se não dá para rodar. */
export function execucaoDoExercicio(linguagem, tema = "") {
  let chave = chaveDe(linguagem);
  if (!chave && String(linguagem || "").trim().toLowerCase() === "c") chave = "c";
  if (!chave) chave = PELO_TEMA.find(([re]) => re.test(String(tema || "")))?.[1] || "";
  return EXECUCAO[chave] ? { chave, ...EXECUCAO[chave] } : null;
}

/** Ajustes que o compilador on-line precisa: PHP sem a tag de abertura, e a classe pública do
 *  Java (que exigiria o arquivo com o mesmo nome dela). */
export function prepararParaCompilador(chave, codigo) {
  const t = String(codigo ?? "");
  if (chave === "php" && !/<\?php/i.test(t)) return `<?php\n${t}`;
  if (chave === "java") return t.replace(/(^|\n)(\s*)public\s+((?:final\s+|abstract\s+)?class\s)/g, "$1$2$3");
  return t;
}

const limite = (t, max = 20_000) => (t.length > max ? `${t.slice(0, max)}\n… (saída cortada)` : t);

/** A resposta do Wandbox no formato da tela. */
export function resultadoDoServidor(j) {
  const compilacao = [j?.compiler_error, j?.compiler_output].filter(Boolean).join("").trim();
  const saida = String(j?.program_output || "");
  const erro = String(j?.program_error || "");
  const status = j?.status === undefined || j?.status === "" ? null : Number(j.status);
  return {
    saida: limite(saida),
    erro: limite(erro, 8000),
    compilacao: limite(compilacao, 8000),
    status: Number.isFinite(status) ? status : null,
    sinal: String(j?.signal || ""),
    falhouNaCompilacao: !saida && !!compilacao && status !== 0,
  };
}

export const LIMITES_DO_RODAR = { codigo: 20_000, entrada: 5_000, porJanela: 30, janelaMs: 10 * 60_000 };
