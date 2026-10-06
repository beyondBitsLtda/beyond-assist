// Aplica um arquivo .sql no banco, pelo mesmo caminho que o Studio do Supabase usa.
//
// Existe porque não havia nenhum: as migrações eram aplicadas à mão, e "à mão" não deixa
// rastro de qual rodou onde. O endpoint /pg/query aceita a chave de serviço e roda SQL
// completo — inclusive DDL, que a API REST não faz.
//
// NÃO É UM SISTEMA DE MIGRAÇÃO. Não guarda o que já rodou nem desfaz nada. É o mínimo para
// aplicar um arquivo sem sair do terminal, e todo arquivo do db/ é escrito para poder rodar
// duas vezes sem estragar nada (add column if not exists, create table if not exists).
//
// Uso:  node --env-file=.env.local scripts/migrar.mjs db/008-lisa.sql

import fs from "node:fs";
import path from "node:path";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("\nInforme o arquivo:  node --env-file=.env.local scripts/migrar.mjs db/008-lisa.sql\n");
  process.exit(1);
}

const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !chave) {
  console.error("faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}

const caminho = path.resolve(arquivo);
if (!fs.existsSync(caminho)) {
  console.error(`não achei ${caminho}`);
  process.exit(1);
}
const sql = fs.readFileSync(caminho, "utf8");

console.log(`\nAplicando ${path.basename(caminho)} em ${new URL(base).hostname}\n`);

const r = await fetch(`${base}/pg/query`, {
  method: "POST",
  headers: { "content-type": "application/json", apikey: chave, Authorization: `Bearer ${chave}` },
  body: JSON.stringify({ query: sql }),
});

const texto = await r.text();
if (!r.ok) {
  console.error(`  FALHOU (${r.status})`);
  console.error(`  ${texto.slice(0, 600)}\n`);
  process.exit(1);
}

let dados = null;
try { dados = JSON.parse(texto); } catch { /* DDL costuma devolver [] */ }
console.log("  ok    o banco aceitou");
if (Array.isArray(dados) && dados.length) {
  console.log("  " + JSON.stringify(dados).slice(0, 400));
}
console.log("");
