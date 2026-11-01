import { escreverDocumento } from "@/lib/gemini.js";
import { jsonResponse } from "@/lib/http.js";
import { usarDoDia } from "@/lib/usoDoDia.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/processmap/documento (01/11/2026) — a Lisa escreve um .md para o editor de código a partir
 * dos desenhos do projeto. Nenhum desenho muda.
 *   { pedido (o pedido inteiro da pessoa), foco? (o que ESTE arquivo traz), titulo?, estilo?: "livre" |
 *     "especificacao" | "visao-geral", desenhos?: [{ nome, tipo, descricao }], arquivos?: [{ arquivo, nome,
 *     tipo }] (a visão geral), projeto (os desenhos em texto), nomeDoProjeto, conversa?, contexto? }
 * Devolve { markdown }. Quem chama um por documento e junta no editor: src/lib/trabalhoNoProjeto.js.
 */
const tipoDe = (t) => (t === "mapa mental" ? "mapa mental" : "fluxograma");

export async function POST(req) {
  try {
    // (01/11/2026, o MVP) o usuário tem o limite do dia — as chaves de IA são do admin
    const limite = await usarDoDia(req, "desenho");
    if (limite) return jsonResponse({ ok: false, error: limite.erro, limite: true }, limite.status);
    const body = await req.json();
    const pedido = String(body?.pedido || "").trim();
    if (!pedido) return jsonResponse({ ok: false, error: "diga o que documentar" }, 400);
    const lista = Array.isArray(body?.desenhos) ? body.desenhos : body?.desenho && typeof body.desenho === "object" ? [body.desenho] : [];
    const desenhos = lista.slice(0, 12).filter((d) => d && typeof d === "object").map((d) => ({
      nome: String(d.nome || "Desenho").slice(0, 120), tipo: tipoDe(d.tipo), descricao: String(d.descricao || "").slice(0, 60_000),
    }));
    const arquivos = (Array.isArray(body?.arquivos) ? body.arquivos : []).slice(0, 40).map((a) => ({
      arquivo: String(a?.arquivo || "").slice(0, 160), nome: String(a?.nome || "").slice(0, 120), tipo: tipoDe(a?.tipo),
    }));
    const markdown = await escreverDocumento({
      pedido, desenhos, arquivos,
      foco: String(body?.foco || "").slice(0, 4000),
      titulo: String(body?.titulo || "").slice(0, 120),
      estilo: String(body?.estilo || "livre"),
      projeto: String(body?.projeto || "").slice(0, 40_000),
      nomeDoProjeto: String(body?.nomeDoProjeto || "Projeto").slice(0, 120),
      conversa: String(body?.conversa || ""),
      contexto: String(body?.contexto || "").slice(0, 40_000),
      hoje: new Date().toISOString().slice(0, 10),
    });
    return jsonResponse({ ok: true, markdown });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
