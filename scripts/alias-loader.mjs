// Ensina ao Node o atalho `@/` que o Next entende sozinho.
//
// Dentro do Next, `@/lib/supabase.js` resolve por causa do `jsconfig.json`. O Node puro não
// lê aquele arquivo, então qualquer script que importe um módulo de src/ que use o atalho
// morre com ERR_MODULE_NOT_FOUND — mesmo que o próprio script use caminho relativo, porque
// basta UM módulo lá no fundo da cadeia usar `@/`.
//
// Uso:  node --import ./scripts/alias-loader.mjs scripts/<algum>.mjs

import { register } from "node:module";

// `import.meta.url` JÁ é uma URL de arquivo, com os acentos do caminho devidamente escapados.
// Converter para caminho e de volta faz a codificação acontecer duas vezes — e "Repositórios"
// vira "Reposit%25C3%25B3rios", que não existe em disco.
const RAIZ = new URL("../src/", import.meta.url).href;

register(
  "data:text/javascript," +
    encodeURIComponent(`
      const RAIZ = ${JSON.stringify(RAIZ)};
      export function resolve(especificador, contexto, proximo) {
        if (especificador.startsWith("@/")) {
          return proximo(new URL(especificador.slice(2), RAIZ).href, contexto);
        }
        return proximo(especificador, contexto);
      }
    `),
  import.meta.url
);
