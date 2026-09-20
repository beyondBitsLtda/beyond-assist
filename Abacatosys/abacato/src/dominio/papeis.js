// Os papéis, escritos para quem vai escolher um.
//
// `poderesDo` (em Quadro.js) diz o que cada papel PODE. Isto aqui diz o que cada papel
// SIGNIFICA, em português. Os dois vivem separados de propósito: a lista de poderes é lida por
// código e a descrição é lida por gente, e misturar as duas faz a tela mostrar "criar: true,
// apagar: false" para alguém que só quer saber se aquela pessoa vai poder mexer.
//
// A ordem é do mais poderoso para o menos, que é a ordem em que a escolha costuma ser feita.

export const PAPEIS = [
  {
    valor: "editor",
    nome: "Pode editar",
    resumo: "cria, muda e arquiva",
    detalhe: "Mexe em tudo aqui dentro: cria, edita, move e arquiva. Não convida ninguém e não arquiva o quadro inteiro.",
  },
  {
    valor: "comentarista",
    nome: "Pode comentar",
    resumo: "vê tudo e comenta",
    detalhe: "Acompanha tudo e pode comentar, mas não muda nada — nem prazo, nem coluna, nem texto.",
  },
  {
    valor: "leitor",
    nome: "Só leitura",
    resumo: "só acompanha",
    detalhe: "Vê tudo e não muda nada. É o papel para quem precisa saber como vai, e não participar.",
  },
];

/**
 * `dono` NÃO está na lista acima, e é deliberado.
 *
 * Ele não é um papel que se concede: é quem criou a coisa. Deixá-lo no seletor abriria a porta
 * para dois donos — e aí "só o dono arquiva o quadro" deixa de ser uma frase com sentido.
 * Transferir a propriedade é outra operação, com outro nome, para o dia em que for preciso.
 */
export const PAPEL_PADRAO = "editor";

export function papelValido(papel) {
  return PAPEIS.some((p) => p.valor === papel);
}

export function descreverPapel(papel) {
  if (papel === "dono") return { valor: "dono", nome: "Dono", resumo: "criou e manda", detalhe: "Pode tudo, inclusive convidar e arquivar." };
  return PAPEIS.find((p) => p.valor === papel) || { valor: papel, nome: papel, resumo: "", detalhe: "" };
}

/**
 * Uma senha sorteada, forte e digitável.
 *
 * Sem símbolo: senha com símbolo é chata de digitar no celular e é a razão de as pessoas
 * anotarem num papel. O que se perde de variedade por caractere se recupera com comprimento —
 * 20 caracteres deste alfabeto dão mais de 115 bits, e nenhuma força bruta chega perto.
 *
 * O alfabeto não tem `l`, `I`, `O`, `0` nem `1`: esta senha vai ser lida em voz alta ou copiada
 * de uma tela, e confundir zero com ó é o jeito mais comum de um acesso novo não funcionar.
 */
export function sortearSenha(tamanho = 20) {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(tamanho));
  return [...bytes].map((b) => alfabeto[b % alfabeto.length]).join("");
}

/** Um e-mail que dá para aceitar. Não valida o mundo — valida o que quebraria o login. */
export function emailValido(email) {
  const limpo = String(email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpo) && limpo.length <= 200;
}
