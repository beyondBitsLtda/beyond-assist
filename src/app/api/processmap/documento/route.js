import { escreverDocumento } from "@/lib/gemini.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/processmap/documento (01/11/2026) — a Lisa escreve um .md a partir de um desenho do projeto
 * (ou a visão geral, sem `desenho`), para o editor de código. Nenhum desenho muda.
 *   { pedido, projeto (os desenhos em texto), nomeDoProjeto, desenho?: { nome, tipo, descricao },
 *     arquivos?: [{ arquivo, nome, tipo }], conversa? }
 * Devolve { markdown }. Quem chama um por desenho e junta no editor: src/lib/trabalhoNoProjeto.js.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const pedido = String(body?.pedido || "").trim();
    if (!pedido) return jsonResponse({ ok: false, error: "diga o que documentar" }, 400);
    const d = body?.desenho;
    const desenho = d && typeof d === "object"
      ? { nome: String(d.nome || "Desenho").slice(0, 120), tipo: d.tipo === "mapa mental" ? "mapa mental" : "fluxograma", descricao: String(d.descricao || "").slice(0, 60_000) }
      : null;
    const arquivos = (Array.isArray(body?.arquivos) ? body.arquivos : []).slice(0, 40).map((a) => ({
      arquivo: String(a?.arquivo || "").slice(0, 160), nome: String(a?.nome || "").slice(0, 120), tipo: a?.tipo === "mapa mental" ? "mapa mental" : "fluxograma",
    }));
    const markdown = await escreverDocumento({
      pedido, desenho, arquivos,
      projeto: String(body?.projeto || "").slice(0, 40_000),
      nomeDoProjeto: String(body?.nomeDoProjeto || "Projeto").slice(0, 120),
      conversa: String(body?.conversa || ""),
      hoje: new Date().toISOString().slice(0, 10),
    });
    return jsonResponse({ ok: true, markdown });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
