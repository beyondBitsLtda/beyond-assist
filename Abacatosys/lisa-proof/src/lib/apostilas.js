// As apostilas no banco (06/11/2026): a aula completa de um assunto da trilha vira um caderno da
// categoria "apostila", ligado ao assunto. Uma por assunto: pedir de novo devolve a que já existe;
// "refazer" escreve outra e só então apaga a antiga.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { cardDeEstudo, checklistsDosCards, perfilDoQuadro } from "./estudo.js";
import { criarCaderno, exigirCaderno, cadernoParaTela } from "./cadernos.js";
import { temModelo } from "./ia.js";
import { escreverApostila } from "./iaApostila.js";
import { trechoDoAssunto, blocoDoTrecho } from "./leituras.js";
import { tituloDaApostila, paginasDaApostila } from "@/dominio/apostila.js";
import { uuidValido } from "@/dominio/cadernos.js";

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

const enderecoDaApostila = (id) => `/apostilas/${id}`;

/** A apostila que a pessoa já tem deste assunto (a mais nova), ou null. Não gasta IA. */
export async function apostilaDoAssunto(usuarioId, cardId) {
  if (!uuidValido(cardId)) throw new ErroDeAcesso(404, "assunto não encontrado");
  const { data, error } = await supabase.from("proof_vinculos")
    .select("caderno_id, criado_em, proof_cadernos!inner(id, titulo, categoria, atualizado_em)")
    .eq("usuario_id", usuarioId).eq("alvo_tipo", "assunto").eq("alvo_id", cardId).is("pagina_id", null)
    .eq("proof_cadernos.categoria", "apostila")
    .order("criado_em", { ascending: false }).limit(1);
  falhou(error, "apostila");
  const v = data?.[0];
  if (!v) return null;
  return { id: v.caderno_id, titulo: v.proof_cadernos.titulo, href: enderecoDaApostila(v.caderno_id), atualizadaEm: v.proof_cadernos.atualizado_em };
}

/**
 * O "modo aula": a Lisa escreve a aula completa do assunto (todos os pontos do checklist de teoria) e
 * ela vira uma apostila. Já existe e não pediu para refazer: devolve a que existe, sem gastar IA.
 */
export async function gerarApostila(usuarioId, cardId, { refazer = false } = {}) {
  const { card, quadro } = await cardDeEstudo(cardId, usuarioId);
  const existente = await apostilaDoAssunto(usuarioId, card.id);
  if (existente && !refazer) return { ...existente, nova: false };
  if (!temModelo()) throw new ErroDeAcesso(503, "a IA não está configurada neste servidor");

  const [{ data: trilha }, { data: etapa }, listas, trecho, perfil] = await Promise.all([
    supabase.from("proof_trilhas").select("id, tema").eq("quadro_id", quadro.id).eq("usuario_id", usuarioId).maybeSingle(),
    supabase.from("proof_etapas").select("objetivo, proof_trilhas!inner(usuario_id)").eq("card_id", card.id).eq("proof_trilhas.usuario_id", usuarioId).limit(1).maybeSingle(),
    checklistsDosCards([card.id]),
    trechoDoAssunto(card.id),
    perfilDoQuadro(quadro, usuarioId),
  ]);
  const pontos = (listas.get(card.id) || []).flatMap((c) => c.itens.map((i) => String(i.texto || "").trim())).filter(Boolean).slice(0, 12);
  const tema = trilha?.tema || quadro.tema || "";
  const assunto = { titulo: card.titulo, descricao: card.descricao || "", objetivo: etapa?.objetivo || "" };

  let aula;
  try {
    aula = await escreverApostila({ tema, assunto, pontos, trecho: blocoDoTrecho(trecho), perfil });
  } catch (e) {
    throw new ErroDeAcesso(502, e.message);
  }

  const paginas = paginasDaApostila(aula, { tema, assunto, pontos, trilhaId: trilha?.id, cardId: card.id });
  const { caderno } = await criarCaderno(usuarioId, {
    titulo: tituloDaApostila(card.titulo),
    descricao: `${tema ? `${tema} · ` : ""}a aula completa do assunto, com todos os pontos do checklist de teoria.`,
    icone: "📘",
    cor: "azul",
  }, { primeiraPagina: false, categoria: "apostila" });
  try {
    const { error: e1 } = await supabase.from("proof_caderno_paginas").insert(paginas.map((p, i) => ({
      caderno_id: caderno.id, tipo: "pagina", titulo: p.titulo, linguagem: "markdown", conteudo: p.conteudo, ordem: (i + 1) * 1024,
    })));
    falhou(e1, "páginas da apostila");
    const { error: e2 } = await supabase.from("proof_vinculos").insert({
      usuario_id: usuarioId, caderno_id: caderno.id, pagina_id: null, alvo_tipo: "assunto", alvo_id: card.id, rotulo: card.titulo.slice(0, 200),
    });
    falhou(e2, "vínculo da apostila");
  } catch (e) {
    await supabase.from("proof_cadernos").delete().eq("id", caderno.id); // nada de apostila pela metade
    throw e;
  }
  // refazer: a nova está gravada — agora a antiga sai (páginas e vínculos vão junto)
  if (existente && refazer) await supabase.from("proof_cadernos").delete().eq("id", existente.id).eq("usuario_id", usuarioId);
  return { id: caderno.id, titulo: caderno.titulo, href: enderecoDaApostila(caderno.id), secoes: paginas.length, nova: true };
}

/** A apostila inteira para ler: o caderno, as páginas com o conteúdo (na ordem) e de qual assunto ela é. */
export async function lerApostila(usuarioId, cadernoId) {
  const caderno = await exigirCaderno(usuarioId, cadernoId);
  const [{ data: paginas, error }, { data: vinculos, error: e2 }] = await Promise.all([
    supabase.from("proof_caderno_paginas").select("id, modulo_id, tipo, titulo, conteudo, ordem, criado_em")
      .eq("caderno_id", cadernoId).order("ordem"),
    supabase.from("proof_vinculos").select("alvo_tipo, alvo_id, rotulo").eq("caderno_id", cadernoId).is("pagina_id", null),
  ]);
  falhou(error, "páginas");
  falhou(e2, "vínculos");
  // a ordem de leitura: as páginas da raiz e, no lugar de cada módulo, as páginas dele
  const modulos = paginas.filter((p) => p.tipo === "modulo");
  const lista = [];
  for (const p of paginas) {
    if (p.tipo === "modulo") lista.push(...paginas.filter((x) => x.modulo_id === p.id && x.tipo === "pagina"));
    else if (!p.modulo_id || !modulos.some((m) => m.id === p.modulo_id)) lista.push(p);
  }
  const doAssunto = vinculos.find((v) => v.alvo_tipo === "assunto");
  let origem = null;
  if (doAssunto) {
    const { data: etapa } = await supabase.from("proof_etapas").select("trilha_id, proof_trilhas!inner(usuario_id, tema)")
      .eq("card_id", doAssunto.alvo_id).eq("proof_trilhas.usuario_id", usuarioId).limit(1).maybeSingle();
    origem = {
      assunto: doAssunto.rotulo,
      tema: etapa?.proof_trilhas?.tema || "",
      href: etapa ? `/trilhas/${etapa.trilha_id}?assunto=${doAssunto.alvo_id}` : null,
    };
  }
  return {
    caderno: cadernoParaTela(caderno),
    paginas: lista.map((p) => ({ id: p.id, titulo: p.titulo, conteudo: p.conteudo || "" })),
    origem,
  };
}
