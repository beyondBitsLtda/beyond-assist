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
    if (process.env.SUBABASE_TESTE_URL && process.env.SERVICE_KEY_TESTE) {
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

  // Gemini: só checa se a chave está presente (evita gastar cota num ping).
  //
  // Aceita as DUAS variáveis, na mesma ordem que o src/lib/gemini.js usa de verdade. Checar só a
  // singular acendia a luz laranja em quem configurou o pool (GEMINI_API_KEYS) — ou seja, o
  // indicador dizia que o Gemini estava fora enquanto ele respondia normalmente.
  status.gemini = Boolean(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY);

  return new Response(JSON.stringify(status), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
