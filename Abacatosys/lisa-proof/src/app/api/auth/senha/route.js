import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { conferirChave } from "@/lib/auth.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/auth/senha   body: { chaveAtual, hash, sal, iteracoes }
 *
 * Trocar a PRÓPRIA senha (chamado de 20/10/2026: "não consigo alterar minha senha"). A conta é a
 * do Abacato, então a senha nova vale no Proof, no Abacato e na Lisa. Mesmo caminho da rota do
 * Abacato (abacato/src/app/api/conta/senha): o navegador estica a senha atual e a nova, e o
 * servidor nunca vê senha nenhuma — só as chaves.
 *
 * Exige a senha atual: sem isso, um cookie roubado trocaria a senha e trancaria o dono para fora.
 */
export async function PATCH(req) {
  try {
    const usuario = await exigirUsuario(req);
    const { chaveAtual, hash, sal, iteracoes } = (await corpoDe(req)) || {};
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
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
