import { supabase } from "./supabase.js";
import { retrieve } from "./rag.js";
import { planCodeChanges, streamCodeChanges, selectRelevantFiles } from "./gemini.js";
import { getBranchSha, createBranch, getFileSha, putFileContent, createPullRequest, listBranches } from "./github.js";
import { listIndexedFiles } from "./ingest/github.js";

// Tarefas de código: o usuário escolhe REPOSITÓRIO + BRANCH BASE e descreve o que quer.
// A Lisa nunca commita na branch escolhida — sempre cria uma branch NOVA a partir dela,
// aplica os arquivos lá, e abre um Pull Request de volta pra base. Mesclar é sempre manual.

// Gemini precisa gerar o CONTEÚDO COMPLETO de cada arquivo de volta (não um diff) — quanto
// mais arquivos (principalmente arquivos grandes, tipo um CSS global), mais tempo de geração,
// e a função tem teto fixo de 60s (Vercel, plano Hobby, sem como aumentar). Um número menor
// aqui reduz o risco de estourar esse teto e a função morrer sem devolver JSON nenhum.
const MAX_FILES_PER_TASK = 6;

const DIACRITICS_RE = new RegExp("[̀-ͯ]", "g"); // marcas de acento depois de normalize("NFD")

function slugify(text) {
  const s = String(text || "")
    .toLowerCase()
    .normalize("NFD").replace(DIACRITICS_RE, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 40);
  return s || "tarefa";
}

/** Conteúdo COMPLETO (todos os pedaços, na ordem certa) de cada arquivo já indexado —
 * diferente da busca semântica normal (que devolve só o PEDAÇO que bateu), aqui a Lisa
 * precisa do arquivo INTEIRO pra poder reescrevê-lo com segurança. */
async function getFullFileContents(repo, paths) {
  const results = [];
  for (const path of [...new Set(paths)]) {
    const { data, error } = await supabase
      .from("documents").select("external_id, content")
      .eq("source", "github").eq("board", repo).eq("title", path);
    if (error || !data?.length) continue;
    const sorted = data.sort((a, b) => Number(a.external_id.split("#").pop()) - Number(b.external_id.split("#").pop()));
    results.push({ path, content: sorted.map((r) => r.content).join("\n") });
  }
  return results;
}

/**
 * Decide QUAIS arquivos entram no contexto de uma tarefa, combinando três fontes (nessa
 * ordem de prioridade, até MAX_FILES_PER_TASK no total):
 *   1. `filePaths` — o que o usuário marcou à mão (se marcou).
 *   2. o que a Lisa mesma decidir que é relevante só pelos NOMES dos arquivos do repo (ver
 *      selectRelevantFiles em gemini.js) — é isso que resolve pedidos amplos tipo "mude o
 *      tema", que a busca semântica sozinha erra (arquivo de config não se parece
 *      textualmente com o pedido).
 *   3. busca semântica normal (bom pra "onde está o código que faz X").
 */
async function gatherContextPaths({ repo, instruction, filePaths = [] }) {
  const [allFiles, matches] = await Promise.all([
    listIndexedFiles(repo).catch(() => []),
    retrieve(instruction, { filterSource: "github", filterBoard: repo, topK: 8, minSim: 0.3 }),
  ]);
  const aiPicked = await selectRelevantFiles({ instruction, filePaths: allFiles, repo }).catch(() => []);
  return [...new Set([...filePaths.slice(0, MAX_FILES_PER_TASK), ...aiPicked, ...matches.map((m) => m.title)])].slice(0, MAX_FILES_PER_TASK);
}

async function recordTask(row) {
  const { data, error } = await supabase.from("code_tasks").insert(row).select().single();
  if (error) throw new Error(`recordTask: ${error.message}`);
  return data;
}

async function updateTask(id, patch) {
  await supabase.from("code_tasks").update(patch).eq("id", id);
}

export async function listCodeTasks() {
  const { data, error } = await supabase.from("code_tasks").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(`listCodeTasks: ${error.message}`);
  return data || [];
}

export async function listRepoBranches(repo) {
  return listBranches(repo);
}

