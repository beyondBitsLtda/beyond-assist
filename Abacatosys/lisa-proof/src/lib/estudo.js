// O caminho único entre a Lisa_Proof e as tabelas do Abacato.
//
// A chave de serviço alcança o banco inteiro, então a pergunta "esta pessoa pode mexer nisto?"
// tem de ser feita em código. Ela é feita AQUI, uma vez: tudo que chega por id (item, card,
// trilha) sobe até o quadro e confere duas coisas — o quadro é desta pessoa (dono) e é um
// quadro de estudo (nome com STUDY). Quem não passa recebe 404, e não 403: dizer "existe, mas
// não é seu" já contaria que o id existe.
//
// Só o DONO alcança, e não os membros: a regra combinada foi "quadros criados pelo meu usuário".

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { ehQuadroDeEstudo, temaDo } from "@/dominio/estudo.js";
import { diaDe } from "@/dominio/datas.js";
import { PONTOS, chaveDoEvento, META_DIARIA_PADRAO } from "@/dominio/pontos.js";

const NAO_ACHEI = "não encontrado entre os seus quadros de estudo";

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

/**
 * `in (...)` em lotes. A lista de ids vai na URL do PostgREST, e cem uuids já são quatro
 * quilobytes: um quadro grande estouraria o limite de URL do caminho até o banco.
 */
export async function buscarEmLotes(tabela, campos, coluna, ids, ajustar = (q) => q) {
  const unicos = [...new Set(ids.filter(Boolean))];
  const linhas = [];
  for (let i = 0; i < unicos.length; i += 80) {
    const { data, error } = await ajustar(
      supabase.from(tabela).select(campos).in(coluna, unicos.slice(i, i + 80))
    );
    falhou(error, tabela);
    linhas.push(...(data || []));
  }
  return linhas;
}

/**
 * Todas as linhas de uma consulta, de mil em mil. O PostgREST corta em 1000 linhas sem avisar,
 * e a ofensiva de quem estuda há um ano passaria disso — o total de pontos sairia errado em
 * silêncio.
 */
export async function buscarTodas(montar) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar().range(de, de + 999);
    falhou(error, "consulta");
    linhas.push(...(data || []));
    if (!data || data.length < 1000) return linhas;
  }
}

export function baseDoAbacato() {
  return String(process.env.ABACATO_URL || "https://abacato.beyond.dev.br").replace(/\/+$/, "");
}

export function linkDoAbacato(quadroId, cardId) {
  const base = baseDoAbacato();
  return cardId ? `${base}/quadros/${quadroId}?card=${cardId}` : `${base}/quadros/${quadroId}`;
}

/** Marca o quadro como mexido, para ele subir na lista do Abacato. Nunca atrasa a resposta. */
function tocarQuadro(quadroId) {
  supabase.from("abacato_quadros").update({ atualizado_em: new Date().toISOString() }).eq("id", quadroId)
    .then(() => {}, () => {});
}

// ---------------------------------------------------------------- quadros

export async function quadrosDeEstudo(usuarioId) {
  const { data, error } = await supabase
    .from("abacato_quadros")
    .select("id, nome, descricao, criado_em")
    .eq("dono_id", usuarioId)
    .eq("arquivado", false)
    .ilike("nome", "study%");
  falhou(error, "quadros");
  // O `ilike` é o filtro grosso; a regra de verdade (STUDYING não vale) é a do domínio.
  return (data || [])
    .filter((q) => ehQuadroDeEstudo(q.nome))
    .map((q) => ({ ...q, tema: temaDo(q.nome) }))
    .sort((a, b) => a.tema.localeCompare(b.tema, "pt-BR"));
}

export async function quadroDeEstudo(quadroId, usuarioId) {
  const { data, error } = await supabase
    .from("abacato_quadros")
    .select("id, nome, dono_id, arquivado")
    .eq("id", quadroId)
    .maybeSingle();
  falhou(error, "quadro");
  if (!data || data.dono_id !== usuarioId || data.arquivado || !ehQuadroDeEstudo(data.nome)) {
    throw new ErroDeAcesso(404, `quadro ${NAO_ACHEI}`);
  }
  return { ...data, tema: temaDo(data.nome) };
}

