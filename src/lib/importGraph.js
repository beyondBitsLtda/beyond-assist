// Extrai e resolve especificadores de `import`/`require` de código JS/TS/JSX/TSX pra CAMINHOS
// REAIS entre os arquivos já indexados de um repositório — melhor esforço, só relativo (./,
// ../) e o alias @/ (convenção deste e de outros projetos Next.js, ver jsconfig.json); o que
// não resolver é só ignorado, sem travar nada.
//
// Usado por src/lib/codeTasks.js (contexto por dependência: ao ler um arquivo, traz junto o
// que ele importa) e por src/lib/archDocs.js (grafo real de dependências entre áreas do
// repositório, pro diagrama de arquitetura).

const IMPORT_RE = /(?:import[\s\S]*?from\s*|require\(\s*)["']([^"']+)["']/g;

/** Todos os especificadores de import/require RELATIVOS ou com alias @/ num trecho de código
 * (ignora pacotes de node_modules, ex.: "react", "@supabase/supabase-js"). */
export function extractImportSpecs(content) {
  const specs = new Set();
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(content))) {
    if (m[1].startsWith(".") || m[1].startsWith("@/")) specs.add(m[1]);
  }
  return [...specs];
}

/** Resolve UM especificador (relativo a `fromPath`, ou com alias @/) pro caminho real dentro
 * de `knownPaths` (Set de todos os caminhos indexados do repo) — tenta com/sem extensão comum
 * e /index.*, porque import quase sempre omite a extensão. `null` se não achar. */
export function resolveImportSpec(spec, fromPath, knownPaths) {
  let base;
  if (spec.startsWith("@/")) {
    base = `src/${spec.slice(2)}`;
  } else {
    const dir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
    const stack = [];
    for (const part of (dir ? `${dir}/${spec}` : spec).split("/")) {
      if (part === "." || part === "") continue;
      if (part === "..") stack.pop();
      else stack.push(part);
    }
    base = stack.join("/");
  }
  const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`, `${base}/index.js`, `${base}/index.jsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((c) => knownPaths.has(c)) || null;
}

/** Todos os caminhos que um arquivo importa (relativo/@/), já RESOLVIDOS e filtrados pro que
 * de fato existe em `knownPaths` — conveniência que junta extractImportSpecs + resolveImportSpec. */
export function resolveFileImports(content, fromPath, knownPaths) {
  return [...new Set(extractImportSpecs(content).map((spec) => resolveImportSpec(spec, fromPath, knownPaths)).filter(Boolean))];
}
