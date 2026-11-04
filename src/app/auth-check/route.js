// A pergunta "essa pessoa está logada?", em forma de rota.
//
// Quem pergunta é o Caddy, antes de servir a tela do iMac em /tela/* — ver
// servidor/montar-https-casa.sh. Aquele endereço não passa pelo Next, então o portão do
// middleware não o alcança; o Caddy o alcança, e usa isto como portão emprestado.
//
// O corpo é vazio de propósito: a resposta inteira é o código HTTP. Se a requisição chegou
// até aqui, o middleware já conferiu a assinatura do cookie e deixou passar — 204. Se não
// tinha sessão, o middleware respondeu 302 para /login e este arquivo nunca rodou.
//
// Por que NÃO fica em /api/: rotas sob /api/ recebem 401 em JSON quando não há sessão, e o
// Caddy copia essa resposta para o navegador — a pessoa veria `{"ok":false}` em vez da tela
// de login. Fora de /api/, o middleware devolve redirecionamento, que é o comportamento certo
// para alguém abrindo um endereço no navegador.

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
