// Lê a exportação JSON de um quadro do Trello e devolve um quadro do Abacato.
//
// Puro de propósito: não fala com banco, não fala com rede. A MESMA função roda duas vezes —
// no navegador, para montar a prévia de "o que vai entrar", e no servidor, para gravar. Duas
// implementações separadas divergiriam, e a prévia passaria a prometer uma coisa enquanto a
// importação faria outra. Prévia que mente é pior que não ter prévia.
//
// O que fica de fora, e por quê:
//
//   actions      O histórico do Trello. É o que faz o arquivo ter dezenas de megabytes, e é
//                histórico de um sistema que está sendo abandonado.
//   members      Os ids do Trello não são pessoas daqui. Em vez de inventar um vínculo, a
//                importação RELATA quem ficou sem dono para você atribuir depois.
//   anexos       Arquivos enviados ao Trello precisam da sessão do Trello para baixar. Links
//                externos entram; uploads são relatados como não trazidos.

import { VALORES_DE_COR } from "./cores.js";

// ---------------------------------------------------------------- cores

// O Trello guarda cor por NOME, e a paleta dele é maior que a nossa. Cada nome cai na cor mais
// próxima daqui. Aceitar o hex do Trello direto seria mais fiel e pior: a paleta fechada existe
// justamente para o quadro não acabar com onze verdes indistinguíveis.
const COR_DO_TRELLO = {
  green: "#22C55E",
  lime: "#10B981",
  yellow: "#EAB308",
  orange: "#F97316",
  red: "#EF4444",
  purple: "#A855F7",
  pink: "#EC4899",
  blue: "#2362D3",
  sky: "#6366F1",
  black: "#6B7280",
  // O Trello usa sufixos de tom no mesmo nome: "green_dark", "blue_light". O tom não muda o
  // significado da etiqueta, só o brilho — e o brilho aqui vem da paleta.
};

export function corDoTrello(nome) {
  if (!nome) return "#6B7280";
  const base = String(nome).toLowerCase().replace(/_(dark|light|darker|lighter)$/, "");
  const achada = COR_DO_TRELLO[base];
  return achada && VALORES_DE_COR.includes(achada) ? achada : "#6B7280";
}

// Os fundos de quadro do Trello viram um dos gradientes daqui, escolhido pela família da cor.
// O hex do Trello não é usado direto porque metade dos fundos dele é clara, e a tela do quadro
// escreve em branco sobre o papel de parede: um fundo claro apagaria o nome do quadro.
const PAREDE_DO_TRELLO = {
  green: "linear-gradient(135deg, #0F2A1D, #1B4332)",
  lime: "linear-gradient(135deg, #0F2A1D, #1B4332)",
  blue: "linear-gradient(135deg, #12243F, #21456F)",
  sky: "linear-gradient(135deg, #12243F, #21456F)",
  navy: "linear-gradient(135deg, #12243F, #21456F)",
  orange: "linear-gradient(135deg, #3A1F0B, #7C3F13)",
  red: "linear-gradient(135deg, #3A1F0B, #7C3F13)",
  yellow: "linear-gradient(135deg, #3A1F0B, #7C3F13)",
  purple: "linear-gradient(135deg, #2B1B3F, #59307A)",
  pink: "linear-gradient(135deg, #2B1B3F, #59307A)",
  grey: "linear-gradient(135deg, #1F2937, #4B5563)",
  black: "linear-gradient(135deg, #1F2937, #4B5563)",
};

