import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { listarDominios, analisarDominio, analisarTemaDominio } from "@/lib/dominio.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dominio — as torres da pessoa. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, torres: await listarDominios(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/dominio { repo }                 — a Lisa lê o repositório e diz se ele dá uma torre
 * POST /api/dominio { tema, perfil, ponto }  — a torre de um TEMA (música, idiomas, matemática, livre)
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    if (typeof corpo?.tema === "string") return json({ ok: true, ...(await analisarTemaDominio(usuario.id, corpo)) });
    return json({ ok: true, ...(await analisarDominio(usuario.id, corpo?.repo)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
