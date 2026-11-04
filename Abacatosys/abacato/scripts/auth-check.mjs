// Exercita a trava de entrada do Abacato, sem rede e sem banco.
//
// Esta é a peça que, errada, abre o sistema inteiro — e erra em silêncio: uma assinatura mal
// conferida não levanta exceção, só deixa passar. Por isso o arquivo importa o MESMO módulo
// que roda em produção e assina de verdade, com WebCrypto.
//
// Metade dos casos é sobre o que NÃO pode passar.

import {
  COOKIE_SESSAO, LIVRES, chaveDeLogin, guardarChave, conferirChave, guardarSenha,
  criarSessao, lerSessao, ehLivre, ehApi, destinoSeguro,
} from "../src/lib/abacatoAuth.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

const SEGREDO = "segredo-de-teste-comprido-o-bastante-123456";
// Poucas iterações só no teste: 210 mil × vinte casos levaria minutos e ninguém rodaria.
const ITER = 1000;

const EMAIL = "bryan@beyond.dev.br";

console.log("\n1) senha: esticada no cliente, guardada de um jeito que não volta");
{
  const guardada = await guardarSenha(EMAIL, "senha-correta", ITER);
  conferir("o que se guarda não contém a senha", !JSON.stringify(guardada).includes("senha-correta"));
  conferir("sal e selo vêm separados", Boolean(guardada.sal && guardada.hash && guardada.sal !== guardada.hash));
  conferir("as iterações são guardadas junto", guardada.iteracoes === ITER,
           "sem isto, mudar o número torna toda senha antiga irreconferível");

  const chave = await chaveDeLogin(EMAIL, "senha-correta", ITER);
  conferir("a senha certa confere", await conferirChave(chave, guardada));
  conferir("a errada não", !(await conferirChave(await chaveDeLogin(EMAIL, "senha-errada", ITER), guardada)));
  conferir("vazia não", !(await conferirChave(await chaveDeLogin(EMAIL, "", ITER), guardada)));
  conferir("nula não", !(await conferirChave(null, guardada)));
  conferir("com um caractere a mais não",
    !(await conferirChave(await chaveDeLogin(EMAIL, "senha-corretaa", ITER), guardada)));

  // Duas pessoas com a MESMA senha precisam ter selos diferentes, senão o banco vazado entrega
  // de graça quem repetiu senha com quem.
  const outra = await guardarSenha(EMAIL, "senha-correta", ITER);
  conferir("a mesma senha gera selos diferentes", outra.hash !== guardada.hash, "o sal não está sendo sorteado");
}

console.log("\n2) a chave que o navegador manda");
{
  // O trabalho pesado saiu do servidor porque o Worker da Cloudflare estourava a CPU depois de
  // três logins — e porque, com o cálculo lá, qualquer pessoa de fora derrubava o login
  // mandando senhas erradas. Estes casos guardam as propriedades que a mudança não pode perder.
  const chave = await chaveDeLogin(EMAIL, "senha-correta", ITER);

  conferir("a chave não é a senha", !chave.includes("senha-correta"));
  conferir("a chave tem tamanho fixo", chave.length === 43, `${chave.length} caracteres`);
  conferir("a mesma senha dá sempre a mesma chave",
    (await chaveDeLogin(EMAIL, "senha-correta", ITER)) === chave,
    "sem isto o login só funcionaria na máquina que cadastrou a senha");

  // O e-mail é o sal. Sem ele no cálculo, a mesma senha em duas contas daria a mesma chave — e
  // quem visse a de uma entraria na outra.
  conferir("outro e-mail dá outra chave",
    (await chaveDeLogin("outra@pessoa.com", "senha-correta", ITER)) !== chave);
  conferir("maiúsculas no e-mail não mudam a chave",
    (await chaveDeLogin(EMAIL.toUpperCase(), "senha-correta", ITER)) === chave,
    "quem digita o e-mail com maiúscula tem de conseguir entrar");
  conferir("espaço em volta do e-mail não muda a chave",
    (await chaveDeLogin(`  ${EMAIL} `, "senha-correta", ITER)) === chave);

  conferir("mais iterações dão outra chave",
    (await chaveDeLogin(EMAIL, "senha-correta", ITER * 2)) !== chave,
    "é o que garante que o número de iterações está mesmo sendo usado");

  conferir("sem senha não há chave", (await chaveDeLogin(EMAIL, "", ITER)) === null);
  conferir("sem e-mail não há chave", (await chaveDeLogin("", "senha-correta", ITER)) === null);

  // O selo do servidor precisa ser barato — é justamente isso que tirou o sistema do ar quando
  // era caro. Vinte selos não podem levar o tempo de uma esticada de senha.
  const comeco = Date.now();
  for (let i = 0; i < 20; i++) await guardarChave(chave, ITER);
  const gasto = Date.now() - comeco;
  conferir("guardar a chave é barato no servidor", gasto < 200, `20 selos em ${gasto}ms`);
}

