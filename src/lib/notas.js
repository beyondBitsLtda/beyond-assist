// Modo Tomar nota: o que a Lisa grava no Abacato depois de ouvir (ver
// src/components/panels/TomarNota.js e /api/notas/*).
//
// Um quadro "Notas" por pessoa, uma coluna por tema e um card por subassunto. O quadro e os
// cards levam origem "lisa" e um origem_id próprio: o quadro continua sendo achado mesmo que
// a pessoa mude o nome dele, e o índice único de (origem, origem_id) dos cards impede que uma
// segunda tentativa da mesma gravação duplique as notas.
//
// A descrição do card é texto puro (o Abacato mostra num textarea), por isso as seções vão
// em maiúsculas e as listas com "•", sem markdown.

import { supabase } from "./supabase.js";
import { esquecerCache } from "./liveQuadros.js";
import { COOKIE_SESSAO, lerPayload } from "./authSession.js";
import { LIMITE_DE_SEGUNDOS, minutoDe } from "./tomarNota.js";

const PASSO = 1024; // o mesmo espaçamento de posição do Abacato (dominio/Quadro.js)
const ORIGEM = "lisa";
// O índice único de (origem, origem_id) dos quadros vale para o banco INTEIRO, não por pessoa:
// por isso o origem_id leva o dono e um carimbo (quadro arquivado continua ocupando o seu).
// "tomar-nota" sozinho é o formato da 0.14.0, que o primeiro quadro criado ainda usa.
const ORIGEM_DO_QUADRO = "tomar-nota";
const origemDoQuadro = (donoId) => `${ORIGEM_DO_QUADRO}:${donoId}:${Date.now().toString(36)}`;
// O nome com que o quadro nasce; depois ele é achado pela origem, mesmo renomeado.
export const NOME_DO_QUADRO = "Notas";
const MAX_TRECHOS = 40; // 10 min em trechos de ~25–35 s, com folga
const MAX_TEXTO_DO_TRECHO = 8000;

// O link do quadro no Abacato (o mesmo endereço que a leitura usa em ingest/abacato.js).
export const enderecoDoQuadro = (id) => `${process.env.ABACATO_URL || "https://abacato.beyond.dev.br"}/quadros/${id}`;

// ---- partes puras (testadas em scripts/notas-check.mjs) ----

const DATA_BR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

/** "27/10/2026 14:32" no horário de Brasília — o Worker roda em UTC. */
export function quandoFoi(iso) {
  const d = new Date(iso);
  return DATA_BR.format(Number.isNaN(d.getTime()) ? new Date() : d).replace(",", "");
}

/** Nome de coluna a partir do tema: uma linha, sem espaço sobrando, até 60 caracteres. */
export function nomeDaColuna(tema) {
  const limpo = String(tema || "").replace(/\s+/g, " ").trim();
  return limpo.length > 60 ? `${limpo.slice(0, 59).trimEnd()}…` : limpo;
}

const comparavel = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** O corpo que chega do aparelho, conferido: trechos em ordem, sem repetir índice, com texto. */
export function trechosValidos(bruto) {
  if (!Array.isArray(bruto)) return [];
  const vistos = new Set();
  return bruto
    .filter((t) => t && Number.isInteger(t.indice) && t.indice >= 0 && !vistos.has(t.indice) && vistos.add(t.indice))
    .map((t) => ({
      indice: t.indice,
      inicio: Math.max(0, Math.min(LIMITE_DE_SEGUNDOS, Number(t.inicio) || 0)),
      duracao: Math.max(0, Math.min(40, Number(t.duracao) || 0)),
      texto: String(t.texto || "").slice(0, MAX_TEXTO_DO_TRECHO).trim(),
    }))
    .filter((t) => t.texto)
    .sort((a, b) => a.indice - b.indice)
    .slice(0, MAX_TRECHOS);
}

/** A transcrição com o minuto de cada trecho — o que o modelo lê e o que vai para o último card. */
export function transcricaoComTempo(trechos) {
  return trechos.map((t) => `[${minutoDe(t.inicio)}] ${t.texto}`).join("\n\n");
}

