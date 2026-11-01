// O que é de cada USUÁRIO no banco (01/11/2026, o MVP — db/mvp_usuarios.sql): o perfil da entrevista
// do primeiro acesso (lisa_perfis) e a Lisa Task leve (lisa_tarefas). Tudo filtrado pelo dono — o
// "sub" do token, que o portão já conferiu. A Lisa Task não tem campo nem rota de arquivo ("Sem
// Hospedagem de Arquivos").

import { supabase } from "./supabase.js";

export class ErroDoUsuario extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const agora = () => new Date().toISOString();

// ---- o perfil ----

const doPerfil = (l) => l && ({
  nome: l.nome, area: l.area, nivel: l.nivel, objetivos: l.objetivos,
  preferencias: l.preferencias || {}, consentimentoEm: l.consentimento_em, atualizadoEm: l.atualizado_em,
});

/** O perfil da pessoa, ou null se ela ainda não fez a entrevista (ou apagou). */
export async function lerPerfil(dono) {
  const { data, error } = await supabase.from("lisa_perfis").select("*").eq("dono_id", dono).maybeSingle();
  if (error) throw new ErroDoUsuario(`não consegui ler o perfil: ${error.message}`, 500);
  return doPerfil(data);
}

/** Guarda o perfil — só com o consentimento dado (a tela pergunta antes da entrevista). */
export async function salvarPerfil(dono, dados = {}) {
  if (!dados.consentimento) throw new ErroDoUsuario("o perfil só é guardado com o seu consentimento");
  const prefs = dados.preferencias && typeof dados.preferencias === "object" ? dados.preferencias : {};
  const linhaDoBanco = {
    dono_id: dono,
    nome: texto(dados.nome, 80), area: texto(dados.area, 300), nivel: texto(dados.nivel, 80), objetivos: texto(dados.objetivos, 600),
    preferencias: { resposta: texto(prefs.resposta, 120) },
    consentimento_em: agora(), atualizado_em: agora(),
  };
  const { data, error } = await supabase.from("lisa_perfis").upsert(linhaDoBanco, { onConflict: "dono_id" }).select("*").single();
  if (error) throw new ErroDoUsuario(`não consegui guardar o perfil: ${error.message}`, 500);
  return doPerfil(data);
}

/** Apaga o perfil de verdade (LGPD: a pessoa pode pedir a qualquer hora). */
export async function apagarPerfil(dono) {
  const { error } = await supabase.from("lisa_perfis").delete().eq("dono_id", dono);
  if (error) throw new ErroDoUsuario(`não consegui apagar o perfil: ${error.message}`, 500);
}

// ---- a Lisa Task leve ----

export const PRIORIDADES = ["baixa", "normal", "alta"];
const COLUNAS = "id, titulo, descricao, status, prioridade, lembrete_em, feita_em, criado_em, atualizado_em";
const daTarefa = (l) => ({
  id: l.id, titulo: l.titulo, descricao: l.descricao, status: l.status, prioridade: l.prioridade,
  lembreteEm: l.lembrete_em, feitaEm: l.feita_em, criadoEm: l.criado_em, atualizadoEm: l.atualizado_em,
});
const dataOuNull = (v) => {
  if (v == null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/** As tarefas da pessoa: abertas primeiro (alta prioridade antes), depois as feitas mais recentes. */
export async function listarTarefas(dono) {
  const { data, error } = await supabase.from("lisa_tarefas").select(COLUNAS).eq("dono_id", dono)
    .order("criado_em", { ascending: false }).limit(300);
  if (error) throw new ErroDoUsuario(`não consegui ler as tarefas: ${error.message}`, 500);
  const peso = { alta: 0, normal: 1, baixa: 2 };
  return (data || []).map(daTarefa).sort((a, b) => (a.status === b.status ? (a.status === "aberta" ? peso[a.prioridade] - peso[b.prioridade] : 0) : a.status === "aberta" ? -1 : 1));
}

export async function criarTarefa(dono, dados = {}) {
  const titulo = texto(dados.titulo, 200);
  if (!titulo) throw new ErroDoUsuario("a tarefa precisa de um título");
  const lembrete = dataOuNull(dados.lembreteEm);
  if (lembrete === undefined) throw new ErroDoUsuario("a data do lembrete não é válida");
  const { data, error } = await supabase.from("lisa_tarefas").insert({
    dono_id: dono, titulo, descricao: String(dados.descricao ?? "").trim().slice(0, 2000),
    prioridade: PRIORIDADES.includes(dados.prioridade) ? dados.prioridade : "normal", lembrete_em: lembrete,
  }).select(COLUNAS).single();
  if (error) throw new ErroDoUsuario(`não consegui criar a tarefa: ${error.message}`, 500);
  return daTarefa(data);
}

export async function mudarTarefa(dono, id, dados = {}) {
  if (!UUID.test(String(id))) throw new ErroDoUsuario("tarefa inválida");
  const mudancas = { atualizado_em: agora() };
  if (dados.titulo !== undefined) {
    mudancas.titulo = texto(dados.titulo, 200);
    if (!mudancas.titulo) throw new ErroDoUsuario("a tarefa precisa de um título");
  }
  if (dados.descricao !== undefined) mudancas.descricao = String(dados.descricao ?? "").trim().slice(0, 2000);
  if (dados.prioridade !== undefined) {
    if (!PRIORIDADES.includes(dados.prioridade)) throw new ErroDoUsuario("prioridade inválida");
    mudancas.prioridade = dados.prioridade;
  }
  if (dados.status !== undefined) {
    if (!["aberta", "feita"].includes(dados.status)) throw new ErroDoUsuario("situação inválida");
    mudancas.status = dados.status;
    mudancas.feita_em = dados.status === "feita" ? agora() : null;
  }
  if (dados.lembreteEm !== undefined) {
    const l = dataOuNull(dados.lembreteEm);
    if (l === undefined) throw new ErroDoUsuario("a data do lembrete não é válida");
    mudancas.lembrete_em = l;
  }
  const { data, error } = await supabase.from("lisa_tarefas").update(mudancas).eq("id", id).eq("dono_id", dono).select(COLUNAS);
  if (error) throw new ErroDoUsuario(`não consegui mudar a tarefa: ${error.message}`, 500);
  if (!data?.length) throw new ErroDoUsuario("essa tarefa não existe", 404);
  return daTarefa(data[0]);
}

export async function apagarTarefa(dono, id) {
  if (!UUID.test(String(id))) throw new ErroDoUsuario("tarefa inválida");
  const { data, error } = await supabase.from("lisa_tarefas").delete().eq("id", id).eq("dono_id", dono).select("id");
  if (error) throw new ErroDoUsuario(`não consegui apagar a tarefa: ${error.message}`, 500);
  if (!data?.length) throw new ErroDoUsuario("essa tarefa não existe", 404);
}
