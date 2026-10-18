// O fluxo de uma ação da Lisa no Abacato, do pedido à execução — chamado por /api/ask antes da
// resposta normal, em qualquer modo de conversa (texto, voz, conversa livre).
//
//   pedido ──► detectarAcaoNoAbacato ──► "propor"     ──► pergunta "Confirma?"   (ação pendente)
//                                     │                └► texto a escrever / "me ajuda a montar"
//                                     │                     ──► RASCUNHO (rascunho pendente)
//                                     ├► "esclarecer" ──► "qual destes cards?"  (escolha pendente)
//                                     └► "nenhuma"    ──► segue para a resposta normal
//   "sim" (ou "selecionar" + "sim") ──► abacatoAcoes ──► "Pronto, ..."
//
//   rascunho pendente ──► conduzirRascunho ──► perguntar / atualizar ──► rascunho continua
//                                           ├► concluir ──► abacatoAcoes ──► "Pronto, ..."
//                                           ├► cancelar ──► "deixei de lado"
//                                           └► fora     ──► resposta normal (rascunho guardado)
//
// Toda escrita passa por um "sim": a Lisa entende o pedido por voz, e um card criado no quadro
// errado ou arquivado por engano custa mais que um "sim". No rascunho, o "sim" é o "pode criar"
// depois de ver o texto.

import { detectarAcaoNoAbacato, conduzirRascunho } from "./gemini.js";
import { loadAllCards } from "./liveQuadros.js";
import { quadrosEColunas, cardDoAbacato, criarCard, mudarCard, arquivarCard } from "./abacatoAcoes.js";
import {
  candidatosDoPedido, pendenteValida, respostaDeConfirmacao, resumoDaAcao, relatoDaAcao, pedeTextoEscrito, querElaborar, tituloAceitavel,
  rascunhoValido, acaoDoRascunho, textoDoRascunho, MAXIMO_DE_RODADAS,
} from "./acoesNoAbacato.js";
import { turnosValidos, blocoDaConversa } from "./conversa.js";

// "quarta-feira, 15 de outubro de 2026" em Brasília — a mesma de rag.js, sem puxar a persona junto.
const todayLabel = () => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date());

const NADA = { respondeu: false };
const responde = (texto, pending = null, cards = []) => ({ respondeu: true, texto, pending, cards });

/**
 * `buscar(texto)` (opcional, vem de /api/ask) traz do índice o que a Lisa sabe sobre o assunto —
 * é o que ela usa para escrever o texto de um rascunho. Sem ele, escreve só com a conversa.
 *
 * `pendente` já passou por pendenteValida. Devolve { respondeu:false } quando não é ação, ou
 * { respondeu:true, texto, pending, cards } com o que dizer e a nova ação pendente (ou null).
 */
