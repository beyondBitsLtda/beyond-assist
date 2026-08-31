import * as babelParser from "@babel/parser";

// Validação ESTRUTURAL (sem IA, sem custo, instantânea) do código que a Lisa acabou de
// escrever, ANTES de commitar — é o que teria pego o bug do globals.css truncado (chaves
// desbalanceadas) antes de virar PR. Server-only (roda dentro de runCodeTaskStep, nunca no
// bundle do navegador).

function extOf(path) {
  return String(path || "").split(".").pop().toLowerCase();
}

function validateCss(content) {
  let depth = 0;
  for (const ch of content) {
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth < 0) return { ok: false, error: "chave de fechamento '}' sem abertura correspondente" };
    }
  }
  if (depth !== 0) return { ok: false, error: `${depth} chave${Math.abs(depth) > 1 ? "s" : ""} '{' sem fechamento correspondente (arquivo cortado no meio?)` };
  return { ok: true };
}

/** `{ ok: true }` ou `{ ok: false, error }` — extensão sem validador conhecido sempre passa
 * (`ok: true`), não bloqueia o que a gente não sabe checar. */
export function validateFileSyntax(path, content) {
  const ext = extOf(path);
  try {
    if (["js", "jsx", "mjs", "cjs"].includes(ext)) {
      babelParser.parse(content, { sourceType: "unambiguous", plugins: ["jsx"] });
      return { ok: true };
    }
    if (["ts", "tsx"].includes(ext)) {
      babelParser.parse(content, { sourceType: "unambiguous", plugins: ext === "tsx" ? ["typescript", "jsx"] : ["typescript"] });
      return { ok: true };
    }
    if (ext === "json") {
      JSON.parse(content);
      return { ok: true };
    }
    if (ext === "css") {
      return validateCss(content);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err).split("\n")[0].slice(0, 200) };
  }
}
