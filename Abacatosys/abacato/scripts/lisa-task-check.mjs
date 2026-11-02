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
import { DOCUMENTOS, ehDocumentos, criarSessao, lerSessao, COOKIE_VISUAL } from "../src/lib/abacatoAuth.js";

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

  const rodar = (cookie) => {
    const html = { atributos: {}, setAttribute(k, v) { this.atributos[k] = v; } };
    const ouvintes = [];
    const document = { cookie, documentElement: html, title: "Abacato System", addEventListener: (_, f) => ouvintes.push(f) };
    new Function("document", script)(document);
    ouvintes.forEach((f) => f());
    return { visual: html.atributos["data-visual"], titulo: document.title };
  };
  const lisa = rodar("abacato-tema=x; abacato_visual=lisa; outro=1");
  conferir("com o cookie, liga o visual da Lisa", lisa.visual === "lisa");
  conferir("e o título vira Lisa Task", lisa.titulo === "Lisa Task");
  conferir("cookie no começo também vale", rodar("abacato_visual=lisa").visual === "lisa");
  conferir("sem o cookie, fica o Abacato", rodar("outro=1").visual === undefined);
  conferir("outro valor não liga", rodar("abacato_visual=lisax").visual === undefined);
  conferir("outro cookie com o mesmo final não liga", rodar("meu_abacato_visual=lisa").visual === undefined);
}

console.log(falhas ? `\n${falhas} falha(s)\n` : "\ntudo certo\n");
process.exit(falhas ? 1 : 0);
