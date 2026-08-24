import { supabase } from "@/lib/supabase.js";
import { sentinelSupabase } from "@/lib/sentinelSupabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health → { supabase, trello, gemini, sentinel } (true = ok) */
export async function GET() {
  const status = { supabase: false, trello: false, gemini: false, sentinel: false };

  // Supabase (Beyond Brain): conta linhas em documents
  try {
    const { error } = await supabase.from("documents").select("id", { count: "exact", head: true });
    status.supabase = !error;
  } catch {}

  // Sentinela: projeto Supabase separado — conta linhas em support_tickets
  try {
    if (process.env.SENTINEL_SUPABASE_URL && process.env.SENTINEL_SUPABASE_SECRET_KEY) {
      const { error } = await sentinelSupabase.from("support_tickets").select("id", { count: "exact", head: true });
      status.sentinel = !error;
    }
  } catch {}

  // Trello: valida key+token
  try {
    const KEY = process.env.TRELLO_KEY;
    const TOKEN = process.env.TRELLO_TOKEN;
    if (KEY && TOKEN) {
      const r = await fetch(`https://api.trello.com/1/members/me?fields=id&key=${KEY}&token=${TOKEN}`);
      status.trello = r.ok;
    }
  } catch {}

  // Gemini: só checa se a chave está presente (evita gastar cota num ping)
  status.gemini = Boolean(process.env.GEMINI_API_KEY);

  return new Response(JSON.stringify(status), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
