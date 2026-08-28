const KEY = process.env.TRELLO_KEY;
const TOKEN = process.env.TRELLO_TOKEN;
const DEFAULT_BOARD_IDS = (process.env.TRELLO_BOARD_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const API = "https://api.trello.com/1";

function auth(qs = {}) {
  const params = new URLSearchParams({ key: KEY, token: TOKEN, ...qs });
  return params.toString();
}

async function tget(path, qs) {
  const res = await fetch(`${API}${path}?${auth(qs)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Trello ${path} → ${res.status} ${res.statusText} ${body.slice(0, 120)}`);
  }
  return res.json();
}

async function twrite(method, path, qs) {
  const res = await fetch(`${API}${path}?${auth(qs)}`, { method });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Trello ${method} ${path} → ${res.status} ${res.statusText} ${body.slice(0, 150)}`);
  }
  return res.json();
}

/** Formata ISO em "03 de agosto de 2026 (segunda-feira)" — melhor pro RAG. */
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "long", year: "numeric", weekday: "long",
      timeZone: "America/Sao_Paulo",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Carrega cards abertos dos boards.
 * opts.boardIds (opcional) sobrescreve TRELLO_BOARD_IDS — útil p/ ingest particionado.
 */
export async function loadTrello(opts = {}) {
  if (!KEY || !TOKEN) {
    console.warn("[trello] TRELLO_KEY/TRELLO_TOKEN ausentes — pulando Trello.");
    return [];
  }
  const boardIds = (opts.boardIds && opts.boardIds.length ? opts.boardIds : DEFAULT_BOARD_IDS);
  if (!boardIds.length) {
    console.warn("[trello] nenhum board configurado — pulando.");
    return [];
  }

  // Busca todos os boards EM PARALELO (não um de cada vez) — e, dentro de cada board, os 3
  // pedidos (nome/listas/cards) também são independentes entre si, então também vão juntos.
  // Isso é o maior peso na demora entre perguntar e a resposta começar a chegar: sequencial,
  // 4 boards × 3 chamadas cada podiam somar bem mais que em paralelo (limitado só pela mais
  // lenta das chamadas, não pela SOMA de todas).
  const perBoard = await Promise.all(boardIds.map(async (boardRef) => {
    try {
      const [board, lists, cards] = await Promise.all([
        tget(`/boards/${boardRef}`, { fields: "name" }),
        tget(`/boards/${boardRef}/lists`, { fields: "name,pos" }),
        tget(`/boards/${boardRef}/cards`, {
          fields: "name,desc,dateLastActivity,idList,shortUrl,labels,due,start,dueComplete",
          filter: "open",
        }),
      ]);
      const boardName = board?.name || boardRef;
      const listMeta = Object.fromEntries((lists || []).map((l) => [l.id, { name: l.name, pos: l.pos }]));
      console.log(`[trello] "${boardName}": ${(cards || []).length} cards`);
      return { boardRef, boardName, listMeta, cards: cards || [] };
    } catch (err) {
      console.error(`[trello] falha no board ${boardRef}: ${err.message}`);
      return null;
    }
  }));

  const docs = [];

  for (const board of perBoard) {
    if (!board) continue;
    const { boardRef, boardName, listMeta, cards } = board;
    for (const card of cards) {
      const list = listMeta[card.idList]?.name || "";
      const listPos = listMeta[card.idList]?.pos ?? null;
      const labels = (card.labels || []).map((l) => l.name).filter(Boolean).join(", ");

      // datas humanizadas (o Gemini indexa palavras — precisa ver "vence em", "prazo")
      const dueLine = card.due
        ? `Data de entrega/prazo: ${fmtDate(card.due)}${card.dueComplete ? " (concluído)" : ""}`
        : "";
      const startLine = card.start ? `Data de início: ${fmtDate(card.start)}` : "";
      const modLine = card.dateLastActivity ? `Última modificação: ${fmtDate(card.dateLastActivity)}` : "";

      const content = [
        card.name,
        list ? `Lista: ${list}` : "",
        labels ? `Etiquetas: ${labels}` : "",
        dueLine,
        startLine,
        modLine,
        card.desc ? `\nDescrição:\n${card.desc}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      docs.push({
        source: "trello",
        external_id: card.id,
        board: boardName,
        title: card.name,
        content,
        last_modified: card.dateLastActivity || null,
        metadata: {
          list,
          list_pos: listPos,
          url: card.shortUrl,
          labels,
          due: card.due || null,
          start: card.start || null,
          due_complete: card.dueComplete || false,
          board_id: boardRef,
          id_list: card.idList,
        },
      });
    }
  }

  return docs;
}

/** Listas (colunas) de um board — { id, name } — pra resolver "mover pra lista X" por nome. */
export async function getBoardLists(boardId) {
  const lists = await tget(`/boards/${boardId}/lists`, { fields: "name" });
  return (lists || []).map((l) => ({ id: l.id, name: l.name }));
}

/**
 * Atualiza um card do Trello de verdade — usado pelas ações do Assistente (ver
 * src/lib/assistantActions.js), sempre depois de confirmação do usuário.
 * `due: null` remove o prazo; `due`/`dueComplete`/`idList` omitidos não são tocados.
 */
export async function updateTrelloCard(cardId, { due, idList, dueComplete } = {}) {
  if (!KEY || !TOKEN) throw new Error("TRELLO_KEY/TRELLO_TOKEN ausentes — não dá pra escrever no Trello.");
  const params = {};
  if (due !== undefined) params.due = due === null ? "" : due;
  if (dueComplete !== undefined) params.dueComplete = String(dueComplete);
  if (idList !== undefined) params.idList = idList;
  return twrite("PUT", `/cards/${cardId}`, params);
}
