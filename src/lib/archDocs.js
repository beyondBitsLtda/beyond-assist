import { supabase } from "./supabase.js";
import { listIndexedFiles } from "./ingest/github.js";
import { getFullFileContents } from "./repoFiles.js";
import { resolveFileImports } from "./importGraph.js";
import { describeArchArea, writeArchOverview, explainKeyFile, planNarrative } from "./gemini.js";
import { renderArchDocHtml } from "./archDocTemplate.js";

// Mapa de Arquitetura: dado um repositório já indexado (ver /code-repos), gera um HTML
// autônomo documentando as áreas do código e como se relacionam de verdade (grafo de
// dependência calculado a partir dos imports, não "achismo" da IA — ver importGraph.js) — a
// IA só entra pra descrever cada área e escrever a visão geral (prosa, nunca sintaxe).
//
// Mesmo padrão RETOMÁVEL em passos de code_tasks (ver codeTasks.js:runCodeTaskStep) — cada
// passo é um pedido HTTP próprio, com seu próprio teto de 60s (Vercel, plano Hobby, fixo).

const MAX_AREAS = 24; // além disso, os menores grupos viram um "outros diversos" — documento fica ilegível com área demais
const MAX_FILES_SCANNED = 500; // teto de segurança pra repositório muito grande — não trava a tarefa, só limita o grafo de dependência a uma amostra
const SCAN_BATCH = 20; // arquivos por passo no scan de imports — puro I/O+regex, rápido, cabe folgado nos 60s
const MAX_EDGES = 60; // no diagrama, só os laços mais fortes — o resto vira um emaranhado ilegível
const MAX_KEY_FILES = 6; // quantos arquivos ganham leitura de código completa (com explicação) na seção de "código-chave"
const MAX_KEY_FILE_CHARS = 8000; // teto de tamanho do conteúdo mostrado/enviado pra IA por arquivo-chave — arquivo gigante vira ruído, não clareza

/** Escolhe os arquivos "chave" pra seção de leitura de código — por padrão, os mais
 * IMPORTADOS por outros arquivos (quem depende de mais gente costuma ser mais central). Se o
 * grafo de dependência não achou nada (repositório pequeno, ou imports não resolvidos), cai
 * pro fallback de pegar arquivos das áreas com mais arquivos — nunca deixa a seção vazia. */
function pickKeyFiles(fileInDegree, areas, max) {
  const ranked = Object.entries(fileInDegree)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([path]) => path);
  let picked = ranked.slice(0, max);
  if (picked.length < max) {
    const fallback = areas
      .slice()
      .sort((a, b) => b.paths.length - a.paths.length)
      .flatMap((a) => a.paths)
      .filter((p) => !picked.includes(p));
    picked = [...picked, ...fallback.slice(0, max - picked.length)];
  }
  return picked;
}

/** Chave de agrupamento "crua" de um caminho — pelas 2 primeiras pastas depois de um `src/`
 * opcional (convenção comum; funciona bem mesmo sem `src/`). Só uma heurística: nomes de
 * pasta já carregam bastante sinal sobre a responsabilidade de cada parte do projeto. */
