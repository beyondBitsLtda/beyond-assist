// Vínculos entre o caderno (inteiro, ou uma página/módulo dele) e os pontos de estudo: trilha (os
// cursos são trilhas), assunto da trilha, torre do Modo Domínio, andar da torre e livro (ou uma
// página do livro). Todo alvo é conferido aqui: só se vincula ao que é da própria pessoa.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { exigirCaderno, exigirPagina, criarCaderno, criarPagina } from "./cadernos.js";
import {
  normalizarAlvo, enderecoDoAlvo, rotuloDoAlvo, enderecoDaPagina, tituloDaAnotacao, TIPOS_DE_ALVO, uuidValido, alvoNaoEncontrado,
} from "@/dominio/cadernos.js";

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

const nomeDaTorre = (repo) => String(repo || "").split("/").pop() || repo;

/** Tudo a que a pessoa pode vincular: trilhas (com os assuntos), torres (com os andares) e livros. */
export async function alvosDisponiveis(usuarioId) {
  const [{ data: trilhas, error: e1 }, { data: torres, error: e2 }, { data: livros, error: e3 }] = await Promise.all([
    supabase.from("proof_trilhas").select("id, tema, livro_id, status, criada_em").eq("usuario_id", usuarioId).order("criada_em"),
    supabase.from("proof_dominios").select("id, repo_caminho, andares, status, criado_em").eq("usuario_id", usuarioId).order("criado_em"),
    supabase.from("proof_livros").select("id, titulo, paginas").eq("usuario_id", usuarioId).order("titulo"),
  ]);
  falhou(e1, "trilhas");
  falhou(e2, "torres");
  falhou(e3, "livros");
  const [etapas, andares] = await Promise.all([
    trilhas.length
      ? supabase.from("proof_etapas").select("trilha_id, card_id, ordem, abacato_cards(titulo)").in("trilha_id", trilhas.map((t) => t.id)).order("ordem")
      : { data: [] },
    torres.length
      ? supabase.from("proof_dominio_andares").select("dominio_id, numero, titulo, chefao_nome").in("dominio_id", torres.map((t) => t.id)).order("numero")
      : { data: [] },
  ]);
  falhou(etapas.error, "assuntos");
  falhou(andares.error, "andares");
  return {
    trilhas: trilhas.map((t) => ({
      id: t.id, nome: t.tema, curso: Boolean(t.livro_id), status: t.status,
      assuntos: etapas.data.filter((e) => e.trilha_id === t.id).map((e) => ({ id: e.card_id, nome: e.abacato_cards?.titulo || "Assunto" })),
    })),
    torres: torres.map((t) => ({
      id: t.id, nome: nomeDaTorre(t.repo_caminho), repo: t.repo_caminho, status: t.status,
      andares: andares.data.filter((a) => a.dominio_id === t.id).map((a) => ({ numero: a.numero, nome: a.titulo, chefao: a.chefao_nome })),
    })),
    livros: livros.map((l) => ({ id: l.id, nome: l.titulo, paginas: l.paginas })),
  };
}

/** Confere que o alvo existe e é da pessoa. Devolve o nome dele (e a trilha, se for assunto). */
export async function conferirAlvo(usuarioId, alvo) {
  const { tipo, id, numero } = alvo;
  if (tipo === "trilha") {
    const { data } = await supabase.from("proof_trilhas").select("id, tema").eq("id", id).eq("usuario_id", usuarioId).maybeSingle();
    if (data) return { nome: data.tema };
  } else if (tipo === "assunto") {
    const { data } = await supabase.from("proof_etapas")
      .select("trilha_id, abacato_cards(titulo), proof_trilhas!inner(usuario_id)")
      .eq("card_id", id).eq("proof_trilhas.usuario_id", usuarioId).limit(1);
    if (data?.length) return { nome: data[0].abacato_cards?.titulo || "Assunto", trilhaId: data[0].trilha_id };
  } else if (tipo === "torre" || tipo === "andar") {
    const { data: torre } = await supabase.from("proof_dominios").select("id, repo_caminho").eq("id", id).eq("usuario_id", usuarioId).maybeSingle();
    if (torre && tipo === "torre") return { nome: nomeDaTorre(torre.repo_caminho) };
    if (torre) {
      const { data: andar } = await supabase.from("proof_dominio_andares").select("titulo").eq("dominio_id", id).eq("numero", numero).maybeSingle();
      if (andar) return { nome: andar.titulo, torre: nomeDaTorre(torre.repo_caminho) };
    }
  } else if (tipo === "livro") {
    const { data } = await supabase.from("proof_livros").select("id, titulo, paginas").eq("id", id).eq("usuario_id", usuarioId).maybeSingle();
    if (data && (!numero || numero <= data.paginas)) return { nome: data.titulo };
    if (data) throw new ErroDeAcesso(400, `o livro tem ${data.paginas} páginas`);
  }
  throw new ErroDeAcesso(404, alvoNaoEncontrado(tipo));
}

/**
 * Os nomes de agora (a trilha pode ter mudado de nome, o andar pode ter sido gerado de novo) e o
 * endereço de cada alvo — em poucas idas ao banco, uma por tipo.
 */
