import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { rodarNoServidor } from "@/lib/execucao.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/rodar  { linguagem, tema, codigo, entrada }
 *
 * Roda o código do exercício num compilador de verdade (C, Python, PHP, Java...) e devolve a
 * saída. JavaScript e SQL não passam por aqui: rodam no navegador.
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    const resultado = await rodarNoServidor({
      usuarioId: usuario.id,
      linguagem: corpo?.linguagem,
      tema: corpo?.tema,
      codigo: corpo?.codigo,
      entrada: corpo?.entrada,
    });
    return json({ ok: true, resultado });
  } catch (e) {
    return respostaDeErro(e);
  }
}
