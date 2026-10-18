// As regras das ações da Lisa nos cards do Abacato: criar, editar, concluir, reabrir, mover e
// arquivar. Puro (sem banco, sem rede, sem navegador) — testado em scripts/acoes-abacato-check.mjs.
// Quem grava é src/lib/abacatoAcoes.js; quem entende o pedido é detectarAcaoNoAbacato (gemini.js).
//
// Antes, o fluxo de ações era do Trello: só olhava cards com source "TRELLO" (com os quadros no
// Abacato, a lista vinha sempre vazia), só sabia prazo, coluna e concluído, e só agia sobre um
// card já citado na conversa. Por isso a Lisa respondia que "não tinha permissão".

export const ACOES = ["criar", "editar", "concluir", "reabrir", "mover", "arquivar"];

// Verbos e palavras de quem está pedindo para MEXER num card. Serve só para decidir se vale
// gastar a chamada que entende o pedido — quem decide de verdade é o modelo.
const PEDIDO = /\b(cri[ae]r?|cri[ae]|adicion\w*|inclu[ia]\w*|anot[ae]\w*|registr\w*|coloc\w*|bot[ae]|p[õo]e|p[ôo]r|renome\w*|t[íi]tulo|descri[cç][ãa]o|edit\w*|alter\w*|atualiz\w*|mud[ae]\w*|troc[ae]\w*|arquiv\w*|apag\w*|exclu\w*|remov\w*|delet\w*|tir[ae]\w*|conclu\w*|finaliz\w*|termin\w*|reabr\w*|desmarc\w*|marc[ae]\w*|mov[ae]\w*|pass[ae]|prazo|adi[ae]\w*|remarc\w*|reprogram\w*|vencimento)\b/i;
const OBJETO = /\b(card|cards|cart[ãa]o|tarefa|tarefas|abacato|quadro|coluna|lista|prazo|item)\b/i;

/** Vale perguntar ao modelo se isto é um pedido de ação? (Sempre, se há uma ação pendente.) */
export function pareceAcao(texto, haPendente = false) {
  if (haPendente) return true;
  const t = String(texto || "");
  return PEDIDO.test(t) && OBJETO.test(t);
}

const sim = /^\s*(sim|s|pode|pode sim|pode fazer|pode criar|confirmo|confirma|confirmado|isso|isso mesmo|exato|claro|beleza|ok|okay|fechado|manda|faz|faça|vai|bora|positivo|certo)\b/i;
const nao = /^\s*(n[ãa]o|nao|negativo|cancela|cancelar|deixa|deixa pra l[áa]|esquece|para|pare|nem|nunca)\b/i;
/** Resposta curta a uma confirmação: "sim" / "não" / null (não deu pra saber — vai pro modelo). */
export function respostaDeConfirmacao(texto) {
  const t = String(texto || "").trim();
  if (t.split(/\s+/).length > 6) return null;
  if (nao.test(t)) return "nao";
  if (sim.test(t)) return "sim";
  return null;
}

const palavras = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .split(/[^a-z0-9]+/).filter((p) => p.length >= 3);
const VAZIAS = new Set(["card", "cards", "tarefa", "tarefas", "cartao", "abacato", "quadro", "coluna", "lista", "para", "com", "que", "uma", "dos", "das", "nos", "nas", "esse", "essa", "este", "esta", "isso", "aquele", "aquela", "marca", "marque", "conclui", "concluir", "arquiva", "arquivar", "apaga", "apagar", "exclui", "excluir", "move", "mover", "muda", "mudar", "prazo", "cria", "criar", "pode", "favor", "por"]);

/**
 * Os cards cujo título mais combina com o pedido, por palavras em comum (sem acento). Os da
 * conversa recente entram na frente: "conclui ele" fala do card de que se acabou de falar.
 */
