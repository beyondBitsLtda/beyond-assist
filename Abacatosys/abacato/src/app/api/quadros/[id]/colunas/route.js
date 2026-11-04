import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso, tocarQuadro } from "@/lib/acesso.js";
import { posicaoEntre } from "@/dominio/Quadro.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/quadros/:id/colunas?arquivadas=1 — as colunas que saíram de vista.
 *
 * Existe porque arquivar uma coluna leva os cards dela junto, e sem esta lista eles ficariam
 * vivos no banco e invisíveis para sempre. Na migração do Trello isso apareceu de um jeito
 * concreto: 55 cards estavam em listas que tinham sido arquivadas lá, e sumiram da conta sem
 * nenhum caminho de volta pela tela.
 *
 * Vem com a contagem de cards de cada uma: "Ideias 2024 (12 cards)" é a informação que decide
 * se vale restaurar, e "Ideias 2024" sozinho não é.
 */
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "quadro", id, "ver");

    const { data: colunas, error } = await supabase
      .from("abacato_colunas").select("id, nome, posicao, capa")
      .eq("quadro_id", id).eq("arquivada", true).order("posicao");
    if (error) throw new ErroDeAcesso(500, error.message);
    if (!colunas?.length) return json({ ok: true, colunas: [] });

    const { data: cards } = await supabase
      .from("abacato_cards").select("coluna_id, arquivado")
      .in("coluna_id", colunas.map((c) => c.id));

    const conta = new Map();
    for (const c of cards || []) {
      const atual = conta.get(c.coluna_id) || { vivos: 0, arquivados: 0 };
      if (c.arquivado) atual.arquivados++; else atual.vivos++;
      conta.set(c.coluna_id, atual);
    }

    return json({
      ok: true,
      colunas: colunas.map((c) => ({ ...c, ...(conta.get(c.id) || { vivos: 0, arquivados: 0 }) })),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/quadros/:id/colunas   body: { nome } — acrescenta uma coluna no fim. */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "quadro", id, "criar");
    const { nome } = await req.json().catch(() => ({}));
    if (!nome?.trim()) throw new ErroDeAcesso(400, "a coluna precisa de um nome");

    const { data: ultima } = await supabase
      .from("abacato_colunas").select("posicao").eq("quadro_id", id).eq("arquivada", false)
      .order("posicao", { ascending: false }).limit(1).maybeSingle();

    const { data, error } = await supabase.from("abacato_colunas")
      .insert({ quadro_id: id, nome: nome.trim(), posicao: posicaoEntre(ultima?.posicao ?? null, null) })
      .select("id, nome, posicao, capa").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    await tocarQuadro(id);
    return json({ ok: true, coluna: { ...data, cards: [] } }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
