import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { listarLivros, criarLivro } from "@/lib/biblioteca.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/biblioteca — a estante e o espaço usado. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await listarLivros(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/biblioteca { titulo, autor?, tamanho, paginas, sumario?, capa? } — o navegador já leu o
 * PDF; aqui o livro nasce e volta o endereço assinado para o arquivo ir direto ao armazenamento.
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await criarLivro(usuario.id, await corpoDe(req))) }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
