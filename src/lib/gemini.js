import { GoogleGenAI } from "@google/genai";
import { TTS_VOICES } from "./ttsVoices.js";

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
const EMBED_DIM = Number(process.env.GEMINI_EMBED_DIM || 768);

// ---- múltiplas chaves do Gemini, em RODÍZIO a cada chamada ----
// GEMINI_API_KEYS="chave1,chave2,chave3" (uma lista) — cada chave precisa ser de um
// PROJETO diferente no Google Cloud/AI Studio pra ter cota própria de verdade (chaves do
// MESMO projeto compartilham a mesma cota, então trocar entre elas não ajuda em nada).
// Mantém GEMINI_API_KEY funcionando sozinha se só houver uma (comportamento de sempre).
//
// Rodízio PROATIVO (uma chave diferente a cada chamada, não só depois de uma falha): se o
// limite de cada chave é por MINUTO (bem comum nos modelos preview, como o de TTS), martelar
// sempre a MESMA chave até ela estourar significa ficar preso ao teto de uma única chave a
// maior parte do tempo. Espalhando as chamadas entre as N chaves desde o início, o limite
// efetivo do app vira ~N vezes o de uma chave só, em vez de só reagir depois de já ter
// tomado 429 — e como cada nova tentativa de retry também chama ai() de novo, uma falha por
// cota já naturalmente cai numa chave diferente na tentativa seguinte, sem precisar de
// nenhuma lógica extra pra isso.
const KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
  .split(",").map((k) => k.trim()).filter(Boolean);

const _clients = new Map(); // chave → cliente (reaproveita entre chamadas)
let keyPtr = 0; // índice da PRÓXIMA chave a usar — avança a cada chamada (rodízio)

function ai() {
  if (!KEYS.length) {
    throw new Error(
      "GEMINI_API_KEY (ou GEMINI_API_KEYS) não configurada. " +
      "Defina em Vercel → Settings → Environment Variables (ou no .env local)."
    );
  }
  const key = KEYS[keyPtr % KEYS.length];
  keyPtr = (keyPtr + 1) % KEYS.length;
  if (!_clients.has(key)) _clients.set(key, new GoogleGenAI({ apiKey: key }));
  return _clients.get(key);
}

// ---- erros transitórios do Gemini (429 quota / 503 alta demanda) ----
// A API costuma devolver o corpo cru como uma string JSON aninhada e feia
// (ex.: {"error":{"message":"{\"error\":{\"code\":503,...}}",...}}). Detectamos
// por substring (robusto o bastante pro texto que a API realmente devolve) e
// trocamos por uma mensagem curta e acionável — nunca mostramos o JSON cru pro usuário.
function isQuotaError(msg) {
  return msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("429");
}
function isOverloadError(msg) {
  return msg.includes("UNAVAILABLE") || msg.includes("high demand") || msg.includes("503");
}
function isTransientError(err) {
  const msg = String(err?.message || err);
  return isQuotaError(msg) || isOverloadError(msg);
}
function rewriteTransientError(err) {
  const msg = String(err?.message || err);
  if (isQuotaError(msg)) {
    const e = new Error("QUOTA_EXCEEDED: limite do Gemini atingido. Aguarde ~1 min e tente de novo.");
    e.code = "QUOTA";
    return e;
  }
  if (isOverloadError(msg)) {
    const e = new Error("UNAVAILABLE: o Gemini está com alta demanda no momento. Tente de novo em instantes.");
    e.code = "UNAVAILABLE";
    return e;
  }
  return err;
}

/** Repete a chamada quando o erro é transitório (429/503); troca por mensagem curta se persistir. */
async function withTransientRetry(fn, { attempts = 3, delayMs = 1200 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientError(err) || attempt === attempts) throw rewriteTransientError(err);
      // não precisa rodar a chave na mão aqui — a próxima chamada a ai() (na próxima
      // tentativa deste mesmo retry) já pega a PRÓXIMA chave do rodízio sozinha.
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error("withTransientRetry: unreachable");
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
  // menos tentativas e esperas curtas: falha rápido em vez de travar minutos.
  // (a ingestão em lote tem seu próprio ritmo; aqui priorizamos resposta rápida)
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await ai().models.embedContent({
        model: EMBED_MODEL,
        contents,
        config: { outputDimensionality: EMBED_DIM, taskType },
      });
      return res.embeddings.map((e) => e.values);
    } catch (err) {
      if (!isTransientError(err) || attempt === maxAttempts) throw rewriteTransientError(err);
      await new Promise((r) => setTimeout(r, 3000)); // uma espera curta só
    }
  }
  throw new Error("embed: unreachable");
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
 * sozinho) trava a função até ela ser morta no meio, sem nem registrar erro. Por isso o
 * espera é sempre CURTA (teto de 8s) e poucas tentativas — se a quota não liberar rápido,
 * desiste rápido também: quem chama (ingestSlice → /api/cron/sync) já tenta de novo no
 * próximo tick, um minuto depois, sem perder o offset onde parou.
 */
