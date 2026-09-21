/**
 * O que a Lisa pode fazer dentro do Abacato.
 *
 * ==========================================================================================
 * A REGRA QUE GOVERNA ESTE ARQUIVO INTEIRO: A LISA NÃO TEM PODER PRÓPRIO.
 *
 * Toda ferramenta que mexe em alguma coisa passa pelo mesmo `exigir()` das rotas normais, com
 * a sessão de quem está conversando. Se você não pode editar aquele quadro, pedir à Lisa
 * também não edita — ela recebe o mesmo 403 e conta isso na conversa.
 *
 * É por isso que este laço roda AQUI, dentro do Abacato, e não na Lisa lá fora: se as ações
 * fossem executadas do outro lado, elas usariam a credencial do serviço, e qualquer pessoa
 * com acesso à assistente teria acesso a tudo. A assistente mora onde mora a sessão.
 *
 * DUAS COISAS QUE ELA NÃO FAZ, DE PROPÓSITO:
 *
 *   NÃO APAGA NADA. Não há ferramenta de apagar, arquivar ou remover ninguém. Criar e editar
 *   se desfaz olhando; apagar por engano, a partir de uma frase mal entendida, não.
 *
 *   NÃO CONVIDA NINGUÉM. Dar acesso é uma decisão de quem é dono, e uma decisão dessas não
 *   deve caber numa interpretação de texto.
 * ==========================================================================================
 */

import { supabase } from "./supabase.js";
import { exigir, quemEh, ErroDeAcesso, tocarQuadro } from "./acesso.js";
import { posicaoEntre } from "@/dominio/Quadro.js";
import { corValida } from "@/dominio/cores.js";
import { paraInstante } from "@/dominio/datas.js";

/* ------------------------------------------------------ o que a Lisa enxerga */

/** Os quadros que ESTA pessoa alcança. Dono ou membro — nada além disso. */
async function quadrosDe(usuarioId) {
  const [{ data: meus }, { data: membroDe }] = await Promise.all([
    supabase.from("abacato_quadros").select("id, nome, descricao").eq("dono_id", usuarioId).eq("arquivado", false),
    supabase.from("abacato_membros").select("papel, abacato_quadros ( id, nome, descricao, arquivado )").eq("usuario_id", usuarioId),
  ]);

  const vistos = new Set();
  const lista = [];
  for (const q of meus || []) {
    vistos.add(q.id);
    lista.push({ id: q.id, nome: q.nome, descricao: q.descricao, papel: "dono" });
  }
  for (const m of membroDe || []) {
    const q = m.abacato_quadros;
    if (!q || q.arquivado || vistos.has(q.id)) continue;
    vistos.add(q.id);
    lista.push({ id: q.id, nome: q.nome, descricao: q.descricao, papel: m.papel });
  }
  return lista;
}

async function projetosDe(usuarioId) {
  const [{ data: meus }, { data: membroDe }] = await Promise.all([
    supabase.from("abacato_projetos").select("id, nome, descricao").eq("dono_id", usuarioId).eq("arquivado", false),
    supabase.from("abacato_projeto_membros").select("papel, abacato_projetos ( id, nome, descricao, arquivado )").eq("usuario_id", usuarioId),
  ]);

  const vistos = new Set();
  const lista = [];
  for (const p of meus || []) {
    vistos.add(p.id);
    lista.push({ id: p.id, nome: p.nome, descricao: p.descricao, papel: "dono" });
  }
  for (const m of membroDe || []) {
    const p = m.abacato_projetos;
    if (!p || p.arquivado || vistos.has(p.id)) continue;
    vistos.add(p.id);
    lista.push({ id: p.id, nome: p.nome, descricao: p.descricao, papel: m.papel });
  }
  return lista;
}

/* ------------------------------------------------------------ declarações */

/**
 * O que o modelo vê. Cada descrição é escrita para ELE, e não para gente: diz quando usar, o
 * que espera e o que NÃO fazer. Uma descrição vaga aqui vira uma ferramenta usada na hora
 * errada, e o sintoma aparece três passos depois, como um card criado no quadro errado.
 */
