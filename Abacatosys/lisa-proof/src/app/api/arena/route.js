import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { arenaDe, conferirNaArena, explicarNaArena } from "@/lib/arena.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/arena — os três jogos da Arena Lúdica, as fases (com o conteúdo) e o progresso da pessoa. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await arenaDe(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/arena
 *   { acao: "conferir", jogo, fase, codigos | codigo | resposta, tempoMs }   o servidor confere e grava a fase
 *   { acao: "explicar", jogo, fase, bug?, codigo, erro }                       a Lisa explica o erro (sem dar a resposta)
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const c = await corpoDe(req);
    if (c.acao === "conferir") return json({ ok: true, ...(await conferirNaArena(usuario.id, c)) });
    if (c.acao === "explicar") return json({ ok: true, ...(await explicarNaArena(usuario.id, c)) });
    throw new ErroDeAcesso(400, "ação desconhecida");
  } catch (e) {
    return respostaDeErro(e);
  }
}
