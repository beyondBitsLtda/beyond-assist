// Monta o HTML final do Mapa de Arquitetura (ver src/lib/archDocs.js) — um documento ÚNICO e
// autônomo (CSS embutido, Mermaid + Prism via CDN), pronto pra abrir direto no navegador ou
// baixar.
//
// De propósito, TUDO que precisa ser sintaticamente exato (o HTML em si, a sintaxe dos
// diagramas Mermaid) é montado AQUI, em código determinístico — a IA só entra com PROSA
// (descrições de área, visão geral, explicação de código, fluxo/casos de uso já como DADOS
// estruturados, nunca como sintaxe pronta). Foi um comentário de UMA linha ecoado pela IA que
// já quebrou um build de verdade (ver commits do Modo Código) — pra um documento inteiro
// (HTML + 3 diagramas), deixar a IA escrever a sintaxe seria arriscado demais.

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// rótulo de nó/participante do Mermaid: troca aspa dupla por simples, tira quebra de linha, e
// troca ":" por "-" (é separador de sintaxe em "Note over X: texto" e em "participant X as Y:Z"
// — sem isso, um rótulo gerado pela IA com dois-pontos quebraria a linha do diagrama).
function mermaidLabel(text) {
  return String(text ?? "").replace(/"/g, "'").replace(/[\r\n]+/g, " ").replace(/:/g, "-").slice(0, 60);
}

/** Diagrama de DEPENDÊNCIA entre áreas (flowchart) — ids de nó são só `n0`, `n1`... (nunca o
 * nome da área em si, que pode ter parênteses/barras/espaços) pra não arriscar sintaxe inválida. */
function buildDependencyDiagram(areas, edges) {
  const idByName = new Map(areas.map((a, i) => [a.name, `n${i}`]));
  const lines = ["flowchart TD"];
  for (const area of areas) lines.push(`  ${idByName.get(area.name)}["${mermaidLabel(area.name)}"]`);
  for (const edge of edges) {
    const from = idByName.get(edge.from);
    const to = idByName.get(edge.to);
    if (from && to && from !== to) lines.push(`  ${from} --> ${to}`);
  }
  return lines.join("\n");
}

/** Diagrama de FLUXO DE USO — sequenceDiagram do Mermaid. Cada passo vira uma "Note" sobre o
 * participante daquele passo (em vez de setas entre participantes) — mais robusto que inferir
 * quem fala com quem, e ainda dá uma linha do tempo clara de quem faz o quê, em ordem. */
function buildUsageFlowDiagram(usageFlow) {
  if (!usageFlow.length) return null;
  const actors = [...new Set(usageFlow.map((s) => s.actor))];
  const idByActor = new Map(actors.map((a, i) => [a, `p${i}`]));
  const lines = ["sequenceDiagram"];
  for (const actor of actors) lines.push(`  participant ${idByActor.get(actor)} as ${mermaidLabel(actor)}`);
  usageFlow.forEach((step, i) => {
    const id = idByActor.get(step.actor);
    lines.push(`  Note over ${id}: ${i + 1}. ${mermaidLabel(step.action)}`);
  });
  return lines.join("\n");
}

/** Diagrama de CASOS DE USO — não existe um tipo de diagrama UML "use case" no Mermaid, então
 * emula com um flowchart: o ator vira um retângulo, cada caso de uso vira um nó "estádio"
 * (`(["texto"])`), a forma oval clássica de caso de uso, ligado ao ator. */
function buildUseCaseDiagram(useCases) {
  if (!useCases.length) return null;
  const lines = ["flowchart LR"];
  useCases.forEach((group, ai) => {
    const actorId = `a${ai}`;
    lines.push(`  ${actorId}["👤 ${mermaidLabel(group.actor)}"]`);
    (group.cases || []).forEach((useCase, ci) => {
      const caseId = `a${ai}_c${ci}`;
      lines.push(`  ${caseId}(["${mermaidLabel(useCase)}"])`);
      lines.push(`  ${actorId} --> ${caseId}`);
    });
  });
  return lines.join("\n");
}

const LANG_BY_EXT = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "jsx",
  ts: "typescript", tsx: "tsx", css: "css", json: "json",
  html: "markup", htm: "markup", xml: "markup", svg: "markup",
  sh: "bash", bash: "bash", sql: "sql", yml: "yaml", yaml: "yaml", py: "python",
};
function langForPath(path) {
  const ext = String(path || "").split(".").pop().toLowerCase();
  return LANG_BY_EXT[ext] || "none";
}

