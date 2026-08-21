import { supabase } from "./supabase.js";

const USER_ID = (process.env.BRAIN_USER_ID || "").trim();

/**
 * Lista os "pensamentos registrados" (tabela `notes` do Beyond Brain) direto do banco,
 * sem passar pelo pipeline de ingestão/chunking (diferente de loadBrain, que é pra indexação).
 * Por isso o painel Pensamentos está sempre em dia, mesmo sem rodar SYNC.
 */
export async function listThoughts({ limit = 50, offset = 0 } = {}) {
  let query = supabase
    .from("notes")
    .select("id, subject, moment, body, ref, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (USER_ID) query = query.eq("user_id", USER_ID);

  const { data, error, count } = await query;
  if (error) throw new Error(`listThoughts: ${error.message}`);

  const thoughts = (data || []).map((n) => ({
    id: n.id,
    subject: n.subject || "(sem assunto)",
    moment: n.moment || null,
    body: n.body || "",
    ref: n.ref || null,
    created_at: n.created_at,
  }));

  const total = count ?? thoughts.length;
  const next_offset = offset + thoughts.length < total ? offset + thoughts.length : null;

  return { thoughts, count: total, next_offset };
}
