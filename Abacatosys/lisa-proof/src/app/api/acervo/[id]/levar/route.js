import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { levarParaMinhaBiblioteca } from "@/lib/acervo.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/acervo/:id/levar — o livro do acervo na minha biblioteca (o mesmo PDF, com as minhas marcações). */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, ...(await levarParaMinhaBiblioteca(usuario.id, id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