/**
 * `areas`: [{ name, paths: [...], summary }]
 * `edges`: [{ from, to, weight }] — nomes de área (não os ids do diagrama)
 * `usageFlow`: [{ actor, action }] (em ordem)
 * `useCases`: [{ actor, cases: [...] }]
 * `keyFiles`: [{ path, content, truncated, explanation }]
 */
export function renderArchDocHtml({ repo, generatedAt, overview, areas, edges, usageFlow = [], useCases = [], keyFiles = [] }) {
  const depDiagram = buildDependencyDiagram(areas, edges);
  const usageDiagram = buildUsageFlowDiagram(usageFlow);
  const useCaseDiagram = buildUseCaseDiagram(useCases);

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

  const keyFileSections = keyFiles.map((f, i) => `
      <section class="code-card">
        <h3><span class="area-index">${String(i + 1).padStart(2, "0")}</span> <code>${escapeHtml(f.path)}</code></h3>
        <p class="area-summary">${escapeHtml(f.explanation)}</p>
        <pre class="code-block"><code class="language-${langForPath(f.path)}">${escapeHtml(f.content)}</code></pre>
        ${f.truncated ? `<div class="truncated-note">conteúdo cortado — arquivo maior do que o exibido aqui</div>` : ""}
      </section>`).join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Arquitetura — ${escapeHtml(repo)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" />
<style>
  :root { --accent: #38e1ff; --purple: #c9a6ff; --green: #7bd88f; --orange: #ff9d3d; --bg: #05080b; --panel: #0c1116; --border: rgba(56,225,255,0.18); --text: #eafcff; --text-dim: rgba(207,239,251,0.65); }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace; line-height: 1.6; }
  header { padding: 40px 28px 28px; border-bottom: 1px solid var(--border); }
  header .eyebrow { font-size: 11px; letter-spacing: 3px; color: var(--accent); text-transform: uppercase; }
  header h1 { margin: 8px 0 4px; font-size: 26px; word-break: break-word; }
  header .meta { font-size: 12px; color: var(--text-dim); }
  nav.toc { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 16px; }
  nav.toc a { font-size: 11px; color: var(--text-dim); text-decoration: none; border-bottom: 1px dotted rgba(207,239,251,0.3); }
  nav.toc a:hover { color: var(--accent); }
  main { max-width: 1040px; margin: 0 auto; padding: 32px 28px 80px; }
  h2 { font-size: 14px; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-top: 56px; scroll-margin-top: 20px; }
  .overview { font-size: 15px; color: var(--text); max-width: 78ch; }
  .section-note { font-size: 11.5px; color: var(--text-dim); margin: -6px 0 16px; }
  .diagram-wrap { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 20px; overflow-x: auto; margin-top: 16px; }
  .area-grid { display: grid; gap: 14px; margin-top: 16px; }
  .area-card, .code-card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; }
  .area-card h3, .code-card h3 { margin: 0 0 8px; font-size: 15px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .code-card h3 code { font-size: 13px; color: var(--accent); }
  .area-index { color: var(--accent); font-size: 12px; }
  .file-count { margin-left: auto; font-size: 11px; color: var(--text-dim); font-weight: normal; }
  .area-summary { margin: 0; font-size: 13px; color: var(--text-dim); }
  details { margin-top: 10px; }
  summary { cursor: pointer; font-size: 11px; color: var(--accent); }
  .file-list { list-style: none; margin: 10px 0 0; padding: 0; font-size: 11.5px; color: var(--text-dim); columns: 2; column-gap: 24px; }
  .file-list li { padding: 2px 0; break-inside: avoid; }
  .code-grid { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
  .code-block { margin: 12px 0 0; max-height: 480px; overflow: auto; border-radius: 8px; font-size: 12px; }
  .code-block, .code-block code { background: #0a0e12 !important; }
  .truncated-note { font-size: 10.5px; color: var(--orange); margin-top: 6px; }
  footer { text-align: center; padding: 30px; font-size: 11px; color: var(--text-dim); }
  a { color: var(--accent); }
  @media (max-width: 640px) { .file-list { columns: 1; } }
</style>
</head>
<body>
  <header>
    <div class="eyebrow">Mapa de Arquitetura · gerado pela Lisa</div>
    <h1>${escapeHtml(repo)}</h1>
    <div class="meta">gerado em ${escapeHtml(generatedAt)} · ${areas.length} área${areas.length > 1 ? "s" : ""} mapeada${areas.length > 1 ? "s" : ""} · ${keyFiles.length} arquivo${keyFiles.length > 1 ? "s" : ""}-chave analisado${keyFiles.length > 1 ? "s" : ""}</div>
    <nav class="toc">
      <a href="#overview">Visão geral</a>
      <a href="#dependencias">Dependências</a>
      ${usageDiagram ? `<a href="#fluxo">Fluxo de uso</a>` : ""}
      ${useCaseDiagram ? `<a href="#casos-de-uso">Casos de uso</a>` : ""}
      <a href="#areas">Áreas</a>
      ${keyFiles.length ? `<a href="#codigo-chave">Código-chave</a>` : ""}
    </nav>
  </header>
  <main>
    <h2 id="overview">Visão geral</h2>
    <p class="overview">${escapeHtml(overview).replace(/\n+/g, "</p><p class=\"overview\">")}</p>

    <h2 id="dependencias">Diagrama de dependências</h2>
    <div class="section-note">Calculado a partir dos imports reais entre os arquivos indexados — não é uma estimativa da IA.</div>
    <div class="diagram-wrap"><pre class="mermaid">${depDiagram}</pre></div>

    ${usageDiagram ? `
    <h2 id="fluxo">Fluxo de uso</h2>
    <div class="section-note">Sequência principal de como a aplicação é usada, do início ao resultado final.</div>
    <div class="diagram-wrap"><pre class="mermaid">${usageDiagram}</pre></div>` : ""}

    ${useCaseDiagram ? `
    <h2 id="casos-de-uso">Casos de uso</h2>
    <div class="section-note">Por ator do sistema (usuário, processos automáticos, serviços externos).</div>
    <div class="diagram-wrap"><pre class="mermaid">${useCaseDiagram}</pre></div>` : ""}

    <h2 id="areas">Áreas do repositório</h2>
    <div class="area-grid">
      ${areaCards}
    </div>

    ${keyFiles.length ? `
    <h2 id="codigo-chave">Leitura de código-chave</h2>
    <div class="section-note">Os arquivos mais centrais (mais importados por outros, ou representativos das áreas principais), com o código real e uma explicação do papel de cada um.</div>
    <div class="code-grid">
      ${keyFileSections}
    </div>` : ""}
  </main>
  <footer>Documento gerado automaticamente — os diagramas de dependência e fluxo refletem dados reais extraídos do código; descrições, explicações e o fluxo/casos de uso narrados são inferidos por IA.</footer>

  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({ startOnLoad: true, theme: "dark", securityLevel: "strict" });</script>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-jsx.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-tsx.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-sql.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
  <script>Prism.highlightAll();</script>
</body>
</html>`;
}
