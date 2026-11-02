// A conta Lisa Task: o Abacato com o nome e o visual da Lisa, sem a parte de documentos.
//
// Sem rede e sem banco. Confere o plano, a lista de rotas de documentos que o middleware barra,
// o tipo que vai na sessão (é dele que o middleware tira o plano) e o script do <head> que liga
// o visual. A trava no banco (`exigirDocumentos`, em src/lib/acesso.js) precisa de sessão de
// verdade — fica para o cliente-limites-check, que fala por HTTP.
//
// Uso:  node scripts/lisa-task-check.mjs

import fs from "node:fs";
import { PLANOS, planoDe, tipoValido, deFora, RECADOS } from "../src/dominio/planos.js";
import { DOCUMENTOS, ehDocumentos, ehLivre, criarSessao, lerSessao, COOKIE_VISUAL } from "../src/lib/abacatoAuth.js";
import {
  decidirEntrada, origensDaLisa, origemPermitida, nomeDaPessoa, ORIGEM_DA_LISA,
  ehLisaTask, ENDERECO_DA_LISA_TASK, ENDERECO_DO_ABACATO,
} from "../src/dominio/entradaDaLisa.js";

let falhas = 0;
const conferir = (t, cond, d = "") => {
  console.log(`  ${cond ? "ok    " : "FALHOU"}  ${t}${!cond && d ? `  — ${d}` : ""}`);
  if (!cond) falhas += 1;
};

console.log("\n1) o plano");
{
  const p = planoDe("lisatask");
  conferir("o tipo existe", tipoValido("lisatask") && p === PLANOS.lisatask);
  conferir("chama Lisa Task", p.rotulo === "Lisa Task");
  conferir("não tem documentos", p.documentos === false);
  conferir("nem projeto, nem arquivo", p.projetos === 0 && p.projetosCompartilhados === 0 && p.armazenamento === 0);
  conferir("tem os quadros de tarefas (os tetos do cliente)",
    p.quadros === PLANOS.cliente.quadros && p.membrosPorQuadro === PLANOS.cliente.membrosPorQuadro);
  conferir("não fala com a assistente do Abacato e não vê o diretório", p.lisa === false && p.verDiretorio === false);
  conferir("tem o visual da Lisa", p.visual === "lisa");
  conferir("interno e cliente continuam com documentos", PLANOS.interno.documentos && PLANOS.cliente.documentos);
  conferir("interno e cliente continuam com o visual do Abacato", !PLANOS.interno.visual && !PLANOS.cliente.visual);
  conferir("o recado fala da Lisa Task", /Lisa Task/.test(RECADOS.semDocumentos));
}

console.log("\n2) quem é de fora (não administra, não fala com a assistente)");
conferir("interno é da casa", deFora("interno") === false);
conferir("cliente é de fora", deFora("cliente") === true);
conferir("Lisa Task é de fora", deFora("lisatask") === true);
conferir("tipo desconhecido é de fora", deFora(undefined) === true && deFora("admin") === true);

console.log("\n3) as rotas de documentos");
for (const c of ["/documentos", "/documentos/abc", "/api/projetos", "/api/projetos/1/membros",
  "/api/projetos/1/documentos", "/api/documentos/1/abrir", "/api/pastas/1"]) {
  conferir(`barra ${c}`, ehDocumentos(c));
}
for (const c of ["/quadros", "/quadros/1", "/api/itens/1", "/api/links/1", "/api/cards/1/links",
  "/documentosx", "/api/projetosx", "/dashboards", "/conta"]) {
  conferir(`deixa ${c}`, !ehDocumentos(c));
}
conferir("a lista é só de documentos", DOCUMENTOS.length === 4);

console.log("\n4) o tipo vai na sessão");
{
  const SEGREDO = "segredo-de-teste-comprido-o-bastante-123456";
  const cookie = await criarSessao({ id: "u1", email: "a@b.c", nome: "A", tipo: "lisatask" }, SEGREDO);
  const s = await lerSessao(cookie, SEGREDO);
  conferir("a sessão confere", s.ok);
  conferir("e traz o tipo", s.usuario?.tipo === "lisatask", JSON.stringify(s.usuario));
  conferir("trocar o tipo quebra a assinatura", !(await lerSessao(
    Buffer.from(JSON.stringify({ ...s.usuario, tipo: "interno" })).toString("base64url") + "." + cookie.split(".")[1],
    SEGREDO,
  )).ok);
}

