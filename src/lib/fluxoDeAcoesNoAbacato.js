// O fluxo de uma ação da Lisa no Abacato, do pedido à execução — chamado por /api/ask antes da
// resposta normal, em qualquer modo de conversa (texto, voz, conversa livre).
//
//   pedido ──► detectarAcaoNoAbacato ──► "propor"     ──► pergunta "Confirma?"   (ação pendente)
//                                     ├► "esclarecer" ──► "qual destes cards?"  (escolha pendente)
//                                     └► "nenhuma"    ──► segue para a resposta normal
//   "sim" (ou "selecionar" + "sim") ──► abacatoAcoes ──► "Pronto, ..."
//
// Toda escrita passa por um "Confirma?": a Lisa entende o pedido por voz, e um card criado no
// quadro errado ou arquivado por engano custa mais que um "sim".

import { detectarAcaoNoAbacato } from "./gemini.js";
import { loadAllCards } from "./liveQuadros.js";
import { quadrosEColunas, criarCard, mudarCard, arquivarCard } from "./abacatoAcoes.js";
import { candidatosDoPedido, pendenteValida, respostaDeConfirmacao, resumoDaAcao, relatoDaAcao } from "./acoesNoAbacato.js";
import { turnosValidos, blocoDaConversa } from "./conversa.js";

// "quarta-feira, 15 de outubro de 2026" em Brasília — a mesma de rag.js, sem puxar a persona junto.
const todayLabel = () => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date());

const NADA = { respondeu: false };
const responde = (texto, pending = null, cards = []) => ({ respondeu: true, texto, pending, cards });

/**
 * `pendente` já passou por pendenteValida. Devolve { respondeu:false } quando não é ação, ou
 * { respondeu:true, texto, pending, cards } com o que dizer e a nova ação pendente (ou null).
 */
export async function tratarAcaoNoAbacato({ pergunta, history, pendente, quadroPadrao }) {
  // "sim"/"não" a uma ação proposta: sem gastar o modelo.
  if (pendente?.type === "abacato") {
    const r = respostaDeConfirmacao(pergunta);
    if (r === "sim") return executar(pendente);
    if (r === "nao") return responde("Beleza, não mudei nada.");
  }

  const turnos = turnosValidos(history?.turnos);
  const [cards, quadros] = await Promise.all([
    loadAllCards({ fonte: "abacato" }).catch(() => []),
    quadrosEColunas().catch(() => []),
  ]);
  // Os cards da resposta anterior vêm sem coluna/prazo (a busca não traz): completa pelo id.
  const porId = new Map(cards.map((c) => [c.id, c]));
  const recentes = (history?.cards || []).map((c) => porId.get(c?.id)).filter(Boolean);
  const anterior = turnos.filter((t) => t.papel === "voce").at(-1)?.texto || "";
  const candidatos = candidatosDoPedido(`${pergunta} ${anterior}`, cards, recentes);

  const d = await detectarAcaoNoAbacato({
    pergunta,
    hoje: todayLabel(),
    conversa: blocoDaConversa(turnos),
    ultimaResposta: typeof history?.ultimaResposta === "string" ? history.ultimaResposta : "",
    candidatos,
    quadros,
    quadroPadrao,
    pendente,
  });

  if (d.intent === "confirmar" && pendente?.type === "abacato") return executar(pendente);
  if (d.intent === "cancelar" && pendente) return responde("Beleza, não mudei nada.");

  if (d.intent === "selecionar" && pendente?.type === "abacato_escolha") {
    const escolhido = pendente.candidatos.find((c) => c.id === d.card_id);
    if (!escolhido) return responde("Não entendi qual deles. Pode dizer o número ou o nome do card?", pendente);
    return propor({ acao: pendente.acao, card_id: escolhido.id, ...pendente.mudancas }, { porId, quadros, history, quadroPadrao });
  }

  if (d.intent === "esclarecer" && d.acao) {
    const opcoes = (d.candidatos_ids || []).map((id) => porId.get(id)).filter(Boolean).slice(0, 4);
    if (opcoes.length >= 2) {
      const mudancas = await camposDaAcao(d, { quadros, history, porId });
      const pending = pendenteValida({
        type: "abacato_escolha",
        acao: d.acao,
        candidatos: opcoes.map((c) => ({ id: c.id, titulo: c.title, quadro: c.board })),
        mudancas,
      });
      const lista = opcoes.map((c, i) => `${i + 1}, "${c.title}", no ${c.board}`).join("; ");
      return responde(`Achei mais de um card parecido: ${lista}. Qual deles?`, pending, opcoes);
    }
    if (opcoes.length === 1) d.card_id = opcoes[0].id; // sobrou um: segue como proposta
    else return NADA;
  }

  if (d.intent === "propor" || (d.intent === "esclarecer" && d.card_id)) {
    return propor(d, { porId, quadros, history, quadroPadrao });
  }
  return NADA;
}

