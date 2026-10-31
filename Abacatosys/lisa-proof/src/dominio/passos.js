// O PASSO A PASSO (pedido de 31/10/2026, da proposta dos cursos de matemática): "cada linha da
// resolução é conferida, e o erro aparece na linha em que nasceu". A pessoa resolve escrevendo uma
// linha por passo; o SERVIDOR confere, sem IA (com o analisador de expressao.js):
//
//   expressao — cada linha tem de ser equivalente à anterior (a primeira, ao enunciado), e a última,
//               estar na forma pedida (fatorada, expandida, simplificada).
//   equacao   — cada linha é uma equação (ou "… ou …") que continua valendo para as soluções e não
//               virou identidade; a última isola o x ("x = 4" ou "x = 2 ou x = 3").
//
// A IA só escreve os problemas (validarPassos confere que dá para corrigir). Puro.

import { analisar, avaliar, equivalentes, formaAtendida, lerResposta, formatarNumero, FORMAS } from "./expressao.js";

const MAXIMO_DE_LINHAS = 14;
const texto = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const PONTOS_DE_TESTE = [-2.7, -0.9, 0.35, 1.45, 3.3];

/** As linhas que a pessoa escreveu: sem as vazias, sem o "=" do começo ("= x² + 4x"). */
export function lerLinhas(resposta) {
  return String(resposta ?? "").split(/\r?\n/).map((l) => l.trim().replace(/^=\s*/, "")).filter(Boolean).slice(0, MAXIMO_DE_LINHAS);
}

/** "2x + 3 = 11" → { esquerda, direita } (as árvores), ou erro. */
function lerEquacao(linha, variavel) {
  const lados = linha.split("=");
  if (lados.length !== 2) throw new Error("cada linha precisa de um sinal de igual");
  return { esquerda: analisar(lados[0], variavel), direita: analisar(lados[1], variavel) };
}

/** As alternativas de uma linha de equação: "x − 2 = 0 ou x − 3 = 0", "x = 2; x = 3", "x = 2, x = 3". */
const alternativas = (linha, variavel) => linha.split(new RegExp(`\\s+ou\\s+|;|\\s+e\\s+(?=${variavel}\\s*=)|,\\s*(?=${variavel}\\s*=)`, "i")).map((a) => a.trim()).filter(Boolean);

const diferenca = (eq, x) => avaliar(eq.esquerda, x) - avaliar(eq.direita, x);
const vale = (eq, x) => {
  const d = diferenca(eq, x);
  return Number.isFinite(d) && Math.abs(d) <= 1e-6 * (1 + Math.abs(avaliar(eq.direita, x)));
};
const identidade = (eq) => PONTOS_DE_TESTE.every((x) => vale(eq, x));

/** Um problema que a IA mandou, conferido (null se não dá para corrigir). */
function validarItem(it) {
  const variavel = /^[a-z]$/.test(String(it?.variavel || "")) && it.variavel !== "e" ? it.variavel : "x";
  const enunciado = texto(it?.enunciado, 400);
  const inicio = texto(it?.inicio, 160);
  if (!enunciado || !inicio) return null;
  try {
    if (it?.tipo === "equacao") {
      const eq = lerEquacao(inicio, variavel);
      if (identidade(eq)) return null;
      const solucoes = (Array.isArray(it?.solucoes) ? it.solucoes : []).slice(0, 2).map((s) => lerResposta(String(s)));
      if (!solucoes.length || !solucoes.every((s) => vale(eq, s))) return null;
      return { tipo: "equacao", enunciado, inicio, variavel, solucoes };
    }
    const forma = FORMAS[it?.forma] && it.forma !== "livre" ? it.forma : "simplificada";
    const resposta = texto(it?.resposta, 160);
    const a = analisar(inicio, variavel), r = analisar(resposta, variavel);
    if (!equivalentes(r, a).iguais || !formaAtendida(r, forma, r)) return null;
    return { tipo: "expressao", enunciado, inicio, variavel, forma, resposta };
  } catch {
    return null;
  }
}

/** Os problemas do passo a passo que a IA devolveu, conferidos. Menos de 2 bons, não serve. */
export function validarPassos(bruto) {
  const itens = (Array.isArray(bruto?.itens) ? bruto.itens : []).map(validarItem).filter(Boolean).slice(0, 3);
  if (itens.length < 2) throw new Error("a IA não montou problemas que dê para conferir passo a passo — tente de novo");
  return { motor: "passos", titulo: texto(bruto?.titulo, 120) || "Passo a passo", instrucoes: texto(bruto?.instrucoes, 600), itens };
}

