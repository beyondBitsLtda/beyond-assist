import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { lerRegra } from "@/dominio/recorrencia.js";
import { primeiraOcorrencia } from "@/lib/recorrenciaNoBanco.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/recorrencias/:id   body: { titulo?, descricao?, regra?, ativa? } */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "recorrencia", id, "editar");
    const corpo = await req.json().catch(() => ({}));

    const mudancas = {};
    if (typeof corpo.titulo === "string" && corpo.titulo.trim()) mudancas.titulo = corpo.titulo.trim();
    if ("descricao" in corpo) mudancas.descricao = corpo.descricao?.trim() || null;
    if (typeof corpo.ativa === "boolean") mudancas.ativa = corpo.ativa;

    if ("regra" in corpo) {
      if (!lerRegra(corpo.regra)) throw new ErroDeAcesso(400, "regra de repetição inválida");
      mudancas.regra = String(corpo.regra).trim().toLowerCase();
      // Trocar a regra reinicia o relógio. Manter o `proxima_em` antigo deixaria uma data que
      // a regra nova nem sabe calcular — "todo dia 15" com a próxima marcada para uma terça.
      const proxima = primeiraOcorrencia(mudancas.regra);
      if (!proxima) throw new ErroDeAcesso(400, "essa regra não tem próxima data");
      mudancas.proxima_em = proxima.toISOString();
    }

    if (!Object.keys(mudancas).length) throw new ErroDeAcesso(400, "nada para mudar");

    const { data, error } = await supabase.from("abacato_recorrencias")
      .update(mudancas).eq("id", id)
      .select("id, coluna_id, titulo, descricao, regra, proxima_em, ativa").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, recorrencia: data });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/recorrencias/:id — apaga a REGRA. Os cards que ela já criou ficam: eles são
 *  tarefas de verdade, algumas já feitas, e sumir com o histórico é o oposto do que se quer. */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "recorrencia", id, "apagar");
    const { error } = await supabase.from("abacato_recorrencias").delete().eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
