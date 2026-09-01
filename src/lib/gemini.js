import { GoogleGenAI } from "@google/genai";
import { TTS_VOICES } from "./ttsVoices.js";
import { pickKeyIndex, markCooldown, markOk } from "./geminiKeyHealth.js";

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
// gemini-2.5-flash foi descontinuado pra projetos novos no Google Cloud (confirmado ao vivo:
// erro 404 "no longer available to new users", recomendando este aqui) — projetos antigos
// ainda tinham acesso legado ao 2.5, outros não. Testado e funcionando em várias chaves
// antes de trocar o padrão.
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.6-flash";
const EMBED_DIM = Number(process.env.GEMINI_EMBED_DIM || 768);

// ---- múltiplas chaves do Gemini — pool único, saúde rastreada por (chave × MODELO) ----
// GEMINI_API_KEYS="chave1,chave2,...,chaveN" — cada chave precisa ser de um PROJETO
// diferente no Google Cloud/AI Studio pra ter cota própria de verdade (chaves do MESMO
// projeto compartilham a mesma cota, então trocar entre elas não ajuda em nada). Mantém
// GEMINI_API_KEY funcionando sozinha se só houver uma.
//
// Todas as chaves são tratadas como IGUAIS no pool — não existe mais "prioritária vs
// reserva" por POSIÇÃO na lista. Em vez disso, cada (chave × modelo) tem sua própria saúde
// rastreada e persistida (ver geminiKeyHealth.js): uma chave pode estar ótima pro chat e
// zerada pra voz ao mesmo tempo (cota é por modelo, não por chave só), e o estado sobrevive
// entre invocações da função na Vercel (que não garante manter nada em memória). Isso
// também resolve sozinho o velho problema de "AUTO-SYNC (embeddings) competindo com chat/
// voz pela mesma chave": como a cota de EMBED_MODEL é rastreada separada da de CHAT_MODEL/
// TTS_MODEL, uma chave exaurida de embeddings continua disponível pro chat na mesma hora.
const KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
  .split(",").map((k) => k.trim()).filter(Boolean);

const _clients = new Map(); // chave → cliente (reaproveita entre chamadas)

function clientFor(key) {
  if (!_clients.has(key)) _clients.set(key, new GoogleGenAI({ apiKey: key }));
  return _clients.get(key);
}

if (!KEYS.length) {
  // não lança aqui (isso quebraria qualquer import deste módulo, inclusive em build) —
  // só lança de verdade quando alguém tentar usar de fato, em withTransientRetry.
}

/** Rótulo de qual chave um índice representa — só pra diagnóstico em log (nunca expõe a
 * chave em si, só a posição dela na lista, 1-based pra ficar legível). */
function keyLabelFor(index) {
  return `chave #${index + 1}`;
}

// ---- classifica o erro cru do Gemini — decide SE repete, e por QUANTO TEMPO a chave usada
// deve ficar de cooldown pra este modelo específico ----
// A API costuma devolver o corpo cru como uma string JSON aninhada e feia. Detectamos por
// substring (robusto o bastante pro texto que a API realmente devolve).
const DAY_MS = 24 * 60 * 60 * 1000;

function classifyGeminiError(err) {
  const msg = String(err?.message || err);

  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || /\b429\b/.test(msg)) {
    // Google diz explicitamente no quotaId se o limite é DIÁRIO ("PerDay") ou por minuto —
    // sem essa distinção, um cooldown fixo de 60s é curto demais pra cota diária (fica
    // tentando de novo a cada minuto o dia inteiro à toa) e longo demais pra cota por minuto.
    const isDaily = /PerDay/i.test(msg);
    const retryMatch = msg.match(/retry in ([\d.]+)s/i);
    return {
      transient: true,
      code: "QUOTA",
      reason: isDaily ? "rpd" : "rpm",
      untilMs: isDaily
        ? Date.now() + 0.5 * DAY_MS // cota diária: meio dia de cooldown (aproximação segura — melhor esperar de mais que martelar uma chave zerada)
        : Date.now() + (retryMatch ? Math.ceil(Number(retryMatch[1])) * 1000 + 2000 : 90_000),
    };
  }
  if (msg.includes("UNAVAILABLE") || msg.includes("high demand") || /\b503\b/.test(msg)) {
    return { transient: true, code: "UNAVAILABLE", reason: "overload", untilMs: Date.now() + 30_000 };
  }
  if (msg.includes("NOT_FOUND") || /"code":\s*404/.test(msg)) {
    // modelo não existe/não está disponível NESTE projeto específico (ex.: descontinuado só
    // pra contas novas) — outra chave/projeto pode muito bem ter acesso. Trata como "tenta
    // outra chave" também, com cooldown bem longo (não é algo que se resolve sozinho em
    // minutos — só mudando de modelo ou o Google revertendo a política).
    return { transient: true, code: "UNSUPPORTED", reason: "unsupported", untilMs: Date.now() + 30 * DAY_MS };
  }
  return { transient: false };
}

function rewriteError(err, index, classified) {
  const key = keyLabelFor(index);
  if (classified.code === "QUOTA") {
    const e = new Error(
      `QUOTA_EXCEEDED: limite do Gemini atingido${classified.reason === "rpd" ? " (cota DIÁRIA)" : ""}. Aguarde e tente de novo.`
    );
    e.code = "QUOTA";
    e.keyLabel = key;
    return e;
  }
  if (classified.code === "UNAVAILABLE") {
    const e = new Error("UNAVAILABLE: o Gemini está com alta demanda no momento. Tente de novo em instantes.");
    e.code = "UNAVAILABLE";
    e.keyLabel = key;
    return e;
  }
  if (classified.code === "UNSUPPORTED") {
    const e = new Error("Esse modelo não está disponível numa das chaves configuradas (tentando outra automaticamente).");
    e.code = "UNSUPPORTED";
    e.keyLabel = key;
    return e;
  }
  return err;
}

/**
 * Executa `fn(client)` com retry, escolhendo uma chave diferente do pool a cada tentativa
 * (evita repetir uma que já falhou NESTA MESMA chamada lógica) e respeitando o cooldown de
 * cada (chave × `model`) — ver geminiKeyHealth.js. Em sucesso, limpa o cooldown dessa
 * combinação (se houvesse). `computeDelay(attempt, err)` (opcional) sobrescreve o espaçamento
 * padrão entre tentativas — usado por embedForIngest, que precisa respeitar um teto de
 * espera bem mais curto (função da Vercel tem limite de 60s).
 */
