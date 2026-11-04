import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { listarMarcacoes, criarMarcacao } from "@/lib/biblioteca.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/biblioteca/:id/marcacoes — destaques, sublinhados, áreas, notas e marcadores do livro. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, marcacoes: await listarMarcacoes(usuario.id, id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/biblioteca/:id/marcacoes { pagina, tipo, cor, texto?, nota?, retangulos } */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, marcacao: await criarMarcacao(usuario.id, id, await corpoDe(req)) }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
