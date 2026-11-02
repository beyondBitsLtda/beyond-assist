import { supabase } from "@/lib/supabase.js";
import { COOKIE_SESSAO, criarSessao, guardarChave } from "@/lib/abacatoAuth.js";
import { anotar, TIPOS_DE_EVENTO } from "@/lib/eventos.js";
import { decidirEntrada, origensDaLisa, origemPermitida, nomeDaPessoa } from "@/dominio/entradaDaLisa.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPOS = "id, email, nome, tipo, ativo, aprovado";

/**
 * POST /api/auth/lisa   formulário: { token }
 *
 * A entrada na Lisa Task com a conta da Lisa (a regra inteira está em src/dominio/entradaDaLisa.js).
 * Quem chama é a página /lisa-task da Lisa, que posta o token do Supabase Auth da pessoa — num
 * formulário, e não na URL, para ele não ficar em histórico nem em log.
 *
 * O token não é conferido aqui com segredo nenhum: quem diz se ele vale é o próprio Supabase Auth
 * (/auth/v1/user), o mesmo banco da Lisa. Depois disso ele é descartado — o que fica é a sessão
 * do Abacato, igual à de quem entra com senha.
 */
export async function POST(req) {
  const segredo = process.env.ABACATO_SESSAO_SECRET;
  if (!segredo) return aviso(500, "ABACATO_SESSAO_SECRET não configurada no servidor.");

  if (!origemPermitida(req.headers.get("origin"), origensDaLisa(process.env.LISA_ORIGEM))) {
    return aviso(403, "Esta entrada só vale a partir da Lisa. Abra a Lisa Task pelo menu da Lisa.");
  }

  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") || "");
  const pessoa = token ? await pessoaDaLisa(token) : null;
  if (!pessoa) {
    return aviso(401, "Não consegui confirmar a sua sessão da Lisa. Volte à Lisa, entre de novo e abra a Lisa Task.");
  }

  let { data: conta } = await supabase
    .from("abacato_usuarios").select(CAMPOS).ilike("email", pessoa.email).maybeSingle();

  const decisao = decidirEntrada(conta);
  // Conta interna ou de cliente com o mesmo e-mail: segue pela porta de sempre. Com sessão do
  // Abacato aberta, entra; sem ela, o middleware leva à tela de entrar.
  if (decisao === "senha") return irPara("/quadros");
  if (decisao === "desativada") {
    return aviso(403, "A sua conta da Lisa Task está desativada. Fale com quem administra a Lisa.");
  }
  if (decisao === "criar") {
    conta = await criarConta(pessoa);
    if (!conta) return aviso(500, "Não consegui criar a sua conta da Lisa Task. Tente de novo em instantes.");
  }

  supabase.from("abacato_usuarios").update({ ultimo_login: new Date().toISOString() }).eq("id", conta.id)
    .then(() => {}, () => {}); // registrar o login não pode atrasar nem derrubar a entrada
  anotar({ usuarioId: conta.id, tipo: TIPOS_DE_EVENTO.entrou, alvo: conta.email, detalhe: { pela: "lisa" } });

  const cookie = await criarSessao(conta, segredo);
  return irPara("/quadros", `${COOKIE_SESSAO}=${cookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`);
}

/** Quem é o dono do token, segundo o Supabase Auth. null se o token não vale (vencido, de outro
 *  banco, de conta apagada) ou se o Auth não respondeu. */
async function pessoaDaLisa(token) {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !chave) return null;
  const r = await fetch(`${base}/auth/v1/user`, {
    // `apikey` é só a passagem pelo gateway; quem identifica a pessoa é o token dela.
    headers: { apikey: chave, authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!r?.ok) return null;
  const u = await r.json().catch(() => null);
  if (!u?.id || !u?.email) return null;
  return { id: u.id, email: String(u.email).trim().toLowerCase(), metadados: u.user_metadata };
}

/** A conta Lisa Task nova. A senha do Abacato é sorteada e jogada fora: a pessoa entra pela Lisa.
 *  Se um dia precisar entrar direto, quem administra dá uma em Pessoas → Nova senha. */
async function criarConta(pessoa) {
  const guardada = await guardarChave(crypto.randomUUID() + crypto.randomUUID());
  const { data, error } = await supabase.from("abacato_usuarios").insert({
    email: pessoa.email,
    nome: nomeDaPessoa(pessoa),
    senha_hash: guardada.hash,
    senha_sal: guardada.sal,
    senha_iter: guardada.iteracoes,
    tipo: "lisatask",
    aprovado: true,
    ativo: true,
    admin: false,
    lisa: false,
  }).select(CAMPOS).single();

  if (!error) {
    anotar({
      usuarioId: data.id, tipo: TIPOS_DE_EVENTO.criouConta, alvo: data.email, alvoId: data.id,
      detalhe: { tipo: "lisatask", pela: "lisa" },
    });
    return data;
  }
  // Duas abas abrindo ao mesmo tempo: a outra criou primeiro (o e-mail é único). Vale a dela.
  const { data: outra } = await supabase
    .from("abacato_usuarios").select(CAMPOS).ilike("email", pessoa.email).maybeSingle();
  return decidirEntrada(outra) === "entrar" ? outra : null;
}

function irPara(caminho, cookie) {
  const headers = { location: caminho, "cache-control": "no-store" };
  if (cookie) headers["set-cookie"] = cookie;
  return new Response(null, { status: 303, headers });
}

const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** O recado de quando não deu, no visual da Lisa Task (é de lá que a pessoa veio). */
function aviso(status, texto) {
  const lisa = origensDaLisa(process.env.LISA_ORIGEM)[0];
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lisa Task</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:#000;color:#e7edf7;font:500 16px Barlow,Inter,system-ui,sans-serif}main{max-width:420px}h1{font-size:22px}a{color:#5aa9ff}</style>
</head><body><main><h1>Lisa Task</h1><p>${escapar(texto)}</p><p><a href="${escapar(lisa)}/assistant">Voltar para a Lisa</a></p></main></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
