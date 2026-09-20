import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { carregarQuadrosParaPainel } from "@/lib/painelNoBanco.js";
import { painelDoQuadro } from "@/dominio/painel.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/publico/:token — o painel que o cliente abre, SEM LOGIN.
 *
 * Esta é a única rota do sistema que responde a quem não entrou, e por isso ela é a mais
 * estreita de todas. O que decide não é o que ela mostra, e sim o que ela SE RECUSA a mostrar:
 *
 *   entra    contagens, nomes de coluna, nomes de etiqueta, progresso, e — só se quem criou o
 *            link permitiu — os TÍTULOS dos cards atrasados.
 *
 *   NÃO entra   descrição, checklist, link, anexo, responsável, comentário, id de card, nome de
 *               pessoa, e-mail. Nada disso ajuda o cliente a saber como vai o trabalho, e tudo
 *               isso é o que ele não deveria poder ler.
 *
 * O `id` do quadro também fica de fora. Vazá-lo não abriria nada — as rotas internas exigem
 * sessão —, mas um identificador interno num endereço público é um convite a tentar.
 */
export async function GET(req, { params }) {
  try {
    const { token } = await params;

    // A MESMA mensagem de um link que não existe. Eu tinha escrito "link inválido" aqui, o que
    // contradizia o comentário logo abaixo: um token curto demais é reconhecível, e dizer isso
    // já é uma resposta a quem está tentando descobrir o formato.
    const NAO_EXISTE = json({ ok: false, error: "este link não está mais disponível" }, 404);
    if (!token || token.length < 16) return NAO_EXISTE;

    const { data: painel } = await supabase
      .from("abacato_paineis_publicos")
      .select("id, quadro_id, titulo, com_titulos, ativo, expira_em, vistas")
      .eq("token", token).maybeSingle();

    // Link desligado, inexistente ou vencido: a MESMA resposta para os três. Distinguir diria a
    // quem está tentando se aquele endereço já existiu, que é informação que ele não precisa.
    const vencido = painel?.expira_em && new Date(painel.expira_em) < new Date();
    if (!painel || !painel.ativo || vencido) return NAO_EXISTE;

    // Carrega SEM conferir permissão: quem tem o token já passou pela única porta que existe
    // aqui. O que limita o estrago é o que a resposta abaixo se recusa a montar, e não quem
    // consegue ler o quadro.
    const [quadro] = await carregarQuadrosParaPainel([painel.quadro_id]);
    // Quadro arquivado some do carregamento — e o link morre junto, que é o certo: arquivar um
    // quadro é como alguém desliga o acompanhamento.
    if (!quadro) return NAO_EXISTE;

    const p = painelDoQuadro(quadro);

    // Registrar a visita não pode atrasar nem derrubar a resposta: o cliente está esperando a
    // página, e uma contagem de acessos não vale um segundo de espera dele. Sem `await`, e com
    // os erros engolidos de propósito.
    //
    // A contagem soma a partir do valor que já foi lido acima. Dois acessos no mesmo instante
    // podem contar como um — e para "o cliente olhou?" isso não muda nada.
    supabase.from("abacato_paineis_publicos")
      .update({ visto_em: new Date().toISOString(), vistas: (painel.vistas || 0) + 1 })
      .eq("id", painel.id).then(() => {}, () => {});

    return json({
      ok: true,
      titulo: painel.titulo || p.nome,
      atualizadoEm: new Date().toISOString(),
      resumo: {
        total: p.total,
        abertos: p.abertos,
        feitos: p.feitos,
        progresso: p.progresso,
        atrasados: p.porEstado.atrasado,
        paraHoje: p.porEstado.hoje,
      },
      colunas: p.colunas.map((c) => ({ nome: c.nome, total: c.total, feitos: c.feitos })),
      etiquetas: p.etiquetas.map((e) => ({ nome: e.nome, cor: e.cor, total: e.total })),
      semana: p.semana,
      // Os títulos são opcionais e vêm SEM id, sem responsável e sem etiqueta: só o texto e há
      // quantos dias venceu. É o suficiente para o cliente cobrar, e o mínimo para ele saber.
      atrasados: painel.com_titulos
        ? p.atrasadosDetalhe.map((c) => ({ titulo: c.titulo, diasAtrasado: c.diasAtrasado }))
        : [],

      // As três perguntas de quem acompanha de fora: o que está rodando, o que vem, o que saiu.
      //
      // Todas atrás do MESMO interruptor dos atrasados. Um painel sem títulos é um painel de
      // números — e quem escolheu escondê-los não pode ver os mesmos títulos voltarem por uma
      // seção nova. O `com_titulos` governa tudo que é texto de card, sem exceção.
      emAndamento: painel.com_titulos
        ? p.emAndamento.map((c) => ({ titulo: c.titulo, etapa: c.etapa, estado: c.estado, fimEm: c.fimEm }))
        : [],
      proximasEntregas: painel.com_titulos
        ? p.proximasEntregas.map((c) => ({ titulo: c.titulo, fimEm: c.fimEm, emDias: c.emDias }))
        : [],
      entregues: painel.com_titulos
        ? p.entregues.map((c) => ({ titulo: c.titulo, fimEm: c.fimEm }))
        : [],
      // Quantos existem, mesmo sem os títulos: o número não identifica ninguém, e sem ele um
      // painel de números não diz nem quantas frentes estão abertas.
      contagens: {
        emAndamento: p.emAndamento.length,
        proximasEntregas: p.proximasEntregas.length,
        entregues: p.entregues.length,
      },
      mostraTitulos: painel.com_titulos,
    });
  } catch {
    // Sem detalhe do erro: esta rota fala com quem não entrou, e a mensagem de um erro interno
    // é um mapa da casa.
    return json({ ok: false, error: "não consegui montar este painel agora" }, 500);
  }
}
