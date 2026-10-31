// A FRASE-SENHA (pedido de 31/10/2026, da proposta dos cursos que não são de programação: "fraude no
// ranking"). Toda entrega que vai com áudio, foto ou vídeo traz uma frase sorteada para aquele
// desafio — falada no começo do áudio ou do vídeo, ou escrita num papel que aparece numa das fotos.
// Assim a gravação de outra pessoa (ou uma baixada da internet) não passa como sua.
//
// A Lisa procura a frase ao avaliar. Sem ela, a entrega vale no máximo 60: ainda aprova (a IA pode
// não ter ouvido direito, e ninguém fica travado), mas não sobe o ranking com nota alta. Puro.

const COISAS = [
  "gato", "lua", "mesa", "rio", "sapo", "bola", "pipa", "casa", "trem", "flor", "barco", "nuvem", "pato", "vela", "chave",
  "ponte", "folha", "pedra", "sino", "tigre", "peixe", "livro", "caneca", "janela", "estrela", "girafa", "panela", "cometa",
];
const CORES = ["azul", "verde", "laranja", "cinza", "rosa", "lilás", "vinho", "dourada", "prata", "marrom", "violeta", "bege"];

/** Uma frase-senha nova ("lua verde 27") a partir de bytes sorteados (crypto no servidor). */
export function gerarSenha(bytes) {
  const b = Array.from(bytes || []);
  if (b.length < 3) throw new Error("bytes insuficientes");
  return `${COISAS[b[0] % COISAS.length]} ${CORES[b[1] % CORES.length]} ${10 + (b[2] % 90)}`;
}

/** As evidências que pedem a frase-senha: as que mostram a pessoa fazendo (áudio, foto, vídeo). */
export const EVIDENCIAS_COM_SENHA = ["audio", "imagens", "video"];
export const precisaDeSenha = (evidencias) => (evidencias || []).some((e) => EVIDENCIAS_COM_SENHA.includes(e));

/** A entrega trouxe mídia em que a frase poderia estar? */
export const entregaTemMidia = (entrega) => Boolean(entrega?.audio || entrega?.video || entrega?.imagens?.length);

export const TETO_SEM_SENHA = 60;
export const RESULTADOS_DA_SENHA = ["encontrada", "nao_encontrada"];

/** O que a avaliadora precisa saber da frase-senha (vai no pedido à IA). */
export function instrucaoDaSenha(senha) {
  return [
    `- FRASE-SENHA deste desafio: "${senha}". Ela deve ser FALADA (no começo do áudio ou do vídeo) ou aparecer ESCRITA num papel numa das fotos.`,
    "  Em `senha`, diga \"encontrada\" se você ouviu ou viu a frase (palavras e número; pequenas diferenças de pronúncia valem), ou \"nao_encontrada\" se ela não aparece.",
    "  Não mude a nota por causa da frase: avalie a entrega normalmente.",
  ].join("\n");
}

/**
 * A avaliação depois da conferência da frase-senha. Sem senha no desafio (desafio antigo) ou sem
 * mídia na entrega (só texto), nada muda. Sem a frase, a nota fica no teto e o comentário explica.
 */
export function aplicarSenha(avaliacao, resultado, { senha, temMidia }) {
  if (!senha || !temMidia) return avaliacao;
  const achou = resultado !== "nao_encontrada";
  if (achou) return { ...avaliacao, senha: "encontrada" };
  const nota = Math.min(avaliacao.nota, TETO_SEM_SENHA);
  return {
    ...avaliacao,
    senha: "nao_encontrada",
    nota,
    aprovado: nota >= 60,
    comentario: `${nota < avaliacao.nota ? `A frase-senha "${senha}" não apareceu na gravação nem nas fotos, então esta entrega vale no máximo ${TETO_SEM_SENHA}. ` : `Não encontrei a frase-senha "${senha}" — da próxima vez, fale no começo do áudio ou escreva num papel na foto. `}${avaliacao.comentario}`.trim(),
  };
}
