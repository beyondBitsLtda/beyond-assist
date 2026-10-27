// A Biblioteca Colaborativa no banco e no Storage (26/10/2026). As regras moram em
// src/dominio/acervo.js; a migração é db/020-biblioteca-colaborativa.sql.
//
// O caminho de um envio:
//   1. o navegador lê o PDF (pdf.js): páginas, sumário, capa e o SHA-256 → POST /api/acervo;
//   2. o servidor confere (tipo, campos, limite do dia, duplicado), cria a linha "enviando" e
//      ASSINA um endereço de envio para <autor>/<id>.pdf no bucket privado proof-acervo;
//   3. o navegador manda o arquivo direto para o Storage e avisa: a linha vai para a fila ("pendente").
//   Link (vídeo, artigo por link) não tem arquivo: entra direto na fila.
//
// O bibliotecário é o administrador (PROOF_ADMIN_EMAIL, a conta da Lisa) e o líder do ranking da
// semana. Aprovado, quem enviou ganha as moedas do tipo (no nível de agora da biblioteca) e o
// bibliotecário ganha pela revisão. O dinheiro segue a ordem de sempre: a fila muda primeiro (só
// uma revisão pega a linha "pendente"), as moedas entram depois; se o lançamento falhar, a linha
// volta para a fila.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { buscarTodas } from "./estudo.js";
import { nomesPublicos, saldoDoUsuario, creditarMoedas, desfazerCreditos, gastarMoedas } from "./reino.js";
import { BUCKET_DO_ACERVO, livroParaTela } from "./biblioteca.js";
import { uuidValido } from "@/dominio/cadernos.js";
import { diaDe } from "@/dominio/datas.js";
import { PERSONAGENS } from "@/dominio/personagens.js";
import { LIMITES_DA_BIBLIOTECA } from "@/dominio/biblioteca.js";
import {
  TIPOS_DE_MATERIAL, ORDEM_DOS_TIPOS, ENVIOS_POR_DIA, GORJETAS, PAGAMENTO_DA_REVISAO,
  validarMaterial, estadoDaBiblioteca, recompensaDe, podeRevisar, podeRetirar, podeAgradecer, motivoValido, videoDoLink,
} from "@/dominio/acervo.js";

const VIDA_DO_ENDERECO = 3 * 60 * 60;
const CAMPOS = "id, autor_id, tipo, titulo, autores, categoria, assunto, descricao, arquivo, tamanho, paginas, link, status, motivo, revisor_id, revisado_em, recompensa, criado_em";

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

/** Os bibliotecários de agora: o administrador e o líder do ranking da semana (sem repetir). */
export async function bibliotecarios() {
  const email = String(process.env.PROOF_ADMIN_EMAIL || "").trim().toLowerCase();
  const [admin, semana] = await Promise.all([
    email ? supabase.from("abacato_usuarios").select("id").ilike("email", email).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("proof_ranking_semana").select("usuario_id, pontos").order("pontos", { ascending: false }).order("usuario_id").limit(1),
  ]);
  const lista = [];
  if (admin.data?.id) lista.push({ id: admin.data.id, papel: "dono" });
  const lider = semana.data?.[0];
  if (lider && Number(lider.pontos) > 0) {
    const ja = lista.find((b) => b.id === lider.usuario_id);
    if (ja) ja.lider = true;
    else lista.push({ id: lider.usuario_id, papel: "lider" });
  }
  return lista;
}

async function exigirMaterial(id, campos = CAMPOS) {
  if (!uuidValido(id)) throw new ErroDeAcesso(404, "material não encontrado");
  const { data, error } = await supabase.from("proof_acervo").select(campos).eq("id", id).maybeSingle();
  falhou(error, "material");
  if (!data) throw new ErroDeAcesso(404, "material não encontrado");
  return data;
}

/** As contagens de aprovados por tipo (o nível da biblioteca e de cada construção). */
async function contagensAprovadas() {
  const linhas = await buscarTodas(() => supabase.from("proof_acervo").select("tipo").eq("status", "aprovado").order("id"));
  const c = Object.fromEntries(ORDEM_DOS_TIPOS.map((t) => [t, 0]));
  for (const l of linhas) c[l.tipo] = (c[l.tipo] || 0) + 1;
  return c;
}

