import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { avancoDaTrilhaDoUsuario } from "@/lib/avanco.js";
import { cadernoDaTrilha, criarEstruturaDoCaderno } from "@/lib/cadernoDaTrilha.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/trilhas/:id/caderno — o caderno do curso desta trilha, se a pessoa já criou (ou null). */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const { trilha } = await avancoDaTrilhaDoUsuario(id, usuario.id);
    return json({ ok: true, caderno: await cadernoDaTrilha(usuario.id, trilha.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/trilhas/:id/caderno — só quando a pessoa pede: a estrutura do caderno do curso, um módulo
 * por semana do plano e uma página por assunto, já ligada à trilha. Se já existe, devolve a que existe.
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const caderno = await criarEstruturaDoCaderno(usuario.id, id);
    return json({ ok: true, caderno }, caderno.nova ? 201 : 200);
  } catch (e) {
    return respostaDeErro(e);
  }
}
