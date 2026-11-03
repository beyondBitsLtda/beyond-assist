import { planejarNoProjeto } from "@/lib/gemini.js";
import { validarPlano, pedeEmTodos, faltandoNoPlano, completarPlano, pedeDocumentacao, ajustarAoPedido, tipoDitoNoPlano, planoDeDesenhoNovo } from "@/lib/processmapNaConversa.js";
import { imagensValidas } from "@/lib/contextoDaConversa.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/processmap/plano (01/11/2026) — a Lisa planeja um pedido feito sobre um projeto do ProcessMap.
 *   { pedido, projeto (os desenhos em texto), fluxos: [{ id, nome, modo, formas }], aberto?, conversa? }
 * Devolve { plano: { acao: "mudar" | "responder" | "documentar", explicacao, operacoes: [{ fluxo, nome,
 * tipo, pedido }], documentos: [{ arquivo, titulo, desenhos, novos, pedido, estilo }] } }.
 * As operações (desenhos) são feitas por /api/diagrama; os documentos (.md no editor), por
 * /api/processmap/documento — um pedido pode ter os dois ("faça um fluxograma da arquitetura … e um md").
 * Num pedido de documento, ajustarAoPedido tira as mudanças de desenho que o pedido não mandou fazer.
 * (02/11/2026) `imagens`: a tela e os prints (o conteúdo do pedido pode estar neles); `confirmado`: a
 * pessoa já disse "sim" ao que a Lisa entendeu na conversa — o plano não volta como "responder". E o
 * tipo dito no pedido ("faça um BPMN…") vale para o desenho novo (tipoDitoNoPlano).
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const pedido = String(body?.pedido || "").trim();
    if (!pedido) return jsonResponse({ ok: false, error: "diga o que fazer no projeto" }, 400);
    const fluxos = (Array.isArray(body?.fluxos) ? body.fluxos : []).slice(0, 40).map((f) => ({
      id: String(f?.id || ""), nome: String(f?.nome || "").slice(0, 120), modo: f?.modo === "mindmap" ? "mindmap" : "diagram", formas: Number(f?.formas) || 0,
    })).filter((f) => f.id);
    const confirmado = body?.confirmado === true;
    const base = {
      pedido, fluxos,
      projeto: String(body?.projeto || "").slice(0, 30_000),
      aberto: String(body?.aberto || ""),
      conversa: String(body?.conversa || ""),
      imagens: imagensValidas(body?.imagens).filter((i) => i.origem !== "camera").slice(0, 6),
      confirmado,
    };
    let plano;
    try {
      plano = validarPlano(await planejarNoProjeto(base), fluxos);
    } catch (err) {
      // sem o modelo, um pedido de documento ainda sai (os documentos, sem mudar desenho nenhum)
      if (!pedeDocumentacao(pedido)) throw err;
      plano = validarPlano({ acao: "documentar", explicacao: "" }, fluxos);
    }
    plano = ajustarAoPedido(plano, pedido, fluxos);
    // já confirmado e o modelo ainda leu como pergunta: um desenho novo com o pedido inteiro
    if (confirmado && plano.acao === "responder") plano = planoDeDesenhoNovo(pedido);
    plano = tipoDitoNoPlano(plano, pedido);
    // "em todos os fluxogramas": o desenho que o plano esqueceu (o modelo deixava os mapas mentais de
    // fora) ganha uma segunda volta, só para os que faltaram
    const faltando = plano.acao === "mudar" && pedeEmTodos(pedido) && !pedeDocumentacao(pedido) ? faltandoNoPlano(plano, fluxos) : [];
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
