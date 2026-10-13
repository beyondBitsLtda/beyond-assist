// A parte dos comentários que fala com o banco e com o armazenamento.
//
// As regras (o que pode ser enviado, quem edita, quem apaga) moram em src/dominio/comentarios.js.
// Quem chama já passou pelo `exigir` — aqui ninguém decide permissão de quadro de novo.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./acesso.js";
import { exigirCabeNoQuadro } from "./limites.js";
import { caminhoDaImagem, podeApagarComentario, podeEditarComentario } from "@/dominio/comentarios.js";

export const BUCKET_DE_COMENTARIOS = "abacato-comentarios";

// Uma hora: o card aberto fica na tela um bom tempo, e a imagem precisa continuar abrindo
// quando se clica nela vinte minutos depois. Curto o bastante para um endereço copiado não
// virar acesso permanente.
const VIDA_DO_ENDERECO = 3600;

const CAMPOS = "id, card_id, autor_id, texto, criado_em, editado_em, abacato_usuarios ( id, nome, email )";

/** Os comentários do card, do mais novo para o mais antigo, com as imagens já assinadas. */
export async function listarComentarios(cardId, { usuarioId, poderes }) {
  const { data: linhas, error } = await supabase
    .from("abacato_comentarios").select(CAMPOS)
    .eq("card_id", cardId).order("criado_em", { ascending: false }).limit(200);
  if (error) throw new ErroDeAcesso(500, error.message);
  if (!linhas?.length) return [];

  const { data: anexos } = await supabase
    .from("abacato_comentario_anexos").select("id, comentario_id, caminho, nome, tipo, tamanho, posicao")
    .in("comentario_id", linhas.map((l) => l.id)).order("posicao");

  // Uma assinatura em lote para todas as imagens do card, e não uma ida ao Storage por imagem.
  const urls = new Map();
  if (anexos?.length) {
    const { data: assinadas } = await supabase.storage
      .from(BUCKET_DE_COMENTARIOS).createSignedUrls(anexos.map((a) => a.caminho), VIDA_DO_ENDERECO);
    for (const a of assinadas || []) if (a.signedUrl) urls.set(a.path, a.signedUrl);
  }
  const anexosDo = new Map();
  for (const a of anexos || []) {
    if (!anexosDo.has(a.comentario_id)) anexosDo.set(a.comentario_id, []);
    anexosDo.get(a.comentario_id).push({ id: a.id, nome: a.nome, tipo: a.tipo, tamanho: a.tamanho, url: urls.get(a.caminho) || null });
  }

  return linhas.map((l) => montar(l, anexosDo.get(l.id) || [], { usuarioId, poderes }));
}

function montar(l, anexos, { usuarioId, poderes }) {
  return {
    id: l.id,
    texto: l.texto,
    criadoEm: l.criado_em,
    editadoEm: l.editado_em,
    autor: l.abacato_usuarios ? { id: l.abacato_usuarios.id, nome: l.abacato_usuarios.nome, email: l.abacato_usuarios.email } : null,
    anexos,
    podeEditar: podeEditarComentario({ autorId: l.autor_id, usuarioId }),
    podeApagar: podeApagarComentario({ autorId: l.autor_id, usuarioId, poderes }),
  };
}

/**
 * Grava um comentário com as imagens.
 *
 * A ordem é: espaço do plano → imagens no Storage → linha do comentário → linhas das imagens.
 * Se qualquer passo depois do envio falhar, as imagens já enviadas são apagadas: não pode
 * sobrar comentário apontando para imagem que não existe, nem imagem ocupando espaço do plano
 * sem comentário nenhum.
 */
export async function criarComentario({ cardId, quadroId, usuarioId, texto, arquivos }) {
  const bytes = arquivos.reduce((s, a) => s + a.size, 0);
  if (bytes) await exigirCabeNoQuadro(quadroId, bytes);

  const enviados = [];
  const desfazer = async () => {
    if (enviados.length) await supabase.storage.from(BUCKET_DE_COMENTARIOS).remove(enviados.map((e) => e.caminho)).catch(() => {});
  };

  try {
    for (const arquivo of arquivos) {
      const caminho = caminhoDaImagem({ quadroId, cardId, tipo: arquivo.type, sorteio: crypto.randomUUID() });
      const { error } = await supabase.storage
        .from(BUCKET_DE_COMENTARIOS)
        .upload(caminho, await arquivo.arrayBuffer(), { contentType: arquivo.type, upsert: false });
      if (error) throw new ErroDeAcesso(500, `não consegui guardar a imagem: ${error.message}`);
      enviados.push({ caminho, nome: String(arquivo.name || "imagem").slice(0, 200), tipo: arquivo.type, tamanho: arquivo.size });
    }

    const { data: linha, error } = await supabase
      .from("abacato_comentarios").insert({ card_id: cardId, autor_id: usuarioId, texto }).select(CAMPOS).single();
    if (error) throw new ErroDeAcesso(500, error.message);

    if (enviados.length) {
      const { error: erroAnexos } = await supabase.from("abacato_comentario_anexos").insert(
        enviados.map((e, i) => ({ comentario_id: linha.id, quadro_id: quadroId, caminho: e.caminho, nome: e.nome, tipo: e.tipo, tamanho: e.tamanho, posicao: i })),
      );
      if (erroAnexos) {
        await supabase.from("abacato_comentarios").delete().eq("id", linha.id);
        throw new ErroDeAcesso(500, erroAnexos.message);
      }
    }

    return linha.id;
  } catch (e) {
    await desfazer();
    throw e;
  }
}

export async function editarComentario(id, texto) {
  const { error } = await supabase
    .from("abacato_comentarios").update({ texto, editado_em: new Date().toISOString() }).eq("id", id);
  if (error) throw new ErroDeAcesso(500, error.message);
}

/** Apaga o comentário e as imagens dele. Linha primeiro: se o Storage falhar depois, sobra um
 *  arquivo órfão (desperdício), e não um comentário com imagem quebrada (defeito). */
export async function apagarComentario(id) {
  const { data: anexos } = await supabase
    .from("abacato_comentario_anexos").select("caminho").eq("comentario_id", id);
  const { error } = await supabase.from("abacato_comentarios").delete().eq("id", id);
  if (error) throw new ErroDeAcesso(500, error.message);
  if (anexos?.length) {
    await supabase.storage.from(BUCKET_DE_COMENTARIOS).remove(anexos.map((a) => a.caminho)).catch(() => {});
  }
}