export const FERRAMENTAS = [
  {
    name: "listar_quadros",
    description: "Os quadros de tarefas a que esta pessoa tem acesso, com id, nome e o papel dela. Use SEMPRE antes de mexer num quadro, para descobrir o id certo — nunca invente um id.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "ver_quadro",
    description: "As colunas e os cards de um quadro: id, título, coluna, prazo e se está concluído. Use para responder o que está em andamento, o que vence, ou para achar o id de um card antes de mudá-lo.",
    parameters: {
      type: "object",
      properties: { quadroId: { type: "string", description: "id do quadro, vindo de listar_quadros" } },
      required: ["quadroId"],
    },
  },
  {
    name: "procurar_cards",
    description: "Procura tarefas por pedaço do título, em TODOS os quadros que a pessoa acessa. Use quando ela cita uma tarefa pelo nome e você não sabe em que quadro está.",
    parameters: {
      type: "object",
      properties: { texto: { type: "string", description: "parte do título a procurar" } },
      required: ["texto"],
    },
  },
  {
    name: "criar_card",
    description: "Cria uma tarefa numa coluna. Confirme o quadro e a coluna antes: se houver mais de uma possibilidade, pergunte em vez de escolher.",
    parameters: {
      type: "object",
      properties: {
        colunaId: { type: "string", description: "id da coluna, vindo de ver_quadro" },
        titulo: { type: "string" },
        descricao: { type: "string", description: "opcional" },
        fimEm: { type: "string", description: "prazo, no formato AAAA-MM-DD ou AAAA-MM-DD HH:MM. Sem hora, vale até o fim do dia." },
      },
      required: ["colunaId", "titulo"],
    },
  },
  {
    name: "mudar_card",
    description: "Muda uma tarefa que já existe: título, descrição, prazo, início, coluna, ou marcar/desmarcar concluída. Só envie os campos que mudam.",
    parameters: {
      type: "object",
      properties: {
        cardId: { type: "string" },
        titulo: { type: "string" },
        descricao: { type: "string" },
        fimEm: { type: "string", description: "novo prazo (AAAA-MM-DD ou AAAA-MM-DD HH:MM). Mande a palavra 'nenhum' para tirar o prazo." },
        inicioEm: { type: "string" },
        colunaId: { type: "string", description: "para mover de coluna" },
        concluido: { type: "boolean" },
      },
      required: ["cardId"],
    },
  },
  {
    name: "criar_coluna",
    description: "Cria uma coluna (etapa) num quadro.",
    parameters: {
      type: "object",
      properties: { quadroId: { type: "string" }, nome: { type: "string" } },
      required: ["quadroId", "nome"],
    },
  },
  {
    name: "criar_quadro",
    description: "Cria um quadro de tarefas novo, já com as colunas A fazer, Fazendo e Feito. Use só quando a pessoa pedir um quadro novo — para uma tarefa solta, use um quadro que já existe.",
    parameters: {
      type: "object",
      properties: { nome: { type: "string" }, descricao: { type: "string", description: "opcional" } },
      required: ["nome"],
    },
  },
  {
    name: "listar_projetos",
    description: "Os projetos de DOCUMENTAÇÃO a que a pessoa tem acesso. São separados dos quadros de tarefas: um projeto guarda documentos, um quadro guarda tarefas.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "ver_projeto",
    description: "As pastas e os documentos de um projeto de documentação, com nome, categoria e quando foi atualizado.",
    parameters: {
      type: "object",
      properties: { projetoId: { type: "string" } },
      required: ["projetoId"],
    },
  },
  {
    name: "procurar_documentos",
    description: "Procura documentos por pedaço do nome, em todos os projetos que a pessoa acessa.",
    parameters: {
      type: "object",
      properties: { texto: { type: "string" } },
      required: ["texto"],
    },
  },
  {
    name: "criar_projeto",
    description: "Cria um projeto de documentação novo.",
    parameters: {
      type: "object",
      properties: {
        nome: { type: "string" },
        descricao: { type: "string", description: "opcional" },
        cor: { type: "string", description: "opcional, em hexadecimal" },
      },
      required: ["nome"],
    },
  },
  {
    name: "criar_pasta",
    description: "Cria uma pasta dentro de um projeto de documentação.",
    parameters: {
      type: "object",
      properties: {
        projetoId: { type: "string" },
        nome: { type: "string" },
        paiId: { type: "string", description: "opcional — id da pasta acima, para criar uma subpasta" },
      },
      required: ["projetoId", "nome"],
    },
  },
];

