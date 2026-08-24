import { createClient } from "@supabase/supabase-js";

// ⚠️ SERVER-ONLY. Projeto Supabase da plataforma de testes (Sentinela) — SEPARADO do
// Supabase do Beyond Brain. Nunca importe este arquivo em componente de cliente ('use client')
// nem misture com o client de src/lib/supabase.js — são dois projetos diferentes.

let _client = null;

function getClient() {
  if (_client) return _client;
  const url = process.env.SENTINEL_SUPABASE_URL;
  const key = process.env.SENTINEL_SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "SENTINEL_SUPABASE_URL ou SENTINEL_SUPABASE_SECRET_KEY não configuradas. " +
      "Defina em Vercel → Settings → Environment Variables (ou no .env local)."
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// Proxy: só cria o cliente quando alguém realmente usa (em runtime).
// Evita crash durante o `next build`, quando as env vars ainda não existem.
export const sentinelSupabase = new Proxy({}, {
  get(_target, prop) {
    const client = getClient();
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
