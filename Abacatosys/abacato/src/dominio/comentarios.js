// As regras dos comentários de card: o que pode ser enviado e quem pode mexer em quê.
//
// Não sabe que banco existe — é só domínio, testado em scripts/comentario-check.mjs. A rota
// confere aqui ANTES de subir qualquer arquivo, para um envio inválido não deixar imagem órfã
// no Storage.

export const TIPOS_DE_IMAGEM = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
export const TETO_DA_IMAGEM = 10 * 1024 * 1024; // 10 MB, o mesmo do bucket
export const MAXIMO_DE_IMAGENS = 6;
export const TETO_DO_TEXTO = 5000;

const mb = (bytes) => (bytes / 1048576).toFixed(1);

/**
 * Confere um comentário antes de gravar.
 *
 * `imagens` são `{ tipo, tamanho, nome }` — o que a rota lê do arquivo enviado. Devolve
 * `{ ok: true, texto }` com o texto já aparado, ou `{ ok: false, erro }` com a frase que a
 * tela mostra. Um comentário só com imagem vale; um vazio dos dois lados, não.
 */
export function conferirComentario({ texto, imagens = [] }) {
  const limpo = String(texto ?? "").replace(/\r\n/g, "\n").trim();
  if (!limpo && !imagens.length) return { ok: false, erro: "escreva algo ou anexe uma imagem" };
  if (limpo.length > TETO_DO_TEXTO) {
    return { ok: false, erro: `o comentário tem ${limpo.length} caracteres — o limite é ${TETO_DO_TEXTO}` };
  }
  if (imagens.length > MAXIMO_DE_IMAGENS) {
    return { ok: false, erro: `no máximo ${MAXIMO_DE_IMAGENS} imagens por comentário` };
  }
  for (const img of imagens) {
    const nome = img.nome ? `"${img.nome}"` : "a imagem";
    if (!TIPOS_DE_IMAGEM[img.tipo]) {
      return { ok: false, erro: `${nome} não é uma imagem aceita (${img.tipo || "tipo desconhecido"}) — use JPG, PNG, WEBP, GIF ou AVIF` };
    }
    if (!(img.tamanho > 0)) return { ok: false, erro: `${nome} está vazia` };
    if (img.tamanho > TETO_DA_IMAGEM) {
      return { ok: false, erro: `${nome} tem ${mb(img.tamanho)} MB — o limite é ${mb(TETO_DA_IMAGEM)} MB` };
    }
  }
  return { ok: true, texto: limpo };
}

/** Onde a imagem mora no bucket. O nome é sorteado: o nome original ("contrato-cliente.png")
 *  não vai para o caminho, só para a coluna `nome`, que só quem vê o quadro lê. */
export function caminhoDaImagem({ quadroId, cardId, tipo, sorteio }) {
  return `${quadroId}/${cardId}/${sorteio}.${TIPOS_DE_IMAGEM[tipo] || "bin"}`;
}

/** Editar o texto é só de quem escreveu: mudar as palavras de outra pessoa, com o nome dela
 *  em cima, é pôr na boca dela o que ela não disse. */
export function podeEditarComentario({ autorId, usuarioId }) {
  return Boolean(autorId) && autorId === usuarioId;
}

/** Apagar: quem escreveu, ou quem pode apagar coisas no quadro (dono e editor) — para tirar
 *  um print com dado que não devia estar ali, mesmo que o autor tenha saído do quadro. */
export function podeApagarComentario({ autorId, usuarioId, poderes }) {
  return podeEditarComentario({ autorId, usuarioId }) || Boolean(poderes?.apagar);
}
