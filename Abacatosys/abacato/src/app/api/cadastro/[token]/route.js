import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { convitePeloToken, gastarUso } from "@/lib/convites.js";
import { emailValido } from "@/dominio/papeis.js";
import { planoDe } from "@/dominio/planos.js";
import { anotar, TIPOS_DE_EVENTO } from "@/lib/eventos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A porta de fora. É a ÚNICA rota do Abacato que cria uma conta sem sessão.
 *
 * ==========================================================================================
 * O QUE ELA PODE FAZER, E SÓ ISSO
 *
 * Criar uma linha em `abacato_usuarios` com `tipo` vindo do convite, `aprovado = false`,
 * `admin = false` e `lisa = false`. Nada mais. Os três valores são escritos aqui e NÃO são
 * lidos do corpo do pedido — o corpo vem da internet aberta, e um `admin: true` colado nele
 * seria o fim do sistema.
 *
 * A conta que sai daqui não abre nada: o login recusa `aprovado = false`, e mesmo depois de
 * aprovada ela não alcança nenhum quadro que já existia, porque acesso a quadro é participação,
 * e ninguém a pôs em nenhum.
 * ==========================================================================================
 */

/** GET — este link vale? Devolve o que a tela precisa escrever antes de alguém digitar nada. */
export async function GET(req, { params }) {
  try {
    const { token } = await params;
    const convite = await convitePeloToken(token);
    if (!convite) return json({ ok: false, error: "este link de cadastro não vale mais" }, 404);

    const plano = planoDe(convite.tipo);
    return json({
      ok: true,
      convite: { rotulo: convite.rotulo, tipo: convite.tipo },
      // Os limites vão na resposta para a tela poder mostrá-los ANTES do cadastro. Descobrir
      // depois de criar a conta que ela cabe 10 quadros é descobrir tarde.
      plano: {
        rotulo: plano.rotulo,
        quadros: plano.quadros,
        projetos: plano.projetos,
        quadrosCompartilhados: plano.quadrosCompartilhados,
        membrosPorQuadro: plano.membrosPorQuadro,
        armazenamento: plano.armazenamento,
      },
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/**
 * POST   body: { email, nome, hash, sal, iteracoes }
 *
 * O servidor continua sem ver senha: quem estica é o navegador de quem está se cadastrando,
 * igual ao login e igual à criação feita por quem administra.
 */
export async function POST(req, { params }) {
  try {
    const { token } = await params;
    const convite = await convitePeloToken(token);
    if (!convite) throw new ErroDeAcesso(404, "este link de cadastro não vale mais");

    const { email, nome, hash, sal, iteracoes } = await req.json().catch(() => ({}));
    if (!emailValido(email)) throw new ErroDeAcesso(400, "esse e-mail não parece certo");
    if (!nome?.trim()) throw new ErroDeAcesso(400, "falta o seu nome");
    if (!hash || !sal || !iteracoes) throw new ErroDeAcesso(400, "falta a senha");
    if (Number(iteracoes) < 100000) throw new ErroDeAcesso(400, "número de iterações baixo demais");

    const limpo = String(email).trim().toLowerCase();
    const { data: jaTem } = await supabase
      .from("abacato_usuarios").select("id").ilike("email", limpo).maybeSingle();
    // Aqui dizer "já existe" é seguro e necessário: quem está do outro lado acabou de digitar
    // o próprio endereço, e a alternativa seria um "pedido enviado" para um pedido que não foi.
    if (jaTem) throw new ErroDeAcesso(409, "já existe uma conta com esse e-mail — tente entrar");

    const { data, error } = await supabase.from("abacato_usuarios").insert({
      email: limpo,
      nome: String(nome).trim().slice(0, 120),
      senha_hash: hash,
      senha_sal: sal,
      senha_iter: Number(iteracoes),
      tipo: convite.tipo,
      // Os três valores que NÃO vêm do corpo do pedido. Ver o bloco no topo do arquivo.
      aprovado: false,
      admin: false,
      lisa: false,
      convite_id: convite.id,
    }).select("id, nome, email").single();
    if (error) throw new ErroDeAcesso(500, error.message);

    await gastarUso(convite.id);
    anotar({
      usuarioId: data.id, tipo: TIPOS_DE_EVENTO.pediuCadastro, alvo: data.email, alvoId: data.id,
      detalhe: { convite: convite.rotulo || null, tipo: convite.tipo },
    });

    return json({
      ok: true,
      aguardando: true,
      mensagem: "Cadastro recebido. Sua conta será liberada assim que alguém da equipe aprovar — você poderá entrar com este e-mail e a senha que acabou de escolher.",
    }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
