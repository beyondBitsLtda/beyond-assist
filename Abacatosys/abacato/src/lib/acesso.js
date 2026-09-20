// Quem está pedindo, e o que essa pessoa pode mexer.
//
// Toda rota que altera alguma coisa passa por aqui. O motivo é simples: um card não carrega
// consigo quem pode editá-lo — isso depende do quadro em que ele está, três tabelas acima. Se
// cada rota descobrisse esse caminho por conta própria, bastaria UMA esquecer a subida para o
// sistema inteiro ter um buraco, e seria a rota menos usada, que ninguém testa.
//
// Aqui a subida existe uma vez só. As rotas dizem "me dá esse card se eu puder editar" e não
// têm como perguntar errado.

import { supabase } from "./supabase.js";
import { COOKIE_SESSAO, lerSessao } from "./abacatoAuth.js";
import { Quadro, poderesDo } from "@/dominio/Quadro.js";
import { json } from "./http.js";

/** Quem está pedindo, lido do cookie assinado. O middleware já barrou quem não tem sessão —
 *  isto é para descobrir o ID, não para decidir se entra. */
export async function quemEh(req) {
  const cookie = req.headers.get("cookie") || "";
  const valor = cookie
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(COOKIE_SESSAO + "="))
    ?.slice(COOKIE_SESSAO.length + 1);
  const sessao = await lerSessao(valor, process.env.ABACATO_SESSAO_SECRET);
  return sessao.ok ? sessao.usuario : null;
}

/** Erro com status HTTP embutido. As rotas fazem `catch (e) { return respostaDeErro(e) }` e
 *  não precisam distinguir "não achei" de "não pode" no meio da lógica. */
export class ErroDeAcesso extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

/** Traduz qualquer erro numa resposta. O que não for ErroDeAcesso vira 500 com a mensagem —
 *  um sistema interno de cinco pessoas ganha mais em ver o erro do que em escondê-lo. */
export function respostaDeErro(e) {
  const status = e instanceof ErroDeAcesso ? e.status : 500;
  return json({ ok: false, error: e.message || "erro" }, status);
}

// ---------------------------------------------------------------- carregar o quadro inteiro

// Todas as tabelas de um quadro numa consulta só por nível. O PostgREST aninha, mas aninhar
// cinco níveis (quadro > coluna > card > checklist > item) gera um SQL que o Postgres resolve
// mal; seis consultas paralelas por chave estrangeira indexada saem mais rápidas e são muito
// mais fáceis de ler quando alguma vier errada.
const CAMPOS_CARD =
  "id, coluna_id, titulo, descricao, posicao, inicio_em, fim_em, capa, arquivado, concluido, recorrencia_regra, origem, origem_id";

/**
 * O quadro inteiro, montado como objetos de domínio.
 *
 * Devolve `{ quadro, papel, poderes, cru }`. O `cru` são as linhas como vieram do banco, para
 * quem precisa devolver JSON ao navegador sem desmontar as classes de novo.
 */
