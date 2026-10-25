// Repositórios VINCULADOS à conversa com a Lisa (pedido de 25/10/2026): "além da conversa e do
// que ela estiver vendo em tela e câmera, ela usa essas informações de contexto, inclusive
// conseguindo correlacioná-las — eu vou estar com o código na tela, com o Modo Tela ligado, e vou
// linkar o repositório na conversa: ela não vai ter acesso só ao que está na tela, ela vai ler o
// repositório para poder me ajudar".
//
// Vale em qualquer conversa (não é um modo nem um escopo). A cada pergunta, para cada repositório
// vinculado:
//   1. lê a árvore de arquivos (guardada alguns minutos — a árvore muda pouco numa conversa);
//   2. a IA escolhe os arquivos para ler pelos caminhos, pela pergunta, pela conversa e pelas
//      IMAGENS (a tela, a câmera, os prints anexados) — é aqui que ela acha no repositório o
//      arquivo que está na tela (escolherArquivosDaConversa, em gemini.js);
//   3. lê esses arquivos, mais o README e o manifesto do projeto, dentro de um orçamento;
//   4. devolve a seção do prompt: a estrutura do repositório e o código lido, com o caminho de cada um.
//
// Leitura pela API do GitHub com o token da Lisa (GITHUB_TOKEN, o mesmo do painel de
// repositórios), que alcança os repositórios dela e os públicos; sem token, só os públicos.
// Só leitura. Tudo cabe no limite de chamadas de rede por requisição do Worker: no máximo 3
// repositórios e 12 arquivos lidos por pergunta.

import { b64ParaTexto } from "./base64.js";
import { escolherArquivosDaConversa } from "./gemini.js";
import { vinculosValidos } from "./enderecoDoRepositorio.js";

const API = "https://api.github.com";
const UA = "beyond-assist-lisa"; // sem User-Agent o GitHub responde 403 (ver src/lib/github.js)

export const MAX_REPOS = 3;
const MAX_ESCOLHIDOS = 8;          // os que a IA escolhe
const MAX_LIDOS = 12;              // com o README e o manifesto de cada um
const MAX_POR_ARQUIVO = 24_000;    // caracteres
const MAX_TOTAL = 140_000;
const MAX_CAMINHOS_NA_ESCOLHA = 1200;
const MAX_CAMINHOS_NA_ESTRUTURA = 250;
const TTL_DA_ARVORE = 5 * 60_000;

export const EXTENSOES = /\.(js|mjs|cjs|jsx|ts|tsx|py|java|kt|kts|cs|go|rb|php|c|h|cpp|hpp|rs|swift|dart|sql|html|css|scss|less|vue|svelte|sh|ps1|bat|md|mdx|json|jsonc|yml|yaml|toml|xml|gradle|properties|ini|txt|graphql|prisma|tf)$/i;
export const IGNORAR = /(^|\/)(node_modules|dist|build|out|target|bin|obj|vendor|\.git|\.next|\.open-next|\.wrangler|\.vercel|coverage|__pycache__|venv|\.venv|\.idea|\.vscode)(\/|$)|(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|\.min\.(js|css)|\.map)$/i;
const MANIFESTOS = ["package.json", "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml", "pom.xml", "build.gradle", "composer.json", "Gemfile"];

// ---------------------------------------------------------------- GitHub

class ErroDoRepositorio extends Error {}

// o token já foi recusado neste Worker: não gasta mais uma chamada por arquivo tentando de novo
// (o limite de chamadas de rede por requisição do plano gratuito é curto)
let tokenRecusado = false;

async function chamar(caminho, { comToken = true } = {}) {
  const headers = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": UA };
  const usouToken = comToken && !tokenRecusado && Boolean(process.env.GITHUB_TOKEN);
  if (usouToken) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  let r;
  try {
    r = await fetch(`${API}${caminho}`, { headers });
  } catch {
    throw new ErroDoRepositorio("não consegui falar com o GitHub");
  }
  // token vencido ou revogado (401): os repositórios públicos continuam legíveis sem ele
  if (r.status === 401 && usouToken) {
    tokenRecusado = true;
    console.warn("[repositorioNaConversa] o GitHub recusou o GITHUB_TOKEN (401); lendo só repositórios públicos");
    return chamar(caminho, { comToken: false });
  }
  if (r.status === 401) throw new ErroDoRepositorio("o acesso da Lisa ao GitHub precisa ser renovado no servidor");
  if (r.status === 404) return null;
  if (r.status === 403 || r.status === 429) throw new ErroDoRepositorio("o GitHub limitou as consultas por agora");
  if (!r.ok) throw new ErroDoRepositorio(`o GitHub respondeu ${r.status}`);
  return r.json();
}

const arvores = new Map(); // "dono/repo@branch" → { quando, dados }
const conteudos = new Map(); // sha → texto (o mesmo sha é sempre o mesmo conteúdo)

