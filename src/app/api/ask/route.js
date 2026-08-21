import {
  retrieve, retrieveByDate, detectDateRange, retrieveByBoard, detectBoard,
  retrieveGeneral, buildPrompt, SYSTEM_INSTRUCTION, SYSTEM_INSTRUCTION_GENERAL,
} from "@/lib/rag.js";
import { chatStream } from "@/lib/gemini.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ask
 * body: { question: string, filterSource?: 'trello' | 'brain', scope?: Scope }
 *
 * Scope (opcional — vem do seletor "Este painel / Geral" do Assistente):
 *   - { mode: "panel", board }   → força o board inteiro (bypassa detecção automática)
 *   - { mode: "panel", range }   → força o filtro de prazo (hoje/semana/atrasadas...)
 *   - { mode: "panel", source: "brain" } → só notas do Beyond Brain
 *   - { mode: "general" }        → busca ampla em tudo + grounding com Google Search
 *   - ausente / { mode: "auto" } → comportamento padrão (detecção automática por regex)
 *
 * Responde via SSE com três eventos que mapeiam direto no HUD:
 *   - "context": cards recuperados  → coluna RETRIEVED_CONTEXT
 *   - "token":   pedaços da resposta → transcript (estado SPEAKING)
 *   - "done":    fim do stream
 */
export async function POST(req) {
  const { question, filterSource = null, scope = null } = await req.json();

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
        let matches;
        let systemInstruction = SYSTEM_INSTRUCTION;
        let tools;

        if (scope?.mode === "general") {
          // modo "Geral": busca ampla em tudo que está indexado + pode buscar na web.
          matches = await retrieveGeneral(question);
          systemInstruction = SYSTEM_INSTRUCTION_GENERAL;
          tools = [{ googleSearch: {} }];
        } else if (scope?.mode === "panel" && scope.board) {
          matches = await retrieveByBoard(scope.board);
          if (matches.length > 40) matches = matches.slice(0, 40);
        } else if (scope?.mode === "panel" && scope.range) {
          // "auto" (escopo "Tarefas" do seletor): tenta ler a data da própria pergunta
          // ("atrasadas", "essa semana"...); sem pista nenhuma, cai pro conjunto mais amplo.
          const range = scope.range === "auto" ? (detectDateRange(question) || "upcoming") : scope.range;
          matches = await retrieveByDate(range);
        } else if (scope?.mode === "panel" && scope.source === "brain") {
          matches = await retrieve(question, { filterSource: "brain" });
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

        const prompt = buildPrompt(question, matches);
        for await (const piece of chatStream(prompt, systemInstruction, { tools })) {
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
