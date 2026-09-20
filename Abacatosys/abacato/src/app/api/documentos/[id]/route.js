import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/documentos/:id — o documento com TODAS as revisões, da mais nova para a mais antiga. */
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { poderes } = await exigir(req, "documento", id, "ver");

    const { data: documento, error } = await supabase
      .from("abacato_documentos")
      .select("id, projeto_id, pasta_id, nome, categoria, descricao, revisao_atual_id, criado_em, atualizado_em, origem")
      .eq("id", id).maybeSingle();
    if (error) throw new ErroDeAcesso(500, error.message);
    if (!documento) throw new ErroDeAcesso(404, "documento não encontrado");

    const { data: revisoes } = await supabase
      .from("abacato_revisoes")
      .select("id, numero, tipo, tamanho, nota, criado_em, criado_por, abacato_usuarios ( nome )")
      .eq("documento_id", id).order("numero", { ascending: false });

    return json({
      ok: true,
      documento,
      poderes,
      revisoes: (revisoes || []).map((r) => ({
        id: r.id, numero: r.numero, tipo: r.tipo, tamanho: r.tamanho, nota: r.nota,
        criadoEm: r.criado_em, quem: r.abacato_usuarios?.nome || null,
        atual: r.id === documento.revisao_atual_id,
      })),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** PATCH /api/documentos/:id   body: { nome?, categoria?, descricao?, pastaId?, revisaoAtualId?, arquivado? } */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const { projetoId } = await exigir(req, "documento", id, "editar");
    const corpo = await req.json().catch(() => ({}));

    const mudancas = {};
    if (typeof corpo.nome === "string" && corpo.nome.trim()) mudancas.nome = corpo.nome.trim();
    if ("categoria" in corpo) mudancas.categoria = corpo.categoria?.trim() || null;
    if ("descricao" in corpo) mudancas.descricao = corpo.descricao?.trim() || null;
    if (typeof corpo.arquivado === "boolean") mudancas.arquivado = corpo.arquivado;

    if ("pastaId" in corpo) {
      const destino = corpo.pastaId || null;
      if (destino) {
        const { data: pasta } = await supabase
          .from("abacato_pastas").select("id, projeto_id").eq("id", destino).maybeSingle();
        if (!pasta) throw new ErroDeAcesso(404, "pasta de destino não existe");
        if (pasta.projeto_id !== projetoId) throw new ErroDeAcesso(403, "essa pasta é de outro projeto");
      }
      mudancas.pasta_id = destino;
    }

    // Voltar a uma revisão antiga é só apontar para ela — nada é apagado, e dá para voltar de
    // novo. Foi por isso que as revisões nasceram numa tabela em vez de sobrescrever o arquivo.
    if (corpo.revisaoAtualId) {
      const { data: revisao } = await supabase
        .from("abacato_revisoes").select("id, documento_id").eq("id", corpo.revisaoAtualId).maybeSingle();
      if (!revisao || revisao.documento_id !== id) {
        throw new ErroDeAcesso(400, "essa revisão não é deste documento");
      }
      mudancas.revisao_atual_id = corpo.revisaoAtualId;
    }

    if (!Object.keys(mudancas).length) throw new ErroDeAcesso(400, "nada para mudar");

    mudancas.atualizado_em = new Date().toISOString();
    const { data, error } = await supabase.from("abacato_documentos").update(mudancas).eq("id", id)
      .select("id, pasta_id, nome, categoria, descricao, revisao_atual_id, arquivado").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, documento: data });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** DELETE /api/documentos/:id — arquiva. O arquivo continua no armazenamento: uma tela de
 *  lixeira precisa poder trazê-lo de volta, e "apaguei sem querer" é o caso mais comum de
 *  todos num repositório de documentos. */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "documento", id, "apagar");
    const { error } = await supabase.from("abacato_documentos").update({ arquivado: true }).eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
