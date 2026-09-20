import { supabase } from "@/lib/supabase.js";

/**
 * Os quadros do Abacato, no MESMO formato de documento que `loadTrello` devolve.
 *
 * Mesmo formato é o ponto inteiro deste arquivo: tudo que a Lisa faz com quadros — o Kanban, o
 * painel de tarefas, as notificações de card novo, a busca semântica do assistente — já sabe
 * ler esse formato. Devolvendo a mesma coisa, trocar a fonte vira uma linha, e nenhuma das
 * dezenas de telas precisa saber que o Trello existiu.
 *
 * POR QUE LER O BANCO DIRETO, e não chamar a API do Abacato:
 *
 * a Lisa já carrega a chave de serviço deste mesmo Postgres — a chave-mestra, que abre
 * inclusive as tabelas `abacato_*`. Uma rota HTTP no Abacato acrescentaria um segredo novo,
 * um salto de rede e uma dependência de o Worker do Abacato estar no ar, em troca de nada:
 * não haveria uma única coisa que a rota protegesse e a chave já não abrisse.
 *
 * O contrato aqui é o esquema em `Abacatosys/abacato/db/schema.sql`. Se uma coluna mudar de
 * nome lá, este arquivo quebra — e é por isso que existe o `npm run abacato-check`, que
 * confere as colunas contra o banco de verdade antes de alguém descobrir pela tela vazia.
 */

const BASE_PUBLICA = (process.env.ABACATO_URL || "https://abacato.beyond.dev.br").replace(/\/+$/, "");

/** Formata ISO em "03 de agosto de 2026 (segunda-feira)" — igual ao do Trello, e pelo mesmo
 *  motivo: o Gemini indexa palavras, então "vence em" e "segunda-feira" precisam estar
 *  escritos, não implícitos numa data ISO. */
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "long", year: "numeric", weekday: "long",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Agrupa linhas por uma chave estrangeira. Um Map evita o `.filter()` dentro do laço, que é
 *  como um quadro de 400 cards vira 400 varreduras de lista. */
function agrupar(linhas, chave) {
  const m = new Map();
  for (const l of linhas || []) {
    if (!m.has(l[chave])) m.set(l[chave], []);
    m.get(l[chave]).push(l);
  }
  return m;
}

/**
 * Carrega os cards do Abacato como documentos.
 *
 * `quadroIds` limita a quadros específicos — é o que permite a indexação fatiar por quadro,
 * do mesmo jeito que faz com os boards do Trello.
 *
 * Cards ARQUIVADOS ficam de fora, e colunas arquivadas também. O arquivado é histórico: ele
 * existe para poder ser reencontrado, não para a Lisa responder "você tem 340 tarefas" contando
 * coisa de dois anos atrás.
 */
export async function loadAbacato({ quadroIds = null } = {}) {
  let consultaQuadros = supabase
    .from("abacato_quadros")
    .select("id, nome, arquivado")
    .eq("arquivado", false);
  if (quadroIds?.length) consultaQuadros = consultaQuadros.in("id", quadroIds);

  const { data: quadros, error } = await consultaQuadros;
  if (error) throw new Error(`Abacato (quadros) → ${error.message}`);
  if (!quadros?.length) return [];

  const idsDeQuadro = quadros.map((q) => q.id);

  const { data: colunas } = await supabase
    .from("abacato_colunas")
    .select("id, quadro_id, nome, posicao")
    .in("quadro_id", idsDeQuadro)
    .eq("arquivada", false);

  const idsDeColuna = (colunas || []).map((c) => c.id);
  if (!idsDeColuna.length) return [];

  const { data: cards } = await supabase
    .from("abacato_cards")
    .select("id, coluna_id, titulo, descricao, posicao, inicio_em, fim_em, concluido, criado_em")
    .in("coluna_id", idsDeColuna)
    .eq("arquivado", false);

  if (!cards?.length) return [];
  const idsDeCard = cards.map((c) => c.id);

  const [vinculos, etiquetas, checklists] = await Promise.all([
    supabase.from("abacato_card_etiquetas").select("card_id, etiqueta_id").in("card_id", idsDeCard),
    supabase.from("abacato_etiquetas").select("id, nome").in("quadro_id", idsDeQuadro),
    supabase.from("abacato_checklists").select("id, card_id, titulo").in("card_id", idsDeCard),
  ]);

  const idsDeChecklist = (checklists.data || []).map((c) => c.id);
  const itens = idsDeChecklist.length
    ? (await supabase.from("abacato_checklist_itens")
        .select("checklist_id, texto, feito").in("checklist_id", idsDeChecklist)).data || []
    : [];

  const quadroPorId = new Map(quadros.map((q) => [q.id, q]));
  const colunaPorId = new Map((colunas || []).map((c) => [c.id, c]));
  const etiquetaPorId = new Map((etiquetas.data || []).map((e) => [e.id, e.nome]));
  const etiquetasDoCard = agrupar(vinculos.data, "card_id");
  const checklistsDoCard = agrupar(checklists.data, "card_id");
  const itensDaChecklist = agrupar(itens, "checklist_id");

  const docs = [];
  for (const card of cards) {
    const coluna = colunaPorId.get(card.coluna_id);
    if (!coluna) continue;
    const quadro = quadroPorId.get(coluna.quadro_id);
    if (!quadro) continue;

    const nomesDeEtiqueta = (etiquetasDoCard.get(card.id) || [])
      .map((v) => etiquetaPorId.get(v.etiqueta_id))
      .filter(Boolean);
    // Etiqueta sem nome existe no Abacato (é só a cor). Ela não ajuda ninguém a buscar, então
    // não entra no texto — mas o card continua tendo a cor na tela.
    const labels = nomesDeEtiqueta.join(", ");

    // As checklists entram no texto indexado. É o que permite perguntar "o que falta na
    // proposta do cliente?" e a Lisa responder com os itens, em vez de só dizer "3 de 5".
    const linhasDeChecklist = [];
    for (const cl of checklistsDoCard.get(card.id) || []) {
      const itensDela = itensDaChecklist.get(cl.id) || [];
      if (!itensDela.length) continue;
      const feitos = itensDela.filter((i) => i.feito).length;
      linhasDeChecklist.push(`${cl.titulo} (${feitos}/${itensDela.length}):`);
      for (const i of itensDela) linhasDeChecklist.push(`  ${i.feito ? "[x]" : "[ ]"} ${i.texto}`);
    }

    const dueLine = card.fim_em
      ? `Data de entrega/prazo: ${fmtDate(card.fim_em)}${card.concluido ? " (concluído)" : ""}`
      : "";
    const startLine = card.inicio_em ? `Data de início: ${fmtDate(card.inicio_em)}` : "";

    const content = [
      card.titulo,
      `Lista: ${coluna.nome}`,
      labels ? `Etiquetas: ${labels}` : "",
      dueLine,
      startLine,
      card.descricao ? `\nDescrição:\n${card.descricao}` : "",
      linhasDeChecklist.length ? `\nChecklists:\n${linhasDeChecklist.join("\n")}` : "",
    ].filter(Boolean).join("\n");

    docs.push({
      source: "abacato",
      external_id: card.id,
      board: quadro.nome,
      title: card.titulo,
      content,
      last_modified: card.criado_em || null,
      metadata: {
        list: coluna.nome,
        list_pos: coluna.posicao ?? null,
        // Link direto para o card, e não só para o quadro: a Lisa cita a tarefa e o clique
        // precisa abrir ELA, não uma coluna com trinta cards para procurar no meio.
        url: `${BASE_PUBLICA}/quadros/${quadro.id}?card=${card.id}`,
        labels,
        due: card.fim_em || null,
        start: card.inicio_em || null,
        due_complete: card.concluido === true,
        board_id: quadro.id,
        id_list: coluna.id,
      },
    });
  }

  return docs;
}