/** A árvore de um repositório vinculado: { repo, branch, privado, arquivos: [{ path, sha, size }], total }. */
export async function lerRepositorioVinculado({ repo, branch }) {
  const chave = `${repo.toLowerCase()}@${branch || ""}`;
  const guardada = arvores.get(chave);
  if (guardada && Date.now() - guardada.quando < TTL_DA_ARVORE) return guardada.dados;

  const info = await chamar(`/repos/${repo}`);
  if (!info) throw new ErroDoRepositorio(`não achei ${repo} (ou ele é privado e a Lisa não tem acesso)`);
  const ramo = branch || info.default_branch;
  const arvore = await chamar(`/repos/${repo}/git/trees/${encodeURIComponent(ramo)}?recursive=1`);
  if (!arvore) throw new ErroDoRepositorio(`a branch "${ramo}" não existe em ${repo}`);
  const arquivos = (arvore.tree || [])
    .filter((n) => n.type === "blob" && EXTENSOES.test(n.path) && !IGNORAR.test(n.path) && (n.size || 0) <= 400_000)
    .map((n) => ({ path: n.path, sha: n.sha, size: n.size || 0 }));
  const dados = { repo: info.full_name || repo, branch: ramo, privado: Boolean(info.private), arquivos, total: arquivos.length, cortada: Boolean(arvore.truncated) };
  arvores.set(chave, { quando: Date.now(), dados });
  if (arvores.size > 30) arvores.delete(arvores.keys().next().value);
  return dados;
}

async function conteudoDoArquivo(repo, sha) {
  if (conteudos.has(sha)) return conteudos.get(sha);
  const blob = await chamar(`/repos/${repo}/git/blobs/${sha}`);
  if (!blob || blob.encoding !== "base64") return null;
  const texto = b64ParaTexto(blob.content);
  const valor = texto.includes("\uFFFD") ? null : texto; // caractere de substituição: era binário
  conteudos.set(sha, valor);
  if (conteudos.size > 400) conteudos.delete(conteudos.keys().next().value);
  return valor;
}

// ---------------------------------------------------------------- escolher (puro)

/** Os caminhos que vão para a escolha: os mais rasos primeiro (é onde mora o que importa), até o teto. */
export function caminhosParaEscolha(arquivos, max = MAX_CAMINHOS_NA_ESCOLHA) {
  return [...(arquivos || [])]
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path))
    .slice(0, max)
    .map((a) => a.path);
}

const normalizar = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** As palavras de um texto, com camelCase e kebab-case separados (como os nomes aparecem no código). */
export function termos(texto) {
  const partes = String(texto || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^A-Za-z0-9\u00C0-\u00FF]+/);
  return [...new Set(partes.map(normalizar).filter((p) => p.length >= 3))];
}

/**
 * Plano B, sem IA (ela falhou ou está sem cota): os arquivos cujo caminho mais tem a ver com a
 * pergunta e a conversa. Devolve [{ repo, path }].
 */
export function escolhaPorTermos(texto, repos, max = MAX_ESCOLHIDOS) {
  const t = termos(texto);
  if (!t.length) return [];
  const pontuados = [];
  for (const r of repos) {
    for (const a of r.arquivos || []) {
      const nome = termos(a.path);
      let pontos = 0;
      for (const termo of t) if (nome.some((n) => n === termo || (termo.length >= 5 && n.includes(termo)))) pontos += a.path.toLowerCase().endsWith(termo) ? 3 : 2;
      if (pontos) pontuados.push({ repo: r.repo, path: a.path, pontos: pontos - a.path.split("/").length * 0.1 });
    }
  }
  return pontuados.sort((x, y) => y.pontos - x.pontos).slice(0, max).map(({ repo, path }) => ({ repo, path }));
}

/** O README e o manifesto (package.json…) da raiz: o mapa do projeto, que sempre ajuda. */
export function arquivosDeApoio(r) {
  const raiz = new Map((r.arquivos || []).filter((a) => !a.path.includes("/")).map((a) => [a.path.toLowerCase(), a.path]));
  const saida = [];
  const readme = [...raiz.keys()].find((p) => /^readme(\.md|\.mdx|\.txt)?$/.test(p));
  if (readme) saida.push(raiz.get(readme));
  const manifesto = MANIFESTOS.find((m) => raiz.has(m.toLowerCase()));
  if (manifesto) saida.push(raiz.get(manifesto.toLowerCase()));
  return saida;
}

/** As pastas de cima e quantos arquivos cada uma tem ("src/ (120)") — a forma do projeto numa linha. */
export function resumoDaEstrutura(arquivos) {
  const contagem = new Map();
  for (const a of arquivos || []) {
    const topo = a.path.includes("/") ? `${a.path.split("/")[0]}/` : a.path;
    contagem.set(topo, (contagem.get(topo) || 0) + 1);
  }
  return [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([p, n]) => (p.endsWith("/") ? `${p} (${n})` : p)).join(", ");
}

/**
 * A seção do prompt: o que a Lisa sabe de cada repositório vinculado (a estrutura e o código lido,
 * com o caminho de cada arquivo) e como usar isso junto com a tela e as imagens.
 */