/** Checklists (com itens) de vários cards de uma vez: `Map<cardId, checklist[]>`. */
export async function checklistsDosCards(cardIds) {
  const checklists = await buscarEmLotes(
    "abacato_checklists", "id, card_id, titulo, posicao", "card_id", cardIds
  );
  const itens = await buscarEmLotes(
    "abacato_checklist_itens", "id, checklist_id, texto, feito, posicao", "checklist_id", checklists.map((c) => c.id)
  );

  const itensPorChecklist = new Map();
  for (const i of itens.sort((a, b) => a.posicao - b.posicao)) {
    if (!itensPorChecklist.has(i.checklist_id)) itensPorChecklist.set(i.checklist_id, []);
    itensPorChecklist.get(i.checklist_id).push({ id: i.id, texto: i.texto, feito: Boolean(i.feito) });
  }

  const porCard = new Map();
  for (const c of checklists.sort((a, b) => a.posicao - b.posicao)) {
    if (!porCard.has(c.card_id)) porCard.set(c.card_id, []);
    porCard.get(c.card_id).push({ id: c.id, titulo: c.titulo, itens: itensPorChecklist.get(c.id) || [] });
  }
  return porCard;
}

export function contarItens(checklists = []) {
  const itens = checklists.flatMap((c) => c.itens);
  return { total: itens.length, feitos: itens.filter((i) => i.feito).length };
}

/**
 * Os assuntos de um quadro: cards não arquivados, em colunas não arquivadas, com as checklists.
 * Cada card leva a posição da coluna, que é o que a ordem padrão da trilha usa.
 */
export async function conteudoDoQuadro(quadroId) {
  const { data: colunas, error } = await supabase
    .from("abacato_colunas")
    .select("id, nome, posicao")
    .eq("quadro_id", quadroId)
    .eq("arquivada", false);
  falhou(error, "colunas");
  if (!colunas?.length) return [];

  const colunaPorId = new Map(colunas.map((c) => [c.id, c]));
  const cards = await buscarEmLotes(
    "abacato_cards",
    "id, coluna_id, titulo, descricao, posicao, concluido, recorrencia_regra",
    "coluna_id",
    colunas.map((c) => c.id),
    (q) => q.eq("arquivado", false)
  );
  const checklists = await checklistsDosCards(cards.map((c) => c.id));

  return cards.map((c) => {
    const lista = checklists.get(c.id) || [];
    const { total, feitos } = contarItens(lista);
    const coluna = colunaPorId.get(c.coluna_id);
    return {
      id: c.id,
      titulo: c.titulo,
      descricao: c.descricao || "",
      concluido: Boolean(c.concluido),
      recorrente: Boolean(c.recorrencia_regra),
      colunaNome: coluna?.nome || "",
      colunaPosicao: Number(coluna?.posicao) || 0,
      posicao: Number(c.posicao) || 0,
      checklists: lista,
      totalItens: total,
      feitos,
    };
  });
}

// ---------------------------------------------------------------- subir até o quadro

export async function cardDeEstudo(cardId, usuarioId) {
  const { data: card, error } = await supabase
    .from("abacato_cards")
    .select("id, coluna_id, titulo, descricao, concluido, arquivado, recorrencia_regra")
    .eq("id", cardId)
    .maybeSingle();
  falhou(error, "card");
  if (!card || card.arquivado) throw new ErroDeAcesso(404, `assunto ${NAO_ACHEI}`);

  const { data: coluna, error: e2 } = await supabase
    .from("abacato_colunas").select("id, quadro_id").eq("id", card.coluna_id).maybeSingle();
  falhou(e2, "coluna");
  if (!coluna) throw new ErroDeAcesso(404, `assunto ${NAO_ACHEI}`);

  const quadro = await quadroDeEstudo(coluna.quadro_id, usuarioId);
  return { card, quadro };
}

export async function itemDeEstudo(itemId, usuarioId) {
  const { data: item, error } = await supabase
    .from("abacato_checklist_itens").select("id, checklist_id, texto, feito").eq("id", itemId).maybeSingle();
  falhou(error, "item");
  if (!item) throw new ErroDeAcesso(404, `tarefa ${NAO_ACHEI}`);

  const { data: checklist, error: e2 } = await supabase
    .from("abacato_checklists").select("id, card_id").eq("id", item.checklist_id).maybeSingle();
  falhou(e2, "checklist");
  if (!checklist) throw new ErroDeAcesso(404, `tarefa ${NAO_ACHEI}`);

  const { card, quadro } = await cardDeEstudo(checklist.card_id, usuarioId);
  return { item, card, quadro };
}

export async function trilhaDoUsuario(trilhaId, usuarioId) {
  const { data, error } = await supabase
    .from("proof_trilhas").select("*").eq("id", trilhaId).eq("usuario_id", usuarioId).maybeSingle();
  falhou(error, "trilha");
  if (!data) throw new ErroDeAcesso(404, "trilha não encontrada");
  return data;
}

async function idDaTrilhaDoQuadro(quadroId, usuarioId) {
  const { data } = await supabase
    .from("proof_trilhas").select("id").eq("quadro_id", quadroId).eq("usuario_id", usuarioId).maybeSingle();
  return data?.id || null;
}

