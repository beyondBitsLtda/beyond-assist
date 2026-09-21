import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { quemEh, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { exigirAdmin } from "@/lib/admin.js";
import { emailValido } from "@/dominio/papeis.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/usuarios — as pessoas do Abacato.
 *
 * Aberto a QUALQUER pessoa com sessão, e não só a administradores. É o que permite convidar
 * alguém para um quadro: para escolher uma pessoa na lista, é preciso ver a lista.
 *
 * Só sai o mínimo — nome, e-mail e se está ativa. O hash da senha, o sal e o número de
 * iterações ficam de fora mesmo de uma resposta que exige login: essa é a informação com que
 * se ataca uma senha offline, e ela não precisa sair do banco nunca.
 *
 * `?tudo=1` acrescenta o que só interessa a quem administra: quem é administrador, quando a
 * conta foi criada e o último login. Essa parte exige ser administrador.
 */
export async function GET(req) {
  try {
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");

    const querTudo = new URL(req.url).searchParams.get("tudo") === "1";
    if (querTudo) await exigirAdmin(req);

    const campos = querTudo
      ? "id, nome, email, ativo, admin, lisa, criado_em, ultimo_login"
      : "id, nome, email, ativo";

    const { data, error } = await supabase
      .from("abacato_usuarios").select(campos).order("nome");
    if (error) throw new ErroDeAcesso(500, error.message);

    const { data: eu } = await supabase
      .from("abacato_usuarios").select("admin").eq("id", usuario.id).maybeSingle();

    return json({ ok: true, usuarios: data || [], souAdmin: Boolean(eu?.admin), eu: usuario.id });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST /api/usuarios   body: { email, nome, hash, sal, iteracoes, admin? }
 *
 * O SERVIDOR NUNCA VÊ A SENHA. Quem sorteia a senha e a estica é o navegador de quem está
 * criando a conta (ver `chaveDeLogin` em abacatoAuth.js); daqui chega só o selo, do mesmo jeito
 * que chega num login. É a mesma razão que tirou o cálculo do servidor: ele não precisa da
 * senha para nada, e o que não passa por aqui não pode vazar daqui.
 *
 * A senha em texto existe uma vez só, na tela de quem criou, para ser entregue à pessoa.
 */
export async function POST(req) {
  try {
    const admin = await exigirAdmin(req);
    const { email, nome, hash, sal, iteracoes, admin: ehAdmin, lisa: podeLisa } = await req.json().catch(() => ({}));

    if (!emailValido(email)) throw new ErroDeAcesso(400, "e-mail inválido");
    if (!nome?.trim()) throw new ErroDeAcesso(400, "a pessoa precisa de um nome");
    if (!hash || !sal || !iteracoes) throw new ErroDeAcesso(400, "faltou a senha");
    // Um número de iterações baixo enfraqueceria a senha, e ele chega do navegador. Confere.
    if (Number(iteracoes) < 100000) throw new ErroDeAcesso(400, "número de iterações baixo demais");

    const limpo = String(email).trim().toLowerCase();
    const { data: jaTem } = await supabase
      .from("abacato_usuarios").select("id").ilike("email", limpo).maybeSingle();
    if (jaTem) throw new ErroDeAcesso(409, "já existe uma conta com esse e-mail");

    const { data, error } = await supabase.from("abacato_usuarios").insert({
      email: limpo,
      nome: nome.trim(),
      senha_hash: hash,
      senha_sal: sal,
      senha_iter: Number(iteracoes),
      admin: Boolean(ehAdmin),
      lisa: Boolean(podeLisa),
      criado_por: admin.id,
    }).select("id, nome, email, ativo, admin, lisa, criado_em").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    return json({ ok: true, usuario: data }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
