// Os repositórios do Modo Domínio (24/10/2026): GitHub e GitLab, SÓ PÚBLICOS — a mesma regra do
// projeto da semana (src/lib/github.js): nenhum token de ninguém, nenhum código privado passando
// pela IA. O token do GitHub do servidor (se houver) só serve para não esbarrar no limite de
// chamadas sem login.
//
// Três coisas: ler o código (para a Lisa analisar e montar os desafios), achar a ponta de uma
// branch e comparar dois commits (o que mudou numa entrega). Tudo cabe no limite de 50 chamadas
// de rede por requisição do Worker da Cloudflare.

import { lerRepositorio as lerDoGitHub, ErroDoGitHub } from "./github.js";
import { lerEnderecoDoRepo } from "@/dominio/enderecoDoRepo.js";

export class ErroDoRepositorio extends Error {}

const MAXIMO_DE_ARQUIVOS = 18;
const MAXIMO_DE_BYTES = 120_000;
const MAXIMO_POR_ARQUIVO = 20_000;
const MAXIMO_DO_DIFF = 60_000;
const MAXIMO_POR_PATCH = 12_000;
const EXTENSOES = /\.(js|mjs|cjs|jsx|ts|tsx|py|java|kt|cs|go|rb|php|c|h|cpp|hpp|rs|swift|dart|sql|html|css|scss|vue|svelte|sh|md)$/i;
const IGNORAR = /(^|\/)(node_modules|dist|build|out|target|bin|obj|vendor|\.git|\.next|coverage|__pycache__|venv|\.venv)(\/|$)|(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.(js|css))$/i;
const relevancia = (c) => c.split("/").length * 10 + (/\.md$/i.test(c) ? 5 : 0) + (/(test|spec)/i.test(c) ? 3 : 0);

/** O endereço conferido, ou erro amigável. */
export function enderecoOuErro(bruto) {
  const e = lerEnderecoDoRepo(bruto);
  if (!e) throw new ErroDoRepositorio("link inválido — use https://github.com/usuario/repositorio ou https://gitlab.com/grupo/projeto");
  return e;
}

// ---------------------------------------------------------------- as APIs