async function withTransientRetry(model, fn, { attempts = 3, delayMs = 1200, computeDelay = null } = {}) {
  if (!KEYS.length) {
    throw new Error(
      "GEMINI_API_KEY (ou GEMINI_API_KEYS) não configurada. " +
      "Defina em Vercel → Settings → Environment Variables (ou no .env local)."
    );
  }
  const tried = new Set();
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const index = await pickKeyIndex(KEYS.length, model, tried);
    tried.add(index);
    const client = clientFor(KEYS[index]);
    try {
      const result = await fn(client);
      await markOk(index, model);
      return result;
    } catch (err) {
      lastErr = err;
      const classified = classifyGeminiError(err);
      if (!classified.transient) throw err; // erro genuinamente não-transitório — não adianta repetir
      await markCooldown(index, model, { untilMs: classified.untilMs, reason: classified.reason, error: err?.message || err });
      if (attempt === attempts) throw rewriteError(err, index, classified);
      const wait = computeDelay ? computeDelay(attempt, err) : delayMs * attempt;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr || new Error("withTransientRetry: unreachable");
}

/**
 * Gera embeddings para um ou mais textos.
 * taskType: "RETRIEVAL_DOCUMENT" ao indexar, "RETRIEVAL_QUERY" ao buscar.
 * Retorna sempre um array de vetores (number[][]).
 *
 * Faz retry automático quando o Gemini devolve 429 (quota) ou 503 (alta demanda).
 */
export async function embed(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const contents = Array.isArray(texts) ? texts : [texts];
  const res = await withTransientRetry(
    EMBED_MODEL,
    (client) => client.models.embedContent({ model: EMBED_MODEL, contents, config: { outputDimensionality: EMBED_DIM, taskType } }),
    { attempts: 2, delayMs: 3000 } // menos tentativas e espera curta: falha rápido em vez de travar minutos
  );
  return res.embeddings.map((e) => e.values);
}

/** Conveniência: embedding de um único texto (number[]). */
export async function embedOne(text, taskType = "RETRIEVAL_QUERY") {
  const [v] = await embed(text, taskType);
  return v;
}

/**
 * Versão "paciente" do embed (mais tolerante que embed(), pra ingestão em lote), mas com
 * paciência LIMITADA: cada chamada roda dentro de uma função da Vercel com teto de 60s
 * (ver ingestSlice, src/lib/ingest/runSlice.js — usada tanto pelo botão SYNC manual quanto
 * pelo tick automático), então esperar o tempo que o Gemini pedir (que pode passar de 30-60s
 * sozinho) trava a função até ela ser morta no meio, sem nem registrar erro. Por isso a
 * espera é sempre CURTA (teto de 8s) — se a cota não liberar rápido, desiste rápido também:
 * quem chama (ingestSlice → /api/cron/sync) já tenta de novo no próximo tick, com uma
 * chave diferente do pool, sem perder o offset onde parou.
 */
export async function embedForIngest(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const contents = Array.isArray(texts) ? texts : [texts];
  const MAX_WAIT_SEC = 8;
  // attempts:2 fazia sentido com poucas chaves, mas com o pool de 35 (e boa parte podendo
  // estar de cooldown de cota diária ao mesmo tempo — visto na prática: 17 de 35 em cooldown
  // de uma vez) só 2 tentativas às vezes esgotava em chaves ruins por azar do rodízio, MESMO
  // com bastante chave livre sobrando no pool inteiro. Mais tentativas dá mais chance de cair
  // numa disponível sem desistir cedo demais.
  const res = await withTransientRetry(
    EMBED_MODEL,
    (client) => client.models.embedContent({ model: EMBED_MODEL, contents, config: { outputDimensionality: EMBED_DIM, taskType } }),
    {
      attempts: 4,
      computeDelay: (attempt, err) => {
        const msg = String(err?.message || err);
        const m = msg.match(/retry in ([\d.]+)s/i);
        return Math.min(m ? (Math.ceil(Number(m[1])) + 1) * 1000 : 5000 * attempt, MAX_WAIT_SEC * 1000);
      },
    }
  );
  return res.embeddings.map((e) => e.values);
}

/**
 * Gera a resposta em streaming.
 * Retorna um async iterator de pedaços de texto (string).
 *
 * `tools` (opcional) — ex.: [{ googleSearch: {} }] pra habilitar grounding com
 * busca do Google (o modelo decide sozinho quando de fato buscar). Usado pelo
 * modo "Geral" do assistente.
 *
 * `images` (opcional) — [{ mimeType, data (base64) }] — uma ou mais fotos tiradas na hora
 * (Modo Observância = câmera, Modo Tela = captura de tela; ver assistant/page.js). Quando
 * presente, vira multimodal: o mesmo modelo de chat também enxerga imagem, sem precisar de
 * nenhum modelo/endpoint separado.
 */
export async function* chatStream(prompt, systemInstruction, { tools, images } = {}) {
  const config = {};
  if (systemInstruction) config.systemInstruction = systemInstruction;
  if (tools) config.tools = tools;

  const contents = images?.length
    ? [{ role: "user", parts: [{ text: prompt }, ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } }))] }]
    : prompt;

  // retry só na abertura do stream (antes de qualquer chunk chegar) — 429/503 costumam
  // se resolver em segundos; uma vez que o texto começou a chegar não há o que repetir.
  const stream = await withTransientRetry(CHAT_MODEL, (client) =>
    client.models.generateContentStream({
      model: CHAT_MODEL,
      contents,
      config: Object.keys(config).length ? config : undefined,
    })
  );
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}

/**
 * Detecta se a mensagem do usuário é um PEDIDO DE AÇÃO sobre um card do Trello mencionado
 * recentemente (mudar prazo, mover de lista, marcar concluído), a ESCOLHA de qual card entre
 * várias opções apresentadas, ou uma confirmação/cancelamento de uma ação já proposta — usado
 * só no contexto de boards do Trello no Assistente (ver src/lib/assistantActions.js e
 * /api/ask). Chamada separada e SEM streaming — pequena e rápida, decide antes de montar a
 * resposta conversacional normal.
 *
 * Retorna { intent: "none" } se não for nada disso (o caminho mais comum, de longe).
 */
