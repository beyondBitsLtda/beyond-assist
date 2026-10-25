import { contextoDosRepositorios } from "@/lib/repositorioNaConversa.js";
import { turnosValidos, blocoDaConversa } from "@/lib/conversa.js";
import { imagensValidas } from "@/lib/contextoDaConversa.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/repos/contexto  { repos, question, turnos?, images? }
 *   → { ok, secao, lidos, repos, avisos }
 *
 * A leitura dos repositórios vinculados à conversa, num pedido SÓ DELA (25/10/2026). Antes ela
 * rodava dentro do /api/ask, e as chamadas ao GitHub (a árvore, a IA escolhendo os arquivos, um
 * pedido por arquivo) somavam com as da própria pergunta (banco, memória, Gemini) — e passavam do
 * limite de 50 chamadas de rede por pedido do Worker gratuito ("Too many subrequests"). Separada,
 * cada parte tem o limite inteiro: a tela pede a leitura primeiro e manda a seção pronta na pergunta.
 */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "pedido inválido" }, { status: 400 });
  }
  const question = String(body?.question || "").slice(0, 4000);
  if (!Array.isArray(body?.repos) || !body.repos.length || !question.trim()) {
    return Response.json({ ok: false, error: "faltou o repositório ou a pergunta" }, { status: 400 });
  }
  try {
    const r = await contextoDosRepositorios({
      vinculos: body.repos,
      pergunta: question,
      conversa: blocoDaConversa(turnosValidos(body.turnos)),
      imagens: imagensValidas(body.images),
    });
    return Response.json({ ok: true, secao: r.secao, lidos: r.lidos, repos: r.repos || [], avisos: r.avisos }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || err) }, { status: 502 });
  }
}
