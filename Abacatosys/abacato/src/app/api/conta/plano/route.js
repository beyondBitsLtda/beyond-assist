import { json } from "@/lib/http.js";
import { quemEh, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { usoDe } from "@/lib/limites.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/conta/plano — quanto a minha conta já usou, e de quanto ela dispõe.
 *
 * Existe porque um limite invisível não é um limite, é uma surpresa. A pessoa deve poder ver
 * "7 de 10 quadros" ANTES de tentar criar o décimo primeiro e levar um "não" no meio de um
 * trabalho.
 *
 * Sempre sobre QUEM PEDE, nunca sobre outra pessoa: não há parâmetro de usuário nesta rota. O
 * uso de fulano é informação de fulano, e quem administra vê pelo painel de administração, que
 * exige ser administrador.
 */
export async function GET(req) {
  try {
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");

    const uso = await usoDe(usuario.id);
    if (!uso) throw new ErroDeAcesso(404, "conta não encontrada");

    return json({ ok: true, uso });
  } catch (e) {
    return respostaDeErro(e);
  }
}