const inicioDeHoje = () => `${diaDe()}T00:00:00-03:00`;

async function enviosDeHoje(usuarioId) {
  const { count, error } = await supabase.from("proof_acervo").select("id", { count: "exact", head: true })
    .eq("autor_id", usuarioId).neq("status", "enviando").gte("criado_em", inicioDeHoje());
  falhou(error, "envios de hoje");
  return count || 0;
}

function materialParaTela(m, extra = {}) {
  return {
    id: m.id, tipo: m.tipo, titulo: m.titulo, autores: m.autores, categoria: m.categoria, assunto: m.assunto, descricao: m.descricao,
    paginas: m.paginas, tamanho: Number(m.tamanho || 0), temPdf: Boolean(m.arquivo),
    link: m.tipo === "artigo" ? m.link : null, video: TIPOS_DE_MATERIAL[m.tipo]?.formato === "video" ? videoDoLink(m.link) : null,
    status: m.status, motivo: m.motivo, recompensa: m.recompensa, enviadoEm: m.criado_em, revisadoEm: m.revisado_em, ...extra,
  };
}

// ---------------------------------------------------------------- a tela

/**
 * A biblioteca como a tela mostra: o nível dela e de cada construção, as recompensas de agora, o
 * acervo aprovado (com quem trouxe e as gorjetas), os meus envios, a fila (para o bibliotecário) e
 * quem mais contribuiu (os avatares que andam pela ilha).
 */
export async function estadoDoAcervo(usuarioId) {
  const [bib, aprovados, meusR, gorjetas, minhasCopias, saldo, hoje] = await Promise.all([
    bibliotecarios(),
    buscarTodas(() => supabase.from("proof_acervo").select(CAMPOS).eq("status", "aprovado").order("revisado_em", { ascending: false }).order("id")),
    supabase.from("proof_acervo").select(CAMPOS).eq("autor_id", usuarioId).neq("status", "enviando").order("criado_em", { ascending: false }).limit(100),
    buscarTodas(() => supabase.from("proof_acervo_gorjetas").select("material_id, de_id, moedas").order("material_id").order("de_id")),
    supabase.from("proof_livros").select("id, acervo_id").eq("usuario_id", usuarioId).not("acervo_id", "is", null),
    saldoDoUsuario(usuarioId),
    enviosDeHoje(usuarioId),
  ]);
  falhou(meusR.error, "meus envios");
  const souBibliotecario = bib.some((b) => b.id === usuarioId);
  let fila = [];
  if (souBibliotecario) {
    const { data, error } = await supabase.from("proof_acervo").select(CAMPOS).eq("status", "pendente").order("criado_em").limit(200);
    falhou(error, "fila");
    fila = data || [];
  }

  const contagens = Object.fromEntries(ORDEM_DOS_TIPOS.map((t) => [t, 0]));
  for (const m of aprovados) contagens[m.tipo] += 1;
  const biblioteca = estadoDaBiblioteca(contagens);

  // quem trouxe: nome público e o personagem do Neuro (o avatar na ilha)
  const pessoas = [...new Set([...aprovados.map((m) => m.autor_id), ...fila.map((m) => m.autor_id), ...bib.map((b) => b.id)])];
  const [nomes, reinos] = await Promise.all([
    nomesPublicos(pessoas),
    pessoas.length ? supabase.from("proof_reinos").select("usuario_id, personagem").in("usuario_id", pessoas) : Promise.resolve({ data: [] }),
  ]);
  const personagem = new Map((reinos.data || []).map((r) => [r.usuario_id, PERSONAGENS[r.personagem] ? r.personagem : "neuro"]));
  const pessoa = (id) => ({ id, nome: nomes.get(id) || "Alguém", personagem: personagem.get(id) || "neuro" });

  const porMaterial = new Map();
  for (const g of gorjetas) {
    const x = porMaterial.get(g.material_id) || { moedas: 0, quantos: 0, eu: false };
    x.moedas += g.moedas; x.quantos += 1; if (g.de_id === usuarioId) x.eu = true;
    porMaterial.set(g.material_id, x);
  }
  const copia = new Map((minhasCopias.data || []).map((l) => [l.acervo_id, l.id]));

  // os contribuidores (os avatares da ilha): quem mais trouxe, com o que trouxe por tipo
  const contrib = new Map();
  for (const m of aprovados) {
    const c = contrib.get(m.autor_id) || { ...pessoa(m.autor_id), total: 0, porTipo: Object.fromEntries(ORDEM_DOS_TIPOS.map((t) => [t, 0])), ultimo: null, gorjetas: 0 };
    c.total += 1; c.porTipo[m.tipo] += 1;
    if (!c.ultimo) c.ultimo = { id: m.id, titulo: m.titulo, tipo: m.tipo };
    c.gorjetas += porMaterial.get(m.id)?.moedas || 0;
    contrib.set(m.autor_id, c);
  }

  return {
    biblioteca,
    bibliotecarios: bib.map((b) => ({ ...pessoa(b.id), papel: b.papel, lider: Boolean(b.lider || b.papel === "lider") })),
    souBibliotecario,
    materiais: aprovados.map((m) => {
      const g = porMaterial.get(m.id);
      return materialParaTela(m, { autor: pessoa(m.autor_id), gorjetas: { moedas: g?.moedas || 0, quantos: g?.quantos || 0 }, agradeci: Boolean(g?.eu), meu: m.autor_id === usuarioId, naMinhaBiblioteca: copia.get(m.id) || null });
    }),
    meus: (meusR.data || []).map((m) => materialParaTela(m)),
    fila: fila.map((m) => materialParaTela(m, { autor: pessoa(m.autor_id), meu: m.autor_id === usuarioId })),
    contribuidores: [...contrib.values()].sort((a, b) => b.total - a.total || b.gorjetas - a.gorjetas).slice(0, 12),
    envios: { hoje, porDia: ENVIOS_POR_DIA },
    gorjetas: GORJETAS,
    pagamentoDaRevisao: PAGAMENTO_DA_REVISAO,
    saldo,
  };
}

