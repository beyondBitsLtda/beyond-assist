import { supabase } from "./supabase.js";

// Modo Vigia: memória das observações reais do Modo Tela (ver db/schema.sql seção 24). Uma
// linha por comentário de verdade da vigília (não por ciclo) — quando "nada digno de nota",
// nada é salvo aqui.

/** Chamada pela vigília do Modo Tela (ver /api/screen-comment) quando "Transmissão" está
 * ligada e ela produziu um comentário de verdade — nunca lança pra não derrubar a vigília
 * por causa de um erro de persistência (só loga). */
export async function logScreenObservation(comment) {
  const { error } = await supabase.from("screen_observations").insert({ comment });
  if (error) console.error("logScreenObservation:", error.message);
}

/** Últimas N observações (mais recente por último, pra dar pro Gemini em ordem cronológica). */
export async function getRecentScreenObservations(limit = 30) {
  const { data, error } = await supabase
    .from("screen_observations")
    .select("id, comment, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getRecentScreenObservations: ${error.message}`);
  return (data || []).reverse();
}

/** Observações novas desde um `id` (exclusive) — usado pelo Modo Vigia proativo (narra sozinha
 * de tempos em tempos, de qualquer dispositivo) pra saber o que ainda não foi contado. */
export async function getNewScreenObservations(sinceId = 0) {
  const { data, error } = await supabase
    .from("screen_observations")
    .select("id, comment, created_at")
    .gt("id", sinceId)
    .order("id", { ascending: true })
    .limit(50);
  if (error) throw new Error(`getNewScreenObservations: ${error.message}`);
  return data || [];
}

/** Maior id existente agora — usado pra "marcar como lido" o histórico já existente assim que
 * o Modo Vigia proativo liga, sem narrar de uma vez tudo que já tinha acontecido antes. */
export async function getLatestScreenObservationId() {
  const { data, error } = await supabase
    .from("screen_observations")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestScreenObservationId: ${error.message}`);
  return data?.id || 0;
}
