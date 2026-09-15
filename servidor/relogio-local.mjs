// O relógio da Lisa, rodando dentro do iMac.
//
// Faz o mesmo que o Worker `lisa-cron` da Cloudflare, com três diferenças que importam:
//
//  1. Chama a Lisa em localhost. A requisição não sai da máquina — o Worker precisava ir até
//     a Cloudflare e voltar pelo túnel, duas travessias de internet por chamada.
//
//  2. Não existe teto de chamadas de saída. O Worker do plano gratuito para em 50 por
//     invocação, e foi por isso que o download do GitHub virou fatias de 35 arquivos. Aqui o
//     ciclo avança até acabar, numa passada só.
//
//  3. Não existe teto de tempo. O Worker tinha que devolver rápido; este script pode levar o
//     tempo que a sincronização levar.
//
// Uso:  node relogio-local.mjs notificar | sincronizar | reiniciar | deploys

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = process.env.LISA_LOCAL || "http://localhost:3000";
const ENV_LISA = path.join(os.homedir(), "lisa", ".env");

// Lê os segredos do .env da própria Lisa local: uma fonte só, que já existe e já está com
// permissão 600. Duplicar isso num segundo arquivo seria mais uma coisa para sair de sincronia.
function lerEnv(arquivo) {
  const mapa = {};
  try {
    for (const linha of fs.readFileSync(arquivo, "utf8").split("\n")) {
      const corte = linha.indexOf("=");
      if (corte < 1 || linha.trimStart().startsWith("#")) continue;
      mapa[linha.slice(0, corte).trim()] = linha.slice(corte + 1).trim();
    }
  } catch {}
  return mapa;
}
const env = lerEnv(ENV_LISA);

const agora = () => new Date().toISOString().slice(11, 19);
const log = (...p) => console.log(`[${agora()}]`, ...p);

async function chamar(rota, { segredo = "cron" } = {}) {
  const cabecalhos =
    segredo === "ingest"
      ? { "x-ingest-secret": env.INGEST_SECRET || "" }
      : { authorization: `Bearer ${env.CRON_SECRET || ""}` };
  const res = await fetch(BASE + rota, { headers: cabecalhos });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${rota} → ${res.status} ${texto.slice(0, 200)}`);
  try { return JSON.parse(texto); } catch { return null; }
}

// ---- notificações -------------------------------------------------------------------------
// A rota DETECTA o que merece virar aviso e devolve a fila; quem ENVIA é aqui, porque o
// web-push precisa de APIs do Node que a rota não tem garantia de ter.
async function notificar() {
  const resposta = await chamar("/api/cron/notify");
  const pendentes = resposta?.pendentes || [];
  if (!pendentes.length) return log("notificar: nada na fila");

  const { default: webpush } = await import("web-push");
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );

  let enviados = 0, removidos = 0;
  for (const item of pendentes) {
    for (const inscricao of item.inscricoes || []) {
      try {
        await webpush.sendNotification(inscricao, item.payload);
        enviados++;
      } catch (err) {
        // Inscrição morta (navegador desinstalado, permissão revogada) é apagada: insistir
        // nela gasta uma tentativa a cada cinco minutos, para sempre.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          removidos++;
          await fetch(BASE + "/api/notifications/subscribe", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ endpoint: inscricao.endpoint }),
          }).catch(() => {});
        }
      }
    }
  }
  log(`notificar: ${enviados} enviados, ${removidos} inscrições mortas removidas`);
}

// ---- sincronização ------------------------------------------------------------------------
// No Worker isto avançava 5 fatias e parava, por causa dos tetos dele. Aqui vai até o fim.
// O limite é de segurança, não de plataforma: se algo entrar em laço, o ciclo para em vez de
// rodar para sempre consumindo cota do Gemini e da API do GitHub.
const TETO_DE_FATIAS = 400;

// Onde fica registrado que a cota diária acabou. Enquanto este arquivo tiver uma data no
// futuro, as próximas rodadas nem tentam.
//
// Sem isso, o crontab dispara de 10 em 10 minutos contra um poço seco: em 15/09/2026 o ciclo
// esgotou a cota DIÁRIA das chaves de embedding e ficou tentando o resto do dia. As tentativas
// em si não gastam cota (são recusadas), mas enchem o log de erro e escondem um problema de
// verdade no meio do ruído — e no dia em que a recusa vier acompanhada de espera, martelar é
// exatamente o que não se quer fazer.
const AVISO_DE_COTA = path.join(os.homedir(), ".sync-sem-cota-ate");

function cotaAcabouAte() {
  try {
    const quando = Number(fs.readFileSync(AVISO_DE_COTA, "utf8").trim());
    return Number.isFinite(quando) && quando > Date.now() ? quando : 0;
  } catch { return 0; }
}

async function sincronizar() {
  const bloqueadoAte = cotaAcabouAte();
  if (bloqueadoAte) {
    const horas = ((bloqueadoAte - Date.now()) / 3_600_000).toFixed(1);
    return log(`sincronizar: sem cota de embedding, volto em ~${horas}h`);
  }

  let fatias = 0, ultimaNota = "";
  const comecou = Date.now();
  try {
    while (fatias < TETO_DE_FATIAS) {
      const r = await chamar("/api/cron/sync", { segredo: "ingest" });
      const nota = r?.note || "sem resposta";
      fatias++;
      if (!nota.startsWith("passo ")) { ultimaNota = nota; break; }
      ultimaNota = nota;
      if (fatias % 20 === 0) log(`  ...${fatias} fatias — ${nota}`);
    }
  } catch (err) {
    // A rota devolve 500 com "cota DIÁRIA" quando o Gemini recusa por RPD. O cooldown que o
    // app aplica na chave é de 12h; espero o mesmo, e não até a meia-noite, porque a cota do
    // Gemini reinicia no fuso DELE, não no nosso.
    if (/cota DIÁRIA/i.test(String(err?.message || err))) {
      const ate = Date.now() + 12 * 3_600_000;
      fs.writeFileSync(AVISO_DE_COTA, String(ate));
      log(`sincronizar: cota diária de embedding esgotada após ${fatias} fatia(s) — pausando 12h`);
      return;
    }
    throw err;
  }
  // Terminou sem esbarrar na cota: se havia aviso velho, ele já não vale.
  try { fs.unlinkSync(AVISO_DE_COTA); } catch {}

  const minutos = ((Date.now() - comecou) / 60000).toFixed(1);
  log(`sincronizar: ${fatias} fatia(s) em ${minutos} min — ${ultimaNota}`);
  if (fatias >= TETO_DE_FATIAS) log("  ATENÇÃO: parou no teto de segurança, não por ter terminado");
}

async function reiniciar() {
  const r = await chamar("/api/cron/sync?reset=1", { segredo: "ingest" });
  log(`reiniciar: ${r?.note || "sem resposta"}`);
}

async function deploys() {
  const r = await chamar("/api/cron/deploy-check");
  log(`deploys: ${r?.checadas ?? "?"} checadas, ${r?.fora ?? "?"} fora do ar`);
}

const tarefas = { notificar, sincronizar, reiniciar, deploys };
const qual = process.argv[2];
if (!tarefas[qual]) {
  console.error(`use: node relogio-local.mjs ${Object.keys(tarefas).join("|")}`);
  process.exit(1);
}
tarefas[qual]().catch((err) => {
  log(`ERRO em ${qual}: ${err.message}`);
  process.exit(1);
});