/** O problema como a tela pode ver antes de corrigir: sem a resposta nem as soluções. */
export const passosParaTela = (conteudo) => ({ ...conteudo, itens: conteudo.itens.map(({ resposta, solucoes, ...resto }) => resto) });

const nomeDaSolucao = (item) => item.solucoes.map((s) => `${item.variavel} = ${formatarNumero(s)}`).join(" ou ");

/**
 * Confere a resolução de um problema, linha a linha. Devolve { certo, nota, motivo, linhaDoErro,
 * linhas: [{ ok, motivo }] }. Nota: 1 tudo certo; 0,5 sem erro mas sem terminar (forma ou x isolado);
 * 0,25 com o erro depois da primeira linha; 0 com o erro já na primeira.
 */
export function corrigirItemDePassos(item, resposta) {
  const linhas = lerLinhas(resposta);
  if (!linhas.length) return { certo: false, nota: 0, motivo: "sem resolução", linhaDoErro: null, linhas: [] };
  const v = item.variavel || "x";
  const marcas = [];
  const erro = (k, motivo) => {
    marcas.push({ ok: false, motivo });
    return { certo: false, nota: k === 0 ? 0 : 0.25, motivo: `linha ${k + 1}: ${motivo}`, linhaDoErro: k + 1, linhas: marcas };
  };

  if (item.tipo === "expressao") {
    let anterior = analisar(item.inicio, v);
    let ultima = null;
    for (let k = 0; k < linhas.length; k++) {
      let atual;
      try { atual = analisar(linhas[k], v); } catch (e) { return erro(k, `não deu para ler (${e.message})`); }
      const eq = equivalentes(atual, anterior);
      if (!eq.iguais) {
        return erro(k, eq.x != null
          ? `não é equivalente à linha de antes: com ${v} = ${formatarNumero(eq.x)}, dá ${formatarNumero(eq.minha)} e devia dar ${formatarNumero(eq.certa)}`
          : "não é equivalente à linha de antes");
      }
      marcas.push({ ok: true, motivo: "" });
      anterior = atual;
      ultima = atual;
    }
    if (!formaAtendida(ultima, item.forma, analisar(item.resposta, v))) {
      return { certo: false, nota: 0.5, motivo: `as contas estão certas, mas a última linha não está na forma ${FORMAS[item.forma]}`, linhaDoErro: null, linhas: marcas };
    }
    return { certo: true, nota: 1, motivo: "", linhaDoErro: null, linhas: marcas };
  }

  // equação: cada linha continua valendo para as soluções (e só para elas, nas alternativas)
  for (let k = 0; k < linhas.length; k++) {
    let eqs;
    try { eqs = alternativas(linhas[k], v).map((a) => lerEquacao(a, v)); } catch (e) { return erro(k, `não deu para ler (${e.message})`); }
    if (!eqs.length) return erro(k, "linha vazia");
    if (eqs.some(identidade)) return erro(k, `virou uma igualdade que vale para qualquer ${v} — algum termo se perdeu`);
    const perdida = item.solucoes.find((s) => !eqs.some((eq) => vale(eq, s)));
    if (perdida != null) return erro(k, `não vale mais para ${v} = ${formatarNumero(perdida)}, que é solução — o erro nasceu aqui`);
    const sobra = eqs.find((eq) => !item.solucoes.some((s) => vale(eq, s)));
    if (sobra) return erro(k, "uma das partes desta linha não vale para nenhuma solução");
    marcas.push({ ok: true, motivo: "" });
  }
  // a última linha isola a incógnita: "x = número" em cada alternativa, com todas as soluções
  const finais = alternativas(linhas.at(-1), v).map((a) => a.split("="));
  const isolada = finais.every((p) => p.length === 2 && p[0].trim().toLowerCase() === v);
  if (!isolada) return { certo: false, nota: 0.5, motivo: `as contas estão certas, mas falta isolar o ${v} na última linha (${nomeDaSolucao(item)})`, linhaDoErro: null, linhas: marcas };
  let valores;
  try { valores = finais.map((p) => lerResposta(p[1])); } catch { valores = []; }
  const todas = item.solucoes.every((s) => valores.some((x) => Math.abs(x - s) <= 1e-6 * (1 + Math.abs(s))));
  if (!todas) return { certo: false, nota: 0.5, motivo: `faltou solução no fim: são ${nomeDaSolucao(item)}`, linhaDoErro: null, linhas: marcas };
  return { certo: true, nota: 1, motivo: "", linhaDoErro: null, linhas: marcas };
}

export function corrigirPassos(conteudo, respostas) {
  const itens = conteudo.itens.map((it, i) => corrigirItemDePassos(it, respostas?.[i]));
  return { nota: Math.round((itens.reduce((s, x) => s + x.nota, 0) / itens.length) * 100), itens };
}
