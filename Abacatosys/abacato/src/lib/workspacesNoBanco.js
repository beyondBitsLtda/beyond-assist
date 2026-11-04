import { supabase } from "@/lib/supabase.js";
import { ErroDeAcesso } from "@/lib/acesso.js";

/**
 * Workspaces no banco: a parte que quadros e projetos de documentação têm em comum.
 *
 * Os dois entram nas MESMAS pastas (ver db/010 e db/011); só muda a tabela que liga o item ao
 * workspace. Escrever isto duas vezes, uma por lista, é como as duas regras acabam divergindo
 * — um lado conferindo o dono do workspace e o outro não.
 */
export const LIGACOES = {
  quadro: { tabela: "abacato_workspace_quadros", coluna: "quadro_id" },
  projeto: { tabela: "abacato_workspace_projetos", coluna: "projeto_id" },
};

/**
 * Os workspaces da pessoa e em qual deles cada item dela está.
 *
 * NUNCA lança: sem as tabelas — código novo publicado antes da migração, por exemplo — devolve
 * lista vazia, e a tela mostra tudo solto, exatamente como era antes de existirem workspaces.
 */
export async function workspacesEOnde(usuarioId, tipo) {
  const { tabela, coluna } = LIGACOES[tipo];
  const [ws, ligacoes] = await Promise.all([
    supabase.from("abacato_workspaces").select("id, nome, posicao").eq("dono_id", usuarioId).order("posicao"),
    supabase.from(tabela).select(`workspace_id, ${coluna}`).eq("dono_id", usuarioId),
  ]);
  if (ws.error || ligacoes.error) return { workspaces: [], onde: new Map() };
  return {
    workspaces: ws.data || [],
    onde: new Map((ligacoes.data || []).map((l) => [l[coluna], l.workspace_id])),
  };
}

/** O workspace, se for desta pessoa; senão, `null`. Um id de workspace alheio nunca é aceito. */
export async function workspaceDoDono(usuarioId, workspaceId) {
  if (!workspaceId) return null;
  const { data } = await supabase.from("abacato_workspaces")
    .select("id").eq("id", workspaceId).eq("dono_id", usuarioId).maybeSingle();
  return data || null;
}

/**
 * Põe o item no workspace (ou tira de todos, com `workspaceId` nulo).
 *
 * Tira de onde estiver e põe no novo — em duas escritas, e não num upsert, porque a chave única
 * é (dono, item): trocar de workspace é trocar a linha, não acrescentar outra.
 */
export async function porNoWorkspace(usuarioId, tipo, itemId, workspaceId) {
  const { tabela, coluna } = LIGACOES[tipo];
  if (workspaceId && !(await workspaceDoDono(usuarioId, workspaceId))) {
    throw new ErroDeAcesso(404, "workspace não encontrado");
  }
  const { error: erroAoTirar } = await supabase.from(tabela)
    .delete().eq("dono_id", usuarioId).eq(coluna, itemId);
  if (erroAoTirar) throw new ErroDeAcesso(500, erroAoTirar.message);
  if (!workspaceId) return;
  const { error } = await supabase.from(tabela)
    .insert({ workspace_id: workspaceId, [coluna]: itemId, dono_id: usuarioId });
  if (error) throw new ErroDeAcesso(500, error.message);
}
