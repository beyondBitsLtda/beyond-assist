// Confere, contra o banco de VERDADE, que o usuário criado pelo `criar-usuario.mjs` consegue
// entrar. É o par natural daquele script: um cria, o outro prova que criou direito.
//
// Existe porque as três peças do login moram em lugares diferentes — a linha no Postgres, o
// PBKDF2 em abacatoAuth.js e a assinatura do cookie — e cada uma pode estar certa sozinha e
// errada em conjunto. Um `select` no banco não prova login nenhum.
//
// A senha vem do arquivo que o criar-usuario.mjs gravou (~/senha-abacato.txt, modo 600) e não
// é impressa em lugar nenhum.
//
// Uso:  node scripts/login-check.mjs            (lê o e-mail do arquivo de senha)
//       node scripts/login-check.mjs outro@email

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chaveDeLogin, conferirChave, criarSessao, lerSessao, COOKIE_SESSAO } from "../src/lib/abacatoAuth.js";

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}

const arquivoSenha = path.join(os.homedir(), "senha-abacato.txt");
let texto = "";
try {
  texto = fs.readFileSync(arquivoSenha, "utf8");
} catch {
  console.error(`não achei ${arquivoSenha} — rode antes o scripts/criar-usuario.mjs.`);
  process.exit(1);
}
const email = (process.argv[2] || texto.match(/e-mail:\s*(\S+)/)?.[1] || "").trim();
const senha = (texto.match(/senha:\s*(\S+)/)?.[1] || "").trim();
if (!email || !senha) {
  console.error(`${arquivoSenha} não está no formato esperado (e-mail: / senha:).`);
  process.exit(1);
}

let falhas = 0;
const conferir = (titulo, ok, detalhe = "") => {
  console.log(`  ${ok ? "ok  " : "FALHOU"}  ${titulo}${detalhe ? `  — ${detalhe}` : ""}`);
  if (!ok) falhas += 1;
};

console.log(`\nLogin do Abacato — ${email} em ${url}\n`);

const sb = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: usuario, error } = await sb
  .from("abacato_usuarios")
  .select("id, email, nome, senha_hash, senha_sal, senha_iter, ativo")
  .ilike("email", email)
  .maybeSingle();

if (error) {
  console.error(`  FALHOU  o banco recusou a consulta — ${error.message}\n`);
  process.exit(1);
}
conferir("o usuário existe no banco", Boolean(usuario), usuario ? usuario.nome : "nenhuma linha");
if (!usuario) process.exit(1);
conferir("a conta está ativa", usuario.ativo === true);
conferir("o hash veio completo", Boolean(usuario.senha_hash && usuario.senha_sal && usuario.senha_iter));

// O caso que importa: a senha que ele vai digitar abre a conta que está gravada.
//
// Repare que isto faz o caminho do NAVEGADOR — estica a senha e compara a chave. É assim que
// o login acontece de verdade desde que o cálculo saiu do servidor, e conferir de outro jeito
// aqui provaria algo que ninguém faz.
const guardada = { hash: usuario.senha_hash, sal: usuario.senha_sal };
const chaveCerta = await chaveDeLogin(email, senha);
conferir("a senha do arquivo confere", await conferirChave(chaveCerta, guardada));
conferir("uma senha errada é recusada", !(await conferirChave(await chaveDeLogin(email, senha + "x"), guardada)));
conferir("senha vazia é recusada", !(await conferirChave(await chaveDeLogin(email, ""), guardada)));

// O e-mail entra no cálculo como sal. Sem isso, a mesma senha em duas contas daria a mesma
// chave — e quem visse uma passaria a entrar na outra.
conferir("a mesma senha em outro e-mail dá outra chave",
  (await chaveDeLogin("outro@abacato", senha)) !== chaveCerta);
conferir("o e-mail não diferencia maiúsculas",
  (await chaveDeLogin(email.toUpperCase(), senha)) === chaveCerta);

// E o cookie que o login devolve volta a virar o mesmo usuário, e só com o segredo certo.
const segredo = process.env.ABACATO_SESSAO_SECRET || "segredo-de-teste-comprido-o-bastante-123456";
const cookie = await criarSessao(usuario, segredo);
const lida = await lerSessao(cookie, segredo);
conferir("a sessão assinada volta a ser o mesmo usuário", lida.ok && lida.usuario?.id === usuario.id);
conferir("com outro segredo, a sessão é recusada", !(await lerSessao(cookie, segredo + "!")).ok);
conferir("o cookie não é o da Lisa", COOKIE_SESSAO === "abacato_sessao", COOKIE_SESSAO);

console.log(falhas === 0 ? "\nTUDO PASSOU — esse e-mail e essa senha entram no Abacato.\n"
                         : `\n${falhas} FALHA(S) — o login não vai funcionar assim.\n`);
process.exit(falhas === 0 ? 0 : 1);