// ---------------------------------------------------------------- enviar

/** Passos 1 e 2: confere e cria. PDF: devolve o endereço de envio; link: já entra na fila. */
export async function criarMaterial(usuarioId, bruto) {
  const v = validarMaterial(bruto);
  if (!v.ok) throw new ErroDeAcesso(400, v.erros.join("; "));
  if ((await enviosDeHoje(usuarioId)) >= ENVIOS_POR_DIA) throw new ErroDeAcesso(429, `o limite é de ${ENVIOS_POR_DIA} envios por dia — volte amanhã`);
  const m = v.material;
  const [mesmaChave, mesmoPdf] = await Promise.all([
    supabase.from("proof_acervo").select("id, status").eq("chave", v.chave).in("status", ["pendente", "aprovado"]).limit(1),
    m.pdf?.hash ? supabase.from("proof_acervo").select("id, status").eq("hash", m.pdf.hash).in("status", ["pendente", "aprovado"]).limit(1) : Promise.resolve({ data: [] }),
  ]);
  const igual = mesmaChave.data?.[0] || mesmoPdf.data?.[0];
  if (igual) throw new ErroDeAcesso(409, igual.status === "aprovado" ? "esse material já está no acervo" : "esse material já está na fila do bibliotecário");

  const id = crypto.randomUUID();
  const arquivo = m.pdf ? `${usuarioId}/${id}.pdf` : null;
  const linha = {
    id, autor_id: usuarioId, tipo: m.tipo, titulo: m.titulo, autores: m.autores, categoria: m.categoria, assunto: m.assunto, descricao: m.descricao,
    arquivo, tamanho: m.pdf?.tamanho || 0, paginas: m.pdf?.paginas || 0, sumario: m.pdf?.sumario || [], hash: m.pdf?.hash || null,
    capa: m.capa, link: m.link, chave: v.chave, status: m.pdf ? "enviando" : "pendente",
  };
  const { data, error } = await supabase.from("proof_acervo").insert(linha).select(CAMPOS).single();
  if (error?.code === "23505") throw new ErroDeAcesso(409, "esse material já está no acervo ou na fila");
  falhou(error, "enviar material");
  if (!arquivo) return { material: materialParaTela(data) };
  const { data: envio, error: e2 } = await supabase.storage.from(BUCKET_DO_ACERVO).createSignedUploadUrl(arquivo);
  if (e2 || !envio?.signedUrl) {
    await supabase.from("proof_acervo").delete().eq("id", id);
    throw new ErroDeAcesso(502, `o armazenamento não aceitou o envio agora: ${e2?.message || "sem endereço"}`);
  }
  return { material: materialParaTela(data), envio: { url: envio.signedUrl } };
}