console.log("\n3) sessão: assinada, e conferida de verdade");
{
  const usuario = { id: "u1", email: "bryan@beyond.dev.br", nome: "Bryan" };
  const cookie = await criarSessao(usuario, SEGREDO, 3600);

  const boa = await lerSessao(cookie, SEGREDO);
  conferir("a sessão válida passa", boa.ok, boa.motivo);
  conferir("e traz quem é", boa.usuario?.email === usuario.email);

  const outroSegredo = await lerSessao(cookie, "outro-segredo-qualquer-aqui-1234567");
  conferir("assinada com outro segredo é recusada", !outroSegredo.ok && outroSegredo.motivo === "assinatura não bate",
           outroSegredo.motivo);

  // O ataque mais simples: trocar o conteúdo e manter a assinatura.
  const [, assinatura] = cookie.split(".");
  const forjado = btoa(JSON.stringify({ id: "invasor", exp: 9999999999 }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") + "." + assinatura;
  conferir("payload trocado com a assinatura antiga é recusado", !(await lerSessao(forjado, SEGREDO)).ok);

  const vencida = await criarSessao(usuario, SEGREDO, -10);
  const r = await lerSessao(vencida, SEGREDO);
  conferir("sessão vencida é recusada", !r.ok && r.motivo === "expirada", r.motivo);

  for (const [nome, valor] of [["vazio", ""], ["nulo", null], ["lixo", "abc"], ["sem ponto", "abcdef"]]) {
    conferir(`cookie ${nome} é recusado`, !(await lerSessao(valor, SEGREDO)).ok);
  }

  const semSegredo = await lerSessao(cookie, "");
  conferir("sem ABACATO_SESSAO_SECRET, nega (não libera geral)", !semSegredo.ok, semSegredo.motivo);
}

console.log("\n4) quem entra sem login — e quem NÃO deveria");
{
  for (const c of ["/entrar", "/api/auth/entrar", "/api/auth/sair", "/api/saude", "/publico/abc", "/api/publico/abc"]) {
    conferir(`livre: ${c}`, ehLivre(c));
  }
  for (const c of ["/", "/quadros", "/quadros/123", "/api/quadros", "/api/cards", "/documentos"]) {
    conferir(`protegido: ${c}`, !ehLivre(c));
  }
  // Armadilhas de prefixo solto — cada uma já abriu um sistema em algum lugar do mundo.
  conferir("/entrarhack NÃO entra por causa de /entrar", !ehLivre("/entrarhack"));
  conferir("/api/authorize NÃO entra por causa de /api/auth/", !ehLivre("/api/authorize"));
  conferir("/api/saude-secreta NÃO entra por /api/saude", !ehLivre("/api/saude-secreta"));
  conferir("/publicoX NÃO entra por /publico/", !ehLivre("/publicoX"));
  conferir("toda entrada da lista tem motivo escrito", LIVRES.every((l) => l.motivo && l.motivo.length > 8));
}

console.log("\n5) API responde diferente de página");
{
  conferir("/api/quadros é API", ehApi("/api/quadros"));
  conferir("/quadros não é API", !ehApi("/quadros"));
}

console.log("\n6) para onde volta depois de entrar");
{
  conferir("caminho interno é preservado", destinoSeguro("/quadros/123") === "/quadros/123");
  conferir("endereço externo vira raiz", destinoSeguro("https://site-falso.com") === "/");
  conferir("//host disfarçado vira raiz", destinoSeguro("//site-falso.com") === "/");
  conferir("voltar para /entrar vira raiz (senão faz laço)", destinoSeguro("/entrar") === "/");
  conferir("vazio vira raiz", destinoSeguro("") === "/");
  conferir("nulo vira raiz", destinoSeguro(null) === "/");
}

console.log("\n7) o nome do cookie não é o da Lisa");
{
  // Os dois sistemas moram em subdomínios do mesmo domínio. Cookie com o mesmo nome seria um
  // pisando no outro, e o sintoma seria "fui deslogado sozinho" em um dos dois.
  conferir("o cookie tem nome próprio", COOKIE_SESSAO === "abacato_sessao", COOKIE_SESSAO);
  conferir("e não é o da Lisa", COOKIE_SESSAO !== "lisa_sessao");
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
