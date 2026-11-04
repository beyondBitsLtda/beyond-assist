import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { moverCriaVolta } from "@/dominio/documentos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/pastas/:id   body: { nome?, paiId?, arquivada? } */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const { projetoId } = await exigir(req, "pasta", id, "editar");
    const corpo = await req.json().catch(() => ({}));

    const mudancas = {};
    if (typeof corpo.nome === "string" && corpo.nome.trim()) mudancas.nome = corpo.nome.trim();
    if (typeof corpo.arquivada === "boolean") mudancas.arquivada = corpo.arquivada;

    if ("paiId" in corpo) {
      const novoPai = corpo.paiId || null;
      if (novoPai) {
        const { data: pai } = await supabase
          .from("abacato_pastas").select("id, projeto_id").eq("id", novoPai).maybeSingle();
        if (!pai) throw new ErroDeAcesso(404, "pasta de destino não existe");
        if (pai.projeto_id !== projetoId) throw new ErroDeAcesso(403, "essa pasta é de outro projeto");
      }

      // Mover uma pasta para dentro da própria subpasta desliga as duas da árvore: elas passam
      // a ser pai uma da outra, somem da tela e levam os documentos junto. O banco não reclama
      // de nada — por isso a trava tem de estar aqui.
      const { data: todas } = await supabase
        .from("abacato_pastas").select("id, pai_id").eq("projeto_id", projetoId);
      if (moverCriaVolta(id, novoPai, todas || [])) {
        throw new ErroDeAcesso(400, "não dá para mover uma pasta para dentro dela mesma");
      }
      mudancas.pai_id = novoPai;
    }

    if (!Object.keys(mudancas).length) throw new ErroDeAcesso(400, "nada para mudar");

    const { data, error } = await supabase.from("abacato_pastas").update(mudancas).eq("id", id)
      .select("id, pai_id, nome, posicao, arquivada").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, pasta: data });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * DELETE /api/pastas/:id — arquiva a pasta, as subpastas e os documentos dentro.
 *
 * Tudo junto, pelo mesmo motivo da coluna do quadro: um documento cuja pasta sumiu não tem
 * onde aparecer. Ele viraria uma linha viva e invisível, ocupando lugar em toda consulta e em
 * nenhuma tela.
 */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const { projetoId } = await exigir(req, "pasta", id, "apagar");

    const { data: todas } = await supabase
      .from("abacato_pastas").select("id, pai_id").eq("projeto_id", projetoId);

    // A subárvore inteira, descendo nível por nível. O teto protege de uma volta no banco, que
    // travaria a rota num laço sem nenhuma mensagem.
    const paraArquivar = new Set([id]);
    for (let volta = 0; volta < 50; volta++) {
      const antes = paraArquivar.size;
      for (const p of todas || []) if (p.pai_id && paraArquivar.has(p.pai_id)) paraArquivar.add(p.id);
      if (paraArquivar.size === antes) break;
    }

    const ids = [...paraArquivar];
    await supabase.from("abacato_documentos").update({ arquivado: true }).in("pasta_id", ids);
    const { error } = await supabase.from("abacato_pastas").update({ arquivada: true }).in("id", ids);
    if (error) throw new ErroDeAcesso(500, error.message);

    return json({ ok: true, pastas: ids.length });
  } catch (e) {
    return respostaDeErro(e);
  }
}
