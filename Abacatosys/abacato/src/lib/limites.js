/**
 * Quanto uma conta já usou, e se ela ainda pode.
 *
 * ==========================================================================================
 * A CONTAGEM ACONTECE NO SERVIDOR, SEMPRE, E A TELA NUNCA É CONSULTADA
 *
 * A tela esconde o botão de "novo quadro" quando o limite estourou. Isso é conforto, e não
 * segurança: qualquer pessoa abre o inspetor, encontra a rota e a chama na mão. É por isso
 * que TODA rota que cria alguma coisa passa por aqui antes, e por isso que este arquivo não
 * confia em nenhum número que tenha vindo do navegador.
 *
 * O uso é CONTADO no banco a cada vez, e não guardado num contador. Um contador desalinha na
 * primeira exclusão que falha no meio, e a partir daí o limite passa a mentir nos dois
 * sentidos — barra quem podia e deixa passar quem não podia. Contar custa uma consulta
 * indexada; desalinhar custa confiança.
 * ==========================================================================================
 */

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./acesso.js";
import { planoDe, medir, semLimite, RECADOS } from "@/dominio/planos.js";

/** Quem é esta pessoa para efeito de limite: tipo, plano e se ainda está aprovada. */
export async function contaDe(usuarioId) {
  const { data } = await supabase
    .from("abacato_usuarios")
    .select("id, nome, email, tipo, ativo, aprovado, admin, lisa")
    .eq("id", usuarioId).maybeSingle();
  if (!data) return null;
  return { ...data, plano: planoDe(data.tipo) };
}

/* ------------------------------------------------------------------ contagens */

/** Quantos quadros esta pessoa é DONA. O que foi compartilhado com ela não conta: o limite é
 *  sobre o que ela criou, e não sobre o que ela alcança. */
export async function quantosQuadros(usuarioId) {
  const { count } = await supabase
    .from("abacato_quadros").select("id", { count: "exact", head: true })
    .eq("dono_id", usuarioId).eq("arquivado", false);
  return count || 0;
}

export async function quantosProjetos(usuarioId) {
  const { count } = await supabase
    .from("abacato_projetos").select("id", { count: "exact", head: true })
    .eq("dono_id", usuarioId).eq("arquivado", false);
  return count || 0;
}

/**
 * Quantos quadros DELA já têm alguém de fora dentro.
 *
 * Conta quadros, e não convites: um quadro com três pessoas é UM quadro compartilhado. Contar
 * linhas de membro faria "3 quadros compartilhados" virar "1 quadro com 3 pessoas", que é
 * outra coisa completamente.
 */
export async function quantosQuadrosCompartilhados(usuarioId) {
  const { data: meus } = await supabase
    .from("abacato_quadros").select("id").eq("dono_id", usuarioId).eq("arquivado", false);
  if (!meus?.length) return 0;

  const { data: membros } = await supabase
    .from("abacato_membros").select("quadro_id")
    .in("quadro_id", meus.map((q) => q.id));
  return new Set((membros || []).map((m) => m.quadro_id)).size;
}

export async function quantosProjetosCompartilhados(usuarioId) {
  const { data: meus } = await supabase
    .from("abacato_projetos").select("id").eq("dono_id", usuarioId).eq("arquivado", false);
  if (!meus?.length) return 0;

  const { data: membros } = await supabase
    .from("abacato_projeto_membros").select("projeto_id")
    .in("projeto_id", meus.map((p) => p.id));
  return new Set((membros || []).map((m) => m.projeto_id)).size;
}

/**
 * Quantos bytes os arquivos desta pessoa ocupam.
 *
 * Soma TODAS as revisões, e não só a atual. Guardar dez versões de um arquivo de 300 MB ocupa
 * três gigas de disco — cobrar só pela última seria cobrar pelo que se vê e pagar pelo que
 * está lá. Quem quiser espaço apaga as versões velhas, que é uma ação que existe na tela.
 */
export async function bytesUsados(usuarioId) {
  const { data: projetos } = await supabase
    .from("abacato_projetos").select("id").eq("dono_id", usuarioId);
  if (!projetos?.length) return 0;

  const { data: documentos } = await supabase
    .from("abacato_documentos").select("id").in("projeto_id", projetos.map((p) => p.id));
  if (!documentos?.length) return 0;

  // Em lotes: `in` com milhares de ids estoura o tamanho da URL do PostgREST, e o sintoma
  // seria um erro de rede num sistema que só ficou maior.
  let total = 0;
  const ids = documentos.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data: revisoes } = await supabase
      .from("abacato_revisoes").select("tamanho").in("documento_id", ids.slice(i, i + 200));
    for (const r of revisoes || []) total += Number(r.tamanho) || 0;
  }
  return total;
}

/* ------------------------------------------------------------------- o painel */

/**
 * Tudo que a pessoa usou, medido contra o plano dela.
 *
 * Uma consulta por número, em paralelo. Serve à tela de "seu plano" e ao painel de quem
 * administra — e as duas precisam ver exatamente a mesma conta, senão uma diz que dá e a
 * outra diz que não.
 */
export async function usoDe(usuarioId) {
  const conta = await contaDe(usuarioId);
  if (!conta) return null;
  const p = conta.plano;

  const [quadros, projetos, quadrosComp, projetosComp, bytes] = await Promise.all([
    quantosQuadros(usuarioId),
    quantosProjetos(usuarioId),
    quantosQuadrosCompartilhados(usuarioId),
    quantosProjetosCompartilhados(usuarioId),
    bytesUsados(usuarioId),
  ]);

  return {
    tipo: conta.tipo,
    plano: p.rotulo,
    admin: Boolean(conta.admin),
    lisa: Boolean(conta.lisa),
    verDiretorio: Boolean(p.verDiretorio),
    quadros: medir(quadros, p.quadros),
    projetos: medir(projetos, p.projetos),
    quadrosCompartilhados: medir(quadrosComp, p.quadrosCompartilhados),
    projetosCompartilhados: medir(projetosComp, p.projetosCompartilhados),
    armazenamento: medir(bytes, p.armazenamento),
    membrosPorQuadro: semLimite(p.membrosPorQuadro) ? null : p.membrosPorQuadro,
    membrosPorProjeto: semLimite(p.membrosPorProjeto) ? null : p.membrosPorProjeto,
  };
}

