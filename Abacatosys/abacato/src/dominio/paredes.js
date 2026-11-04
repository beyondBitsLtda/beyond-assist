// Papéis de parede: os prontos e os que você envia.
//
// O valor guardado em `abacato_quadros.papel_de_parede` é um pedaço de CSS de fundo, e ele vai
// direto para o atributo `style` da tela do quadro. Isso obriga a uma trava:
//
//   ACEITAR QUALQUER TEXTO AQUI SERIA UM CANAL DE SAÍDA.
//
//   `background: url("https://servidor-de-alguem/x.png")` é CSS perfeitamente válido, e o
//   navegador o BUSCA ao abrir o quadro. Quem conseguisse gravar esse texto saberia toda vez
//   que o quadro fosse aberto, de qual endereço e a que horas — sem nada na tela denunciar.
//   Num quadro compartilhado, bastaria um editor mal-intencionado.
//
// Então o que entra é fechado: ou é um dos gradientes desta lista, ou é uma imagem que está no
// armazenamento da própria casa. Nada de fora.

export const GRADIENTES = [
  { valor: null, nome: "Nenhum" },
  { valor: "linear-gradient(135deg, #0F2A1D, #1B4332)", nome: "Mata" },
  { valor: "linear-gradient(135deg, #12243F, #21456F)", nome: "Maré" },
  { valor: "linear-gradient(135deg, #3A1F0B, #7C3F13)", nome: "Barro" },
  { valor: "linear-gradient(135deg, #2B1B3F, #59307A)", nome: "Ameixa" },
  { valor: "linear-gradient(135deg, #1F2937, #4B5563)", nome: "Grafite" },
  { valor: "linear-gradient(135deg, #0B1B2B, #0F3A4A)", nome: "Fundo do mar" },
  { valor: "linear-gradient(135deg, #2A0F16, #6B1F2E)", nome: "Vinho" },
];

const VALORES_DE_GRADIENTE = new Set(GRADIENTES.map((g) => g.valor).filter(Boolean));

/** O CSS de uma imagem enviada. Um formato só, montado num lugar só — é o que permite conferir
 *  depois se o que está guardado é mesmo uma imagem nossa. */
export function paredeDeImagem(url) {
  return `url("${url}") center / cover no-repeat`;
}

/** O endereço da imagem de dentro de um papel de parede, ou null se não for imagem. */
export function urlDaParede(valor) {
  const casa = /^url\("([^"]+)"\) center \/ cover no-repeat$/.exec(String(valor || ""));
  return casa ? casa[1] : null;
}

/**
 * Este valor pode ser gravado?
 *
 * `base` é o endereço do armazenamento de casa. Só imagem que mora lá passa — e a comparação
 * é pelo COMEÇO da URL inteira, inclusive o caminho do bucket, porque
 * `https://banco.beyond.dev.br.servidor-de-alguem.com/` começa com o nosso domínio e não é o
 * nosso servidor.
 */
export function paredeValida(valor, base) {
  if (valor === null || valor === "") return true;          // "sem papel de parede"
  if (VALORES_DE_GRADIENTE.has(valor)) return true;

  const url = urlDaParede(valor);
  if (!url || !base) return false;

  const prefixo = `${String(base).replace(/\/+$/, "")}/storage/v1/object/public/abacato-paredes/`;
  if (!url.startsWith(prefixo)) return false;

  // Sem `..` nem aspas escapando do formato. O formato já é fechado pela expressão acima, mas
  // uma segunda trava custa uma linha e fecha o caso de um caminho montado para sair do bucket.
  const resto = url.slice(prefixo.length);
  return resto.length > 0 && !resto.includes("..") && !/["'()\\]/.test(resto);
}
