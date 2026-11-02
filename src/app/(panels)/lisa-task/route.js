// A entrada na Lisa Task (01/11/2026). A Lisa Task é o Abacato com o visual da Lisa e sem a parte
// de documentos; e "o usuário cadastrado na Lisa deve ser o mesmo que vai acessar o Lisa Task".
//
// Por isso esta rota não só leva até lá: ela posta a sessão da pessoa (o token do Supabase Auth,
// num formulário — fora da URL, do histórico e dos logs) para /api/auth/lisa do Abacato, que
// confirma no próprio Supabase quem é e entra com a conta do mesmo e-mail (criada como Lisa Task no
// primeiro acesso; ver Abacatosys/abacato/src/dominio/entradaDaLisa.js). O menu abre em outra aba.
//
// O endereço é lisatask.beyond.dev.br (02/11/2026): o mesmo Abacato, mas quem usa a Lisa não vê
// "abacato" na barra. Variável própria, e não ABACATO_URL, porque essa aponta o Abacato de
// verdade para as notas e o RAG do admin (src/lib/notas.js, src/lib/ingest/abacato.js).

import { COOKIE_SESSAO, conferirToken, precisaRenovar } from "@/lib/authSession.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LISA_TASK = () => (process.env.LISA_TASK_URL || "https://lisatask.beyond.dev.br").replace(/\/+$/, "");

/** GET /lisa-task → a página que entra no Abacato com a conta da Lisa. */
export async function GET(req) {
  const url = new URL(req.url);
  const token = req.cookies.get(COOKIE_SESSAO)?.value;
  const sessao = await conferirToken(token, process.env.SUPABASE_JWT_SECRET);

  // O portão renova a sessão perto de vencer, mas este pedido ainda traz o token velho: uma volta
  // a mais pega o novo. Só uma — se ainda assim não valer, é caso de entrar de novo na Lisa.
  if ((!sessao.ok || precisaRenovar(sessao.payload)) && !url.searchParams.has("de-novo")) {
    url.searchParams.set("de-novo", "1");
    return Response.redirect(url, 303);
  }
  if (!sessao.ok) return Response.redirect(new URL("/login?de=%2Flisa-task", url), 303);

  return new Response(paginaDeEntrada(token), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // a página carrega o token: nada de cache, nem de ser aberta dentro de outro site
      "cache-control": "no-store",
      "x-frame-options": "DENY",
    },
  });
}

const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function paginaDeEntrada(token) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lisa Task</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:#000;color:#e7edf7;font:500 16px Barlow,Inter,system-ui,sans-serif}button{padding:10px 18px;border:0;border-radius:999px;background:#5aa9ff;color:#06140c;font:inherit;font-weight:600;cursor:pointer}</style>
</head><body>
<form method="post" action="${escapar(LISA_TASK())}/api/auth/lisa">
<p>Abrindo a Lisa Task…</p>
<input type="hidden" name="token" value="${escapar(token)}">
<noscript><button type="submit">Abrir a Lisa Task</button></noscript>
</form>
<script>document.forms[0].submit();</script>
</body></html>`;
}
