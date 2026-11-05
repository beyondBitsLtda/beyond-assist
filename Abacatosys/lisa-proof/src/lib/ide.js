// A IDE livre, a parte do servidor (05/11/2026): os projetos de código de cada pessoa, guardados na conta
// (db/037-ide.sql). As regras (nomes, caminhos, limites, modelos) moram em src/dominio/ide.js.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { IDE, conferirProjeto, projetoDoModelo, MODELOS_DE_PROJETO } from "@/dominio/ide.js";

const falhou = (error, onde) => { if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`); };
const uuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));
const CAMPOS = "id, nome, arquivos, pastas, principal, versao, criado_em, atualizado_em";

const paraTela = (p) => ({ id: p.id, nome: p.nome, arquivos: p.arquivos || {}, pastas: p.pastas || [], principal: p.principal || "", versao: p.versao, atualizadoEm: p.atualizado_em });

/** Os projetos da pessoa, do mais recente ao mais antigo (sem os arquivos: a lista é leve). */
export async function projetosDe(usuarioId) {
  const { data, error } = await supabase.from("proof_ide_projetos").select("id, nome, principal, atualizado_em, arquivos").eq("usuario_id", usuarioId).order("atualizado_em", { ascending: false }).limit(IDE.maxProjetos);
  falhou(error, "projetos");
  return (data || []).map((p) => ({ id: p.id, nome: p.nome, principal: p.principal, atualizadoEm: p.atualizado_em, arquivos: Object.keys(p.arquivos || {}).length }));
}

export async function projetoDe(usuarioId, id) {
  if (!uuid(id)) throw new ErroDeAcesso(400, "projeto inválido");
  const { data, error } = await supabase.from("proof_ide_projetos").select(CAMPOS).eq("id", id).eq("usuario_id", usuarioId).maybeSingle();
  falhou(error, "projeto");
  if (!data) throw new ErroDeAcesso(404, "projeto não encontrado");
  return paraTela(data);
}

/** Um projeto novo, a partir de um modelo (JavaScript, Python, página web, C...). */
export async function criarProjeto(usuarioId, { nome, modelo }) {
  const { count, error: e1 } = await supabase.from("proof_ide_projetos").select("id", { count: "exact", head: true }).eq("usuario_id", usuarioId);
  falhou(e1, "projetos");
  if ((count || 0) >= IDE.maxProjetos) throw new ErroDeAcesso(400, `você chegou a ${IDE.maxProjetos} projetos — apague um para criar outro`);
  if (modelo && !MODELOS_DE_PROJETO[modelo]) throw new ErroDeAcesso(400, "modelo de projeto desconhecido");
  const p = projetoDoModelo(modelo || "vazio", nome);
  const { data, error } = await supabase.from("proof_ide_projetos").insert({ usuario_id: usuarioId, nome: p.nome, arquivos: p.arquivos, pastas: p.pastas, principal: p.principal }).select(CAMPOS).single();
  falhou(error, "criar projeto");
  return paraTela(data);
}

/**
 * Grava o projeto inteiro. `versao` é a que a tela leu: se outra aba gravou no meio, nada muda e volta 409
 * (a tela avisa e recarrega, em vez de apagar o trabalho da outra aba).
 */
export async function salvarProjeto(usuarioId, id, corpo) {
  if (!uuid(id)) throw new ErroDeAcesso(400, "projeto inválido");
  const r = conferirProjeto(corpo);
  if (!r.ok) throw new ErroDeAcesso(400, r.erro);
  const versao = Number(corpo?.versao);
  if (!Number.isInteger(versao)) throw new ErroDeAcesso(400, "faltou a versão do projeto");
  const { data, error } = await supabase.from("proof_ide_projetos")
    .update({ nome: r.projeto.nome, arquivos: r.projeto.arquivos, pastas: r.projeto.pastas, principal: r.projeto.principal, versao: versao + 1, atualizado_em: new Date().toISOString() })
    .eq("id", id).eq("usuario_id", usuarioId).eq("versao", versao)
    .select("versao, atualizado_em");
  falhou(error, "salvar projeto");
  if (!data?.length) {
    const { data: existe } = await supabase.from("proof_ide_projetos").select("versao").eq("id", id).eq("usuario_id", usuarioId).maybeSingle();
    if (!existe) throw new ErroDeAcesso(404, "projeto não encontrado");
    throw new ErroDeAcesso(409, "o projeto mudou em outra aba ou aparelho — recarregue para continuar de onde ele está");
  }
  return { versao: data[0].versao, atualizadoEm: data[0].atualizado_em };
}

export async function apagarProjeto(usuarioId, id) {
  if (!uuid(id)) throw new ErroDeAcesso(400, "projeto inválido");
  const { data, error } = await supabase.from("proof_ide_projetos").delete().eq("id", id).eq("usuario_id", usuarioId).select("id");
  falhou(error, "apagar projeto");
  if (!data?.length) throw new ErroDeAcesso(404, "projeto não encontrado");
  return { apagado: true };
}