export function secaoDosRepositorios(repos, lidos, avisos = []) {
  if (!repos.length && !avisos.length) return "";
  const partes = [
    "REPOSITÓRIOS VINCULADOS PELO USUÁRIO — o código abaixo foi lido agora do GitHub. Use-o para responder:",
    "cite os caminhos dos arquivos; se a tela, a câmera ou um print mostrarem código, um erro ou uma tela do",
    "sistema, relacione com estes arquivos (diga de qual arquivo/trecho aquilo vem) e responda com base no",
    "código real, não em suposições. Responda TODAS as partes da pergunta; se uma delas depende de arquivos",
    "que não estão abaixo (por exemplo, onde algo é usado), diga o que você não viu em vez de pular.",
    "Se um repositório não pôde ser lido (aviso no fim), diga isso em uma frase — NUNCA peça token, senha",
    "ou credencial ao usuário: o acesso da Lisa ao GitHub é configurado no servidor.",
  ];
  for (const r of repos) {
    const deste = lidos.filter((l) => l.repo === r.repo);
    partes.push("", `## ${r.repo} (branch ${r.branch} · ${r.total} arquivos de código${r.cortada ? ", árvore cortada pelo GitHub" : ""})`);
    partes.push(`Estrutura: ${resumoDaEstrutura(r.arquivos) || "—"}`);
    partes.push(`Caminhos (${Math.min(r.arquivos.length, MAX_CAMINHOS_NA_ESTRUTURA)} de ${r.arquivos.length}):`);
    partes.push(caminhosParaEscolha(r.arquivos, MAX_CAMINHOS_NA_ESTRUTURA).join("\n"));
    for (const l of deste) {
      partes.push("", `===== ${r.repo}:${l.path}${l.cortado ? " (cortado)" : ""} =====`, l.conteudo, `===== fim de ${l.path} =====`);
    }
  }
  for (const a of avisos) partes.push("", `⚠ ${a}`);
  return `\n\n${partes.join("\n")}`;
}

// ---------------------------------------------------------------- a orquestração

/**
 * O contexto dos repositórios vinculados para uma pergunta: { secao, lidos: [{ repo, path }],
 * avisos }. Nunca derruba a conversa: um repositório que falha vira um aviso na seção.
 */
export async function contextoDosRepositorios({ vinculos, pergunta, conversa = "", imagens = [] }) {
  const lista = vinculosValidos(vinculos, MAX_REPOS);
  if (!lista.length) return { secao: "", lidos: [], avisos: [] };

  const avisos = [];
  const repos = [];
  for (const r of await Promise.all(lista.map((v) => lerRepositorioVinculado(v).catch((e) => ({ ...v, erro: e.message }))))) {
    if (r.erro) avisos.push(`Não consegui ler ${r.repo}: ${r.erro}.`);
    else repos.push(r);
  }
  if (!repos.length) return { secao: secaoDosRepositorios([], [], avisos), lidos: [], avisos };

  let escolhidos = await escolherArquivosDaConversa({
    pergunta, conversa: String(conversa).slice(-6000), imagens,
    repos: repos.map((r) => ({ repo: r.repo, caminhos: caminhosParaEscolha(r.arquivos) })),
    max: MAX_ESCOLHIDOS,
  }).catch(() => []);
  if (!escolhidos.length) escolhidos = escolhaPorTermos(`${pergunta}\n${String(conversa).slice(-1500)}`, repos);

  // os escolhidos primeiro; depois o README e o manifesto de cada repositório, se couberem
  const fila = [...escolhidos];
  for (const r of repos) for (const p of arquivosDeApoio(r)) if (!fila.some((f) => f.repo === r.repo && f.path === p)) fila.push({ repo: r.repo, path: p, apoio: true });

  const porRepo = new Map(repos.map((r) => [r.repo, new Map(r.arquivos.map((a) => [a.path, a]))]));
  const textos = await Promise.all(fila.slice(0, MAX_LIDOS).map(async (f) => {
    const a = porRepo.get(f.repo)?.get(f.path);
    if (!a) return null;
    const texto = await conteudoDoArquivo(f.repo, a.sha).catch(() => null);
    return texto == null ? null : { ...f, texto };
  }));

  const lidos = [];
  let total = 0;
  for (const t of textos.filter(Boolean)) {
    const teto = t.apoio ? 6000 : MAX_POR_ARQUIVO;
    const resto = MAX_TOTAL - total;
    if (resto < 800) break;
    const limite = Math.min(teto, resto);
    const cortado = t.texto.length > limite;
    const conteudo = cortado ? `${t.texto.slice(0, limite)}\n… (o resto do arquivo foi cortado)` : t.texto;
    total += conteudo.length;
    lidos.push({ repo: t.repo, path: t.path, conteudo, cortado });
  }
  return {
    secao: secaoDosRepositorios(repos, lidos, avisos),
    lidos: lidos.map(({ repo, path, cortado }) => ({ repo, path, cortado })),
    repos: repos.map((r) => ({ repo: r.repo, branch: r.branch, total: r.total })),
    avisos,
  };
}
