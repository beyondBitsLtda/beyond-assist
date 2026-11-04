// Cria (ou atualiza) um usuário do Abacato.
//
// A senha é SORTEADA aqui e gravada num arquivo que só o dono lê. Ela não é impressa na tela
// nem passa por chat nenhum — quem precisa dela é você, e o lugar dela é a sua máquina.
//
// Não fala com o banco: imprime o SQL. Assim o mesmo comando serve para o iMac, para um
// backup, ou para o dia em que o banco mudar de lugar — e a senha nunca viaja pela rede junto
// de uma conexão que talvez não esteja cifrada.
//
// Uso:  node scripts/criar-usuario.mjs "bryan@beyond.dev.br" "Bryan"

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { guardarSenha } from "../src/lib/abacatoAuth.js";

const email = (process.argv[2] || "").trim();
const nome = (process.argv[3] || "").trim();
if (!email || !nome) {
  console.error('uso: node scripts/criar-usuario.mjs "email@dominio" "Nome"');
  process.exit(1);
}

// Com `--mesma-senha`, reaproveita a que já está no arquivo em vez de sortear outra.
//
// Serve para REGRAVAR o hash sem trocar o que você digita — foi preciso quando o esquema de
// derivação mudou por causa da trava de iterações do workerd. Sortear uma senha nova ali
// resolveria o hash e quebraria todo lugar onde a antiga já estava anotada.
const manterSenha = process.argv.includes("--mesma-senha");

// Só letras e números: senha com símbolo é chata de digitar no celular, e o que se perde de
// entropia por caractere se recupera com comprimento.
const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const bytes = crypto.getRandomValues(new Uint8Array(24));
let senha = [...bytes].map((b) => alfabeto[b % alfabeto.length]).join("");

if (manterSenha) {
  const anterior = path.join(os.homedir(), "senha-abacato.txt");
  let texto = "";
  try {
    texto = fs.readFileSync(anterior, "utf8");
  } catch {
    console.error(`--mesma-senha pediu ${anterior}, que não existe.`);
    process.exit(1);
  }
  const achada = texto.match(/senha:\s*(\S+)/)?.[1];
  const emailAnterior = texto.match(/e-mail:\s*(\S+)/)?.[1];
  if (!achada) {
    console.error(`${anterior} não está no formato esperado (e-mail: / senha:).`);
    process.exit(1);
  }
  if (emailAnterior && emailAnterior.toLowerCase() !== email.toLowerCase()) {
    // Reaproveitar a senha de OUTRA conta seria dar a duas pessoas a mesma chave sem ninguém
    // pedir por isso.
    console.error(`o arquivo guarda a senha de ${emailAnterior}, não de ${email}.`);
    process.exit(1);
  }
  senha = achada;
}

// `guardarSenha` faz o caminho inteiro: estica a senha como o navegador faria e devolve o
// selo que o servidor guarda. O servidor nunca roda isto — ele nunca recebe a senha.
const { hash, sal, iteracoes } = await guardarSenha(email, senha);

const escapar = (t) => String(t).replace(/'/g, "''");
const sql = `
insert into public.abacato_usuarios (email, nome, senha_hash, senha_sal, senha_iter)
values ('${escapar(email)}', '${escapar(nome)}', '${hash}', '${sal}', ${iteracoes})
on conflict (email) do update
  set nome = excluded.nome,
      senha_hash = excluded.senha_hash,
      senha_sal = excluded.senha_sal,
      senha_iter = excluded.senha_iter,
      ativo = true;
`.trim();

const arquivoSql = path.join(os.tmpdir(), "abacato-usuario.sql");
const arquivoSenha = path.join(os.homedir(), "senha-abacato.txt");
fs.writeFileSync(arquivoSql, sql + "\n");
fs.writeFileSync(arquivoSenha, `Abacato System\ne-mail: ${email}\nsenha:  ${senha}\n`, { mode: 0o600 });

console.log(`SQL gravado em:   ${arquivoSql}`);
console.log(`Senha gravada em: ${arquivoSenha}  (${senha.length} caracteres)`);
console.log("");
console.log("Para aplicar no iMac:");
console.log(`  scp ${arquivoSql} bryan@192.168.1.76:/tmp/ && \\`);
console.log(`  ssh bryan@192.168.1.76 'docker exec -i supabase-db psql -U postgres -d postgres < /tmp/abacato-usuario.sql'`);
