// Os cadernos no banco: criar, ler, gravar, mover e apagar cadernos e páginas. As regras moram em
// src/dominio/cadernos.js; aqui é a ida ao banco e a conferência do dono (um caderno é de quem criou,
// e uma página é do dono do caderno dela — conferido em toda leitura e gravação).

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import {
  validarCaderno, validarPagina, ordemNoFim, moverEntreIrmaos, uuidValido, anexarAoConteudo, LIMITES_DO_CADERNO,
} from "@/dominio/cadernos.js";

const CAMPOS_DO_CADERNO = "id, titulo, descricao, cor, icone, criado_em, atualizado_em";
const CAMPOS_DA_PAGINA = "id, caderno_id, modulo_id, tipo, titulo, linguagem, ordem, versao, criado_em, atualizado_em";

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

export function cadernoParaTela(c, extra = {}) {
  return { id: c.id, titulo: c.titulo, descricao: c.descricao, cor: c.cor, icone: c.icone, criadoEm: c.criado_em, atualizadoEm: c.atualizado_em, ...extra };
}

export function paginaParaTela(p, conteudo) {
  return {
    id: p.id, cadernoId: p.caderno_id, moduloId: p.modulo_id, tipo: p.tipo, titulo: p.titulo, linguagem: p.linguagem,
    ordem: p.ordem, versao: p.versao, criadoEm: p.criado_em, atualizadoEm: p.atualizado_em,
    ...(conteudo !== undefined ? { conteudo } : {}),
  };
}

/** O caderno, se for da pessoa; senão 404 (não diz se existe de outra pessoa). */
export async function exigirCaderno(usuarioId, cadernoId) {
  if (!uuidValido(cadernoId)) throw new ErroDeAcesso(404, "caderno não encontrado");
  const { data, error } = await supabase.from("proof_cadernos").select(CAMPOS_DO_CADERNO).eq("id", cadernoId).eq("usuario_id", usuarioId).maybeSingle();
  falhou(error, "caderno");
  if (!data) throw new ErroDeAcesso(404, "caderno não encontrado");
  return data;
}

/** A página (sem o conteúdo, a menos que peça), se o caderno dela for da pessoa. */
export async function exigirPagina(usuarioId, paginaId, { comConteudo = false } = {}) {
  if (!uuidValido(paginaId)) throw new ErroDeAcesso(404, "página não encontrada");
  const { data, error } = await supabase
    .from("proof_caderno_paginas")
    .select(`${CAMPOS_DA_PAGINA}${comConteudo ? ", conteudo" : ""}, proof_cadernos!inner(usuario_id, titulo)`)
    .eq("id", paginaId)
    .eq("proof_cadernos.usuario_id", usuarioId)
    .maybeSingle();
  falhou(error, "página");
  if (!data) throw new ErroDeAcesso(404, "página não encontrada");
  return data;
}

const tocarCaderno = (cadernoId) =>
  supabase.from("proof_cadernos").update({ atualizado_em: new Date().toISOString() }).eq("id", cadernoId);

/** Os cadernos da pessoa, com quantas páginas e quantos vínculos cada um tem. */
export async function listarCadernos(usuarioId) {
  const { data: cadernos, error } = await supabase
    .from("proof_cadernos").select(CAMPOS_DO_CADERNO).eq("usuario_id", usuarioId).order("atualizado_em", { ascending: false });
  falhou(error, "cadernos");
  if (!cadernos.length) return [];
  const ids = cadernos.map((c) => c.id);
  const [{ data: paginas, error: e1 }, { data: vinculos, error: e2 }] = await Promise.all([
    supabase.from("proof_caderno_paginas").select("caderno_id, tipo").in("caderno_id", ids),
    supabase.from("proof_vinculos").select("caderno_id").eq("usuario_id", usuarioId),
  ]);
  falhou(e1, "páginas");
  falhou(e2, "vínculos");
  const conta = (lista, filtro) => lista.reduce((m, x) => (filtro(x) ? m.set(x.caderno_id, (m.get(x.caderno_id) || 0) + 1) : m), new Map());
  const nPaginas = conta(paginas, (p) => p.tipo === "pagina");
  const nModulos = conta(paginas, (p) => p.tipo === "modulo");
  const nVinculos = conta(vinculos, () => true);
  return cadernos.map((c) => cadernoParaTela(c, { paginas: nPaginas.get(c.id) || 0, modulos: nModulos.get(c.id) || 0, vinculos: nVinculos.get(c.id) || 0 }));
}