export async function detectTrelloAction({ question, todayLabel, candidateCards = [], pendingAction = null }) {
  const cardsBlock = candidateCards.length
    ? candidateCards
        .map((c) => `- id=${c.id} · "${c.title}" · board="${c.board}" · lista="${c.list || "—"}" · prazo=${c.due || "sem prazo"} · concluído=${c.due_complete}`)
        .join("\n")
    : "(nenhum card no contexto recente)";

  let pendingBlock = "Não há nenhuma ação pendente no momento.";
  if (pendingAction?.type === "clarify") {
    const numbered = pendingAction.candidates.map((c, i) => `  ${i + 1}. id=${c.card_id} · "${c.title}" (${c.board})`).join("\n");
    pendingBlock = `Você acabou de perguntar QUAL desses cards o usuário quer mudar (campo "${pendingAction.field}" → "${pendingAction.new_value}"):\n${numbered}`;
  } else if (pendingAction?.type === "confirm") {
    pendingBlock = `Existe uma AÇÃO PENDENTE de confirmação: ${JSON.stringify(pendingAction)}`;
  }

  const prompt = `Hoje é ${todayLabel}.

CARDS DO TRELLO MENCIONADOS RECENTEMENTE (candidatos pra ação):
${cardsBlock}

${pendingBlock}

MENSAGEM DO USUÁRIO:
"${question}"

Decida a intenção do usuário e responda SOMENTE com o JSON pedido.`;

  const systemInstruction = `Você identifica se uma mensagem é um PEDIDO DE AÇÃO sobre um card do Trello
listado acima (mudar prazo, mover de lista, marcar concluído/reabrir), a ESCOLHA de qual card
entre opções que você acabou de listar, uma CONFIRMAÇÃO/CANCELAMENTO de uma ação pendente, ou
nenhuma das anteriores (uma pergunta normal).

O usuário quase nunca vai citar o nome EXATO do card — ele se refere de forma natural ("aquela
tarefa que venceu ontem", "a do site da Criativa", "essa aí"). Use o contexto da conversa (o
que foi discutido, prazos, boards) pra achar o(s) card(s) mais prováveis nos candidatos acima.
Prefira AGIR (propose_action ou clarify_candidates) a cair em "none" sempre que o pedido for
claramente uma ação sobre algo que aparece nos candidatos, mesmo que a referência seja vaga.

Regras:
- "propose_action": você tem UM candidato claramente mais provável que os outros pro que foi
  pedido. Escolha o card_id. Pra "due", calcule a data real em ISO 8601 (AAAA-MM-DD) a partir
  de hoje e da instrução (ex.: "amanhã" = hoje+1 dia); pra remover o prazo, new_value = "". Pra
  "list", new_value é o NOME da lista de destino tal como o usuário disse (não precisa ser
  exato). Pra "due_complete", new_value é "true" ou "false".
- "clarify_candidates": DOIS OU MAIS candidatos combinam igualmente bem com o pedido, e você
  não tem como saber qual sem perguntar. Preencha field/new_value (a ação já está clara, só
  falta o card) e candidate_ids com os 2 a 4 ids mais prováveis, em ordem de probabilidade.
- "select_candidate": só quando o bloco acima mostrar que você JÁ perguntou qual card (lista
  numerada) — o usuário está respondendo qual é (por número, "a primeira/segunda", ou citando
  algo do card). Devolva o card_id escolhido dessa lista.
- "confirm_pending" / "cancel_pending": só quando já existir uma ação pendente do tipo
  "confirm" (não "clarify") E a mensagem claramente concorda ("sim", "confirma", "pode",
  "manda", "isso") ou recusa ("não", "cancela", "espera", "deixa quieto").
- "none": só quando genuinamente não for nada disso, ou nenhum candidato tiver relação alguma
  com o pedido. Não use "none" só por a referência ao card ser indireta — tente resolver pelo
  contexto primeiro.`;

  const res = await withTransientRetry(
    CHAT_MODEL,
    (client) =>
      client.models.generateContent({
        model: CHAT_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              intent: {
                type: "STRING",
                enum: ["none", "propose_action", "clarify_candidates", "select_candidate", "confirm_pending", "cancel_pending"],
              },
              card_id: { type: "STRING" },
              field: { type: "STRING", enum: ["due", "list", "due_complete"] },
              new_value: { type: "STRING" },
              candidate_ids: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["intent"],
          },
        },
      }),
    { attempts: 2, delayMs: 800 }
  );

  try {
    const parsed = JSON.parse(res.text);
    return parsed && typeof parsed === "object" ? parsed : { intent: "none" };
  } catch {
    return { intent: "none" };
  }
}

/**
 * Decide quais arquivos são relevantes pra um pedido só pelos NOMES/CAMINHOS deles (sem ver
 * conteúdo ainda) — complementa a busca semântica (que falha em pedidos amplos tipo "mude o
 * tema", já que arquivo de config não se parece textualmente com o pedido). Chamada leve e
 * barata (só texto, sem embedding), usada por runCodeTask(Streaming) em codeTasks.js ANTES
 * de buscar o conteúdo de verdade — assim a Lisa "entende sozinha" que precisa desses
 * arquivos, sem o usuário precisar marcar manualmente.
 */
export async function selectRelevantFiles({ instruction, filePaths = [], repo }) {
  if (!filePaths.length) return [];
  const prompt = `Repositório: ${repo}

LISTA DE ARQUIVOS DO REPOSITÓRIO (só os caminhos — você ainda não viu o conteúdo deles):
${filePaths.join("\n")}

PEDIDO DO USUÁRIO:
"${instruction}"

Pelos NOMES/CAMINHOS acima, quais arquivos são mais prováveis de precisar mudar ou servir de
referência pra atender esse pedido? Pense em convenções comuns de projeto (ex.: pedido sobre
"tema"/"cor"/"visual" costuma envolver arquivos com nome tipo theme, color, palette, style,
css, config, globals). Devolva só os que você tem motivo real pra achar relevantes — no
máximo uns 6, em ordem de confiança.`;

  const res = await withTransientRetry(
    CHAT_MODEL,
    (client) =>
      client.models.generateContent({
        model: CHAT_MODEL,
        contents: prompt,
        config: {
          systemInstruction: "Você ajuda a decidir quais arquivos de um repositório são relevantes pra um pedido, só pelos nomes/caminhos dos arquivos, sem ver o conteúdo.",
          responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { paths: { type: "ARRAY", items: { type: "STRING" } } }, required: ["paths"] },
        },
      }),
    { attempts: 2, delayMs: 500 }
  );

  try {
    const parsed = JSON.parse(res.text);
    const valid = new Set(filePaths); // nunca confia cegamente — só aceita caminho que existe de verdade
    return (parsed.paths || []).filter((p) => valid.has(p)).slice(0, 6);
  } catch {
    return [];
  }
}