console.log("\n5) o script do <head> que liga o visual");
{
  // O script real, tirado do layout e montado como o template literal monta.
  const fonte = fs.readFileSync(new URL("../src/app/layout.js", import.meta.url), "utf8");
  const bruto = fonte.match(/const SCRIPT_DO_VISUAL = `([\s\S]*?)`;/)?.[1];
  conferir("o layout tem o script", Boolean(bruto));
  const script = new Function("return `" + bruto + "`;")();
  conferir("o script procura o mesmo cookie que o middleware grava", script.includes(COOKIE_VISUAL + "=lisa"));

  // Um <head> de mentira: os dois ícones que o metadata do Next escreve e um observador que só
  // guarda a função, para o teste "trocar de tela" na mão.
  const rodar = (cookie) => {
    const html = { atributos: {}, setAttribute(k, v) { this.atributos[k] = v; } };
    const link = (rel, href) => ({ a: { rel, href }, getAttribute(k) { return this.a[k]; }, setAttribute(k, v) { this.a[k] = v; } });
    const icones = [link("icon", "/marca/app-192.png"), link("apple-touch-icon", "/marca/app-apple.png")];
    const head = { querySelectorAll: () => icones };
    const observadores = [];
    class Observador { constructor(f) { this.f = f; observadores.push(this); } observe(alvo) { this.alvo = alvo; } }
    const ouvintes = [];
    const document = { cookie, documentElement: html, head, title: "Abacato System", addEventListener: (_, f) => ouvintes.push(f) };
    new Function("document", "MutationObserver", script)(document, Observador);
    ouvintes.forEach((f) => f());
    return { visual: html.atributos["data-visual"], document, icones, observadores, hrefs: () => icones.map((i) => i.a.href) };
  };
  const lisa = rodar("abacato-tema=x; abacato_visual=lisa; outro=1");
  conferir("com o cookie, liga o visual da Lisa", lisa.visual === "lisa");
  conferir("e o título vira Lisa Task", lisa.document.title === "Lisa Task");
  conferir("e o ícone da aba vira o da Lisa", lisa.hrefs().join() === "/marca/lisa-192.png,/marca/lisa-apple.png", lisa.hrefs().join());
  conferir("os ícones da Lisa existem em public/marca",
    ["lisa-192.png", "lisa-apple.png"].every((f) => fs.existsSync(new URL(`../public/marca/${f}`, import.meta.url))));

  // A troca de tela: o Next escreve de novo o título e o ícone do Abacato no <head>.
  lisa.document.title = "Abacato System";
  lisa.icones[0].a.href = "/marca/app-192.png";
  conferir("vigia o <head>", lisa.observadores.length === 1 && lisa.observadores[0].alvo === lisa.document.head);
  lisa.observadores.forEach((o) => o.f());
  conferir("depois de trocar de tela, a aba continua Lisa Task", lisa.document.title === "Lisa Task" && lisa.hrefs()[0] === "/marca/lisa-192.png");

  const abacato = rodar("outro=1");
  conferir("sem o cookie, fica o Abacato (título, ícone, e nada vigiando)", abacato.visual === undefined &&
    abacato.document.title === "Abacato System" && abacato.hrefs()[0] === "/marca/app-192.png" && abacato.observadores.length === 0);
  conferir("cookie no começo também vale", rodar("abacato_visual=lisa").visual === "lisa");
  conferir("outro valor não liga", rodar("abacato_visual=lisax").visual === undefined);
  conferir("outro cookie com o mesmo final não liga", rodar("meu_abacato_visual=lisa").visual === undefined);
}

