import { desenharDiagrama } from "@/lib/gemini.js";
import { validarDesenho, montarDocumento, estruturaDoDocumento, documentoValido } from "@/lib/diagramaDaLisa.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/diagrama (31/10/2026, BEYOND-0010) — a Lisa desenha um processo no quadro.
 *   { pedido, atual?, conversa? }
 *   `atual`: o documento que está na tela (o JSON do quadro), quando o pedido é MUDAR o desenho — a
 *   Lisa parte dele, mantém os ids do que continua, e o que a pessoa arrumou fica no lugar.
 * Devolve { doc, titulo, colecao, explicacao }: o documento pronto para o quadro abrir.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const pedido = String(body?.pedido || "").trim();
    if (!pedido) return jsonResponse({ ok: false, error: "diga o que desenhar" }, 400);
    const atual = body?.atual ? documentoValido(body.atual) : null;
    if (body?.atual && !atual) return jsonResponse({ ok: false, error: "o desenho da tela veio grande demais ou estragado" }, 400);
    const estrutura = atual ? estruturaDoDocumento(atual) : null;
    const bruto = await desenharDiagrama({ pedido, estrutura, conversa: String(body?.conversa || "") });
    const desenho = validarDesenho(bruto);
    return jsonResponse({ ok: true, doc: montarDocumento(desenho, atual), titulo: desenho.titulo, colecao: desenho.colecao, explicacao: desenho.explicacao });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