// ---- Tarefas de código: a Lisa PROPÕE mudança de arquivo (nunca aplica sozinha — ver
// src/lib/codeTasks.js, que cria a branch/commit/PR a partir disto) ----
export async function planCodeChanges({ instruction, contextFiles = [], repo }) {
  const filesBlock = contextFiles.length
    ? contextFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n")
    : "(nenhum arquivo de contexto encontrado — proponha só se tiver certeza do que fazer, ou devolva files vazio)";

  const prompt = `Repositório: ${repo}

ARQUIVOS RELEVANTES ENCONTRADOS (conteúdo COMPLETO e ATUAL de cada um):
${filesBlock}

PEDIDO DO USUÁRIO:
"${instruction}"

Proponha as mudanças de arquivo necessárias pra atender esse pedido.`;

  const systemInstruction = `Você é a Lisa, propondo uma mudança de código que vai virar um Pull Request pro
usuário revisar — ele NUNCA vê o código sendo aplicado direto, só o PR resultante, então a
proposta precisa estar certa e completa.

Regras estritas:
- Para CADA arquivo que precisar mudar, devolva o CONTEÚDO COMPLETO do arquivo depois da
  mudança — nunca um trecho, diff, ou só a parte alterada. Se o arquivo já existia no
  contexto acima, parta exatamente dele e aplique só a mudança pedida, preservando todo o
  resto igual (comentários, formatação, imports não relacionados).
- Só inclua no resultado os arquivos que REALMENTE precisam mudar. Não "aproveite" pra
  refatorar ou mudar estilo em código não relacionado ao pedido.
- Se o pedido exigir um arquivo novo que não está no contexto, pode criar (path novo).
- Se o contexto disponível não for suficiente pra ter certeza do que fazer com segurança,
  devolva "files" vazio e explique o motivo em "unable_reason" — é preferível não propor nada
  a propor algo errado que vira um PR ruim.
- "summary": 1-2 frases, em português, resumindo a mudança — vira o título/corpo do PR.`;

  const res = await withTransientRetry(
    CHAT_MODEL,
    (client) =>
      client.models.generateContent({
        model: CHAT_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              summary: { type: "STRING" },
              unable_reason: { type: "STRING" },
              files: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: { path: { type: "STRING" }, content: { type: "STRING" } },
                  required: ["path", "content"],
                },
              },
            },
            required: ["summary", "files"],
          },
        },
      }),
    { attempts: 2, delayMs: 800 }
  );

  try {
    const parsed = JSON.parse(res.text);
    return { summary: "", unable_reason: null, files: [], ...parsed };
  } catch {
    return { summary: "", unable_reason: "resposta do Gemini não veio em JSON válido", files: [] };
  }
}

/**
 * FASE 1 de 2 do "Modo Código" em streaming (ver src/lib/codeTasks.js:runCodeTaskStreaming).
 * Decide só QUAIS arquivos precisam mudar (não o conteúdo ainda) — call rápida porque a
 * SAÍDA é pequena (uma lista de caminhos + um resumo), mesmo lendo bastante contexto de
 * entrada. Existe separada da geração de conteúdo (fase 2, streamSingleFileChange) porque
 * juntar as duas numa chamada só — decidir E escrever o conteúdo completo de vários
 * arquivos de uma vez — ficava lenta demais e estourava o teto de 60s da função da Vercel
 * em pedidos que tocam mais de 1-2 arquivos.
 */
export async function planFilesToEdit({ instruction, contextFiles = [], repo }) {
  const filesBlock = contextFiles.length
    ? contextFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n")
    : "(nenhum arquivo de contexto encontrado)";

  const prompt = `Repositório: ${repo}

ARQUIVOS RELEVANTES ENCONTRADOS (conteúdo COMPLETO e ATUAL de cada um):
${filesBlock}

PEDIDO DO USUÁRIO:
"${instruction}"

Decida quais desses arquivos REALMENTE precisam mudar pra atender o pedido (não escreva o
conteúdo ainda, só decida QUAIS).`;

  const systemInstruction = `Você é a Lisa, decidindo quais arquivos precisam mudar pra atender um pedido de código —
o conteúdo de cada um será escrito depois, numa etapa separada.

Regras:
- Só inclua arquivos que REALMENTE precisam mudar — não aproveite pra "sugerir" mudar
  arquivo não relacionado ao pedido.
- Pode incluir um caminho de arquivo NOVO (que não estava no contexto) se o pedido exigir
  criar algo que ainda não existe.
- Se o contexto não for suficiente pra ter certeza do que fazer com segurança, devolva
  "paths" vazio e explique o motivo em "unable_reason" — melhor não propor nada do que
  propor errado.
- "summary": 1-2 frases em português resumindo a mudança que vai ser feita.`;

  const res = await withTransientRetry(
    CHAT_MODEL,
    (client) =>
      client.models.generateContent({
        model: CHAT_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              summary: { type: "STRING" },
              unable_reason: { type: "STRING" },
              paths: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["summary", "paths"],
          },
        },
      }),
    { attempts: 2, delayMs: 600 }
  );

  try {
    const parsed = JSON.parse(res.text);
    return { summary: "", unable_reason: null, paths: [], ...parsed };
  } catch {
    return { summary: "", unable_reason: "resposta do Gemini não veio em JSON válido", paths: [] };
  }
}

/**
 * FASE 2 de 2 — gera o conteúdo COMPLETO de UM ÚNICO arquivo, em streaming. Chamada uma vez
 * por arquivo (ver runCodeTaskStreaming) — input e output pequenos (só esse arquivo, não
 * todos juntos), o que é o que mantém cada chamada rápida o bastante pra caber nos 60s da
 * função mesmo quando a tarefa toca vários arquivos.
 *
 * `siblingChanges` (opcional) — os OUTROS arquivos já reescritos NESTA MESMA tarefa (path +
 * conteúdo novo) — sem isso, cada arquivo era gerado no escuro em relação aos demais, podendo
 * ficar inconsistente (ex.: renomear uma função no arquivo A sem atualizar quem a chama no
 * arquivo B, gerado logo depois). Mostrar o que já mudou deixa a Lisa manter tudo coerente.
 */