/** Caderno novo, já com uma página para começar a escrever. */
export async function criarCaderno(usuarioId, bruto, { primeiraPagina = true } = {}) {
  const v = validarCaderno(bruto);
  if (!v.ok) throw new ErroDeAcesso(400, v.erros.join("; "));
  const { count } = await supabase.from("proof_cadernos").select("id", { count: "exact", head: true }).eq("usuario_id", usuarioId);
  if ((count || 0) >= LIMITES_DO_CADERNO.cadernos) throw new ErroDeAcesso(403, `você chegou a ${LIMITES_DO_CADERNO.cadernos} cadernos — apague um que não usa mais`);
  const { data, error } = await supabase.from("proof_cadernos").insert({ ...v.caderno, usuario_id: usuarioId }).select(CAMPOS_DO_CADERNO).single();
  falhou(error, "criar caderno");
  let pagina = null;
  if (primeiraPagina) {
    const { data: p, error: e2 } = await supabase.from("proof_caderno_paginas")
      .insert({ caderno_id: data.id, tipo: "pagina", titulo: "Anotações.md", linguagem: "markdown", conteudo: `# ${data.titulo}\n\n`, ordem: 1024 })
      .select(CAMPOS_DA_PAGINA).single();
    falhou(e2, "primeira página");
    pagina = paginaParaTela(p);
  }
  return { caderno: cadernoParaTela(data), pagina };
}

/** O caderno e a árvore dele (as páginas sem o conteúdo: o conteúdo vem quando a aba abre). */
export async function lerCaderno(usuarioId, cadernoId) {
  const caderno = await exigirCaderno(usuarioId, cadernoId);
  const { data, error } = await supabase.from("proof_caderno_paginas").select(CAMPOS_DA_PAGINA).eq("caderno_id", cadernoId).order("ordem");
  falhou(error, "páginas");
  return { caderno: cadernoParaTela(caderno), itens: data.map((p) => paginaParaTela(p)) };
}

export async function editarCaderno(usuarioId, cadernoId, bruto) {
  await exigirCaderno(usuarioId, cadernoId);
  const v = validarCaderno(bruto, { parcial: true });
  if (!v.ok) throw new ErroDeAcesso(400, v.erros.join("; "));
  const { data, error } = await supabase.from("proof_cadernos")
    .update({ ...v.caderno, atualizado_em: new Date().toISOString() }).eq("id", cadernoId).select(CAMPOS_DO_CADERNO).single();
  falhou(error, "editar caderno");
  return cadernoParaTela(data);
}

export async function apagarCaderno(usuarioId, cadernoId) {
  await exigirCaderno(usuarioId, cadernoId);
  const { error } = await supabase.from("proof_cadernos").delete().eq("id", cadernoId); // páginas e vínculos vão junto
  falhou(error, "apagar caderno");
}

