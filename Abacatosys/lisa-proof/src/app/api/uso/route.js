import { json } from "@/lib/http.js";
import { exigirUsuarioReal, respostaDeErro } from "@/lib/sessao.js";
import { usoParaTela } from "@/lib/uso.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/uso?dias=7|30|90 — o painel do uso (só o administrador): acessos, tempo, áreas e ações de cada pessoa. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuarioReal(req);
    const dias = new URL(req.url).searchParams.get("dias");
    return json({ ok: true, ...(await usoParaTela(usuario, dias)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