export function candidatosDoPedido(texto, cards, recentes = [], maximo = 12) {
  const alvo = new Set(palavras(texto).filter((p) => !VAZIAS.has(p)));
  const pontos = (c) => palavras(c.title).filter((p) => alvo.has(p)).length;
  const vistos = new Set();
  const lista = [];
  for (const c of recentes) if (c?.id && !vistos.has(c.id)) { vistos.add(c.id); lista.push(c); }
  const porTexto = alvo.size
    ? cards.map((c) => ({ c, p: pontos(c) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p).map((x) => x.c)
    : [];
  for (const c of porTexto) if (!vistos.has(c.id)) { vistos.add(c.id); lista.push(c); }
  return lista.slice(0, maximo);
}

/**
 * A ação pendente volta do navegador a cada pergunta — não é confiável. Só passa o que tem
 * formato de ação do Abacato; o resto vira null (e ninguém executa nada por engano).
 */
export function pendenteValida(p) {
  if (!p || typeof p !== "object") return null;
  if (p.type === "abacato" && ACOES.includes(p.acao)) {
    const texto = (v, max) => (typeof v === "string" ? v.slice(0, max) : undefined);
    const limpa = {
      type: "abacato",
      acao: p.acao,
      card_id: texto(p.card_id, 64),
      card_titulo: texto(p.card_titulo, 300),
      coluna_id: texto(p.coluna_id, 64),
      destino: texto(p.destino, 300),
      titulo: texto(p.titulo, 300),
      descricao: texto(p.descricao, 8000),
      prazo: texto(p.prazo, 40),
    };
    if (p.acao === "criar" ? !(limpa.coluna_id && limpa.titulo) : !limpa.card_id) return null;
    if (p.acao === "mover" && !limpa.coluna_id) return null;
    return limpa;
  }
  if (p.type === "abacato_escolha" && ACOES.includes(p.acao) && Array.isArray(p.candidatos)) {
    return {
      type: "abacato_escolha",
      acao: p.acao,
      candidatos: p.candidatos.filter((c) => c && typeof c.id === "string").slice(0, 8)
        .map((c) => ({ id: c.id.slice(0, 64), titulo: String(c.titulo || "").slice(0, 300), quadro: String(c.quadro || "").slice(0, 200) })),
      mudancas: p.mudancas && typeof p.mudancas === "object" ? {
        titulo: typeof p.mudancas.titulo === "string" ? p.mudancas.titulo.slice(0, 300) : undefined,
        descricao: typeof p.mudancas.descricao === "string" ? p.mudancas.descricao.slice(0, 8000) : undefined,
        prazo: typeof p.mudancas.prazo === "string" ? p.mudancas.prazo.slice(0, 40) : undefined,
        coluna_id: typeof p.mudancas.coluna_id === "string" ? p.mudancas.coluna_id.slice(0, 64) : undefined,
        destino: typeof p.mudancas.destino === "string" ? p.mudancas.destino.slice(0, 300) : undefined,
        rascunho: p.mudancas.rascunho === true || undefined,
        pedido: typeof p.mudancas.pedido === "string" ? p.mudancas.pedido.slice(0, 2000) : undefined,
      } : {},
    };
  }
  if (p.type === "abacato_rascunho") return rascunhoValido(p);
  return null;
}

// ---------------------------------------------------------------------------------------------
// RASCUNHO DO CARD: montar o card conversando.
//
// Em vez de escrever e pedir "Confirma?" de uma vez, a Lisa abre um rascunho: pergunta o que
// falta (para quem é, objetivo, tom, prazo), escreve uma versão, ajusta a cada pedido ("deixa
// mais curto", "fala do preço", "põe prazo sexta") e só grava quando você aprova ("pode criar").
// O rascunho vive como ação pendente no navegador, como as outras — volta a cada mensagem e é
// conferido aqui. Quem conduz a conversa é conduzirRascunho (gemini.js); o fluxo, em
// fluxoDeAcoesNoAbacato.js.

export const MAXIMO_DE_RODADAS = 30;

/** O rascunho vindo do navegador, limpo; null se não serve. */
export function rascunhoValido(p) {
  if (!p || p.type !== "abacato_rascunho" || !["criar", "editar"].includes(p.acao)) return null;
  const texto = (v, max) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const r = {
    type: "abacato_rascunho",
    acao: p.acao,
    card_id: texto(p.card_id, 64),
    card_titulo: texto(p.card_titulo, 300),
    coluna_id: texto(p.coluna_id, 64),
    destino: texto(p.destino, 300),
    titulo: texto(p.titulo, 300),
    descricao: texto(p.descricao, 8000),
    prazo: texto(p.prazo, 40),
    pedido: texto(p.pedido, 2000) || "",
    rodadas: Math.max(0, Math.min(MAXIMO_DE_RODADAS, Number.parseInt(p.rodadas, 10) || 0)),
  };
  if (r.acao === "editar" && !r.card_id) return null;
  return r;
}

// "me ajuda a montar um card", "vamos elaborar um card", "monta comigo", "me pergunta o que precisa"
const ELABORAR = /\b(me\s+ajud\w*\s+a\s+(?:montar|criar|fazer|elaborar|pensar|escrever)|vamos\s+(?:montar|elaborar|pensar|criar|escrever)\b.*\b(?:juntos|card|cart[ãa]o|tarefa)|(?:monta|montar|elabora|elaborar|pensa|pensar|escreve|escrever)\s+(?:isso\s+|o\s+card\s+|um\s+card\s+)?comigo|me\s+pergunt\w*\s+o\s+que)/i;

/** O pedido é para montar o card junto, conversando? */
export function querElaborar(texto) {
  return ELABORAR.test(String(texto || ""));
}

/**
 * Um título que o modelo propôs no meio do rascunho serve? Visto no teste de 18/10/2026: ao
 * encurtar o TEXTO, o modelo devolveu um título de 200 caracteres com um cliente inventado e a
 * data ISO repetida duas vezes. Título bom é curto e sem data de máquina.
 */
export function tituloAceitavel(t) {
  if (typeof t !== "string") return false;
  const s = t.trim();
  return s.length >= 2 && s.length <= 100 && !/\d{4}-\d{2}-\d{2}T?/.test(s);
}

/** A ação que o rascunho aprovado vira (passa por pendenteValida antes de executar). */
export function acaoDoRascunho(r) {
  const base = { type: "abacato", acao: r.acao, titulo: r.titulo, descricao: r.descricao, prazo: r.prazo };
  return r.acao === "criar"
    ? { ...base, coluna_id: r.coluna_id, destino: r.destino }
    : { ...base, card_id: r.card_id, card_titulo: r.card_titulo };
}

// O que vem depois desta linha é o rascunho na tela; a voz para antes dela (falaSemRascunho).
export const MARCA_DO_RASCUNHO = "── rascunho do card ──";

/** A resposta da Lisa: a fala dela e, se pedido, o rascunho como está agora. */
export function textoDoRascunho(r, fala, { mostrar = true } = {}) {
  if (!mostrar || !(r.titulo || r.descricao)) return fala;
  const linhas = [];
  if (r.titulo) linhas.push(`Título: ${r.titulo}`);
  if (r.acao === "criar" && r.destino) linhas.push(`Onde: ${r.destino}`);
  if (r.acao === "editar" && r.card_titulo) linhas.push(`Card: ${r.card_titulo}`);
  const prazo = r.prazo === "remover" ? "sem prazo" : prazoEmPalavras(r.prazo);
  if (prazo) linhas.push(`Prazo: ${prazo}`);
  return `${fala}\n\n${MARCA_DO_RASCUNHO}\n${linhas.join("\n")}${r.descricao ? `\n\n${r.descricao}` : ""}`;
}

/** Uma resposta separada em { fala, rascunho } — rascunho é "" quando não há. */
export function separarRascunho(texto) {
  const t = String(texto || "");
  const i = t.indexOf(MARCA_DO_RASCUNHO);
  return i < 0 ? { fala: t, rascunho: "" } : { fala: t.slice(0, i).trim(), rascunho: t.slice(i + MARCA_DO_RASCUNHO.length).trim() };
}

/** Só a parte falada de uma resposta (sem o rascunho, que é para ler na tela). */
export function falaSemRascunho(texto) {
  return separarRascunho(texto).fala;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "AAAA-MM-DD" ou "AAAA-MM-DDTHH:MM" → "16 de outubro" / "16 de outubro às 14h30". */
export function prazoEmPalavras(prazo) {
  const m = String(prazo || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, , mes, dia, hora, minuto] = m;
  const base = `${Number(dia)} de ${MESES[Number(mes) - 1]}`;
  return hora ? `${base} às ${Number(hora)}h${minuto !== "00" ? minuto : ""}` : base;
}

// "um card COM um pitch de vendas", "com o e-mail para o cliente", "com um roteiro da reunião":
// o pedido é de um TEXTO para a descrição. Rede de segurança para quando o modelo entende só um
// título ("Pitch de vendas") e cria o card vazio — visto no teste de 18/10/2026.
const PEDE_TEXTO = /\bcom\s+(?:um|uma|o|a|esse|essa|este|esta)?\s*(?:pitch|texto|e-?mail|roteiro|proposta|post|mensagem|resumo|script|apresenta[cç][ãa]o|passo\s+a\s+passo|discurso|argumento|carta|descri[cç][ãa]o\s+(?:de|do|da|com|sobre|explicando))\b/i;

/** O pedido é para a Lisa escrever um texto que vai na descrição? */
export function pedeTextoEscrito(texto) {
  return PEDE_TEXTO.test(String(texto || ""));
}

/** O começo de um texto longo, cortado numa palavra: "Minha programação é baseada em…". */
export function previaDoTexto(texto, max = 140) {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  return `${corte.slice(0, corte.lastIndexOf(" ") > 40 ? corte.lastIndexOf(" ") : max).replace(/[,;:.\s]+$/, "")}…`;
}

/**
 * A pergunta de confirmação, falada: curta, com o que vai mudar e onde.
 *
 * A descrição aparece SEMPRE (o começo dela) — antes, uma longa virava "com o texto completo na
 * descrição", e um card foi criado com um texto sem relação nenhuma com o pedido sem que desse
 * para perceber. Texto que a Lisa escreve na hora não passa por aqui: vai para o rascunho.
 */
export function resumoDaAcao(a) {
  const card = a.card_titulo ? `"${a.card_titulo}"` : "o card";
  const prazo = a.prazo === "remover" ? "sem prazo" : prazoEmPalavras(a.prazo);
  switch (a.acao) {
    case "criar": {
      const partes = [`Vou criar o card "${a.titulo}" em ${a.destino || "o quadro escolhido"}`];
      if (a.descricao) partes.push(`com a descrição "${previaDoTexto(a.descricao)}"`);
      if (prazo) partes.push(`e prazo para ${prazo}`);
      return `${partes.join(", ")}. Confirma?`;
    }
    case "editar": {
      const o = [];
      if (a.titulo) o.push(`o título para "${a.titulo}"`);
      if (a.descricao) o.push(`a descrição para "${previaDoTexto(a.descricao)}"`);
      if (prazo) o.push(a.prazo === "remover" ? "tirar o prazo" : `o prazo para ${prazo}`);
      return `Vou mudar ${o.join(", ") || "o card"} em ${card}. Confirma?`;
    }
    case "concluir": return `Vou marcar ${card} como concluído. Confirma?`;
    case "reabrir": return `Vou reabrir ${card}. Confirma?`;
    case "mover": return `Vou mover ${card} para ${a.destino || "a coluna escolhida"}. Confirma?`;
    case "arquivar": return `Vou excluir ${card} do quadro. Ele fica arquivado no Abacato, dá para recuperar. Confirma?`;
    default: return "Confirma?";
  }
}

/** O que ela diz depois de fazer. */
export function relatoDaAcao(a, resultado = {}) {
  const card = `"${resultado.titulo || a.card_titulo || a.titulo}"`;
  switch (a.acao) {
    case "criar": return `Pronto, criei o card ${card} em ${a.destino || "o quadro"}.`;
    case "editar": return `Pronto, atualizei o card ${card}.`;
    case "concluir": return resultado.reprogramado
      ? `Pronto, ${card} foi concluído e, como ele se repete, já voltou para ${prazoEmPalavras(String(resultado.fim_em || "").slice(0, 10)) || "a próxima data"}.`
      : `Pronto, ${card} está concluído.`;
    case "reabrir": return `Pronto, reabri ${card}.`;
    case "mover": return `Pronto, movi ${card} para ${a.destino || "a nova coluna"}.`;
    case "arquivar": return `Pronto, ${card} saiu do quadro. Ele fica arquivado no Abacato.`;
    default: return "Pronto.";
  }
}
