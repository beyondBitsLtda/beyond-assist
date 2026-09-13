import { getTechNews } from "@/lib/techNews.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/news?category=ia — últimas notícias de tecnologia (português), ver src/lib/techNews.js.
 * `category` é opcional — omitido, traz todas misturadas. */
export async function GET(req) {
  try {
    const category = new URL(req.url).searchParams.get("category") || null;
    const items = await getTechNews({ limit: 30, category });
    return jsonResponse({ ok: true, items });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
