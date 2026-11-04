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

// ---------------------------------------------------------------- a tela de chamados (03/11/2026)
//
// BEYOND-0015: "uma tela de gerenciamento de chamados: pega os chamados abertos e mostra para o técnico
// e o requisitante o status; o técnico vê todos e o requisitante vê os seus, inclusive com a previsão de
// término". O chamado continua sendo o card do quadro de chamados no Abacato: a coluna é o status, o
// prazo do card (fim_em) é a previsão, e os comentários do técnico são as respostas.

export const SITUACOES = {
  aberto: { rotulo: "Aberto", ordem: 0 },
  analise: { rotulo: "Em análise", ordem: 1 },
  resolvido: { rotulo: "Resolvido", ordem: 2 },
};
export const TETO_DA_RESPOSTA = 2000;

/** A situação pela coluna do card (e pelo "concluído" do Abacato): aberto, em análise ou resolvido. */
export function situacaoDoChamado({ coluna = "", concluido = false } = {}) {
  const nome = String(coluna).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (concluido || /resolvid|conclu|fechad|feito|pront/.test(nome)) return "resolvido";
  if (/novo|abert|entrada|fila/.test(nome) || !nome) return "aberto";
  return "analise";
}

/** "05/11" (no ano de agora) ou "05/11/2027", em Brasília. */
export function diaEmBrasilia(instante, agora = new Date()) {
  const fmt = (d, o) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...o }).format(d);
  const d = new Date(instante);
  const mesmoAno = fmt(d, { year: "numeric" }) === fmt(agora, { year: "numeric" });
  return fmt(d, mesmoAno ? { day: "2-digit", month: "2-digit" } : { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** A previsão de término para a tela: { texto, atrasada } — ou null quando já está resolvido. */
export function previsaoDoChamado({ fimEm = null, situacao, agora = new Date() } = {}) {
  if (situacao === "resolvido") return null;
  if (!fimEm) return { texto: "sem previsão ainda", atrasada: false };
  const atrasada = new Date(fimEm).getTime() < agora.getTime();
  return { texto: `${atrasada ? "era para" : "previsto para"} ${diaEmBrasilia(fimEm, agora)}`, atrasada };
}

/** O relato da pessoa, sem o cabeçalho que descricaoDoChamado põe (quem, quando, aparelho). */
export function relatoDoChamado(descricao) {
  const t = String(descricao || "");
  const i = t.indexOf("O que aconteceu:\n");
  return (i >= 0 ? t.slice(i + "O que aconteceu:\n".length) : t).trim();
}

/** O id de quem abriu, guardado no começo do origem_id ("<usuário>/<instante>"). */
export const quemAbriu = (origemId) => String(origemId || "").split("/")[0] || null;

/** Os em aberto primeiro (os de previsão mais perto antes; sem previsão, os mais antigos), depois os resolvidos, do mais novo. */
export function ordenarChamados(lista) {
  const prazo = (c) => (c.fimEm ? new Date(c.fimEm).getTime() : Infinity);
  return [...(lista || [])].sort((a, b) => {
    const ra = a.situacao === "resolvido" ? 1 : 0;
    const rb = b.situacao === "resolvido" ? 1 : 0;
    if (ra !== rb) return ra - rb;
    if (ra) return new Date(b.criadoEm) - new Date(a.criadoEm);
    return prazo(a) - prazo(b) || new Date(a.criadoEm) - new Date(b.criadoEm);
  });
}

/**
 * O que o técnico mudou: { colunaId?, previsao? ("AAAA-MM-DD", ou "" para tirar), resposta? }.
 * Devolve { ok, erro } ou { ok, mudancas } só com o que veio.
 */
export function conferirAtualizacao({ colunaId, previsao, resposta } = {}) {
  const mudancas = {};
  if (colunaId !== undefined) {
    if (!/^[0-9a-f-]{36}$/i.test(String(colunaId))) return { ok: false, erro: "status inválido" };
    mudancas.colunaId = String(colunaId);
  }
  if (previsao !== undefined) {
    const p = String(previsao ?? "").trim();
    if (p && !/^\d{4}-\d{2}-\d{2}$/.test(p)) return { ok: false, erro: "a previsão precisa ser uma data" };
    if (p && Number.isNaN(new Date(`${p}T12:00:00Z`).getTime())) return { ok: false, erro: "a previsão precisa ser uma data" };
    mudancas.previsao = p;
  }
  if (resposta !== undefined) {
    const r = String(resposta ?? "").replace(/\r\n/g, "\n").trim();
    if (r.length > TETO_DA_RESPOSTA) return { ok: false, erro: `a resposta passou de ${TETO_DA_RESPOSTA} caracteres` };
    if (r) mudancas.resposta = r;
  }
  if (!Object.keys(mudancas).length) return { ok: false, erro: "nada para mudar" };
  return { ok: true, mudancas };
}

/** A previsão "AAAA-MM-DD" vira o fim do expediente desse dia em Brasília (18:00, UTC−3). */
export const fimDaPrevisao = (dia) => (dia ? `${dia}T21:00:00.000Z` : null);
