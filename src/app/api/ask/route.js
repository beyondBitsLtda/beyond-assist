import {
  retrieve, retrieveByDate, detectDateRange, retrieveByBoard, detectBoard,
  retrieveGeneral, buildPrompt, todayLabel, SYSTEM_INSTRUCTION, SYSTEM_INSTRUCTION_GENERAL,
} from "@/lib/rag.js";
import { searchThoughts, listThoughts, toMatchFormat } from "@/lib/notes.js";
import { retrieveSentinelTickets, listProjects } from "@/lib/sentinel.js";
import { chatStream, detectTrelloAction } from "@/lib/gemini.js";
import { buildActionProposal, buildClarifyPrompt, executeAction } from "@/lib/assistantActions.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gera a resposta com `tools` (grounding via Google Search); se a chamada falhar, tenta
 * de novo SEM a ferramenta antes de desistir. Muitas contas/planos do Gemini não têm
 * grounding com Google Search liberado, e a API costuma devolver isso como um erro que
 * parece cota estourada — sem essa queda, o modo "Geral" nunca funcionaria nessas contas,
 * mesmo a busca normal (sem web) estando totalmente disponível.
 */
async function* chatStreamWithFallback(prompt, systemInstruction, tools) {
  const primary = chatStream(prompt, systemInstruction, { tools });
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
    for await (const piece of chatStream(prompt, systemInstruction, {})) yield piece;
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
 */
export async function POST(req) {
  const { question, filterSource = null, scope = null, history = null, pendingAction = null } = await req.json();

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
        // ---- ações no Trello: detecta ANTES do fluxo normal, só quando faz sentido tentar ----
        const candidateCards = (history?.cards || []).filter((c) => c.source === "TRELLO" && c.id);
        if (candidateCards.length || pendingAction) {
          const intent = await detectTrelloAction({
            question, todayLabel: todayLabel(), candidateCards, pendingAction,
          }).catch(() => ({ intent: "none" }));

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
          send(controller, "action", { pending: pendingAction || null, debug: true, checkedIntent: intent.intent });
        }

        let matches;
        let systemInstruction = SYSTEM_INSTRUCTION;
        let tools;
        let promptNote = null; // linha extra de contexto (ex.: projeto do Sentinela selecionado à mão)

        if (scope?.mode === "general") {
          // modo "Geral": busca ampla em tudo que está indexado + pode buscar na web.
          matches = await retrieveGeneral(question);
          // chamados do Sentinela não passam pelo pipeline de embeddings (leitura ao vivo),
          // então entram à parte aqui — sem derrubar a resposta se o Sentinela não estiver
          // configurado nesse deploy.
          try {
            const tickets = await retrieveSentinelTickets(question);
            matches = [...matches, ...tickets];
          } catch {}
          systemInstruction = SYSTEM_INSTRUCTION_GENERAL;
          tools = [{ googleSearch: {} }];
        } else if (scope?.mode === "panel" && scope.source === "sentinel") {
          // busca chamados do Sentinela direto (sem SYNC/embeddings) — se um projeto foi
          // selecionado manualmente no seletor (scope.projectId), filtra só por ele; senão
          // detecta projeto/prioridade/status/SLA citados na pergunta, ou busca por palavra.
          const projectId = scope.projectId && scope.projectId !== "all" ? scope.projectId : null;
          matches = await retrieveSentinelTickets(question, { projectId });
          if (projectId) {
            try {
              const projects = await listProjects();
              const proj = projects.find((p) => p.id === projectId);
              if (proj) {
                promptNote = `O usuário selecionou manualmente o projeto de teste "${proj.name}" no seletor — ` +
                  `todos os chamados do contexto abaixo são desse projeto. Deixe claro na resposta que você ` +
                  `está falando do projeto "${proj.name}" (ex.: se perguntarem "qual projeto é esse?", responda com esse nome).`;
              }
            } catch {}
          }
        } else if (scope?.mode === "panel" && scope.board) {
          matches = await retrieveByBoard(scope.board);
          if (matches.length > 40) matches = matches.slice(0, 40);
        } else if (scope?.mode === "panel" && scope.range) {
          // "auto" (escopo "Tarefas" do seletor): tenta ler a data da própria pergunta
          // ("atrasadas", "essa semana"...); sem pista nenhuma, cai pro conjunto mais amplo.
          const range = scope.range === "auto" ? (detectDateRange(question) || "upcoming") : scope.range;
          matches = await retrieveByDate(range);
        } else if (scope?.mode === "panel" && scope.source === "brain") {
          // busca textual direto na tabela `notes` (não depende de SYNC/embeddings) — é o
          // caminho confiável pra "leia minha nota sobre X". Sem termo reconhecido na
          // pergunta (ex.: "lê minha última nota"), usa as notas mais recentes, pra sempre
          // ter conteúdo real pra ler em vez de "não encontrei".
          const found = await searchThoughts(question);
          const thoughts = found.length ? found : (await listThoughts({ limit: 5 })).thoughts;
          matches = thoughts.map(toMatchFormat);
        } else {
          // sem escopo explícito: roteador de intenção automático (programação decide o método)
          //  1) tem data? → filtro SQL por prazo
          //  2) cita um board? → filtro SQL pelo board inteiro
          //  3) senão → busca semântica (RAG)
          const range = detectDateRange(question);
          const board = detectBoard(question);

          if (range) {
            matches = await retrieveByDate(range);
          } else if (board) {
            matches = await retrieveByBoard(board);
            // boards grandes: manda no máx. 40 pro Gemini (evita estourar contexto)
            if (matches.length > 40) matches = matches.slice(0, 40);
          } else {
            matches = await retrieve(question, { filterSource });
          }
        }

        send(controller, "context", matches);

        const prompt = buildPrompt(question, matches, promptNote);
        for await (const piece of chatStreamWithFallback(prompt, systemInstruction, tools)) {
          send(controller, "token", piece);
        }

        send(controller, "done", { ok: true });
      } catch (err) {
        // gemini.js já tenta de novo sozinho pra erros transitórios (429/503) e troca o
        // JSON cru da API por um erro com .code curto — só resta mapear pra uma frase.
        const friendly =
          err?.code === "QUOTA"
            ? "⚠️ Quota do Gemini cheia. Aguarde cerca de 1 minuto e pergunte de novo. (Dica: evite clicar em SYNC logo antes de perguntar.)"
            : err?.code === "UNAVAILABLE"
            ? "⚠️ O Gemini está com alta demanda no momento (já tentei de novo automaticamente). Espere um instante e pergunte de novo."
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
