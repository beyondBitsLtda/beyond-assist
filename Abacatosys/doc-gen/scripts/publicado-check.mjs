// Confere, contra o Abacato de verdade, que o caminho INTEIRO funciona:
// gerar → publicar → o documento abre no visor.
//
// Os outros testes conferem pedaços. Este confere a junção, que é onde as coisas
// quebram: o portal pode estar perfeito no disco e aparecer em branco no visor,
// porque lá ele é desenhado num <iframe sandbox=""> sem permissão nenhuma — o
// script não roda. Foi exatamente o que acontecia com a biblioteca de código
// antes de o realce passar a ser aplicado aqui, no gerador.
//
// Usa o mesmo ~/.docgen-abacato.json da publicação. Nenhuma senha é impressa.
//
// Uso:  node scripts/publicado-check.mjs <nome-do-documento>
//       (padrão: o último documento do projeto configurado)

import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RAIZ = path.join(import.meta.dirname, "..");
const { chaveDeLogin, lerConfig } = require(path.join(RAIZ, "src", "publicar.js"));

let falhas = 0;
const ok = (titulo, bom, detalhe = "") => {
  console.log(`  ${bom ? "ok    " : "FALHOU"}  ${titulo}${detalhe ? `  — ${detalhe}` : ""}`);
  if (!bom) falhas += 1;
};

let cfg;
try { cfg = lerConfig(); }
catch (e) { console.error("\n" + e.message + "\n"); process.exit(1); }

console.log(`\nDocumentacao publicada — ${cfg.url}\n`);

const entrada = await fetch(cfg.url + "/api/auth/entrar", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: cfg.email, chave: chaveDeLogin(cfg.email, cfg.senha) }),
});
ok("entro no Abacato com a configuracao de publicacao", entrada.status === 200, `status ${entrada.status}`);
if (entrada.status !== 200) { console.log("\n1 FALHA(S)\n"); process.exit(1); }
const cookie = entrada.headers.get("set-cookie").split(";")[0];

const lista = await (await fetch(cfg.url + "/api/projetos", { headers: { cookie } })).json();
const projeto = (lista.projetos || []).find((p) => p.nome === cfg.projeto);
ok(`o projeto "${cfg.projeto}" existe`, Boolean(projeto));
if (!projeto) { console.log(`\n${falhas} FALHA(S)\n`); process.exit(1); }

const dentro = await (await fetch(`${cfg.url}/api/projetos/${projeto.id}`, { headers: { cookie } })).json();
const documentos = (dentro.documentos || []).filter((d) => /\.doc\.html$/i.test(d.nome));
ok("ha pelo menos um portal publicado", documentos.length > 0, `${documentos.length} portal(is)`);

const alvo = process.argv[2]
  ? documentos.find((d) => d.nome === process.argv[2])
  : documentos[documentos.length - 1];
if (!alvo) {
  console.log(`  FALHOU  nao achei "${process.argv[2]}" — publicados: ${documentos.map((d) => d.nome).join(", ")}`);
  console.log(`\n${falhas + 1} FALHA(S)\n`);
  process.exit(1);
}
console.log(`  (conferindo "${alvo.nome}")`);

ok("o Abacato guarda mais de uma revisao dele", alvo.revisoes >= 1, `${alvo.revisoes} revisao(oes)`);

const abrir = await (await fetch(`${cfg.url}/api/documentos/${alvo.id}/abrir`, { headers: { cookie } })).json();
ok("o Abacato o abre como HTML, e nao como download", abrir.jeito === "html", String(abrir.jeito));

const resposta = await fetch(abrir.url);
const html = await resposta.text();
ok("o arquivo e servido inteiro", resposta.status === 200 && html.length > 10000,
  `status ${resposta.status}, ${Math.round(html.length / 1024)} KB`);

// ---------------------------------------------------------------- sem script
// Cada uma destas foi um defeito real, ou seria um se o desenho mudasse.
// Um portal pode ter sido gerado com "portal leve" (--sem-codigo), e ai nao ha
// biblioteca nenhuma para conferir. Exigir o codigo embutido de todo portal
// fazia este teste reprovar uma opcao que a propria ferramenta oferece.
// Procura a classe USADA (`class="dg-code__gutter"`), e nao a definida no CSS
// (`.dg-code__gutter{`). O tema sempre traz a regra; so o portal com codigo
// embutido traz o elemento.
const temBiblioteca = html.includes('class="dg-code__gutter"');
const blocos = (html.match(/<details/g) || []).length;
if (temBiblioteca) {
  ok("o codigo-fonte esta escrito no HTML", true);
  ok("o realce de sintaxe ja veio aplicado", html.includes('class="t-kw"'));
} else {
  console.log("  (portal leve: gerado sem o codigo embutido)");
  ok("o portal diz por que nao ha biblioteca", html.includes("sem-codigo"));
}
// O que importa e que ABRA SEM SCRIPT, e nao que sejam muitos. Um limiar de 20
// reprovava o portal de um repositorio de quatro arquivos — que estava perfeito.
ok("o que abre e fecha e <details>, e nao script", blocos > 0, `${blocos} blocos`);
ok("a navegacao lateral e por ancora", html.includes('href="#sec-'));
ok("o campo de filtro nasce escondido (so aparece com script)",
  html.includes(".dg-filtro{display:none"));

// ---------------------------------------------------------------- de-marcado
//
// As provas daqui olham o que O GERADOR ESCREVE, e nao o arquivo inteiro.
//
// A primeira versao varria o HTML todo procurando "fluig", "dgFontes" e afins —
// e acusou um portal legitimo. O documento em questao descreve uma aplicacao de
// baixo codigo: o codigo-fonte dela, embutido na biblioteca, cita a plataforma
// em cada arquivo, e ainda traz uma copia de um portal antigo com o blob JSON
// dentro. Nada daquilo era saida do gerador; era o gerador mostrando fielmente
// o repositorio, que e o trabalho dele.
//
// Um verificador que confunde "o que a ferramenta diz" com "o que a ferramenta
// cita" ensina a ignorar o resultado — e o que ele acusaria primeiro seria
// justamente a documentacao dos sistemas antigos, que e a que mais importa.
// O <head> e onde o portal declara o que ELE e: a fonte que pede, os tokens do
// tema, a marca do gerador. Qualquer string antiga que apareca depois dele esta
// dentro de um <pre>, e texto num <pre> nao pinta nada — e so o portal mostrando
// o repositorio, inclusive quando o repositorio guarda um portal antigo inteiro.
const fimDaCabeca = html.indexOf("</head>");
const cabeca = fimDaCabeca > 0 ? html.slice(0, fimDaCabeca) : html.slice(0, 200000);

ok("a marca do gerador no <meta> e a nova",
  cabeca.includes('name="dg-gerador" content="docgen"'));
ok("o rodape nao traz a marca antiga",
  !/>\s*delp\s*<\/b>\s*docs/i.test(html) && !html.includes("delp-docgen 1.0.0"));
ok("a fonte pedida e a do Abacato, e nao a antiga",
  cabeca.includes("family=Inter") && !cabeca.includes("family=Barlow"));
ok("o codigo nao vai mais num blob para o navegador montar",
  !html.includes('type="application/json" id="dgFontes">['));
ok("a paleta do tema e a nova",
  cabeca.includes("--dg-verde:#22C55E") && !cabeca.includes("--dg-red:#CC0F10"));

console.log(falhas === 0 ? "\nTUDO PASSOU\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
