// "Reportar problema": as regras do chamado, do que a pessoa escreveu ao card que chega para
// quem administra o Proof. Puro — o caminho até o banco mora em src/lib/chamados.js.
//
// O chamado vira um card no Abacato, num quadro do administrador ("Chamados — Lisa Proof"),
// com o print anexado num comentário. Assim ele chega onde o trabalho já é acompanhado: a Lisa
// avisa "card novo no Abacato", e dá para responder, mover para "Em análise" e concluir.

export const NOME_DO_QUADRO_DE_CHAMADOS = "Chamados — Lisa Proof";
export const COLUNAS_DE_CHAMADOS = ["Novos", "Em análise", "Resolvidos"];
export const ORIGEM_DO_CHAMADO = "proof-chamado";
export const LIMITE_POR_DIA = 10;
export const TETO_DO_TEXTO = 4000;
export const TETO_DA_IMAGEM = 6 * 1024 * 1024; // a tela já reduz o print antes de enviar
export const TIPOS_DE_IMAGEM = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Confere o que chegou da tela. Devolve { ok, erro } ou { ok, texto, pagina, contexto }. */
export function conferirChamado({ texto, pagina, contexto, imagem }) {
  const limpo = String(texto ?? "").replace(/\r\n/g, "\n").trim();
  if (limpo.length < 5) return { ok: false, erro: "conte em poucas palavras o que aconteceu" };
  if (limpo.length > TETO_DO_TEXTO) return { ok: false, erro: `o texto tem ${limpo.length} caracteres — o limite é ${TETO_DO_TEXTO}` };
  if (imagem) {
    if (!TIPOS_DE_IMAGEM[imagem.tipo]) return { ok: false, erro: "o print precisa ser PNG, JPG ou WebP" };
    if (!(imagem.tamanho > 0)) return { ok: false, erro: "o print chegou vazio" };
    if (imagem.tamanho > TETO_DA_IMAGEM) return { ok: false, erro: "o print passou de 6 MB" };
  }
  // A página é só o caminho dentro do Proof: nada de endereço de fora, nada de parâmetros (que
  // podem levar dados que não interessam ao chamado).
  const caminho = String(pagina ?? "").split(/[?#]/)[0];
  return {
    ok: true,
    texto: limpo,
    pagina: /^\/[\w\-/.%]*$/.test(caminho) ? caminho.slice(0, 200) : "",
    contexto: contextoLimpo(contexto),
  };
}

function contextoLimpo(c) {
  const t = (v, n) => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, n);
  const o = c && typeof c === "object" ? c : {};
  return {
    navegador: t(o.navegador, 300),
    tela: t(o.tela, 40),
    tema: t(o.tema, 20),
    idioma: t(o.idioma, 20),
  };
}

/** O título do card: a primeira frase do relato, curta. */
export function tituloDoChamado(texto) {
  const primeira = String(texto || "").split("\n").map((l) => l.trim()).find(Boolean) || "Problema reportado";
  const frase = primeira.split(/(?<=[.!?])\s/)[0];
  const curto = frase.length > 80 ? `${frase.slice(0, 78).replace(/\s+\S*$/, "")}…` : frase;
  return `🐞 ${curto}`;
}

/** "20/10/2026 15:42" em Brasília. */
export function quandoEmBrasilia(instante = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(instante).replace(",", "");
}

/** A descrição do card: quem, onde, quando, em que aparelho — e o relato. */
export function descricaoDoChamado({ texto, pagina, contexto, usuario, instante = new Date(), versao = "" }) {
  const linhas = [
    `Reportado por: ${usuario?.nome || "(sem nome)"}${usuario?.email ? ` <${usuario.email}>` : ""}`,
    `Quando: ${quandoEmBrasilia(instante)} (Brasília)`,
    pagina ? `Tela: ${pagina}` : "",
    contexto?.navegador ? `Navegador: ${contexto.navegador}` : "",
    [contexto?.tela && `janela ${contexto.tela}`, contexto?.tema && `tema ${contexto.tema}`, contexto?.idioma].filter(Boolean).length
      ? `Aparelho: ${[contexto.tela && `janela ${contexto.tela}`, contexto.tema && `tema ${contexto.tema}`, contexto.idioma].filter(Boolean).join(" · ")}`
      : "",
    versao ? `Versão do Proof: ${versao}` : "",
    "",
    "O que aconteceu:",
    texto,
  ];
  return linhas.filter((l, i) => l !== "" || i > 0).join("\n").replace(/\n{3,}/g, "\n\n");
}
