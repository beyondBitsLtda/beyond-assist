// O endereço de um repositório do GitHub que a pessoa vincula à conversa com a Lisa (25/10/2026:
// "dê a função de eu vincular repositórios… ela não vai ter acesso só ao que está na tela, ela vai
// ler o repositório para poder me ajudar"). Puro: serve à tela (o botão + e os links colados na
// mensagem) e ao servidor (src/lib/repositorioNaConversa.js).
//
// Aceita: https://github.com/dono/repo, com ou sem /tree/<branch>, .git ou barra no fim;
// github.com/dono/repo; dono/repo; e dono/repo@branch. Só github.com (endereço livre seria uma
// porta para o servidor buscar qualquer coisa na rede).

const NOME = /^[A-Za-z0-9_.-]+$/;
const URL_DO_GITHUB = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^?#]+))?\/?(?:[?#].*)?$/i;
const CURTO = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:@([A-Za-z0-9._/-]+))?$/;

/** Uma branch aceitável: o que o Git aceita, sem truques. */
export function branchValida(nome) {
  const b = String(nome || "").trim();
  return b.length > 0 && b.length <= 120 && /^[A-Za-z0-9._/-]+$/.test(b) && !b.includes("..") && !b.startsWith("/") && !b.endsWith("/") && !b.endsWith(".lock");
}

/** { repo: "dono/repo", branch: string|null, url } ou null se não é um repositório do GitHub. */
export function lerRepositorio(bruto) {
  const s = String(bruto || "").trim();
  let m = URL_DO_GITHUB.exec(s);
  let dono, nome, branch = null;
  if (m) {
    [, dono, nome] = m;
    // /tree/<branch>/<pasta…>: só dá para saber onde a branch termina quando ela não tem barra;
    // na dúvida, fica o primeiro pedaço (o comum: main, master, develop)
    if (m[3]) branch = decodeURIComponent(m[3]).split("/")[0];
  } else if ((m = CURTO.exec(s))) {
    [, dono, nome] = m;
    branch = m[3] || null;
  } else {
    return null;
  }
  // "." e ".." passam no NOME, mas não são dono nem repositório de verdade
  const soPontos = (t) => /^[.]+$/.test(t);
  if (!NOME.test(dono) || !NOME.test(nome) || soPontos(dono) || soPontos(nome)) return null;
  if (branch && !branchValida(branch)) branch = null;
  const repo = `${dono}/${nome}`;
  return { repo, branch, url: `https://github.com/${repo}` };
}

/** Os repositórios do GitHub citados por link numa mensagem ("olha esse repo: https://github.com/…"). */
export function reposNoTexto(texto) {
  const achados = [];
  const vistos = new Set();
  for (const m of String(texto || "").matchAll(/https?:\/\/(?:www\.)?github\.com\/[^\s<>()"'`]+/gi)) {
    const r = lerRepositorio(m[0].replace(/[.,;:!?]+$/, ""));
    if (r && !vistos.has(r.repo.toLowerCase())) {
      vistos.add(r.repo.toLowerCase());
      achados.push(r);
    }
  }
  return achados;
}

/** Os vínculos que valem num pedido: no máximo `max`, sem repetir, cada um conferido. */
export function vinculosValidos(lista, max = 3) {
  const saida = [];
  const vistos = new Set();
  for (const v of Array.isArray(lista) ? lista : []) {
    const r = lerRepositorio(typeof v === "string" ? v : v?.repo);
    if (!r || vistos.has(r.repo.toLowerCase())) continue;
    vistos.add(r.repo.toLowerCase());
    const branch = typeof v === "object" && branchValida(v?.branch) ? v.branch : r.branch;
    saida.push({ repo: r.repo, branch: branch || null });
    if (saida.length >= max) break;
  }
  return saida;
}