// ---------------------------------------------------------------- pontos

export async function perfilDe(usuarioId) {
  const { data } = await supabase.from("proof_perfis").select("meta_diaria").eq("usuario_id", usuarioId).maybeSingle();
  return { metaDiaria: data?.meta_diaria || META_DIARIA_PADRAO };
}

/** Grava um evento que vale ponto. Devolve os pontos ganhos AGORA — zero se a mesma `chave`
 *  já tinha pontuado antes (o `on conflict do nothing` não devolve linha). */
export async function registrarEvento({ usuarioId, trilhaId, tipo, chave, pontos, detalhe = {} }) {
  const { data, error } = await supabase
    .from("proof_eventos")
    .upsert(
      { usuario_id: usuarioId, trilha_id: trilhaId || null, tipo, chave, pontos, dia: diaDe(), detalhe },
      { onConflict: "usuario_id,chave", ignoreDuplicates: true }
    )
    .select("id");
  falhou(error, "pontos");
  return data?.length ? pontos : 0;
}

/**
 * Desmarcou: o ponto sai só se foi ganho HOJE. Um ponto de outro dia é história — tirá-lo
 * poderia apagar o único evento daquele dia e quebrar retroativamente uma ofensiva que existiu.
 */
async function desfazerEventoDeHoje(usuarioId, chave) {
  const { data, error } = await supabase
    .from("proof_eventos").delete()
    .eq("usuario_id", usuarioId).eq("chave", chave).eq("dia", diaDe())
    .select("pontos");
  falhou(error, "pontos");
  return -(data || []).reduce((s, e) => s + e.pontos, 0);
}

/**
 * Para o que pode ser refeito (exercício, projeto): pontua na primeira vez e, nas seguintes, só
 * sobe — vale a MELHOR nota. Devolve a diferença ganha agora. O dia do evento continua o da
 * primeira entrega: reenviar não pode servir para salvar a ofensiva de hoje.
 */
export async function registrarOuMelhorar({ usuarioId, trilhaId, tipo, chave, pontos, detalhe = {} }) {
  const ganho = await registrarEvento({ usuarioId, trilhaId, tipo, chave, pontos, detalhe });
  if (ganho) return ganho;
  const { data } = await supabase
    .from("proof_eventos").select("id, pontos").eq("usuario_id", usuarioId).eq("chave", chave).maybeSingle();
  if (!data || pontos <= data.pontos) return 0;
  const { error } = await supabase.from("proof_eventos").update({ pontos, detalhe }).eq("id", data.id);
  falhou(error, "pontos");
  return pontos - data.pontos;
}

/** Bateu a meta do dia agora? Então ganha o bônus — uma vez por dia. */
export async function conferirMetaDiaria(usuarioId, trilhaId) {
  const hoje = diaDe();
  const [{ data: eventos }, perfil] = await Promise.all([
    supabase.from("proof_eventos").select("tipo, pontos").eq("usuario_id", usuarioId).eq("dia", hoje),
    perfilDe(usuarioId),
  ]);
  const lista = eventos || [];
  if (lista.some((e) => e.tipo === "meta_diaria")) return 0;
  const soma = lista.reduce((s, e) => s + e.pontos, 0);
  if (soma < perfil.metaDiaria) return 0;
  return registrarEvento({
    usuarioId, trilhaId, tipo: "meta_diaria", chave: chaveDoEvento.meta(hoje),
    pontos: PONTOS.meta_diaria, detalhe: { meta: perfil.metaDiaria },
  });
}

// ---------------------------------------------------------------- marcar

/**
 * O card acompanha os itens: todos marcados → concluído (e bônus); algum desmarcado → reaberto.
 *
 * Card RECORRENTE fica de fora: no Abacato, concluí-lo arquiva uma cópia e reabre o card com a
 * próxima data (src/lib/cardRecorrente.js de lá). Repetir essa lógica aqui seria ter duas
 * versões dela; marcar `concluido` direto pularia o ciclo. Quem conclui recorrente é o Abacato.
 */
async function sincronizarConclusao({ usuarioId, card, trilhaId }) {
  if (card.recorrencia_regra) return { concluido: Boolean(card.concluido), pontos: 0 };
  const { total, feitos } = contarItens((await checklistsDosCards([card.id])).get(card.id) || []);
  if (!total) return { concluido: Boolean(card.concluido), pontos: 0 };

  const completo = feitos === total;
  if (completo === Boolean(card.concluido)) return { concluido: completo, pontos: 0 };

  const { error } = await supabase.from("abacato_cards").update({ concluido: completo }).eq("id", card.id);
  falhou(error, "card");

  const chave = chaveDoEvento.card(card.id);
  const pontos = completo
    ? await registrarEvento({ usuarioId, trilhaId, tipo: "card", chave, pontos: PONTOS.card, detalhe: { titulo: card.titulo } })
    : await desfazerEventoDeHoje(usuarioId, chave);
  return { concluido: completo, pontos };
}

