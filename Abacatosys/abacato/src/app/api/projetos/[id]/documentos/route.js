import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { guardarRevisao } from "@/lib/documentosNoBanco.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/projetos/:id/documentos — envia um documento novo.
 *
 * Multipart: `arquivo` obrigatório; `nome`, `pastaId`, `categoria`, `descricao` opcionais.
 * Sem `nome`, usa o nome do arquivo — quem está enviando três contratos não quer digitar o
 * nome de cada um antes.
 *
 * Aceita VÁRIOS arquivos no mesmo campo `arquivo`: cada um vira um documento. Soltar uma pasta
 * inteira na tela é o uso normal de um repositório, e obrigar a um envio por vez é o motivo de
 * os documentos acabarem espalhados em três lugares.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { usuario } = await exigir(req, "projeto", id, "criar");

    const form = await req.formData().catch(() => null);
    if (!form) throw new ErroDeAcesso(400, "envio inválido");

    const arquivos = form.getAll("arquivo").filter((a) => a && typeof a !== "string");
    if (!arquivos.length) throw new ErroDeAcesso(400, "faltou o arquivo");

    const pastaId = form.get("pastaId") || null;
    if (pastaId) {
      const { data: pasta } = await supabase
        .from("abacato_pastas").select("id, projeto_id").eq("id", pastaId).maybeSingle();
      if (!pasta) throw new ErroDeAcesso(404, "pasta não existe");
      if (pasta.projeto_id !== id) throw new ErroDeAcesso(403, "essa pasta é de outro projeto");
    }

    const categoria = (form.get("categoria") || "").toString().trim() || null;
    const descricao = (form.get("descricao") || "").toString().trim() || null;
    const nomeDado = (form.get("nome") || "").toString().trim();

    const criados = [];
    const falharam = [];

    for (const arquivo of arquivos) {
      try {
        const { data: documento, error } = await supabase.from("abacato_documentos").insert({
          projeto_id: id,
          pasta_id: pastaId,
          // O nome digitado só vale quando é UM arquivo. Com vários, ele viraria três
          // documentos com o mesmo nome, e ninguém saberia qual é qual.
          nome: (arquivos.length === 1 && nomeDado) || arquivo.name || "documento",
          categoria,
          descricao: arquivos.length === 1 ? descricao : null,
          criado_por: usuario.id,
        }).select("id, nome, categoria, pasta_id, criado_em").single();
        if (error) throw new ErroDeAcesso(500, error.message);

        const revisao = await guardarRevisao({
          documentoId: documento.id,
          arquivo,
          nota: "versão inicial",
          usuarioId: usuario.id,
        });

        criados.push({ ...documento, revisao, revisoes: 1 });
      } catch (e) {
        // Um arquivo ruim no meio de dez não pode derrubar os outros nove. O que falhou é
        // relatado com o nome, para dar para tentar de novo só ele.
        falharam.push({ nome: arquivo?.name || "(sem nome)", erro: String(e?.message || e).slice(0, 160) });

        // A linha do documento pode ter entrado antes de o arquivo falhar. Um documento sem
        // nenhuma revisão é um documento que nunca abre — tira da frente.
        await supabase.from("abacato_documentos")
          .delete().eq("projeto_id", id).is("revisao_atual_id", null)
          .eq("nome", arquivo?.name || "documento");
      }
    }

    if (!criados.length) {
      throw new ErroDeAcesso(400, `nenhum arquivo entrou. ${falharam[0]?.erro || ""}`);
    }

    await supabase.from("abacato_projetos")
      .update({ atualizado_em: new Date().toISOString() }).eq("id", id);

    return json({ ok: true, documentos: criados, falharam }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
