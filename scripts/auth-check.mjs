// Testa a trava de entrada sem rede e sem subir nada.
//
// O que esta trava decide é binário e perigoso nos dois sentidos: liberar demais devolve o
// problema que ela veio resolver; liberar de menos tranca a Lisa para fora do próprio relógio,
// e isso falha em SILÊNCIO — o cron roda no horário, leva 401, e ninguém vê.
//
// Por isso o arquivo importa o MESMO módulo que roda em produção e exercita as decisões de
// verdade, inclusive assinando tokens com Web Crypto para conferir a assinatura.

import {
  COOKIE_SESSAO,
  LIVRES,
  conferirToken,
  destinoSeguro,
  ehApi,
  ehLivre,
  lerPayload,
  precisaRenovar,
  segundosAteExpirar,
} from "../src/lib/authSession.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

// --- ferramenta: assina um JWT como o Supabase assinaria -----------------------------------
const b64url = (bytes) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function assinar(payload, segredo) {
  const cabecalho = b64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const corpo = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const chave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(`${cabecalho}.${corpo}`));
  return `${cabecalho}.${corpo}.${b64url(new Uint8Array(assinatura))}`;
}

const SEGREDO = "segredo-de-teste-com-tamanho-suficiente-123456";
const agora = Math.floor(Date.now() / 1000);

console.log("\n1) quem passa sem login — e quem NÃO deveria passar");
{
  // Estes precisam ser livres: são máquina, e já têm segredo próprio dentro da rota.
  for (const c of ["/login", "/api/auth/login", "/api/auth/logout",
                   "/api/cron/sync", "/api/cron/notify", "/api/cron/deploy-check",
                   "/api/lisa-code/chat", "/api/lisa-code/pending-work", "/api/health", "/sw.js"]) {
    conferir(`livre: ${c}`, ehLivre(c));
  }
  // E estes NÃO podem ser livres, senão a trava não serve para nada.
  for (const c of ["/", "/dashboard", "/assistant", "/api/tasks", "/api/thoughts",
                   "/api/delp-tasks", "/api/pair", "/api/notifications/subscribe",
                   // /auth-check é o portão que o Caddy empresta para proteger a tela do
                   // iMac. Se ele virasse livre, responderia 204 para qualquer um e a tela
                   // ficaria aberta — sem nenhum erro aparecer em lugar nenhum.
                   "/auth-check"]) {
    conferir(`protegido: ${c}`, !ehLivre(c));
  }
  // Armadilha clássica: prefixo que "quase" bate não pode abrir a porta.
  conferir("/api/cronometro NÃO entra por causa de /api/cron/", !ehLivre("/api/cronometro"),
           "o prefixo livre termina em barra justamente por isso");
  // Estes três já passaram batido uma vez: o teste tinha um `|| true` que o fazia passar
  // sempre, escondendo que a comparação por prefixo solto realmente os liberava.
  conferir("/loginhack NÃO entra por causa de /login", !ehLivre("/loginhack"));
  conferir("/sw.js.map NÃO entra por causa de /sw.js", !ehLivre("/sw.js.map"));
  conferir("/api/healthcheck-secreto NÃO entra por /api/health", !ehLivre("/api/healthcheck-secreto"));
  conferir("toda entrada da lista tem motivo escrito", LIVRES.every((l) => l.motivo && l.motivo.length > 8));
}

console.log("\n2) API responde diferente de página");
{
  conferir("/api/tasks é API", ehApi("/api/tasks"));
  conferir("/dashboard não é API", !ehApi("/dashboard"));
}

console.log("\n3) assinatura: o que vale e o que não vale");
{
  const bom = await assinar({ sub: "u1", exp: agora + 3600 }, SEGREDO);
  const r1 = await conferirToken(bom, SEGREDO, agora);
  conferir("token bem assinado passa", r1.ok, r1.motivo);

  const outro = await assinar({ sub: "u1", exp: agora + 3600 }, "outro-segredo-qualquer-aqui-123456");
  const r2 = await conferirToken(outro, SEGREDO, agora);
  conferir("token assinado com outro segredo é recusado", !r2.ok && r2.motivo === "assinatura não bate", r2.motivo);

  // O ataque mais simples: trocar o conteúdo mantendo a assinatura.
  const partes = bom.split(".");
  const forjado = [partes[0], b64url(new TextEncoder().encode(JSON.stringify({ sub: "invasor", exp: agora + 99999 }))), partes[2]].join(".");
  const r3 = await conferirToken(forjado, SEGREDO, agora);
  conferir("payload trocado mantendo a assinatura é recusado", !r3.ok, r3.motivo);

  const vencido = await assinar({ sub: "u1", exp: agora - 10 }, SEGREDO);
  const r4 = await conferirToken(vencido, SEGREDO, agora);
  conferir("token vencido é recusado", !r4.ok && r4.motivo === "expirado", r4.motivo);
  conferir("e devolve o payload, para dar pra renovar", Boolean(r4.payload));

  for (const [nome, valor] of [["vazio", ""], ["nulo", null], ["lixo", "abc"], ["duas partes", "a.b"]]) {
    const r = await conferirToken(valor, SEGREDO, agora);
    conferir(`token ${nome} é recusado`, !r.ok, r.motivo);
  }

  const semSegredo = await conferirToken(bom, "", agora);
  conferir("sem SUPABASE_JWT_SECRET, nega (não libera geral)", !semSegredo.ok, semSegredo.motivo);
}

console.log("\n4) renovação antes de doer");
{
  const daquiAPouco = { exp: agora + 120 };
  const bemLonge = { exp: agora + 3600 };
  conferir("com 2 min de vida, marca para renovar", precisaRenovar(daquiAPouco, 300, agora));
  conferir("com 1 h de vida, não renova à toa", !precisaRenovar(bemLonge, 300, agora));
  conferir("segundosAteExpirar dá negativo no vencido", segundosAteExpirar({ exp: agora - 5 }, agora) < 0);
  conferir("payload sem exp é tratado como vencido", segundosAteExpirar({}, agora) === -Infinity);
}

console.log("\n5) para onde volta depois de entrar");
{
  conferir("caminho interno é preservado", destinoSeguro("/tasks") === "/tasks");
  conferir("endereço externo vira raiz", destinoSeguro("https://site-falso.com") === "/");
  conferir("//host disfarçado vira raiz", destinoSeguro("//site-falso.com") === "/", destinoSeguro("//site-falso.com"));
  conferir("voltar para /login vira raiz (senão faz laço)", destinoSeguro("/login") === "/");
  conferir("voltar para /auth-check vira raiz (é 204 vazio, não é tela)", destinoSeguro("/auth-check") === "/");
  conferir("vazio vira raiz", destinoSeguro("") === "/");
  conferir("nulo vira raiz", destinoSeguro(null) === "/");
}

console.log("\n6) leitura do payload não decide nada sozinha");
{
  const t = await assinar({ sub: "u1", email: "a@b.c", exp: agora + 10 }, SEGREDO);
  conferir("lerPayload lê o conteúdo", lerPayload(t)?.email === "a@b.c");
  conferir("lerPayload devolve null em lixo", lerPayload("nao-e-token") === null);
  conferir("o nome do cookie está definido", typeof COOKIE_SESSAO === "string" && COOKIE_SESSAO.length > 3);
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