export async function marcarItem({ usuarioId, itemId, feito }) {
  const { item, card, quadro } = await itemDeEstudo(itemId, usuarioId);
  const trilhaId = await idDaTrilhaDoQuadro(quadro.id, usuarioId);

  const { error } = await supabase.from("abacato_checklist_itens").update({ feito }).eq("id", item.id);
  falhou(error, "item");

  const chave = chaveDoEvento.item(item.id);
  let pontos = feito
    ? await registrarEvento({
        usuarioId, trilhaId, tipo: "item", chave, pontos: PONTOS.item,
        detalhe: { texto: item.texto, titulo: card.titulo },
      })
    : await desfazerEventoDeHoje(usuarioId, chave);

  const conclusao = await sincronizarConclusao({ usuarioId, card, trilhaId });
  pontos += conclusao.pontos;
  const bonus = feito ? await conferirMetaDiaria(usuarioId, trilhaId) : 0;
  tocarQuadro(quadro.id);

  return { feito, cardConcluido: conclusao.concluido, pontos: pontos + bonus, metaBatida: bonus > 0 };
}

/** Concluir à mão vale só para assunto SEM tarefas — com tarefas, ele conclui sozinho. */
export async function marcarCard({ usuarioId, cardId, concluido }) {
  const { card, quadro } = await cardDeEstudo(cardId, usuarioId);
  if (card.recorrencia_regra) {
    throw new ErroDeAcesso(400, "este card é recorrente no Abacato — conclua por lá para o ciclo seguir");
  }
  const { total } = contarItens((await checklistsDosCards([card.id])).get(card.id) || []);
  if (total) throw new ErroDeAcesso(400, "este assunto tem tarefas: ele é concluído quando todas forem marcadas");

  const trilhaId = await idDaTrilhaDoQuadro(quadro.id, usuarioId);
  const { error } = await supabase.from("abacato_cards").update({ concluido }).eq("id", card.id);
  falhou(error, "card");

  const chave = chaveDoEvento.card(card.id);
  let pontos = concluido
    ? await registrarEvento({ usuarioId, trilhaId, tipo: "card", chave, pontos: PONTOS.card, detalhe: { titulo: card.titulo } })
    : await desfazerEventoDeHoje(usuarioId, chave);
  const bonus = concluido ? await conferirMetaDiaria(usuarioId, trilhaId) : 0;
  pontos += bonus;
  tocarQuadro(quadro.id);
  return { cardConcluido: concluido, pontos, metaBatida: bonus > 0 };
}

// ---------------------------------------------------------------- escrever no quadro

/**
 * Grava no card a checklist de teoria que a IA montou.
 *
 * `origem = 'proof'` com `origem_id = 'teoria:<card>'` usa o índice único (origem, origem_id)
 * que o Abacato já tem: pedir duas vezes não cria duas checklists, mesmo com dois cliques
 * simultâneos.
 */
export async function gravarChecklistDeTeoria(card, itens) {
  const origemId = `teoria:${card.id}`;
  const { data: existente } = await supabase
    .from("abacato_checklists").select("id").eq("origem", "proof").eq("origem_id", origemId).maybeSingle();
  if (existente) throw new ErroDeAcesso(409, "a Lisa já montou as tarefas deste assunto");

  const { data: outras } = await supabase.from("abacato_checklists").select("posicao").eq("card_id", card.id);
  const posicao = Math.max(0, ...(outras || []).map((c) => Number(c.posicao) || 0)) + 1000;

  const { data: checklist, error } = await supabase
    .from("abacato_checklists")
    .insert({ card_id: card.id, titulo: "Teoria (Lisa_Proof)", posicao, origem: "proof", origem_id: origemId })
    .select("id")
    .single();
  if (error?.code === "23505") throw new ErroDeAcesso(409, "a Lisa já montou as tarefas deste assunto");
  falhou(error, "checklist");

  const { error: e2 } = await supabase.from("abacato_checklist_itens").insert(
    itens.map((texto, i) => ({
      checklist_id: checklist.id, texto, feito: false, posicao: (i + 1) * 1000,
      origem: "proof", origem_id: `${origemId}:${i + 1}`,
    }))
  );
  if (e2) {
    // Checklist sem itens no quadro é lixo visível; melhor desfazer e deixar pedir de novo.
    await supabase.from("abacato_checklists").delete().eq("id", checklist.id);
    falhou(e2, "itens");
  }
  return checklist.id;
}
