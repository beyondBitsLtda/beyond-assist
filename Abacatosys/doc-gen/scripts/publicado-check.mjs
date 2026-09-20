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
ok("o codigo-fonte esta escrito no HTML", html.includes("dg-code__gutter"));
ok("o realce de sintaxe ja veio aplicado", html.includes('class="t-kw"'));
ok("nao sobrou blob JSON para o navegador montar", !html.includes("dgFontes"));
ok("o que abre e fecha e <details>", (html.match(/<details/g) || []).length > 20,
  `${(html.match(/<details/g) || []).length} blocos`);
ok("a navegacao lateral e por ancora", html.includes('href="#sec-'));
ok("o campo de filtro nasce escondido (so aparece com script)",
  html.includes(".dg-filtro{display:none"));

// ---------------------------------------------------------------- de-marcado
ok("nenhuma marca do gerador antigo na saida",
  !/fluig|corpore|totvs\s+rm|delp-docgen|barlow/i.test(html));

console.log(falhas === 0 ? "\nTUDO PASSOU\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