/** Passo 3: o PDF chegou? Então o material vai para a fila do bibliotecário. */
export async function confirmarEnvio(usuarioId, id) {
  const m = await exigirMaterial(id);
  if (m.autor_id !== usuarioId) throw new ErroDeAcesso(404, "material não encontrado");
  if (m.status !== "enviando") return materialParaTela(m);
  const [pasta, nome] = m.arquivo.split("/");
  const { data: lista, error } = await supabase.storage.from(BUCKET_DO_ACERVO).list(pasta, { search: nome, limit: 5 });
  if (error) throw new ErroDeAcesso(502, `não consegui conferir o arquivo: ${error.message}`);
  const objeto = (lista || []).find((o) => o.name === nome);
  if (!objeto) throw new ErroDeAcesso(409, "o PDF não chegou ao armazenamento — tente enviar de novo");
  const { data, error: e2 } = await supabase.from("proof_acervo")
    .update({ status: "pendente", tamanho: Number(objeto.metadata?.size || m.tamanho), atualizado_em: new Date().toISOString() })
    .eq("id", id).eq("status", "enviando").select(CAMPOS).maybeSingle();
  if (e2?.code === "23505") {
    // alguém mandou o mesmo material enquanto este subia
    await apagarEnvio(usuarioId, id).catch(() => {});
    throw new ErroDeAcesso(409, "esse material acabou de entrar no acervo por outra pessoa");
  }
  falhou(e2, "confirmar envio");
  return materialParaTela(data || m);
}

/** Quem enviou desiste (ainda na fila, recusado ou o envio que não terminou): apaga o arquivo e a linha. */
export async function apagarEnvio(usuarioId, id) {
  const m = await exigirMaterial(id);
  if (m.autor_id !== usuarioId) throw new ErroDeAcesso(404, "material não encontrado");
  if (m.status === "aprovado") throw new ErroDeAcesso(409, "o material já está no acervo — para tirar, fale com o bibliotecário");
  if (m.arquivo && m.status !== "retirado") await supabase.storage.from(BUCKET_DO_ACERVO).remove([m.arquivo]);
  const { error } = await supabase.from("proof_acervo").delete().eq("id", id).eq("autor_id", usuarioId).neq("status", "aprovado");
  falhou(error, "apagar envio");
}

// ---------------------------------------------------------------- revisar

/**
 * O bibliotecário decide: `aprovar`, `recusar` (com motivo) ou `retirar` (o que já está no acervo,
 * com motivo). Aprovar paga quem enviou; aprovar ou recusar paga a revisão.
 */
