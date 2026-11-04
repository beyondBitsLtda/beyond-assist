// Exercita a importação do Trello por HTTP, contra o servidor e o banco de verdade.
//
// O `trello-check` prova que o arquivo é LIDO certo. Este prova que ele é GRAVADO certo — e,
// principalmente, prova o que só existe quando há banco no meio: importar o mesmo quadro duas
// vezes não pode duplicar nada.
//
// Essa é a garantia que mais importa na prática. Uma importação de um quadro grande pode falhar
// no meio — rede de casa, aba fechada, servidor reiniciado — e a reação natural é rodar de
// novo. Se a segunda rodada duplicar tudo, o estrago é pior que o da primeira falha, e sem
// desfazer.
//
// Uso:  ABACATO_URL=http://localhost:3000 node scripts/importar-check.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chaveDeLogin } from "../src/lib/abacatoAuth.js";
import { exportacaoDeExemplo } from "./exemplo-trello.mjs";
import { enxugarExportacao } from "../src/dominio/trello.js";

const BASE = process.env.ABACATO_URL || "http://localhost:3000";

let falhas = 0;
const ok = (t, d = "") => console.log(`  ok     ${t}${d ? `  — ${d}` : ""}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA  ${t}${d ? `  — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

let cookie = "";
async function chamar(caminho, { metodo = "GET", corpo } = {}) {
  const res = await fetch(BASE + caminho, {
    method: metodo,
    headers: { ...(corpo ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const guardar = res.headers.get("set-cookie");
  if (guardar) cookie = guardar.split(";")[0];
  const texto = await res.text();
  let dados = {};
  try { dados = JSON.parse(texto); } catch { dados = { _texto: texto.slice(0, 200) }; }
  return { status: res.status, dados };
}

async function precisa(descricao, promessa) {
  const r = await promessa;
  if (r.status >= 400 || r.dados.ok === false) {
    console.log(`\n  PAROU: ${descricao} — ${r.status} ${r.dados.error || r.dados._texto || ""}\n`);
    process.exit(1);
  }
  return r.dados;
}

const arquivo = path.join(os.homedir(), "senha-abacato.txt");
let email = "", senha = "";
try {
  const t = fs.readFileSync(arquivo, "utf8");
  email = t.match(/e-mail:\s*(\S+)/)?.[1] || "";
  senha = t.match(/senha:\s*(\S+)/)?.[1] || "";
} catch {
  console.error(`não achei ${arquivo} — rode antes o scripts/criar-usuario.mjs.`);
  process.exit(1);
}

console.log(`\nImportação do Trello — ${BASE}\n`);
console.log("1) entrar");
await precisa("login", chamar("/api/auth/entrar", { metodo: "POST", corpo: { email, chave: await chaveDeLogin(email, senha) } }));
ok("sessão aberta");

// Sufixo novo a cada execução: o índice de origem é global, e sem isso a segunda vez que este
// script rodasse encontraria o quadro da primeira e testaria outra coisa.
const sufixo = `t${Date.now().toString(36)}`;
const exportacao = enxugarExportacao(exportacaoDeExemplo(sufixo));

// ------------------------------------------------------------------ prévia

console.log("\n2) prévia, sem gravar nada");
const previa = await precisa("prévia", chamar("/api/importar/trello", {
  metodo: "POST", corpo: { trello: exportacao },     // sem `confirmar`
}));
conferir("a prévia diz que é prévia", previa.previa === true);
conferir("e conta o que vai entrar", previa.resumo.cards === 5 && previa.resumo.colunas === 3,
  JSON.stringify(previa.resumo));
conferir("e não criou quadro nenhum", !("quadroId" in previa));

const antes = await precisa("listar", chamar("/api/quadros"));
conferir("a lista de quadros não mudou", !antes.quadros.some((q) => q.nome.includes(sufixo)));

// ------------------------------------------------------------------ primeira importação

console.log("\n3) importar de verdade");
const primeira = await precisa("importar", chamar("/api/importar/trello", {
  metodo: "POST", corpo: { trello: exportacao, confirmar: true },
}));
conferir("o quadro foi criado", Boolean(primeira.quadroId));
conferir("e não era um quadro que já existia", primeira.jaExistia === false);
const qid = primeira.quadroId;

const q1 = await precisa("abrir o quadro", chamar(`/api/quadros/${qid}`));
conferir("o nome veio do Trello", q1.quadro.nome.includes("Obra"), q1.quadro.nome);
conferir("o papel de parede foi escolhido", Boolean(q1.quadro.papelDeParede));
conferir("quatro etiquetas", q1.quadro.etiquetas.length === 4, `${q1.quadro.etiquetas.length}`);

// A lista arquivada não aparece no quadro — mas os cards dela existem no banco. O quadro mostra
// duas colunas, e é isso que se quer: o arquivado fica guardado, fora da frente.
conferir("duas colunas à vista (a arquivada não aparece)", q1.quadro.colunas.length === 2,
  q1.quadro.colunas.map((c) => c.nome).join(", "));

const cards = q1.quadro.colunas.flatMap((c) => c.cards);
conferir("quatro cards à vista", cards.length === 4, `${cards.length}`);

const art = cards.find((c) => c.titulo === "Renovar ART");
conferir("o card principal chegou", Boolean(art));
conferir("com a descrição", art?.descricao === "Vence este mês.");
conferir("com o prazo", art?.fimEm?.startsWith("2026-10-15"));
conferir("com a data de início", art?.inicioEm?.startsWith("2026-10-01"));
conferir("com duas etiquetas", art?.etiquetas.length === 2, JSON.stringify(art?.etiquetas.map((e) => e.nome)));
conferir("com a capa laranja", art?.capa === "#F97316", art?.capa);
conferir("com um link só (o upload do Trello não veio)", art?.links.length === 1, JSON.stringify(art?.links));
conferir("marcado como vindo do Trello", art?.origem === "trello");

const docs = art?.checklists.find((c) => c.titulo === "Documentos");
conferir("a checklist veio", Boolean(docs));
conferir("com os dois itens, na ordem", docs?.itens.map((i) => i.texto).join(" | ") === "Cópia do contrato | Assinatura do responsável",
  docs?.itens.map((i) => i.texto).join(" | "));
conferir("e com o estado de cada um", docs?.itens[0].feito === true && docs?.itens[1].feito === false);

// Sem o `concluido`, este card apareceria vermelho de atrasado num quadro recém-importado.
const medicao = cards.find((c) => c.titulo.startsWith("Medição"));
conferir("o card já resolvido no Trello chega concluído", medicao?.concluido === true);
conferir("e não conta como atrasado", q1.resumo.porPrazo.atrasado === 0, JSON.stringify(q1.resumo.porPrazo));

// ------------------------------------------------------------------ a garantia que importa

console.log("\n4) importar o MESMO quadro de novo");
const segunda = await precisa("reimportar", chamar("/api/importar/trello", {
  metodo: "POST", corpo: { trello: exportacao, confirmar: true },
}));
conferir("reconhece o quadro que já existe", segunda.jaExistia === true);
conferir("e é o mesmo quadro, não um novo", segunda.quadroId === qid);

const q2 = await precisa("reabrir", chamar(`/api/quadros/${qid}`));
conferir("as colunas não duplicaram", q2.quadro.colunas.length === q1.quadro.colunas.length,
  `${q1.quadro.colunas.length} -> ${q2.quadro.colunas.length}`);
conferir("as etiquetas não duplicaram", q2.quadro.etiquetas.length === 4, `${q2.quadro.etiquetas.length}`);

const cards2 = q2.quadro.colunas.flatMap((c) => c.cards);
conferir("os cards não duplicaram", cards2.length === cards.length, `${cards.length} -> ${cards2.length}`);

const art2 = cards2.find((c) => c.titulo === "Renovar ART");
conferir("as checklists não duplicaram", art2?.checklists.length === art?.checklists.length,
  `${art?.checklists.length} -> ${art2?.checklists.length}`);
conferir("os itens de checklist não duplicaram",
  art2?.checklists.find((c) => c.titulo === "Documentos")?.itens.length === 2);
conferir("os links não duplicaram", art2?.links.length === 1, `${art2?.links.length}`);
conferir("as etiquetas do card não duplicaram", art2?.etiquetas.length === 2);

// ------------------------------------------------------------------ o trabalho local sobrevive

console.log("\n5) reimportar não desfaz o que foi feito aqui");
const item = art2.checklists.find((c) => c.titulo === "Documentos").itens.find((i) => !i.feito);
await precisa("marcar um item aqui", chamar(`/api/itens/${item.id}`, { metodo: "PATCH", corpo: { feito: true } }));
await precisa("mudar o título aqui", chamar(`/api/cards/${art2.id}`, { metodo: "PATCH", corpo: { titulo: "Renovar ART (revisado aqui)" } }));

await precisa("reimportar pela terceira vez", chamar("/api/importar/trello", {
  metodo: "POST", corpo: { trello: exportacao, confirmar: true },
}));
const q3 = await precisa("reabrir", chamar(`/api/quadros/${qid}`));
const art3 = q3.quadro.colunas.flatMap((c) => c.cards).find((c) => c.id === art2.id);
conferir("o título editado aqui continua", art3?.titulo === "Renovar ART (revisado aqui)", art3?.titulo);
conferir("o item marcado aqui continua marcado",
  art3?.checklists.find((c) => c.titulo === "Documentos")?.itens.every((i) => i.feito) === true);

// ------------------------------------------------------------------ arquivo errado

console.log("\n6) arquivo errado é recusado");
for (const [corpo, oQue] of [
  [{ trello: { name: "x" }, confirmar: true }, "JSON sem listas e cards"],
  [{ trello: "texto", confirmar: true }, "um texto no lugar do arquivo"],
  [{ confirmar: true }, "nenhum arquivo"],
]) {
  const r = await chamar("/api/importar/trello", { metodo: "POST", corpo });
  conferir(`${oQue} dá 400`, r.status === 400, `deu ${r.status} — ${r.dados.error || ""}`);
}

// ------------------------------------------------------------------ limpar

console.log("\n7) arquivar o que foi criado");
await precisa("arquivar", chamar(`/api/quadros/${qid}`, { metodo: "DELETE" }));
ok("o quadro de teste foi arquivado", "fica guardado no banco, fora da lista");

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU — a importação funciona e é repetível.\n");
process.exit(falhas ? 1 : 0);
