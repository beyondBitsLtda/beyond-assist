import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso, tocarQuadro } from "@/lib/acesso.js";
import { posicaoEntre } from "@/dominio/Quadro.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/colunas/:id/cards   body: { titulo, noTopo? }
 *
 * Nasce só com título. Prazo, etiqueta, responsável e checklist vêm depois, no painel do card:
 * quem está anotando uma tarefa no meio de uma reunião não vai parar para preencher formulário,
 * e um formulário longo aqui seria o motivo de as tarefas não serem anotadas.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { quadroId } = await exigir(req, "coluna", id, "criar");
    const { titulo, noTopo } = await req.json().catch(() => ({}));
    if (!titulo?.trim()) throw new ErroDeAcesso(400, "o card precisa de um título");

    const { data: vizinho } = await supabase
      .from("abacato_cards").select("posicao").eq("coluna_id", id).eq("arquivado", false)
      .order("posicao", { ascending: Boolean(noTopo) }).limit(1).maybeSingle();

    const posicao = noTopo
      ? posicaoEntre(null, vizinho?.posicao ?? null)
      : posicaoEntre(vizinho?.posicao ?? null, null);

    const { data, error } = await supabase.from("abacato_cards")
      .insert({ coluna_id: id, titulo: titulo.trim(), posicao })
      .select("id, coluna_id, titulo, descricao, posicao, inicio_em, fim_em, capa").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    await tocarQuadro(quadroId);
    return json({
      ok: true,
      card: {
        id: data.id, colunaId: data.coluna_id, titulo: data.titulo, descricao: data.descricao,
        posicao: data.posicao, inicioEm: data.inicio_em, fimEm: data.fim_em, capa: data.capa,
        concluido: false,
        etiquetas: [], responsaveis: [], checklists: [], links: [],
      },
    }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