/** Os quadros do Abacato, só id e nome. A indexação usa para fatiar um quadro por passo, do
 *  mesmo jeito que faz com os boards do Trello. */
export async function listarQuadrosDoAbacato() {
  const { data, error } = await supabase
    .from("abacato_quadros")
    .select("id, nome")
    .eq("arquivado", false)
    .order("criado_em");
  if (error) throw new Error(`Abacato (quadros) → ${error.message}`);
  return data || [];
}

/** As colunas de um quadro — { id, name } — para resolver "mover para a lista X" por nome.
 *  Mesma forma do `getBoardLists` do Trello, porque quem chama é o mesmo código. */
export async function getQuadroColunas(quadroId) {
  const { data } = await supabase
    .from("abacato_colunas")
    .select("id, nome")
    .eq("quadro_id", quadroId)
    .eq("arquivada", false)
    .order("posicao");
  return (data || []).map((c) => ({ id: c.id, name: c.nome }));
}

// ---------------------------------------------------------------- escrita

/**
 * Altera um card do Abacato — prazo, concluído, coluna.
 *
 * Mesma assinatura do `updateTrelloCard`, de propósito: quem chama é o mesmo código do
 * assistente, e uma assinatura diferente obrigaria aquele código a saber de qual sistema o
 * card veio.
 *
 * Escreve DIRETO no banco, pelo mesmo motivo da leitura: a Lisa já tem a chave-mestra deste
 * Postgres. Vale dizer o que isso significa — esta escrita passa por cima das permissões que
 * a API do Abacato confere. É deliberado e é o que foi pedido ("o Abacato totalmente aberto
 * para a Lisa"), mas é uma porta que não existe para mais ninguém.
 */
export async function atualizarCardDoAbacato(cardId, { due, idList, dueComplete } = {}) {
  const mudancas = {};
  if (due !== undefined) mudancas.fim_em = due === null || due === "" ? null : new Date(due).toISOString();
  if (dueComplete !== undefined) mudancas.concluido = Boolean(dueComplete);

  if (idList !== undefined) {
    // Mover de coluna sem recalcular a posição deixa o card com a posição da coluna ANTIGA:
    // ele apareceria num lugar arbitrário da nova, tipicamente no meio. Vai para o topo, que
    // é onde se espera achar o que acabou de chegar.
    const { data: primeiro } = await supabase
      .from("abacato_cards").select("posicao")
      .eq("coluna_id", idList).eq("arquivado", false)
      .order("posicao").limit(1).maybeSingle();
    mudancas.coluna_id = idList;
    mudancas.posicao = primeiro ? primeiro.posicao - 1024 : 1024;
  }

  if (!Object.keys(mudancas).length) return null;

  const { data, error } = await supabase
    .from("abacato_cards").update(mudancas).eq("id", cardId)
    .select("id, coluna_id, fim_em, concluido").single();
  if (error) throw new Error(`Abacato (atualizar card) → ${error.message}`);
  return data;
}
