// O ranking mundial: quem aparece, com que nome, e em que posição. Puro.
//
// Privacidade primeiro: o nome completo nunca é público. Aparece o apelido que a pessoa escolheu
// ou, sem apelido, o primeiro nome com a inicial do último ("Marina Alves" → "Marina A."). Quem
// sai do ranking continua contando, mas aparece como "Estudante anônimo".

export const PERIODOS_DO_RANKING = ["total", "semana", "reino"];
export const ANONIMO = "Estudante anônimo";

/** Texto que outras pessoas vão ler (apelido, nome do reino): curto, sem e-mail, sem link. */
export function textoPublicoValido(texto, { min = 3, max = 24, rotulo = "o nome" } = {}) {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return { ok: true, texto: "" };
  if (t.length < min || t.length > max) return { ok: false, motivo: `${rotulo} precisa ter de ${min} a ${max} caracteres` };
  if (/@|https?:|www\./i.test(t)) return { ok: false, motivo: `nada de e-mail ou link n${rotulo.startsWith("a ") ? "a" : "o"} ${rotulo.replace(/^(o|a) /, "")}` };
  if (!/^[\p{L}\p{N} ._'!-]+$/u.test(t)) return { ok: false, motivo: "use só letras, números, espaço e . _ ' ! -" };
  return { ok: true, texto: t };
}

export function apelidoValido(texto) {
  const r = textoPublicoValido(texto, { rotulo: "o nome no ranking" });
  return r.ok ? { ok: true, apelido: r.texto } : r;
}

/** O nome público: apelido, ou "Primeiro I.", ou anônimo. */
export function nomePublico({ nome, apelido, noRanking = true }) {
  if (noRanking === false) return ANONIMO;
  if (apelido) return apelido;
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return ANONIMO;
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

/**
 * Ordena e posiciona. `linhas`: [{ usuarioId, valor, ... }]. Empate divide a posição (1, 2, 2, 4).
 * Devolve { topo: as `limite` primeiras, eu: a minha linha (mesmo fora do topo), total }.
 */
export function posicionar(linhas, meuId, limite = 50) {
  const ordenadas = [...linhas].filter((l) => l.valor > 0 || l.usuarioId === meuId).sort((a, b) => b.valor - a.valor || String(a.nome).localeCompare(String(b.nome)));
  let anterior = null;
  let posicao = 0;
  const comPosicao = ordenadas.map((l, i) => {
    if (l.valor !== anterior) { posicao = i + 1; anterior = l.valor; }
    return { ...l, posicao, souEu: l.usuarioId === meuId };
  });
  return {
    topo: comPosicao.slice(0, limite),
    eu: comPosicao.find((l) => l.souEu) || null,
    total: comPosicao.length,
  };
}
