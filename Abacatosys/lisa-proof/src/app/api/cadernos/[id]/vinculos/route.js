import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { vinculosDoCaderno, vincular } from "@/lib/vinculos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cadernos/:id/vinculos — a que o caderno (e cada página dele) está ligado. */
export async function GET(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    return json({ ok: true, vinculos: await vinculosDoCaderno(usuario.id, id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/cadernos/:id/vinculos { paginaId?, alvo: { tipo, id, numero? } } */
export async function POST(req, { params }) {
  try {
    const usuario = await exigirUsuario(req);
    const { id } = await params;
    const corpo = await corpoDe(req);
    await vincular(usuario.id, { cadernoId: id, paginaId: corpo?.paginaId || null, alvo: corpo?.alvo });
    return json({ ok: true, vinculos: await vinculosDoCaderno(usuario.id, id) }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
