// ProcessMap na Lisa (01/11/2026): "quero poder usar o processmap livremente de dentro da Lisa,
// podendo criar projetos e salvar os fluxogramas, inclusive os fluxos que a Lisa desenha".
//
// Os projetos e os fluxogramas moram no banco (db/fluxogramas.sql), um conjunto por pessoa: o
// dono é o "sub" do token da sessão, que o portão (middleware.js) já conferiu antes de a rota
// rodar. O documento é o JSON do ProcessMap (o mesmo do "Exportar"); aqui ele só é conferido por
// cima (é um documento do ProcessMap, cabe no limite) e contado, nunca reescrito.
//
// Gravar leva a versão em que a tela se baseou: se outra aba gravou no meio, a gravação volta
// como conflito em vez de apagar o trabalho da outra (ver salvarFluxo).

import { supabase } from "./supabase.js";
import { COOKIE_SESSAO, lerPayload } from "./authSession.js";

// Uma imagem colada vai no documento em base64; 4 MB cabe umas boas imagens e ainda é uma
// gravação rápida. O desenho que a Lisa faz sozinho é bem menor (LIMITES_DO_DESENHO, 300 KB).
export const LIMITES = { nomeDoProjeto: 80, descricao: 500, nomeDoFluxo: 120, documento: 4_000_000 };
export const ORIGENS = ["pessoa", "lisa"];
// o nome com que o primeiro projeto nasce quando a pessoa salva sem ter criado nenhum
export const PROJETO_PADRAO = "Meus fluxogramas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- partes puras (testadas em scripts/fluxogramas-check.mjs) ----

/** Um id de linha do banco (uuid)? A rota recusa o resto antes de perguntar ao banco. */
export const idValido = (v) => UUID.test(String(v ?? ""));

/** Nome numa linha só, sem espaço sobrando, cortado no limite; "" se não sobrar nada. */
export function nomeLimpo(v, max) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/** O dono da sessão (o "sub" do token), ou null. */
export function donoDe(req) {
  const payload = lerPayload(req.cookies?.get?.(COOKIE_SESSAO)?.value);
  return idValido(payload?.sub) ? payload.sub : null;
}

/**
 * Confere um documento do ProcessMap antes de guardar: objeto com abas (ou a lista de formas do
 * formato antigo), assinatura "processmap" quando houver, dentro do limite. Devolve o que vai para
 * o banco — o documento como veio, o modo e quantas formas tem — ou null.
 */
export function documentoParaGuardar(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
  if (doc.format != null && doc.format !== "processmap") return null;
  const abas = Array.isArray(doc.pages) ? doc.pages : Array.isArray(doc.shapes) ? [doc] : null;
  if (!abas || abas.some((a) => !a || typeof a !== "object" || !Array.isArray(a.shapes))) return null;
  let tamanho;
  try { tamanho = JSON.stringify(doc).length; } catch { return null; }
  if (tamanho > LIMITES.documento) return null;
  return {
    documento: doc,
    modo: doc.mode === "mindmap" ? "mindmap" : "diagram",
    formas: abas.reduce((t, a) => t + a.shapes.length, 0),
  };
}

/** A linha do banco no formato da tela (sem o documento, que só vem quando se abre o fluxo). */
export function resumoDoFluxo(l) {
  return {
    id: l.id, projetoId: l.projeto_id, nome: l.nome, origem: l.origem, modo: l.modo,
    formas: l.formas, versao: l.versao, atualizadoEm: l.atualizado_em, criadoEm: l.criado_em,
  };
}

/** Os projetos com os seus fluxos dentro, os mexidos por último primeiro (projetos e fluxos). */
export function arvoreDeProjetos(projetos, fluxos) {
  const porProjeto = new Map(projetos.map((p) => [p.id, []]));
  for (const f of fluxos) porProjeto.get(f.projeto_id)?.push(resumoDoFluxo(f));
  const recente = (a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm));
  return projetos
    .map((p) => ({
      id: p.id, nome: p.nome, descricao: p.descricao || "", atualizadoEm: p.atualizado_em,
      fluxos: porProjeto.get(p.id).sort(recente),
    }))
    .sort(recente);
}