async function alvosVivos(usuarioId, vinculos) {
  const ids = (tipo) => [...new Set(vinculos.filter((v) => v.alvo_tipo === tipo || (tipo === "torre" && v.alvo_tipo === "andar")).map((v) => v.alvo_id))];
  const consultas = await Promise.all([
    ids("trilha").length ? supabase.from("proof_trilhas").select("id, tema").in("id", ids("trilha")).eq("usuario_id", usuarioId) : { data: [] },
    ids("assunto").length
      ? supabase.from("proof_etapas").select("card_id, trilha_id, abacato_cards(titulo), proof_trilhas!inner(usuario_id)").in("card_id", ids("assunto")).eq("proof_trilhas.usuario_id", usuarioId)
      : { data: [] },
    ids("torre").length ? supabase.from("proof_dominios").select("id, repo_caminho").in("id", ids("torre")).eq("usuario_id", usuarioId) : { data: [] },
    ids("torre").length ? supabase.from("proof_dominio_andares").select("dominio_id, numero, titulo").in("dominio_id", ids("torre")) : { data: [] },
    ids("livro").length ? supabase.from("proof_livros").select("id, titulo").in("id", ids("livro")).eq("usuario_id", usuarioId) : { data: [] },
  ]);
  const [trilhas, assuntos, torres, andares, livros] = consultas.map((c) => c.data || []);
  return (v) => {
    const alvo = { tipo: v.alvo_tipo, id: v.alvo_id, numero: v.alvo_numero };
    let nome = null;
    let existe = true;
    if (v.alvo_tipo === "trilha") nome = trilhas.find((t) => t.id === v.alvo_id)?.tema;
    else if (v.alvo_tipo === "assunto") {
      const a = assuntos.find((x) => x.card_id === v.alvo_id);
      nome = a?.abacato_cards?.titulo;
      alvo.trilhaId = a?.trilha_id;
    } else if (v.alvo_tipo === "torre") nome = nomeDaTorre(torres.find((t) => t.id === v.alvo_id)?.repo_caminho);
    else if (v.alvo_tipo === "andar") {
      existe = torres.some((t) => t.id === v.alvo_id);
      nome = andares.find((a) => a.dominio_id === v.alvo_id && a.numero === v.alvo_numero)?.titulo;
    } else if (v.alvo_tipo === "livro") nome = livros.find((l) => l.id === v.alvo_id)?.titulo;
    if (!nome && v.alvo_tipo !== "andar") existe = false;
    const nomeFinal = nome || v.rotulo || TIPOS_DE_ALVO[v.alvo_tipo]?.rotulo;
    return {
      ...alvo,
      nome: nomeFinal,
      rotulo: rotuloDoAlvo({ tipo: v.alvo_tipo, numero: v.alvo_numero, nome: nomeFinal }),
      icone: TIPOS_DE_ALVO[v.alvo_tipo]?.icone,
      href: existe ? enderecoDoAlvo(alvo) : null,
      existe,
    };
  };
}

const CAMPOS_DO_VINCULO = "id, caderno_id, pagina_id, alvo_tipo, alvo_id, alvo_numero, rotulo, criado_em";

/** Os vínculos de um caderno (do caderno inteiro e de cada página). */
export async function vinculosDoCaderno(usuarioId, cadernoId) {
  await exigirCaderno(usuarioId, cadernoId);
  const { data, error } = await supabase.from("proof_vinculos").select(CAMPOS_DO_VINCULO).eq("caderno_id", cadernoId).order("criado_em");
  falhou(error, "vínculos");
  const vivo = await alvosVivos(usuarioId, data);
  return data.map((v) => ({ id: v.id, paginaId: v.pagina_id, alvo: vivo(v) }));
}

/**
 * As anotações ligadas a um ponto de estudo — o que aparece na trilha, no assunto, na torre e no
 * livro. A trilha mostra também as dos assuntos dela; a torre, as dos andares.
 */
export async function vinculosDoAlvo(usuarioId, { tipo, id }) {
  if (!TIPOS_DE_ALVO[tipo] || !uuidValido(id)) throw new ErroDeAcesso(400, "destino inválido");
  let consulta = supabase.from("proof_vinculos")
    .select(`${CAMPOS_DO_VINCULO}, proof_cadernos(id, titulo, icone, cor), proof_caderno_paginas(id, titulo, tipo)`)
    .eq("usuario_id", usuarioId);
  if (tipo === "trilha") {
    const { data: etapas } = await supabase.from("proof_etapas").select("card_id, proof_trilhas!inner(usuario_id)").eq("trilha_id", id).eq("proof_trilhas.usuario_id", usuarioId);
    const cards = (etapas || []).map((e) => e.card_id);
    consulta = cards.length
      ? consulta.or(`and(alvo_tipo.eq.trilha,alvo_id.eq.${id}),and(alvo_tipo.eq.assunto,alvo_id.in.(${cards.join(",")}))`)
      : consulta.eq("alvo_tipo", "trilha").eq("alvo_id", id);
  } else if (tipo === "torre") {
    consulta = consulta.in("alvo_tipo", ["torre", "andar"]).eq("alvo_id", id);
  } else {
    consulta = consulta.eq("alvo_tipo", tipo).eq("alvo_id", id);
  }
  const { data, error } = await consulta.order("criado_em", { ascending: false }).limit(200);
  falhou(error, "anotações");
  const vivo = await alvosVivos(usuarioId, data);
  return data.map((v) => ({
    id: v.id,
    caderno: v.proof_cadernos ? { id: v.proof_cadernos.id, titulo: v.proof_cadernos.titulo, icone: v.proof_cadernos.icone, cor: v.proof_cadernos.cor } : null,
    pagina: v.proof_caderno_paginas ? { id: v.proof_caderno_paginas.id, titulo: v.proof_caderno_paginas.titulo, tipo: v.proof_caderno_paginas.tipo } : null,
    href: enderecoDaPagina(v.caderno_id, v.pagina_id),
    alvo: vivo(v),
  }));
}

