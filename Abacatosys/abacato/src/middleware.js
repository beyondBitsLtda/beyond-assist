import { NextResponse } from "next/server";
import { COOKIE_SESSAO, COOKIE_VISUAL, lerSessao, ehApi, ehLivre, ehDocumentos } from "@/lib/abacatoAuth.js";
import { PLANOS, RECADOS } from "@/dominio/planos.js";
import { ehLisaTask } from "@/dominio/entradaDaLisa.js";

/**
 * O portão do Abacato. Roda antes de qualquer página ou rota.
 *
 * A conferência é LOCAL — assinatura com WebCrypto, sem ida ao banco. Perguntar ao Postgres a
 * cada clique custaria uma viagem até o iMac em toda navegação.
 *
 * `marca/` fica de fora porque é a logo da tela de abertura: ela aparece ANTES do login, e o
 * portão barrá-la trocaria a imagem pelo HTML da tela de entrar — a abertura sairia sem marca.
 * Os ícones do app instalável também moram em `marca/`.
 *
 * `manifest.webmanifest` fica de fora porque o navegador o busca SEM cookie: barrado, ele
 * viraria o HTML da tela de entrar e o Chrome nunca ofereceria "Instalar app".
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|marca/|manifest.webmanifest).*)"],
};

export async function middleware(req) {
  const caminho = req.nextUrl.pathname;
  if (ehLivre(caminho)) return visualPedido(req, NextResponse.next());

  const sessao = await lerSessao(
    req.cookies.get(COOKIE_SESSAO)?.value,
    process.env.ABACATO_SESSAO_SECRET
  );
  if (sessao.ok) {
    // O plano sai do tipo gravado na sessão. Sessão de antes do tipo existir não é barrada
    // aqui — o `exigir` de src/lib/acesso.js confere no banco de qualquer jeito.
    const plano = PLANOS[sessao.usuario.tipo];
    if (plano && !plano.documentos && ehDocumentos(caminho)) {
      if (ehApi(caminho)) {
        return NextResponse.json(
          { ok: false, error: RECADOS.semDocumentos },
          { status: 403, headers: { "cache-control": "no-store" } }
        );
      }
      return comVisual(req, NextResponse.redirect(new URL("/quadros", req.url)), plano.visual);
    }
    return comVisual(req, NextResponse.next(), plano?.visual);
  }

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
  return visualPedido(req, resposta);
}

/**
 * O visual da tela é só aparência: um cookie que o script do <head> lê antes de pintar (ver
 * src/app/layout.js). Com sessão, quem decide é o tipo da conta — a Lisa Task sai com a cara da
 * Lisa. Grava só quando muda, para não mandar cookie a cada pedido.
 */
function comVisual(req, resposta, visual) {
  const atual = req.cookies.get(COOKIE_VISUAL)?.value;
  if ((visual || undefined) === atual) return resposta;
  if (visual) {
    resposta.cookies.set(COOKIE_VISUAL, visual, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: true });
  } else {
    resposta.cookies.delete(COOKIE_VISUAL);
  }
  return resposta;
}

/** Sem sessão ainda, quem decide é o endereço (lisatask.beyond.dev.br é a Lisa Task) ou o
 *  `?visual=` do link: assim até a tela de entrar já sai como Lisa Task. Sem nenhum dos dois,
 *  fica o que estava. */
function visualPedido(req, resposta) {
  const pedido = req.nextUrl.searchParams.get("visual");
  if (pedido === "abacato") return comVisual(req, resposta, null);
  if (pedido === "lisa" || ehLisaTask(req.headers.get("host"))) return comVisual(req, resposta, "lisa");
  return resposta;
}