export async function revisarMaterial(usuarioId, id, { decisao, motivo: brutoDoMotivo } = {}) {
  const [bib, m] = await Promise.all([bibliotecarios(), exigirMaterial(id)]);
  const agora = new Date().toISOString();

  if (decisao === "retirar") {
    const pode = podeRetirar({ usuarioId, material: m, bibliotecarios: bib });
    if (!pode.ok) throw new ErroDeAcesso(403, pode.motivo);
    const motivo = motivoValido(brutoDoMotivo);
    if (!motivo) throw new ErroDeAcesso(400, "diga por que o material sai do acervo");
    const { data, error } = await supabase.from("proof_acervo").update({ status: "retirado", motivo, revisor_id: usuarioId, revisado_em: agora, atualizado_em: agora })
      .eq("id", id).eq("status", "aprovado").select(CAMPOS).maybeSingle();
    falhou(error, "retirar");
    if (!data) throw new ErroDeAcesso(409, "o material mudou enquanto você decidia — recarregue");
    return { material: materialParaTela(data) };
  }

  if (decisao !== "aprovar" && decisao !== "recusar") throw new ErroDeAcesso(400, "aprovar ou recusar?");
  const pode = podeRevisar({ usuarioId, material: m, bibliotecarios: bib });
  if (!pode.ok) throw new ErroDeAcesso(403, pode.motivo);
  const motivo = decisao === "recusar" ? motivoValido(brutoDoMotivo) : null;
  if (decisao === "recusar" && !motivo) throw new ErroDeAcesso(400, "diga o motivo da recusa (quem enviou precisa saber o que mudar)");
  const recompensa = decisao === "aprovar" ? recompensaDe(m.tipo, estadoDaBiblioteca(await contagensAprovadas()).nivel) : 0;

  // 1) a fila muda primeiro: só uma revisão pega a linha "pendente"
  const { data, error } = await supabase.from("proof_acervo")
    .update({ status: decisao === "aprovar" ? "aprovado" : "recusado", motivo, revisor_id: usuarioId, revisado_em: agora, recompensa, atualizado_em: agora })
    .eq("id", id).eq("status", "pendente").select(CAMPOS).maybeSingle();
  if (error?.code === "23505") throw new ErroDeAcesso(409, "já existe um material igual no acervo");
  falhou(error, "revisar");
  if (!data) throw new ErroDeAcesso(409, "outro bibliotecário revisou esse envio antes");

  // 2) as moedas; se falharem, a linha volta para a fila
  const lancamentos = [];
  const pagamento = m.autor_id === usuarioId ? 0 : PAGAMENTO_DA_REVISAO;
  try {
    if (recompensa > 0) lancamentos.push(await creditarMoedas(m.autor_id, "acervo", recompensa, { material: id, tipo: m.tipo }));
    if (pagamento > 0) lancamentos.push(await creditarMoedas(usuarioId, "acervo_revisao", pagamento, { material: id, decisao }));
  } catch (e) {
    await desfazerCreditos(lancamentos);
    await supabase.from("proof_acervo").update({ status: "pendente", motivo: null, revisor_id: null, revisado_em: null, recompensa: 0 }).eq("id", id);
    throw e;
  }
  // recusado não fica ocupando o disco (quem enviou pode mandar de novo, corrigido)
  if (decisao === "recusar" && m.arquivo) await supabase.storage.from(BUCKET_DO_ACERVO).remove([m.arquivo]).catch(() => {});
  return { material: materialParaTela(data), recompensa, pagamento };
}

// ---------------------------------------------------------------- agradecer

/** A gorjeta: sai do saldo de quem agradece e entra no de quem trouxe (uma por material por pessoa). */
export async function agradecer(usuarioId, id, moedas) {
  const m = await exigirMaterial(id);
  const [ja, saldo] = await Promise.all([
    supabase.from("proof_acervo_gorjetas").select("material_id").eq("material_id", id).eq("de_id", usuarioId).maybeSingle(),
    saldoDoUsuario(usuarioId),
  ]);
  const pode = podeAgradecer({ usuarioId, material: m, moedas, saldo, jaAgradeceu: Boolean(ja.data) });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const marca = await supabase.from("proof_acervo_gorjetas").insert({ material_id: id, de_id: usuarioId, para_id: m.autor_id, moedas: pode.moedas });
  if (marca.error?.code === "23505") throw new ErroDeAcesso(409, "você já agradeceu por esse material");
  falhou(marca.error, "gorjeta");
  try {
    await gastarMoedas(usuarioId, "gorjeta_dada", pode.moedas, { material: id, para: m.autor_id });
  } catch (e) {
    await supabase.from("proof_acervo_gorjetas").delete().eq("material_id", id).eq("de_id", usuarioId);
    throw e;
  }
  try {
    await creditarMoedas(m.autor_id, "gorjeta_recebida", pode.moedas, { material: id, de: usuarioId });
  } catch (e) {
    // não chegou a quem trouxe: devolve a quem deu e desfaz a gorjeta
    await creditarMoedas(usuarioId, "gorjeta_dada", pode.moedas, { material: id, estorno: true }).catch(() => {});
    await supabase.from("proof_acervo_gorjetas").delete().eq("material_id", id).eq("de_id", usuarioId);
    throw e;
  }
  return { moedas: pode.moedas, saldo: await saldoDoUsuario(usuarioId) };
}

// ---------------------------------------------------------------- ver e ler

