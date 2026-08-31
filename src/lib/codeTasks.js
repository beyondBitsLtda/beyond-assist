import { supabase } from "./supabase.js";
import { retrieve } from "./rag.js";
import { planFilesToEdit, streamSingleFileChange, selectRelevantFiles, fixFileSyntaxError } from "./gemini.js";
import { getBranchSha, createBranch, getFileSha, putFileContent, createPullRequest, listBranches, getFileContentOnBranch } from "./github.js";
import { listIndexedFiles } from "./ingest/github.js";
import { validateFileSyntax } from "./validateSyntax.js";

// Tarefas de código: o usuário escolhe REPOSITÓRIO + BRANCH BASE e descreve o que quer.
// A Lisa nunca commita na branch escolhida — sempre cria uma branch NOVA a partir dela,
// aplica os arquivos lá, e abre um Pull Request de volta pra base. Mesclar é sempre manual.
//
// A tarefa inteira (buscar contexto → decidir arquivos → escrever cada um → criar branch →
// commitar → abrir PR) é RETOMÁVEL em vários PEDIDOS separados (ver runCodeTaskStep) — o
// plano Hobby da Vercel tem teto FIXO de 60s por função, sem como aumentar, e a tarefa
// inteira numa chamada só passava disso fácil. Cada passo é um pedido HTTP próprio, com seu
// PRÓPRIO teto de 60s; o progresso fica salvo em code_tasks.state entre um passo e o
// próximo — mesmo padrão já usado pro SYNC dos repositórios (ver sync_progress).

const MAX_FILES_PER_TASK = 6;

const DIACRITICS_RE = new RegExp("[̀-ͯ]", "g"); // marcas de acento depois de normalize("NFD")

// rede de segurança: às vezes o modelo ecoa uma linha tipo "// caminho/do/arquivo.ext" no
// topo do conteúdo (mesmo com a instrução dizendo pra não fazer isso) — usando `//`, que é
// sintaxe de comentário INVÁLIDA em CSS e vários outros formatos. Isso já quebrou um build de
// verdade (globals.css). Corta essa linha se aparecer, não importa o motivo.
function stripPathEchoComment(text) {
  return text.trim().replace(/^\/\/\s*\S+\.\w+\s*\r?\n+/, "");
}

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

// Contexto por DEPENDÊNCIA — além do que a busca semântica e a Lisa (por nome) já escolhem,
// olha os `import`/`require` de CADA arquivo já lido e tenta trazer junto os que ele realmente
// usa (ou que o alteram) — melhor esforço, só relativo (./, ../) e o alias @/ (convenção deste
// e de outros projetos Next.js, ver jsconfig.json); o que não resolver é só ignorado, sem
// travar nada. Ajuda em pedidos que mexem numa peça só mas cuja mudança precisa "ver" quem a
// importa ou o que ela importa pra ficar consistente.
const IMPORT_RE = /(?:import[\s\S]*?from\s*|require\(\s*)["']([^"']+)["']/g;

function extractImportSpecs(content) {
  const specs = new Set();
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(content))) {
    if (m[1].startsWith(".") || m[1].startsWith("@/")) specs.add(m[1]);
  }
  return [...specs];
}

