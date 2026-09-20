import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { COOKIE_SESSAO, conferirChave, criarSessao } from "@/lib/abacatoAuth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/entrar   body: { email, chave }
 *
 * `chave`, e não `senha`: quem estica a senha é o navegador, e esta rota só compara o
 * resultado. O porquê inteiro está em src/lib/abacatoAuth.js — em resumo, esticar a senha aqui
 * estourava a CPU do Worker depois de três logins, e deixava qualquer pessoa de fora derrubar
 * o sistema mandando logins errados.
 *
 * Devolve a sessão num cookie httpOnly. `httpOnly` é o ponto: a sessão NUNCA fica visível para
 * JavaScript da página. Em localStorage ela seria entregue inteira a qualquer script injetado
 * — e este sistema vai carregar bibliotecas de gráfico de terceiros.
 */
export async function POST(req) {
  const segredo = process.env.ABACATO_SESSAO_SECRET;
  if (!segredo) return json({ ok: false, error: "ABACATO_SESSAO_SECRET não configurada no servidor" }, 500);

  let email, chave, senha;
  try {
    ({ email, chave, senha } = await req.json());
  } catch {
    return json({ ok: false, error: "pedido inválido" }, 400);
  }

  // Uma senha em texto puro só chega aqui de uma tela antiga, guardada em cache no navegador.
  // Recusar com uma instrução é melhor que um "senha incorreta" que manda a pessoa duvidar da
  // própria senha — e aceitar seria trazer de volta o custo de CPU que tirou o sistema do ar.
  if (senha && !chave) {
    return json({ ok: false, error: "esta página está desatualizada — recarregue com Ctrl+F5 e tente de novo" }, 400);
  }
  if (!email || !chave) return json({ ok: false, error: "informe e-mail e senha" }, 400);

  const { data: usuario } = await supabase
    .from("abacato_usuarios")
    .select("id, email, nome, senha_hash, senha_sal, senha_iter, ativo")
    .ilike("email", String(email).trim())
    .maybeSingle();

  // De propósito NÃO distinguimos "não existe" de "senha errada": a diferença diria a um
  // estranho quais e-mails têm conta aqui.
  //
  // A comparação é feita MESMO quando o usuário não existe, contra um selo descartável. O
  // motivo original era o tempo de resposta, e ele hoje é quase irrelevante — a comparação
  // virou um HMAC de microssegundos. Fica assim mesmo: custa nada, e o dia em que alguém
  // acrescentar trabalho a este caminho não vai ser o dia em que o vazamento reaparece.
  const guardada = usuario
    ? { hash: usuario.senha_hash, sal: usuario.senha_sal }
    : { hash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", sal: "AAAAAAAAAAAAAAAAAAAAAAA" };
  const confere = await conferirChave(chave, guardada);

  if (!usuario || !usuario.ativo || !confere) {
    return json({ ok: false, error: "e-mail ou senha incorretos" }, 401);
  }

  supabase.from("abacato_usuarios").update({ ultimo_login: new Date().toISOString() }).eq("id", usuario.id)
    .then(() => {}, () => {}); // registrar o login não pode atrasar nem derrubar a entrada

  const cookie = await criarSessao(usuario, segredo);
  return json({ ok: true, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } }, 200, {
    "set-cookie": `${COOKIE_SESSAO}=${cookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`,
  });
}
