// Confere a tela local do docgen: as travas e o caminho de uso.
//
// Um servidor que navega pelas suas pastas e roda geracao e uma porta aberta na
// sua maquina. As tres travas (so 127.0.0.1, token por sessao, Host conferido)
// sao o que separa "comodidade" de "qualquer aba do navegador usa o docgen pelas
// suas costas". Elas precisam de teste porque nenhuma delas aparece quando se
// usa a tela normalmente — so quando alguem tenta o que nao devia.
//
// Uso:  node scripts/tela-check.mjs

import path from "node:path";
import http from "node:http";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RAIZ = path.join(import.meta.dirname, "..");
const { subir } = require(path.join(RAIZ, "src", "servidor.js"));

let falhas = 0;
const ok = (titulo, bom, detalhe = "") => {
  console.log(`  ${bom ? "ok    " : "FALHOU"}  ${titulo}${detalhe ? `  — ${detalhe}` : ""}`);
  if (!bom) falhas += 1;
};

console.log("\nTela local do docgen\n");

// Porta alta e propria, para nao esbarrar numa tela que ja esteja aberta.
const s = await subir({ porta: 4399 });
const base = `http://127.0.0.1:${s.porta}`;

try {
  // ------------------------------------------------------------- as travas
  const semToken = await fetch(`${base}/`);
  ok("a pagina sem a chave da sessao e recusada", semToken.status === 403, `status ${semToken.status}`);

  const comToken = await fetch(`${base}/?t=${s.token}`);
  ok("com a chave, a pagina abre", comToken.status === 200, `status ${comToken.status}`);

  const api = await fetch(`${base}/api/recentes`);
  ok("a API sem a chave e recusada", api.status === 403, `status ${api.status}`);

  const chaveErrada = await fetch(`${base}/api/recentes`, { headers: { "x-docgen-token": "nao-e-a-chave" } });
  ok("chave errada tambem e recusada", chaveErrada.status === 403, `status ${chaveErrada.status}`);

  // DNS rebinding: o pedido chega com o dominio de fora no cabecalho Host.
  //
  // Precisa de um pedido CRU. O fetch do Node recusa definir o cabecalho Host a
  // mao (e proibido pela especificacao), entao um teste escrito com fetch
  // passava sem nunca ter exercitado a trava — ele mandava o Host certo e
  // recebia 200, que e o comportamento correto para o pedido errado.
  const comHostDeFora = await new Promise((resolve) => {
    const pedido = http.request({
      host: "127.0.0.1", port: s.porta, path: `/?t=${s.token}`, method: "GET",
      headers: { Host: "site-de-fora.com" },
    }, (r) => { r.resume(); resolve(r.statusCode); });
    pedido.on("error", () => resolve(0));
    pedido.end();
  });
  ok("pedido com Host de outro dominio e recusado (DNS rebinding)",
    comHostDeFora === 403, `status ${comHostDeFora}`);

  // ------------------------------------------------------------- navegar
  const cab = { "x-docgen-token": s.token, "content-type": "application/json" };

  const casa = await (await fetch(`${base}/api/pastas`, { headers: cab })).json();
  ok("lista as pastas da pasta pessoal", Array.isArray(casa.pastas), `${casa.pastas?.length} pasta(s)`);
  ok("sabe subir um nivel", Boolean(casa.pai));

  const workspace = path.resolve(RAIZ, "..");
  const nele = await (await fetch(`${base}/api/pastas?caminho=${encodeURIComponent(workspace)}`, { headers: cab })).json();
  ok("navega para um caminho dado", nele.caminho === workspace, nele.caminho);
  ok("marca o que parece repositorio", (nele.pastas || []).some((p) => p.repo),
    (nele.pastas || []).filter((p) => p.repo).map((p) => p.nome).join(", "));
  ok("nao oferece node_modules nem .git",
    !(nele.pastas || []).some((p) => ["node_modules", ".git", "dist"].includes(p.nome)));

  const inexistente = await (await fetch(`${base}/api/pastas?caminho=${encodeURIComponent(path.join(os.homedir(), "nao-existe-mesmo-123"))}`, { headers: cab })).json();
  ok("pasta inexistente vira erro explicado, e nao queda", Boolean(inexistente.erro), inexistente.erro?.slice(0, 40));

  // ------------------------------------------------------------- gerar
  // Sem publicar: o teste nao pode depender de rede nem mexer no Abacato.
  const gerado = await (await fetch(`${base}/api/gerar`, {
    method: "POST", headers: cab,
    body: JSON.stringify({ caminho: RAIZ, publicar: false, semCodigo: true }),
  })).json();
  ok("gera a documentacao pela tela", gerado.ok === true, gerado.erro?.slice(0, 80));
  ok("devolve o que aconteceu, linha a linha", (gerado.log || []).length >= 5,
    `${(gerado.log || []).length} linha(s)`);
  ok("diz onde o arquivo ficou", Boolean(gerado.saida), gerado.saida);

  const semPasta = await (await fetch(`${base}/api/gerar`, {
    method: "POST", headers: cab, body: JSON.stringify({ publicar: false }),
  })).json();
  ok("pedido sem pasta e recusado com explicacao", semPasta.ok === false, semPasta.erro);
} finally {
  s.servidor.close();
}

console.log(falhas === 0 ? "\nTUDO PASSOU\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
