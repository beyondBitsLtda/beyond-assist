import { planejarNoProjeto } from "@/lib/gemini.js";
import { validarPlano, pedeEmTodos, faltandoNoPlano, completarPlano } from "@/lib/processmapNaConversa.js";
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
    const base = {
      pedido, fluxos,
      projeto: String(body?.projeto || "").slice(0, 30_000),
      aberto: String(body?.aberto || ""),
      conversa: String(body?.conversa || ""),
    };
    let plano = validarPlano(await planejarNoProjeto(base), fluxos);
    // "em todos os fluxogramas": o desenho que o plano esqueceu (o modelo deixava os mapas mentais de
    // fora) ganha uma segunda volta, só para os que faltaram
    const faltando = plano.acao === "mudar" && pedeEmTodos(pedido) ? faltandoNoPlano(plano, fluxos) : [];
    if (faltando.length) {
      const extra = validarPlano(await planejarNoProjeto({
        ...base,
        complemento: `o plano anterior deixou estes desenhos de fora: ${faltando.map((f) => `"${f.nome}" (id "${f.id}")`).join(", ")}. O pedido vale para TODOS os desenhos do projeto (mapas mentais também). Devolva "mudar" com uma operação para CADA um destes, e só para eles, cumprindo a parte do pedido que vale para todos.`,
      }), fluxos);
      plano = completarPlano(plano, extra, faltando);
    }
    return jsonResponse({ ok: true, plano, segundaVolta: faltando.length > 0 });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
