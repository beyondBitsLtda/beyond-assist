// Exercita o quadro inteiro por HTTP, contra o servidor e o banco de verdade.
//
// Os outros scripts provam as regras isoladas. Este prova o que só aparece quando as peças se
// encontram: a permissão que sobe do item de checklist até o quadro, a posição calculada no
// servidor no instante da solta, a checklist copiada sem as marcas, o card recorrente que
// nasce ao abrir o quadro. Nenhuma dessas passa por uma função só.
//
// Cria um quadro de teste, mexe nele até o fim e ARQUIVA no final. Não apaga nada que já
// existia, e o arquivamento deixa rastro em vez de sumir com a prova quando algo dá errado.
//
// Uso:  ABACATO_URL=http://localhost:3000 node scripts/quadro-check.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chaveDeLogin } from "../src/lib/abacatoAuth.js";

const BASE = process.env.ABACATO_URL || "http://localhost:3000";

let falhas = 0;
const ok = (t, d = "") => console.log(`  ok     ${t}${d ? `  — ${d}` : ""}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA  ${t}${d ? `  — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t, cond === true ? "" : "") : falha(t, d));

let cookie = "";

async function chamar(caminho, { metodo = "GET", corpo } = {}) {
  const res = await fetch(BASE + caminho, {
    method: metodo,
    headers: { ...(corpo ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    redirect: "manual",
  });
  const guardar = res.headers.get("set-cookie");
  if (guardar) cookie = guardar.split(";")[0];
  const texto = await res.text();
  let dados = {};
  try { dados = JSON.parse(texto); } catch { dados = { _texto: texto.slice(0, 200) }; }
  return { status: res.status, dados };
}

/** Falha alto e para: daqui para a frente tudo dependeria do passo que não deu certo, e vinte
 *  falhas em cascata escondem qual foi a primeira. */
async function precisa(descricao, promessa) {
  const r = await promessa;
  if (r.status >= 400 || r.dados.ok === false) {
    console.log(`\n  PAROU: ${descricao} — ${r.status} ${r.dados.error || r.dados._texto || ""}\n`);
    process.exit(1);
  }
  return r.dados;
}

// ------------------------------------------------------------------ entrar

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

console.log(`\nQuadro do Abacato — ${BASE}\n`);
console.log("1) entrar");
await precisa("login", chamar("/api/auth/entrar", { metodo: "POST", corpo: { email, chave: await chaveDeLogin(email, senha) } }));
ok("sessão aberta");

// ------------------------------------------------------------------ criar

console.log("\n2) criar o quadro");
const marca = `[teste ${new Date().toISOString().slice(0, 16)}]`;
const { quadro: q } = await precisa("criar quadro", chamar("/api/quadros", { metodo: "POST", corpo: { nome: `${marca} conferência` } }));
const qid = q.id;
ok("quadro criado", qid.slice(0, 8));

let estado = await precisa("abrir quadro", chamar(`/api/quadros/${qid}`));
conferir("nasce com três colunas", estado.quadro.colunas.length === 3, `veio ${estado.quadro.colunas.length}`);
conferir("as colunas vêm na ordem certa",
  estado.quadro.colunas.map((c) => c.nome).join(" > ") === "A fazer > Fazendo > Feito",
  estado.quadro.colunas.map((c) => c.nome).join(" > "));
conferir("o dono aparece como pessoa do quadro", estado.quadro.membros.some((m) => m.email === email),
  JSON.stringify(estado.quadro.membros.map((m) => m.email)));
conferir("o dono pode tudo", estado.poderes.editar && estado.poderes.criar && estado.poderes.apagar);

const [afazer, fazendo, feito] = estado.quadro.colunas;

// ------------------------------------------------------------------ cards

console.log("\n3) cards e ordem");
for (const t of ["primeiro", "segundo", "terceiro"]) {
  await precisa(`criar card ${t}`, chamar(`/api/colunas/${afazer.id}/cards`, { metodo: "POST", corpo: { titulo: t } }));
}
const noTopo = await precisa("criar no topo", chamar(`/api/colunas/${afazer.id}/cards`, { metodo: "POST", corpo: { titulo: "urgente", noTopo: true } }));

estado = await precisa("reabrir", chamar(`/api/quadros/${qid}`));
let col = estado.quadro.colunas.find((c) => c.id === afazer.id);
conferir("quatro cards na coluna", col.cards.length === 4, `${col.cards.length}`);
conferir("o 'noTopo' foi mesmo para o topo", col.cards[0].titulo === "urgente", col.cards.map((c) => c.titulo).join(", "));
conferir("os outros mantiveram a ordem de criação",
  col.cards.slice(1).map((c) => c.titulo).join(",") === "primeiro,segundo,terceiro",
  col.cards.map((c) => c.titulo).join(", "));

// ------------------------------------------------------------------ arrastar

console.log("\n4) arrastar (a posição é calculada no servidor)");
const cardUrgente = col.cards[0];
await precisa("mover para o meio de outra coluna", chamar(`/api/cards/${cardUrgente.id}`, {
  metodo: "PATCH", corpo: { mover: { colunaId: fazendo.id, indice: 0 } },
}));
estado = await precisa("reabrir", chamar(`/api/quadros/${qid}`));
conferir("o card mudou de coluna",
  estado.quadro.colunas.find((c) => c.id === fazendo.id).cards.some((c) => c.id === cardUrgente.id));
conferir("e saiu da coluna antiga",
  !estado.quadro.colunas.find((c) => c.id === afazer.id).cards.some((c) => c.id === cardUrgente.id));

// Reordenar DENTRO da mesma coluna é o caso que mais quebra: o próprio card precisa sair da
// conta antes de calcular a posição, senão ele fica entre ele mesmo e o vizinho e não anda.
col = estado.quadro.colunas.find((c) => c.id === afazer.id);
const ultimo = col.cards[col.cards.length - 1];
await precisa("mover para o topo da mesma coluna", chamar(`/api/cards/${ultimo.id}`, {
  metodo: "PATCH", corpo: { mover: { colunaId: afazer.id, indice: 0 } },
}));
estado = await precisa("reabrir", chamar(`/api/quadros/${qid}`));
col = estado.quadro.colunas.find((c) => c.id === afazer.id);
conferir("reordenar na mesma coluna funciona", col.cards[0].id === ultimo.id,
  col.cards.map((c) => c.titulo).join(", "));

// ------------------------------------------------------------------ etiquetas e pessoas

console.log("\n5) etiquetas, responsáveis e prazo");
const { etiqueta } = await precisa("criar etiqueta", chamar(`/api/quadros/${qid}/etiquetas`, {
  metodo: "POST", corpo: { nome: "urgente", cor: "#EF4444" },
}));
const corInvalida = await chamar(`/api/quadros/${qid}/etiquetas`, { metodo: "POST", corpo: { nome: "x", cor: "#123456" } });
conferir("cor fora da paleta é recusada", corInvalida.status === 400, `deu ${corInvalida.status}`);

const alvo = col.cards[0];
await precisa("pôr etiqueta", chamar(`/api/cards/${alvo.id}/etiquetas`, { metodo: "PUT", corpo: { etiquetas: [etiqueta.id] } }));
await precisa("pôr responsável", chamar(`/api/cards/${alvo.id}/responsaveis`, { metodo: "PUT", corpo: { responsaveis: [estado.eu.id] } }));
await precisa("pôr prazo", chamar(`/api/cards/${alvo.id}`, { metodo: "PATCH", corpo: { fimEm: "2020-01-01T09:00" } }));

estado = await precisa("reabrir", chamar(`/api/quadros/${qid}`));
let cardAlvo = estado.quadro.colunas.flatMap((c) => c.cards).find((c) => c.id === alvo.id);
conferir("a etiqueta grudou", cardAlvo.etiquetas.length === 1 && cardAlvo.etiquetas[0].nome === "urgente");
conferir("o responsável grudou", cardAlvo.responsaveis.length === 1 && cardAlvo.responsaveis[0].email === email);
conferir("o prazo vencido conta como atrasado no resumo", estado.resumo.porPrazo.atrasado === 1,
  JSON.stringify(estado.resumo.porPrazo));

const forasteiro = await chamar(`/api/cards/${alvo.id}/responsaveis`, {
  metodo: "PUT", corpo: { responsaveis: ["00000000-0000-0000-0000-000000000000"] },
});
conferir("quem não tem acesso ao quadro não vira responsável", forasteiro.status === 400, `deu ${forasteiro.status}`);

// ------------------------------------------------------------------ checklists

console.log("\n6) checklists");
const { checklist } = await precisa("criar checklist", chamar(`/api/cards/${alvo.id}/checklists`, {
  metodo: "POST", corpo: { titulo: "Antes de entregar" },
}));
const { itens } = await precisa("colar uma lista", chamar(`/api/checklists/${checklist.id}/itens`, {
  metodo: "POST", corpo: { texto: "- conferir o texto\n- rodar o build\n* avisar o cliente" },
}));
conferir("três linhas viraram três itens", itens.length === 3, `${itens.length}`);
conferir("os marcadores foram embora", itens[0].texto === "conferir o texto", itens[0].texto);

await precisa("marcar um item", chamar(`/api/itens/${itens[0].id}`, { metodo: "PATCH", corpo: { feito: true } }));

// O copiar-e-colar de checklist: a mesma lista, em outro card, TUDO desmarcado.
const outro = estado.quadro.colunas.find((c) => c.id === feito.id);
const { card: cardDoFeito } = await precisa("card na terceira coluna", chamar(`/api/colunas/${outro.id}/cards`, {
  metodo: "POST", corpo: { titulo: "recebe a checklist colada" },
}));
await precisa("colar a checklist", chamar(`/api/cards/${cardDoFeito.id}/checklists`, {
  metodo: "POST", corpo: { copiarDe: checklist.id },
}));

estado = await precisa("reabrir", chamar(`/api/quadros/${qid}`));
const colado = estado.quadro.colunas.flatMap((c) => c.cards).find((c) => c.id === cardDoFeito.id);
conferir("a checklist colada tem o mesmo título", colado.checklists[0]?.titulo === "Antes de entregar");
conferir("e os mesmos três itens", colado.checklists[0]?.itens.length === 3);
conferir("todos DESMARCADOS", colado.checklists[0]?.itens.every((i) => !i.feito),
  JSON.stringify(colado.checklists[0]?.itens.map((i) => i.feito)));

// ------------------------------------------------------------------ links

console.log("\n7) links");
await precisa("link http", chamar(`/api/cards/${alvo.id}/links`, { metodo: "POST", corpo: { url: "https://beyond.dev.br" } }));
const perigoso = await chamar(`/api/cards/${alvo.id}/links`, { metodo: "POST", corpo: { url: "javascript:alert(1)" } });
conferir("link javascript: é recusado", perigoso.status === 400, `deu ${perigoso.status}`);
const torto = await chamar(`/api/cards/${alvo.id}/links`, { metodo: "POST", corpo: { url: "nao é url" } });
conferir("endereço inválido é recusado", torto.status === 400, `deu ${torto.status}`);

// ------------------------------------------------------------------ copiar card

console.log("\n8) copiar card");
await precisa("copiar", chamar(`/api/cards/${alvo.id}/copiar`, { metodo: "POST", corpo: {} }));
estado = await precisa("reabrir", chamar(`/api/quadros/${qid}`));
const copia = estado.quadro.colunas.flatMap((c) => c.cards).find((c) => c.titulo.endsWith("(cópia)"));
conferir("a cópia existe", Boolean(copia));
conferir("levou a etiqueta", copia?.etiquetas.length === 1);
conferir("levou o link", copia?.links.length === 1);
conferir("levou a checklist", copia?.checklists.length === 1 && copia.checklists[0].itens.length === 3);
conferir("mas com os itens DESMARCADOS", copia?.checklists[0].itens.every((i) => !i.feito),
  JSON.stringify(copia?.checklists[0].itens.map((i) => i.feito)));

// ------------------------------------------------------------------ recorrência

console.log("\n9) tarefa que se repete");
const { recorrencia } = await precisa("criar recorrência", chamar(`/api/quadros/${qid}/recorrencias`, {
  metodo: "POST", corpo: { colunaId: afazer.id, titulo: "Backup diário", regra: "diaria" },
}));
conferir("a próxima data foi calculada", Boolean(recorrencia.proxima_em), recorrencia.proxima_em);

const regraTorta = await chamar(`/api/quadros/${qid}/recorrencias`, {
  metodo: "POST", corpo: { colunaId: afazer.id, titulo: "x", regra: "quinzenal" },
});
conferir("regra inválida é recusada antes de gravar", regraTorta.status === 400, `deu ${regraTorta.status}`);

const antes = estado.quadro.colunas.find((c) => c.id === afazer.id).cards.length;
estado = await precisa("reabrir", chamar(`/api/quadros/${qid}`));
const depois = estado.quadro.colunas.find((c) => c.id === afazer.id).cards.length;
conferir("a recorrência de hoje virou card ao abrir o quadro", depois === antes + 1, `${antes} -> ${depois}`);

// Abrir de novo NÃO pode duplicar — é para isso que serve o índice único (origem, origem_id).
estado = await precisa("reabrir de novo", chamar(`/api/quadros/${qid}`));
const terceiraVez = estado.quadro.colunas.find((c) => c.id === afazer.id).cards.length;
conferir("abrir de novo não duplica o card recorrente", terceiraVez === depois, `${depois} -> ${terceiraVez}`);

// ------------------------------------------------------------------ fronteiras entre quadros

console.log("\n10) o que um quadro não pode fazer com o outro");
const { quadro: q2 } = await precisa("segundo quadro", chamar("/api/quadros", { metodo: "POST", corpo: { nome: `${marca} vizinho` } }));
const estado2 = await precisa("abrir o vizinho", chamar(`/api/quadros/${q2.id}`));
const colunaVizinha = estado2.quadro.colunas[0];

const mudouDeQuadro = await chamar(`/api/cards/${alvo.id}`, {
  metodo: "PATCH", corpo: { mover: { colunaId: colunaVizinha.id, indice: 0 } },
});
conferir("não dá para mover um card para outro quadro", mudouDeQuadro.status === 403, `deu ${mudouDeQuadro.status}`);

const { etiqueta: etiquetaVizinha } = await precisa("etiqueta do vizinho", chamar(`/api/quadros/${q2.id}/etiquetas`, {
  metodo: "POST", corpo: { nome: "de fora", cor: "#2362D3" },
}));
const etiquetaDeFora = await chamar(`/api/cards/${alvo.id}/etiquetas`, {
  metodo: "PUT", corpo: { etiquetas: [etiquetaVizinha.id] },
});
conferir("não dá para usar etiqueta de outro quadro", etiquetaDeFora.status === 400, `deu ${etiquetaDeFora.status}`);

const inventado = await chamar(`/api/quadros/00000000-0000-0000-0000-000000000000`);
conferir("quadro inexistente dá 404 (e não 403)", inventado.status === 404, `deu ${inventado.status}`);

// ------------------------------------------------------------------ arquivar

console.log("\n11) arquivar");
const cardsNaColuna = estado.quadro.colunas.find((c) => c.id === feito.id).cards.length;
await precisa("arquivar coluna", chamar(`/api/colunas/${feito.id}`, { metodo: "DELETE" }));
estado = await precisa("reabrir", chamar(`/api/quadros/${qid}`));
conferir("a coluna sumiu do quadro", !estado.quadro.colunas.some((c) => c.id === feito.id));
conferir("e os cards dela foram junto",
  !estado.quadro.colunas.flatMap((c) => c.cards).some((c) => c.id === cardDoFeito.id),
  `a coluna tinha ${cardsNaColuna}`);

await precisa("arquivar o quadro", chamar(`/api/quadros/${qid}`, { metodo: "DELETE" }));

// Arquivar só não é um caminho sem volta se houver como ver e trazer de volta. O quadro
// continua inteiro no banco; o que faltava era a lista.
const arquivados = await precisa("listar arquivados", chamar("/api/quadros?arquivados=1"));
conferir("o quadro arquivado aparece na lista de arquivados",
  arquivados.quadros.some((x) => x.id === qid), `${arquivados.quadros.length} arquivado(s)`);
conferir("e a lista de arquivados se identifica como tal", arquivados.mostrandoArquivados === true);

const semArquivados = await precisa("listar ativos", chamar("/api/quadros"));
conferir("a lista normal não mostra o arquivado", !semArquivados.quadros.some((x) => x.id === qid));
conferir("mas diz quantos há", semArquivados.arquivados >= 1, `${semArquivados.arquivados}`);

await precisa("restaurar", chamar(`/api/quadros/${qid}`, { metodo: "PATCH", corpo: { arquivado: false } }));
const voltou = await precisa("listar de novo", chamar("/api/quadros"));
conferir("o quadro restaurado volta para a lista", voltou.quadros.some((x) => x.id === qid));

const cheioDeNovo = await precisa("abrir o restaurado", chamar(`/api/quadros/${qid}`));
conferir("e volta com o conteúdo intacto", cheioDeNovo.quadro.colunas.length > 0,
  `${cheioDeNovo.quadro.colunas.length} coluna(s)`);

await precisa("arquivar de novo", chamar(`/api/quadros/${qid}`, { metodo: "DELETE" }));
await precisa("arquivar o vizinho", chamar(`/api/quadros/${q2.id}`, { metodo: "DELETE" }));
const lista = await precisa("listar", chamar("/api/quadros"));
conferir("quadro arquivado some da lista", !lista.quadros.some((x) => x.id === qid));
ok("os dois quadros de teste foram arquivados", "ficam guardados no banco, fora da lista");

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU — o quadro funciona de ponta a ponta.\n");
process.exit(falhas ? 1 : 0);
