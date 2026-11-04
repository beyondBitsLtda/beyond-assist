// Modo Escuta por palavra de acordar — a parte que decide, sem microfone e sem navegador.
//
// Tudo aqui é função pura: recebe o texto que o reconhecimento de fala entendeu e devolve o
// que fazer com ele. O microfone, o laço que religa o reconhecimento e a reprodução ficam do
// lado do Assistente; a decisão fica aqui, onde dá para exercitar cada caso sem abrir uma aba.

/**
 * Como a palavra chega escrita.
 *
 * O reconhecimento erra nomes próprios com frequência, e "Lisa" é curto — sai como "liza",
 * "lise", "leesa". Aceitar as variações é o que separa "funciona" de "às vezes funciona";
 * o custo é um falso despertar de vez em quando, e para isso existe a janela de silêncio.
 *
 * "alisa" e "analisa" NÃO podem acordar, e é por isso que a comparação é por palavra inteira.
 */
export const TERMOS_DE_ACORDAR = ["lisa", "liza", "lise", "leesa", "lisinha"];

/** Tira acento, baixa a caixa e normaliza espaços — o reconhecimento varia nos três. */
export function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A palavra de acordar apareceu? Se sim, devolve também o que veio DEPOIS dela.
 *
 * Isso permite as duas formas naturais de falar, sem o usuário precisar saber qual é qual:
 *
 *   "Lisa"                        → acorda e espera o comando
 *   "Lisa, que horas são?"        → acorda e já leva a pergunta junto, sem pausa nenhuma
 *
 * Quando a palavra aparece mais de uma vez, vale a ÚLTIMA: em "lisa... não, Lisa toca rock",
 * o que interessa é o que veio depois da correção.
 */
export function detectarAcordar(texto, termos = TERMOS_DE_ACORDAR) {
  const n = normalizar(texto);
  if (!n) return { acordou: false, resto: "" };

  let melhor = -1;
  let fim = 0;
  for (const termo of termos) {
    const re = new RegExp(`(?:^|\\s)${termo}(?:\\s|$)`, "g");
    let m;
    while ((m = re.exec(n)) !== null) {
      const inicio = m.index + (m[0].startsWith(" ") ? 1 : 0);
      if (inicio > melhor) { melhor = inicio; fim = inicio + termo.length; }
      re.lastIndex = m.index + 1; // permite ocorrências coladas
    }
  }
  if (melhor < 0) return { acordou: false, resto: "" };
  return { acordou: true, resto: n.slice(fim).trim() };
}

// Verbos que significam "toque isto". Escritos como o usuário fala, não como se escreve.
const VERBOS_TOCAR = /^(toca|toque|poe|poem|ponha|coloca|coloque|bota|bote|manda|toca ai|põe)\b/;
const VERBOS_PARAR = /^(para|parar|pare|pausa|pausar|silencio|cala|chega|desliga|desligue)\b/;
const VERBOS_PULAR = /^(pula|pular|pule|proxima|proximo|troca|muda)\b/;

// Enfeites que o usuário fala e que não ajudam a achar a música.
const ENFEITES = /\b(a|o|as|os|uma|um|de|do|da|dos|das|musica|musicas|som|youtube|no|pra mim|por favor|ai|la|agora)\b/g;

/**
 * O que fazer com o que foi dito depois de acordar.
 *
 * A separação entre "tocar" e "perguntar" é feita AQUI, localmente, e não perguntando ao
 * Gemini o que o usuário quis dizer. Dois motivos, e o segundo pesa mais do que parece:
 * responde instantaneamente, e não gasta cota — que é exatamente o recurso que já faltou
 * nesta instalação e derrubou a voz e a busca no mesmo dia.
 */
export function interpretarComando(texto) {
  const n = normalizar(texto);
  if (!n) return { tipo: "vazio" };

  if (VERBOS_PARAR.test(n)) return { tipo: "parar" };
  if (VERBOS_PULAR.test(n)) return { tipo: "pular" };

  if (VERBOS_TOCAR.test(n)) {
    const alvo = n.replace(VERBOS_TOCAR, "").replace(ENFEITES, " ").replace(/\s+/g, " ").trim();
    // "toca" sozinho é pedido de música, sem dizer qual — quem chama decide o que tocar.
    return { tipo: "tocar", alvo };
  }

  return { tipo: "perguntar", texto: n };
}

/**
 * Acha na playlist a música que mais se parece com o pedido.
 *
 * Pontua por palavra do pedido presente no título, e não por igualdade: ninguém fala o título
 * exato de uma música, com a grafia exata. "toca aquela do pink floyd" tem que achar
 * "Pink Floyd - Wish You Were Here".
 *
 * Devolve null quando nada casa bem o bastante. Tocar a música errada é pior que dizer que
 * não achou — o usuário perde a confiança no modo inteiro depois de duas dessas.
 */
export function escolherMusica(alvo, playlist) {
  const palavras = normalizar(alvo).split(" ").filter((p) => p.length > 2);
  if (!palavras.length || !Array.isArray(playlist) || !playlist.length) return null;

  let melhor = null;
  let melhorNota = 0;
  for (const item of playlist) {
    const titulo = normalizar(item?.title || item?.titulo || "");
    if (!titulo) continue;
    const acertos = palavras.filter((p) => titulo.includes(p)).length;
    if (!acertos) continue;
    // Proporção do PEDIDO encontrada, não do título: "pink floyd" deve casar bem com um
    // título longo que o contenha, sem ser penalizado pelo resto do título.
    const nota = acertos / palavras.length;
    if (nota > melhorNota) { melhorNota = nota; melhor = item; }
  }
  // Metade das palavras do pedido precisa aparecer. Abaixo disso é chute.
  return melhorNota >= 0.5 ? melhor : null;
}