/* ------------------------------------------------------------------- as travas */

/**
 * Pode criar mais um quadro?
 *
 * Lança quando não. Lançar, e não devolver false, é deliberado: uma rota que esquece de olhar
 * o retorno deixa passar em silêncio, e o limite vira decoração. Uma exceção não tem como ser
 * ignorada por engano.
 */
export async function exigirPodeCriarQuadro(usuarioId) {
  const conta = await contaDe(usuarioId);
  if (!conta) throw new ErroDeAcesso(401, "conta não encontrada");
  const teto = conta.plano.quadros;
  if (semLimite(teto)) return;

  const usados = await quantosQuadros(usuarioId);
  if (usados >= teto) throw new ErroDeAcesso(403, RECADOS.quadros(teto));
}

export async function exigirPodeCriarProjeto(usuarioId) {
  const conta = await contaDe(usuarioId);
  if (!conta) throw new ErroDeAcesso(401, "conta não encontrada");
  const teto = conta.plano.projetos;
  if (semLimite(teto)) return;

  const usados = await quantosProjetos(usuarioId);
  if (usados >= teto) throw new ErroDeAcesso(403, RECADOS.projetos(teto));
}

/**
 * Pode pôr mais alguém neste quadro?
 *
 * Duas contas diferentes: quantas pessoas cabem NESTE quadro, e quantos quadros esta pessoa
 * pode ter compartilhados ao todo. As duas valem, e quem manda é o DONO do quadro — não quem
 * está convidando. Um cliente que compartilha com alguém de dentro não ganha o limite do
 * outro; o quadro é dele, e o teto é o dele.
 */
export async function exigirPodeCompartilhar(tipo, id, usuarioAlvoId) {
  const ehProjeto = tipo === "projeto";
  const tabela = ehProjeto ? "abacato_projetos" : "abacato_quadros";
  const tabelaMembros = ehProjeto ? "abacato_projeto_membros" : "abacato_membros";
  const coluna = ehProjeto ? "projeto_id" : "quadro_id";

  const { data: raiz } = await supabase.from(tabela).select("dono_id").eq("id", id).maybeSingle();
  if (!raiz) throw new ErroDeAcesso(404, "não encontrado");

  const conta = await contaDe(raiz.dono_id);
  if (!conta) throw new ErroDeAcesso(500, "não achei o dono disto");
  const p = conta.plano;

  const tetoMembros = ehProjeto ? p.membrosPorProjeto : p.membrosPorQuadro;
  const tetoCompartilhados = ehProjeto ? p.projetosCompartilhados : p.quadrosCompartilhados;
  if (semLimite(tetoMembros) && semLimite(tetoCompartilhados)) return;

  // Quantas pessoas já estão aqui. Quem já é membro não conta de novo: mudar o papel de
  // alguém que já está dentro não é um convite novo, e barrar isso seria impedir de corrigir
  // um papel num quadro cheio.
  const { data: membros } = await supabase
    .from(tabelaMembros).select("usuario_id").eq(coluna, id);
  const jaEsta = (membros || []).some((m) => m.usuario_id === usuarioAlvoId);

  if (!semLimite(tetoMembros) && !jaEsta && (membros || []).length >= tetoMembros) {
    throw new ErroDeAcesso(403, ehProjeto
      ? RECADOS.membrosPorProjeto(tetoMembros)
      : RECADOS.membrosPorQuadro(tetoMembros));
  }

  // E quantos quadros/projetos DELE já estão compartilhados. Só conta quando ESTE ainda não
  // estava — pôr a segunda pessoa num quadro que já era compartilhado não abre um novo.
  if (!semLimite(tetoCompartilhados) && !(membros || []).length) {
    const usados = ehProjeto
      ? await quantosProjetosCompartilhados(raiz.dono_id)
      : await quantosQuadrosCompartilhados(raiz.dono_id);
    if (usados >= tetoCompartilhados) {
      throw new ErroDeAcesso(403, ehProjeto
        ? RECADOS.projetosCompartilhados(tetoCompartilhados)
        : RECADOS.quadrosCompartilhados(tetoCompartilhados));
    }
  }
}

/**
 * Cabe mais este arquivo?
 *
 * Conferido ANTES de subir, com o tamanho declarado, e o dono é o do PROJETO — quem envia
 * pode ser um convidado, e o espaço gasto é sempre de quem é dono do lugar onde o arquivo
 * vai morar.
 */
export async function exigirCabeArquivo(projetoId, bytes) {
  const { data: projeto } = await supabase
    .from("abacato_projetos").select("dono_id").eq("id", projetoId).maybeSingle();
  if (!projeto) throw new ErroDeAcesso(404, "projeto não encontrado");

  const conta = await contaDe(projeto.dono_id);
  if (!conta) throw new ErroDeAcesso(500, "não achei o dono deste projeto");
  const teto = conta.plano.armazenamento;
  if (semLimite(teto)) return;

  const usados = await bytesUsados(projeto.dono_id);
  if (usados + Number(bytes || 0) > teto) {
    throw new ErroDeAcesso(403, RECADOS.armazenamento(teto, usados));
  }
}
