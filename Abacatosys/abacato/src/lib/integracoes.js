// A porta das integrações: "este token abre qual quadro, e pode fazer o quê?".
//
// É o `exigir()` de quem não é pessoa. As rotas em /api/integracoes/ ficam fora do portão de
// sessão (ver LIVRES em abacatoAuth.js) justamente porque quem chama não tem cookie — e por
// isso TODA rota dali começa por aqui. Uma rota de integração que esquecesse de chamar
// `exigirIntegracao` seria uma rota aberta para a internet.

import { after } from "next/server";
import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./acesso.js";
import { hashDoToken, tokenDoCabecalho } from "@/dominio/integracao.js";

/**
 * `acao` é "ler" ou "criar". Lança 401 para token ausente, errado ou desligado — a MESMA
 * resposta para os três, pelo mesmo motivo do link público: distinguir diria a quem está
 * tentando se aquele token um dia existiu.
 */
export async function exigirIntegracao(req, acao) {
  const token = tokenDoCabecalho(req.headers.get("authorization"));
  if (!token) throw new ErroDeAcesso(401, "token de integração ausente ou inválido");

  const { data: integracao } = await supabase
    .from("abacato_integracoes")
    .select("id, nome, quadro_id, coluna_entrada_id, ativo")
    .eq("token_hash", await hashDoToken(token))
    .maybeSingle();
  if (!integracao || !integracao.ativo) throw new ErroDeAcesso(401, "token de integração ausente ou inválido");

  // O quadro arquivado leva a integração junto, como leva o link público.
  const { data: quadro } = await supabase
    .from("abacato_quadros").select("id, nome, arquivado").eq("id", integracao.quadro_id).maybeSingle();
  if (!quadro || quadro.arquivado) throw new ErroDeAcesso(404, "quadro da integração não está disponível");

  if (acao === "criar" && !integracao.coluna_entrada_id) {
    throw new ErroDeAcesso(403, "esta integração só lê: não tem coluna de entrada");
  }

  // "Quando foi usada pela última vez" responde se dá para desligar. Não pode atrasar a
  // resposta — e, no Worker, precisa do `after()` para não ser descartado (ver eventos.js).
  const marcar = () => supabase.from("abacato_integracoes")
    .update({ usado_em: new Date().toISOString() }).eq("id", integracao.id).then(() => {}, () => {});
  try { after(marcar); } catch { marcar(); }

  return { integracao, quadro };
}

/**
 * O quadro no formato que uma integração recebe.
 *
 * Entra: colunas, etiquetas, e de cada card o título, a descrição, as datas, as etiquetas e as
 * checklists — é onde o CRM guarda telefone, valor de proposta e metas, e é para isso que o
 * Beyond-Lead lê.
 *
 * NÃO entra: responsáveis, membros, e-mails de conta, links, anexos, comentários. Um sistema de
 * prospecção não precisa saber quem da equipe cuida de cada card, e o que não sai daqui não
 * vaza de lá.
 */
export async function quadroParaIntegracao(quadroId) {
  const { data: colunas, error } = await supabase
    .from("abacato_colunas").select("id, nome, posicao")
    .eq("quadro_id", quadroId).eq("arquivada", false).order("posicao");
  if (error) throw new ErroDeAcesso(500, error.message);

  const idsDeColuna = (colunas || []).map((c) => c.id);
  const [cards, etiquetas] = await Promise.all([
    idsDeColuna.length
      ? supabase.from("abacato_cards")
          .select("id, coluna_id, titulo, descricao, posicao, criado_em, inicio_em, fim_em, concluido, origem, origem_id")
          .in("coluna_id", idsDeColuna).eq("arquivado", false).order("posicao")
      : { data: [] },
    supabase.from("abacato_etiquetas").select("id, nome, cor").eq("quadro_id", quadroId),
  ]);

  const idsDeCard = (cards.data || []).map((c) => c.id);
  const [vinculos, checklists] = idsDeCard.length
    ? await Promise.all([
        supabase.from("abacato_card_etiquetas").select("card_id, etiqueta_id").in("card_id", idsDeCard),
        supabase.from("abacato_checklists").select("id, card_id, titulo, posicao").in("card_id", idsDeCard).order("posicao"),
      ])
    : [{ data: [] }, { data: [] }];

  const idsDeChecklist = (checklists.data || []).map((c) => c.id);
  const itens = idsDeChecklist.length
    ? (await supabase.from("abacato_checklist_itens")
        .select("checklist_id, texto, feito, posicao").in("checklist_id", idsDeChecklist).order("posicao")).data || []
    : [];

  const agrupar = (linhas, chave) => {
    const m = new Map();
    for (const l of linhas || []) {
      if (!m.has(l[chave])) m.set(l[chave], []);
      m.get(l[chave]).push(l);
    }
    return m;
  };
  const etiquetasDoCard = agrupar(vinculos.data, "card_id");
  const checklistsDoCard = agrupar(checklists.data, "card_id");
  const itensDaChecklist = agrupar(itens, "checklist_id");

  return {
    colunas: (colunas || []).map((c) => ({ id: c.id, nome: c.nome, posicao: c.posicao })),
    etiquetas: etiquetas.data || [],
    cards: (cards.data || []).map((c) => ({
      id: c.id,
      colunaId: c.coluna_id,
      titulo: c.titulo,
      descricao: c.descricao,
      posicao: c.posicao,
      criadoEm: c.criado_em,
      inicioEm: c.inicio_em,
      fimEm: c.fim_em,
      concluido: c.concluido,
      origem: c.origem,
      origemId: c.origem_id,
      etiquetas: (etiquetasDoCard.get(c.id) || []).map((v) => v.etiqueta_id),
      checklists: (checklistsDoCard.get(c.id) || []).map((cl) => ({
        titulo: cl.titulo,
        itens: (itensDaChecklist.get(cl.id) || []).map((i) => ({ texto: i.texto, feito: i.feito })),
      })),
    })),
  };
}
