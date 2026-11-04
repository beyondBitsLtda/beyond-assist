// O endereço de um repositório público, do GitHub ou do GitLab (Modo Domínio, 24/10/2026). Puro.
//
// GitHub: https://github.com/dono/repo (com ou sem /tree/branch, .git ou barra no fim).
// GitLab: https://gitlab.com/grupo/subgrupo/projeto (o caminho pode ter subgrupos), com ou sem
// /-/tree/branch. Só gitlab.com e github.com: instâncias próprias ficam de fora (endereço livre
// seria uma porta para a Lisa buscar qualquer servidor da rede).

const GITHUB = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/tree\/([^?#]+))?\/?(?:[?#].*)?$/i;
const GITLAB = /^(?:https?:\/\/)?(?:www\.)?gitlab\.com\/(.+)$/i;

/**
 * { provedor: "github"|"gitlab", caminho: "dono/repo", nome: "repo", branch: string|null, url }
 * ou null se não é um endereço que a Lisa aceita.
 */
export function lerEnderecoDoRepo(bruto) {
  const s = String(bruto || "").trim();
  let m = GITHUB.exec(s);
  if (m) {
    const caminho = `${m[1]}/${m[2]}`;
    return { provedor: "github", caminho, nome: m[2], branch: m[3] ? decodeURIComponent(m[3]).split("/")[0] : null, url: `https://github.com/${caminho}` };
  }
  m = GITLAB.exec(s);
  if (m) {
    // no GitLab, tudo o que vem depois de "/-/" é página do projeto (tree, blob, commits…)
    let resto = m[1].replace(/[?#].*$/, "").replace(/\/+$/, "");
    let branch = null;
    const corte = resto.indexOf("/-/");
    if (corte >= 0) {
      const pagina = /^tree\/(.+)$/.exec(resto.slice(corte + 3));
      if (pagina) branch = decodeURIComponent(pagina[1]);
      resto = resto.slice(0, corte);
    }
    const caminho = resto.replace(/\.git$/i, "");
    const partes = caminho.split("/");
    if (partes.length < 2 || !partes.every((p) => /^[A-Za-z0-9_.-]+$/.test(p) && p !== "-")) return null;
    return { provedor: "gitlab", caminho, nome: partes.at(-1), branch, url: `https://gitlab.com/${caminho}` };
  }
  return null;
}

/** O link de um commit, para a tela mostrar o que foi avaliado. */
export function linkDoCommit(endereco, sha) {
  const e = typeof endereco === "string" ? lerEnderecoDoRepo(endereco) : endereco;
  if (!e || !sha) return null;
  return e.provedor === "gitlab" ? `${e.url}/-/commit/${sha}` : `${e.url}/commit/${sha}`;
}
