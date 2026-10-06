import { NextResponse } from "next/server";
import { COOKIE_SESSAO, lerSessao, ehApi, ehLivre } from "@/lib/auth.js";

/**
 * O portão da Lisa_Proof. Roda antes de qualquer página ou rota (mesmo desenho do Abacato).
 *
 * A conferência é LOCAL — assinatura com WebCrypto, sem ida ao banco: perguntar ao Postgres do
 * iMac a cada clique custaria uma viagem de ida e volta até a casa em toda navegação.
 */
// Fora do portão: arquivos que o navegador busca sem sessão. O service worker e o manifesto em
// especial — barrá-los trocaria o arquivo pelo HTML do login, e os lembretes e a instalação como
// app quebrariam sem nenhum erro visível.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icone.svg|icone-192.png|icone-512.png|icone-apple.png|sw.js|manifest.webmanifest).*)"],
};

export async function middleware(req) {
  const caminho = req.nextUrl.pathname;
  if (ehLivre(caminho)) return NextResponse.next();

  const sessao = await lerSessao(req.cookies.get(COOKIE_SESSAO)?.value, process.env.PROOF_SESSAO_SECRET);
  if (sessao.ok) return NextResponse.next();

  // API recebe 401; página recebe redirecionamento. Um fetch que segue redirecionamento
  // receberia o HTML do login como se fosse dado.
  if (ehApi(caminho)) {
    return NextResponse.json({ ok: false, error: sessao.motivo }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const url = new URL("/entrar", req.url);
  if (caminho && caminho !== "/") url.searchParams.set("de", caminho);
  const resposta = NextResponse.redirect(url);
  resposta.cookies.delete(COOKIE_SESSAO);
  return resposta;
}
