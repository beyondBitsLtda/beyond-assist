// A Lisa jogadora no banco (BEYOND-0014): a conta dela, o diário do que ela fez e o que a página pública
// /lisa mostra para todo mundo. As decisões (o que fazer, quanto acertar) moram em src/dominio/lisaJogadora.js;
// quem joga é scripts/lisa-joga.mjs, no relógio do iMac.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { saldoDoUsuario } from "./reino.js";
import { CONTA_DA_LISA } from "@/dominio/lisaJogadora.js";
import { diaDe } from "@/dominio/datas.js";
import { calcularOfensiva } from "@/dominio/ofensiva.js";

const falhou = (error, onde) => { if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`); };

/** O id da conta dela, ou null se ainda não foi criada. */
/** Só o domínio de um link (youtube.com, pt.wikipedia.org): de onde veio a sugestão, sem expor o link antes da aprovação. */
const dominioDe = (link) => { try { return new URL(link).hostname.replace(/^www\./, ""); } catch { return null; } };

export async function idDaLisa() {
  const { data, error } = await supabase.from("abacato_usuarios").select("id").ilike("email", CONTA_DA_LISA.email).maybeSingle();
  falhou(error, "conta da Lisa");
  return data?.id || null;
}

/** Uma linha no diário dela: o que fez, numa frase, e os detalhes (a nota, o tema, o que comprou). */
export async function registrarNoDiario(usuarioId, acao, resumo, detalhe = {}) {
  const { error } = await supabase.from("proof_lisa_diario").insert({
    usuario_id: usuarioId, dia: diaDe(), acao, resumo: String(resumo).slice(0, 400), detalhe,
  });
  falhou(error, "diário da Lisa");
}

/** O que ela já fez (ou tentou) hoje, com quantas vezes e quando foi a última — para a agenda repetir no dia. */
export async function jogadasDeHoje(usuarioId) {
  const { data, error } = await supabase.from("proof_lisa_diario").select("acao, criado_em").eq("usuario_id", usuarioId).eq("dia", diaDe());
  falhou(error, "diário de hoje");
  const jogadas = {};
  for (const d of data || []) {
    const j = jogadas[d.acao] || (jogadas[d.acao] = { vezes: 0, ultima: 0 });
    j.vezes += 1;
    j.ultima = Math.max(j.ultima, new Date(d.criado_em).getTime());
  }
  return jogadas;
}

/** As ações que ela já fez (ou tentou) hoje — tentar conta: o relógio não insiste de hora em hora. */
export async function feitoHoje(usuarioId) {
  const { data, error } = await supabase.from("proof_lisa_diario").select("acao").eq("usuario_id", usuarioId).eq("dia", diaDe());
  falhou(error, "diário de hoje");
  return [...new Set((data || []).map((d) => d.acao))];
}

/**
 * Tudo o que ela faz, para todos verem (BEYOND-0014: "o reino dela deve ser visível para todos, como tudo
 * que ela faz: cursos, atividades, o raio-x, ofensiva, moedas, o que comprou"). Só dados DELA.
 */
export async function perfilDaLisa() {
  const id = await idDaLisa();
  if (!id) return { existe: false };
  const hoje = diaDe();
  const [reino, saldo, trilhas, eventos, desafios, posicoes, cadernos, acervo, diario, total] = await Promise.all([
    supabase.from("proof_reinos").select("nome, neuro_nivel, construcoes, trofeus").eq("usuario_id", id).maybeSingle(),
    saldoDoUsuario(id).catch(() => null),
    supabase.from("proof_trilhas").select("id, tema, inicio_em, status").eq("usuario_id", id).order("inicio_em", { ascending: false }).limit(12),
    supabase.from("proof_eventos").select("dia, pontos").eq("usuario_id", id).gte("dia", "2000-01-01").limit(5000),
    supabase.from("proof_desafios").select("tipo, titulo, nota, status, periodo").eq("usuario_id", id).order("periodo", { ascending: false }).limit(40),
    supabase.from("proof_bolsa_posicoes").select("acao_id, quantidade, custo").eq("usuario_id", id).gt("quantidade", 0),
    supabase.from("proof_cadernos").select("id, titulo, icone, criado_em").eq("usuario_id", id).order("criado_em", { ascending: false }).limit(12),
    supabase.from("proof_acervo").select("titulo, tipo, link, status, criado_em").eq("autor_id", id).order("criado_em", { ascending: false }).limit(12),
    supabase.from("proof_lisa_diario").select("acao, resumo, criado_em").eq("usuario_id", id).order("criado_em", { ascending: false }).limit(40),
    supabase.from("proof_ranking_total").select("pontos").eq("usuario_id", id).maybeSingle(),
  ]);
  for (const [r, onde] of [[reino, "reino"], [trilhas, "trilhas"], [eventos, "eventos"], [desafios, "desafios"], [posicoes, "bolsa"], [cadernos, "cadernos"], [acervo, "acervo"], [diario, "diário"]]) falhou(r.error, onde);

  const notas = (tipo) => (desafios.data || []).filter((d) => d.tipo === tipo && d.nota != null).map((d) => Number(d.nota));
  const media = (l) => (l.length ? Math.round(l.reduce((s, n) => s + n, 0) / l.length) : null);
  return {
    existe: true,
    nome: CONTA_DA_LISA.apelido,
    reino: reino.data ? { nome: reino.data.nome, neuro: reino.data.neuro_nivel, construcoes: reino.data.construcoes, trofeus: reino.data.trofeus } : null,
    saldo,
    pontos: Number(total.data?.pontos || 0),
    ofensiva: calcularOfensiva((eventos.data || []).map((e) => e.dia), hoje),
    cursos: (trilhas.data || []).map((t) => ({ tema: t.tema, inicio: t.inicio_em, status: t.status })),
    raioX: {
      quizzes: notas("quiz").length, mediaDoQuiz: media(notas("quiz")),
      exercicios: notas("exercicio").length, mediaDoExercicio: media(notas("exercicio")),
      projetos: (desafios.data || []).filter((d) => d.tipo.startsWith("projeto") && d.status === "concluido").length,
    },
    ultimosDesafios: (desafios.data || []).slice(0, 10).map((d) => ({ tipo: d.tipo, titulo: d.titulo, nota: d.nota, dia: d.periodo })),
    carteira: (posicoes.data || []).map((p) => ({ acao: p.acao_id, quantidade: p.quantidade, custo: p.custo })),
    cadernos: (cadernos.data || []).map((c) => ({ titulo: c.titulo, icone: c.icone })),
    acervo: (acervo.data || []).map((m) => ({ titulo: m.titulo, tipo: m.tipo, link: m.status === "aprovado" ? m.link : null, status: m.status, fonte: dominioDe(m.link) })),
    diario: diario.data || [],
  };
}