console.log("\n6) entrar com a conta da Lisa (src/dominio/entradaDaLisa.js)");
{
  conferir("sem conta no Abacato: cria", decidirEntrada(null) === "criar");
  conferir("conta Lisa Task ativa: entra", decidirEntrada({ tipo: "lisatask", ativo: true, aprovado: true }) === "entrar");
  conferir("conta Lisa Task desativada (ou não aprovada): não entra",
    decidirEntrada({ tipo: "lisatask", ativo: false }) === "desativada" &&
    decidirEntrada({ tipo: "lisatask", ativo: true, aprovado: false }) === "desativada");
  conferir("conta interna ou de cliente com o mesmo e-mail: só com a senha do Abacato",
    decidirEntrada({ tipo: "interno", ativo: true }) === "senha" && decidirEntrada({ tipo: "cliente", ativo: true }) === "senha");

  const lisa = origensDaLisa(undefined);
  conferir("sem LISA_ORIGEM, só a Lisa de produção", lisa.length === 1 && lisa[0] === ORIGEM_DA_LISA);
  conferir("a origem da Lisa passa; outro site, nenhuma ou \"null\" não",
    origemPermitida("https://lisa.beyond.dev.br", lisa) && !origemPermitida("https://lisa.beyond.dev.br.mal.com", lisa) &&
    !origemPermitida("https://abacato.beyond.dev.br", lisa) && !origemPermitida(null, lisa) && !origemPermitida("null", lisa));
  conferir("LISA_ORIGEM aceita mais de uma, com ou sem barra no fim",
    origemPermitida("http://localhost:3000", origensDaLisa("https://lisa.beyond.dev.br/, http://localhost:3000")));

  conferir("o nome vem do Auth, ou do começo do e-mail",
    nomeDaPessoa({ email: "a@b.c", metadados: { nome: " Alice " } }) === "Alice" &&
    nomeDaPessoa({ email: "maria.silva@b.c" }) === "Maria silva" && nomeDaPessoa({}) === "Pessoa da Lisa");

  const rota = fs.readFileSync(new URL("../src/app/api/auth/lisa/route.js", import.meta.url), "utf8");
  conferir("a rota confere a origem, a pessoa no Supabase Auth, e cria só conta Lisa Task sem poderes",
    /origemPermitida\(req\.headers\.get\("origin"\)/.test(rota) && /\/auth\/v1\/user/.test(rota) &&
    /tipo: "lisatask",[\s\S]*admin: false,\s*lisa: false/.test(rota));
  conferir("a rota fica fora do portão de sessão (quem chega ainda não tem sessão do Abacato)", ehLivre("/api/auth/lisa"));
}

console.log("\n7) o endereço da Lisa Task (lisatask.beyond.dev.br)");
{
  conferir("reconhece o endereço, com ou sem porta, maiúscula ou não",
    ehLisaTask(ENDERECO_DA_LISA_TASK) && ehLisaTask("LisaTask.beyond.dev.br:443"));
  conferir("o Abacato, um parecido e nenhum não são a Lisa Task",
    !ehLisaTask(ENDERECO_DO_ABACATO) && !ehLisaTask("lisatask.beyond.dev.br.mal.com") &&
    !ehLisaTask("x.lisatask.beyond.dev.br") && !ehLisaTask(undefined) && !ehLisaTask(""));

  const wrangler = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  conferir("o Worker atende os dois endereços",
    [ENDERECO_DO_ABACATO, ENDERECO_DA_LISA_TASK].every((e) => wrangler.includes(`{ "pattern": "${e}", "custom_domain": true }`)));

  const middleware = fs.readFileSync(new URL("../src/middleware.js", import.meta.url), "utf8");
  conferir("sem sessão, o endereço da Lisa Task já dá o visual da Lisa",
    /pedido === "lisa" \|\| ehLisaTask\(req\.headers\.get\("host"\)\)\) return comVisual\(req, resposta, "lisa"\)/.test(middleware));

  const rota = fs.readFileSync(new URL("../src/app/api/auth/lisa/route.js", import.meta.url), "utf8");
  conferir("conta interna que chega pela Lisa Task segue para o endereço do Abacato",
    /decisao === "senha"\)[\s\S]{0,80}ehLisaTask\(req\.headers\.get\("host"\)\) \? `https:\/\/\$\{ENDERECO_DO_ABACATO\}\/quadros`/.test(rota));

  const entrar = fs.readFileSync(new URL("../src/app/entrar/page.js", import.meta.url), "utf8");
  conferir("a tela de entrar, no visual da Lisa, leva de volta à entrada pela Lisa", /href=\{`\$\{ORIGEM_DA_LISA\}\/lisa-task`\}/.test(entrar));
}

console.log(falhas ? `\n${falhas} falha(s)\n` : "\ntudo certo\n");
process.exit(falhas ? 1 : 0);
