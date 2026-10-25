// A leitura de cada assunto de um curso feito a partir de um livro (proof_leituras): as páginas que o
// assunto cobre. Serve à tela (o botão "Ler no livro" do assunto) e à IA — a explicação, o quiz e o
// exercício do assunto leem o trecho do livro, para cobrar o que o livro ensina, e não outra coisa.

import { supabase } from "./supabase.js";
import { trechosDoLivro } from "./biblioteca.js";

/** { livroId, livroTitulo, de, ate, secao } do card, ou null. */
export async function leituraDoCard(cardId) {
  if (!cardId) return null;
  const { data } = await supabase.from("proof_leituras").select("livro_id, de, ate, secao, proof_livros(titulo)").eq("card_id", cardId).maybeSingle();
  if (!data) return null;
  return { livroId: data.livro_id, livroTitulo: data.proof_livros?.titulo || "Livro", de: data.de, ate: data.ate, secao: data.secao };
}

/** As leituras de vários cards de uma vez (para as listas de assuntos). */
export async function leiturasDosCards(cardIds) {
  const ids = [...new Set((cardIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data } = await supabase.from("proof_leituras").select("card_id, livro_id, de, ate, secao, proof_livros(titulo)").in("card_id", ids);
  return new Map((data || []).map((l) => [l.card_id, { livroId: l.livro_id, livroTitulo: l.proof_livros?.titulo || "Livro", de: l.de, ate: l.ate, secao: l.secao }]));
}

/**
 * O trecho do livro que o assunto cobre, pronto para ir num pedido à IA (ou null se o assunto não
 * veio de um livro, ou se as páginas não têm texto). Nunca derruba quem chama: sem trecho, a IA
 * segue como antes.
 */
export async function trechoDoAssunto(cardId, maximo = 24_000) {
  try {
    const l = await leituraDoCard(cardId);
    if (!l) return null;
    const [t] = await trechosDoLivro(l.livroId, [{ de: l.de, ate: l.ate }], maximo);
    const texto = String(t?.trecho || "").trim();
    if (!texto) return null;
    return {
      texto,
      fonte: `“${l.livroTitulo}”, ${l.de === l.ate ? `p. ${l.de}` : `págs. ${l.de}–${l.ate}`}${l.secao ? ` (${l.secao})` : ""}`,
      cortado: Number(t.caracteres) > texto.length,
    };
  } catch {
    return null;
  }
}

/** O bloco do pedido à IA com o trecho do livro. */
export function blocoDoTrecho(trecho) {
  if (!trecho) return "";
  return [
    "",
    `TRECHO DO LIVRO QUE ESTE ASSUNTO COBRE — ${trecho.fonte}${trecho.cortado ? " (o começo dele)" : ""}:`,
    "<<<",
    trecho.texto,
    ">>>",
    "Baseie-se neste trecho: use os conceitos, os termos e os exemplos dele. Pode citar a página ([p. N]). Não cobre o que o trecho não ensina.",
  ].join("\n");
}
