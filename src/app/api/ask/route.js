import {
  detectDateRange, buildPrompt, todayLabel, withPersona, withContextDocs,
} from "@/lib/rag.js";
import { chatStream, detectTrelloAction } from "@/lib/gemini.js";
import { buildActionProposal, buildClarifyPrompt, executeAction } from "@/lib/assistantActions.js";
import { hasDelpTasks, getDelpTasksForContext } from "@/lib/delpTasks.js";
import { resolveScope } from "@/lib/scopeResolver.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gera a resposta com `tools` (grounding via Google Search); se a chamada falhar, tenta
 * de novo SEM a ferramenta antes de desistir. Muitas contas/planos do Gemini não têm
 * grounding com Google Search liberado, e a API costuma devolver isso como um erro que
 * parece cota estourada — sem essa queda, o modo "Geral" nunca funcionaria nessas contas,
 * mesmo a busca normal (sem web) estando totalmente disponível.
 */
// Filtro LOCAL (sem gastar chamada do Gemini) antes de decidir se vale a pena chamar
// detectTrelloAction — sem isso, toda mensagem numa conversa com cards do Trello no
// histórico disparava uma chamada extra ao Gemini, mesmo perguntas totalmente normais
// ("obrigado", "e sobre X?"). Isso competia por cota com o resto do app (SYNC automático,
// TTS, o chat em si) e ajudava a esgotar a cota bem mais rápido.
const ACTION_VERB_RE = /reprogram|remarc|adia|prazo|mud[ae]|mov[ei]|movid|marc[ae]|marque|conclu|reabr|status|\blista\b|coluna|cancel[ae]|fech[ae]|fechad|resolvid|abert[oa]/i;
const SHORT_REPLY_RE = /^\s*(sim|s|confirma|confirmo|pode|manda|isso|ok|beleza|claro|bora|faz|vai|n[ãa]o|n|cancela|cancele|espera|deixa)\b/i;

/** Vale a pena chamar detectTrelloAction (custa uma chamada ao Gemini) pra esta mensagem? */
function mightBeAction(question, hasPending) {
  const q = (question || "").trim();
  if (hasPending && SHORT_REPLY_RE.test(q)) return true; // resposta curta a uma ação pendente
  return ACTION_VERB_RE.test(q);
}

// ---- consentimento pra falar de tarefas da Delp (a empresa) ----
// O usuário pediu explicitamente: SEMPRE perguntar antes de incluir dados da Delp numa
// resposta sobre tarefas — nunca entrar "de graça" no contexto, mesmo que a pergunta pareça
// claramente sobre tarefas. Reaproveita o MESMO mecanismo de pendingAction já usado pras
// ações do Trello (o cliente já guarda e devolve esse campo, sem precisar de código novo lá).
const DELP_AFFIRMATIVE_RE = /^\s*(sim|s|claro|quero|pode|manda|isso|ok|okay|beleza|com certeza|positivo|uhum|manda ver)\b/i;
const DELP_NEGATIVE_RE = /^\s*(n[ãa]o|n|deixa|dispensa|negativo|nem|sem isso|agora não|deixa pra l[áa])\b/i;

/** Pergunta parece ser sobre tarefas? De propósito NÃO usa uma regex ampla tipo /tarefa/ pra
 * texto livre — isso colidiria com comandos de ação do Trello ("conclua minha tarefa X") e
 * perguntaria da Delp sem necessidade. Só dispara em sinais inequívocos: o seletor "Tarefas"
 * do Assistente (scope.range) ou a própria pergunta citando um prazo/data. */
function looksLikeTasksQuestion(question, scope) {
  if (scope?.mode === "panel" && scope.range) return true;
  if (scope && scope.mode !== "auto") return false; // outro escopo explícito (Geral, board, Brain, Sentinel) não é "tarefas"
  return !!detectDateRange(question);
}

async function* chatStreamWithFallback(prompt, systemInstruction, tools, images) {
  const primary = chatStream(prompt, systemInstruction, { tools, images });
  let yieldedAny = false;
  try {
    for await (const piece of primary) {
      yieldedAny = true;
      yield piece;
    }
  } catch (err) {
    // só cai pro modo sem ferramenta se AINDA NÃO saiu nenhum token — uma falha depois que
    // a resposta já começou a chegar não pode ser "reiniciada" sem duplicar/misturar texto.
    if (!tools || yieldedAny) throw err;
    for await (const piece of chatStream(prompt, systemInstruction, { images })) yield piece;
  }
}