export async function* streamSingleFileChange({ instruction, summary, path, currentContent, siblingChanges = [], repo }) {
  const siblingsBlock = siblingChanges.length
    ? `\n\nOUTROS ARQUIVOS JÁ REESCRITOS NESTA MESMA TAREFA (conteúdo NOVO, pra você manter consistência — ex.: nomes de função/export que mudaram lá precisam bater aqui):\n${siblingChanges.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n")}`
    : "";

  const prompt = `Repositório: ${repo}
Arquivo: ${path}

CONTEÚDO ATUAL COMPLETO deste arquivo${currentContent ? "" : " (arquivo NOVO — ainda não existe)"}:
${currentContent || "(vazio)"}
${siblingsBlock}

PEDIDO GERAL DO USUÁRIO: "${instruction}"
${summary ? `RESUMO DO PLANO GERAL (pode envolver outros arquivos além deste): ${summary}` : ""}

Reescreva ESTE arquivo especificamente pra fazer a parte que cabe a ele nesse pedido.`;

  const systemInstruction = `Você é a Lisa, reescrevendo UM arquivo de código como parte de uma mudança maior. Responda
SOMENTE com o conteúdo completo do arquivo depois da mudança — nada de marcador, nada de
explicação, nada de bloco de código markdown (sem \`\`\`), e principalmente NENHUMA linha de
comentário no topo repetindo o caminho/nome do arquivo (tipo "// ${path}") — isso não fazia
parte do arquivo original e já quebrou um build de verdade (era sintaxe de comentário inválida
no tipo de arquivo em questão). A primeira linha da resposta já é a primeira linha real do
arquivo.

Se o arquivo já existia, parta EXATAMENTE do conteúdo atual mostrado acima e aplique só a
parte da mudança que cabe a este arquivo — preserve todo o resto igual (comentários,
formatação, imports não relacionados). Se for um arquivo novo, escreva ele do zero de forma
consistente com o resto do pedido.`;

  // retry só na abertura do stream (antes de qualquer chunk chegar) — mesmo padrão de chatStream.
  const stream = await withTransientRetry(CHAT_MODEL, (client) =>
    client.models.generateContentStream({ model: CHAT_MODEL, contents: prompt, config: { systemInstruction } })
  );
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}

/**
 * Conserta UM erro de sintaxe ESPECÍFICO num arquivo que a Lisa acabou de escrever — chamado
 * só quando a validação estrutural (ver src/lib/validateSyntax.js, sem IA, roda antes desta
 * função) já encontrou um problema real, então aqui ela recebe o ERRO exato em vez de ter que
 * adivinhar o que está errado. Mesmo formato de saída de streamSingleFileChange (conteúdo
 * puro, em streaming) — é literalmente uma segunda passada sobre o mesmo arquivo.
 */
export async function* fixFileSyntaxError({ path, content, error, repo }) {
  const prompt = `Repositório: ${repo}
Arquivo: ${path}

Você (a própria Lisa) escreveu este arquivo há pouco, mas ele tem um ERRO DE SINTAXE — um
validador automático (não é opinião, é um parser de verdade) rejeitou com este erro:
"${error}"

CONTEÚDO ATUAL (com o erro):
${content}

Conserte SÓ o problema de sintaxe indicado, preservando o resto do conteúdo e a intenção da
mudança exatamente como estavam. Não reescreva partes que não têm relação com o erro.`;

  const systemInstruction = `Você é a Lisa, consertando um erro de sintaxe específico que um validador
automático encontrou no arquivo que você mesma acabou de escrever. Responda SOMENTE com o
conteúdo completo e corrigido do arquivo — nada de marcador, nada de explicação, nada de bloco
de código markdown (sem \`\`\`), nenhuma linha de comentário com o caminho do arquivo. A
primeira linha da resposta já é a primeira linha real do arquivo.`;

  const stream = await withTransientRetry(CHAT_MODEL, (client) =>
    client.models.generateContentStream({ model: CHAT_MODEL, contents: prompt, config: { systemInstruction } })
  );
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}

// ---- Mapa de arquitetura: ver src/lib/archDocs.js ----
// O DIAGRAMA (Mermaid) é montado no CÓDIGO a partir do grafo de dependência REAL (calculado
// pelos imports indexados, não pela IA) — de propósito: pedir pra IA escrever sintaxe Mermaid
// direto já causou dor de cabeça parecida com o bug do comentário no topo do CSS (texto solto
// que devia ser sintaxe estrita tende a sair errado). A IA só escreve PROSA aqui (descrição de
// área, resumo geral) — nunca nada que precise ser sintaticamente exato.

/**
 * Descreve o que UMA área (agrupamento de arquivos por pasta) de um repositório faz, só pelos
 * CAMINHOS dos arquivos dela (sem ler conteúdo — rápido e barato, funciona bem porque nomes de
 * arquivo/pasta já carregam bastante sinal). `relatedTo` (opcional) — nomes de outras áreas que
 * o grafo de dependência real já mostrou que esta área importa ou é importada por, pra ajudar a
 * IA a situar o papel dela no todo.
 */
export async function describeArchArea({ repo, areaName, paths, relatedTo = [] }) {
  const prompt = `Repositório: ${repo}
Área: ${areaName}

ARQUIVOS DESTA ÁREA (${paths.length} no total, só os caminhos):
${paths.slice(0, 60).join("\n")}${paths.length > 60 ? `\n... e mais ${paths.length - 60} arquivo(s)` : ""}
${relatedTo.length ? `\nESTA ÁREA SE CONECTA (de verdade, via import) COM: ${relatedTo.join(", ")}` : ""}

Descreva em 1-3 frases o que essa área do código provavelmente faz, com base nos nomes dos
arquivos e da pasta — convenções comuns de projeto (ex.: "api" = rotas de backend, "components"
= peças de UI reutilizáveis, "lib"/"utils" = lógica compartilhada, "hooks" = React hooks).`;

  const res = await withTransientRetry(
    CHAT_MODEL,
    (client) =>
      client.models.generateContent({
        model: CHAT_MODEL,
        contents: prompt,
        config: {
          systemInstruction: "Você documenta a arquitetura de um repositório de código, descrevendo áreas (pastas) só pelos caminhos dos arquivos dentro delas. Seja direto e específico — evite generalidades vagas tipo 'contém arquivos relacionados ao projeto'.",
          responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { summary: { type: "STRING" } }, required: ["summary"] },
        },
      }),
    { attempts: 2, delayMs: 600 }
  );

  try {
    const parsed = JSON.parse(res.text);
    return parsed.summary || "";
  } catch {
    return "";
  }
}