export async function carregarQuadro(quadroId, usuarioId) {
  const { data: linha, error } = await supabase
    .from("abacato_quadros")
    .select("id, nome, descricao, papel_de_parede, dono_id, arquivado, criado_em")
    .eq("id", quadroId)
    .maybeSingle();

  if (error) throw new ErroDeAcesso(500, error.message);
  if (!linha) throw new ErroDeAcesso(404, "quadro não encontrado");

  const { data: membros } = await supabase
    .from("abacato_membros")
    .select("usuario_id, papel, abacato_usuarios ( id, nome, email )")
    .eq("quadro_id", quadroId);

  const quadroParcial = new Quadro({
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    papelDeParede: linha.papel_de_parede,
    donoId: linha.dono_id,
    arquivado: linha.arquivado,
    membros: membros || [],
  });

  const papel = quadroParcial.papelDe(usuarioId);
  // Sem papel nenhum o quadro é 404, e não 403. Dizer "existe, mas não é seu" confirma a
  // existência de um quadro alheio para quem só tinha um palpite de URL.
  if (!papel) throw new ErroDeAcesso(404, "quadro não encontrado");

  const { data: colunas } = await supabase
    .from("abacato_colunas")
    .select("id, nome, posicao, capa, arquivada")
    .eq("quadro_id", quadroId)
    .eq("arquivada", false)
    .order("posicao");

  const idsDeColuna = (colunas || []).map((c) => c.id);
  const semColunas = idsDeColuna.length === 0;

  const [cards, etiquetas] = await Promise.all([
    semColunas
      ? { data: [] }
      : supabase.from("abacato_cards").select(CAMPOS_CARD)
          .in("coluna_id", idsDeColuna).eq("arquivado", false).order("posicao"),
    supabase.from("abacato_etiquetas").select("id, nome, cor").eq("quadro_id", quadroId),
  ]);

  const idsDeCard = (cards.data || []).map((c) => c.id);
  const semCards = idsDeCard.length === 0;

  const [porCard, responsaveis, checklists, links] = await Promise.all([
    semCards ? { data: [] } : supabase.from("abacato_card_etiquetas").select("card_id, etiqueta_id").in("card_id", idsDeCard),
    semCards ? { data: [] } : supabase.from("abacato_card_responsaveis").select("card_id, abacato_usuarios ( id, nome, email )").in("card_id", idsDeCard),
    semCards ? { data: [] } : supabase.from("abacato_checklists").select("id, card_id, titulo, posicao").in("card_id", idsDeCard).order("posicao"),
    semCards ? { data: [] } : supabase.from("abacato_links").select("id, card_id, url, titulo").in("card_id", idsDeCard),
  ]);

  const idsDeChecklist = (checklists.data || []).map((c) => c.id);
  const itens = idsDeChecklist.length
    ? (await supabase.from("abacato_checklist_itens").select("id, checklist_id, texto, feito, posicao").in("checklist_id", idsDeChecklist).order("posicao")).data || []
    : [];

  // Agrupamentos. Um Map por chave estrangeira evita o `.filter()` dentro do laço, que é o
  // jeito discreto de um quadro com 400 cards virar 400 varreduras de lista.
  const agrupar = (linhas, chave) => {
    const m = new Map();
    for (const l of linhas || []) {
      if (!m.has(l[chave])) m.set(l[chave], []);
      m.get(l[chave]).push(l);
    }
    return m;
  };

  const etiquetaPorId = new Map((etiquetas.data || []).map((e) => [e.id, e]));
  const etiquetasDoCard = agrupar(porCard.data, "card_id");
  const responsaveisDoCard = agrupar(responsaveis.data, "card_id");
  const checklistsDoCard = agrupar(checklists.data, "card_id");
  const linksDoCard = agrupar(links.data, "card_id");
  const itensDaChecklist = agrupar(itens, "checklist_id");
  const cardsDaColuna = agrupar(cards.data, "coluna_id");

  const montarCard = (c) => ({
    id: c.id,
    colunaId: c.coluna_id,
    titulo: c.titulo,
    descricao: c.descricao,
    posicao: c.posicao,
    inicioEm: c.inicio_em,
    fimEm: c.fim_em,
    capa: c.capa,
    arquivado: c.arquivado,
    concluido: c.concluido,
    recorrenciaRegra: c.recorrencia_regra,
    origem: c.origem,
    origemId: c.origem_id,
    etiquetas: (etiquetasDoCard.get(c.id) || []).map((x) => etiquetaPorId.get(x.etiqueta_id)).filter(Boolean),
    responsaveis: (responsaveisDoCard.get(c.id) || []).map((x) => x.abacato_usuarios).filter(Boolean),
    links: linksDoCard.get(c.id) || [],
    checklists: (checklistsDoCard.get(c.id) || []).map((cl) => ({
      id: cl.id,
      titulo: cl.titulo,
      posicao: cl.posicao,
      itens: itensDaChecklist.get(cl.id) || [],
    })),
  });

  const colunasMontadas = (colunas || []).map((col) => ({
    id: col.id,
    nome: col.nome,
    posicao: col.posicao,
    capa: col.capa,
    cards: (cardsDaColuna.get(col.id) || []).map(montarCard),
  }));

  const quadro = new Quadro({
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    papelDeParede: linha.papel_de_parede,
    donoId: linha.dono_id,
    arquivado: linha.arquivado,
    membros: membros || [],
    etiquetas: etiquetas.data || [],
    colunas: colunasMontadas,
  });

  // Quem pode ser posto como responsável. O DONO entra aqui mesmo sem linha na tabela de
  // membros — ele é dono pelo `dono_id`, e num quadro de uma pessoa só ele é a única pessoa
  // existente. Sem isto, você não conseguiria atribuir um card a si mesmo no próprio quadro.
  const { data: dono } = await supabase
    .from("abacato_usuarios").select("id, nome, email").eq("id", linha.dono_id).maybeSingle();

  const pessoas = [];
  const vistos = new Set();
  for (const p of [dono, ...(membros || []).map((m) => m.abacato_usuarios)]) {
    if (!p || vistos.has(p.id)) continue;
    vistos.add(p.id);
    pessoas.push(p);
  }

  return {
    quadro,
    papel,
    poderes: poderesDo(papel),
    cru: {
      id: linha.id,
      nome: linha.nome,
      descricao: linha.descricao,
      papelDeParede: linha.papel_de_parede,
      donoId: linha.dono_id,
      colunas: colunasMontadas,
      etiquetas: etiquetas.data || [],
      membros: pessoas,
    },
  };
}