// ---- banco ----

const COLUNAS_DO_FLUXO = "id, projeto_id, nome, origem, modo, formas, versao, atualizado_em, criado_em";

// Erro com o status HTTP que a rota devolve (404, 409...), para a tela saber o que aconteceu.
export class ErroDosFluxos extends Error {
  constructor(mensagem, status = 400, extra = {}) {
    super(mensagem);
    this.status = status;
    Object.assign(this, extra);
  }
}

const agora = () => new Date().toISOString();

/** Todos os projetos da pessoa, com os fluxos (sem documento) dentro. */
export async function listar(dono) {
  const [projetos, fluxos] = await Promise.all([
    supabase.from("lisa_projetos").select("id, nome, descricao, atualizado_em")
      .eq("dono_id", dono).eq("arquivado", false).order("atualizado_em", { ascending: false }).limit(300),
    supabase.from("lisa_fluxogramas").select(COLUNAS_DO_FLUXO)
      .eq("dono_id", dono).eq("arquivado", false).order("atualizado_em", { ascending: false }).limit(2000),
  ]);
  const erro = projetos.error || fluxos.error;
  if (erro) throw new ErroDosFluxos(`não consegui ler os projetos: ${erro.message}`, 500);
  return arvoreDeProjetos(projetos.data || [], fluxos.data || []);
}

async function projetoDoDono(dono, id) {
  if (!idValido(id)) throw new ErroDosFluxos("projeto inválido", 400);
  const { data, error } = await supabase.from("lisa_projetos").select("id, nome")
    .eq("id", id).eq("dono_id", dono).eq("arquivado", false).maybeSingle();
  if (error) throw new ErroDosFluxos(`não consegui ler o projeto: ${error.message}`, 500);
  if (!data) throw new ErroDosFluxos("esse projeto não existe mais", 404);
  return data;
}

// o projeto ficou mexido agora: sobe para o topo da lista
async function tocarProjeto(id) {
  await supabase.from("lisa_projetos").update({ atualizado_em: agora() }).eq("id", id);
}

/**
 * Um projeto com os fluxos dele, documentos inclusos (os mexidos por último primeiro, até `max`) —
 * para a Lisa trabalhar no projeto citado na conversa (src/lib/processmapNaConversa.js).
 */
export async function lerProjeto(dono, id, { max = 20 } = {}) {
  const projeto = await projetoDoDono(dono, id);
  const { data, error } = await supabase.from("lisa_fluxogramas").select(`${COLUNAS_DO_FLUXO}, documento`)
    .eq("projeto_id", id).eq("dono_id", dono).eq("arquivado", false).order("atualizado_em", { ascending: false }).limit(max);
  if (error) throw new ErroDosFluxos(`não consegui ler os fluxos do projeto: ${error.message}`, 500);
  return { projeto: { id: projeto.id, nome: projeto.nome }, fluxos: (data || []).map((l) => ({ ...resumoDoFluxo(l), documento: l.documento })) };
}

/** Cria um projeto. */
export async function criarProjeto(dono, { nome, descricao } = {}) {
  const n = nomeLimpo(nome, LIMITES.nomeDoProjeto);
  if (!n) throw new ErroDosFluxos("dê um nome ao projeto", 400);
  const { data, error } = await supabase.from("lisa_projetos")
    .insert({ dono_id: dono, nome: n, descricao: String(descricao ?? "").trim().slice(0, LIMITES.descricao) })
    .select("id, nome, descricao, atualizado_em").single();
  if (error) throw new ErroDosFluxos(`não consegui criar o projeto: ${error.message}`, 500);
  return { id: data.id, nome: data.nome, descricao: data.descricao, atualizadoEm: data.atualizado_em, fluxos: [] };
}

