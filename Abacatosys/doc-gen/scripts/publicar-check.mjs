// Prova que a derivacao de senha do publicador e IDENTICA a do Abacato.
//
// Ha duas implementacoes do mesmo calculo: a do Abacato roda no navegador com
// WebCrypto, a daqui roda no Node com node:crypto. Duas implementacoes do mesmo
// algoritmo sempre divergem na primeira vez que alguem mexe numa delas — e o
// sintoma dessa divergencia seria um 401 no meio de uma publicacao, sem nenhuma
// pista de que o problema e o numero de iteracoes ter mudado do outro lado.
//
// Este script compara as duas byte a byte. Se um dia falhar, e porque a
// derivacao do Abacato mudou e o publicador precisa acompanhar.
//
// Nenhuma senha real e usada: os casos de teste sao inventados aqui.
//
// Uso:  node scripts/publicar-check.mjs [caminho/para/abacato]

import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RAIZ = path.join(import.meta.dirname, "..");
const nosso = require(path.join(RAIZ, "src", "publicar.js"));

// O Abacato costuma ficar ao lado, no mesmo repositorio.
const abacato = process.argv[2] || path.join(RAIZ, "..", "abacato");
const authPath = path.join(abacato, "src", "lib", "abacatoAuth.js");

let falhas = 0;
const conferir = (titulo, ok, detalhe = "") => {
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${titulo}${detalhe ? `  — ${detalhe}` : ""}`);
  if (!ok) falhas += 1;
};

console.log("\nDerivacao de senha do publicador\n");

// ---------------------------------------------------------------- casos proprios

// Sem o Abacato por perto o script ainda tem valor: confere as propriedades que
// nao dependem da outra implementacao.
conferir("e-mail diferente da chave diferente",
  nosso.chaveDeLogin("a@x.com", "senha-de-teste") !== nosso.chaveDeLogin("b@x.com", "senha-de-teste"));
conferir("senha diferente da chave diferente",
  nosso.chaveDeLogin("a@x.com", "senha-1") !== nosso.chaveDeLogin("a@x.com", "senha-2"));
conferir("maiusculas no e-mail nao mudam a chave",
  nosso.chaveDeLogin("A@X.COM", "senha-de-teste") === nosso.chaveDeLogin("a@x.com", "senha-de-teste"));
conferir("espaco em volta do e-mail nao muda a chave",
  nosso.chaveDeLogin("  a@x.com ", "senha-de-teste") === nosso.chaveDeLogin("a@x.com", "senha-de-teste"));
conferir("sem e-mail ou sem senha, nao ha chave",
  nosso.chaveDeLogin("", "x") === null && nosso.chaveDeLogin("a@x.com", "") === null);
conferir("a chave e base64url (sem +, / ou =)",
  !/[+/=]/.test(nosso.chaveDeLogin("a@x.com", "senha-de-teste")));

// ---------------------------------------------------------------- contra o Abacato

if (!fs.existsSync(authPath)) {
  console.log(`\n  aviso  nao achei ${authPath}`);
  console.log("         a comparacao com o Abacato foi pulada — passe o caminho como argumento.");
} else {
  const deLa = await import(pathToFileURL(authPath).href);
  const casos = [
    ["maria@exemplo.com.br", "uma-senha-qualquer-de-teste"],
    ["JOAO@Exemplo.COM", "Outra Senha 123"],
    ["c@d.e", "x"],
    ["acentos@exemplo.com.br", "senha-com-acentuação-é-ç"],
    ["emoji@exemplo.com.br", "senha-com-emoji-🥑"],
  ];
  let iguais = 0;
  for (const [email, senha] of casos) {
    const aqui = nosso.chaveDeLogin(email, senha);
    const la = await deLa.chaveDeLogin(email, senha);
    const bate = aqui === la;
    if (bate) iguais += 1;
    else conferir(`chave igual para ${email}`, false, `aqui=${aqui.slice(0, 12)}… la=${String(la).slice(0, 12)}…`);
  }
  conferir(`as duas implementacoes dao a mesma chave (${iguais}/${casos.length} casos)`, iguais === casos.length);

  // O selo guardado no banco tambem precisa bater: e ele que o servidor compara.
  const guardada = await deLa.guardarSenha("teste@exemplo.com.br", "senha-de-teste");
  const chaveDaqui = nosso.chaveDeLogin("teste@exemplo.com.br", "senha-de-teste");
  conferir("o Abacato aceita a chave calculada aqui",
    await deLa.conferirChave(chaveDaqui, guardada));
  conferir("e recusa uma chave de outra senha",
    !(await deLa.conferirChave(nosso.chaveDeLogin("teste@exemplo.com.br", "outra"), guardada)));
}

console.log(falhas === 0 ? "\nTUDO PASSOU\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