export async function tratarAcaoNoAbacato({ pergunta, history, pendente, quadroPadrao, buscar = null }) {
  // "sim"/"não" a uma ação proposta: sem gastar o modelo.
  if (pendente?.type === "abacato") {
    const r = respostaDeConfirmacao(pergunta);
    if (r === "sim") return executar(pendente);
    if (r === "nao") return responde("Beleza, não mudei nada.");
  }

  const turnos = turnosValidos(history?.turnos);
  const conversa = blocoDaConversa(turnos);

  // Um rascunho aberto: a mensagem é sobre ele (ou não — aí ele fica guardado).
  if (pendente?.type === "abacato_rascunho") {
    const quadros = await quadrosEColunas().catch(() => []);
    return continuarRascunho(pendente, pergunta, { conversa, quadros, buscar });
  }

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
    conversa,
    ultimaResposta: typeof history?.ultimaResposta === "string" ? history.ultimaResposta : "",
    candidatos,
    quadros,
    quadroPadrao,
    pendente,
  });

  // "cria um card com um pitch de vendas" que o modelo entendeu só como título: é texto a escrever.
  if (d.intent === "propor" && (d.acao === "criar" || d.acao === "editar") && !d.descricao && !d.escrever_descricao && !d.usar_ultima_resposta && pedeTextoEscrito(pergunta)) {
    d.escrever_descricao = pergunta;
  }
  // "me ajuda a montar um card" que o modelo entendeu como card pronto: é para montar junto.
  if (d.intent === "propor" && (d.acao === "criar" || d.acao === "editar") && querElaborar(pergunta)) d.elaborar = true;
  const vaiParaRascunho = (d.acao === "criar" || d.acao === "editar") && (d.escrever_descricao || d.elaborar);

  if (d.intent === "confirmar" && pendente?.type === "abacato") return executar(pendente);
  if (d.intent === "cancelar" && pendente) return responde("Beleza, não mudei nada.");

  if (d.intent === "selecionar" && pendente?.type === "abacato_escolha") {
    const escolhido = pendente.candidatos.find((c) => c.id === d.card_id);
    if (!escolhido) return responde("Não entendi qual deles. Pode dizer o número ou o nome do card?", pendente);
    const { rascunho, pedido, ...mudancas } = pendente.mudancas || {};
    if (rascunho) return abrirRascunho({ acao: pendente.acao, card_id: escolhido.id, ...mudancas }, pedido || pergunta, { porId, quadros, quadroPadrao, conversa, buscar });
    return propor({ acao: pendente.acao, card_id: escolhido.id, ...mudancas }, { porId, quadros, history, quadroPadrao });
  }

  if (d.intent === "esclarecer" && d.acao) {
    const opcoes = (d.candidatos_ids || []).map((id) => porId.get(id)).filter(Boolean).slice(0, 4);
    if (opcoes.length >= 2) {
      const mudancas = vaiParaRascunho
        ? { titulo: d.titulo, prazo: d.prazo, rascunho: true, pedido: d.escrever_descricao || pergunta }
        : camposDaAcao(d, { quadros, history });
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
    if (vaiParaRascunho) return abrirRascunho(d, d.escrever_descricao || pergunta, { porId, quadros, quadroPadrao, conversa, buscar });
    return propor(d, { porId, quadros, history, quadroPadrao });
  }
  return NADA;
}

/** Os campos que mudam, já resolvidos (texto da última resposta, coluna de destino). */
function camposDaAcao(d, { quadros, history }) {
  const descricao = d.usar_ultima_resposta && typeof history?.ultimaResposta === "string"
    ? history.ultimaResposta
    : d.descricao;
  return { titulo: d.titulo, descricao, prazo: d.prazo, coluna_id: d.coluna_id, destino: destinoDaColuna(d.coluna_id, quadros) };
}

function destinoDaColuna(colunaId, quadros) {
  for (const q of quadros) {
    const c = q.colunas.find((x) => x.id === colunaId);
    if (c) return `${q.nome}, coluna ${c.nome}`;
  }
  return undefined;
}

/** Onde criar: a coluna pedida, ou a primeira do quadro padrão (ou do primeiro quadro). */
function ondeCriar(colunaId, quadros, quadroPadrao) {
  const destino = destinoDaColuna(colunaId, quadros);
  if (destino) return { coluna_id: colunaId, destino };
  const q = quadros.find((x) => x.nome === quadroPadrao && x.colunas.length) || quadros.find((x) => x.colunas.length);
  const c = q?.colunas?.[0];
  return c ? { coluna_id: c.id, destino: `${q.nome}, coluna ${c.nome}` } : null;
}

