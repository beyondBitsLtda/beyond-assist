// O que é de cada USUÁRIO no banco (01/11/2026, o MVP — db/mvp_usuarios.sql): o perfil da entrevista
// do primeiro acesso (lisa_perfis). Filtrado pelo dono — o "sub" do token, que o portão já conferiu.
// (A Lisa Task deixou de morar aqui: é o Abacato, com o visual da Lisa — ver src/app/(panels)/lisa-task.)

import { supabase } from "./supabase.js";

export class ErroDoUsuario extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

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

// as preferências que a entrevista guarda, e o tamanho de cada uma (01/11/2026: a entrevista em duas
// etapas — "sobre você" e "estudos e trabalho" — e o retrato que a Lisa escreve da pessoa)
const PREFERENCIAS = { sobre: 600, jeito: 300, importante: 400, ajuda: 300, tempo: 120, resposta: 120, retrato: 1200 };

/**
 * Guarda o perfil — só com o consentimento dado (a tela pergunta antes de cada etapa). Junta com o
 * que já existe: a etapa 2 não apaga o que a 1 guardou, e o campo que não veio fica como estava.
 */
export async function salvarPerfil(dono, dados = {}) {
  if (!dados.consentimento) throw new ErroDoUsuario("o perfil só é guardado com o seu consentimento");
  const atual = await lerPerfil(dono).catch(() => null);
  const novas = dados.preferencias && typeof dados.preferencias === "object" ? dados.preferencias : {};
  const prefs = { ...(atual?.preferencias || {}) };
  for (const [k, max] of Object.entries(PREFERENCIAS)) if (novas[k] !== undefined) prefs[k] = texto(novas[k], max);
  if (novas.etapa !== undefined) prefs.etapa = Math.max(Number(prefs.etapa) || 0, Math.min(2, Number(novas.etapa) || 0));
  const campo = (k, max) => (dados[k] !== undefined ? texto(dados[k], max) : atual?.[k] ?? "");
  const linhaDoBanco = {
    dono_id: dono,
    nome: campo("nome", 80), area: campo("area", 300), nivel: campo("nivel", 80), objetivos: campo("objetivos", 600),
    preferencias: prefs,
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