/* ------------------------------------------------------------- execução */

/** Um resumo curto do card, do jeito que o modelo precisa ler. */
function cardCurto(c, nomeDaColuna) {
  return {
    id: c.id,
    titulo: c.titulo,
    coluna: nomeDaColuna,
    prazo: c.fim_em || null,
    concluido: Boolean(c.concluido),
  };
}

/**
 * Roda uma ferramenta. Devolve SEMPRE um objeto — inclusive no erro.
 *
 * Erro vira `{ erro: "..." }` em vez de exceção porque o modelo precisa LER o que deu errado
 * para contar à pessoa ou tentar outro caminho. Uma exceção aqui derrubaria a conversa inteira
 * por causa de um id digitado errado.
 */
export async function executar(req, nome, args, fusoMinutos) {
  try {
    return await rodar(req, nome, args || {}, fusoMinutos);
  } catch (e) {
    const status = e instanceof ErroDeAcesso ? e.status : 500;
    if (status === 404) return { erro: "não encontrei isso, ou você não tem acesso" };
    if (status === 403) return { erro: `você não tem permissão para isso: ${e.message}` };
    return { erro: e.message || "não consegui fazer isso" };
  }
}

async function rodar(req, nome, args, fuso) {
  const usuario = await quemEh(req);
  if (!usuario) throw new ErroDeAcesso(401, "sem sessão");

  switch (nome) {
    /* ------------------------------------------------------------ ler */
    case "listar_quadros":
      return { quadros: await quadrosDe(usuario.id) };

    case "ver_quadro": {
      await exigir(req, "quadro", args.quadroId, "ver");
      const { data: colunas } = await supabase
        .from("abacato_colunas").select("id, nome, posicao")
        .eq("quadro_id", args.quadroId).eq("arquivada", false).order("posicao");

      const ids = (colunas || []).map((c) => c.id);
      const { data: cards } = ids.length
        ? await supabase.from("abacato_cards")
            .select("id, coluna_id, titulo, fim_em, concluido")
            .in("coluna_id", ids).eq("arquivado", false).order("posicao")
        : { data: [] };

      const porColuna = new Map((colunas || []).map((c) => [c.id, c.nome]));
      return {
        colunas: (colunas || []).map((c) => ({ id: c.id, nome: c.nome })),
        cards: (cards || []).map((c) => cardCurto(c, porColuna.get(c.coluna_id))),
      };
    }

    case "procurar_cards": {
      const meus = await quadrosDe(usuario.id);
      if (!meus.length) return { cards: [] };

      const { data: colunas } = await supabase
        .from("abacato_colunas").select("id, nome, quadro_id")
        .in("quadro_id", meus.map((q) => q.id)).eq("arquivada", false);
      if (!colunas?.length) return { cards: [] };

      // O texto vai para um `ilike` com curinga nas pontas. Os caracteres do próprio padrão
      // (%, _) são escapados: sem isso, procurar "100%" viraria "procure qualquer coisa".
      const limpo = String(args.texto || "").replace(/[%_\\]/g, (c) => "\\" + c);
      const { data: cards } = await supabase
        .from("abacato_cards").select("id, coluna_id, titulo, fim_em, concluido")
        .in("coluna_id", colunas.map((c) => c.id))
        .ilike("titulo", `%${limpo}%`)
        .eq("arquivado", false).limit(25);

      const nomeColuna = new Map(colunas.map((c) => [c.id, c.nome]));
      const quadroDaColuna = new Map(colunas.map((c) => [c.id, c.quadro_id]));
      const nomeQuadro = new Map(meus.map((q) => [q.id, q.nome]));

      return {
        cards: (cards || []).map((c) => ({
          ...cardCurto(c, nomeColuna.get(c.coluna_id)),
          quadro: nomeQuadro.get(quadroDaColuna.get(c.coluna_id)),
          quadroId: quadroDaColuna.get(c.coluna_id),
        })),
      };
    }

    case "listar_projetos":
      return { projetos: await projetosDe(usuario.id) };

    case "ver_projeto": {
      await exigir(req, "projeto", args.projetoId, "ver");
      const [{ data: pastas }, { data: documentos }] = await Promise.all([
        supabase.from("abacato_pastas").select("id, pai_id, nome")
          .eq("projeto_id", args.projetoId).eq("arquivada", false).order("posicao"),
        supabase.from("abacato_documentos").select("id, pasta_id, nome, categoria, atualizado_em")
          .eq("projeto_id", args.projetoId).eq("arquivado", false).order("nome").limit(100),
      ]);
      const nomePasta = new Map((pastas || []).map((p) => [p.id, p.nome]));
      return {
        pastas: (pastas || []).map((p) => ({ id: p.id, nome: p.nome, dentroDe: nomePasta.get(p.pai_id) || null })),
        documentos: (documentos || []).map((d) => ({
          id: d.id, nome: d.nome, categoria: d.categoria,
          pasta: nomePasta.get(d.pasta_id) || "(raiz)",
          atualizadoEm: d.atualizado_em,
        })),
      };
    }

    case "procurar_documentos": {
      const meus = await projetosDe(usuario.id);
      if (!meus.length) return { documentos: [] };
      const limpo = String(args.texto || "").replace(/[%_\\]/g, (c) => "\\" + c);
      const { data: docs } = await supabase
        .from("abacato_documentos").select("id, projeto_id, nome, categoria, atualizado_em")
        .in("projeto_id", meus.map((p) => p.id))
        .ilike("nome", `%${limpo}%`).eq("arquivado", false).limit(25);
      const nomeProjeto = new Map(meus.map((p) => [p.id, p.nome]));
      return {
        documentos: (docs || []).map((d) => ({
          id: d.id, nome: d.nome, categoria: d.categoria,
          projeto: nomeProjeto.get(d.projeto_id), projetoId: d.projeto_id,
          atualizadoEm: d.atualizado_em,
        })),
      };
    }

    /* ---------------------------------------------------------- escrever */
    case "criar_card": {
      const { quadroId } = await exigir(req, "coluna", args.colunaId, "criar");
      if (!args.titulo?.trim()) return { erro: "a tarefa precisa de um título" };

      const { data: vizinho } = await supabase
        .from("abacato_cards").select("posicao").eq("coluna_id", args.colunaId)
        .eq("arquivado", false).order("posicao", { ascending: false }).limit(1).maybeSingle();

      const { data, error } = await supabase.from("abacato_cards").insert({
        coluna_id: args.colunaId,
        titulo: args.titulo.trim(),
        descricao: args.descricao?.trim() || null,
        fim_em: paraInstante(args.fimEm, fuso),
        posicao: posicaoEntre(vizinho?.posicao ?? null, null),
      }).select("id, titulo, fim_em").single();
      if (error) return { erro: error.message };

      await tocarQuadro(quadroId);
      return { feito: true, card: { id: data.id, titulo: data.titulo, prazo: data.fim_em } };
    }

    case "mudar_card": {
      const { quadroId } = await exigir(req, "card", args.cardId, "editar");
      const mudancas = {};

      if (typeof args.titulo === "string" && args.titulo.trim()) mudancas.titulo = args.titulo.trim();
      if (typeof args.descricao === "string") mudancas.descricao = args.descricao.trim() || null;
      if (typeof args.concluido === "boolean") mudancas.concluido = args.concluido;

      // "nenhum" é como o modelo pede para TIRAR o prazo. Sem esta palavra ele não teria como
      // distinguir "não mexe no prazo" de "apaga o prazo" — os dois seriam campo ausente.
      if (typeof args.fimEm === "string") {
        mudancas.fim_em = /^(nenhum|nenhuma|sem prazo|null)$/i.test(args.fimEm.trim())
          ? null : paraInstante(args.fimEm, fuso);
      }
      if (typeof args.inicioEm === "string") {
        mudancas.inicio_em = /^(nenhum|nenhuma|null)$/i.test(args.inicioEm.trim())
          ? null : paraInstante(args.inicioEm, fuso);
      }

      if (args.colunaId) {
        // A coluna de destino tem de ser DO MESMO QUADRO. Sem esta checagem, um id de outro
        // quadro moveria o card para fora da vista de quem o criou — e a permissão já
        // conferida não valeria mais para onde ele foi parar.
        const { data: destino } = await supabase
          .from("abacato_colunas").select("id, quadro_id").eq("id", args.colunaId).maybeSingle();
        if (!destino) return { erro: "essa coluna não existe" };
        if (destino.quadro_id !== quadroId) return { erro: "essa coluna é de outro quadro" };
        mudancas.coluna_id = args.colunaId;
      }

      if (!Object.keys(mudancas).length) return { erro: "não veio nada para mudar" };

      const { data, error } = await supabase.from("abacato_cards")
        .update(mudancas).eq("id", args.cardId)
        .select("id, titulo, fim_em, concluido, coluna_id").single();
      if (error) return { erro: error.message };

      await tocarQuadro(quadroId);
      return { feito: true, card: { id: data.id, titulo: data.titulo, prazo: data.fim_em, concluido: data.concluido } };
    }

    case "criar_coluna": {
      await exigir(req, "quadro", args.quadroId, "criar");
      if (!args.nome?.trim()) return { erro: "a coluna precisa de um nome" };
      const { data: ultima } = await supabase
        .from("abacato_colunas").select("posicao").eq("quadro_id", args.quadroId)
        .order("posicao", { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await supabase.from("abacato_colunas").insert({
        quadro_id: args.quadroId, nome: args.nome.trim(), posicao: (ultima?.posicao || 0) + 1024,
      }).select("id, nome").single();
      if (error) return { erro: error.message };
      return { feito: true, coluna: data };
    }

    case "criar_quadro": {
      if (!args.nome?.trim()) return { erro: "o quadro precisa de um nome" };
      const { data: quadro, error } = await supabase.from("abacato_quadros").insert({
        nome: args.nome.trim(),
        descricao: args.descricao?.trim() || null,
        dono_id: usuario.id,
      }).select("id, nome").single();
      if (error) return { erro: error.message };

      const colunas = ["A fazer", "Fazendo", "Feito"].map((nome, i) => ({
        quadro_id: quadro.id, nome, posicao: (i + 1) * 1024,
      }));
      const { data: criadas } = await supabase.from("abacato_colunas").insert(colunas).select("id, nome");
      return { feito: true, quadro, colunas: criadas || [] };
    }

    case "criar_projeto": {
      if (!args.nome?.trim()) return { erro: "o projeto precisa de um nome" };
      const { data, error } = await supabase.from("abacato_projetos").insert({
        nome: args.nome.trim(),
        descricao: args.descricao?.trim() || null,
        cor: corValida(args.cor) ? args.cor : "#22C55E",
        dono_id: usuario.id,
      }).select("id, nome").single();
      if (error) return { erro: error.message };
      return { feito: true, projeto: data };
    }

    case "criar_pasta": {
      await exigir(req, "projeto", args.projetoId, "criar");
      if (!args.nome?.trim()) return { erro: "a pasta precisa de um nome" };
      if (args.paiId) {
        const { data: pai } = await supabase
          .from("abacato_pastas").select("id, projeto_id").eq("id", args.paiId).maybeSingle();
        if (!pai) return { erro: "a pasta de cima não existe" };
        if (pai.projeto_id !== args.projetoId) return { erro: "essa pasta é de outro projeto" };
      }
      const { data: ultima } = await supabase
        .from("abacato_pastas").select("posicao").eq("projeto_id", args.projetoId)
        .is("pai_id", args.paiId || null).order("posicao", { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await supabase.from("abacato_pastas").insert({
        projeto_id: args.projetoId,
        pai_id: args.paiId || null,
        nome: args.nome.trim(),
        posicao: (ultima?.posicao || 0) + 1024,
      }).select("id, nome").single();
      if (error) return { erro: error.message };
      return { feito: true, pasta: data };
    }

    default:
      return { erro: `não conheço a ferramenta "${nome}"` };
  }
}

/** As ferramentas que MUDAM alguma coisa — a tela marca essas na conversa. */
export const QUE_MUDAM = new Set([
  "criar_card", "mudar_card", "criar_coluna", "criar_quadro", "criar_projeto", "criar_pasta",
]);
