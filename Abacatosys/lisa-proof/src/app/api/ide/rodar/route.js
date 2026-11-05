import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { rodarNaIde } from "@/lib/execucao.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ide/rodar  { compilador, chave, codigo, arquivos: [{ file, code }], opcoes, argumentos, entrada }
 *
 * A IDE livre roda no compilador on-line (Wandbox) o que não roda no navegador (C, C++, Java, Go, Rust, Lua...),
 * com os outros arquivos do projeto junto. JavaScript, Python e SQL não passam por aqui: rodam no navegador.
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const c = await corpoDe(req);
    const resultado = await rodarNaIde({
      usuarioId: usuario.id, compilador: c?.compilador, chave: c?.chave, codigo: c?.codigo,
      arquivos: c?.arquivos, opcoes: c?.opcoes, argumentos: c?.argumentos, entrada: c?.entrada,
    });
    return json({ ok: true, resultado });
  } catch (e) {
    return respostaDeErro(e);
  }
}