/** Renomeia um projeto (ou muda a descrição). */
export async function mudarProjeto(dono, id, { nome, descricao } = {}) {
  await projetoDoDono(dono, id);
  const mudancas = { atualizado_em: agora() };
  if (nome !== undefined) {
    mudancas.nome = nomeLimpo(nome, LIMITES.nomeDoProjeto);
    if (!mudancas.nome) throw new ErroDosFluxos("o projeto precisa de um nome", 400);
  }
  if (descricao !== undefined) mudancas.descricao = String(descricao ?? "").trim().slice(0, LIMITES.descricao);
  const { error } = await supabase.from("lisa_projetos").update(mudancas).eq("id", id).eq("dono_id", dono);
  if (error) throw new ErroDosFluxos(`não consegui mudar o projeto: ${error.message}`, 500);
}

/** "Exclui" um projeto: arquiva ele e os fluxos de dentro (continuam no banco). */
export async function arquivarProjeto(dono, id) {
  await projetoDoDono(dono, id);
  const quando = agora();
  const fluxos = await supabase.from("lisa_fluxogramas").update({ arquivado: true, atualizado_em: quando })
    .eq("projeto_id", id).eq("dono_id", dono).eq("arquivado", false);
  if (fluxos.error) throw new ErroDosFluxos(`não consegui excluir os fluxos do projeto: ${fluxos.error.message}`, 500);
  const { error } = await supabase.from("lisa_projetos").update({ arquivado: true, atualizado_em: quando })
    .eq("id", id).eq("dono_id", dono);
  if (error) throw new ErroDosFluxos(`não consegui excluir o projeto: ${error.message}`, 500);
}

/** Um fluxo com o documento, para abrir no quadro. */
export async function lerFluxo(dono, id) {
  if (!idValido(id)) throw new ErroDosFluxos("fluxograma inválido", 400);
  const { data, error } = await supabase.from("lisa_fluxogramas").select(`${COLUNAS_DO_FLUXO}, documento`)
    .eq("id", id).eq("dono_id", dono).eq("arquivado", false).maybeSingle();
  if (error) throw new ErroDosFluxos(`não consegui abrir o fluxograma: ${error.message}`, 500);
  if (!data) throw new ErroDosFluxos("esse fluxograma não existe mais", 404);
  return { ...resumoDoFluxo(data), documento: data.documento };
}

/**
 * Guarda um fluxo novo. O projeto é um que já existe (`projetoId`) ou um novo, criado junto
 * (`projetoNovo`, o nome) — é o que o "salvar" do quadro da Lisa usa. Sem nenhum dos dois, vai
 * para o projeto mexido por último ou, se a pessoa ainda não tem projeto, para "Meus fluxogramas".
 */
export async function criarFluxo(dono, { projetoId, projetoNovo, nome, documento, origem } = {}) {
  const doc = documentoParaGuardar(documento);
  if (!doc) throw new ErroDosFluxos("o desenho veio estragado ou grande demais (até 4 MB)", 400);
  const n = nomeLimpo(nome, LIMITES.nomeDoFluxo) || nomeLimpo(documento?.name, LIMITES.nomeDoFluxo) || "Fluxograma sem nome";
  let projeto;
  if (projetoId) projeto = await projetoDoDono(dono, projetoId);
  else if (nomeLimpo(projetoNovo, LIMITES.nomeDoProjeto)) projeto = await criarProjeto(dono, { nome: projetoNovo });
  else {
    const { data } = await supabase.from("lisa_projetos").select("id, nome")
      .eq("dono_id", dono).eq("arquivado", false).order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
    projeto = data || await criarProjeto(dono, { nome: PROJETO_PADRAO });
  }
  const { data, error } = await supabase.from("lisa_fluxogramas").insert({
    dono_id: dono, projeto_id: projeto.id, nome: n, documento: { ...doc.documento, name: n },
    modo: doc.modo, formas: doc.formas, origem: ORIGENS.includes(origem) ? origem : "pessoa",
  }).select(COLUNAS_DO_FLUXO).single();
  if (error) throw new ErroDosFluxos(`não consegui salvar o fluxograma: ${error.message}`, 500);
  await tocarProjeto(projeto.id);
  return { fluxo: resumoDoFluxo(data), projeto: { id: projeto.id, nome: projeto.nome } };
}

