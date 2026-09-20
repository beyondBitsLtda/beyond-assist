import { NextResponse } from "next/server";
import { COOKIE_SESSAO, lerSessao, ehApi, ehLivre } from "@/lib/abacatoAuth.js";

/**
 * O portão do Abacato. Roda antes de qualquer página ou rota.
 *
 * A conferência é LOCAL — assinatura com WebCrypto, sem ida ao banco. Perguntar ao Postgres a
 * cada clique custaria uma viagem até o iMac em toda navegação.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};

export async function middleware(req) {
  const caminho = req.nextUrl.pathname;
  if (ehLivre(caminho)) return NextResponse.next();

  const sessao = await lerSessao(
    req.cookies.get(COOKIE_SESSAO)?.value,
    process.env.ABACATO_SESSAO_SECRET
  );
  if (sessao.ok) return NextResponse.next();

  // API recebe 401; página recebe redirecionamento. A diferença importa: um fetch que segue
  // redirecionamento receberia o HTML do login como se fosse dado, e o erro apareceria bem
  // longe da causa.
  if (ehApi(caminho)) {
    return NextResponse.json(
      { ok: false, error: sessao.motivo },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  const url = new URL("/entrar", req.url);
  if (caminho && caminho !== "/") url.searchParams.set("de", caminho);
  const resposta = NextResponse.redirect(url);
  // Cookie inválido some junto, senão o navegador insiste em mandá-lo a cada tentativa e o log
  // enche de "assinatura não bate" que não são ataque, são lixo.
  resposta.cookies.delete(COOKIE_SESSAO);
  return resposta;
}
