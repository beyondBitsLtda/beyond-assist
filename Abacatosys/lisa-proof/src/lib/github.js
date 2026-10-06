// Lê o código de um repositório PÚBLICO do GitHub para a Lisa avaliar o projeto.
//
// SÓ PÚBLICO, de propósito, mesmo se houver GITHUB_TOKEN configurado. O token (se existir) serve
// apenas para não esbarrar no limite de 60 chamadas por hora da API sem login. Se ele também
// abrisse repositórios privados, qualquer usuário do Abacato poderia colar o link de um repo
// privado da organização e ler o código pela avaliação da IA.
//
// O Worker gratuito da Cloudflare tem limite de 50 chamadas de rede por requisição. Daí o teto de
// arquivos: duas chamadas à API, até MAXIMO_DE_ARQUIVOS downloads, a IA e o banco cabem nele.

const MAXIMO_DE_ARQUIVOS = 18;
const MAXIMO_DE_BYTES = 120_000;
const MAXIMO_POR_ARQUIVO = 20_000;

const EXTENSOES = /\.(js|mjs|cjs|jsx|ts|tsx|py|java|kt|cs|go|rb|php|c|h|cpp|hpp|rs|swift|dart|sql|html|css|scss|vue|svelte|sh|md)$/i;
const IGNORAR = /(^|\/)(node_modules|dist|build|out|target|bin|obj|vendor|\.git|\.next|coverage|__pycache__|venv|\.venv)(\/|$)|(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.(js|css))$/i;

export class ErroDoGitHub extends Error {}

/** "https://github.com/dono/repo", com ou sem /tree/branch, .git ou barra no fim. */
export function lerEnderecoDoRepo(bruto) {
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/tree\/([^?#]+))?\/?(?:[?#].*)?$/i
    .exec(String(bruto || "").trim());
  if (!m) return null;
  return { dono: m[1], repo: m[2], branch: m[3] ? decodeURIComponent(m[3]).split("/")[0] : null };
}

function cabecalhos() {
  const h = { accept: "application/vnd.github+json", "user-agent": "lisa-proof" };
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function api(caminho) {
  let r;
  try {
    r = await fetch(`https://api.github.com${caminho}`, { headers: cabecalhos() });
  } catch {
    throw new ErroDoGitHub("não consegui falar com o GitHub");
  }
  if (r.status === 404) throw new ErroDoGitHub("repositório não encontrado — confira o link e se ele é público");
  if (r.status === 403 || r.status === 429) throw new ErroDoGitHub("o GitHub limitou as consultas por agora — tente daqui a pouco");
  if (!r.ok) throw new ErroDoGitHub(`o GitHub respondeu ${r.status}`);
  return r.json();
}

/** Mais perto da raiz e código antes de README: é onde costuma estar o que importa. */
function relevancia(caminho) {
  const profundidade = caminho.split("/").length;
  const ehDoc = /\.md$/i.test(caminho) ? 1 : 0;
  const ehTeste = /(test|spec)/i.test(caminho) ? 1 : 0;
  return profundidade * 10 + ehDoc * 5 + ehTeste * 3;
}

/**
 * Os arquivos de código do repositório, cortados para caber na avaliação.
 *
 * Devolve `{ dono, repo, branch, url, arquivos: [{ caminho, conteudo }], ignorados }`.
 */
export async function lerRepositorio(endereco) {
  const alvo = lerEnderecoDoRepo(endereco);
  if (!alvo) throw new ErroDoGitHub("link inválido — use https://github.com/usuario/repositorio");

  const info = await api(`/repos/${alvo.dono}/${alvo.repo}`);
  if (info.private) throw new ErroDoGitHub("o repositório é privado — a Lisa só avalia repositórios públicos");
  const branch = alvo.branch || info.default_branch;

  const arvore = await api(`/repos/${alvo.dono}/${alvo.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const candidatos = (arvore.tree || [])
    .filter((n) => n.type === "blob" && EXTENSOES.test(n.path) && !IGNORAR.test(n.path) && (n.size || 0) <= 200_000)
    .sort((a, b) => relevancia(a.path) - relevancia(b.path));
  if (!candidatos.length) throw new ErroDoGitHub("não achei arquivos de código no repositório");

  const arquivos = [];
  let total = 0;
  for (const n of candidatos.slice(0, MAXIMO_DE_ARQUIVOS)) {
    if (total >= MAXIMO_DE_BYTES) break;
    const r = await fetch(
      `https://raw.githubusercontent.com/${alvo.dono}/${alvo.repo}/${encodeURIComponent(branch)}/${n.path.split("/").map(encodeURIComponent).join("/")}`,
      { headers: { "user-agent": "lisa-proof" } }
    ).catch(() => null);
    if (!r?.ok) continue;
    let conteudo = await r.text();
    if (conteudo.length > MAXIMO_POR_ARQUIVO) conteudo = `${conteudo.slice(0, MAXIMO_POR_ARQUIVO)}\n/* … arquivo cortado … */`;
    total += conteudo.length;
    arquivos.push({ caminho: n.path, conteudo });
  }
  if (!arquivos.length) throw new ErroDoGitHub("não consegui baixar os arquivos do repositório");

  return {
    dono: alvo.dono,
    repo: alvo.repo,
    branch,
    url: `https://github.com/${alvo.dono}/${alvo.repo}`,
    arquivos,
    ignorados: Math.max(0, candidatos.length - arquivos.length),
    truncado: (arvore.truncated && true) || false,
  };
}
