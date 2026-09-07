import { getTechNews } from "@/lib/techNews.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/news — últimas notícias de tecnologia (português), ver src/lib/techNews.js. */
export async function GET() {
  try {
    const items = await getTechNews({ limit: 20 });
    return jsonResponse({ ok: true, items });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