/** Módulo ou página nova. Página pode nascer dentro de um módulo; módulo só na raiz. */
export async function criarPagina(usuarioId, cadernoId, bruto) {
  await exigirCaderno(usuarioId, cadernoId);
  const v = validarPagina(bruto);
  if (!v.ok) throw new ErroDeAcesso(400, v.erros.join("; "));
  const { data: irmaosTodos, error } = await supabase.from("proof_caderno_paginas").select("id, tipo, modulo_id, ordem").eq("caderno_id", cadernoId);
  falhou(error, "páginas");
  if (irmaosTodos.length >= LIMITES_DO_CADERNO.paginas) throw new ErroDeAcesso(403, `o caderno chegou a ${LIMITES_DO_CADERNO.paginas} páginas — comece outro caderno`);
  let moduloId = null;
  if (v.pagina.tipo === "pagina" && bruto?.moduloId) {
    const modulo = irmaosTodos.find((p) => p.id === bruto.moduloId && p.tipo === "modulo");
    if (!modulo) throw new ErroDeAcesso(400, "o módulo não é deste caderno");
    moduloId = modulo.id;
  }
  const irmaos = irmaosTodos.filter((p) => (p.modulo_id || null) === moduloId);
  const { data, error: e2 } = await supabase.from("proof_caderno_paginas").insert({
    caderno_id: cadernoId, modulo_id: moduloId, tipo: v.pagina.tipo, titulo: v.pagina.titulo,
    linguagem: v.pagina.tipo === "modulo" ? "markdown" : v.pagina.linguagem,
    conteudo: v.pagina.tipo === "modulo" ? "" : (v.pagina.conteudo ?? ""),
    ordem: ordemNoFim(irmaos),
  }).select(CAMPOS_DA_PAGINA).single();
  falhou(e2, "criar página");
  await tocarCaderno(cadernoId);
  return paginaParaTela(data);
}

export async function lerPagina(usuarioId, paginaId) {
  const p = await exigirPagina(usuarioId, paginaId, { comConteudo: true });
  return paginaParaTela(p, p.conteudo);
}

/**
 * Grava título, linguagem, conteúdo ou o módulo da página. Com `versao` (a versão que a tela
 * abriu), a gravação só acontece se ninguém gravou depois — senão 409, e a tela pergunta o que
 * fazer, em vez de apagar em silêncio o que outra aba (ou o celular) escreveu.
 */
export async function editarPagina(usuarioId, paginaId, bruto) {
  const atual = await exigirPagina(usuarioId, paginaId);
  const v = validarPagina(bruto, { parcial: true });
  if (!v.ok) throw new ErroDeAcesso(400, v.erros.join("; "));
  const mudanca = { ...v.pagina };
  delete mudanca.tipo; // página não vira módulo nem o contrário
  if (atual.tipo === "modulo") { delete mudanca.conteudo; delete mudanca.linguagem; }

  if (bruto?.moduloId !== undefined && atual.tipo === "pagina") {
    let moduloId = null;
    if (bruto.moduloId) {
      const { data: modulo } = await supabase.from("proof_caderno_paginas").select("id")
        .eq("id", bruto.moduloId).eq("caderno_id", atual.caderno_id).eq("tipo", "modulo").maybeSingle();
      if (!modulo) throw new ErroDeAcesso(400, "o módulo não é deste caderno");
      moduloId = modulo.id;
    }
    if (moduloId !== atual.modulo_id) {
      const { data: irmaos } = await supabase.from("proof_caderno_paginas").select("ordem")
        .eq("caderno_id", atual.caderno_id).filter("modulo_id", moduloId ? "eq" : "is", moduloId ?? null);
      mudanca.modulo_id = moduloId;
      mudanca.ordem = ordemNoFim(irmaos || []);
    }
  }
  if (!Object.keys(mudanca).length) return paginaParaTela(atual);

  const base = Number.parseInt(bruto?.versao, 10);
  const versaoAtual = atual.versao;
  if (Number.isFinite(base) && base !== versaoAtual) {
    throw new ErroDeAcesso(409, "esta página foi alterada em outro lugar depois que você abriu");
  }
  const { data, error } = await supabase.from("proof_caderno_paginas")
    .update({ ...mudanca, versao: versaoAtual + 1, atualizado_em: new Date().toISOString() })
    .eq("id", paginaId).eq("versao", versaoAtual)
    .select(CAMPOS_DA_PAGINA);
  falhou(error, "gravar página");
  if (!data.length) throw new ErroDeAcesso(409, "esta página foi alterada em outro lugar agora mesmo");
  await tocarCaderno(atual.caderno_id);
  return paginaParaTela(data[0]);
}

