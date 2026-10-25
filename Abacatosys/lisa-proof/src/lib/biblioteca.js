// A biblioteca no banco e no Storage. As regras moram em src/dominio/biblioteca.js.
//
// O caminho de um livro novo:
//   1. o navegador lê o PDF (pdf.js): páginas, sumário, capa → POST /api/biblioteca;
//   2. o servidor confere o espaço, cria a linha e ASSINA um endereço de envio para
//      <usuario>/<livro>.pdf no bucket privado;
//   3. o navegador manda o arquivo direto para o Storage (o PDF não passa pelo Worker) e avisa;
//   4. o navegador tira o texto de cada página e manda em lotes; no último, o livro fica "pronto".
// Para ler, o servidor assina um endereço de leitura de vida curta, depois de conferir o dono.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { uuidValido } from "@/dominio/cadernos.js";
import {
  validarLivroNovo, validarLoteDeTexto, validarMarcacao, termoDeBusca, progressoDaLeitura, textoCurto, LIMITES_DA_BIBLIOTECA,
} from "@/dominio/biblioteca.js";

export const BUCKET = "proof-biblioteca";
const VIDA_DO_ENDERECO = 3 * 60 * 60; // 3 h: dá para ler uma tarde inteira sem o PDF sumir

const CAMPOS_DO_LIVRO = "id, titulo, autor, arquivo, tamanho, paginas, sumario, capa, status, paginas_com_texto, ultima_pagina, criado_em, atualizado_em, lido_em";
const CAMPOS_DA_MARCACAO = "id, livro_id, pagina, tipo, cor, texto, nota, retangulos, criado_em, atualizado_em";

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

export function livroParaTela(l, extra = {}) {
  return {
    id: l.id, titulo: l.titulo, autor: l.autor, tamanho: Number(l.tamanho), paginas: l.paginas, sumario: l.sumario || [],
    capa: l.capa, status: l.status, paginasComTexto: l.paginas_com_texto, ultimaPagina: l.ultima_pagina,
    progresso: progressoDaLeitura(l.ultima_pagina, l.paginas), criadoEm: l.criado_em, lidoEm: l.lido_em, ...extra,
  };
}

export function marcacaoParaTela(m) {
  return { id: m.id, pagina: m.pagina, tipo: m.tipo, cor: m.cor, texto: m.texto, nota: m.nota, retangulos: m.retangulos || [], criadoEm: m.criado_em, atualizadoEm: m.atualizado_em };
}

export async function exigirLivro(usuarioId, livroId, campos = CAMPOS_DO_LIVRO) {
  if (!uuidValido(livroId)) throw new ErroDeAcesso(404, "livro não encontrado");
  const { data, error } = await supabase.from("proof_livros").select(campos).eq("id", livroId).eq("usuario_id", usuarioId).maybeSingle();
  falhou(error, "livro");
  if (!data) throw new ErroDeAcesso(404, "livro não encontrado");
  return data;
}

async function espacoUsado(usuarioId) {
  const { data, error } = await supabase.from("proof_livros").select("tamanho").eq("usuario_id", usuarioId);
  falhou(error, "espaço");
  return { usado: data.reduce((s, l) => s + Number(l.tamanho || 0), 0), quantos: data.length };
}

/** A estante: os livros (sem o texto), quantas marcações cada um tem e o espaço usado. */
export async function listarLivros(usuarioId) {
  const { data, error } = await supabase.from("proof_livros").select(CAMPOS_DO_LIVRO.replace(", sumario", "")).eq("usuario_id", usuarioId).order("lido_em", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false });
  falhou(error, "livros");
  let marcacoes = [];
  if (data.length) {
    const r = await supabase.from("proof_marcacoes").select("livro_id").in("livro_id", data.map((l) => l.id));
    falhou(r.error, "marcações");
    marcacoes = r.data;
  }
  const porLivro = marcacoes.reduce((m, x) => m.set(x.livro_id, (m.get(x.livro_id) || 0) + 1), new Map());
  const usado = data.reduce((s, l) => s + Number(l.tamanho || 0), 0);
  return {
    livros: data.map((l) => livroParaTela(l, { marcacoes: porLivro.get(l.id) || 0 })),
    espaco: { usado, total: LIMITES_DA_BIBLIOTECA.total, arquivo: LIMITES_DA_BIBLIOTECA.arquivo },
  };
}

