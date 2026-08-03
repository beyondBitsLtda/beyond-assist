const KEY = process.env.TRELLO_KEY;
const TOKEN = process.env.TRELLO_TOKEN;
const BOARD_IDS = (process.env.TRELLO_BOARD_IDS || "")
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

/**
 * Carrega todos os cards abertos dos boards configurados.
 * Aceita tanto o id completo (24 hex) quanto o short link da URL.
 * Retorna documentos prontos para indexar.
 */
export async function loadTrello() {
  if (!KEY || !TOKEN) {
    console.warn("[trello] TRELLO_KEY/TRELLO_TOKEN ausentes — pulando Trello.");
    return [];
  }
  if (!BOARD_IDS.length) {
    console.warn("[trello] TRELLO_BOARD_IDS vazio — pulando Trello.");
    return [];
  }

  const docs = [];

  for (const boardRef of BOARD_IDS) {
    try {
      const board = await tget(`/boards/${boardRef}`, { fields: "name" });
      const boardName = board?.name || boardRef;

      // mapa idList → nome da lista
      const lists = await tget(`/boards/${boardRef}/lists`, { fields: "name" });
      const listName = Object.fromEntries((lists || []).map((l) => [l.id, l.name]));

      const cards = await tget(`/boards/${boardRef}/cards`, {
        fields: "name,desc,dateLastActivity,idList,shortUrl,labels",
        filter: "open",
      });

      for (const card of cards || []) {
        const list = listName[card.idList] || "";
        const labels = (card.labels || []).map((l) => l.name).filter(Boolean).join(", ");
        const content = [
          card.name,
          list ? `Lista: ${list}` : "",
          labels ? `Etiquetas: ${labels}` : "",
          card.desc ? `\n${card.desc}` : "",
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
          metadata: { list, url: card.shortUrl, labels },
        });
      }

      console.log(`[trello] "${boardName}": ${(cards || []).length} cards`);
    } catch (err) {
      console.error(`[trello] falha no board ${boardRef}: ${err.message}`);
    }
  }

  return docs;
}