/**
 * POST /api/ask
 * body: {
 *   question: string, filterSource?: 'trello' | 'brain', scope?: Scope,
 *   history?: { question: string, cards: Card[] },  // última pergunta+cards, pra ações do Assistente
 *   pendingAction?: object,                          // ação proposta na resposta anterior, aguardando confirmação
 * }
 *
 * Scope (opcional — vem do seletor "Este painel / Geral" do Assistente):
 *   - { mode: "panel", board }   → força o board inteiro (bypassa detecção automática)
 *   - { mode: "panel", range }   → força o filtro de prazo (hoje/semana/atrasadas...)
 *   - { mode: "panel", source: "brain" } → só notas do Beyond Brain
 *   - { mode: "panel", source: "sentinel" } → só chamados do Sentinela
 *   - { mode: "general" }        → busca ampla em tudo (Trello + Brain + Sentinela) + grounding com Google Search
 *   - ausente / { mode: "auto" } → comportamento padrão (detecção automática por regex)
 *
 * Ações no Trello (mudar prazo/lista/concluído) — só quando há cards do Trello no `history`
 * (última resposta) ou uma `pendingAction` de antes: antes de responder normalmente, um passo
 * rápido (detectTrelloAction) decide a intenção. Dois fluxos possíveis, nunca executando de
 * cara:
 *   - 1 card claramente identificado → propõe e pede confirmação ("sim"/"não") antes de agir.
 *   - vários cards parecidos → pergunta numerado qual é; a resposta (número, ou descrição)
 *     já resolve E executa, sem precisar de outro "confirma?" — escolher a opção certa É a
 *     confirmação.
 *
 * Responde via SSE com estes eventos:
 *   - "context": cards recuperados  → coluna RETRIEVED_CONTEXT
 *   - "action":  { pending: object|null } → o cliente guarda isso e manda de volta no próximo pedido
 *   - "token":   pedaços da resposta → transcript (estado SPEAKING)
 *   - "done":    fim do stream
 *
 * `personaMode` (opcional, default false) — liga a personalidade de persona.md por cima da
 * instrução normal (ver withPersona em rag.js). Vem do seletor de configurações do Assistente.
 */
