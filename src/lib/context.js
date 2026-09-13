// contexto/*.md — arquivos de contexto pessoal (ex.: lord.md: nome, família, carreira do
// usuário) que a Lisa deve SEMPRE levar em conta, ao contrário de persona.md (que só entra com
// o Modo Persona ligado — ver withPersona em rag.js).
//
// Lê QUALQUER .md dentro da pasta, não um nome fixo: dá pra ir acrescentando arquivos de
// contexto ao longo do tempo sem tocar em código nenhum. Isso continua valendo — o que mudou é
// QUANDO a pasta é varrida.
//
// Antes era em runtime, com fs.readdirSync. O Edge runtime do Cloudflare não tem sistema de
// arquivos, e o código engolia o erro devolvendo string vazia: a Lisa perderia todo o contexto
// pessoal sem nenhum erro aparecer. Agora quem varre a pasta é o webpack, no build
// (`require.context`), e o conteúdo entra no bundle. Acrescentar um .md continua bastando —
// ele é pego no próximo deploy.
let _cached = null;

function loadContextDocs() {
  let ctx;
  try {
    // `import.meta.webpackContext` é a varredura de pasta do webpack 5 para módulos ESM. Este
    // projeto é ESM ("type": "module"), então o `require.context` clássico não existe aqui —
    // ele lançava ReferenceError, caía no catch e o contexto sumia sem aviso.
    ctx = import.meta.webpackContext("../../contexto", { recursive: false, regExp: /\.md$/ });
  } catch {
    return ""; // build sem webpack — melhor a Lisa ficar sem contexto do que não subir
  }

  const parts = [];
  // ordena pra a ordem do prompt não depender da ordem em que o bundler resolveu os arquivos
  for (const caminho of ctx.keys().sort()) {
    try {
      const mod = ctx(caminho);
      const text = String(mod?.default ?? mod ?? "").trim();
      const nome = caminho.replace(/^\.\//, "");
      if (text) parts.push(`--- ${nome} ---\n${text}`);
    } catch {
      // um arquivo isolado falhou — ignora só ele, não derruba os outros
    }
  }
  return parts.join("\n\n");
}

export function getContextDocsText() {
  if (_cached !== null) return _cached;
  _cached = loadContextDocs();
  return _cached;
}
