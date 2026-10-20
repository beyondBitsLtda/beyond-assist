import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, ErroDeAcesso } from "@/lib/sessao.js";
import { conferirChamado } from "@/dominio/chamado.js";
import { abrirChamado } from "@/lib/chamados.js";
import gito from "../../../../gito.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A versão que está no ar (a do gito.json, que o build embute), para o chamado dizer em qual
// versão o problema aconteceu. PROOF_VERSAO sobrepõe, para teste local.
const VERSAO = process.env.PROOF_VERSAO || gito.versao || "";

/**
 * POST /api/chamados — "Reportar problema". Corpo multipart: `texto` (o relato), `pagina` (o
 * caminho da tela), `contexto` (JSON com navegador, tamanho da janela, tema) e `imagem` (o
 * print, opcional). Vira um card no quadro de chamados do administrador, no Abacato.
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const form = await req.formData().catch(() => null);
    if (!form) throw new ErroDeAcesso(400, "envio inválido");

    const arquivo = form.get("imagem");
    const imagem = arquivo && typeof arquivo !== "string" && arquivo.size > 0 ? arquivo : null;
    let contexto = {};
    try { contexto = JSON.parse(String(form.get("contexto") || "{}")); } catch { /* contexto é opcional */ }

    const conferido = conferirChamado({
      texto: form.get("texto"),
      pagina: form.get("pagina"),
      contexto,
      imagem: imagem ? { tipo: imagem.type, tamanho: imagem.size } : null,
    });
    if (!conferido.ok) throw new ErroDeAcesso(400, conferido.erro);

    const { cardId } = await abrirChamado({ usuario, conferido, imagem, versao: VERSAO });
    return json({ ok: true, chamado: cardId }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
