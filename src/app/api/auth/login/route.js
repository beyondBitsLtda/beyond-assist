import { COOKIE_SESSAO, COOKIE_RENOVA } from "@/lib/authSession.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login   body: { email, senha }
 *
 * Troca e-mail e senha pelo token do Supabase Auth e guarda a sessão em cookies `httpOnly`.
 *
 * `httpOnly` é o ponto: o token NUNCA fica visível para JavaScript da página. Guardá-lo em
 * localStorage seria mais simples e entregaria a sessão inteira a qualquer script injetado —
 * e esta aplicação carrega editor, mapas e bibliotecas de terceiros.
 *
 * A senha não passa por aqui em texto para lugar nenhum além do próprio Supabase, e nada dela
 * é registrado em log.
 */
export async function POST(req) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return json({ ok: false, error: "login não configurado neste deploy (falta SUPABASE_ANON_KEY)" }, 500);
  }

  let email, senha;
  try {
    ({ email, senha } = await req.json());
  } catch {
    return json({ ok: false, error: "pedido inválido" }, 400);
  }
  if (!email || !senha) return json({ ok: false, error: "informe e-mail e senha" }, 400);

  let resposta;
  try {
    resposta = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anon, "content-type": "application/json" },
      body: JSON.stringify({ email, password: senha }),
    });
  } catch {
    // O banco mora numa casa: internet caída lá derruba o login. Dizer isso é melhor que
    // deixar a pessoa achando que digitou a senha errada.
    return json({ ok: false, error: "o servidor de autenticação não respondeu" }, 503);
  }

  if (!resposta.ok) {
    // De propósito NÃO diferenciamos "e-mail não existe" de "senha errada": a diferença diria
    // a um estranho quais endereços existem aqui.
    return json({ ok: false, error: "e-mail ou senha incorretos" }, 401);
  }

  const dados = await resposta.json().catch(() => null);
  if (!dados?.access_token) return json({ ok: false, error: "resposta inesperada do autenticador" }, 502);

  const base = "HttpOnly; Secure; SameSite=Lax; Path=/";
  const cabecalhos = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  cabecalhos.append("set-cookie", `${COOKIE_SESSAO}=${dados.access_token}; ${base}; Max-Age=${60 * 60 * 24}`);
  cabecalhos.append("set-cookie", `${COOKIE_RENOVA}=${dados.refresh_token || ""}; ${base}; Max-Age=${60 * 60 * 24 * 30}`);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cabecalhos });
}

function json(corpo, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
