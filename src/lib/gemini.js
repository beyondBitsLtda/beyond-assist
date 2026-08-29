import { GoogleGenAI } from "@google/genai";
import { TTS_VOICES } from "./ttsVoices.js";

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
// gemini-2.5-flash foi descontinuado pra projetos novos no Google Cloud (confirmado ao vivo:
// erro 404 "no longer available to new users", recomendando este aqui) — projetos antigos
// ainda tinham acesso legado ao 2.5, mas o projeto novo (chave prioritária) não. Testado e
// funcionando nas chaves antigas E na nova antes de trocar o padrão.
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.6-flash";
const EMBED_DIM = Number(process.env.GEMINI_EMBED_DIM || 768);

// ---- múltiplas chaves do Gemini: 1ª = PRIORITÁRIA, as demais = reserva em rodízio ----
// GEMINI_API_KEYS="chaveBoa,chave2,chave3" (uma lista) — cada chave precisa ser de um
// PROJETO diferente no Google Cloud/AI Studio pra ter cota própria de verdade (chaves do
// MESMO projeto compartilham a mesma cota, então trocar entre elas não ajuda em nada).
// Mantém GEMINI_API_KEY funcionando sozinha se só houver uma (comportamento de sempre).
//
// A PRIMEIRA chave da lista é sempre a 1ª tentativa de cada chamada — pensada pra ser uma
// chave com faturamento ativado (cota bem maior, praticamente não deveria falhar). As
// demais só entram em RODÍZIO nas tentativas de retry seguintes, quando a 1ª falhou por
// cota/sobrecarga — servem de reserva gratuita, não como parceiras de carga o tempo todo.
// Se só houver 1 chave configurada, o comportamento é o de sempre (sem reserva nenhuma).
const KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
  .split(",").map((k) => k.trim()).filter(Boolean);
const PRIMARY_KEY = KEYS[0];
const RESERVE_KEYS = KEYS.slice(1);

const _clients = new Map(); // chave → cliente (reaproveita entre chamadas)
let reservePtr = 0; // índice da PRÓXIMA chave de reserva — avança só quando a prioritária falha

function clientFor(key) {
  if (!_clients.has(key)) _clients.set(key, new GoogleGenAI({ apiKey: key }));
  return _clients.get(key);
}

// a prioritária tenta 2x SOZINHA antes de cair pra reserva — a maioria dos soluços dela é
// sobrecarga passageira (503), que resolve sozinha só tentando de novo NA MESMA chave boa;
// cair já na 1ª falha pra uma reserva (que pode estar com cota zerada, como as 3 gratuitas
// estão hoje) trocava um problema passageiro por uma falha praticamente garantida.
const PRIMARY_ATTEMPTS = 2;

/** `attempt` (1-based, vem de withTransientRetry ou do for-loop de quem chama): as primeiras
 * PRIMARY_ATTEMPTS tentativas de QUALQUER chamada usam a chave prioritária; só depois disso
 * (falhou de verdade mais de uma vez) é que cai pro rodízio das chaves de reserva.
 *
 * `skipPrimary` — pro AUTO-SYNC (embedForIngest): ele roda sozinho em segundo plano, sem
 * ninguém esperando a resposta na hora, e pode ficar minutos martelando embeddings a cada
 * fatia. NUNCA usa a chave prioritária, pra ela sobrar inteira pro chat/voz/visão — que são
 * as coisas que a pessoa está de fato esperando ver na tela. Sem reserva configurada, cai na
 * prioritária mesmo assim (não trava o app por causa disso). */