async function podeVer(usuarioId, m) {
  if (m.status === "aprovado" || m.autor_id === usuarioId) return true;
  return (await bibliotecarios()).some((b) => b.id === usuarioId);
}

/** A capa (data URL no banco) como imagem, para o <img> da tela. */
export async function capaDoMaterial(usuarioId, id) {
  const m = await exigirMaterial(id, "id, autor_id, status, capa");
  if (!m.capa || !(await podeVer(usuarioId, m))) return null;
  const [cabeca, base64] = m.capa.split(",");
  const tipo = cabeca.match(/^data:(image\/(?:jpeg|png|webp));base64$/)?.[1];
  if (!tipo || !base64) return null;
  return { tipo, bytes: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)) };
}

/** Para espiar o PDF (o bibliotecário revisando, quem enviou conferindo): um endereço assinado. */
export async function verMaterial(usuarioId, id) {
  const m = await exigirMaterial(id);
  if (!(await podeVer(usuarioId, m))) throw new ErroDeAcesso(404, "material não encontrado");
  let endereco = null;
  if (m.arquivo && m.status !== "enviando" && m.status !== "recusado") {
    const { data, error } = await supabase.storage.from(BUCKET_DO_ACERVO).createSignedUrl(m.arquivo, VIDA_DO_ENDERECO);
    if (error || !data?.signedUrl) throw new ErroDeAcesso(502, `não consegui abrir o PDF agora: ${error?.message || "sem endereço"}`);
    endereco = data.signedUrl;
  }
  return { material: materialParaTela(m), endereco };
}

/**
 * "Ler na minha biblioteca": cria (uma vez) o livro da pessoa apontando para o PDF do acervo e
 * devolve o endereço para o navegador tirar o texto das páginas (a busca e os cursos usam).
 */
export async function levarParaMinhaBiblioteca(usuarioId, id) {
  const m = await exigirMaterial(id, "id, tipo, titulo, autores, arquivo, tamanho, paginas, sumario, capa, status");
  if (m.status !== "aprovado" || !m.arquivo) throw new ErroDeAcesso(404, "esse material não tem PDF no acervo");
  const assinar = async () => {
    const { data, error } = await supabase.storage.from(BUCKET_DO_ACERVO).createSignedUrl(m.arquivo, VIDA_DO_ENDERECO);
    if (error || !data?.signedUrl) throw new ErroDeAcesso(502, `não consegui abrir o PDF agora: ${error?.message || "sem endereço"}`);
    return data.signedUrl;
  };
  const CAMPOS_DO_LIVRO = "id, titulo, autor, arquivo, tamanho, paginas, sumario, capa, status, paginas_com_texto, ultima_pagina, criado_em, atualizado_em, lido_em, acervo_id";
  const { data: ja } = await supabase.from("proof_livros").select(CAMPOS_DO_LIVRO).eq("usuario_id", usuarioId).eq("acervo_id", id).maybeSingle();
  if (ja) return { livro: livroParaTela(ja), endereco: ja.status === "pronto" ? null : await assinar(), novo: false };
  const { count } = await supabase.from("proof_livros").select("id", { count: "exact", head: true }).eq("usuario_id", usuarioId);
  if ((count || 0) >= LIMITES_DA_BIBLIOTECA.livros) throw new ErroDeAcesso(403, `a sua biblioteca chegou a ${LIMITES_DA_BIBLIOTECA.livros} livros`);
  const { data, error } = await supabase.from("proof_livros").insert({
    id: crypto.randomUUID(), usuario_id: usuarioId, acervo_id: m.id, arquivo: m.arquivo,
    titulo: m.titulo.slice(0, 200), autor: m.autores || "", tamanho: m.tamanho, paginas: m.paginas, sumario: m.sumario || [],
    capa: m.capa && m.capa.length <= LIMITES_DA_BIBLIOTECA.capa ? m.capa : null, status: "lendo",
  }).select(CAMPOS_DO_LIVRO).single();
  if (error?.code === "23505") return levarParaMinhaBiblioteca(usuarioId, id); // dois cliques: o outro já criou
  falhou(error, "levar para a biblioteca");
  return { livro: livroParaTela(data), endereco: await assinar(), novo: true };
}