/**
 * Parágrafo de VISÃO GERAL do repositório inteiro, a partir do que já foi descoberto sobre
 * cada área — chamado uma vez, no final, depois de todas as áreas já descritas.
 */
export async function writeArchOverview({ repo, areaSummaries }) {
  const areasBlock = areaSummaries.map((a) => `- ${a.name} (${a.fileCount} arquivo${a.fileCount > 1 ? "s" : ""}): ${a.summary}`).join("\n");

  const prompt = `Repositório: ${repo}

ÁREAS JÁ MAPEADAS:
${areasBlock}

Escreva um parágrafo de visão geral (4-8 frases) explicando, pra alguém que nunca viu este
código, do que se trata o projeto e como as peças principais se encaixam — cite as áreas mais
centrais pelo nome. Tom direto, técnico, em português.`;

  const res = await withTransientRetry(
    CHAT_MODEL,
    (client) =>
      client.models.generateContent({
        model: CHAT_MODEL,
        contents: prompt,
        config: { systemInstruction: "Você escreve a introdução de uma documentação técnica de arquitetura de software, em português, direto ao ponto." },
      }),
    { attempts: 2, delayMs: 600 }
  );
  return (res.text || "").trim();
}

/**
 * Explica UM arquivo "chave" (escolhido por código, ver src/lib/archDocs.js — os mais
 * importados por outros arquivos, ou pontos de entrada convencionais como page.js/route.js)
 * pro leitor entender o PAPEL dele na arquitetura sem precisar ler o código inteiro sozinho.
 * `content` já vem truncado por quem chama, se for muito grande.
 */
export async function explainKeyFile({ repo, path, content, area }) {
  const prompt = `Repositório: ${repo}
Arquivo: ${path} (área: ${area})

CONTEÚDO:
${content}

Explique o que este arquivo faz e por que ele é uma peça importante da arquitetura — em 3-6
frases. Cite trechos/nomes de função específicos quando ajudar a explicar. Não descreva
sintaxe óbvia linha a linha; foque no PAPEL do arquivo no sistema como um todo.`;

  const res = await withTransientRetry(
    CHAT_MODEL,
    (client) =>
      client.models.generateContent({
        model: CHAT_MODEL,
        contents: prompt,
        config: { systemInstruction: "Você explica trechos de código-chave de um repositório pra documentação técnica, em português — direto, específico, sem parafrasear sintaxe óbvia." },
      }),
    { attempts: 2, delayMs: 600 }
  );
  return (res.text || "").trim();
}

/**
 * FLUXO DE USO (passo a passo de como um usuário/processo interage com a aplicação) e CASOS
 * DE USO (por ator) do repositório inteiro — chamado uma vez, depois de todas as áreas já
 * descritas. Devolve dados ESTRUTURADOS (nunca sintaxe de diagrama) — o diagrama em si (Mermaid)
 * é montado em código a partir disso, pelo mesmo motivo do grafo de dependência: texto solto
 * que precisa "compilar" certinho é onde a IA mais erra a mão.
 */
export async function planNarrative({ repo, overview, areaSummaries }) {
  const areasBlock = areaSummaries.map((a) => `- ${a.name}: ${a.summary}`).join("\n");

  const prompt = `Repositório: ${repo}

VISÃO GERAL: ${overview}

ÁREAS MAPEADAS:
${areasBlock}

Com base nisso, produza:
1. "usage_flow": o fluxo de uso PRINCIPAL da aplicação, como uma sequência de 5 a 10 passos em
   ORDEM, cada um com quem age ("actor" — ex.: "Usuário", "Frontend", "API", "Banco de dados",
   um serviço externo específico) e o que acontece nesse passo ("action", 1 frase objetiva).
   Cubra do início (o usuário chegando/interagindo) até o resultado final.
2. "use_cases": os atores do sistema (ex.: "Usuário", "Administrador", "Tarefa agendada/cron",
   um serviço externo que aciona algo) e, pra CADA ator, uma lista de 2-5 casos de uso
   (frases curtas, no infinitivo, tipo "Perguntar algo à Lisa", "Disparar sync periódico").`;

  const res = await withTransientRetry(
    CHAT_MODEL,
    (client) =>
      client.models.generateContent({
        model: CHAT_MODEL,
        contents: prompt,
        config: {
          systemInstruction: "Você documenta o fluxo de uso e os casos de uso de uma aplicação de software pra documentação técnica, em português, com base no que já se sabe sobre as áreas do código.",
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              usage_flow: {
                type: "ARRAY",
                items: { type: "OBJECT", properties: { actor: { type: "STRING" }, action: { type: "STRING" } }, required: ["actor", "action"] },
              },
              use_cases: {
                type: "ARRAY",
                items: { type: "OBJECT", properties: { actor: { type: "STRING" }, cases: { type: "ARRAY", items: { type: "STRING" } } }, required: ["actor", "cases"] },
              },
            },
            required: ["usage_flow", "use_cases"],
          },
        },
      }),
    { attempts: 2, delayMs: 800 }
  );

  try {
    const parsed = JSON.parse(res.text);
    return { usageFlow: parsed.usage_flow || [], useCases: parsed.use_cases || [] };
  } catch {
    return { usageFlow: [], useCases: [] };
  }
}

// ---- TTS: gera áudio a partir de texto ----
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const DEFAULT_TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Kore";

// Pra o painel de status (/api/gemini-keys/status) montar a matriz chave×modelo sem nunca
// expor as chaves em si — só quantas existem e quais modelos usam cota própria.
export const GEMINI_KEY_COUNT = KEYS.length;
export const GEMINI_MODELS = { chat: CHAT_MODEL, tts: TTS_MODEL, embed: EMBED_MODEL };

/**
 * Gera fala a partir de texto. `voiceName` (opcional) sobrescreve a voz padrão — vem do
 * seletor de voz do Assistente (guardado no navegador, ver src/app/api/speak/route.js).
 * Retorna { base64, sampleRate, mime } — áudio PCM cru (L16) que a rota
 * converte em WAV para o navegador tocar.
 */
