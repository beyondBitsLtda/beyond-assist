import { supabase } from "@/lib/supabase.js";
import { jsonResponse } from "@/lib/http.js";
import { GEMINI_KEY_COUNT, GEMINI_MODELS } from "@/lib/gemini.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAYS_BACK = 14;

/**
 * GET /api/gemini-keys/usage
 *
 * Alimenta os gráficos do painel "🔑 CHAVES GEMINI" — consumo real (não só status de
 * cooldown), lendo de gemini_key_usage_daily (1 linha por dia×chave×modelo, incrementada em
 * TODA tentativa de chamada por src/lib/geminiKeyHealth.js — ver db/schema.sql).
 *
 * Devolve 3 vistas já agregadas em JS (dataset pequeno, não vale a pena 3 queries):
 *  - byKey:   total (sucesso+falha) por chave — pro gráfico de barras
 *  - byModel: total por modelo — pro gráfico de pizza
 *  - daily:   total por dia, últimos DAYS_BACK dias — pra curva
 */
export async function GET() {
  try {
    const sinceDay = new Date(Date.now() - DAYS_BACK * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("gemini_key_usage_daily")
      .select("day, key_index, model, success_count, fail_count")
      .gte("day", sinceDay)
      .order("day", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data || [];

    const byKeyMap = new Map(); // key_index -> {success, fail}
    const byModelMap = new Map(); // model -> {success, fail}
    const byDayMap = new Map(); // day -> {success, fail}
    for (const r of rows) {
      const total = { success: r.success_count || 0, fail: r.fail_count || 0 };
      for (const [map, k] of [[byKeyMap, r.key_index], [byModelMap, r.model], [byDayMap, r.day]]) {
        const cur = map.get(k) || { success: 0, fail: 0 };
        cur.success += total.success;
        cur.fail += total.fail;
        map.set(k, cur);
      }
    }

    const byKey = Array.from({ length: GEMINI_KEY_COUNT }, (_, i) => {
      const v = byKeyMap.get(i) || { success: 0, fail: 0 };
      return { keyIndex: i, success: v.success, fail: v.fail, total: v.success + v.fail };
    });
    const byModel = Object.entries(GEMINI_MODELS).map(([key, model]) => {
      const v = byModelMap.get(model) || { success: 0, fail: 0 };
      return { key, model, success: v.success, fail: v.fail, total: v.success + v.fail };
    });
    const daily = Array.from(byDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, success: v.success, fail: v.fail, total: v.success + v.fail }));

    return jsonResponse({ ok: true, byKey, byModel, daily });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