function ai(attempt = 1, { skipPrimary = false } = {}) {
  if (!KEYS.length) {
    throw new Error(
      "GEMINI_API_KEY (ou GEMINI_API_KEYS) não configurada. " +
      "Defina em Vercel → Settings → Environment Variables (ou no .env local)."
    );
  }
  if (skipPrimary && RESERVE_KEYS.length) {
    const key = RESERVE_KEYS[reservePtr % RESERVE_KEYS.length];
    reservePtr = (reservePtr + 1) % RESERVE_KEYS.length;
    return clientFor(key);
  }
  if (attempt <= PRIMARY_ATTEMPTS || !RESERVE_KEYS.length) return clientFor(PRIMARY_KEY);
  const key = RESERVE_KEYS[reservePtr % RESERVE_KEYS.length];
  reservePtr = (reservePtr + 1) % RESERVE_KEYS.length;
  return clientFor(key);
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
/** Rótulo de qual chave um attempt usou — só pra diagnóstico em log, nunca expõe a chave em si.
 * Sem isso, "QUOTA_EXCEEDED" parecia sempre a MESMA coisa não importava se foi a chave
 * prioritária (paga) ou uma de reserva (grátis) que falhou — impossível saber qual das duas
 * sem essa distinção, e "minha API paga estourou cota" e "uma reserva grátis estourou" são
 * diagnósticos bem diferentes. */
function keyLabelFor(attempt) {
  // não dá pra apontar qual reserva exata sem expor o ponteiro interno do rodízio (que é
  // global, compartilhado entre chamadas concorrentes) — "de reserva" já basta pra
  // diferenciar "minha chave paga estourou" de "uma das gratuitas estourou".
  return attempt > PRIMARY_ATTEMPTS && RESERVE_KEYS.length ? "chave de reserva (gratuita)" : "chave prioritária";
}

function rewriteTransientError(err, attempt) {
  const msg = String(err?.message || err);
  const key = keyLabelFor(attempt);
  // .keyLabel vai DIRETO no objeto — nunca embutido só no texto da mensagem. Embutir e depois
  // tentar extrair de volta com regex quebrou na primeira tentativa: o rótulo "chave de
  // reserva (gratuita)" tem parênteses DENTRO dele, e isso confundia a regex que tentava
  // recuperar esse valor lá no /api/ask. Propriedade própria não tem essa armadilha.
  if (isQuotaError(msg)) {
    const e = new Error(`QUOTA_EXCEEDED: limite do Gemini atingido. Aguarde ~1 min e tente de novo.`);
    e.code = "QUOTA";
    e.keyLabel = key;
    return e;
  }
  if (isOverloadError(msg)) {
    const e = new Error(`UNAVAILABLE: o Gemini está com alta demanda no momento. Tente de novo em instantes.`);
    e.code = "UNAVAILABLE";
    e.keyLabel = key;
    return e;
  }
  return err;
}

/** Repete a chamada quando o erro é transitório (429/503); troca por mensagem curta se persistir.
 * `fn` recebe o número da tentativa (1-based) — repassa pra ai(attempt), que só sai da chave
 * prioritária pra reserva a partir da 2ª tentativa (ver comentário de ai() acima). */
async function withTransientRetry(fn, { attempts = 3, delayMs = 1200 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (!isTransientError(err) || attempt === attempts) throw rewriteTransientError(err, attempt);
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
      const res = await ai(attempt).models.embedContent({
        model: EMBED_MODEL,
        contents,
        config: { outputDimensionality: EMBED_DIM, taskType },
      });
      return res.embeddings.map((e) => e.values);
    } catch (err) {
      if (!isTransientError(err) || attempt === maxAttempts) throw rewriteTransientError(err, attempt);
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
      // skipPrimary: AUTO-SYNC roda sozinho em segundo plano e pode martelar isso por
      // minutos — nunca toca na chave prioritária, pra ela sobrar inteira pro chat/voz/visão.
      const res = await ai(attempt, { skipPrimary: true }).models.embedContent({
        model: EMBED_MODEL,
        contents,
        config: { outputDimensionality: EMBED_DIM, taskType },
      });
      return res.embeddings.map((e) => e.values);
    } catch (err) {
      if (!isTransientError(err) || attempt === maxAttempts) throw rewriteTransientError(err, attempt);
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
 * `images` (opcional) — [{ mimeType, data (base64) }] — uma ou mais fotos tiradas na hora
 * (Modo Observância = câmera, Modo Tela = captura de tela; ver assistant/page.js). Quando
 * presente, vira multimodal: o mesmo modelo de chat (gemini-2.5-flash) também enxerga
 * imagem, sem precisar de nenhum modelo/endpoint separado.
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
  const stream = await withTransientRetry((attempt) =>
    ai(attempt).models.generateContentStream({
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

  const res = await withTransientRetry((attempt) =>
    ai(attempt).models.generateContent({
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
  // Fala AO VIVO durante a conversa. Agora que a chave prioritária está confirmada boa (chat +
  // voz + embeddings testados direto), 2 tentativas NA CHAVE BOA (PRIMARY_ATTEMPTS=2, ver
  // ai()) valem mais que 3 com a última arriscando uma reserva capenga — menos tempo somado
  // até desistir, sem abrir mão de uma segunda chance pra um soluço passageiro.
  const res = await withTransientRetry((attempt) =>
    ai(attempt).models.generateContent({
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

/**
 * Analisa UMA captura de tela e decide se vale comentar algo — usado pelo modo proativo (a
 * pessoa NÃO perguntou nada, é a Lisa "de olho" sozinha). Chamada não-streaming, simples e
 * barata de propósito (é chamada periodicamente, sem interação do usuário).
 *
 * Retorna o comentário (string) ou null quando não há nada digno de nota.
 */
export async function describeScreenIfNotable(image, systemInstruction = SCREEN_WATCH_INSTRUCTION) {
  const res = await withTransientRetry(
    (attempt) =>
      ai(attempt).models.generateContent({
        model: CHAT_MODEL,
        contents: [{ role: "user", parts: [{ text: "Aqui está a tela agora." }, { inlineData: { mimeType: image.mimeType, data: image.data } }] }],
        config: { systemInstruction },
      }),
    { attempts: 2, delayMs: 500 }
  );
  const text = (res.text || "").trim();
  if (!text || /^nada\.?$/i.test(text)) return null;
  return text;
}
