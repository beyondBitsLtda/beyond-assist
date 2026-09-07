// Página "Notícias & Clima" + assunto do Modo Rádio — feeds RSS de portais em português,
// parseados na mão (sem dependência nova) já que RSS 2.0 é simples e consistente o bastante
// entre esses portais (a maioria roda WordPress). Cada feed já vem marcado com sua categoria —
// ver NEWS_CATEGORIES pro filtro da tela.
//
// "Game Dev" (desenvolvimento de jogos) foi pedido mas não achei uma fonte dedicada em
// português que funcionasse (tentei GameDev Brasil e outras, todas bloqueadas/fora do ar) —
// por ora esse conteúdo cai dentro de "Games" mesmo (Canaltech Games/Adrenaline às vezes
// cobrem o lado da indústria/desenvolvimento também). Se o usuário souber uma fonte real, dá
// pra adicionar depois.
const FEEDS = [
  { url: "https://tecnoblog.net/feed/", source: "Tecnoblog", category: "geral" },
  { url: "https://canaltech.com.br/rss/", source: "Canaltech", category: "geral" },
  { url: "https://olhardigital.com.br/feed/", source: "Olhar Digital", category: "geral" },
  { url: "https://canaltech.com.br/rss/inteligencia-artificial/", source: "Canaltech IA", category: "ia" },
  { url: "https://www.tabnews.com.br/recentes/rss", source: "TabNews", category: "dev" },
  { url: "https://canaltech.com.br/rss/games/", source: "Canaltech Games", category: "game" },
  { url: "https://www.adrenaline.com.br/feed/", source: "Adrenaline", category: "game" },
  { url: "https://startupi.com.br/feed/", source: "Startupi", category: "empresarial" },
  { url: "https://canaltech.com.br/rss/carreira/", source: "Canaltech Carreira", category: "mercado-ti" },
];

export const NEWS_CATEGORIES = [
  { key: "geral", label: "Geral" },
  { key: "ia", label: "IA" },
  { key: "dev", label: "Dev" },
  { key: "game", label: "Games" },
  { key: "empresarial", label: "Empresarial" },
  { key: "mercado-ti", label: "Mercado de TI" },
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
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseRssItems(xml, source, category) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml))) {
    const block = m[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    if (title && link) items.push({ title: decodeEntities(title), link: link.trim(), pubDate: pubDate || null, source, category });
  }
  return items;
}

/** Últimas notícias (combinadas de todos os feeds, ordenadas por data) — `category` (opcional)
 * filtra só uma das NEWS_CATEGORIES. Nunca lança por um feed fora do ar (Promise.allSettled),
 * só devolve menos itens. */
export async function getTechNews({ limit = 30, category = null } = {}) {
  if (!_cache || Date.now() - _cache.at >= CACHE_MS) {
    const results = await Promise.allSettled(
      FEEDS.map(async (f) => {
        const res = await fetch(f.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; BeyondBitsBot/1.0)" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        return parseRssItems(xml, f.source, f.category);
      })
    );
    const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    items.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
    _cache = { at: Date.now(), items };
  }

  const filtered = category ? _cache.items.filter((i) => i.category === category) : _cache.items;
  return filtered.slice(0, limit);
}