export function paredeDoTrello(prefs) {
  const nome = String(prefs?.background || "").toLowerCase();
  if (PAREDE_DO_TRELLO[nome]) return PAREDE_DO_TRELLO[nome];

  // Fundo de imagem ou cor personalizada: o Trello guarda um hex em `backgroundColor`. Ele
  // serve para ESCOLHER a família, não para virar o fundo.
  const hex = String(prefs?.backgroundColor || "").trim();
  const casa = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!casa) return null;

  const n = parseInt(casa[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (r > g && r > b) return PAREDE_DO_TRELLO.red;
  if (g > r && g > b) return PAREDE_DO_TRELLO.green;
  if (b > r && b > g) return PAREDE_DO_TRELLO.blue;
  return PAREDE_DO_TRELLO.grey;
}

// ---------------------------------------------------------------- datas e textos

/** Uma data do Trello. Vem em ISO; o que não for data vira nulo em vez de quebrar a importação
 *  inteira por causa de um card. */
function data(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Corta um texto no limite, sem cortar no meio de um caractere composto. Nomes de card vêm de
 *  humanos e não têm limite no Trello; as colunas daqui são `text`, mas uma tela com um título
 *  de dez mil caracteres é uma tela quebrada. */
function texto(valor, limite) {
  const t = String(valor ?? "").trim();
  return t.length > limite ? [...t].slice(0, limite).join("") : t;
}

const LIMITE = { titulo: 300, descricao: 20000, etiqueta: 80, coluna: 200, quadro: 200, item: 500 };

// ---------------------------------------------------------------- o leitor

/**
 * Transforma a exportação do Trello num quadro do Abacato.
 *
 * Devolve `{ quadro, avisos }`. Os avisos são o que NÃO veio junto — pessoas sem conta aqui,
 * anexos que precisam da sessão do Trello, listas arquivadas. Eles existem porque uma migração
 * silenciosa é uma migração em que você descobre o que faltou três semanas depois.
 */
export function lerExportacaoDoTrello(bruto) {
  if (!bruto || typeof bruto !== "object") {
    throw new Error("isto não parece uma exportação do Trello");
  }
  if (!Array.isArray(bruto.lists) || !Array.isArray(bruto.cards)) {
    throw new Error("o arquivo não tem listas e cards — exporte o QUADRO em JSON, não o perfil");
  }

  const avisos = [];

  // ---- etiquetas
  const etiquetas = (bruto.labels || []).map((l) => ({
    origemId: String(l.id),
    nome: texto(l.name, LIMITE.etiqueta),
    cor: corDoTrello(l.color),
  }));
  const etiquetaPorId = new Map(etiquetas.map((e) => [e.origemId, e]));

  // ---- checklists, agrupadas por card
  const checklistsPorCard = new Map();
  for (const cl of bruto.checklists || []) {
    const cardId = String(cl.idCard || "");
    if (!cardId) continue;
    if (!checklistsPorCard.has(cardId)) checklistsPorCard.set(cardId, []);
    checklistsPorCard.get(cardId).push({
      origemId: String(cl.id),
      titulo: texto(cl.name, LIMITE.etiqueta) || "Checklist",
      posicao: Number(cl.pos) || 0,
      itens: (cl.checkItems || [])
        .slice()
        .sort((a, b) => (Number(a.pos) || 0) - (Number(b.pos) || 0))
        .map((i) => ({
          origemId: String(i.id),
          texto: texto(i.name, LIMITE.item),
          feito: i.state === "complete",
          posicao: Number(i.pos) || 0,
        }))
        .filter((i) => i.texto),
    });
  }

  // ---- pessoas que não têm conta aqui
  const pessoasCitadas = new Set();
  for (const c of bruto.cards) for (const m of c.idMembers || []) pessoasCitadas.add(String(m));
  if (pessoasCitadas.size) {
    const nomes = (bruto.members || [])
      .filter((m) => pessoasCitadas.has(String(m.id)))
      .map((m) => m.fullName || m.username)
      .filter(Boolean);
    avisos.push({
      tipo: "pessoas",
      quantos: pessoasCitadas.size,
      texto: nomes.length
        ? `${pessoasCitadas.size} pessoa(s) estavam em cards no Trello e não têm conta no Abacato: ${nomes.join(", ")}. Os cards vêm sem responsável — atribua depois.`
        : `${pessoasCitadas.size} pessoa(s) estavam em cards no Trello e não têm conta aqui. Os cards vêm sem responsável.`,
    });
  }

  // ---- cards, agrupados por lista
  let anexosDeUpload = 0;
  let cardsArquivados = 0;
  const cardsPorLista = new Map();

  for (const c of bruto.cards) {
    const lista = String(c.idList || "");
    if (!lista) continue;
    if (c.closed) cardsArquivados++;

    const links = [];
    for (const a of c.attachments || []) {
      const url = String(a.url || "");
      // Um anexo enviado ao Trello mora atrás da sessão do Trello: o link existe, mas ninguém
      // aqui consegue abri-lo. Trazer um link quebrado é pior que dizer que ele não veio.
      if (a.isUpload || !/^https?:\/\//i.test(url)) { anexosDeUpload++; continue; }
      links.push({ url, titulo: texto(a.name, LIMITE.etiqueta) || null });
    }

    const card = {
      origemId: String(c.id),
      titulo: texto(c.name, LIMITE.titulo) || "(sem título)",
      descricao: texto(c.desc, LIMITE.descricao) || null,
      posicao: Number(c.pos) || 0,
      inicioEm: data(c.start),
      fimEm: data(c.due),
      // No Trello o `dueComplete` é o que diz que a data foi cumprida. Sem trazê-lo, todo card
      // já resolvido lá chegaria aqui marcado de vermelho como atrasado.
      concluido: Boolean(c.dueComplete),
      arquivado: Boolean(c.closed),
      capa: c.cover?.color ? corDoTrello(c.cover.color) : null,
      etiquetas: (c.idLabels || [])
        .map((id) => etiquetaPorId.get(String(id))?.origemId)
        .filter(Boolean),
      links,
      checklists: (checklistsPorCard.get(String(c.id)) || []).sort((a, b) => a.posicao - b.posicao),
    };

    if (!cardsPorLista.has(lista)) cardsPorLista.set(lista, []);
    cardsPorLista.get(lista).push(card);
  }

  if (anexosDeUpload) {
    avisos.push({
      tipo: "anexos",
      quantos: anexosDeUpload,
      texto: `${anexosDeUpload} anexo(s) eram arquivos enviados ao Trello e não vieram — eles só abrem com a sessão do Trello. Links externos vieram normalmente.`,
    });
  }

  // ---- colunas
  const colunas = (bruto.lists || [])
    .slice()
    .sort((a, b) => (Number(a.pos) || 0) - (Number(b.pos) || 0))
    .map((l) => ({
      origemId: String(l.id),
      nome: texto(l.name, LIMITE.coluna) || "(sem nome)",
      posicao: Number(l.pos) || 0,
      arquivada: Boolean(l.closed),
      cards: (cardsPorLista.get(String(l.id)) || []).sort((a, b) => a.posicao - b.posicao),
    }));

  const listasArquivadas = colunas.filter((c) => c.arquivada).length;
  if (listasArquivadas || cardsArquivados) {
    avisos.push({
      tipo: "arquivados",
      quantos: listasArquivadas + cardsArquivados,
      // Vêm arquivados, e não descartados: o que foi arquivado no Trello é histórico, e a
      // migração é a última chance de trazê-lo antes de a conta de lá ser fechada.
      texto: `${listasArquivadas} lista(s) e ${cardsArquivados} card(s) estavam arquivados no Trello. Vêm junto, arquivados aqui também — ficam guardados, fora do quadro.`,
    });
  }

  // Cards que apontam para uma lista que não veio no arquivo. Acontece em exportação parcial.
  const listasConhecidas = new Set(colunas.map((c) => c.origemId));
  const orfaos = [...cardsPorLista.keys()].filter((id) => !listasConhecidas.has(id));
  if (orfaos.length) {
    const quantos = orfaos.reduce((s, id) => s + cardsPorLista.get(id).length, 0);
    avisos.push({
      tipo: "orfaos",
      quantos,
      texto: `${quantos} card(s) apontam para listas que não estão no arquivo e não vão entrar. Reexporte o quadro inteiro se eles importarem.`,
    });
  }

  const quadro = {
    origem: "trello",
    origemId: String(bruto.id || ""),
    nome: texto(bruto.name, LIMITE.quadro) || "Quadro importado do Trello",
    descricao: texto(bruto.desc, LIMITE.descricao) || null,
    papelDeParede: paredeDoTrello(bruto.prefs),
    etiquetas,
    colunas,
  };

  return { quadro, avisos, resumo: resumirQuadro(quadro) };
}

/** O que a prévia mostra antes de você confirmar. */
export function resumirQuadro(quadro) {
  const cards = quadro.colunas.flatMap((c) => c.cards);
  return {
    colunas: quadro.colunas.length,
    cards: cards.length,
    etiquetas: quadro.etiquetas.length,
    checklists: cards.reduce((s, c) => s + c.checklists.length, 0),
    itens: cards.reduce((s, c) => s + c.checklists.reduce((t, cl) => t + cl.itens.length, 0), 0),
    links: cards.reduce((s, c) => s + c.links.length, 0),
    comPrazo: cards.filter((c) => c.fimEm).length,
    concluidos: cards.filter((c) => c.concluido).length,
    arquivados: cards.filter((c) => c.arquivado).length,
  };
}

/**
 * Corta a exportação para o que a importação usa.
 *
 * Roda no NAVEGADOR, antes de enviar. Uma exportação do Trello com um ano de uso passa
 * facilmente de cinquenta megabytes, e quase tudo isso é o `actions` — o histórico de cada
 * movimento de cada card. Mandar esse peso por uma conexão de casa, para o servidor jogar fora
 * do outro lado, é desperdício que dá tempo de a importação parecer travada.
 */
export function enxugarExportacao(bruto) {
  return {
    id: bruto.id,
    name: bruto.name,
    desc: bruto.desc,
    prefs: bruto.prefs ? { background: bruto.prefs.background, backgroundColor: bruto.prefs.backgroundColor } : null,
    labels: (bruto.labels || []).map((l) => ({ id: l.id, name: l.name, color: l.color })),
    lists: (bruto.lists || []).map((l) => ({ id: l.id, name: l.name, pos: l.pos, closed: l.closed })),
    members: (bruto.members || []).map((m) => ({ id: m.id, fullName: m.fullName, username: m.username })),
    cards: (bruto.cards || []).map((c) => ({
      id: c.id, name: c.name, desc: c.desc, pos: c.pos, closed: c.closed, idList: c.idList,
      due: c.due, start: c.start, dueComplete: c.dueComplete,
      idLabels: c.idLabels, idMembers: c.idMembers,
      cover: c.cover ? { color: c.cover.color } : null,
      attachments: (c.attachments || []).map((a) => ({ url: a.url, name: a.name, isUpload: a.isUpload })),
    })),
    checklists: (bruto.checklists || []).map((cl) => ({
      id: cl.id, idCard: cl.idCard, name: cl.name, pos: cl.pos,
      checkItems: (cl.checkItems || []).map((i) => ({ id: i.id, name: i.name, state: i.state, pos: i.pos })),
    })),
  };
}
