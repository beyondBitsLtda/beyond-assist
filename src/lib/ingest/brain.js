import { supabase } from "../supabase.js";

const USER_ID = (process.env.BRAIN_USER_ID || "").trim();

/**
 * Lê as notas do Beyond Brain (tabela `notes` do mesmo projeto Supabase).
 * Colunas: id, user_id, subject, moment, body, ref, created_at.
 * Retorna documentos prontos para indexar.
 */
export async function loadBrain() {
  let query = supabase
    .from("notes")
    .select("id, user_id, subject, moment, body, ref, created_at")
    .order("created_at", { ascending: false });

  if (USER_ID) query = query.eq("user_id", USER_ID);

  const { data, error } = await query;
  if (error) {
    console.error(`[brain] falha ao ler notes: ${error.message}`);
    return [];
  }

  const docs = (data || []).map((n) => {
    const content = [n.subject, n.moment, n.body].filter(Boolean).join("\n");
    return {
      source: "brain",
      external_id: String(n.id),
      board: n.ref || "nota",
      title: n.subject || "(sem assunto)",
      content,
      last_modified: n.created_at || null,
      metadata: { ref: n.ref || null, moment: n.moment || null, user_id: n.user_id },
    };
  });

  console.log(`[brain] ${docs.length} notas lidas`);
  return docs;
}
