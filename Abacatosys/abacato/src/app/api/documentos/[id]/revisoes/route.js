import { json } from "@/lib/http.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { guardarRevisao } from "@/lib/documentosNoBanco.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/documentos/:id/revisoes — sobe uma versão nova. Multipart: `arquivo`, `nota?`.
 *
 * A versão anterior NÃO é substituída: ela continua no armazenamento e na lista. É a diferença
 * entre um repositório de documentos e uma pasta compartilhada — "o cliente aprovou qual
 * versão?" só tem resposta se as versões existirem separadas.
 *
 * A nota é opcional e vale muito: "corrigido o valor da parcela 3" responde, três meses
 * depois, a pergunta que o nome do arquivo nunca responde.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { usuario } = await exigir(req, "documento", id, "editar");

    const form = await req.formData().catch(() => null);
    if (!form) throw new ErroDeAcesso(400, "envio inválido");

    const revisao = await guardarRevisao({
      documentoId: id,
      arquivo: form.get("arquivo"),
      nota: (form.get("nota") || "").toString(),
      usuarioId: usuario.id,
    });

    return json({ ok: true, revisao }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
