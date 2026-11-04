import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE = 300;

/**
 * GET /api/quadros/:id/cards-arquivados — os cards que saíram do quadro.
 *
 * Arquivar um card (o "excluir" da tela e da Lisa) sempre foi só marcar `arquivado`: o card fica
 * no banco, inteiro. Mas não havia tela para vê-lo de novo — "dá para recuperar" era verdade só
 * para quem abrisse o banco. Esta lista é o caminho de volta; restaurar é o PATCH de sempre
 * (`arquivado: false`), que a rota do card já aceitava.
 *
 * Ficam de fora as cópias que a recorrência guarda (`origem = 'ciclo'`): cada vez que uma tarefa
 * que se repete é concluída, uma cópia arquivada registra o ciclo que acabou. Elas são histórico,
 * não cards perdidos — restaurar uma duplicaria a tarefa no quadro.
 *
 * Vem com o nome da coluna e se ela também está arquivada: um card restaurado numa coluna
 * arquivada continuaria invisível, e a tela precisa saber disso para levá-lo a outra.
 */
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "quadro", id, "ver");

    const { data: colunas, error: e1 } = await supabase
      .from("abacato_colunas").select("id, nome, arquivada, posicao").eq("quadro_id", id).order("posicao");
    if (e1) throw new ErroDeAcesso(500, e1.message);
    if (!colunas?.length) return json({ ok: true, cards: [], total: 0 });
    const porId = new Map(colunas.map((c) => [c.id, c]));

    // ?q= procura pelo título no banco — com mais de LIMITE arquivados (quadros vindos do Trello),
    // procurar só no que já veio para a tela não acharia os mais antigos.
    const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 100);
    let consulta = supabase
      .from("abacato_cards")
      .select("id, coluna_id, titulo, descricao, fim_em, concluido, criado_em, origem", { count: "exact" })
      .in("coluna_id", colunas.map((c) => c.id))
      .eq("arquivado", true)
      .or("origem.is.null,origem.neq.ciclo");
    if (q) consulta = consulta.ilike("titulo", `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    const { data: cards, error: e2, count } = await consulta
      .order("criado_em", { ascending: false })
      .limit(LIMITE);
    if (e2) throw new ErroDeAcesso(500, e2.message);

    return json({
      ok: true,
      total: count ?? cards.length,
      limite: LIMITE,
      colunasAtivas: colunas.filter((c) => !c.arquivada).map((c) => ({ id: c.id, nome: c.nome })),
      cards: (cards || []).map((c) => ({
        id: c.id,
        titulo: c.titulo,
        descricao: c.descricao ? String(c.descricao).slice(0, 220) : "",
        fimEm: c.fim_em,
        concluido: c.concluido,
        criadoEm: c.criado_em,
        colunaId: c.coluna_id,
        coluna: porId.get(c.coluna_id)?.nome || "",
        colunaArquivada: !!porId.get(c.coluna_id)?.arquivada,
      })),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
