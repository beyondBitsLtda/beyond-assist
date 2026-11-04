import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { estadoDoAcervo, criarMaterial } from "@/lib/acervo.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/acervo — a Biblioteca Colaborativa: níveis, acervo, meus envios, a fila (bibliotecário) e os contribuidores. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await estadoDoAcervo(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/acervo { tipo, titulo, autores, categoria, assunto, descricao, link?, capa?, pdf?: { tamanho, paginas, hash, sumario } }
 * PDF: devolve { material, envio: { url } } (o navegador manda o arquivo e chama /enviado). Link: já entra na fila.
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await criarMaterial(usuario.id, await corpoDe(req))) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