/** Passos 1 e 2: confere, cria a linha e devolve o endereço assinado para o navegador enviar o PDF. */
export async function criarLivro(usuarioId, bruto) {
  const v = validarLivroNovo(bruto, await espacoUsado(usuarioId));
  if (!v.ok) throw new ErroDeAcesso(400, v.erros.join("; "));
  const id = crypto.randomUUID();
  const arquivo = `${usuarioId}/${id}.pdf`;
  const { data, error } = await supabase.from("proof_livros")
    .insert({ id, usuario_id: usuarioId, arquivo, ...v.livro, status: "enviando" })
    .select(CAMPOS_DO_LIVRO).single();
  falhou(error, "criar livro");
  const { data: envio, error: e2 } = await supabase.storage.from(BUCKET).createSignedUploadUrl(arquivo);
  if (e2 || !envio?.signedUrl) {
    await supabase.from("proof_livros").delete().eq("id", id);
    throw new ErroDeAcesso(502, `o armazenamento não aceitou o envio agora: ${e2?.message || "sem endereço"}`);
  }
  return { livro: livroParaTela(data), envio: { url: envio.signedUrl } };
}

/** Passo 3: o arquivo chegou mesmo ao Storage? (E com o tamanho que o navegador disse.) */
export async function confirmarEnvio(usuarioId, livroId) {
  const livro = await exigirLivro(usuarioId, livroId);
  const [pasta, nome] = livro.arquivo.split("/");
  const { data: lista, error } = await supabase.storage.from(BUCKET).list(pasta, { search: nome, limit: 5 });
  if (error) throw new ErroDeAcesso(502, `não consegui conferir o arquivo: ${error.message}`);
  const objeto = (lista || []).find((o) => o.name === nome);
  if (!objeto) throw new ErroDeAcesso(409, "o PDF não chegou ao armazenamento — tente enviar de novo");
  const tamanho = Number(objeto.metadata?.size || livro.tamanho);
  const { data, error: e2 } = await supabase.from("proof_livros")
    .update({ status: livro.status === "enviando" ? "lendo" : livro.status, tamanho, atualizado_em: new Date().toISOString() })
    .eq("id", livroId).select(CAMPOS_DO_LIVRO).single();
  falhou(e2, "confirmar");
  return livroParaTela(data);
}

/** Passo 4: um lote do texto das páginas. `fim`: era o último — conta as páginas com texto e fecha. */
export async function gravarTexto(usuarioId, livroId, { paginas, fim }) {
  const livro = await exigirLivro(usuarioId, livroId, "id, paginas, status");
  const lote = validarLoteDeTexto(paginas, livro.paginas);
  if (lote.length) {
    const { error } = await supabase.from("proof_livro_paginas").upsert(lote.map((p) => ({ livro_id: livroId, numero: p.numero, texto: p.texto })), { onConflict: "livro_id,numero" });
    falhou(error, "texto");
  }
  if (!fim) return { gravadas: lote.length };
  const { count, error: e2 } = await supabase.from("proof_livro_paginas").select("numero", { count: "exact", head: true }).eq("livro_id", livroId).neq("texto", "");
  falhou(e2, "contar");
  const { data, error: e3 } = await supabase.from("proof_livros")
    .update({ status: "pronto", paginas_com_texto: count || 0, atualizado_em: new Date().toISOString() })
    .eq("id", livroId).select(CAMPOS_DO_LIVRO).single();
  falhou(e3, "fechar");
  return { gravadas: lote.length, livro: livroParaTela(data) };
}

/** Para abrir no leitor: o livro e um endereço assinado do PDF. */
export async function lerLivro(usuarioId, livroId) {
  const livro = await exigirLivro(usuarioId, livroId);
  if (livro.status === "enviando") return { livro: livroParaTela(livro), endereco: null };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(livro.arquivo, VIDA_DO_ENDERECO);
  if (error || !data?.signedUrl) throw new ErroDeAcesso(502, `não consegui abrir o PDF agora: ${error?.message || "sem endereço"}`);
  return { livro: livroParaTela(livro), endereco: data.signedUrl };
}

/** Título, autor e onde a pessoa parou. */
export async function editarLivro(usuarioId, livroId, bruto) {
  const livro = await exigirLivro(usuarioId, livroId, "id, paginas");
  const mudanca = {};
  if (bruto?.titulo !== undefined) {
    mudanca.titulo = textoCurto(bruto.titulo, 200);
    if (!mudanca.titulo) throw new ErroDeAcesso(400, "dê um título ao livro");
  }
  if (bruto?.autor !== undefined) mudanca.autor = textoCurto(bruto.autor, 160);
  if (bruto?.ultimaPagina !== undefined) {
    const n = Number.parseInt(bruto.ultimaPagina, 10);
    if (Number.isFinite(n)) {
      mudanca.ultima_pagina = Math.min(Math.max(n, 1), livro.paginas);
      mudanca.lido_em = new Date().toISOString();
    }
  }
  if (!Object.keys(mudanca).length) return null;
  const { data, error } = await supabase.from("proof_livros").update({ ...mudanca, atualizado_em: new Date().toISOString() }).eq("id", livroId).select(CAMPOS_DO_LIVRO).single();
  falhou(error, "editar livro");
  return livroParaTela(data);
}

