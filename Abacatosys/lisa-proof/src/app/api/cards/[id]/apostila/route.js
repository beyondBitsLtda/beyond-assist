import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { cardDeEstudo } from "@/lib/estudo.js";
import { apostilaDoAssunto, gerarApostila } from "@/lib/apostilas.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cards/:id/apostila — a apostila que já existe deste assunto (ou null). Não gasta IA. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    await cardDeEstudo(id, usuario.id);
    return json({ ok: true, apostila: await apostilaDoAssunto(usuario.id, id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/cards/:id/apostila { refazer? } — o modo aula: a Lisa escreve a aula completa do assunto
 * (todos os pontos do checklist de teoria) e grava como apostila. Sem `refazer`, devolve a que já existe.
 */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req).catch(() => ({}));
    const apostila = await gerarApostila(usuario.id, id, { refazer: corpo?.refazer === true });
    return json({ ok: true, apostila }, apostila.nova ? 201 : 200);
  } catch (e) {
    return respostaDeErro(e);
  }
}
