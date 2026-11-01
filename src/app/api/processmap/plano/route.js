import { planejarNoProjeto } from "@/lib/gemini.js";
import { validarPlano } from "@/lib/processmapNaConversa.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/processmap/plano (01/11/2026) — a Lisa planeja um pedido feito sobre um projeto do ProcessMap.
 *   { pedido, projeto (os desenhos em texto), fluxos: [{ id, nome, modo, formas }], aberto?, conversa? }
 * Devolve { plano: { acao: "mudar" | "responder", explicacao, operacoes: [{ fluxo, nome, tipo, pedido }] } }.
 * Quem executa as operações (uma por desenho, por /api/diagrama) e salva é a página do Assistente.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const pedido = String(body?.pedido || "").trim();
    if (!pedido) return jsonResponse({ ok: false, error: "diga o que fazer no projeto" }, 400);
    const fluxos = (Array.isArray(body?.fluxos) ? body.fluxos : []).slice(0, 40).map((f) => ({
      id: String(f?.id || ""), nome: String(f?.nome || "").slice(0, 120), modo: f?.modo === "mindmap" ? "mindmap" : "diagram", formas: Number(f?.formas) || 0,
    })).filter((f) => f.id);
    const bruto = await planejarNoProjeto({
      pedido, fluxos,
      projeto: String(body?.projeto || "").slice(0, 30_000),
      aberto: String(body?.aberto || ""),
      conversa: String(body?.conversa || ""),
    });
    return jsonResponse({ ok: true, plano: validarPlano(bruto, fluxos) });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