function cabecalhosDoGitHub() {
  const h = { accept: "application/vnd.github+json", "user-agent": "lisa-proof" };
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function chamar(url, headers, onde) {
  let r;
  try {
    r = await fetch(url, { headers });
  } catch {
    throw new ErroDoRepositorio(`não consegui falar com o ${onde}`);
  }
  if (r.status === 404) return null;
  if (r.status === 401 || r.status === 403) {
    throw new ErroDoRepositorio(onde === "GitLab" ? "o GitLab não deixou ler — o projeto é público?" : "o GitHub limitou as consultas por agora — tente daqui a pouco");
  }
  if (r.status === 429) throw new ErroDoRepositorio(`o ${onde} limitou as consultas por agora — tente daqui a pouco`);
  if (!r.ok) throw new ErroDoRepositorio(`o ${onde} respondeu ${r.status}`);
  return r.json();
}

const github = (caminho) => chamar(`https://api.github.com${caminho}`, cabecalhosDoGitHub(), "GitHub");
const gitlab = (caminho) => chamar(`https://gitlab.com/api/v4${caminho}`, { "user-agent": "lisa-proof" }, "GitLab");
const projetoDoGitLab = (e) => `/projects/${encodeURIComponent(e.caminho)}`;

// ---------------------------------------------------------------- ler o código

/**
 * O código do repositório, cortado para caber na análise: { provedor, caminho, nome, url, branch,
 * arquivos: [{ caminho, conteudo }], ignorados }. `ref`: um commit (ou branch) no lugar do que o
 * link diz — o desafio de um andar lê o código no commit em que o andar começou.
 */
export async function lerRepositorio(bruto, { ref } = {}) {
  const e = enderecoOuErro(bruto);
  if (e.provedor === "github") {
    try {
      const r = await lerDoGitHub(e.url, { ref: ref || e.branch || undefined });
      return { provedor: "github", caminho: e.caminho, nome: e.nome, url: e.url, branch: r.branch, arquivos: r.arquivos, ignorados: r.ignorados };
    } catch (erro) {
      if (erro instanceof ErroDoGitHub) throw new ErroDoRepositorio(erro.message);
      throw erro;
    }
  }

  const info = await gitlab(projetoDoGitLab(e));
  if (!info) throw new ErroDoRepositorio("projeto não encontrado no GitLab — confira o link e se ele é público");
  if (info.visibility && info.visibility !== "public") throw new ErroDoRepositorio("o projeto é privado — a Lisa só lê repositórios públicos");
  const branch = ref || e.branch || info.default_branch;
  if (!branch) throw new ErroDoRepositorio("o projeto do GitLab está vazio");

  const arvore = [];
  for (let pagina = 1; pagina <= 3; pagina++) {
    const parte = await gitlab(`${projetoDoGitLab(e)}/repository/tree?recursive=true&per_page=100&page=${pagina}&ref=${encodeURIComponent(branch)}`);
    if (!parte?.length) break;
    arvore.push(...parte);
    if (parte.length < 100) break;
  }
  const candidatos = arvore
    .filter((n) => n.type === "blob" && EXTENSOES.test(n.path) && !IGNORAR.test(n.path))
    .sort((a, b) => relevancia(a.path) - relevancia(b.path));
  if (!candidatos.length) throw new ErroDoRepositorio("não achei arquivos de código no projeto");

  const arquivos = [];
  let total = 0;
  for (const n of candidatos.slice(0, MAXIMO_DE_ARQUIVOS)) {
    if (total >= MAXIMO_DE_BYTES) break;
    const r = await fetch(`https://gitlab.com/api/v4${projetoDoGitLab(e)}/repository/files/${encodeURIComponent(n.path)}/raw?ref=${encodeURIComponent(branch)}`,
      { headers: { "user-agent": "lisa-proof" } }).catch(() => null);
    if (!r?.ok) continue;
    let conteudo = await r.text();
    if (conteudo.length > MAXIMO_POR_ARQUIVO) conteudo = `${conteudo.slice(0, MAXIMO_POR_ARQUIVO)}\n/* … arquivo cortado … */`;
    total += conteudo.length;
    arquivos.push({ caminho: n.path, conteudo });
  }
  if (!arquivos.length) throw new ErroDoRepositorio("não consegui baixar os arquivos do projeto");
  return { provedor: "gitlab", caminho: e.caminho, nome: e.nome, url: e.url, branch, arquivos, ignorados: Math.max(0, candidatos.length - arquivos.length) };
}

// ---------------------------------------------------------------- branches e commits

/** A ponta (o commit mais novo) de uma branch, ou erro se a branch não existe. */
export async function pontaDaBranch(bruto, branch) {
  const e = enderecoOuErro(bruto);
  if (e.provedor === "github") {
    const info = await github(`/repos/${e.caminho}`);
    if (!info) throw new ErroDoRepositorio("repositório não encontrado — confira o link e se ele é público");
    if (info.private) throw new ErroDoRepositorio("o repositório é privado — a Lisa só lê repositórios públicos");
    const b = await github(`/repos/${e.caminho}/branches/${encodeURIComponent(branch)}`);
    if (!b?.commit?.sha) throw new ErroDoRepositorio(`a branch "${branch}" não existe nesse repositório — crie e envie ela (git push) primeiro`);
    return { sha: b.commit.sha, mensagem: b.commit.commit?.message || "" };
  }
  const info = await gitlab(projetoDoGitLab(e));
  if (!info) throw new ErroDoRepositorio("projeto não encontrado no GitLab — confira o link e se ele é público");
  if (info.visibility && info.visibility !== "public") throw new ErroDoRepositorio("o projeto é privado — a Lisa só lê repositórios públicos");
  const b = await gitlab(`${projetoDoGitLab(e)}/repository/branches/${encodeURIComponent(branch)}`);
  if (!b?.commit?.id) throw new ErroDoRepositorio(`a branch "${branch}" não existe nesse projeto — crie e envie ela (git push) primeiro`);
  return { sha: b.commit.id, mensagem: b.commit.message || "" };
}

/**
 * O que mudou de `base` até `ponta`: { arquivos: [{ caminho, status, adicionadas, removidas,
 * patch }], commits: [{ sha, mensagem }], cortado }. É o que a Lisa avalia numa entrega.
 */
export async function mudancasEntre(bruto, base, ponta) {
  const e = enderecoOuErro(bruto);
  let arquivos = [];
  let commits = [];
  if (e.provedor === "github") {
    const c = await github(`/repos/${e.caminho}/compare/${encodeURIComponent(base)}...${encodeURIComponent(ponta)}`);
    if (!c) throw new ErroDoRepositorio("não consegui comparar os commits — o commit de início ainda existe na branch?");
    arquivos = (c.files || []).map((f) => ({ caminho: f.filename, status: f.status, adicionadas: f.additions || 0, removidas: f.deletions || 0, patch: f.patch || "" }));
    commits = (c.commits || []).map((x) => ({ sha: x.sha, mensagem: x.commit?.message || "" }));
  } else {
    const c = await gitlab(`${projetoDoGitLab(e)}/repository/compare?from=${encodeURIComponent(base)}&to=${encodeURIComponent(ponta)}`);
    if (!c) throw new ErroDoRepositorio("não consegui comparar os commits — o commit de início ainda existe na branch?");
    arquivos = (c.diffs || []).map((d) => ({
      caminho: d.new_path || d.old_path,
      status: d.new_file ? "added" : d.deleted_file ? "removed" : d.renamed_file ? "renamed" : "modified",
      adicionadas: (String(d.diff || "").match(/^\+(?!\+\+)/gm) || []).length,
      removidas: (String(d.diff || "").match(/^-(?!--)/gm) || []).length,
      patch: d.diff || "",
    }));
    commits = (c.commits || []).map((x) => ({ sha: x.id, mensagem: x.message || x.title || "" }));
  }
  // cabe na avaliação: cada patch cortado e o total também
  let total = 0;
  let cortado = false;
  arquivos = arquivos.filter((a) => !IGNORAR.test(a.caminho)).slice(0, 40).map((a) => {
    let patch = a.patch.length > MAXIMO_POR_PATCH ? `${a.patch.slice(0, MAXIMO_POR_PATCH)}\n… (cortado)` : a.patch;
    if (total + patch.length > MAXIMO_DO_DIFF) { patch = ""; cortado = true; }
    total += patch.length;
    return { ...a, patch };
  });
  return { arquivos, commits: commits.slice(-20), cortado };
}