/** Sobe ou desce a página (ou o módulo) entre os irmãos. */
export async function moverPagina(usuarioId, paginaId, direcao) {
  const atual = await exigirPagina(usuarioId, paginaId);
  const { data: irmaos, error } = await supabase.from("proof_caderno_paginas").select("id, ordem, criado_em")
    .eq("caderno_id", atual.caderno_id).filter("modulo_id", atual.modulo_id ? "eq" : "is", atual.modulo_id ?? null);
  falhou(error, "irmãos");
  const novas = moverEntreIrmaos(irmaos.map((i) => ({ id: i.id, ordem: i.ordem, criadoEm: i.criado_em })), paginaId, direcao);
  for (const n of novas) {
    const { error: e2 } = await supabase.from("proof_caderno_paginas").update({ ordem: n.ordem }).eq("id", n.id);
    falhou(e2, "mover");
  }
  return novas;
}

export async function apagarPagina(usuarioId, paginaId) {
  const atual = await exigirPagina(usuarioId, paginaId);
  const { error } = await supabase.from("proof_caderno_paginas").delete().eq("id", paginaId); // num módulo, as páginas dele vão junto
  falhou(error, "apagar página");
  await tocarCaderno(atual.caderno_id);
}

/** Busca no caderno inteiro (título e conteúdo), com um pedaço do texto em volta. */
export async function buscarNoCaderno(usuarioId, cadernoId, termo) {
  await exigirCaderno(usuarioId, cadernoId);
  const t = String(termo || "").trim().slice(0, 120);
  if (t.length < 2) return [];
  // % e _ são curingas do LIKE; as aspas protegem vírgula e parênteses, que o filtro `or` usa
  const padrao = `%${t.replace(/[%_\\]/g, (c) => `\\${c}`)}%`.replace(/"/g, '\\"');
  const { data, error } = await supabase.from("proof_caderno_paginas").select("id, titulo, conteudo")
    .eq("caderno_id", cadernoId).eq("tipo", "pagina").or(`titulo.ilike."${padrao}",conteudo.ilike."${padrao}"`).limit(40);
  falhou(error, "busca");
  const minusculo = t.toLowerCase();
  return data.map((p) => {
    const conteudo = p.conteudo || "";
    const i = conteudo.toLowerCase().indexOf(minusculo);
    const linha = i < 0 ? null : conteudo.slice(0, i).split("\n").length;
    return { id: p.id, titulo: p.titulo, linha, trecho: i < 0 ? "" : conteudo.slice(Math.max(0, i - 60), i + t.length + 100).replace(/\s+/g, " ") };
  });
}

/** Junta um trecho no fim de uma página (a citação que vem do leitor de PDF, por exemplo). */
export async function anexarNaPagina(usuarioId, paginaId, trecho) {
  const atual = await exigirPagina(usuarioId, paginaId, { comConteudo: true });
  if (atual.tipo !== "pagina") throw new ErroDeAcesso(400, "escolha uma página, não um módulo");
  const conteudo = anexarAoConteudo(atual.conteudo, String(trecho || "").slice(0, 20000));
  if (conteudo.length > LIMITES_DO_CADERNO.conteudo) throw new ErroDeAcesso(400, "a página está cheia — mande para outra página");
  const { data, error } = await supabase.from("proof_caderno_paginas")
    .update({ conteudo, versao: atual.versao + 1, atualizado_em: new Date().toISOString() })
    .eq("id", paginaId).eq("versao", atual.versao).select(CAMPOS_DA_PAGINA);
  falhou(error, "anexar");
  if (!data.length) throw new ErroDeAcesso(409, "a página mudou agora mesmo — tente de novo");
  await tocarCaderno(atual.caderno_id);
  return paginaParaTela(data[0]);
}
