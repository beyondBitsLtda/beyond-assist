import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { quemEh, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { exigirAdmin } from "@/lib/admin.js";
import { emailValido } from "@/dominio/papeis.js";
import { planoDe, tipoValido } from "@/dominio/planos.js";
import { contaDe } from "@/lib/limites.js";
import { anotar, TIPOS_DE_EVENTO } from "@/lib/eventos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/usuarios — as pessoas que quem está pedindo pode ver.
 *
 * ==========================================================================================
 * QUEM É DE FORA NÃO RECEBE A LISTA. NENHUMA LISTA.
 *
 * Para convidar alguém é preciso escolher uma pessoa, e para escolher é preciso ver — foi por
 * isso que esta rota nasceu aberta a qualquer sessão. Para uma conta de cliente isso é um
 * vazamento: ela abriria o inspetor, chamaria /api/usuarios e teria o nome e o e-mail de toda
 * a equipe e de todos os outros clientes, ainda que a tela dela nunca mostrasse nada disso.
 *
 * A troca é `?email=` — quem é de fora convida digitando o endereço de quem já conhece. A
 * resposta devolve UMA pessoa e só quando o endereço bate inteiro: não dá para varrer, porque
 * não há busca por pedaço, e um endereço que não existe responde igual a um que existe e não
 * pode ser visto.
 * ==========================================================================================
 *
 * Só sai o mínimo — nome, e-mail e se está ativa. O hash da senha, o sal e o número de
 * iterações ficam de fora mesmo de uma resposta que exige login: essa é a informação com que
 * se ataca uma senha offline, e ela não precisa sair do banco nunca.
 *
 * `?tudo=1` acrescenta o que só interessa a quem administra: tipo, se é administrador, se usa
 * a assistente, quando a conta foi criada e o último login. Essa parte exige ser administrador.
 */
export async function GET(req) {
  try {
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");

    const url = new URL(req.url);
    const querTudo = url.searchParams.get("tudo") === "1";
    if (querTudo) await exigirAdmin(req);

    const eu = await contaDe(usuario.id);
    if (!eu) throw new ErroDeAcesso(401, "conta não encontrada");

    const campos = querTudo
      ? "id, nome, email, ativo, admin, lisa, tipo, aprovado, criado_em, ultimo_login"
      : "id, nome, email, ativo";

    // Quem não vê o diretório só alcança uma pessoa por vez, e pelo endereço inteiro.
    const procurado = (url.searchParams.get("email") || "").trim().toLowerCase();
    if (!querTudo && !eu.plano.verDiretorio) {
      if (!procurado) {
        return json({
          ok: true, usuarios: [], souAdmin: false, eu: usuario.id,
          podeListar: false,
          recado: "Sua conta convida pelo e-mail: digite o endereço completo de quem você quer adicionar.",
        });
      }
      const { data } = await supabase
        .from("abacato_usuarios").select(campos).ilike("email", procurado).maybeSingle();
      // Uma conta desligada ou à espera de aprovação responde como se não existisse: quem
      // convida não tem o que fazer com ela, e a diferença só serviria para descobrir quem tem
      // conta aqui.
      const achou = data && data.ativo ? [data] : [];
      return json({ ok: true, usuarios: achou, souAdmin: false, eu: usuario.id, podeListar: false });
    }

    let consulta = supabase.from("abacato_usuarios").select(campos).order("nome");
    if (procurado) consulta = consulta.ilike("email", procurado);
    const { data, error } = await consulta;
    if (error) throw new ErroDeAcesso(500, error.message);

    return json({
      ok: true, usuarios: data || [], souAdmin: Boolean(eu.admin), eu: usuario.id, podeListar: true,
    });
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
    const corpo = await req.json().catch(() => ({}));
    const { email, nome, hash, sal, iteracoes, admin: ehAdmin, lisa: podeLisa } = corpo;
    const tipo = tipoValido(corpo.tipo) ? corpo.tipo : "interno";

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
      tipo,
      // Conta criada por quem administra já nasce aprovada — a aprovação existe para o cadastro
      // que vem de fora, e pedir que o admin aprove o que ele mesmo acabou de criar seria um
      // passo que só serve para ser esquecido.
      aprovado: true,
      // Cliente NUNCA é administrador e NUNCA fala com a assistente, venha o que vier no corpo
      // do pedido. O banco também recusa (constraint `abacato_usuarios_cliente_sem_lisa`); esta
      // linha é para a resposta ser um "não" claro em vez de um erro de banco.
      admin: tipo === "cliente" ? false : Boolean(ehAdmin),
      lisa: tipo === "cliente" ? false : Boolean(podeLisa),
      criado_por: admin.id,
    }).select("id, nome, email, ativo, admin, lisa, tipo, aprovado, criado_em").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    anotar({
      usuarioId: admin.id, tipo: TIPOS_DE_EVENTO.criouConta, alvo: data.email, alvoId: data.id,
      detalhe: { tipo: data.tipo, plano: planoDe(data.tipo).rotulo },
    });
    return json({ ok: true, usuario: data }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