/** Liga o caderno (ou uma página/módulo dele) a um alvo. Vincular de novo o mesmo devolve o que já existe. */
export async function vincular(usuarioId, { cadernoId, paginaId, alvo: bruto }) {
  await exigirCaderno(usuarioId, cadernoId);
  if (paginaId) {
    const p = await exigirPagina(usuarioId, paginaId);
    if (p.caderno_id !== cadernoId) throw new ErroDeAcesso(400, "a página não é deste caderno");
  }
  const n = normalizarAlvo(bruto);
  if (!n.ok) throw new ErroDeAcesso(400, n.erro);
  const { nome } = await conferirAlvo(usuarioId, n.alvo);

  let existente = supabase.from("proof_vinculos").select(CAMPOS_DO_VINCULO)
    .eq("caderno_id", cadernoId).eq("alvo_tipo", n.alvo.tipo).eq("alvo_id", n.alvo.id)
    .filter("pagina_id", paginaId ? "eq" : "is", paginaId || null)
    .filter("alvo_numero", n.alvo.numero ? "eq" : "is", n.alvo.numero ?? null);
  const { data: ja } = await existente.maybeSingle();
  if (ja) return ja;

  const { data, error } = await supabase.from("proof_vinculos").insert({
    usuario_id: usuarioId, caderno_id: cadernoId, pagina_id: paginaId || null,
    alvo_tipo: n.alvo.tipo, alvo_id: n.alvo.id, alvo_numero: n.alvo.numero,
    rotulo: String(nome || "").slice(0, 200),
  }).select(CAMPOS_DO_VINCULO).single();
  falhou(error, "vincular");
  return data;
}

export async function desvincular(usuarioId, vinculoId) {
  if (!uuidValido(vinculoId)) throw new ErroDeAcesso(404, "vínculo não encontrado");
  const { data, error } = await supabase.from("proof_vinculos").delete().eq("id", vinculoId).eq("usuario_id", usuarioId).select("id");
  falhou(error, "desvincular");
  if (!data.length) throw new ErroDeAcesso(404, "vínculo não encontrado");
}

/**
 * "Anotar aqui": cria uma página para o alvo (num caderno escolhido, ou num caderno novo com o nome
 * do alvo) já vinculada a ele, e devolve o endereço para abrir a página no editor.
 */
export async function anotar(usuarioId, { alvo: bruto, cadernoId }) {
  const n = normalizarAlvo(bruto);
  if (!n.ok) throw new ErroDeAcesso(400, n.erro);
  const conferido = await conferirAlvo(usuarioId, n.alvo);
  const nomeDoAlvo = n.alvo.tipo === "andar" ? `${conferido.nome}` : conferido.nome;

  let caderno;
  if (cadernoId) caderno = await exigirCaderno(usuarioId, cadernoId);
  else {
    const titulo = n.alvo.tipo === "andar" ? `Torre ${conferido.torre}` : n.alvo.tipo === "assunto" ? "Anotações dos assuntos" : conferido.nome;
    caderno = (await criarCaderno(usuarioId, { titulo, icone: n.alvo.tipo === "livro" ? "📘" : n.alvo.tipo === "torre" || n.alvo.tipo === "andar" ? "🛠️" : "📓" }, { primeiraPagina: false })).caderno;
  }
  const href = enderecoDoAlvo({ ...n.alvo, trilhaId: conferido.trilhaId });
  const titulo = tituloDaAnotacao({ tipo: n.alvo.tipo, nome: nomeDoAlvo, numero: n.alvo.numero });
  const pagina = await criarPagina(usuarioId, caderno.id, {
    tipo: "pagina",
    titulo,
    linguagem: "markdown",
    conteudo: `# ${titulo}\n\n${href ? `🔗 [${rotuloDoAlvo({ tipo: n.alvo.tipo, numero: n.alvo.numero, nome: nomeDoAlvo })}](${href})\n\n` : ""}`,
  });
  await vincular(usuarioId, { cadernoId: caderno.id, paginaId: pagina.id, alvo: n.alvo });
  return { cadernoId: caderno.id, paginaId: pagina.id, href: enderecoDaPagina(caderno.id, pagina.id) };
}
