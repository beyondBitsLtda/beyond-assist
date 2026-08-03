import { createClient } from "@supabase/supabase-js";

// ⚠️ SERVER-ONLY. Usa a service_role (chave-mestra do banco).
// Nunca importe este arquivo em componente de cliente ('use client').
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn("[supabase] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no .env");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