export async function embedForIngest(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const contents = Array.isArray(texts) ? texts : [texts];
  const maxAttempts = 2;
  const MAX_WAIT_SEC = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await ai().models.embedContent({
        model: EMBED_MODEL,
        contents,
        config: { outputDimensionality: EMBED_DIM, taskType },
      });
      return res.embeddings.map((e) => e.values);
    } catch (err) {
      if (!isTransientError(err) || attempt === maxAttempts) throw rewriteTransientError(err);
      const msg = String(err?.message || err);
      const m = msg.match(/retry in ([\d.]+)s/i);
      const waitSec = Math.min(m ? Math.ceil(Number(m[1])) + 1 : 5 * attempt, MAX_WAIT_SEC);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
    }
  }
  throw new Error("embedForIngest: unreachable");
}

/**
 * Gera a resposta em streaming.
 * Retorna um async iterator de pedaços de texto (string).
 *
 * `tools` (opcional) — ex.: [{ googleSearch: {} }] pra habilitar grounding com
 * busca do Google (o modelo decide sozinho quando de fato buscar). Usado pelo
 * modo "Geral" do assistente.
 *
 * `image` (opcional) — { mimeType, data (base64) } — uma foto tirada na hora pela câmera
 * (Modo Observância do Assistente, ver src/app/(panels)/assistant/page.js). Quando presente,
 * vira multimodal: o mesmo modelo de chat (gemini-2.5-flash) também enxerga imagem, sem
 * precisar de nenhum modelo/endpoint separado.
 */
export async function* chatStream(prompt, systemInstruction, { tools, image } = {}) {
  const config = {};
  if (systemInstruction) config.systemInstruction = systemInstruction;
  if (tools) config.tools = tools;

  const contents = image
    ? [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.data } }] }]
    : prompt;

  // retry só na abertura do stream (antes de qualquer chunk chegar) — 429/503 costumam
  // se resolver em segundos; uma vez que o texto começou a chegar não há o que repetir.
  const stream = await withTransientRetry(() =>
    ai().models.generateContentStream({
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

  const res = await withTransientRetry(() =>
    ai().models.generateContent({
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

// ---- TTS: gera áudio a partir de texto ----
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const DEFAULT_TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Kore";

/**
 * Gera fala a partir de texto. `voiceName` (opcional) sobrescreve a voz padrão — vem do
 * seletor de voz do Assistente (guardado no navegador, ver src/app/api/speak/route.js).
 * Retorna { base64, sampleRate, mime } — áudio PCM cru (L16) que a rota
 * converte em WAV para o navegador tocar.
 */
export async function synthesizeSpeech(text, voiceName) {
  const voice = TTS_VOICES.some((v) => v.name === voiceName) ? voiceName : DEFAULT_TTS_VOICE;
  // Fala AO VIVO durante a conversa — o corte anterior (attempts=2/delayMs=500), combinado
  // com um teto curto no cliente, acabou derrubando praticamente toda tentativa (a voz do
  // Gemini simplesmente parou de aparecer). 3 tentativas com um espaçamento moderado dá uma
  // chance real de dar certo sem voltar ao extremo antigo de ~15s de backoff só pra desistir.
  const res = await withTransientRetry(() =>
    ai().models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    }),
    { attempts: 3, delayMs: 700 }
  );

  const part = res?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  const inline = part?.inlineData;
  if (!inline?.data) throw new Error("TTS: resposta sem áudio");

  // mime tipo "audio/L16;codec=pcm;rate=24000"
  const rateMatch = /rate=(\d+)/.exec(inline.mimeType || "");
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;

  return { base64: inline.data, sampleRate, mime: inline.mimeType || "audio/L16" };
}