/** Apaga o arquivo e o livro (texto, marcações e leituras de curso vão junto; a trilha fica, sem o livro). */
export async function apagarLivro(usuarioId, livroId) {
  const livro = await exigirLivro(usuarioId, livroId, "id, arquivo");
  const { error } = await supabase.storage.from(BUCKET).remove([livro.arquivo]);
  if (error) throw new ErroDeAcesso(502, `não consegui apagar o arquivo: ${error.message}`);
  const { error: e2 } = await supabase.from("proof_livros").delete().eq("id", livroId);
  falhou(e2, "apagar livro");
}

/** Busca no texto do livro (no banco: o Worker não varre 500 páginas). */
export async function buscarNoLivro(usuarioId, livroId, bruto) {
  await exigirLivro(usuarioId, livroId, "id");
  const termo = termoDeBusca(bruto);
  if (!termo) return [];
  const { data, error } = await supabase.rpc("proof_busca_no_livro", { livro: livroId, termo, limite: 200 });
  falhou(error, "busca");
  return (data || []).map((r) => ({ pagina: r.numero, trecho: String(r.trecho || "").replace(/\s+/g, " ").trim(), vezes: r.vezes }));
}

/** O texto de faixas de páginas, cada uma cortada em `porFaixa` caracteres (o corte é feito no banco). */
export async function trechosDoLivro(livroId, faixas, porFaixa) {
  if (!faixas.length) return [];
  const { data, error } = await supabase.rpc("proof_trechos_do_livro", { livro: livroId, faixas, por_faixa: porFaixa });
  falhou(error, "trechos");
  return data || [];
}

// ---------------------------------------------------------------- marcações

export async function listarMarcacoes(usuarioId, livroId) {
  await exigirLivro(usuarioId, livroId, "id");
  const { data, error } = await supabase.from("proof_marcacoes").select(CAMPOS_DA_MARCACAO).eq("livro_id", livroId).order("pagina").order("criado_em");
  falhou(error, "marcações");
  return data.map(marcacaoParaTela);
}

export async function criarMarcacao(usuarioId, livroId, bruto) {
  const livro = await exigirLivro(usuarioId, livroId, "id, paginas");
  const v = validarMarcacao(bruto, { paginas: livro.paginas });
  if (!v.ok) throw new ErroDeAcesso(400, v.erros.join("; "));
  const { count } = await supabase.from("proof_marcacoes").select("id", { count: "exact", head: true }).eq("livro_id", livroId);
  if ((count || 0) >= 5000) throw new ErroDeAcesso(403, "este livro chegou a 5.000 marcações");
  const { data, error } = await supabase.from("proof_marcacoes").insert({ ...v.marcacao, livro_id: livroId }).select(CAMPOS_DA_MARCACAO).single();
  falhou(error, "marcar");
  return marcacaoParaTela(data);
}

async function exigirMarcacao(usuarioId, marcacaoId) {
  if (!uuidValido(marcacaoId)) throw new ErroDeAcesso(404, "marcação não encontrada");
  const { data, error } = await supabase.from("proof_marcacoes")
    .select(`${CAMPOS_DA_MARCACAO}, proof_livros!inner(usuario_id, paginas, titulo)`)
    .eq("id", marcacaoId).eq("proof_livros.usuario_id", usuarioId).maybeSingle();
  falhou(error, "marcação");
  if (!data) throw new ErroDeAcesso(404, "marcação não encontrada");
  return data;
}

export async function editarMarcacao(usuarioId, marcacaoId, bruto) {
  const atual = await exigirMarcacao(usuarioId, marcacaoId);
  const v = validarMarcacao({ cor: bruto?.cor, nota: bruto?.nota, tipo: bruto?.tipo }, { paginas: atual.proof_livros.paginas, parcial: true });
  const mudanca = Object.fromEntries(Object.entries(v.marcacao).filter(([k]) => bruto?.[k] !== undefined));
  if (!Object.keys(mudanca).length) return marcacaoParaTela(atual);
  const { data, error } = await supabase.from("proof_marcacoes").update({ ...mudanca, atualizado_em: new Date().toISOString() }).eq("id", marcacaoId).select(CAMPOS_DA_MARCACAO).single();
  falhou(error, "editar marcação");
  return marcacaoParaTela(data);
}

export async function apagarMarcacao(usuarioId, marcacaoId) {
  await exigirMarcacao(usuarioId, marcacaoId);
  const { error } = await supabase.from("proof_marcacoes").delete().eq("id", marcacaoId);
  falhou(error, "apagar marcação");
}

/** A marcação com o título do livro (para mandar ao caderno). */
export async function marcacaoComLivro(usuarioId, marcacaoId) {
  const m = await exigirMarcacao(usuarioId, marcacaoId);
  return { marcacao: marcacaoParaTela(m), livroId: m.livro_id, livroTitulo: m.proof_livros.titulo };
}
