// Traz quadros do Trello direto pela API deles, sem exportar arquivo na mão.
//
// A tela de importação recebe o JSON que você baixa do Trello, e isso é o certo para quem
// migra um quadro de vez em quando. Para migrar TUDO de uma vez — três quadros, trezentos
// cards — baixar arquivo por arquivo é trabalho manual que a máquina faz melhor, e que erra
// silenciosamente quando alguém esquece um quadro.
//
// O formato que a API do Trello devolve com os parâmetros abaixo é o MESMO da exportação JSON.
// Por isso este script não tem leitor próprio: ele entrega o que baixou para a mesma rota de
// importação que a tela usa, e portanto para as mesmas regras, os mesmos avisos e a mesma
// garantia de não duplicar ao rodar de novo.
//
// Uso:  ABACATO_URL=https://abacato.beyond.dev.br \
//       TRELLO_KEY=... TRELLO_TOKEN=... TRELLO_BOARD_IDS=id1,id2 \
//       node scripts/trazer-do-trello.mjs [--confirmar]
//
// Sem `--confirmar` ele só MOSTRA o que entraria. É o padrão de propósito: uma importação de
// trezentos cards não deve acontecer por um comando digitado pela metade.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chaveDeLogin } from "../src/lib/abacatoAuth.js";
import { lerExportacaoDoTrello, enxugarExportacao } from "../src/dominio/trello.js";

const BASE = (process.env.ABACATO_URL || "http://localhost:3000").replace(/\/+$/, "");
const KEY = process.env.TRELLO_KEY;
const TOKEN = process.env.TRELLO_TOKEN;
const IDS = (process.env.TRELLO_BOARD_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
const CONFIRMAR = process.argv.includes("--confirmar");

if (!KEY || !TOKEN) {
  console.error("faltam TRELLO_KEY e TRELLO_TOKEN no ambiente.");
  process.exit(1);
}
if (!IDS.length) {
  console.error("faltam os quadros: TRELLO_BOARD_IDS=id1,id2");
  process.exit(1);
}

/**
 * Os parâmetros que fazem a API devolver o mesmo conteúdo da exportação JSON.
 *
 * `actions` fica de fora — é o histórico de cada movimento de cada card, é o que faz uma
 * exportação passar de cinquenta megabytes, e é histórico de um sistema que está sendo
 * abandonado.
 */
const CAMPOS = new URLSearchParams({
  fields: "id,name,desc,prefs",
  lists: "all",
  list_fields: "id,name,pos,closed",
  cards: "all",
  card_fields: "id,name,desc,pos,closed,idList,due,start,dueComplete,idLabels,idMembers,cover",
  card_attachments: "true",
  checklists: "all",
  checklist_fields: "id,idCard,name,pos",
  labels: "all",
  label_fields: "id,name,color",
  members: "all",
  member_fields: "id,fullName,username",
});

async function baixarQuadro(id) {
  const url = `https://api.trello.com/1/boards/${id}?${CAMPOS}&key=${KEY}&token=${TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`Trello ${res.status} ${res.statusText} ${corpo.slice(0, 160)}`);
  }
  return res.json();
}

let cookie = "";
async function chamar(caminho, corpo) {
  const res = await fetch(BASE + caminho, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(corpo),
  });
  const guardar = res.headers.get("set-cookie");
  if (guardar) cookie = guardar.split(";")[0];
  const dados = await res.json().catch(() => ({}));
  if (!res.ok || dados.ok === false) throw new Error(`${res.status} ${dados.error || ""}`);
  return dados;
}

// ---------------------------------------------------------------- entrar

const arquivo = path.join(os.homedir(), "senha-abacato.txt");
let texto = "";
try {
  texto = fs.readFileSync(arquivo, "utf8");
} catch {
  console.error(`não achei ${arquivo} — rode antes o scripts/criar-usuario.mjs.`);
  process.exit(1);
}
const email = texto.match(/e-mail:\s*(\S+)/)?.[1];
const senha = texto.match(/senha:\s*(\S+)/)?.[1];

console.log(`\nTrazer do Trello para ${BASE}`);
console.log(CONFIRMAR ? "MODO: importar de verdade\n" : "MODO: só mostrar o que entraria (use --confirmar para gravar)\n");

await chamar("/api/auth/entrar", { email, chave: await chaveDeLogin(email, senha) });

// ---------------------------------------------------------------- um quadro por vez

let totalCards = 0;
let falhou = 0;

for (const id of IDS) {
  try {
    const bruto = await baixarQuadro(id);
    const { quadro, resumo, avisos } = lerExportacaoDoTrello(bruto);

    console.log(`▸ ${quadro.nome}`);
    console.log(`    ${resumo.colunas} colunas · ${resumo.cards} cards · ${resumo.etiquetas} etiquetas · ` +
                `${resumo.checklists} checklists (${resumo.itens} itens) · ${resumo.links} links`);
    console.log(`    ${resumo.comPrazo} com prazo · ${resumo.concluidos} já concluídos · ${resumo.arquivados} arquivados`);
    for (const a of avisos) console.log(`    ⚠ ${a.texto}`);

    if (CONFIRMAR) {
      const r = await chamar("/api/importar/trello", { trello: enxugarExportacao(bruto), confirmar: true });
      console.log(`    → ${r.jaExistia ? "já existia aqui, completei o que faltava" : "importado"}`);
      console.log(`    → ${BASE}/quadros/${r.quadroId}`);
    }
    totalCards += resumo.cards;
    console.log("");
  } catch (e) {
    falhou++;
    console.log(`▸ quadro ${id}`);
    console.log(`    FALHOU: ${e.message}\n`);
  }
}

console.log(`${IDS.length - falhou} de ${IDS.length} quadro(s), ${totalCards} cards.`);
if (!CONFIRMAR) console.log("Nada foi gravado. Rode de novo com --confirmar.\n");
else console.log("Rodar de novo não duplica nada: cria só o que falta.\n");
process.exit(falhou ? 1 : 0);
