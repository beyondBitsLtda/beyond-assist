import { supabase } from "./supabase.js";

/** Conteúdo COMPLETO (todos os pedaços, na ordem certa) de um ou mais arquivos já indexados
 * de um repositório GitHub — diferente da busca semântica normal (que devolve só o PEDAÇO que
 * bateu), isto reconstrói o arquivo INTEIRO a partir dos chunks salvos em `documents`.
 * Usado por src/lib/codeTasks.js (a Lisa precisa do arquivo inteiro pra reescrevê-lo com
 * segurança) e por src/lib/archDocs.js (mapear a arquitetura real do repositório). */
export async function getFullFileContents(repo, paths) {
  const results = [];
  for (const path of [...new Set(paths)]) {
    const { data, error } = await supabase
      .from("documents").select("external_id, content")
      .eq("source", "github").eq("board", repo).eq("title", path);
    if (error || !data?.length) continue;
    const sorted = data.sort((a, b) => Number(a.external_id.split("#").pop()) - Number(b.external_id.split("#").pop()));
    results.push({ path, content: sorted.map((r) => r.content).join("\n") });
  }
  return results;
}