/**
 * Grava num fluxo que já existe: o documento, o nome e/ou o projeto (mover). `versao` é a versão
 * em que a tela se baseou; se o banco já está noutra (outra aba gravou no meio), nada é gravado e
 * volta um erro 409 com o fluxo como está lá. `forcar` grava por cima mesmo assim (a pessoa
 * escolheu ficar com a dela).
 */
export async function salvarFluxo(dono, id, { documento, nome, projetoId, versao, forcar = false } = {}) {
  if (!idValido(id)) throw new ErroDosFluxos("fluxograma inválido", 400);
  const { data: atual, error: erroAtual } = await supabase.from("lisa_fluxogramas").select("id, projeto_id, versao")
    .eq("id", id).eq("dono_id", dono).eq("arquivado", false).maybeSingle();
  if (erroAtual) throw new ErroDosFluxos(`não consegui ler o fluxograma: ${erroAtual.message}`, 500);
  if (!atual) throw new ErroDosFluxos("esse fluxograma não existe mais", 404);
  if (!forcar && versao != null && Number(versao) !== atual.versao) {
    throw new ErroDosFluxos("este fluxograma foi mudado em outro lugar", 409, { fluxo: await lerFluxo(dono, id) });
  }
  const mudancas = { versao: atual.versao + 1, atualizado_em: agora() };
  if (nome !== undefined) {
    mudancas.nome = nomeLimpo(nome, LIMITES.nomeDoFluxo);
    if (!mudancas.nome) throw new ErroDosFluxos("o fluxograma precisa de um nome", 400);
  }
  if (documento !== undefined) {
    const doc = documentoParaGuardar(documento);
    if (!doc) throw new ErroDosFluxos("o desenho veio estragado ou grande demais (até 4 MB)", 400);
    mudancas.documento = mudancas.nome ? { ...doc.documento, name: mudancas.nome } : doc.documento;
    mudancas.modo = doc.modo;
    mudancas.formas = doc.formas;
  }
  if (projetoId !== undefined && projetoId !== atual.projeto_id) {
    await projetoDoDono(dono, projetoId);
    mudancas.projeto_id = projetoId;
  }
  // a versão lida entra no filtro: se outra gravação passou entre a leitura e aqui, nenhuma linha
  // casa e a de lá fica (a tela recebe o conflito e decide)
  const { data, error } = await supabase.from("lisa_fluxogramas").update(mudancas)
    .eq("id", id).eq("dono_id", dono).eq("versao", atual.versao).select(COLUNAS_DO_FLUXO);
  if (error) throw new ErroDosFluxos(`não consegui salvar o fluxograma: ${error.message}`, 500);
  if (!data?.length) throw new ErroDosFluxos("este fluxograma foi mudado em outro lugar", 409, { fluxo: await lerFluxo(dono, id) });
  await tocarProjeto(data[0].projeto_id);
  return resumoDoFluxo(data[0]);
}

/** "Exclui" um fluxo (arquiva: continua no banco). */
export async function arquivarFluxo(dono, id) {
  if (!idValido(id)) throw new ErroDosFluxos("fluxograma inválido", 400);
  const { data, error } = await supabase.from("lisa_fluxogramas").update({ arquivado: true, atualizado_em: agora() })
    .eq("id", id).eq("dono_id", dono).eq("arquivado", false).select("id");
  if (error) throw new ErroDosFluxos(`não consegui excluir o fluxograma: ${error.message}`, 500);
  if (!data?.length) throw new ErroDosFluxos("esse fluxograma não existe mais", 404);
}