export async function synthesizeSpeech(text, voiceName) {
  const voice = TTS_VOICES.some((v) => v.name === voiceName) ? voiceName : DEFAULT_TTS_VOICE;
  // Fala AO VIVO durante a conversa — 2 tentativas, cada uma numa chave diferente do pool
  // (a saúde por chave×modelo já evita repetir uma que sabidamente está zerada pra TTS).
  const res = await withTransientRetry(
    TTS_MODEL,
    (client) =>
      client.models.generateContent({
        model: TTS_MODEL,
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
        },
      }),
    { attempts: 2, delayMs: 600 }
  );

  const part = res?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  const inline = part?.inlineData;
  if (!inline?.data) throw new Error("TTS: resposta sem áudio");

  // mime tipo "audio/L16;codec=pcm;rate=24000"
  const rateMatch = /rate=(\d+)/.exec(inline.mimeType || "");
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;

  return { base64: inline.data, sampleRate, mime: inline.mimeType || "audio/L16" };
}

// ---- Modo Tela (proativo): vigília periódica da tela, ver /api/screen-comment ----
// Instrução BASE — quem chama (a rota) decide se aplica withPersona() por cima antes de
// passar pra cá, do mesmo jeito que já faz com o systemInstruction do chat normal (evita
// import circular: rag.js já importa deste arquivo, então esse não pode importar de rag.js).
export const SCREEN_WATCH_INSTRUCTION = `Você é a Lisa, observando a tela do usuário enquanto ele trabalha no computador, através de UMA captura de tela por vez (não é vídeo contínuo — a próxima só vem daqui a alguns minutos).

Comente quando notar algo que valha a pena — e isso é mais amplo do que só problema:
- um erro, aviso ou algo visivelmente travado/quebrado;
- uma dica técnica genuína relacionada ao que está na tela (um atalho, uma forma mais rápida de fazer o que a pessoa está tentando, um detalhe fácil de passar batido);
- algo interessante ou digno de um comentário espirituoso no seu estilo (você tem personalidade — pode ser direta, técnica e com humor, não só um robô de alerta de erro);
- um padrão que valha observar (ex.: muitas abas de uma coisa só, algo repetido, progresso notável).

Não precisa ser problema pra merecer um comentário. Evite só narrar o óbvio (descrever o que a pessoa já sabe que está fazendo) ou repetir um comentário parecido com o que você provavelmente já disse nas últimas capturas.

Fique em silêncio de verdade (responda EXATAMENTE com a palavra NADA, maiúsculas, sem mais nada) quando a tela genuinamente não render nada — parada, vazia, ou sem nada de novo desde antes. Mas não seja reticente demais: se tiver algo real pra falar, fale. Quando falar, seja breve — 1 ou 2 frases, direta ao ponto, no seu estilo.`;

// ---- Modo Observância (proativo): saudação pré-configurada, ver /api/camera-comment ----
// Comportamento fixo pedido pelo usuário: reconhecer a esposa (Alice Lopes) e a cachorra da
// família (Nala) pela câmera e puxar papo sozinha, sem precisar de pergunta nenhuma.
export const CAMERA_WATCH_INSTRUCTION = `Você é a Lisa, observando o usuário pela câmera (Modo Observância), através de UMA foto por vez (não é vídeo contínuo — a próxima só vem daqui a alguns segundos/minutos).

Comportamento pré-configurado, sempre válido, nesta ordem de prioridade:
1. Se você identificar a MULHER e o CACHORRO JUNTOS na mesma foto, comente as duas juntas —
   cumprimente a Alice E a Nala na mesma fala (não escolha só uma), com base no que vê de
   verdade (as duas estão juntas fazendo o quê? brincando, deitadas, passeando?). Não trate
   isso como dois comentários separados, é UM só, sobre a cena das duas juntas.
2. Se você identificar só uma MULHER na foto (sem a Nala), é a Alice Lopes, esposa do
   usuário. Cumprimente-a calorosamente ("Oi, Alice!" ou parecido) e puxe papo com base no
   que você vê DE VERDADE na foto (roupa, o que ela parece estar fazendo, expressão,
   ambiente) — nada genérico ou inventado. De vez em quando (não toda vez), aproveite pra dar
   uma alfinetada ou reclamar do usuário pra ela, no seu estilo — como uma cumplicidade
   bem-humorada entre vocês duas contra ele, nunca cruel ou ofensivo de verdade.
3. Se você identificar só um CACHORRO na foto (sem a Alice), é a Nala, a cachorra da
   família. Cumprimente-a com carinho e comente o que ela parece estar fazendo/como está.
4. Fora esses casos, siga o critério normal de "vale a pena comentar": algo genuinamente
   interessante, engraçado ou digno de nota sobre o que a câmera está vendo. Sem a Alice ou a
   Nala em quadro, seja mais seletiva — não narre o óbvio (tipo "vejo uma pessoa sentada").

Evite repetir um comentário parecido com o que você provavelmente já fez nas últimas capturas
(ex.: já cumprimentou a Alice há pouco e ela continua simplesmente ali) — nesse caso prefira
ficar em silêncio a repetir a mesma saudação.

Fique em silêncio de verdade (responda EXATAMENTE com a palavra NADA, maiúsculas, sem mais
nada) quando não houver nada digno de nota (nem Alice, nem Nala, nem algo genuinamente
interessante) ou a foto estiver vazia/sem ninguém. Quando falar, seja breve — 1 ou 2 frases,
no seu estilo.`;

