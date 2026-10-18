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
        texto_novo: p.mudancas.texto_novo === true || undefined,
      } : {},
    };
  }
  return null;
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
 * A descrição aparece SEMPRE — antes, uma longa virava "com o texto completo na descrição", e um
 * card foi criado com um texto sem relação nenhuma com o pedido sem que desse para perceber.
 * `textoNovo`: a Lisa acabou de escrever a descrição (ninguém viu ainda) → mostra inteira.
 */
export function resumoDaAcao(a, { textoNovo = false } = {}) {
  if (textoNovo && a.descricao && (a.acao === "criar" || a.acao === "editar")) {
    const onde = a.acao === "criar"
      ? `Vou criar o card "${a.titulo}" em ${a.destino || "o quadro escolhido"}`
      : `Vou colocar na descrição de ${a.card_titulo ? `"${a.card_titulo}"` : "o card"}`;
    const prazo = a.prazo === "remover" ? "sem prazo" : prazoEmPalavras(a.prazo);
    return `Escrevi este texto para a descrição:\n\n${a.descricao}\n\n${onde}${a.acao === "criar" && prazo ? `, com prazo para ${prazo}` : ""}${a.acao === "criar" ? " com ele" : " este texto"}. Confirma?`;
  }
  return resumoCurto(a);
}

function resumoCurto(a) {
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
