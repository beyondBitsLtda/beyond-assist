import { createClient } from "@supabase/supabase-js";

// ⚠️ SERVER-ONLY. Projeto Supabase da plataforma de testes (Sentinela) — SEPARADO do
// Supabase do Beyond Brain. Nunca importe este arquivo em componente de cliente ('use client')
// nem misture com o client de src/lib/supabase.js — são dois projetos diferentes.

let _client = null;

function getClient() {
  if (_client) return _client;
  // nomes exatamente como o usuário criou na Vercel (projeto Sentinela é separado do
  // Beyond Brain, gerenciado com seu próprio conjunto de variáveis — "SUBABASE" é typo
  // dele, mantido de propósito pra bater com o que já está configurado lá).
  const url = process.env.SUBABASE_TESTE_URL;
  const key = process.env.SERVICE_KEY_TESTE;
  if (!url || !key) {
    throw new Error(
      "SUBABASE_TESTE_URL ou SERVICE_KEY_TESTE não configuradas. " +
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
