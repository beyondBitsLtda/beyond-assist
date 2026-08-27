import { supabase } from "@/lib/supabase.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sync-status — só leitura, sem segredo (não dispara nada, não expõe nada sensível).
 * Reflete o progresso do SYNC AUTOMÁTICO (pg_cron do Supabase — ver src/app/api/cron/sync/route.js
 * e db/cron.sql), não do botão SYNC manual (que não grava em sync_progress).
 */
export async function GET() {
  try {
    const { data, error } = await supabase.from("sync_progress").select("*").eq("id", 1).single();
    if (error) throw new Error(error.message);
    return jsonResponse({ ok: true, ...data });
  } catch (err) {
    // tabela pode não existir ainda (db/schema.sql não rodado) — não é um erro fatal pro HUD
    return jsonResponse({ ok: false, error: String(err?.message || err) });
  }
}
