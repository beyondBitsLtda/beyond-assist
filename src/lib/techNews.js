// Aba "Notícias & Clima" do Sentinela + assunto do Modo Rádio — feeds RSS de portais de
// tecnologia em português, parseados na mão (sem dependência nova) já que RSS 2.0 é simples e
// consistente o bastante entre esses portais (a maioria roda WordPress).

const FEEDS = [
  { url: "https://tecnoblog.net/feed/", source: "Tecnoblog" },
  { url: "https://canaltech.com.br/rss/", source: "Canaltech" },
];

const CACHE_MS = 30 * 60 * 1000; // notícia não muda a cada segundo — evita bater nos feeds toda hora
let _cache = null; // { at, items }

function extractTag(block, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
  if (!m) return null;
  const text = m[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(text);
  return (cdata ? cdata[1] : text).trim();
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

function parseRssItems(xml, source) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml))) {
    const block = m[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    if (title && link) items.push({ title: decodeEntities(title), link: link.trim(), pubDate: pubDate || null, source });
  }
  return items;
}

/** Últimas notícias de tecnologia (português), combinadas de vários portais e ordenadas por
 * data — nunca lança por um feed fora do ar (Promise.allSettled), só devolve menos itens. */
export async function getTechNews({ limit = 20 } = {}) {
  if (_cache && Date.now() - _cache.at < CACHE_MS) return _cache.items.slice(0, limit);

  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const res = await fetch(f.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; BeyondBitsBot/1.0)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      return parseRssItems(xml, f.source);
    })
  );

  const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  items.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

  _cache = { at: Date.now(), items };
  return items.slice(0, limit);
}
