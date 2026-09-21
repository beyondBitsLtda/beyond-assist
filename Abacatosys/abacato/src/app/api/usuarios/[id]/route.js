import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { exigirAdmin } from "@/lib/admin.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/usuarios/:id   body: { nome?, ativo?, admin?, hash?, sal?, iteracoes? }
 *
 * Duas coisas que esta rota se recusa a fazer, e as duas são a mesma preocupação: um sistema
 * que fica sem ninguém para administrá-lo não tem conserto pela tela.
 *
 *   NINGUÉM SE DESLIGA. Desativar a própria conta é sair pela porta e trancá-la por fora.
 *
 *   O ÚLTIMO ADMINISTRADOR NÃO SAI. Tirar o próprio sinalizador de administrador, sendo o
 *   único, deixaria o Abacato sem ninguém capaz de criar contas — e voltar disso exigiria o
 *   terminal do servidor.
 */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const admin = await exigirAdmin(req);
    const corpo = await req.json().catch(() => ({}));

    const { data: alvo } = await supabase
      .from("abacato_usuarios").select("id, nome, email, ativo, admin, lisa").eq("id", id).maybeSingle();
    if (!alvo) throw new ErroDeAcesso(404, "pessoa não encontrada");

    const mudancas = {};
    if (typeof corpo.nome === "string" && corpo.nome.trim()) mudancas.nome = corpo.nome.trim();

    if (typeof corpo.ativo === "boolean") {
      if (id === admin.id && corpo.ativo === false) {
        throw new ErroDeAcesso(400, "você não pode desativar a própria conta");
      }
      mudancas.ativo = corpo.ativo;
    }

    if (typeof corpo.admin === "boolean" && corpo.admin !== alvo.admin) {
      if (!corpo.admin) {
        const { count } = await supabase
          .from("abacato_usuarios").select("id", { count: "exact", head: true })
          .eq("admin", true).eq("ativo", true);
        if ((count || 0) <= 1) {
          throw new ErroDeAcesso(400, "este é o único administrador — promova outra pessoa antes");
        }
      }
      mudancas.admin = corpo.admin;
    }

    // Liberar ou tirar a assistente. Não tem trava de "última pessoa" como o sinalizador de
    // administrador: um Abacato sem ninguém usando a Lisa continua sendo um Abacato inteiro.
    if (typeof corpo.lisa === "boolean") mudancas.lisa = corpo.lisa;

    // Trocar a senha de outra pessoa: o selo vem pronto do navegador de quem administra, que
    // sorteou a senha e a mostrou na tela uma vez. O servidor continua sem ver senha nenhuma.
    if (corpo.hash && corpo.sal && corpo.iteracoes) {
      if (Number(corpo.iteracoes) < 100000) throw new ErroDeAcesso(400, "número de iterações baixo demais");
      mudancas.senha_hash = corpo.hash;
      mudancas.senha_sal = corpo.sal;
      mudancas.senha_iter = Number(corpo.iteracoes);
    }

    if (!Object.keys(mudancas).length) throw new ErroDeAcesso(400, "nada para mudar");

    const { data, error } = await supabase.from("abacato_usuarios").update(mudancas).eq("id", id)
      .select("id, nome, email, ativo, admin, lisa").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    return json({ ok: true, usuario: data });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * DELETE /api/usuarios/:id — DESATIVA. Não apaga.
 *
 * Apagar levaria junto, pelo `on delete cascade`, os quadros de que a pessoa é dona, com todas
 * as colunas, cards e checklists dentro. Alguém que sai da empresa não deveria levar o
 * histórico do trabalho junto — e nada na tela avisaria que isso ia acontecer.
 */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const admin = await exigirAdmin(req);
    if (id === admin.id) throw new ErroDeAcesso(400, "você não pode desativar a própria conta");

    const { error } = await supabase.from("abacato_usuarios").update({ ativo: false }).eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
