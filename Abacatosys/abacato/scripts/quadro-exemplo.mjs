// Monta um quadro de demonstração, com conteúdo de verdade.
//
// Um quadro vazio não mostra nada do que o sistema faz: etiqueta, prazo atrasado, progresso de
// checklist e capa só existem quando há card com eles. Este script cria um quadro onde cada
// recurso aparece pelo menos uma vez — serve para olhar o resultado, para conferir um deploy
// novo e para mostrar o sistema a alguém.
//
// É descartável: arquive o quadro quando não precisar mais.
//
// Uso:  ABACATO_URL=http://localhost:3000 node scripts/quadro-exemplo.mjs "Nome do quadro"

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chaveDeLogin } from "../src/lib/abacatoAuth.js";

const BASE = process.env.ABACATO_URL || "http://localhost:3000";
const NOME = process.argv[2] || "Exemplo";
let cookie = "";

async function chamar(caminho, metodo = "GET", corpo) {
  const res = await fetch(BASE + caminho, {
    method: metodo,
    headers: { ...(corpo ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const guardar = res.headers.get("set-cookie");
  if (guardar) cookie = guardar.split(";")[0];
  const dados = await res.json().catch(() => ({}));
  if (!res.ok || dados.ok === false) {
    console.error(`  falhou: ${metodo} ${caminho} — ${res.status} ${dados.error || ""}`);
    process.exit(1);
  }
  return dados;
}

const arquivo = path.join(os.homedir(), "senha-abacato.txt");
const t = fs.readFileSync(arquivo, "utf8");
const emailDoArquivo = t.match(/e-mail:\s*(\S+)/)[1];
const senhaDoArquivo = t.match(/senha:\s*(\S+)/)[1];
await chamar("/api/auth/entrar", "POST", {
  email: emailDoArquivo,
  // A chave, e não a senha: quem estica é o cliente, e aqui o cliente é este script.
  chave: await chaveDeLogin(emailDoArquivo, senhaDoArquivo),
});

const daquiA = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(17, 0, 0, 0);
  // Um prazo para HOJE marcado às 17h já nasce vencido se o script rodar às 18h — e o card que
  // existe justamente para mostrar o estado "vence hoje" apareceria em vermelho de atrasado.
  // Quando as 17h de hoje já passaram, o prazo vai para daqui a quatro horas.
  if (dias === 0 && d.getTime() <= Date.now()) return new Date(Date.now() + 4 * 3600 * 1000).toISOString();
  return d.toISOString();
};

const { quadro } = await chamar("/api/quadros", "POST", { nome: NOME });
await chamar(`/api/quadros/${quadro.id}`, "PATCH", {
  descricao: "Quadro de demonstração — pode arquivar quando quiser.",
  papelDeParede: "linear-gradient(135deg, #0F2A1D, #1B4332)",
});

const { quadro: cheio, eu } = await chamar(`/api/quadros/${quadro.id}`);
const [afazer, fazendo, feito] = cheio.colunas;
await chamar(`/api/colunas/${afazer.id}`, "PATCH", { capa: "#EF4444" });
await chamar(`/api/colunas/${fazendo.id}`, "PATCH", { capa: "#F97316" });
await chamar(`/api/colunas/${feito.id}`, "PATCH", { capa: "#22C55E" });

const etiquetas = {};
for (const [chave, nome, cor] of [
  ["urgente", "Urgente", "#EF4444"],
  ["cliente", "Cliente", "#2362D3"],
  ["interno", "Interno", "#6B7280"],
  ["infra", "Infraestrutura", "#A855F7"],
]) {
  const r = await chamar(`/api/quadros/${quadro.id}/etiquetas`, "POST", { nome, cor });
  etiquetas[chave] = r.etiqueta.id;
}

async function novoCard(colunaId, titulo, extras = {}) {
  const { card } = await chamar(`/api/colunas/${colunaId}/cards`, "POST", { titulo });
  const mudancas = {};
  for (const campo of ["descricao", "fimEm", "inicioEm", "capa"]) {
    if (campo in extras) mudancas[campo] = extras[campo];
  }
  if (Object.keys(mudancas).length) await chamar(`/api/cards/${card.id}`, "PATCH", mudancas);
  if (extras.etiquetas) await chamar(`/api/cards/${card.id}/etiquetas`, "PUT", { etiquetas: extras.etiquetas });
  if (extras.meu) await chamar(`/api/cards/${card.id}/responsaveis`, "PUT", { responsaveis: [eu.id] });
  if (extras.link) await chamar(`/api/cards/${card.id}/links`, "POST", { url: extras.link });
  if (extras.checklist) {
    const { checklist } = await chamar(`/api/cards/${card.id}/checklists`, "POST", { titulo: extras.checklist.titulo });
    const { itens } = await chamar(`/api/checklists/${checklist.id}/itens`, "POST", { texto: extras.checklist.itens.join("\n") });
    for (let i = 0; i < (extras.checklist.feitos || 0); i++) {
      await chamar(`/api/itens/${itens[i].id}`, "PATCH", { feito: true });
    }
  }
  return card;
}

// Cada card existe para mostrar um estado diferente na tela: atrasado, vence hoje, com
// progresso no meio, concluído pela checklist, com capa. Um quadro com cinco cards iguais não
// mostraria nada.
await novoCard(afazer.id, "Renovar o certificado do servidor de casa", {
  fimEm: daquiA(-3),
  etiquetas: [etiquetas.urgente, etiquetas.infra],
  meu: true,
  descricao: "Venceu. O Caddy renova sozinho, mas o domínio novo ainda não entrou na lista.",
});
await novoCard(afazer.id, "Proposta comercial — obra do cliente", {
  fimEm: daquiA(0),
  etiquetas: [etiquetas.cliente],
  meu: true,
  link: "https://beyond.dev.br",
});
await novoCard(afazer.id, "Levantar requisitos do módulo de documentos", {
  etiquetas: [etiquetas.interno],
});

await novoCard(fazendo.id, "Migrar os quadros do Trello", {
  fimEm: daquiA(4),
  etiquetas: [etiquetas.interno],
  meu: true,
  capa: "#2362D3",
  descricao: "Exportar o JSON de cada quadro e importar aqui. A importação é repetível: rodar duas vezes não duplica card.",
  checklist: {
    titulo: "Quadros a migrar",
    itens: ["Beyond Bits", "Delp — Engenharia", "Pessoal", "Arquivo 2025"],
    feitos: 2,
  },
});
await novoCard(fazendo.id, "Configurar o subdomínio abacato.beyond.dev.br", {
  etiquetas: [etiquetas.infra],
  checklist: { titulo: "Passos", itens: ["Registro de DNS", "Site no Caddy", "Variáveis no Worker"], feitos: 1 },
});

await novoCard(feito.id, "Desenhar o sistema de cores", {
  etiquetas: [etiquetas.interno],
  capa: "#22C55E",
  checklist: { titulo: "Entregas", itens: ["Tokens no CSS", "Modo escuro", "Contraste conferido"], feitos: 3 },
});

await chamar(`/api/quadros/${quadro.id}/recorrencias`, "POST", {
  colunaId: afazer.id,
  titulo: "Conferir os backups",
  regra: "semanal:1",
});

console.log(`\nQuadro "${NOME}" montado.`);
console.log(`${BASE}/quadros/${quadro.id}\n`);
