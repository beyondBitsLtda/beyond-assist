// Exercita o repositório de documentos por HTTP, contra o servidor e o banco de verdade.
//
// Duas coisas aqui importam mais que as outras, e as duas envolvem perder trabalho:
//
//   AS VERSÕES NÃO PODEM SE PERDER. Um repositório em que a versão 2 some quando a 3 sobe é
//   uma pasta compartilhada com passos extras. "O cliente aprovou qual versão?" só tem
//   resposta se as versões existirem separadas.
//
//   O ARQUIVO NÃO PODE SOBRAR SEM DONO. Se a linha falhar depois do envio, sobra um arquivo
//   ocupando espaço que ninguém sabe de onde veio; se o envio falhar depois da linha, sobra um
//   documento que aparece na tela e nunca abre.
//
// Uso:  ABACATO_URL=http://localhost:3000 node scripts/documento-check.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chaveDeLogin } from "../src/lib/abacatoAuth.js";

const BASE = process.env.ABACATO_URL || "http://localhost:3000";

let falhas = 0;
const ok = (t, d = "") => console.log(`  ok     ${t}${d ? `  — ${d}` : ""}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA  ${t}${d ? `  — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

let cookie = "";
async function chamar(caminho, { metodo = "GET", corpo, form } = {}) {
  const res = await fetch(BASE + caminho, {
    method: metodo,
    headers: { ...(corpo ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: form || (corpo ? JSON.stringify(corpo) : undefined),
  });
  const guardar = res.headers.get("set-cookie");
  if (guardar) cookie = guardar.split(";")[0];
  const texto = await res.text();
  let dados = {};
  try { dados = JSON.parse(texto); } catch { dados = { _texto: texto.slice(0, 160) }; }
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

const arquivoSenha = path.join(os.homedir(), "senha-abacato.txt");
let email = "", senha = "";
try {
  const t = fs.readFileSync(arquivoSenha, "utf8");
  email = t.match(/e-mail:\s*(\S+)/)?.[1] || "";
  senha = t.match(/senha:\s*(\S+)/)?.[1] || "";
} catch {
  console.error(`não achei ${arquivoSenha} — rode antes o scripts/criar-usuario.mjs.`);
  process.exit(1);
}

/** Um arquivo de mentira, com conteúdo de verdade. */
function arquivoDe(nome, conteudo, tipo) {
  return new File([conteudo], nome, { type: tipo });
}

console.log(`\nDocumentos do Abacato — ${BASE}\n`);
console.log("1) entrar");
await precisa("login", chamar("/api/auth/entrar", { metodo: "POST", corpo: { email, chave: await chaveDeLogin(email, senha) } }));
ok("sessão aberta");

// ------------------------------------------------------------------ projeto

console.log("\n2) criar o projeto");
const marca = `[teste ${new Date().toISOString().slice(0, 16)}]`;
const { projeto } = await precisa("criar", chamar("/api/projetos", {
  metodo: "POST", corpo: { nome: `${marca} documentos`, cor: "#2362D3" },
}));
const pid = projeto.id;
ok("projeto criado", pid.slice(0, 8));

let estado = await precisa("abrir", chamar(`/api/projetos/${pid}`));
conferir("nasce sem pastas", estado.pastas.length === 0);
conferir("e sem documentos", estado.documentos.length === 0);
conferir("o dono pode tudo", estado.poderes.editar && estado.poderes.criar && estado.poderes.apagar);

// ------------------------------------------------------------------ pastas que aninham

console.log("\n3) pastas e subpastas");
const { pasta: contratos } = await precisa("criar pasta", chamar(`/api/projetos/${pid}/pastas`, {
  metodo: "POST", corpo: { nome: "Contratos" },
}));
const { pasta: ano } = await precisa("criar subpasta", chamar(`/api/projetos/${pid}/pastas`, {
  metodo: "POST", corpo: { nome: "2026", paiId: contratos.id },
}));
conferir("a subpasta aponta para a pasta mãe", ano.pai_id === contratos.id);

// Mover a pasta mãe para dentro da própria filha desliga as duas da árvore: elas passam a ser
// pai uma da outra, somem da tela e levam os documentos junto. O banco não reclama.
const volta = await chamar(`/api/pastas/${contratos.id}`, { metodo: "PATCH", corpo: { paiId: ano.id } });
conferir("não dá para mover uma pasta para dentro da própria filha", volta.status === 400, `deu ${volta.status}`);

const ela_mesma = await chamar(`/api/pastas/${contratos.id}`, { metodo: "PATCH", corpo: { paiId: contratos.id } });
conferir("nem para dentro dela mesma", ela_mesma.status === 400, `deu ${ela_mesma.status}`);

// ------------------------------------------------------------------ enviar

console.log("\n4) enviar documentos");
{
  const form = new FormData();
  form.append("arquivo", arquivoDe("contrato.txt", "Contrato de prestação de serviços.\nVersão 1.", "text/plain"));
  form.append("pastaId", ano.id);
  form.append("categoria", "Contrato");
  const d = await precisa("enviar um", chamar(`/api/projetos/${pid}/documentos`, { metodo: "POST", form }));
  conferir("um documento entrou", d.documentos.length === 1);
  conferir("com a revisão 1", d.documentos[0].revisao?.numero === 1);
  conferir("na pasta escolhida", d.documentos[0].pasta_id === ano.id);
}

var docId;
{
  // Vários de uma vez: soltar uma pasta inteira é o uso normal de um repositório.
  const form = new FormData();
  form.append("arquivo", arquivoDe("proposta.md", "# Proposta\n\nValor: R$ 10.000", "text/markdown"));
  form.append("arquivo", arquivoDe("planilha.xlsx", "PK\u0003\u0004fingindo ser um xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
  form.append("arquivo", arquivoDe("pagina.html", "<h1>Relatório</h1><script>alert(1)</script>", "text/html"));
  const d = await precisa("enviar três", chamar(`/api/projetos/${pid}/documentos`, { metodo: "POST", form }));
  conferir("os três entraram de uma vez", d.documentos.length === 3, `${d.documentos.length}`);
  conferir("nenhum falhou", (d.falharam || []).length === 0, JSON.stringify(d.falharam));
  docId = d.documentos.find((x) => x.nome === "proposta.md")?.id;
}

const vazio = new FormData();
vazio.append("arquivo", arquivoDe("nada.txt", "", "text/plain"));
const recusa = await chamar(`/api/projetos/${pid}/documentos`, { metodo: "POST", form: vazio });
conferir("arquivo vazio é recusado", recusa.status === 400, `deu ${recusa.status}`);

estado = await precisa("reabrir", chamar(`/api/projetos/${pid}`));
conferir("o projeto tem quatro documentos", estado.documentos.length === 4, `${estado.documentos.length}`);
conferir("três na raiz e um na subpasta",
  estado.documentos.filter((d) => !d.pasta_id).length === 3, JSON.stringify(estado.documentos.map((d) => d.pasta_id)));

// ------------------------------------------------------------------ abrir

console.log("\n5) abrir cada tipo do jeito dele");
{
  const porNome = new Map(estado.documentos.map((d) => [d.nome, d.id]));

  const texto = await precisa("abrir o markdown", chamar(`/api/documentos/${porNome.get("proposta.md")}/abrir`));
  conferir("markdown abre como texto", texto.jeito === "texto", texto.jeito);
  conferir("e o conteúdo vem junto", texto.conteudo?.includes("R$ 10.000"), String(texto.conteudo).slice(0, 40));

  const html = await precisa("abrir o html", chamar(`/api/documentos/${porNome.get("pagina.html")}/abrir`));
  conferir("html abre como html", html.jeito === "html", html.jeito);

  const xlsx = await precisa("abrir a planilha", chamar(`/api/documentos/${porNome.get("planilha.xlsx")}/abrir`));
  conferir("planilha só oferece baixar", xlsx.jeito === "baixar", xlsx.jeito);

  // O endereço aponta para OUTRO domínio, e é isso que impede um HTML enviado por alguém de
  // falar com a API daqui usando a sessão de quem está lendo.
  conferir("o endereço do arquivo não é o do Abacato",
    !html.url.startsWith(BASE), html.url.slice(0, 60));
  conferir("e é assinado, com validade", /token=|X-Amz-|Expires/i.test(html.url));

  const semAssinatura = html.url.split("?")[0];
  const r = await fetch(semAssinatura);
  conferir("sem a assinatura, o arquivo não sai", r.status >= 400, `deu ${r.status}`);
}

// ------------------------------------------------------------------ versões

console.log("\n6) versões — o que este sistema existe para fazer");
{
  const form = new FormData();
  form.append("arquivo", arquivoDe("proposta.md", "# Proposta\n\nValor: R$ 12.500", "text/markdown"));
  form.append("nota", "valor corrigido depois da reunião");
  const d = await precisa("nova versão", chamar(`/api/documentos/${docId}/revisoes`, { metodo: "POST", form }));
  conferir("virou a versão 2", d.revisao.numero === 2, `${d.revisao.numero}`);

  const doc = await precisa("ler o documento", chamar(`/api/documentos/${docId}`));
  conferir("as DUAS versões existem", doc.revisoes.length === 2, `${doc.revisoes.length}`);
  conferir("a 2 é a atual", doc.revisoes.find((r) => r.numero === 2)?.atual === true);
  conferir("a nota ficou guardada", doc.revisoes[0].nota === "valor corrigido depois da reunião");

  const atual = await precisa("abrir a atual", chamar(`/api/documentos/${docId}/abrir`));
  conferir("abrir sem pedir versão traz a mais nova", atual.conteudo.includes("12.500"), atual.conteudo);

  // A versão antiga continua LÁ, inteira. É o ponto todo.
  const v1 = doc.revisoes.find((r) => r.numero === 1);
  const antiga = await precisa("abrir a versão 1", chamar(`/api/documentos/${docId}/abrir?revisao=${v1.id}`));
  conferir("a versão 1 continua inteira", antiga.conteudo.includes("10.000"), antiga.conteudo);

  await precisa("voltar para a 1", chamar(`/api/documentos/${docId}`, {
    metodo: "PATCH", corpo: { revisaoAtualId: v1.id },
  }));
  const depois = await precisa("abrir de novo", chamar(`/api/documentos/${docId}/abrir`));
  conferir("voltar a uma versão antiga funciona", depois.conteudo.includes("10.000"));

  const doc2 = await precisa("reler", chamar(`/api/documentos/${docId}`));
  conferir("e a versão 2 NÃO foi apagada ao voltar", doc2.revisoes.length === 2, `${doc2.revisoes.length}`);
}

// ------------------------------------------------------------------ fronteiras

console.log("\n7) o que um projeto não pode fazer com o outro");
{
  const { projeto: outro } = await precisa("segundo projeto", chamar("/api/projetos", {
    metodo: "POST", corpo: { nome: `${marca} vizinho` },
  }));
  const { pasta: pastaVizinha } = await precisa("pasta do vizinho", chamar(`/api/projetos/${outro.id}/pastas`, {
    metodo: "POST", corpo: { nome: "De fora" },
  }));

  const mudou = await chamar(`/api/documentos/${docId}`, { metodo: "PATCH", corpo: { pastaId: pastaVizinha.id } });
  conferir("não dá para mover um documento para outro projeto", mudou.status === 403, `deu ${mudou.status}`);

  const sub = await chamar(`/api/projetos/${pid}/pastas`, { metodo: "POST", corpo: { nome: "x", paiId: pastaVizinha.id } });
  conferir("nem criar pasta dentro de pasta de outro projeto", sub.status === 403, `deu ${sub.status}`);

  const inventado = await chamar("/api/projetos/00000000-0000-0000-0000-000000000000");
  conferir("projeto inexistente dá 404", inventado.status === 404, `deu ${inventado.status}`);

  await precisa("arquivar o vizinho", chamar(`/api/projetos/${outro.id}`, { metodo: "DELETE" }));
}

// ------------------------------------------------------------------ arquivar

console.log("\n8) arquivar leva o que está dentro");
{
  const antes = (await precisa("ler", chamar(`/api/projetos/${pid}`))).documentos.length;
  await precisa("arquivar a pasta Contratos", chamar(`/api/pastas/${contratos.id}`, { metodo: "DELETE" }));
  const depois = await precisa("reabrir", chamar(`/api/projetos/${pid}`));
  conferir("a pasta e a subpasta sumiram do projeto",
    !depois.pastas.some((p) => p.id === contratos.id || p.id === ano.id));
  conferir("e o documento de dentro foi junto", depois.documentos.length === antes - 1,
    `${antes} -> ${depois.documentos.length}`);

  await precisa("arquivar o projeto", chamar(`/api/projetos/${pid}`, { metodo: "DELETE" }));
  const lista = await precisa("listar", chamar("/api/projetos"));
  conferir("o projeto some da lista", !lista.projetos.some((p) => p.id === pid));
  const arquivados = await precisa("listar arquivados", chamar("/api/projetos?arquivados=1"));
  conferir("mas aparece nos arquivados", arquivados.projetos.some((p) => p.id === pid));
  ok("os projetos de teste foram arquivados", "ficam guardados no banco, fora da lista");
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU — o repositório de documentos funciona.\n");
process.exit(falhas ? 1 : 0);