export async function POST(req) {
  const body = await req.json();
  const { filterSource = null, history = null, pendingAction = null, images: rawImages = null } = body;
  // question/scope/personaMode são `let` porque o fluxo de consentimento da Delp (abaixo)
  // pode SUBSTITUÍ-los pela pergunta/escopo ORIGINAIS quando resolve um "sim"/"não" — o
  // usuário respondeu à pergunta de consentimento, não fez uma pergunta nova de verdade.
  let { question, scope = null, personaMode = false } = body;
  let delpConsent = false; // só vira true se o usuário confirmar explicitamente nesta troca
  // uma ou mais imagens: câmera (Modo Observância) e/ou captura de tela (Modo Tela) — cada
  // uma valida sozinha, entradas malformadas simplesmente não entram na lista.
  const images = Array.isArray(rawImages) ? rawImages.filter((img) => img?.data && img?.mimeType) : [];

  if (!question || typeof question !== "string") {
    return new Response(JSON.stringify({ error: "question é obrigatório" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const send = (controller, event, data) =>
    controller.enqueue(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    );

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ---- consentimento pra falar de tarefas da Delp — ver comentário da regex acima ----
        if (pendingAction?.type === "delp_consent") {
          const q = question.trim();
          if (DELP_AFFIRMATIVE_RE.test(q)) delpConsent = true;
          if (DELP_AFFIRMATIVE_RE.test(q) || DELP_NEGATIVE_RE.test(q)) {
            // resolvido (positivo ou negativo) — volta pra pergunta/escopo ORIGINAIS, que
            // ficaram estacionados no pendingAction esperando essa resposta.
            question = pendingAction.originalQuestion;
            scope = pendingAction.scope;
            personaMode = pendingAction.personaMode;
          }
          // nem sim nem não reconhecido — trata como uma pergunta NOVA (abandona o
          // consentimento pendente) em vez de travar esperando um formato de resposta que
          // talvez nunca venha
        } else if (!pendingAction && looksLikeTasksQuestion(question, scope) && await hasDelpTasks()) {
          send(controller, "context", []);
          send(controller, "action", { pending: { type: "delp_consent", originalQuestion: question, scope, personaMode } });
          send(controller, "token", "Antes de continuar — quer que eu leve em conta também as tarefas da Delp?");
          send(controller, "done", { ok: true });
          return;
        }

        // ---- ações no Trello: detecta ANTES do fluxo normal, só quando faz sentido tentar ----
        const candidateCards = (history?.cards || []).filter((c) => c.source === "TRELLO" && c.id);
        // exclui explicitamente o consentimento da Delp (não é uma ação do Trello — evita
        // gastar uma chamada do Gemini tentando interpretar "sim"/"não" como ação de card)
        const shouldCheckAction = pendingAction?.type !== "delp_consent" &&
          (candidateCards.length || pendingAction) && mightBeAction(question, !!pendingAction);
        if (shouldCheckAction) {
          // se detectTrelloAction FALHAR (ex.: cota do Gemini), isso antes virava "none"
          // silenciosamente — parecia "a Lisa não entendeu o pedido" quando na verdade a
          // chamada nem chegou a rodar. Guarda o erro real pra mandar no debug abaixo.
          let detectError = null;
          const intent = await detectTrelloAction({
            question, todayLabel: todayLabel(), candidateCards, pendingAction,
          }).catch((err) => {
            detectError = `${String(err?.message || err)}${err?.keyLabel ? ` [${err.keyLabel}]` : ""}`;
            return { intent: "none" };
          });

          if (intent.intent === "propose_action") {
            try {
              const pending = await buildActionProposal(intent);
              send(controller, "context", candidateCards);
              send(controller, "action", { pending });
              send(controller, "token", pending.summary);
              send(controller, "done", { ok: true });
              return;
            } catch (err) {
              // não deixa cair pro fluxo normal (que poderia "confirmar" algo que não foi
              // resolvido) — avisa o erro real e para por aqui.
              send(controller, "context", candidateCards);
              send(controller, "action", { pending: null });
              send(controller, "token", `⚠️ Entendi que você quer mudar algo, mas não consegui: ${err.message}`);
              send(controller, "done", { ok: true });
              return;
            }
          }
          if (intent.intent === "clarify_candidates" && intent.candidate_ids?.length >= 2) {
            const chosen = candidateCards.filter((c) => intent.candidate_ids.includes(c.id));
            if (chosen.length >= 2) {
              const pending = buildClarifyPrompt({ field: intent.field, new_value: intent.new_value, candidates: chosen });
              send(controller, "context", candidateCards);
              send(controller, "action", { pending });
              send(controller, "token", pending.summary);
              send(controller, "done", { ok: true });
              return;
            }
            // menos de 2 sobraram depois de cruzar com os candidatos reais — trata como "none"
            // e cai pro fluxo normal abaixo, em vez de mostrar uma lista vazia/de 1 item.
          }
          if (intent.intent === "select_candidate" && pendingAction?.type === "clarify") {
            const match = pendingAction.candidates.find((c) => c.card_id === intent.card_id);
            if (match) {
              try {
                const resultText = await executeAction({
                  card_id: match.card_id, card_title: match.title,
                  field: pendingAction.field, new_value: pendingAction.new_value,
                });
                send(controller, "context", candidateCards);
                send(controller, "action", { pending: null });
                send(controller, "token", resultText);
                send(controller, "done", { ok: true });
                return;
              } catch (err) {
                send(controller, "context", candidateCards);
                send(controller, "action", { pending: null });
                send(controller, "token", `⚠️ Não consegui aplicar a mudança: ${err.message}`);
                send(controller, "done", { ok: true });
                return;
              }
            }
            // não bateu com nenhum candidato da lista — cai pro "none"/fluxo normal, deixando
            // a pendingAction como estava (o cliente manda de volta e tenta de novo)
          }
          if (intent.intent === "confirm_pending" && pendingAction?.type === "confirm") {
            let resultText;
            try {
              resultText = await executeAction(pendingAction);
            } catch (err) {
              resultText = `⚠️ Não consegui aplicar a mudança: ${err.message}`;
            }
            send(controller, "context", candidateCards);
            send(controller, "action", { pending: null });
            send(controller, "token", resultText);
            send(controller, "done", { ok: true });
            return;
          }
          if (intent.intent === "cancel_pending" && pendingAction) {
            send(controller, "context", candidateCards);
            send(controller, "action", { pending: null });
            send(controller, "token", "Beleza, não mudei nada.");
            send(controller, "done", { ok: true });
            return;
          }
          // "none" → segue pro fluxo normal de RAG abaixo. Manda um evento mesmo assim (com
          // debug=true) só pra aparecer no log do HUD que a detecção rodou e não achou nada —
          // ajuda a diagnosticar se o roteamento de ação estiver falhando de novo.
          send(controller, "action", { pending: pendingAction || null, debug: true, checkedIntent: intent.intent, detectError });
        }

        // roteamento de escopo (Tarefas/Boards/Sentinela/Delp/Brain/Geral) — extraído pra
        // src/lib/scopeResolver.js, reaproveitado também pelas falas agendadas (ver
        // src/lib/scheduledAnnouncements.js), pra nunca divergir entre os dois usos.
        const { matches, systemInstruction, tools, promptNote } = await resolveScope(scope, question, { filterSource });

        send(controller, "context", matches);

        // Modo Observância (câmera) e/ou Modo Tela (captura de tela) — ver assistant/page.js:
        // avisa o Gemini que há imagem(ns) anexada(s) e pra que servem, senão ele não sabe
        // que pode/deve olhar pra elas ao responder.
        const imageNote = images.length
          ? "Há " + (images.length > 1 ? "IMAGENS anexadas" : "uma IMAGEM anexada") + ", tiradas agora mesmo: " +
            "pode ser uma foto da câmera do usuário (postura, roupa, gesto, expressão — Modo Observância) " +
            "e/ou uma captura da tela do computador dele (Modo Tela). Se a pergunta for sobre o que você " +
            "vê nelas, descreva com base NAS IMAGENS de verdade — não invente. Se a pergunta não tiver " +
            "nada a ver com isso, ignore-as e responda normalmente."
          : null;
        // Tarefas da Delp — só entra se o usuário CONFIRMOU no fluxo de consentimento acima;
        // nunca é buscado/incluído de graça.
        const delpNote = delpConsent
          ? `TAREFAS DA DELP (empresa onde o usuário trabalha) — o usuário PEDIU EXPLICITAMENTE\npra considerar isso agora:\n${await getDelpTasksForContext()}`
          : null;
        const combinedNote = [promptNote, imageNote, delpNote].filter(Boolean).join("\n\n") || null;

        const prompt = buildPrompt(question, matches, combinedNote);
        for await (const piece of chatStreamWithFallback(prompt, withContextDocs(withPersona(systemInstruction, personaMode)), tools, images)) {
          send(controller, "token", piece);
        }

        send(controller, "done", { ok: true });
      } catch (err) {
        // gemini.js já tenta de novo sozinho pra erros transitórios (429/503) e troca o
        // JSON cru da API por um erro com .code curto — só resta mapear pra uma frase.
        // err.keyLabel (ver rewriteError em gemini.js) diz qual CHAVE do pool falhou — sem
        // repassar isso, "cota cheia" parecia sempre a mesma coisa não importava se foi a
        // chave prioritária (paga) ou uma de reserva (grátis), impossível de diferenciar.
        const keySuffix = err?.keyLabel ? ` [${err.keyLabel}]` : "";
        const friendly =
          err?.code === "QUOTA"
            ? `⚠️ Quota do Gemini cheia${keySuffix}. Aguarde cerca de 1 minuto e pergunte de novo. (Dica: evite clicar em SYNC logo antes de perguntar.)`
            : err?.code === "UNAVAILABLE"
            ? `⚠️ O Gemini está com alta demanda no momento${keySuffix} (já tentei de novo automaticamente). Espere um instante e pergunte de novo.`
            : String(err?.message || err);
        send(controller, "error", { message: friendly });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
