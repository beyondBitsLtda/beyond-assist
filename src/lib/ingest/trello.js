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

  const docs = [];

  for (const boardRef of boardIds) {
    try {
      const board = await tget(`/boards/${boardRef}`, { fields: "name" });
      const boardName = board?.name || boardRef;

      // mapa idList → { name, pos } — pos é a ordem real das colunas no board (pro Kanban)
      const lists = await tget(`/boards/${boardRef}/lists`, { fields: "name,pos" });
      const listMeta = Object.fromEntries((lists || []).map((l) => [l.id, { name: l.name, pos: l.pos }]));

      const cards = await tget(`/boards/${boardRef}/cards`, {
        fields: "name,desc,dateLastActivity,idList,shortUrl,labels,due,start,dueComplete",
        filter: "open",
      });

      for (const card of cards || []) {
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
          },
        });
      }

      console.log(`[trello] "${boardName}": ${(cards || []).length} cards`);
    } catch (err) {
      console.error(`[trello] falha no board ${boardRef}: ${err.message}`);
    }
  }

  return docs;
}
