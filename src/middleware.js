// O portão da Lisa: roda ANTES de qualquer página ou rota, e decide quem passa.
//
// Ele precisa ser rápido, porque roda em toda requisição. Por isso a conferência do token é
// local (assinatura conferida com Web Crypto, ver src/lib/authSession.js) e só há viagem de
// rede quando o token está perto de vencer — uma vez por hora, não uma vez por clique.

import { NextResponse } from "next/server";
import {
  COOKIE_SESSAO,
  COOKIE_RENOVA,
  conferirToken,
  ehApi,
  ehLivre,
  precisaRenovar,
} from "@/lib/authSession.js";

/**
 * O que o portão NÃO vê.
 *
 * Arquivos estáticos e imagens ficam de fora por desempenho: passar o editor Monaco inteiro
 * (15 MB) por uma checagem de assinatura a cada pedaço não protege nada e custa em tudo.
 * A regra de negócio — quais CAMINHOS são livres — mora em authSession.js, não aqui.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|monaco|mediapipe|models|preview.html).*)"],
};

function paraLogin(req, caminho) {
  const url = new URL("/login", req.url);
  if (caminho && caminho !== "/") url.searchParams.set("de", caminho);
  const resp = NextResponse.redirect(url);
  // Cookie inválido some junto: senão o navegador insiste em mandá-lo a cada tentativa, e o
  // log fica cheio de "assinatura não bate" que não são ataque, são lixo.
  resp.cookies.delete(COOKIE_SESSAO);
  return resp;
}

function negar(motivo) {
  return NextResponse.json(
    { ok: false, error: "não autenticado", motivo },
    { status: 401, headers: { "cache-control": "no-store" } }
  );
}

/** Troca o token vencido por um novo, usando o de renovação. Devolve os dois novos, ou null. */
async function renovar(tokenDeRenovacao) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon || !tokenDeRenovacao) return null;
  try {
    const r = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: anon, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: tokenDeRenovacao }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.access_token ? { acesso: j.access_token, renova: j.refresh_token } : null;
  } catch {
    return null;
  }
}

export async function middleware(req) {
  const caminho = req.nextUrl.pathname;
  if (ehLivre(caminho)) return NextResponse.next();

  const segredo = process.env.SUPABASE_JWT_SECRET;
  const token = req.cookies.get(COOKIE_SESSAO)?.value;

  const resultado = await conferirToken(token, segredo);

  if (resultado.ok && !precisaRenovar(resultado.payload)) {
    return NextResponse.next();
  }

  // Vencido (ou quase) e com token de renovação: troca por baixo dos panos e segue. O usuário
  // não percebe; sem isso ele seria expulso de hora em hora, no meio do que estivesse fazendo.
  const podeRenovar = resultado.ok || resultado.motivo === "expirado";
  if (podeRenovar) {
    const novo = await renovar(req.cookies.get(COOKIE_RENOVA)?.value);
    if (novo) {
      const resp = NextResponse.next();
      const opcoes = { httpOnly: true, secure: true, sameSite: "lax", path: "/" };
      resp.cookies.set(COOKIE_SESSAO, novo.acesso, { ...opcoes, maxAge: 60 * 60 * 24 });
      resp.cookies.set(COOKIE_RENOVA, novo.renova, { ...opcoes, maxAge: 60 * 60 * 24 * 30 });
      return resp;
    }
    // Renovação falhou: se o token ainda vale por alguns minutos, deixa passar em vez de
    // expulsar. Supabase fora do ar não pode virar "ninguém entra".
    if (resultado.ok) return NextResponse.next();
  }

  return ehApi(caminho) ? negar(resultado.motivo) : paraLogin(req, caminho);
}