// Para achar uma citação na transcrição sem tropeçar em pontuação, maiúscula ou acento.
const soPalavras = (s) => comparavel(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Confere cada citação do modelo contra o que foi realmente transcrito e devolve as que
 * existem, com o minuto em que foram ditas (estimado pela posição dentro do trecho, que tem
 * no máximo 35 s). Citação que o modelo "melhorou" não entra:
 * o card promete transcrição real. Se nenhuma bate, as do modelo entram marcadas como
 * aproximadas — melhor que um card sem nada do que foi dito.
 */
export function citacoesConferidas(citacoes, trechos) {
  const lista = (Array.isArray(citacoes) ? citacoes : []).map((c) => String(c || "").trim().replace(/^["“”']+|["“”']+$/g, "")).filter(Boolean);
  const partes = trechos.map((t) => ({ inicio: t.inicio, duracao: t.duracao || 0, texto: soPalavras(t.texto) }));
  const juntas = partes.map((p) => p.texto).join(" ");
  const conferidas = [];
  for (const c of lista) {
    const alvo = soPalavras(c);
    if (alvo.length < 8) continue;
    const pos = juntas.indexOf(alvo);
    if (pos < 0) continue;
    let acumulado = 0;
    let inicio = partes[0]?.inicio ?? 0;
    for (const p of partes) {
      if (pos < acumulado + p.texto.length + 1) {
        inicio = p.inicio + (p.duracao * (pos - acumulado)) / Math.max(1, p.texto.length);
        break;
      }
      acumulado += p.texto.length + 1;
    }
    conferidas.push({ texto: c, inicio, exata: true });
  }
  if (conferidas.length) return conferidas;
  return lista.slice(0, 4).map((texto) => ({ texto, inicio: null, exata: false }));
}

const lista = (itens) => itens.map((i) => `• ${String(i).trim()}`).join("\n");

/** A descrição de um card de nota: a interpretação da Lisa, os pontos e o que foi dito. */
export function descricaoDaNota(nota, trechos, { quando, duracaoMin, tema }) {
  const citacoes = citacoesConferidas(nota.citacoes, trechos);
  const pontos = (nota.pontos || []).filter((p) => String(p).trim());
  const encaminhamentos = (nota.encaminhamentos || []).filter((p) => String(p).trim());
  const partes = [`INTERPRETAÇÃO DA LISA\n${String(nota.interpretacao || "").trim()}`];
  if (pontos.length) partes.push(`PONTOS PRINCIPAIS\n${lista(pontos)}`);
  if (encaminhamentos.length) partes.push(`ENCAMINHAMENTOS\n${lista(encaminhamentos)}`);
  if (citacoes.length) {
    const exatas = citacoes[0].exata;
    partes.push(`${exatas ? "O QUE FOI DITO (transcrição literal)" : "O QUE FOI DITO (aproximado — não achei as palavras exatas na transcrição)"}\n${citacoes
      .map((c) => (c.inicio === null ? `“${c.texto}”` : `[${minutoDe(c.inicio)}] “${c.texto}”`))
      .join("\n")}`);
  }
  partes.push(`— Tomar nota · ${quando} · ${duracaoMin} min de escuta · tema: ${tema}`);
  return partes.join("\n\n");
}

/** O último card: a transcrição inteira, para conferir qualquer nota. */
export function descricaoDaTranscricao(trechos, { quando, duracaoMin, resumo }) {
  return [
    resumo ? `RESUMO DA LISA\n${resumo}` : "",
    `TRANSCRIÇÃO COMPLETA (${duracaoMin} min, ${quando})\n${transcricaoComTempo(trechos)}`,
  ].filter(Boolean).join("\n\n");
}

// ---- banco ----

/** O usuário do Abacato da sessão da Lisa (mesmo e-mail), ou null. O portão (middleware.js)
 *  já conferiu a assinatura do token antes de a rota rodar. */
export async function donoDaSessao(req) {
  const payload = lerPayload(req.cookies?.get?.(COOKIE_SESSAO)?.value);
  const email = String(payload?.email || "").trim();
  if (!email) return null;
  const { data } = await supabase
    .from("abacato_usuarios").select("id, nome, email, ativo")
    .ilike("email", email.replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle();
  return data && data.ativo !== false ? data : null;
}

/** O quadro "Notas" da pessoa; cria na primeira vez. */
async function quadroDeNotas(donoId) {
  const { data: marcado } = await supabase
    .from("abacato_quadros").select("id, nome")
    .eq("dono_id", donoId).eq("origem", ORIGEM).eq("arquivado", false)
    .or(`origem_id.eq.${ORIGEM_DO_QUADRO},origem_id.like.${ORIGEM_DO_QUADRO}:${donoId}:*`)
    .order("criado_em", { ascending: false })
    .limit(1).maybeSingle();
  if (marcado) return { ...marcado, novo: false };
  const { data: peloNome } = await supabase
    .from("abacato_quadros").select("id, nome")
    .eq("dono_id", donoId).ilike("nome", NOME_DO_QUADRO).eq("arquivado", false)
    .limit(1).maybeSingle();
  if (peloNome) return { ...peloNome, novo: false };
  const { data, error } = await supabase.from("abacato_quadros").insert({
    nome: NOME_DO_QUADRO,
    descricao: "As notas que a Lisa toma no modo Tomar nota: uma coluna por tema, um card por assunto.",
    dono_id: donoId,
    origem: ORIGEM,
    origem_id: origemDoQuadro(donoId),
  }).select("id, nome").single();
  if (error) throw new Error(`não consegui criar o quadro Notas: ${error.message}`);
  return { ...data, novo: true };
}

/** A coluna do tema no quadro de notas — a mesma, se o tema já foi anotado antes. */
async function colunaDoTema(quadroId, tema) {
  const nome = nomeDaColuna(tema);
  const { data: colunas } = await supabase
    .from("abacato_colunas").select("id, nome, posicao")
    .eq("quadro_id", quadroId).eq("arquivada", false).order("posicao");
  const igual = (colunas || []).find((c) => comparavel(c.nome) === comparavel(nome));
  if (igual) return { id: igual.id, nome: igual.nome, nova: false };
  const ultima = (colunas || []).at(-1);
  const { data, error } = await supabase.from("abacato_colunas").insert({
    quadro_id: quadroId,
    nome,
    posicao: (ultima?.posicao ?? 0) + PASSO, // no fim, como o "+ Adicionar coluna"
    origem: ORIGEM,
  }).select("id, nome").single();
  if (error) throw new Error(`não consegui criar a coluna "${nome}": ${error.message}`);
  return { ...data, nova: true };
}

/**
 * Grava as notas organizadas: quadro, coluna e um card por nota, mais o card da transcrição.
 * `sessao` identifica a gravação no aparelho; se ela já foi gravada (a resposta se perdeu e
 * o aparelho tentou de novo), devolve o que já existe em vez de duplicar.
 */
export async function gravarNotas({ dono, sessao, tema, resumo, notas, trechos, iniciadaEm, duracaoSegundos }) {
  const prefixo = `tomar-nota:${sessao}:`;
  const quadro = await quadroDeNotas(dono.id);
  const { data: jaGravados } = await supabase
    .from("abacato_cards").select("id, titulo, coluna_id, abacato_colunas ( nome )")
    .eq("origem", ORIGEM).like("origem_id", `${prefixo.replace(/[\\%_]/g, "\\$&")}%`).order("posicao");
  if (jaGravados?.length) {
    return {
      quadro: { id: quadro.id, nome: quadro.nome, url: enderecoDoQuadro(quadro.id), novo: false },
      coluna: { id: jaGravados[0].coluna_id, nome: jaGravados[0].abacato_colunas?.nome || tema, nova: false },
      cards: jaGravados.map((c) => ({ id: c.id, titulo: c.titulo })),
      repetida: true,
    };
  }

  const coluna = await colunaDoTema(quadro.id, tema);
  const quando = quandoFoi(iniciadaEm);
  const duracaoMin = Math.max(1, Math.round(duracaoSegundos / 60));
  const { data: ultimo } = await supabase
    .from("abacato_cards").select("posicao").eq("coluna_id", coluna.id).eq("arquivado", false)
    .order("posicao", { ascending: false }).limit(1).maybeSingle();
  const base = ultimo?.posicao ?? 0;

  const linhas = [
    ...notas.map((n) => ({
      titulo: String(n.titulo).trim().slice(0, 140),
      descricao: descricaoDaNota(n, trechos, { quando, duracaoMin, tema }),
    })),
    { titulo: `Transcrição completa — ${quando}`, descricao: descricaoDaTranscricao(trechos, { quando, duracaoMin, resumo }) },
  ].map((c, i) => ({
    coluna_id: coluna.id,
    titulo: c.titulo,
    descricao: c.descricao,
    posicao: base + PASSO * (i + 1),
    origem: ORIGEM,
    origem_id: `${prefixo}${i}`,
  }));

  const { data: cards, error } = await supabase.from("abacato_cards").insert(linhas).select("id, titulo, posicao");
  if (error) throw new Error(`não consegui criar os cards: ${error.message}`);
  await supabase.from("abacato_quadros").update({ atualizado_em: new Date().toISOString() }).eq("id", quadro.id);
  esquecerCache();
  return {
    quadro: { id: quadro.id, nome: quadro.nome, url: enderecoDoQuadro(quadro.id), novo: quadro.novo },
    coluna: { id: coluna.id, nome: coluna.nome, nova: coluna.nova },
    cards: (cards || []).sort((a, b) => a.posicao - b.posicao).map(({ id, titulo }) => ({ id, titulo })),
    repetida: false,
  };
}
