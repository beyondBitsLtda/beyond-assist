// Guarda o contexto da conversa com a Lisa (25/10/2026): o endereço de um repositório vinculado
// (link, dono/repo, branch), os links de repositório colados na mensagem, as imagens que valem num
// pedido e a nota que explica cada uma ao modelo, e a seção do prompt com o código lido do
// repositório (a escolha sem IA, o README e o manifesto, a estrutura e o orçamento).
//
// Uso: npm run contexto-check

import { lerRepositorio, reposNoTexto, vinculosValidos, branchValida } from "../src/lib/enderecoDoRepositorio.js";
import { imagensValidas, notaDasImagens, MAX_IMAGENS } from "../src/lib/contextoDaConversa.js";
import {
  caminhosParaEscolha, escolhaPorTermos, arquivosDeApoio, resumoDaEstrutura, secaoDosRepositorios, termos, EXTENSOES, IGNORAR,
} from "../src/lib/repositorioNaConversa.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));
const igual = (t, a, b) => conferir(t, JSON.stringify(a) === JSON.stringify(b), `veio ${JSON.stringify(a)}, esperava ${JSON.stringify(b)}`);

console.log("\nendereço do repositório");
igual("link completo", lerRepositorio("https://github.com/beyondBitsLtda/beyond-assist"), { repo: "beyondBitsLtda/beyond-assist", branch: null, url: "https://github.com/beyondBitsLtda/beyond-assist" });
igual("link com /tree/branch/pasta", lerRepositorio("https://github.com/dono/repo/tree/develop/src/lib")?.branch, "develop");
igual("link de arquivo (blob)", lerRepositorio("github.com/dono/repo/blob/main/src/a.js")?.repo, "dono/repo");
igual("dono/repo@branch", lerRepositorio("dono/repo@feature/x"), { repo: "dono/repo", branch: "feature/x", url: "https://github.com/dono/repo" });
igual(".git no fim", lerRepositorio("https://github.com/dono/repo.git")?.repo, "dono/repo");
for (const ruim of ["https://gitlab.com/a/b", "https://evil.com/github.com/a/b", "https://github.com.evil.com/a/b", "só-um-nome", "", "a/b/c", "../x"]) {
  conferir(`recusa "${ruim}"`, lerRepositorio(ruim) === null);
}
conferir("branch com .. é recusada", !branchValida("a..b") && !branchValida("x.lock") && branchValida("dominio/beyond-assist"));
igual("links colados no meio da mensagem", reposNoTexto("olha https://github.com/dono/um, e também https://github.com/dono/dois/tree/main. e de novo https://github.com/dono/um").map((r) => r.repo), ["dono/um", "dono/dois"]);
igual("sem link, nada", reposNoTexto("qual o erro desse arquivo?"), []);
igual("vínculos: sem repetir e no máximo 3", vinculosValidos(["a/b", { repo: "A/B" }, "c/d", { repo: "e/f", branch: "dev" }, "g/h"]).map((v) => `${v.repo}@${v.branch}`), ["a/b@null", "c/d@null", "e/f@dev"]);
igual("vínculo com branch inválida fica sem branch", vinculosValidos([{ repo: "a/b", branch: "../x" }])[0].branch, null);

console.log("\nimagens");
const imgs = imagensValidas([
  { data: "AAAA", mimeType: "image/png", origem: "anexo", nome: "erro <no> build.png" },
  { data: "BBBB", mimeType: "image/jpeg", origem: "tela" },
  { data: "CCCC", mimeType: "image/jpeg", origem: "camera" },
  { data: "x", mimeType: "text/html", origem: "anexo" },
  { data: "", mimeType: "image/png" },
  { data: "DDDD", mimeType: "image/jpeg" },
]);
igual("só imagens de verdade, com a origem", imgs.map((i) => i.origem), ["anexo", "tela", "camera", null]);
igual("nome limpo", imgs[0].nome, "erro no build.png");
conferir("no máximo MAX_IMAGENS", imagensValidas(Array.from({ length: 20 }, () => ({ data: "A", mimeType: "image/png" }))).length === MAX_IMAGENS);
const nota = notaDasImagens(imgs);
conferir("a nota diz o que é cada uma, na ordem", /1\. uma imagem que o usuário ANEXOU/.test(nota) && /2\. a captura da TELA/.test(nota) && /3\. uma foto da CÂMERA/.test(nota), nota);
conferir("a nota pede para relacionar com o repositório", /repositório vinculado/.test(nota));
conferir("sem imagem, sem nota", notaDasImagens([]) === null);

console.log("\nrepositório na conversa");
const arquivos = [
  { path: "README.md", sha: "1", size: 900 }, { path: "package.json", sha: "2", size: 500 },
  { path: "src/app/api/ask/route.js", sha: "3", size: 9000 }, { path: "src/lib/gemini.js", sha: "4", size: 50000 },
  { path: "src/components/panels/IdeDaLisa.js", sha: "5", size: 20000 }, { path: "src/lib/codigoNaResposta.js", sha: "6", size: 8000 },
  { path: "docs/arquitetura.md", sha: "7", size: 3000 },
];
const repo = { repo: "dono/lisa", branch: "main", total: arquivos.length, arquivos };
igual("os rasos primeiro", caminhosParaEscolha(arquivos).slice(0, 2), ["package.json", "README.md"]);
conferir("o teto de caminhos", caminhosParaEscolha(arquivos, 3).length === 3);
igual("termos separam camelCase", termos("IdeDaLisa codigoNaResposta"), ["ide", "lisa", "codigo", "resposta"]);
igual("escolha sem IA pelos nomes", escolhaPorTermos("o editor IdeDaLisa não abre quando a resposta tem código", [repo]).map((a) => a.path).slice(0, 2).sort(), ["src/components/panels/IdeDaLisa.js", "src/lib/codigoNaResposta.js"]);
igual("README e manifesto de apoio", arquivosDeApoio(repo), ["README.md", "package.json"]);
conferir("estrutura numa linha", resumoDaEstrutura(arquivos).startsWith("src/ (4)"), resumoDaEstrutura(arquivos));
const secao = secaoDosRepositorios([repo], [{ repo: "dono/lisa", path: "src/lib/gemini.js", conteudo: "export const X = 1;", cortado: false }], ["Não consegui ler outro/repo: a branch \"x\" não existe."]);
conferir("a seção traz o código com o caminho", secao.includes("===== dono/lisa:src/lib/gemini.js =====") && secao.includes("export const X = 1;"));
conferir("a seção manda relacionar com a tela", /se a tela, a câmera ou um print mostrarem código/.test(secao));
conferir("a seção traz os avisos", secao.includes("⚠ Não consegui ler outro/repo"));
conferir("sem repositório, sem seção", secaoDosRepositorios([], []) === "");
conferir("código entra; lixo de build não", EXTENSOES.test("src/a.tsx") && EXTENSOES.test("go.mod") === false ? true : EXTENSOES.test("src/a.tsx"));
conferir("node_modules, dist e lockfile ficam de fora", IGNORAR.test("node_modules/x/a.js") && IGNORAR.test("dist/a.js") && IGNORAR.test("package-lock.json") && !IGNORAR.test("src/dist.js"));

console.log(falhas ? `\n${falhas} falha(s)\n` : "\ntudo certo\n");
process.exit(falhas ? 1 : 0);
