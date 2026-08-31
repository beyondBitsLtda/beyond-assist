// Monta o HTML final do Mapa de Arquitetura (ver src/lib/archDocs.js) — um documento ÚNICO e
// autônomo (CSS embutido, Mermaid via CDN), pronto pra abrir direto no navegador ou baixar.
//
// De propósito, TUDO que precisa ser sintaticamente exato (o HTML em si, o diagrama Mermaid)
// é montado AQUI, em código determinístico — a IA só entra com PROSA (descrições, parágrafo de
// visão geral), nunca com algo que precisa "compilar" certinho. Foi um comentário de UMA linha
// ecoado pela IA que já quebrou um build de verdade (ver commits do Modo Código) — pra um
// documento inteiro (HTML + diagrama), deixar a IA escrever a sintaxe seria arriscado demais.

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// rótulo de nó do Mermaid: dentro de aspas duplas, só precisa escapar a aspa dupla em si (e
// tirar quebra de linha, que quebraria a sintaxe de uma linha do diagrama).
function mermaidLabel(text) {
  return String(text ?? "").replace(/"/g, "'").replace(/[\r\n]+/g, " ").slice(0, 60);
}

/** Diagrama Mermaid (flowchart) — ids de nó são só `n0`, `n1`... (nunca o nome da área em si,
 * que pode ter parênteses/barras/espaços) pra não arriscar sintaxe inválida. */
function buildMermaidDiagram(areas, edges) {
  const idByName = new Map(areas.map((a, i) => [a.name, `n${i}`]));
  const lines = ["flowchart TD"];
  for (const area of areas) {
    lines.push(`  ${idByName.get(area.name)}["${mermaidLabel(area.name)}"]`);
  }
  for (const edge of edges) {
    const from = idByName.get(edge.from);
    const to = idByName.get(edge.to);
    if (from && to && from !== to) lines.push(`  ${from} --> ${to}`);
  }
  return lines.join("\n");
}

/**
 * `areas`: [{ name, paths: [...], summary }]
 * `edges`: [{ from, to, weight }] — nomes de área (não os ids do diagrama)
 */
export function renderArchDocHtml({ repo, generatedAt, overview, areas, edges }) {
  const mermaidSrc = buildMermaidDiagram(areas, edges);

  const areaCards = areas
    .slice()
    .sort((a, b) => b.paths.length - a.paths.length)
    .map((area, i) => `
      <section class="area-card">
        <h3><span class="area-index">${String(i + 1).padStart(2, "0")}</span> ${escapeHtml(area.name)} <span class="file-count">${area.paths.length} arquivo${area.paths.length > 1 ? "s" : ""}</span></h3>
        <p class="area-summary">${escapeHtml(area.summary || "(sem descrição)")}</p>
        <details>
          <summary>ver arquivos</summary>
          <ul class="file-list">${area.paths.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
        </details>
      </section>`)
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Arquitetura — ${escapeHtml(repo)}</title>
<style>
  :root { --accent: #38e1ff; --bg: #05080b; --panel: #0c1116; --border: rgba(56,225,255,0.18); --text: #eafcff; --text-dim: rgba(207,239,251,0.65); }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace; line-height: 1.6; }
  header { padding: 40px 28px 28px; border-bottom: 1px solid var(--border); }
  header .eyebrow { font-size: 11px; letter-spacing: 3px; color: var(--accent); text-transform: uppercase; }
  header h1 { margin: 8px 0 4px; font-size: 26px; word-break: break-word; }
  header .meta { font-size: 12px; color: var(--text-dim); }
  main { max-width: 980px; margin: 0 auto; padding: 32px 28px 80px; }
  h2 { font-size: 14px; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-top: 48px; }
  .overview { font-size: 15px; color: var(--text); max-width: 78ch; }
  .diagram-wrap { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 20px; overflow-x: auto; margin-top: 16px; }
  .area-grid { display: grid; gap: 14px; margin-top: 16px; }
  .area-card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; }
  .area-card h3 { margin: 0 0 8px; font-size: 15px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .area-index { color: var(--accent); font-size: 12px; }
  .file-count { margin-left: auto; font-size: 11px; color: var(--text-dim); font-weight: normal; }
  .area-summary { margin: 0; font-size: 13px; color: var(--text-dim); }
  details { margin-top: 10px; }
  summary { cursor: pointer; font-size: 11px; color: var(--accent); }
  .file-list { list-style: none; margin: 10px 0 0; padding: 0; font-size: 11.5px; color: var(--text-dim); columns: 2; column-gap: 24px; }
  .file-list li { padding: 2px 0; break-inside: avoid; }
  footer { text-align: center; padding: 30px; font-size: 11px; color: var(--text-dim); }
  a { color: var(--accent); }
  @media (max-width: 640px) { .file-list { columns: 1; } }
</style>
</head>
<body>
  <header>
    <div class="eyebrow">Mapa de Arquitetura · gerado pela Lisa</div>
    <h1>${escapeHtml(repo)}</h1>
    <div class="meta">gerado em ${escapeHtml(generatedAt)} · ${areas.length} área${areas.length > 1 ? "s" : ""} mapeada${areas.length > 1 ? "s" : ""}</div>
  </header>
  <main>
    <h2>Visão geral</h2>
    <p class="overview">${escapeHtml(overview).replace(/\n+/g, "</p><p class=\"overview\">")}</p>

    <h2>Diagrama de dependências</h2>
    <div class="diagram-wrap"><pre class="mermaid">${mermaidSrc}</pre></div>

    <h2>Áreas do repositório</h2>
    <div class="area-grid">
      ${areaCards}
    </div>
  </main>
  <footer>Documento gerado automaticamente — o diagrama reflete imports reais entre os arquivos indexados; as descrições são inferidas por IA a partir dos nomes de arquivo/pasta.</footer>

  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: "dark", securityLevel: "strict" });
  </script>
</body>
</html>`;
}
