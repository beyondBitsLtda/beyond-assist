import { createClient } from "@supabase/supabase-js";

// ⚠️ SERVER-ONLY. Usa a service_role (chave-mestra do banco).
// Nunca importe este arquivo em componente de cliente ('use client').

let _client = null;

function getClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas. " +
      "Defina em Vercel → Settings → Environment Variables (ou no .env local)."
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// Proxy: só cria o cliente quando alguém realmente usa (em runtime).
// Isso evita crash durante o `next build`, quando as env vars ainda não existem.
export const supabase = new Proxy({}, {
  get(_target, prop) {
    const client = getClient();
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
