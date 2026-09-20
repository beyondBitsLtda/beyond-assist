import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { lerRegra } from "@/dominio/recorrencia.js";
import { primeiraOcorrencia } from "@/lib/recorrenciaNoBanco.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/quadros/:id/recorrencias — as tarefas que se repetem neste quadro. */
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "quadro", id, "ver");

    const { data: colunas } = await supabase
      .from("abacato_colunas").select("id, nome").eq("quadro_id", id).eq("arquivada", false);
    const ids = (colunas || []).map((c) => c.id);
    if (!ids.length) return json({ ok: true, recorrencias: [] });

    const { data } = await supabase.from("abacato_recorrencias")
      .select("id, coluna_id, titulo, descricao, regra, proxima_em, ativa")
      .in("coluna_id", ids).order("proxima_em");

    return json({ ok: true, recorrencias: data || [] });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/quadros/:id/recorrencias   body: { colunaId, titulo, descricao?, regra } */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "quadro", id, "criar");
    const { colunaId, titulo, descricao, regra } = await req.json().catch(() => ({}));

    if (!titulo?.trim()) throw new ErroDeAcesso(400, "a tarefa precisa de um título");
    // A regra é validada ANTES de ser gravada. Uma regra inválida no banco vira uma tarefa que
    // nunca aparece — o pior defeito possível aqui, porque parece que está tudo certo.
    if (!lerRegra(regra)) throw new ErroDeAcesso(400, "regra de repetição inválida");

    const { data: coluna } = await supabase
      .from("abacato_colunas").select("id, quadro_id").eq("id", colunaId).maybeSingle();
    if (!coluna || coluna.quadro_id !== id) throw new ErroDeAcesso(400, "essa coluna é de outro quadro");

    const proxima = primeiraOcorrencia(regra);
    if (!proxima) throw new ErroDeAcesso(400, "essa regra não tem próxima data");

    const { data, error } = await supabase.from("abacato_recorrencias").insert({
      coluna_id: coluna.id,
      titulo: titulo.trim(),
      descricao: descricao?.trim() || null,
      regra: String(regra).trim().toLowerCase(),
      proxima_em: proxima.toISOString(),
    }).select("id, coluna_id, titulo, descricao, regra, proxima_em, ativa").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    return json({ ok: true, recorrencia: data }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
