// Exercita os painéis e o link público, por HTTP, contra o servidor de verdade.
//
// O link público é a única porta do sistema que responde a quem não entrou. Por isso metade
// deste script é sobre o que ele NÃO pode mostrar: descrição, checklist, link, responsável,
// e-mail, id de card. Um painel de cliente responde "como está indo", e não "o que exatamente
// vocês escreveram sobre mim".
//
// Uso:  ABACATO_URL=http://localhost:3000 node scripts/painel-check.mjs

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
async function chamar(caminho, { metodo = "GET", corpo, semCookie = false } = {}) {
  const res = await fetch(BASE + caminho, {
    method: metodo,
    headers: { ...(corpo ? { "content-type": "application/json" } : {}), ...(cookie && !semCookie ? { cookie } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    redirect: "manual",
  });
  const guardar = res.headers.get("set-cookie");
  if (guardar) cookie = guardar.split(";")[0];
  const texto = await res.text();
  let dados = {};
  try { dados = JSON.parse(texto); } catch { dados = { _texto: texto.slice(0, 160) }; }
  return { status: res.status, dados, texto };
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
const texto = fs.readFileSync(arquivo, "utf8");
const email = texto.match(/e-mail:\s*(\S+)/)[1];
const senha = texto.match(/senha:\s*(\S+)/)[1];

// Uma data relativa a HOJE, SEMPRE com fuso (termina em Z).
//
// Sem o fuso, a string "2026-09-20T21:33" e lida por QUEM RECEBE: o servidor roda em UTC e o
// teste roda no Brasil, tres horas atras. Um prazo "daqui a tres horas" chegava la como o
// instante exato de agora, e o card nascia vencido por alguns milissegundos. Levou duas
// rodadas de investigacao — e o mesmo defeito estava no campo de data da tela, valendo tres
// horas de diferenca em todo prazo que alguem marcasse.
const emDias = (n) => {
  const d = new Date();
  if (n === 0) d.setHours(d.getHours() + 3);
  else { d.setDate(d.getDate() + n); d.setHours(12, 0, 0, 0); }
  return d.toISOString();
};

console.log(`\nPainéis do Abacato — ${BASE}\n`);
console.log("1) entrar e montar um quadro com números conhecidos");
await precisa("login", chamar("/api/auth/entrar", { metodo: "POST", corpo: { email, chave: await chaveDeLogin(email, senha) } }));

const marca = `[teste ${new Date().toISOString().slice(0, 16)}]`;
const { quadro } = await precisa("criar quadro", chamar("/api/quadros", { metodo: "POST", corpo: { nome: `${marca} painel` } }));
const qid = quadro.id;
const estado = await precisa("abrir", chamar(`/api/quadros/${qid}`));
const [afazer] = estado.quadro.colunas;

const { etiqueta } = await precisa("etiqueta", chamar(`/api/quadros/${qid}/etiquetas`, {
  metodo: "POST", corpo: { nome: "Cliente", cor: "#2362D3" },
}));

// Um de cada estado, para os números serem previsíveis.
const feitos = [];
for (const [titulo, dias, concluir] of [
  ["Atrasada faz tempo", -10, false],
  ["Atrasada de ontem", -1, false],
  ["Vence hoje", 0, false],
  ["Vence em três dias", 3, false],
  ["Vence em dez dias", 10, false],
  ["Já entregue", -5, true],
]) {
  const { card } = await precisa(`card ${titulo}`, chamar(`/api/colunas/${afazer.id}/cards`, {
    metodo: "POST", corpo: { titulo },
  }));
  await precisa("prazo", chamar(`/api/cards/${card.id}`, { metodo: "PATCH", corpo: { fimEm: emDias(dias) } }));
  if (concluir) await precisa("concluir", chamar(`/api/cards/${card.id}`, { metodo: "PATCH", corpo: { concluido: true } }));
  await precisa("etiqueta no card", chamar(`/api/cards/${card.id}/etiquetas`, { metodo: "PUT", corpo: { etiquetas: [etiqueta.id] } }));
  feitos.push(card.id);
}
await precisa("um sem prazo", chamar(`/api/colunas/${afazer.id}/cards`, { metodo: "POST", corpo: { titulo: "Sem prazo" } }));
ok("quadro montado", "7 cards em estados diferentes");

// ------------------------------------------------------------------ o painel interno

console.log("\n2) os números batem");
const paineis = await precisa("painel", chamar(`/api/paineis?fuso=${new Date().getTimezoneOffset()}`));
const p = paineis.quadros.find((x) => x.id === qid);
conferir("o quadro aparece no painel", Boolean(p));
conferir("sete cards no total", p.total === 7, `${p.total}`);
conferir("dois atrasados", p.porEstado.atrasado === 2, JSON.stringify(p.porEstado));
conferir("um para hoje", p.porEstado.hoje === 1, `${p.porEstado.hoje}`);
conferir("um concluído", p.porEstado.concluido === 1, `${p.porEstado.concluido}`);
conferir("um sem prazo", p.porEstado["sem-prazo"] === 1, `${p.porEstado["sem-prazo"]}`);
conferir("seis abertos", p.abertos === 6, `${p.abertos}`);
conferir("14% de progresso (1 de 7)", p.progresso === 14, `${p.progresso}`);

conferir("a etiqueta conta só os ABERTOS", p.etiquetas[0]?.total === 5,
  `${p.etiquetas[0]?.total} — o card entregue não pode contar como trabalho a fazer`);
conferir("e sabe quantos deles estão atrasados", p.etiquetas[0]?.atrasados === 2, `${p.etiquetas[0]?.atrasados}`);

const semDono = p.pessoas.find((x) => x.id === null);
conferir("os sem responsável viram uma linha", semDono?.total === 6, JSON.stringify(p.pessoas));

conferir("a agenda tem 15 baldes (vencidos + 14 dias)", p.semana.length === 15, `${p.semana.length}`);
conferir("os vencidos ficam no primeiro balde", p.semana[0].total === 2, `${p.semana[0].total}`);
conferir("hoje é o segundo", p.semana[1].total === 1, `${p.semana[1].total}`);
conferir("o de dez dias entra no horizonte", p.semana[11].total === 1, JSON.stringify(p.semana.map((b) => b.total)));

conferir("a lista de atrasados vem do mais velho para o mais novo",
  p.atrasadosDetalhe[0]?.titulo === "Atrasada faz tempo", p.atrasadosDetalhe[0]?.titulo);
conferir("com os dias de atraso", p.atrasadosDetalhe[0]?.diasAtrasado === 10, `${p.atrasadosDetalhe[0]?.diasAtrasado}`);

// ------------------------------------------------------------------ o link do cliente

console.log("\n3) o link que o cliente abre sem login");
const { painel } = await precisa("criar link", chamar("/api/paineis", {
  metodo: "POST", corpo: { quadroId: qid, titulo: "Obra do cliente", comTitulos: true, dias: 30 },
}));
conferir("o token é longo o bastante para não ser adivinhado", painel.token.length >= 20, `${painel.token.length} caracteres`);
conferir("e tem data de vencimento", Boolean(painel.expira_em));

const publico = await precisa("abrir sem login", chamar(`/api/publico/${painel.token}`, { semCookie: true }));
conferir("abre sem nenhuma sessão", publico.ok === true);
conferir("com o título escolhido, não o interno", publico.titulo === "Obra do cliente", publico.titulo);
conferir("os números são os mesmos", publico.resumo.total === 7 && publico.resumo.atrasados === 2,
  JSON.stringify(publico.resumo));
conferir("as colunas vêm pelo nome", publico.colunas.length === 3, `${publico.colunas.length}`);
conferir("e os títulos atrasados também", publico.atrasados.length === 2, `${publico.atrasados.length}`);

console.log("\n4) o que o link NÃO pode vazar");
{
  // A resposta inteira, como texto: qualquer campo proibido que escapasse apareceria aqui.
  const bruto = (await chamar(`/api/publico/${painel.token}`, { semCookie: true })).texto;

  const proibido = (agulha, oQue) =>
    conferir(`não vaza ${oQue}`, !bruto.includes(agulha), `achei "${agulha}" na resposta`);

  proibido(qid, "o id do quadro");
  proibido(feitos[0], "id de card");
  proibido(email, "o e-mail de ninguém");
  proibido("dono_id", "o dono do quadro");
  proibido("descricao", "campo de descrição");
  proibido("checklist", "checklists");
  proibido("responsaveis", "responsáveis");
  proibido("papel_de_parede", "detalhes internos do quadro");

  conferir("o nome interno do quadro não aparece", !bruto.includes(marca), "o título do cliente substitui");
}

console.log("\n5) links que não valem");
{
  const inventado = await chamar("/api/publico/naoexisteesselinkaqui123456", { semCookie: true });
  conferir("token inventado dá 404", inventado.status === 404, `deu ${inventado.status}`);

  const curto = await chamar("/api/publico/abc", { semCookie: true });
  conferir("token curto demais dá 404", curto.status === 404, `deu ${curto.status}`);

  // Link desligado e link inexistente respondem IGUAL: distinguir diria a quem tenta se aquele
  // endereço já existiu.
  conferir("a mensagem é a mesma nos dois casos",
    inventado.dados.error === curto.dados.error, `"${inventado.dados.error}" vs "${curto.dados.error}"`);
}

console.log("\n6) o link sem títulos");
{
  const { painel: mudo } = await precisa("link só com números", chamar("/api/paineis", {
    metodo: "POST", corpo: { quadroId: qid, titulo: "Só os números", comTitulos: false },
  }));
  const r = await precisa("abrir", chamar(`/api/publico/${mudo.token}`, { semCookie: true }));
  conferir("os números continuam vindo", r.resumo.atrasados === 2, `${r.resumo.atrasados}`);
  conferir("mas nenhum título de tarefa", r.atrasados.length === 0, JSON.stringify(r.atrasados));
  conferir("e a tela sabe que é assim", r.mostraTitulos === false);

  const bruto = (await chamar(`/api/publico/${mudo.token}`, { semCookie: true })).texto;
  conferir("nem escondido no meio da resposta", !bruto.includes("Atrasada faz tempo"));
}

console.log("\n7) quadro arquivado derruba o link");
{
  const { painel: outro } = await precisa("mais um link", chamar("/api/paineis", {
    metodo: "POST", corpo: { quadroId: qid, titulo: "x" },
  }));
  await precisa("arquivar o quadro", chamar(`/api/quadros/${qid}`, { metodo: "DELETE" }));
  const r = await chamar(`/api/publico/${outro.token}`, { semCookie: true });
  // Arquivar um quadro é como alguém desliga o acompanhamento. O link tem de morrer junto,
  // senão o cliente continua vendo números de um trabalho que saiu do ar.
  conferir("o link para de funcionar", r.status === 404, `deu ${r.status}`);
  ok("o quadro de teste foi arquivado");
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU — os painéis e o link do cliente funcionam.\n");
process.exit(falhas ? 1 : 0);