/** Os campos que mudam, já resolvidos (texto da última resposta, coluna de destino). */
async function camposDaAcao(d, { quadros, history }) {
  const descricao = d.usar_ultima_resposta && typeof history?.ultimaResposta === "string"
    ? history.ultimaResposta
    : d.descricao;
  let destino;
  if (d.coluna_id) {
    for (const q of quadros) {
      const c = q.colunas.find((x) => x.id === d.coluna_id);
      if (c) destino = `${q.nome}, coluna ${c.nome}`;
    }
  }
  return { titulo: d.titulo, descricao, prazo: d.prazo, coluna_id: d.coluna_id, destino };
}

async function propor(d, { porId, quadros, history, quadroPadrao }) {
  const campos = await camposDaAcao(d, { quadros, history });
  let base;
  if (d.acao === "criar") {
    // sem coluna válida: a primeira coluna do quadro padrão (ou do primeiro quadro)
    if (!campos.destino) {
      const q = quadros.find((x) => x.nome === quadroPadrao && x.colunas.length) || quadros.find((x) => x.colunas.length);
      const c = q?.colunas?.[0];
      if (!c) return responde("Não achei nenhum quadro com colunas no Abacato para criar o card.");
      campos.coluna_id = c.id;
      campos.destino = `${q.nome}, coluna ${c.nome}`;
    }
    if (!campos.titulo) return responde("Qual vai ser o título do card?");
    base = { type: "abacato", acao: "criar", ...campos };
  } else {
    const card = porId.get(d.card_id);
    if (!card) return responde("Não achei esse card no Abacato. Pode me dizer o nome dele?");
    if (d.acao === "mover") {
      const quadro = quadros.find((q) => q.id === card.board_id);
      const coluna = quadro?.colunas.find((c) => c.id === campos.coluna_id);
      if (!coluna) return responde(`Para qual coluna do ${card.board} eu movo "${card.title}"?`);
      campos.destino = `a coluna ${coluna.nome}`;
    }
    base = { type: "abacato", acao: d.acao, card_id: card.id, card_titulo: card.title, ...campos };
  }
  const pending = pendenteValida(base);
  if (!pending) return responde("Não entendi direito o que mudar. Pode repetir de outro jeito?");
  return responde(resumoDaAcao(pending), pending, d.card_id && porId.get(d.card_id) ? [porId.get(d.card_id)] : []);
}

async function executar(p) {
  try {
    let resultado;
    if (p.acao === "criar") resultado = await criarCard({ colunaId: p.coluna_id, titulo: p.titulo, descricao: p.descricao, prazo: p.prazo });
    else if (p.acao === "arquivar") resultado = await arquivarCard(p.card_id);
    else if (p.acao === "concluir") resultado = await mudarCard(p.card_id, { concluido: true });
    else if (p.acao === "reabrir") resultado = await mudarCard(p.card_id, { concluido: false });
    else if (p.acao === "mover") resultado = await mudarCard(p.card_id, { colunaId: p.coluna_id });
    else resultado = await mudarCard(p.card_id, { titulo: p.titulo, descricao: p.descricao, prazo: p.prazo });
    return responde(relatoDaAcao(p, resultado));
  } catch (err) {
    return responde(`Não consegui fazer isso no Abacato: ${err.message}.`);
  }
}