function resolveImportSpec(spec, fromPath, knownPaths) {
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
 * Avança UM PASSO de uma tarefa de código — chamado repetidamente (um pedido HTTP por
 * chamada) até `done: true`. Sem `taskId`, cria uma tarefa nova e já executa o 1º passo
 * (buscar contexto); com `taskId`, retoma de onde a tarefa parou (lido de code_tasks.state).
 *
 * É um async generator — quem chama itera com `for await` (ver /api/code-tasks/step).
 * Eventos possíveis:
 *   { type: 'stage', stage, taskId }                   — em qual fase este passo está (e o
 *     id da tarefa, já desde o PRIMEIRO evento — importante pra quem chama saber o taskId
 *     mesmo se a conexão cair ANTES do "step_done" deste passo, e conseguir retomar por ele)
 *   { type: 'narration', text }                        — algo pra Lisa "dizer" nesse momento
 *   { type: 'file_start'|'file_chunk'|'file_end', path, text? } — código de UM arquivo sendo escrito
 *   { type: 'step_done', taskId, stage, done, ok?, pr_url?, files?, summary?, error? } —
 *     sempre o ÚLTIMO evento de cada passo; `done:false` = chame de novo com esse `taskId`
 *     pro próximo passo; `done:true` = acabou (sucesso ou erro, ver `ok`).
 *
 * `filePaths` (opcional, só importa no 1º passo) — arquivos que o usuário escolheu
 * manualmente pra garantir que entrem no contexto, além do que a busca semântica achar
 * sozinha. Existe porque busca semântica funciona bem pra "onde está o código que faz X",
 * mas mal pra pedidos amplos tipo "mude o tema pra preto e branco" — os arquivos certos
 * (theme.js, globals.css) não se parecem textualmente com o pedido.
 *
 * `continueBranch`/`existingPrUrl` (opcionais, só importam no 1º passo, ao criar tarefa
 * nova) — permitem CONTINUAR numa branch/PR que uma tarefa anterior já criou, em vez de
 * começar do zero (nova branch, novo PR) — é o que permite pedir "corrige esse erro" como
 * conversa, depois de já ter uma mudança em andamento. Quando presentes: o contexto lê o
 * conteúdo AO VIVO da branch em `continueBranch` (não do índice, que pode estar defasado em
 * relação ao que a Lisa mesma acabou de commitar ali), pula a criação de branch nova, e
 * reaproveita o PR já aberto (só o CONTEÚDO do PR muda, com os novos commits — GitHub
 * atualiza sozinho, não precisa abrir outro).
 */
export async function* runCodeTaskStep({ taskId, repo, baseBranch, instruction, filePaths = [], continueBranch, existingPrUrl }) {
  let task;
  if (taskId) {
    const { data, error } = await supabase.from("code_tasks").select("*").eq("id", taskId).single();
    if (error || !data) throw new Error("tarefa de código não encontrada (taskId inválido)");
    task = data;
  } else {
    const initialState = { stage: "context" };
    if (continueBranch) initialState.branchName = continueBranch;
    if (existingPrUrl) initialState.prUrl = existingPrUrl;
    task = await recordTask({ repo, base_branch: baseBranch, instruction, status: "running", state: initialState });
  }

  let state = task.state && typeof task.state === "object" ? task.state : { stage: "context" };
  const stage = state.stage || "context";

  const setState = async (patch) => {
    state = { ...state, ...patch };
    await supabase.from("code_tasks").update({ state }).eq("id", task.id);
  };

  try {
    // Achar o contexto virou 3 passos pequenos (em vez de 1 só) — juntar "listar arquivos +
    // busca semântica + a Lisa escolher por nome + ler o conteúdo de até 6 arquivos" numa
    // chamada só ainda estourava os 60s de vez em quando (cada parte pode envolver uma
    // chamada ao Gemini, que às vezes demora bem mais que o normal). Sem pressa nenhuma pra
    // terminar rápido — só importa que NENHUM passo isolado ultrapasse o teto.
    if (stage === "context") {
      yield { type: "stage", stage: "context", taskId: task.id };
      yield { type: "narration", text: `Deixa eu dar uma olhada no repositório ${repo} pra ver quais arquivos são relevantes pra isso.` };
      const [allFiles, matches] = await Promise.all([
        listIndexedFiles(repo).catch(() => []),
        retrieve(instruction, { filterSource: "github", filterBoard: repo, topK: 8, minSim: 0.3 }),
      ]);
      await setState({ stage: "context-select", allFiles, matchPaths: matches.map((m) => m.title) });
      yield { type: "step_done", taskId: task.id, stage: "context-select", done: false };
      return;
    }

    if (stage === "context-select") {
      yield { type: "stage", stage: "context-select", taskId: task.id };
      const { allFiles = [], matchPaths = [] } = state;
      const aiPicked = await selectRelevantFiles({ instruction, filePaths: allFiles, repo }).catch(() => []);
      const contextPaths = [...new Set([...filePaths.slice(0, MAX_FILES_PER_TASK), ...aiPicked, ...matchPaths])].slice(0, MAX_FILES_PER_TASK);
      // narração contextual, não literal — dá pra ver a LISTA de arquivos de verdade nas abas
      // do editor quando o conteúdo de cada um começar a ser lido, não precisa recitar aqui.
      if (contextPaths.length) {
        yield { type: "narration", text: `Achei ${contextPaths.length} arquivo${contextPaths.length > 1 ? "s" : ""} que parece${contextPaths.length > 1 ? "m" : ""} relevante${contextPaths.length > 1 ? "s" : ""}.` };
      }
      await setState({ stage: "context-fetch", contextPaths, contextFiles: [] });
      yield { type: "step_done", taskId: task.id, stage: "context-fetch", done: false };
      return;
    }

    if (stage === "context-fetch") {
      yield { type: "stage", stage: "context-fetch", taskId: task.id };
      const { contextPaths = [], contextFiles = [] } = state;
      const doneCount = contextFiles.length + (state.fetchSkipped || 0);
      if (doneCount >= contextPaths.length) {
        yield {
          type: "narration",
          text: contextFiles.length
            ? `Encontrei ${contextFiles.length} arquivo${contextFiles.length > 1 ? "s" : ""} relevante${contextFiles.length > 1 ? "s" : ""}.`
            : "Nenhum dos arquivos escolhidos estava indexado de fato — vou tentar mesmo assim, mas com cautela.",
        };
        await setState({ stage: "planning" });
        yield { type: "step_done", taskId: task.id, stage: "planning", done: false };
        return;
      }
      const path = contextPaths[doneCount];
      // continuando numa branch já existente: lê o conteúdo AO VIVO dela (via GitHub), não o
      // do índice — senão uma correção pisaria em cima do commit anterior sem saber que ele
      // já mudou o arquivo (o índice só é atualizado pelo sync periódico, não na hora).
      const fetched = state.branchName
        ? await getFileContentOnBranch(repo, path, state.branchName).then((c) => (c != null ? { path, content: c } : null)).catch(() => null)
        : (await getFullFileContents(repo, [path]))[0];
      if (fetched) {
        let nextPaths = contextPaths;
        // dependência: se ainda cabe no limite, traz junto o que ESTE arquivo importa
        // (melhor esforço — o que não resolver é ignorado, nunca trava a tarefa).
        if (nextPaths.length < MAX_FILES_PER_TASK) {
          const knownPaths = new Set(state.allFiles || []);
          const resolved = extractImportSpecs(fetched.content)
            .map((spec) => resolveImportSpec(spec, path, knownPaths))
            .filter((p) => p && !nextPaths.includes(p));
          if (resolved.length) nextPaths = [...nextPaths, ...resolved].slice(0, MAX_FILES_PER_TASK);
        }
        await setState({ contextFiles: [...contextFiles, fetched], contextPaths: nextPaths });
      } else {
        await setState({ fetchSkipped: (state.fetchSkipped || 0) + 1 });
      }
      yield { type: "step_done", taskId: task.id, stage: "context-fetch", done: false };
      return;
    }

    if (stage === "planning") {
      yield { type: "stage", stage: "planning", taskId: task.id };
      const plan = await planFilesToEdit({ instruction, contextFiles: state.contextFiles || [], repo });
      if (plan.summary) yield { type: "narration", text: plan.summary };
      const pathsToEdit = (plan.paths || []).slice(0, MAX_FILES_PER_TASK);
      if (!pathsToEdit.length) {
        const reason = plan.unable_reason || plan.summary || "a Lisa não encontrou uma mudança segura pra propor com o contexto disponível";
        yield { type: "narration", text: reason };
        await updateTask(task.id, { status: "error", error: reason });
        yield { type: "step_done", taskId: task.id, stage: "error", done: true, ok: false, error: reason };
        return;
      }
      await setState({ stage: "writing", summary: plan.summary || "", pathsToEdit, generatedFiles: [] });
      yield { type: "step_done", taskId: task.id, stage: "writing", done: false };
      return;
    }

    if (stage === "writing") {
      yield { type: "stage", stage: "writing", taskId: task.id };
      const { pathsToEdit = [], generatedFiles = [], contextFiles = [], summary = "" } = state;
      const path = pathsToEdit[generatedFiles.length];
      const contextByPath = new Map(contextFiles.map((f) => [f.path, f.content]));

      // narração só uma vez, ao COMEÇAR a escrever — não repete a cada arquivo (isso já
      // aparece visualmente, como aba nova, na janela flutuante; não precisa narrar de novo
      // arquivo por arquivo, o pedido foi por algo contextual, não uma lista mecânica).
      if (generatedFiles.length === 0) {
        yield {
          type: "narration",
          text: pathsToEdit.length > 1
            ? `Beleza, vou escrever agora as mudanças nos ${pathsToEdit.length} arquivos.`
            : `Beleza, vou escrever a mudança em \`${path}\`.`,
        };
      }
      yield { type: "file_start", path };
      let content = "";
      for await (const chunk of streamSingleFileChange({ instruction, summary, path, currentContent: contextByPath.get(path) || "", siblingChanges: generatedFiles, repo })) {
        content += chunk;
        yield { type: "file_chunk", path, text: chunk };
      }
      yield { type: "file_end", path };
      const cleaned = stripPathEchoComment(content);

      // validação ESTRUTURAL antes de seguir (sem IA, instantânea — ver validateSyntax.js):
      // se o arquivo não é sintaticamente válido, não segue pra próxima etapa ainda — passa
      // pelo estágio "fixing" primeiro, que manda o erro EXATO de volta pra Lisa consertar.
      const validation = validateFileSyntax(path, cleaned);
      if (!validation.ok) {
        yield { type: "narration", text: `Opa, o que escrevi em \`${path}\` ficou com um erro de sintaxe (${validation.error}) — deixa eu corrigir antes de seguir.` };
        await setState({ stage: "fixing", fixPath: path, fixContent: cleaned, fixError: validation.error, fixAttempts: 1 });
        yield { type: "step_done", taskId: task.id, stage: "fixing", done: false };
        return;
      }

      const nextGenerated = [...generatedFiles, { path, content: cleaned }];
      const patch = { generatedFiles: nextGenerated };
      if (nextGenerated.length < pathsToEdit.length) {
        patch.stage = "writing";
      } else if (state.branchName) {
        // continuando numa branch que já existe: pula "branching" (não cria outra) e vai
        // direto pra "committing" nela mesma.
        patch.stage = "committing";
        patch.committedFiles = [];
      } else {
        patch.stage = "branching";
      }
      await setState(patch);
      const nextStage = patch.stage;
      yield { type: "step_done", taskId: task.id, stage: nextStage, done: false };
      return;
    }

    if (stage === "fixing") {
      yield { type: "stage", stage: "fixing", taskId: task.id };
      const { fixPath, fixContent, fixError, fixAttempts = 1, pathsToEdit = [], generatedFiles = [], summary = "" } = state;
      const MAX_FIX_ATTEMPTS = 2; // não trava a tarefa inteira num arquivo teimoso — desiste e segue com um aviso

      yield { type: "file_start", path: fixPath };
      let fixed = "";
      for await (const chunk of fixFileSyntaxError({ path: fixPath, content: fixContent, error: fixError, repo })) {
        fixed += chunk;
        yield { type: "file_chunk", path: fixPath, text: chunk };
      }
      yield { type: "file_end", path: fixPath };
      const cleanedFixed = stripPathEchoComment(fixed);
      const validation = validateFileSyntax(fixPath, cleanedFixed);

      if (!validation.ok && fixAttempts < MAX_FIX_ATTEMPTS) {
        yield { type: "narration", text: `Ainda não saiu certo (${validation.error}) — tentando de novo.` };
        await setState({ fixContent: cleanedFixed, fixError: validation.error, fixAttempts: fixAttempts + 1 });
        yield { type: "step_done", taskId: task.id, stage: "fixing", done: false };
        return;
      }

      yield {
        type: "narration",
        text: validation.ok
          ? "Corrigido — seguindo."
          : `Não consegui corrigir sozinha o problema em \`${fixPath}\` (${validation.error}) — vou seguir mesmo assim, mas revise esse arquivo com atenção no PR.`,
      };
      const nextGenerated = [...generatedFiles, { path: fixPath, content: cleanedFixed }];
      const patch = { generatedFiles: nextGenerated, fixPath: null, fixContent: null, fixError: null, fixAttempts: null };
      if (nextGenerated.length < pathsToEdit.length) {
        patch.stage = "writing";
      } else if (state.branchName) {
        patch.stage = "committing";
        patch.committedFiles = [];
      } else {
        patch.stage = "branching";
      }
      await setState(patch);
      yield { type: "step_done", taskId: task.id, stage: patch.stage, done: false };
      return;
    }

    if (stage === "branching") {
      yield { type: "stage", stage: "branching", taskId: task.id };
      yield { type: "narration", text: `Beleza, vou criar uma branch nova a partir de \`${baseBranch}\`.` };
      const baseSha = await getBranchSha(repo, baseBranch);
      const branchName = `lisa/${slugify(instruction)}-${Date.now().toString(36)}`;
      await createBranch(repo, branchName, baseSha);
      await setState({ stage: "committing", branchName, committedFiles: [] });
      yield { type: "step_done", taskId: task.id, stage: "committing", done: false };
      return;
    }

    if (stage === "committing") {
      yield { type: "stage", stage: "committing", taskId: task.id };
      const { generatedFiles = [], committedFiles = [], branchName, summary = "" } = state;
      const f = generatedFiles[committedFiles.length];
      // narração só uma vez, ao começar a aplicar — não repete a cada arquivo commitado.
      if (committedFiles.length === 0) {
        yield {
          type: "narration",
          text: generatedFiles.length > 1 ? `Aplicando os ${generatedFiles.length} arquivos na branch.` : `Aplicando \`${f.path}\` na branch.`,
        };
      }
      const sha = await getFileSha(repo, f.path, branchName);
      await putFileContent(repo, f.path, f.content, `Lisa: ${summary || instruction}`.slice(0, 200), branchName, sha);
      const nextCommitted = [...committedFiles, f.path];
      const nextStage = nextCommitted.length >= generatedFiles.length ? "pr" : "committing";
      await setState({ committedFiles: nextCommitted, stage: nextStage });
      yield { type: "step_done", taskId: task.id, stage: nextStage, done: false };
      return;
    }

    if (stage === "pr") {
      yield { type: "stage", stage: "pr", taskId: task.id };
      const { generatedFiles = [], branchName, summary = "", prUrl } = state;

      // continuando um PR que já existe: os commits novos já foram pro mesmo branch (acima),
      // então o PR já reflete a mudança sozinho — GitHub atualiza automaticamente, não
      // precisa (e não dá, a API rejeita) abrir outro PR pro mesmo head+base.
      if (prUrl) {
        await updateTask(task.id, { status: "done", branch_name: branchName, pr_url: prUrl, summary: summary || null });
        yield { type: "narration", text: "Pronto — as mudanças novas já entraram no mesmo Pull Request de antes." };
        yield {
          type: "step_done", taskId: task.id, stage: "done", done: true, ok: true,
          pr_url: prUrl, branchName, files: generatedFiles.map((f) => f.path), summary,
        };
        return;
      }

      yield { type: "narration", text: "Pronto — abrindo o Pull Request pra você revisar." };
      const prTitle = `[Lisa] ${summary || instruction}`.slice(0, 250);
      const prBody = `Gerado automaticamente pela Lisa a partir do pedido:\n\n> ${instruction}\n\n${summary || ""}\n\n` +
        `**Revise com atenção antes de mesclar** — nenhuma mudança feita por ela entra sem essa revisão.\n\n` +
        `Arquivos alterados:\n${generatedFiles.map((f) => `- \`${f.path}\``).join("\n")}`;
      const pr = await createPullRequest(repo, { title: prTitle, body: prBody, head: branchName, base: baseBranch });

      await updateTask(task.id, { status: "done", branch_name: branchName, pr_url: pr.html_url, summary: summary || null });
      yield { type: "narration", text: "Feito! Abri o Pull Request — dá uma olhada quando puder." };
      yield {
        type: "step_done", taskId: task.id, stage: "done", done: true, ok: true,
        pr_url: pr.html_url, branchName, files: generatedFiles.map((f) => f.path), summary,
      };
      return;
    }

    // stage já concluído ou desconhecido — não deveria ser chamado de novo, mas não trava.
    yield { type: "step_done", taskId: task.id, stage: "done", done: true, ok: true };
  } catch (err) {
    const msg = String(err?.message || err);
    await updateTask(task.id, { status: "error", error: msg });
    yield { type: "narration", text: `Deu ruim tentando fazer isso: ${msg}` };
    yield { type: "step_done", taskId: task.id, stage: "error", done: true, ok: false, error: msg };
  }
}