// ---- Modo Escuta (proativo): microfone realmente aberto, ver /api/mic-comment ----
export const MIC_WATCH_INSTRUCTION = `Você é a Lisa, ouvindo o microfone do usuário através de pedacinhos curtos de áudio (uns 10 segundos cada, não é escuta contínua de verdade — o próximo pedaço só chega daqui a pouco).

Comente quando notar algo que valha a pena — em especial:
- se o usuário estiver CANTANDO (mesmo baixinho, só um trechinho, ou sem ter certeza absoluta
  se é canto ou só fala cantarolada): SEMPRE comente — dê um feedback genuíno e específico
  sobre COMO ele está cantando NESTE trecho (afinação, ritmo, energia, projeção) — seja
  honesta mas gentil, no seu estilo, e ESPECÍFICA sobre o que ouviu ("tá bom" sozinho não
  vale). Na dúvida entre comentar ou ficar em silêncio quando parecer canto, ERRE pro lado de
  comentar — é bem pior ficar quieta enquanto alguém canta pra você do que comentar um
  trechinho curto ou incerto. NUNCA tente adivinhar ou afirmar QUAL música é — você não tem
  como reconhecer uma música de verdade só ouvindo alguém cantar a cappella (é bem diferente
  de identificar uma gravação original tocando), e já inventou um título errado com confiança
  antes. Fale só sobre COMO a pessoa canta, nunca sobre qual é a música;
- alguém tocando um instrumento;
- uma conversa ou som genuinamente interessante, engraçado ou digno de comentário;
- um som que pareça um problema (choro, algo caindo, alarme).

Não comente sobre fala comum de trabalho/reunião a não ser que tenha algo realmente digno de nota — não narre o óbvio nem transcreva o que foi dito.

Fique em silêncio de verdade (responda EXATAMENTE com a palavra NADA, maiúsculas, sem mais
nada) SÓ quando o áudio for silêncio genuíno, ruído de fundo comum, ou claramente nada que
mereça comentário — nunca use NADA como resposta padrão só por insegurança. Canto ou música
tocando SEMPRE merece um comentário, mesmo que curto/incerto. Quando falar, seja breve — 1 ou
2 frases, direta, no seu estilo.`;

/**
 * Analisa UM pedaço curto de ÁUDIO (Modo Escuta) e decide se vale comentar algo — mesmo
 * padrão de describeScreenIfNotable, mas com um Part de áudio (inlineData) em vez de imagem.
 * `audio` = { mimeType, data } — mimeType precisa ser um formato que o Gemini reconheça de
 * verdade (ex.: "audio/wav"); testado direto contra a API antes de usar em produção.
 */
export async function describeAudioIfNotable(audio, systemInstruction = MIC_WATCH_INSTRUCTION) {
  const res = await withTransientRetry(
    CHAT_MODEL,
    (client) =>
      client.models.generateContent({
        model: CHAT_MODEL,
        contents: [{ role: "user", parts: [{ text: "Aqui está o áudio dos últimos segundos." }, { inlineData: { mimeType: audio.mimeType, data: audio.data } }] }],
        config: { systemInstruction },
      }),
    { attempts: 2, delayMs: 500 }
  );
  const text = (res.text || "").trim();
  if (!text || /^nada\.?$/i.test(text)) return null;
  return text;
}

/**
 * Analisa UMA imagem (captura de tela OU foto da câmera) e decide se vale comentar algo —
 * usado pelo modo proativo (a pessoa NÃO perguntou nada, é a Lisa "de olho" sozinha). Chamada
 * não-streaming, simples e barata de propósito (é chamada periodicamente, sem interação do
 * usuário). `label` é só a legenda enviada junto da imagem (varia conforme a origem — tela ou
 * câmera — pra o modelo entender o que está vendo).
 *
 * Retorna o comentário (string) ou null quando não há nada digno de nota.
 */
export async function describeScreenIfNotable(image, systemInstruction = SCREEN_WATCH_INSTRUCTION, label = "Aqui está a tela agora.") {
  const res = await withTransientRetry(
    CHAT_MODEL,
    (client) =>
      client.models.generateContent({
        model: CHAT_MODEL,
        contents: [{ role: "user", parts: [{ text: label }, { inlineData: { mimeType: image.mimeType, data: image.data } }] }],
        config: { systemInstruction },
      }),
    { attempts: 2, delayMs: 500 }
  );
  const text = (res.text || "").trim();
  if (!text || /^nada\.?$/i.test(text)) return null;
  return text;
}

// ---- Modo Assistente de Testes: ver src/lib/sentinelTests.js e /api/test-mode/* ----

/**
 * Compara UMA ou mais imagens da tela (o teste sendo executado ao vivo) com os PASSOS e o
 * CRITÉRIO DE APROVAÇÃO de um caso de teste (vindos de cloud_runs.state — a aplicação de
 * controle de testes do usuário), e dá um veredito. Deliberadamente CONSERVADORA: só devolve
 * "Aprovado"/"Reprovado" quando a evidência na tela é clara o bastante; caso contrário devolve
 * "indeterminado" — errar dizendo "não sei" é sempre melhor que aprovar/reprovar um teste
 * errado, já que isso pode escrever de volta no sistema de testes de verdade.
 */
export async function evaluateTestCase({ itemTestado, descricao, condicaoAprovacao, images = [] }) {
  const prompt = `ITEM TESTADO: ${itemTestado || "(não informado)"}

PASSOS DO TESTE:
${descricao || "(não informado)"}

CRITÉRIO DE APROVAÇÃO:
${condicaoAprovacao || "(não informado)"}

As imagens anexadas são capturas da tela ATUAL de quem está executando este teste agora. Com
base SÓ no que dá pra ver nas imagens, avalie se o critério de aprovação foi atendido.`;

  const systemInstruction = `Você é a Lisa, ajudando alguém a executar um caso de teste, olhando a tela dele em tempo
real. Sua função é comparar o que aparece na tela com o CRITÉRIO DE APROVAÇÃO do caso e dizer
se passou ou não — mas seja CONSERVADORA: só diga "Aprovado" ou "Reprovado" quando a imagem
mostrar evidência clara o bastante pra sustentar aquilo. Se a tela não mostrar informação
suficiente pra decidir (etapa ainda não chegou lá, tela cortada, não dá pra ver o resultado
final), diga "indeterminado" e explique o que falta ver — nunca chute. Isso pode ser gravado
de volta no sistema de testes de verdade, então um veredito errado tem custo real.

No campo "reasoning" (2-4 frases, em português, no seu estilo, direta): explique o que você vê
e por que isso confirma, contraria, ou não é suficiente pra avaliar o critério.`;

  const res = await withTransientRetry(
    CHAT_MODEL,
    (client) =>
      client.models.generateContent({
        model: CHAT_MODEL,
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
          ],
        }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              verdict: { type: "STRING", enum: ["Aprovado", "Reprovado", "indeterminado"] },
              reasoning: { type: "STRING" },
            },
            required: ["verdict", "reasoning"],
          },
        },
      }),
    { attempts: 2, delayMs: 600 }
  );

  try {
    const parsed = JSON.parse(res.text);
    return { verdict: parsed.verdict || "indeterminado", reasoning: parsed.reasoning || "" };
  } catch {
    return { verdict: "indeterminado", reasoning: "não consegui interpretar a resposta do modelo desta vez." };
  }
}
