import fs from "fs";
import path from "path";

// contexto/*.md — arquivos de contexto pessoal (ex.: lord.md: nome, família, carreira do
// usuário) que a Lisa deve SEMPRE levar em conta, ao contrário de persona.md (que só entra
// com o Modo Persona ligado — ver withPersona em rag.js). Mesmo padrão de persona.js: lido
// em runtime via fs (pega mudanças em novos deploys sem editar código nenhum), com
// next.config.js incluindo a pasta no bundle da função (outputFileTracingIncludes) — sem
// aquilo a Vercel não empacota esses arquivos e a leitura falharia em produção mesmo
// funcionando local. Lê QUALQUER .md dentro da pasta, não só um nome fixo — o usuário pode
// ir adicionando mais arquivos de contexto ao longo do tempo sem precisar mexer em código.
let _cached = null;

function loadContextDocs() {
  const dir = path.join(process.cwd(), "contexto");
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".md"));
  } catch {
    return ""; // pasta contexto/ ainda não existe neste deploy — sem efeito nenhum
  }
  const parts = [];
  for (const file of files) {
    try {
      const text = fs.readFileSync(path.join(dir, file), "utf8").trim();
      if (text) parts.push(`--- ${file} ---\n${text}`);
    } catch {
      // um arquivo isolado falhou ao ler — ignora só ele, não derruba os outros
    }
  }
  return parts.join("\n\n");
}

export function getContextDocsText() {
  if (_cached !== null) return _cached;
  _cached = loadContextDocs();
  return _cached;
}
