import { createClient } from "@supabase/supabase-js";

// SÓ SERVIDOR. Usa a chave de serviço, que é a chave-mestra do banco — nunca importe este
// arquivo num componente marcado com "use client".
//
// Mesmo Postgres da Lisa, tabelas com prefixo `abacato_`. A chave de serviço ignora RLS de
// propósito: quem decide o que cada pessoa pode ver é o domínio (src/dominio/Quadro.js), num
// lugar só e testado. Duas camadas de permissão que precisam concordar é como uma delas acaba
// errada sem ninguém notar.

let cliente = null;

function obterCliente() {
  if (cliente) return cliente;
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas no servidor do Abacato.");
  }
  cliente = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente;
}

/**
 * Proxy, e não o cliente direto.
 *
 * O `createClient` levanta na hora se a URL vier vazia, e durante o `next build` as variáveis
 * de ambiente ainda não existem — o build inteiro morria com "supabaseUrl is required" ao só
 * IMPORTAR este arquivo, sem nenhuma consulta ter sido feita.
 *
 * Com o proxy, o cliente nasce na primeira vez que alguém realmente o usa, que é sempre em
 * tempo de execução. Mesma solução que a Lisa já usa, pelo mesmo motivo.
 */
export const supabase = new Proxy({}, {
  get(_alvo, prop) {
    const c = obterCliente();
    const valor = c[prop];
    return typeof valor === "function" ? valor.bind(c) : valor;
  },
});

/** Dá para falar com o banco? Serve à rota de saúde, que precisa distinguir "configuração
 *  faltando" de "banco fora do ar" — os dois pedem conserto em lugares diferentes. */
export const temBanco = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
