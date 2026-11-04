import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigir, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { carregarProjeto } from "@/lib/documentosNoBanco.js";
import { corValida } from "@/dominio/cores.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/projetos/:id — o projeto inteiro: pastas, documentos e a revisão atual de cada um. */
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { papel, poderes, usuario } = await exigir(req, "projeto", id, "ver");
    const dados = await carregarProjeto(id);
    return json({ ok: true, ...dados, papel, poderes, eu: { id: usuario.id, nome: usuario.nome } });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** PATCH /api/projetos/:id   body: { nome?, descricao?, cor?, arquivado? } */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    await exigir(req, "projeto", id, "editar");
    const corpo = await req.json().catch(() => ({}));

    const mudancas = {};
    if (typeof corpo.nome === "string" && corpo.nome.trim()) mudancas.nome = corpo.nome.trim();
    if ("descricao" in corpo) mudancas.descricao = corpo.descricao?.trim() || null;
    if ("cor" in corpo) {
      if (!corValida(corpo.cor)) throw new ErroDeAcesso(400, "cor fora da paleta");
      mudancas.cor = corpo.cor;
    }
    if (typeof corpo.arquivado === "boolean") mudancas.arquivado = corpo.arquivado;
    if (!Object.keys(mudancas).length) throw new ErroDeAcesso(400, "nada para mudar");

    mudancas.atualizado_em = new Date().toISOString();
    const { data, error } = await supabase.from("abacato_projetos").update(mudancas).eq("id", id)
      .select("id, nome, descricao, cor, arquivado").single();
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true, projeto: data });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * DELETE /api/projetos/:id — arquiva, e só o dono.
 *
 * Arquiva, não apaga: o `on delete cascade` levaria junto as pastas, os documentos, as
 * revisões e — o que não tem volta — os arquivos ficariam órfãos no armazenamento, sem
 * nenhuma linha dizendo a quem pertenciam. Apagar de verdade pede uma tela de lixeira, onde a
 * pessoa vê o que vai perder antes de perder.
 */
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const { papel } = await exigir(req, "projeto", id, "apagar");
    if (papel !== "dono") throw new ErroDeAcesso(403, "só o dono arquiva o projeto");
    const { error } = await supabase.from("abacato_projetos").update({ arquivado: true }).eq("id", id);
    if (error) throw new ErroDeAcesso(500, error.message);
    return json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