// ---------------------------------------------------------------- subir do filho ao quadro

/** Dado um card, qual quadro é o dele. Uma consulta com dois saltos, e não três idas ao banco. */
async function quadroDoCard(cardId) {
  const { data } = await supabase
    .from("abacato_cards")
    .select("id, coluna_id, abacato_colunas ( id, quadro_id )")
    .eq("id", cardId)
    .maybeSingle();
  if (!data) throw new ErroDeAcesso(404, "card não encontrado");
  return { quadroId: data.abacato_colunas.quadro_id, colunaId: data.coluna_id };
}

async function quadroDaColuna(colunaId) {
  const { data } = await supabase.from("abacato_colunas").select("id, quadro_id").eq("id", colunaId).maybeSingle();
  if (!data) throw new ErroDeAcesso(404, "coluna não encontrada");
  return { quadroId: data.quadro_id };
}

async function quadroDaChecklist(checklistId) {
  const { data } = await supabase
    .from("abacato_checklists")
    .select("id, card_id, abacato_cards ( id, abacato_colunas ( quadro_id ) )")
    .eq("id", checklistId)
    .maybeSingle();
  if (!data) throw new ErroDeAcesso(404, "checklist não encontrada");
  return { quadroId: data.abacato_cards.abacato_colunas.quadro_id, cardId: data.card_id };
}

async function quadroDoItem(itemId) {
  const { data } = await supabase
    .from("abacato_checklist_itens")
    .select("id, checklist_id, abacato_checklists ( card_id, abacato_cards ( abacato_colunas ( quadro_id ) ) )")
    .eq("id", itemId)
    .maybeSingle();
  if (!data) throw new ErroDeAcesso(404, "item não encontrado");
  return {
    quadroId: data.abacato_checklists.abacato_cards.abacato_colunas.quadro_id,
    cardId: data.abacato_checklists.card_id,
  };
}

// ------------------------------------------- subir do filho ao PROJETO de documentacao

async function projetoDaPasta(pastaId) {
  const { data } = await supabase.from("abacato_pastas").select("id, projeto_id").eq("id", pastaId).maybeSingle();
  if (!data) throw new ErroDeAcesso(404, "pasta não encontrada");
  return { projetoId: data.projeto_id };
}

async function projetoDoDocumento(documentoId) {
  const { data } = await supabase
    .from("abacato_documentos").select("id, projeto_id, pasta_id").eq("id", documentoId).maybeSingle();
  if (!data) throw new ErroDeAcesso(404, "documento não encontrado");
  return { projetoId: data.projeto_id, pastaId: data.pasta_id };
}

async function projetoDaRevisao(revisaoId) {
  const { data } = await supabase
    .from("abacato_revisoes")
    .select("id, documento_id, abacato_documentos ( projeto_id )")
    .eq("id", revisaoId).maybeSingle();
  if (!data) throw new ErroDeAcesso(404, "revisão não encontrada");
  return { projetoId: data.abacato_documentos.projeto_id, documentoId: data.documento_id };
}

/** De que tabela o id veio → como chegar ao dono dele.
 *
 *  Duas famílias moram neste mapa: o que pertence a um QUADRO e o que pertence a um PROJETO de
 *  documentação. Cada entrada devolve `quadroId` ou `projetoId`, e o `exigir` sabe em qual
 *  tabela procurar o dono a partir disso. Um segundo `exigir` só para documentos seria a
 *  segunda cópia da regra de permissão — e a segunda cópia é sempre a que fica desatualizada. */