function rawAreaKey(path) {
  const parts = path.replace(/^src\//, "").split("/");
  if (parts.length <= 1) return "raiz"; // arquivo solto na raiz (ex.: package.json)
  if (parts.length === 2) return parts[0]; // pasta/arquivo.ext — a PASTA já é a área; sem isso, "lib/gemini.js" virava uma área de 1 arquivo só, e cada arquivo direto dentro de uma pasta rasa (ex.: lib/*.js) ficava separado dos outros da mesma pasta
  return parts.slice(0, 2).join("/"); // pasta/subpasta/... — agrupa pelos 2 primeiros níveis
}

/** Agrupa TODOS os caminhos indexados em áreas, capadas em MAX_AREAS — os grupos menores além
 * do teto viram um único "outros diversos" (mais fácil de ler que 60 áreas de 1 arquivo só).
 * Devolve `{ areas, keyMap }` — `keyMap` traduz a chave crua (rawAreaKey) pro nome FINAL da
 * área (depois da fusão), usado depois pra computar as arestas do grafo consistentemente. */
function groupIntoAreas(paths) {
  const byKey = new Map();
  for (const path of paths) {
    const key = rawAreaKey(path);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(path);
  }
  const sorted = [...byKey.entries()].sort((a, b) => b[1].length - a[1].length);
  const keyMap = {};
  const areas = [];
  sorted.forEach(([key, filePaths], i) => {
    if (i < MAX_AREAS) {
      keyMap[key] = key;
      areas.push({ name: key, paths: filePaths, summary: "" });
    } else {
      keyMap[key] = "outros diversos";
    }
  });
  const outros = sorted.slice(MAX_AREAS).flatMap(([, filePaths]) => filePaths);
  if (outros.length) areas.push({ name: "outros diversos", paths: outros, summary: "" });
  return { areas, keyMap };
}

async function recordDoc(repo) {
  const { data, error } = await supabase.from("arch_docs").insert({ repo, status: "running", state: { stage: "grouping" } }).select().single();
  if (error) throw new Error(`recordDoc: ${error.message}`);
  return data;
}

async function updateDoc(id, patch) {
  await supabase.from("arch_docs").update(patch).eq("id", id);
}

export async function listArchDocs() {
  const { data, error } = await supabase.from("arch_docs").select("id, repo, status, error, created_at").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(`listArchDocs: ${error.message}`);
  return data || [];
}

export async function getArchDocHtml(id) {
  const { data, error } = await supabase.from("arch_docs").select("html, status").eq("id", id).single();
  if (error || !data) throw new Error("documento não encontrado");
  return data;
}

/**
 * Avança UM PASSO da geração do mapa de arquitetura — mesmo formato de eventos de
 * runCodeTaskStep (ver codeTasks.js): { type: 'stage'|'narration'|'step_done', ... }.
 * Sem `docId`, cria um documento novo e roda o 1º passo; com `docId`, retoma de onde parou.
 */
export async function* runArchDocStep({ docId, repo }) {
  let doc;
  if (docId) {
    const { data, error } = await supabase.from("arch_docs").select("*").eq("id", docId).single();
    if (error || !data) throw new Error("documento não encontrado (docId inválido)");
    doc = data;
  } else {
    doc = await recordDoc(repo);
  }

  let state = doc.state && typeof doc.state === "object" ? doc.state : { stage: "grouping" };
  const stage = state.stage || "grouping";
  const setState = async (patch) => {
    state = { ...state, ...patch };
    await supabase.from("arch_docs").update({ state }).eq("id", doc.id);
  };

  try {
    if (stage === "grouping") {
      yield { type: "stage", stage: "grouping", docId: doc.id };
      yield { type: "narration", text: `Deixa eu olhar a estrutura de pastas do repositório ${repo}.` };
      const allPaths = await listIndexedFiles(repo);
      if (!allPaths.length) {
        const reason = "esse repositório ainda não tem nenhum arquivo indexado — sincronize em /code-repos antes de gerar o mapa.";
        await updateDoc(doc.id, { status: "error", error: reason });
        yield { type: "narration", text: reason };
        yield { type: "step_done", docId: doc.id, stage: "error", done: true, ok: false, error: reason };
        return;
      }
      const scanPaths = allPaths.slice(0, MAX_FILES_SCANNED);
      const { areas, keyMap } = groupIntoAreas(scanPaths);
      yield { type: "narration", text: `Encontrei ${scanPaths.length} arquivo${scanPaths.length > 1 ? "s" : ""} em ${areas.length} área${areas.length > 1 ? "s" : ""}.` };
      await setState({
        stage: "scan-imports", allPaths: scanPaths, areas, keyMap,
        edgeCounts: {}, fileInDegree: {}, scanIndex: 0,
      });
      yield { type: "step_done", docId: doc.id, stage: "scan-imports", done: false };
      return;
    }

    // Varre um LOTE de arquivos por passo (só I/O + regex, sem IA — rápido) somando pesos de
    // aresta ÁREA→ÁREA a partir dos imports resolvidos de verdade (ver importGraph.js).
    if (stage === "scan-imports") {
      yield { type: "stage", stage: "scan-imports", docId: doc.id };
      const { allPaths = [], areas = [], keyMap = {}, edgeCounts = {}, fileInDegree = {}, scanIndex = 0 } = state;
      if (scanIndex >= allPaths.length) {
        const edges = Object.entries(edgeCounts)
          .map(([key, weight]) => { const [from, to] = key.split("|"); return { from, to, weight }; })
          .sort((a, b) => b.weight - a.weight)
          .slice(0, MAX_EDGES);
        yield { type: "narration", text: `Mapeei ${edges.length} conexão${edges.length > 1 ? "ões" : ""} real${edges.length > 1 ? "is" : ""} entre as áreas.` };
        const keyFiles = pickKeyFiles(fileInDegree, areas, MAX_KEY_FILES);
        await setState({ stage: "describe", edges, describeIndex: 0, keyFiles });
        yield { type: "step_done", docId: doc.id, stage: "describe", done: false };
        return;
      }
      const knownPaths = new Set(allPaths);
      const batch = allPaths.slice(scanIndex, scanIndex + SCAN_BATCH);
      const files = await getFullFileContents(repo, batch);
      const nextEdgeCounts = { ...edgeCounts };
      const nextInDegree = { ...fileInDegree };
      for (const f of files) {
        const fromArea = keyMap[rawAreaKey(f.path)] || rawAreaKey(f.path);
        for (const target of resolveFileImports(f.content, f.path, knownPaths)) {
          nextInDegree[target] = (nextInDegree[target] || 0) + 1;
          const toArea = keyMap[rawAreaKey(target)] || rawAreaKey(target);
          if (toArea === fromArea) continue;
          const key = `${fromArea}|${toArea}`;
          nextEdgeCounts[key] = (nextEdgeCounts[key] || 0) + 1;
        }
      }
      await setState({ edgeCounts: nextEdgeCounts, fileInDegree: nextInDegree, scanIndex: scanIndex + batch.length });
      yield { type: "step_done", docId: doc.id, stage: "scan-imports", done: false };
      return;
    }

    if (stage === "describe") {
      yield { type: "stage", stage: "describe", docId: doc.id };
      const { areas = [], edges = [], describeIndex = 0 } = state;
      if (describeIndex >= areas.length) {
        await setState({ stage: "overview" });
        yield { type: "step_done", docId: doc.id, stage: "overview", done: false };
        return;
      }
      const area = areas[describeIndex];
      yield { type: "narration", text: `Analisando a área \`${area.name}\`…` };
      const relatedTo = [...new Set(
        edges.filter((e) => e.from === area.name || e.to === area.name)
          .map((e) => (e.from === area.name ? e.to : e.from))
      )].slice(0, 6);
      const summary = await describeArchArea({ repo, areaName: area.name, paths: area.paths, relatedTo }).catch(() => "");
      const nextAreas = areas.map((a, i) => (i === describeIndex ? { ...a, summary: summary || "(sem descrição disponível)" } : a));
      await setState({ areas: nextAreas, describeIndex: describeIndex + 1 });
      yield { type: "step_done", docId: doc.id, stage: "describe", done: false };
      return;
    }

    // Leitura de código-chave: um arquivo POR PASSO (busca o conteúdo real + pede uma
    // explicação do papel dele na arquitetura) — os arquivos escolhidos em "scan-imports"
    // (pickKeyFiles), tipicamente os mais importados por outros arquivos.
    if (stage === "explain-key-files") {
      yield { type: "stage", stage: "explain-key-files", docId: doc.id };
      const { keyFiles = [], keyFilesDone = [], explainIndex = 0, keyMap = {} } = state;
      if (explainIndex >= keyFiles.length) {
        await setState({ stage: "narrative" });
        yield { type: "step_done", docId: doc.id, stage: "narrative", done: false };
        return;
      }
      const path = keyFiles[explainIndex];
      yield { type: "narration", text: `Lendo \`${path}\` de perto.` };
      const [fetched] = await getFullFileContents(repo, [path]);
      let entry;
      if (!fetched) {
        entry = { path, content: "", truncated: false, explanation: "(não consegui recuperar o conteúdo deste arquivo)" };
      } else {
        const truncated = fetched.content.length > MAX_KEY_FILE_CHARS;
        const shown = fetched.content.slice(0, MAX_KEY_FILE_CHARS);
        const area = keyMap[rawAreaKey(path)] || rawAreaKey(path);
        const explanation = await explainKeyFile({ repo, path, content: shown, area }).catch(() => "");
        entry = { path, content: shown, truncated, explanation: explanation || "(sem explicação disponível)" };
      }
      await setState({ keyFilesDone: [...keyFilesDone, entry], explainIndex: explainIndex + 1 });
      yield { type: "step_done", docId: doc.id, stage: "explain-key-files", done: false };
      return;
    }

    if (stage === "narrative") {
      yield { type: "stage", stage: "narrative", docId: doc.id };
      yield { type: "narration", text: "Reconstruindo o fluxo de uso e os casos de uso da aplicação." };
      const { areas = [], overview = "" } = state;
      const { usageFlow, useCases } = await planNarrative({
        repo, overview,
        areaSummaries: areas.map((a) => ({ name: a.name, summary: a.summary })),
      }).catch(() => ({ usageFlow: [], useCases: [] }));
      await setState({ stage: "render", usageFlow, useCases });
      yield { type: "step_done", docId: doc.id, stage: "render", done: false };
      return;
    }

    if (stage === "overview") {
      yield { type: "stage", stage: "overview", docId: doc.id };
      yield { type: "narration", text: "Escrevendo a visão geral do repositório." };
      const { areas = [] } = state;
      const overview = await writeArchOverview({
        repo,
        areaSummaries: areas.map((a) => ({ name: a.name, fileCount: a.paths.length, summary: a.summary })),
      }).catch(() => "");
      await setState({ stage: "explain-key-files", explainIndex: 0, keyFilesDone: [], overview });
      yield { type: "step_done", docId: doc.id, stage: "explain-key-files", done: false };
      return;
    }

    if (stage === "render") {
      yield { type: "stage", stage: "render", docId: doc.id };
      yield { type: "narration", text: "Montando o documento final." };
      const { areas = [], edges = [], overview = "", keyFilesDone = [], usageFlow = [], useCases = [] } = state;
      const html = renderArchDocHtml({
        repo,
        generatedAt: new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date()),
        overview: overview || "(não consegui gerar uma visão geral desta vez.)",
        areas,
        edges,
        usageFlow,
        useCases,
        keyFiles: keyFilesDone,
      });
      await updateDoc(doc.id, { status: "done", html });
      yield { type: "narration", text: "Pronto! O mapa de arquitetura está pronto pra ver." };
      yield { type: "step_done", docId: doc.id, stage: "done", done: true, ok: true };
      return;
    }

    yield { type: "step_done", docId: doc.id, stage: "done", done: true, ok: true };
  } catch (err) {
    const msg = String(err?.message || err);
    await updateDoc(doc.id, { status: "error", error: msg });
    yield { type: "narration", text: `Deu ruim tentando gerar isso: ${msg}` };
    yield { type: "step_done", docId: doc.id, stage: "error", done: true, ok: false, error: msg };
  }
}
