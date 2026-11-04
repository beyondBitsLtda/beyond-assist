// Cria uma integração: um token que abre UM quadro para outro sistema.
//
// Mesma ideia do criar-usuario: o token é SORTEADO aqui e gravado num arquivo que só o dono lê.
// Não aparece na tela e não passa por chat nenhum. O banco recebe só o SHA-256 dele.
//
// Não fala com o banco: escreve o SQL num arquivo, para você aplicar com `npm run migrar`.
// O SQL acha o quadro e a coluna PELO NOME e recusa se achar zero ou mais de um — melhor
// falhar alto do que ligar o token ao quadro errado.
//
// Uso:  node scripts/criar-integracao.mjs "Beyond-Lead" "CRM" "Alvos"
//         1º nome da integração (vira a `origem` dos cards que ela criar)
//         2º nome do quadro
//         3º parte do nome da coluna de entrada; sem ele, a integração só LÊ

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gerarToken, hashDoToken } from "../src/dominio/integracao.js";

const [nome, quadro, coluna] = process.argv.slice(2).map((a) => (a || "").trim());
if (!nome || !quadro) {
  console.error('uso: node scripts/criar-integracao.mjs "Nome da integração" "Nome do quadro" ["Coluna de entrada"]');
  process.exit(1);
}

const token = gerarToken();
const hash = await hashDoToken(token);

const escapar = (t) => String(t).replace(/'/g, "''");
const slug = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");

const acharColuna = coluna
  ? `
  select count(*) into n from public.abacato_colunas
   where quadro_id = q and not arquivada and nome ilike '%${escapar(coluna)}%';
  if n <> 1 then
    raise exception 'esperava 1 coluna com "%" no nome, achei %', '${escapar(coluna)}', n;
  end if;
  select id into c from public.abacato_colunas
   where quadro_id = q and not arquivada and nome ilike '%${escapar(coluna)}%';`
  : "";

const sql = `-- Integração "${nome}" → quadro "${quadro}"${coluna ? `, criando cards na coluna "${coluna}"` : " (só leitura)"}.
-- Gerado por scripts/criar-integracao.mjs. Contém só o SHA-256 do token, não o token.
do $$
declare q uuid; c uuid; n int;
begin
  select count(*) into n from public.abacato_quadros where nome = '${escapar(quadro)}' and not arquivado;
  if n <> 1 then
    raise exception 'esperava 1 quadro ativo chamado "%", achei %', '${escapar(quadro)}', n;
  end if;
  select id into q from public.abacato_quadros where nome = '${escapar(quadro)}' and not arquivado;
${acharColuna}
  insert into public.abacato_integracoes (nome, quadro_id, coluna_entrada_id, token_hash)
  values ('${escapar(nome)}', q, c, '${hash}');
end $$;
`;

const arquivoToken = path.join(os.homedir(), `token-integracao-${slug}.txt`);
const arquivoSql = path.join(os.homedir(), `integracao-${slug}.sql`);

fs.writeFileSync(arquivoToken,
  `integração: ${nome}\nquadro: ${quadro}\ncoluna de entrada: ${coluna || "(só leitura)"}\ntoken: ${token}\n`,
  { mode: 0o600 });
fs.writeFileSync(arquivoSql, sql);

console.log(`
Token gravado em   ${arquivoToken}   (só você lê)
SQL gravado em     ${arquivoSql}

Próximos passos:
  1. npm run migrar db/012-integracoes.sql        (uma vez só; pode repetir)
  2. npm run migrar ${arquivoSql}
  3. Guarde o token como segredo do sistema que vai usar (no Beyond-Lead: o secret ABACATO_TOKEN
     no GitHub). Depois disso, apague o arquivo do token.

Revogar:  update public.abacato_integracoes set ativo = false where nome = '${escapar(nome)}';
`);
