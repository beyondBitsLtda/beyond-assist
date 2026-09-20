// A parte dos documentos que fala com o banco e com o armazenamento.
//
// As regras (como abrir cada tipo, montar a árvore, o que é uma volta de pastas) moram em
// src/dominio/documentos.js e não sabem que banco existe. Esta é a camada entre as duas.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./acesso.js";
import { nomeSeguro, extensaoDe } from "@/dominio/documentos.js";

export const BUCKET = "abacato-documentos";
export const TETO_DE_ARQUIVO = 50 * 1024 * 1024; // 50 MB — o mesmo do bucket

/**
 * Guarda o arquivo e cria a revisão.
 *
 * A ordem importa e é esta: arquivo primeiro, linha depois. Se o envio falhar, não sobra
 * revisão apontando para um arquivo que não existe — que é o estado impossível de consertar
 * pela tela, porque a tela mostraria o documento e ele não abriria nunca.
 *
 * O contrário, arquivo guardado sem linha, deixa um órfão ocupando espaço. É desperdício, não
 * defeito, e é o lado certo para errar.
 */
export async function guardarRevisao({ documentoId, arquivo, nota, usuarioId }) {
  if (!arquivo || typeof arquivo === "string") throw new ErroDeAcesso(400, "faltou o arquivo");
  if (arquivo.size > TETO_DE_ARQUIVO) {
    throw new ErroDeAcesso(400, `o arquivo tem ${(arquivo.size / 1048576).toFixed(1)} MB — o limite é 50 MB`);
  }
  if (arquivo.size === 0) throw new ErroDeAcesso(400, "o arquivo está vazio");

  const { data: ultima } = await supabase
    .from("abacato_revisoes").select("numero").eq("documento_id", documentoId)
    .order("numero", { ascending: false }).limit(1).maybeSingle();
  const numero = (ultima?.numero || 0) + 1;

  // O caminho leva o número da revisão e um sorteio. O número deixa o bucket legível quando
  // alguém precisar olhar o disco; o sorteio garante que reenviar a mesma revisão depois de um
  // erro não esbarre num arquivo que ficou para trás.
  const caminho = `${documentoId}/${String(numero).padStart(3, "0")}-${crypto.randomUUID().slice(0, 8)}-${nomeSeguro(arquivo.name)}`;

  const tipo = arquivo.type || tipoPelaExtensao(arquivo.name) || "application/octet-stream";
  const { error: erroUp } = await supabase.storage
    .from(BUCKET).upload(caminho, await arquivo.arrayBuffer(), { contentType: tipo, upsert: false });
  if (erroUp) throw new ErroDeAcesso(500, `não consegui guardar o arquivo: ${erroUp.message}`);

  const { data: revisao, error } = await supabase.from("abacato_revisoes").insert({
    documento_id: documentoId,
    numero,
    caminho,
    tipo,
    tamanho: arquivo.size,
    nota: nota?.trim() || null,
    criado_por: usuarioId || null,
  }).select("id, numero, caminho, tipo, tamanho, nota, criado_em").single();

  if (error) {
    // A linha não entrou: tira o arquivo, senão fica um órfão que ninguém sabe de onde veio.
    await supabase.storage.from(BUCKET).remove([caminho]).catch(() => {});
    throw new ErroDeAcesso(500, error.message);
  }

  await supabase.from("abacato_documentos")
    .update({ revisao_atual_id: revisao.id, atualizado_em: new Date().toISOString() })
    .eq("id", documentoId);

  return revisao;
}

/** O navegador às vezes não declara o tipo. A extensão é o desempate — melhor que
 *  `application/octet-stream`, que faria todo documento cair em "só dá para baixar". */
function tipoPelaExtensao(nome) {
  const mapa = {
    pdf: "application/pdf", html: "text/html", htm: "text/html",
    txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
    svg: "image/svg+xml", mp4: "video/mp4", mp3: "audio/mpeg",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip",
  };
  return mapa[extensaoDe(nome)] || null;
}

/**
 * O projeto inteiro: pastas, documentos e a revisão atual de cada um.
 *
 * Numa resposta só, como o quadro. Carregar pasta por pasta economizaria bytes na primeira
 * tela e pagaria com um pisca-pisca a cada clique na árvore — e uma árvore de pastas é feita
 * para ser percorrida depressa.
 */
export async function carregarProjeto(projetoId) {
  const { data: projeto, error } = await supabase
    .from("abacato_projetos").select("id, nome, descricao, cor, dono_id, arquivado, criado_em")
    .eq("id", projetoId).maybeSingle();
  if (error) throw new ErroDeAcesso(500, error.message);
  if (!projeto) throw new ErroDeAcesso(404, "projeto não encontrado");

  const [pastas, documentos] = await Promise.all([
    supabase.from("abacato_pastas").select("id, pai_id, nome, posicao")
      .eq("projeto_id", projetoId).eq("arquivada", false).order("posicao"),
    supabase.from("abacato_documentos")
      .select("id, pasta_id, nome, categoria, descricao, revisao_atual_id, criado_em, atualizado_em, origem")
      .eq("projeto_id", projetoId).eq("arquivado", false).order("nome"),
  ]);

  const idsDeRevisao = (documentos.data || []).map((d) => d.revisao_atual_id).filter(Boolean);
  const revisoes = idsDeRevisao.length
    ? (await supabase.from("abacato_revisoes")
        .select("id, documento_id, numero, tipo, tamanho, nota, criado_em").in("id", idsDeRevisao)).data || []
    : [];
  const revisaoPorId = new Map(revisoes.map((r) => [r.id, r]));

  // Quantas revisões cada documento tem. É a informação que diz se vale abrir o histórico —
  // "3 versões" convida, e um documento com uma versão só não precisa nem mostrar o link.
  const contagem = new Map();
  if (documentos.data?.length) {
    const { data: todas } = await supabase.from("abacato_revisoes")
      .select("documento_id").in("documento_id", documentos.data.map((d) => d.id));
    for (const r of todas || []) contagem.set(r.documento_id, (contagem.get(r.documento_id) || 0) + 1);
  }

  return {
    projeto,
    pastas: pastas.data || [],
    documentos: (documentos.data || []).map((d) => ({
      ...d,
      revisao: revisaoPorId.get(d.revisao_atual_id) || null,
      revisoes: contagem.get(d.id) || 0,
    })),
  };
}

/**
 * Uma URL para ler o arquivo, que vence sozinha.
 *
 * O bucket é privado: sem assinatura, o arquivo não sai. Dez minutos é tempo de sobra para
 * abrir e ler, e curto o bastante para um endereço copiado por engano de um histórico de
 * navegação não virar acesso permanente a um contrato.
 */
export async function urlParaLer(caminho, segundos = 600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, segundos);
  if (error) throw new ErroDeAcesso(500, `não consegui abrir o arquivo: ${error.message}`);
  return data.signedUrl;
}