/**
 * Executa UMA tarefa de código de ponta a ponta: busca contexto → Gemini propõe as mudanças
 * → cria branch → aplica arquivos → abre PR. Registra o resultado (ou erro) em code_tasks
 * pra tela /code-tasks mostrar o histórico.
 *
 * `filePaths` (opcional) — arquivos que o usuário escolheu manualmente pra garantir que
 * entrem no contexto, além do que a busca semântica achar sozinha. Existe porque busca
 * semântica funciona bem pra "onde está o código que faz X", mas mal pra pedidos amplos tipo
 * "mude o tema pra preto e branco" — os arquivos certos (theme.js, globals.css) não se
 * parecem textualmente com o pedido, então a busca sozinha às vezes não os acha.
 */
export async function runCodeTask({ repo, baseBranch, instruction, filePaths = [] }) {
  const task = await recordTask({ repo, base_branch: baseBranch, instruction, status: "running" });

  try {
    // 1) contexto: arquivos escolhidos à mão + o que a Lisa decidir sozinha (pelos nomes) +
    // busca semântica — ver gatherContextPaths
    const uniquePaths = await gatherContextPaths({ repo, instruction, filePaths });
    const contextFiles = await getFullFileContents(repo, uniquePaths);

    // 2) Gemini propõe as mudanças (nunca aplica sozinho)
    const plan = await planCodeChanges({ instruction, contextFiles, repo });
    const files = (plan.files || []).slice(0, MAX_FILES_PER_TASK);
    if (!files.length) {
      const reason = plan.unable_reason || "a Lisa não encontrou uma mudança segura pra propor com o contexto disponível";
      await updateTask(task.id, { status: "error", error: reason });
      return { ok: false, error: reason };
    }

    // 3) branch nova a partir da base escolhida — nunca commita na base em si
    const baseSha = await getBranchSha(repo, baseBranch);
    const branchName = `lisa/${slugify(instruction)}-${Date.now().toString(36)}`;
    await createBranch(repo, branchName, baseSha);

    // 4) aplica cada arquivo (cria ou atualiza) na branch nova
    for (const f of files) {
      const sha = await getFileSha(repo, f.path, branchName);
      await putFileContent(repo, f.path, f.content, `Lisa: ${plan.summary || instruction}`.slice(0, 200), branchName, sha);
    }

    // 5) abre o PR de volta pra base — é aqui que fica visível pro usuário revisar
    const prTitle = `[Lisa] ${plan.summary || instruction}`.slice(0, 250);
    const prBody = `Gerado automaticamente pela Lisa a partir do pedido:\n\n> ${instruction}\n\n${plan.summary || ""}\n\n` +
      `**Revise com atenção antes de mesclar** — nenhuma mudança feita por ela entra sem essa revisão.\n\n` +
      `Arquivos alterados:\n${files.map((f) => `- \`${f.path}\``).join("\n")}`;
    const pr = await createPullRequest(repo, { title: prTitle, body: prBody, head: branchName, base: baseBranch });

    await updateTask(task.id, { status: "done", branch_name: branchName, pr_url: pr.html_url, summary: plan.summary || null });
    return { ok: true, branch: branchName, pr_url: pr.html_url, files: files.map((f) => f.path), summary: plan.summary };
  } catch (err) {
    const msg = String(err?.message || err);
    await updateTask(task.id, { status: "error", error: msg });
    return { ok: false, error: msg };
  }
}

/**
 * Versão "Modo Código" do Assistente — igual runCodeTask (busca contexto → Gemini propõe →
 * branch → commit → PR), mas em STREAMING: vai narrando cada fase (pra Lisa comentar/falar
 * enquanto trabalha) e emitindo o código de cada arquivo conforme é gerado (pra tela mostrar
 * sendo escrito ao vivo), em vez de só devolver o resultado pronto no final.
 *
 * É um async generator — quem chama itera com `for await` (ver /api/code-tasks/stream).
 * Eventos possíveis:
 *   { type: 'narration', text }                — algo pra Lisa "dizer" nesse momento
 *   { type: 'file_start', path }                — começou a escrever este arquivo
 *   { type: 'file_chunk', path, text }          — mais um pedaço do conteúdo desse arquivo
 *   { type: 'file_end', path }                  — terminou esse arquivo
 *   { type: 'done', ok, pr_url?, files?, summary?, error? } — sempre o último evento
 */
export async function* runCodeTaskStreaming({ repo, baseBranch, instruction, filePaths = [] }) {
  const task = await recordTask({ repo, base_branch: baseBranch, instruction, status: "running" });

  try {
    yield { type: "narration", text: `Deixa eu dar uma olhada no repositório ${repo} pra ver quais arquivos são relevantes pra isso.` };
    const uniquePaths = await gatherContextPaths({ repo, instruction, filePaths });
    const contextFiles = await getFullFileContents(repo, uniquePaths);

    if (contextFiles.length) {
      yield { type: "narration", text: `Encontrei ${contextFiles.length} arquivo${contextFiles.length > 1 ? "s" : ""} relevante${contextFiles.length > 1 ? "s" : ""}. Vou escrever a mudança agora.` };
    } else {
      yield { type: "narration", text: "Não achei nenhum arquivo indexado relacionado — vou tentar mesmo assim, mas com cautela." };
    }

    const files = []; // { path, content } acumulado conforme o streaming vai terminando cada arquivo
    let current = null; // { path, chunks: [] } — arquivo em andamento
    let summary = "";
    let unableReason = null;

    for await (const ev of streamCodeChanges({ instruction, contextFiles, repo })) {
      if (ev.type === "summary") {
        summary = ev.text;
        yield { type: "narration", text: ev.text };
      } else if (ev.type === "file_start") {
        current = { path: ev.path, chunks: [] };
        yield { type: "narration", text: `Editando \`${ev.path}\`…` };
        yield { type: "file_start", path: ev.path };
      } else if (ev.type === "file_chunk" && current) {
        current.chunks.push(ev.text);
        yield { type: "file_chunk", path: current.path, text: ev.text };
      } else if (ev.type === "file_end" && current) {
        files.push({ path: current.path, content: current.chunks.join("") });
        yield { type: "file_end", path: current.path };
        current = null;
      } else if (ev.type === "done") {
        break;
      }
    }

    if (!files.length) {
      unableReason = unableReason || summary || "a Lisa não encontrou uma mudança segura pra propor com o contexto disponível";
      yield { type: "narration", text: unableReason };
      await updateTask(task.id, { status: "error", error: unableReason });
      yield { type: "done", ok: false, error: unableReason };
      return;
    }

    yield { type: "narration", text: `Beleza, vou criar uma branch nova a partir de \`${baseBranch}\` e aplicar ${files.length === 1 ? "o arquivo" : "os arquivos"}.` };
    const baseSha = await getBranchSha(repo, baseBranch);
    const branchName = `lisa/${slugify(instruction)}-${Date.now().toString(36)}`;
    await createBranch(repo, branchName, baseSha);

    for (const f of files) {
      const sha = await getFileSha(repo, f.path, branchName);
      await putFileContent(repo, f.path, f.content, `Lisa: ${summary || instruction}`.slice(0, 200), branchName, sha);
    }

    yield { type: "narration", text: "Pronto — abrindo o Pull Request pra você revisar." };
    const prTitle = `[Lisa] ${summary || instruction}`.slice(0, 250);
    const prBody = `Gerado automaticamente pela Lisa a partir do pedido:\n\n> ${instruction}\n\n${summary || ""}\n\n` +
      `**Revise com atenção antes de mesclar** — nenhuma mudança feita por ela entra sem essa revisão.\n\n` +
      `Arquivos alterados:\n${files.map((f) => `- \`${f.path}\``).join("\n")}`;
    const pr = await createPullRequest(repo, { title: prTitle, body: prBody, head: branchName, base: baseBranch });

    await updateTask(task.id, { status: "done", branch_name: branchName, pr_url: pr.html_url, summary: summary || null });
    yield { type: "narration", text: `Feito! Abri o Pull Request — dá uma olhada quando puder.` };
    yield { type: "done", ok: true, pr_url: pr.html_url, files: files.map((f) => f.path), summary };
  } catch (err) {
    const msg = String(err?.message || err);
    await updateTask(task.id, { status: "error", error: msg });
    yield { type: "narration", text: `Deu ruim tentando fazer isso: ${msg}` };
    yield { type: "done", ok: false, error: msg };
  }
}