const SUBIDAS = {
  projeto: async (id) => ({ projetoId: id }),
  pasta: projetoDaPasta,
  documento: projetoDoDocumento,
  revisao: projetoDaRevisao,
  quadro: async (id) => ({ quadroId: id }),
  coluna: quadroDaColuna,
  card: quadroDoCard,
  etiqueta: async (id) => {
    const { data } = await supabase.from("abacato_etiquetas").select("quadro_id").eq("id", id).maybeSingle();
    if (!data) throw new ErroDeAcesso(404, "etiqueta não encontrada");
    return { quadroId: data.quadro_id };
  },
  checklist: quadroDaChecklist,
  item: quadroDoItem,
  recorrencia: async (id) => {
    const { data } = await supabase
      .from("abacato_recorrencias")
      .select("coluna_id, abacato_colunas ( quadro_id )")
      .eq("id", id).maybeSingle();
    if (!data) throw new ErroDeAcesso(404, "tarefa recorrente não encontrada");
    return { quadroId: data.abacato_colunas.quadro_id, colunaId: data.coluna_id };
  },
  link: async (id) => {
    const { data } = await supabase
      .from("abacato_links")
      .select("card_id, abacato_cards ( abacato_colunas ( quadro_id ) )")
      .eq("id", id).maybeSingle();
    if (!data) throw new ErroDeAcesso(404, "link não encontrado");
    return { quadroId: data.abacato_cards.abacato_colunas.quadro_id, cardId: data.card_id };
  },
};

/**
 * A porta única: "sou eu, quero mexer nisto, posso?".
 *
 * `tipo` é de que tabela o id veio, `acao` é um dos poderes (ver, editar, criar, apagar,
 * convidar). Lança se não puder — a rota que chamar não precisa lembrar de conferir nada.
 *
 * Para não carregar o quadro inteiro (com todos os cards) a cada clique num checkbox de
 * checklist, esta função busca só o necessário para decidir: dono e membros.
 */
export async function exigir(req, tipo, id, acao) {
  const usuario = await quemEh(req);
  if (!usuario) throw new ErroDeAcesso(401, "sem sessão");

  const subir = SUBIDAS[tipo];
  if (!subir) throw new ErroDeAcesso(500, `tipo desconhecido: ${tipo}`);
  const alvo = await subir(id);

  // Quadro ou projeto: a pergunta é a mesma ("quem é o dono, e eu sou membro?"), só muda em
  // que tabela ela é feita.
  const ehProjeto = alvo.projetoId != null;
  const tabela = ehProjeto ? "abacato_projetos" : "abacato_quadros";
  const tabelaDeMembros = ehProjeto ? "abacato_projeto_membros" : "abacato_membros";
  const coluna = ehProjeto ? "projeto_id" : "quadro_id";
  const donoDe = ehProjeto ? alvo.projetoId : alvo.quadroId;

  const { data: raiz } = await supabase
    .from(tabela).select("id, dono_id, arquivado").eq("id", donoDe).maybeSingle();
  if (!raiz) throw new ErroDeAcesso(404, ehProjeto ? "projeto não encontrado" : "quadro não encontrado");

  let papel = raiz.dono_id === usuario.id ? "dono" : null;
  if (!papel) {
    const { data: membro } = await supabase
      .from(tabelaDeMembros).select("papel")
      .eq(coluna, raiz.id).eq("usuario_id", usuario.id)
      .maybeSingle();
    papel = membro?.papel || null;
  }
  if (!papel) throw new ErroDeAcesso(404, "não encontrado");

  const poderes = poderesDo(papel);
  if (!poderes[acao]) throw new ErroDeAcesso(403, `seu papel (${papel}) não permite ${acao}`);

  return { usuario, papel, poderes, quadroId: ehProjeto ? null : raiz.id, projetoId: ehProjeto ? raiz.id : null, ...alvo };
}

/** Marca o quadro como tocado agora. Serve à ordenação da lista de quadros e, mais para
 *  frente, ao "o que mudou desde ontem" que a Lisa vai perguntar. */
export async function tocarQuadro(quadroId) {
  await supabase.from("abacato_quadros").update({ atualizado_em: new Date().toISOString() }).eq("id", quadroId);
}
