import { supabase } from "@/lib/supabase.js";
import { jsonResponse } from "@/lib/http.js";
import { GEMINI_KEY_COUNT, GEMINI_MODELS } from "@/lib/gemini.js";
import { GROQ_KEY_COUNT, GROQ_MODELS } from "@/lib/groq.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/gemini-keys/status
 *
 * Alimenta o painel "🔑 CHAVES GEMINI" (src/app/(panels)/gemini-keys/page.js) — devolve
 * quantas chaves existem, quais modelos têm cota própria, e o cooldown atual de cada
 * (chave × modelo) que já falhou alguma vez (ver gemini_key_health, db/schema.sql).
 *
 * NUNCA devolve as chaves em si — só o ÍNDICE delas (posição na lista, 1-based no painel),
 * o suficiente pra saber "a #7 tá de cooldown", sem expor o segredo.
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("gemini_key_health")
      .select("key_index, model, cooldown_until, reason, last_error, updated_at");
    if (error) throw new Error(error.message);
    // `provedores` é a forma nova; `keyCount`/`models` continuam por compatibilidade com
    // qualquer aba aberta com a versão anterior do painel — trocar as duas coisas ao mesmo
    // tempo deixaria o painel em branco até a pessoa recarregar, sem dizer por quê.
    const provedores = [
      { id: "gemini", label: "GEMINI", keyCount: GEMINI_KEY_COUNT, models: GEMINI_MODELS },
      { id: "groq", label: "GROQ", keyCount: GROQ_KEY_COUNT, models: GROQ_MODELS },
    ].filter((p) => p.keyCount > 0);

    return jsonResponse({
      ok: true,
      keyCount: GEMINI_KEY_COUNT,
      models: GEMINI_MODELS,
      provedores,
      health: data || [],
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
