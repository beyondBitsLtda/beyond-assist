import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { quemEh, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { conferirChave } from "@/lib/abacatoAuth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/conta/senha   body: { chaveAtual, hash, sal, iteracoes }
 *
 * Trocar a PRÓPRIA senha. Continua valendo que o servidor nunca vê senha nenhuma: o navegador
 * estica a atual e a nova, e daqui chegam só as chaves.
 *
 * EXIGIR A SENHA ATUAL não é burocracia. Sem isso, uma sessão roubada — um computador deixado
 * aberto, um cookie copiado — trocaria a senha e trancaria o dono para fora da própria conta,
 * em silêncio. Com a exigência, quem tem só o cookie não consegue: precisaria da senha, que é
 * exatamente o que o cookie não carrega.
 */
export async function PATCH(req) {
  try {
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");

    const { chaveAtual, hash, sal, iteracoes } = await req.json().catch(() => ({}));
    if (!chaveAtual) throw new ErroDeAcesso(400, "informe a senha atual");
    if (!hash || !sal || !iteracoes) throw new ErroDeAcesso(400, "faltou a senha nova");
    if (Number(iteracoes) < 100000) throw new ErroDeAcesso(400, "número de iterações baixo demais");

    const { data } = await supabase
      .from("abacato_usuarios").select("id, senha_hash, senha_sal, ativo").eq("id", usuario.id).maybeSingle();
    if (!data?.ativo) throw new ErroDeAcesso(401, "sua conta não está mais ativa");

    const confere = await conferirChave(chaveAtual, { hash: data.senha_hash, sal: data.senha_sal });
    if (!confere) throw new ErroDeAcesso(403, "a senha atual não está certa");

    const { error } = await supabase.from("abacato_usuarios")
      .update({ senha_hash: hash, senha_sal: sal, senha_iter: Number(iteracoes) })
      .eq("id", usuario.id);
    if (error) throw new ErroDeAcesso(500, error.message);

    // A sessão CONTINUA valendo. Derrubá-la aqui obrigaria a entrar de novo logo depois de
    // trocar a senha, e a pessoa que acabou de provar quem é não precisa provar outra vez.
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