async function propor(d, { porId, quadros, history, quadroPadrao }) {
  const campos = camposDaAcao(d, { quadros, history });
  let base;
  if (d.acao === "criar") {
    const onde = ondeCriar(campos.coluna_id, quadros, quadroPadrao);
    if (!onde) return responde("Não achei nenhum quadro com colunas no Abacato para criar o card.");
    if (!campos.titulo) return responde("Qual vai ser o título do card?");
    base = { type: "abacato", acao: "criar", ...campos, ...onde };
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

// ---------------------------------------------------------------------------------------------
// O RASCUNHO: montar o card conversando.

/** Abre o rascunho e já dá o primeiro passo (perguntar o que falta ou escrever a 1ª versão). */
async function abrirRascunho(d, pedido, { porId, quadros, quadroPadrao, conversa, buscar }) {
  let r;
  if (d.acao === "criar") {
    const onde = ondeCriar(d.coluna_id, quadros, quadroPadrao);
    if (!onde) return responde("Não achei nenhum quadro com colunas no Abacato para criar o card.");
    r = { type: "abacato_rascunho", acao: "criar", titulo: d.titulo, prazo: d.prazo, ...onde };
  } else {
    // editar: o rascunho começa do card como ele está (a descrição atual vem do banco)
    const card = await cardDoAbacato(d.card_id).catch(() => null);
    if (!card) return responde("Não achei esse card no Abacato. Pode me dizer o nome dele?");
    r = { type: "abacato_rascunho", acao: "editar", card_id: card.id, card_titulo: card.titulo, titulo: card.titulo, descricao: card.descricao || undefined, prazo: d.prazo };
  }
  const rascunho = rascunhoValido({ ...r, pedido, rodadas: 0 });
  const cards = d.card_id && porId.get(d.card_id) ? [porId.get(d.card_id)] : [];
  return { ...(await continuarRascunho(rascunho, pedido, { conversa, quadros, buscar, primeira: true })), cards };
}

/** Uma rodada do rascunho: o modelo decide, e a resposta mostra o card como ficou. */
async function continuarRascunho(r, mensagem, { conversa, quadros, buscar, primeira = false }) {
  const contexto = buscar ? await buscar(`${r.pedido} ${primeira ? "" : mensagem}`.trim()).catch(() => []) : [];
  const d = await conduzirRascunho({ rascunho: r, mensagem, conversa, contexto, quadros, hoje: todayLabel() });

  if (d.intent === "concluir") {
    const acao = pendenteValida(acaoDoRascunho(r));
    if (!acao) return responde("Ainda falta o título do card. Como ele vai se chamar?", r);
    return executar(acao);
  }
  if (d.intent === "cancelar") return responde("Beleza, deixei esse card de lado. Não gravei nada.");
  // Outro assunto: a resposta normal cuida, e o rascunho continua guardado no navegador.
  // Na primeira rodada não há rascunho ainda para guardar — então pergunta.
  if (d.intent === "fora" && !primeira) return NADA;

  const novo = { ...r, rodadas: Math.min(r.rodadas + 1, MAXIMO_DE_RODADAS) };
  if (d.intent === "atualizar") {
    if (tituloAceitavel(d.titulo)) novo.titulo = d.titulo.trim();
    if (typeof d.descricao === "string" && d.descricao.trim()) novo.descricao = d.descricao.slice(0, 8000);
    if (typeof d.prazo === "string" && /^(\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?|remover)$/.test(d.prazo)) novo.prazo = d.prazo;
    const destino = r.acao === "criar" ? destinoDaColuna(d.coluna_id, quadros) : undefined;
    if (destino) { novo.coluna_id = d.coluna_id; novo.destino = destino; }
  }
  const fala = String(d.fala || "").trim() || (d.intent === "atualizar"
    ? `Ajustei. Quer mudar mais alguma coisa ou posso ${r.acao === "criar" ? "criar" : "salvar"}?`
    : "Me conta um pouco mais do que você quer nesse card?");
  const rascunho = rascunhoValido(novo);
  // O card aparece na tela quando muda (ou na primeira vez que tem texto); numa pergunta, não.
  return responde(textoDoRascunho(rascunho, fala, { mostrar: d.intent === "atualizar" }), rascunho);
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
