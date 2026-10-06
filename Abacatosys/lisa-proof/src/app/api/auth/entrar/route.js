import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { COOKIE_SESSAO, conferirChave, criarSessao } from "@/lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/entrar   body: { email, chave }
 *
 * A conta é a do Abacato (`abacato_usuarios`): o navegador estica a senha com o mesmo cálculo de
 * lá, e aqui só se compara o resultado com o selo guardado. Ver src/lib/auth.js.
 */
export async function POST(req) {
  const segredo = process.env.PROOF_SESSAO_SECRET;
  if (!segredo) return json({ ok: false, error: "PROOF_SESSAO_SECRET não configurada no servidor" }, 500);

  let email, chave;
  try {
    ({ email, chave } = await req.json());
  } catch {
    return json({ ok: false, error: "pedido inválido" }, 400);
  }
  if (!email || !chave) return json({ ok: false, error: "informe e-mail e senha" }, 400);

  let usuario;
  try {
    const { data, error } = await supabase
      .from("abacato_usuarios")
      .select("id, email, nome, senha_hash, senha_sal, ativo, aprovado")
      .ilike("email", String(email).trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    usuario = data;
  } catch (e) {
    // Banco fora do ar (o iMac sem internet) ou servidor sem configuração. Dizer isso é melhor
    // que "senha incorreta", que mandaria a pessoa duvidar de uma senha certa.
    return json({ ok: false, error: `o banco não respondeu: ${e.message}` }, 503);
  }

  // Compara mesmo sem usuário, contra um selo descartável, e responde igual nos dois casos:
  // a diferença diria a um estranho quais e-mails têm conta.
  const guardada = usuario
    ? { hash: usuario.senha_hash, sal: usuario.senha_sal }
    : { hash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", sal: "AAAAAAAAAAAAAAAAAAAAAAA" };
  const confere = await conferirChave(chave, guardada);

  if (!usuario || !usuario.ativo || !confere) {
    return json({ ok: false, error: "e-mail ou senha incorretos" }, 401);
  }
  if (usuario.aprovado === false) {
    return json({ ok: false, error: "sua conta do Abacato ainda está aguardando aprovação" }, 403);
  }

  const cookie = await criarSessao(usuario, segredo);
  return json({ ok: true, usuario: { id: usuario.id, nome: usuario.nome } }, 200, {
    "set-cookie": `${COOKIE_SESSAO}=${cookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`,
  });
}
