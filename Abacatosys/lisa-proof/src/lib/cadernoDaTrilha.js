// A estrutura do caderno do curso, só quando a pessoa pede (06/11/2026: "a Lisa só pode gerar estrutura
// de cadernos se o usuário pedir… deixe um menu colapsado para o usuário ver por semana as estruturas
// geradas"). Na trilha, o botão "Criar a estrutura do caderno" monta um caderno com um módulo por semana
// do plano e uma página por assunto, tudo já ligado à trilha e aos assuntos. Uma por trilha.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { avancoDaTrilhaDoUsuario } from "./avanco.js";
import { criarCaderno } from "./cadernos.js";
import { estruturaPorSemana } from "@/dominio/cadernos.js";
import { paginaDoAssunto } from "@/dominio/cursoDoLivro.js";

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

/** O caderno do curso desta trilha (o caderno inteiro ligado a ela, que não é apostila), ou null. */
export async function cadernoDaTrilha(usuarioId, trilhaId) {
  const { data, error } = await supabase.from("proof_vinculos")
    .select("caderno_id, proof_cadernos!inner(id, titulo, categoria)")
    .eq("usuario_id", usuarioId).eq("alvo_tipo", "trilha").eq("alvo_id", trilhaId).is("pagina_id", null)
    .eq("proof_cadernos.categoria", "caderno")
    .order("criado_em").limit(1);
  falhou(error, "caderno da trilha");
  const v = data?.[0];
  return v ? { id: v.caderno_id, titulo: v.proof_cadernos.titulo, href: `/cadernos/${v.caderno_id}` } : null;
}

/** Cria a estrutura do caderno do curso (ou devolve a que já existe). */
export async function criarEstruturaDoCaderno(usuarioId, trilhaId) {
  const { trilha, avanco } = await avancoDaTrilhaDoUsuario(trilhaId, usuarioId);
  const existente = await cadernoDaTrilha(usuarioId, trilha.id);
  if (existente) return { ...existente, nova: false };

  const modulos = estruturaPorSemana(avanco);
  const assuntos = modulos.flatMap((m) => m.assuntos);
  if (!assuntos.length) throw new ErroDeAcesso(400, "a trilha ainda não tem assuntos para montar o caderno");

  // curso de um livro: cada página leva o link das páginas do livro do assunto
  const { data: comLivro } = await supabase.from("proof_trilhas").select("livro_id, proof_livros(id, titulo)").eq("id", trilha.id).maybeSingle();
  const livro = comLivro?.proof_livros || null;
  const leituras = new Map();
  if (livro) {
    const { data } = await supabase.from("proof_leituras").select("card_id, de, ate").in("card_id", assuntos.map((a) => a.cardId));
    for (const l of data || []) leituras.set(l.card_id, { de: l.de, ate: l.ate });
  }

  const { caderno } = await criarCaderno(usuarioId, {
    titulo: `Curso: ${trilha.tema}`.slice(0, 120),
    descricao: "A estrutura do curso: um módulo por semana do plano, uma página por assunto.",
    icone: livro ? "📘" : "📓",
    cor: livro ? "azul" : "vermelho",
  }, { primeiraPagina: false });

  try {
    const { data: criados, error: e1 } = await supabase.from("proof_caderno_paginas")
      .insert(modulos.map((m, i) => ({ caderno_id: caderno.id, tipo: "modulo", titulo: m.titulo.slice(0, 160), linguagem: "markdown", conteudo: "", ordem: (i + 1) * 1024 })))
      .select("id, ordem");
    falhou(e1, "módulos do caderno");
    const idDoModulo = new Map(criados.map((c) => [c.ordem, c.id]));
    const linhas = modulos.flatMap((m, i) => m.assuntos.map((a, j) => ({
      caderno_id: caderno.id, modulo_id: idDoModulo.get((i + 1) * 1024), tipo: "pagina", titulo: String(a.titulo || "Assunto").slice(0, 160), linguagem: "markdown",
      conteudo: paginaDoAssunto({ assunto: { titulo: a.titulo, objetivo: a.objetivo, paginas: leituras.get(a.cardId) }, livro }),
      ordem: (j + 1) * 1024,
    })));
    const { data: paginas, error: e2 } = await supabase.from("proof_caderno_paginas").insert(linhas).select("id, modulo_id, ordem");
    falhou(e2, "páginas do caderno");
    // a página de cada assunto, pela posição (módulo + ordem): o insert não promete a ordem da volta
    const chave = (moduloId, ordem) => `${moduloId}:${ordem}`;
    const idDaPagina = new Map(paginas.map((p) => [chave(p.modulo_id, p.ordem), p.id]));
    const vinculos = [
      { usuario_id: usuarioId, caderno_id: caderno.id, pagina_id: null, alvo_tipo: "trilha", alvo_id: trilha.id, rotulo: trilha.tema.slice(0, 200) },
      ...linhas.map((l, n) => ({
        usuario_id: usuarioId, caderno_id: caderno.id, pagina_id: idDaPagina.get(chave(l.modulo_id, l.ordem)), alvo_tipo: "assunto",
        alvo_id: assuntos[n].cardId, rotulo: String(assuntos[n].titulo || "").slice(0, 200),
      })).filter((v) => v.pagina_id),
    ];
    if (livro) vinculos.push({ usuario_id: usuarioId, caderno_id: caderno.id, pagina_id: null, alvo_tipo: "livro", alvo_id: livro.id, rotulo: livro.titulo.slice(0, 200) });
    const { error: e3 } = await supabase.from("proof_vinculos").insert(vinculos);
    falhou(e3, "vínculos do caderno");
    return { id: caderno.id, titulo: caderno.titulo, href: `/cadernos/${caderno.id}`, modulos: modulos.length, paginas: linhas.length, nova: true };
  } catch (e) {
    await supabase.from("proof_cadernos").delete().eq("id", caderno.id); // nada de estrutura pela metade
    throw e;
  }
}
