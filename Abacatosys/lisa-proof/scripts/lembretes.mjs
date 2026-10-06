// Envia os lembretes push da Lisa_Proof. Roda no relógio (crontab) do iMac, como o push da Lisa:
// a biblioteca de push precisa do Node completo, que o Worker da Cloudflare não tem.
//
// Para cada pessoa com aparelho inscrito e trilha ativa, decide UM lembrete (ou nenhum):
//   1. ofensiva em risco — tem sequência e ainda não estudou hoje;
//   2. quiz do dia pendente — numa das trilhas ativas;
//   3. nada — já estudou e já fez o quiz.
// O mesmo tipo de lembrete não vai duas vezes no mesmo dia para o mesmo aparelho.
//
// Uso:
//   node --env-file=.env.local --env-file=.env.lembretes scripts/lembretes.mjs
//   ... scripts/lembretes.mjs --teste      manda um aviso de teste para todos os aparelhos
//   ... scripts/lembretes.mjs --simular    mostra o que mandaria, sem mandar
//
// Crontab sugerido (meio-dia e 20h):
//   0 12,20 * * * cd <pasta>/lisa-proof && node --env-file=.env.local --env-file=.env.lembretes scripts/lembretes.mjs >> ~/proof-lembretes.log 2>&1

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { diaDe } from "../src/dominio/datas.js";
import { calcularOfensiva } from "../src/dominio/ofensiva.js";

const TESTE = process.argv.includes("--teste");
const SIMULAR = process.argv.includes("--simular");

const faltando = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"].filter((k) => !process.env[k]);
if (faltando.length) {
  console.error(`faltam variáveis: ${faltando.join(", ")} (use --env-file=.env.local --env-file=.env.lembretes)`);
  process.exit(1);
}

webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://proof.beyond.dev.br", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
const banco = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const hoje = diaDe();
const agora = new Date().toISOString();
const carimbo = () => new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

async function falhaOuDados(consulta, onde) {
  const { data, error } = await consulta;
  if (error) throw new Error(`${onde}: ${error.message}`);
  return data || [];
}

/** O lembrete desta pessoa agora, ou null. */
async function lembreteDe(usuarioId) {
  const trilhas = await falhaOuDados(
    banco.from("proof_trilhas").select("id").eq("usuario_id", usuarioId).eq("status", "ativa"), "trilhas"
  );
  if (!trilhas.length) return null;

  const eventos = await falhaOuDados(banco.from("proof_eventos").select("dia").eq("usuario_id", usuarioId).gte("dia", "2000-01-01").limit(5000), "eventos");
  const ofensiva = calcularOfensiva(eventos.map((e) => e.dia), hoje);

  const quizzes = await falhaOuDados(
    banco.from("proof_desafios").select("trilha_id, status").eq("usuario_id", usuarioId).eq("tipo", "quiz").eq("periodo", hoje), "quizzes"
  );
  const quizPendente = trilhas.some((t) => !quizzes.some((q) => q.trilha_id === t.id && q.status === "concluido"));

  if (ofensiva.emRisco) {
    return {
      tipo: "ofensiva",
      title: `🔥 Sua ofensiva de ${ofensiva.atual} ${ofensiva.atual === 1 ? "dia" : "dias"} está em risco!`,
      body: "Marque uma tarefa ou faça o quiz de hoje para manter a sequência. O Neuro está contando com você!",
      url: "/",
    };
  }
  if (quizPendente) {
    return {
      tipo: "quiz",
      title: "🧠 O quiz de hoje está te esperando",
      body: "São só 5 perguntas sobre o assunto do dia. Bora?",
      url: "/pratica",
    };
  }
  return null;
}

async function enviar(inscricao, mensagem) {
  try {
    await webpush.sendNotification(
      { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
      JSON.stringify({ title: mensagem.title, body: mensagem.body, url: mensagem.url, tag: `proof-${mensagem.tipo}` }),
      { TTL: 6 * 60 * 60 }
    );
    await banco.from("proof_push").update({ ultimo_envio: agora, ultimo_tipo: `${hoje}:${mensagem.tipo}` }).eq("id", inscricao.id);
    return "enviado";
  } catch (e) {
    // 404/410: o navegador desinscreveu (app desinstalado, permissão revogada). A inscrição
    // morreu e fica só gastando tentativa — apaga.
    if (e.statusCode === 404 || e.statusCode === 410) {
      await banco.from("proof_push").delete().eq("id", inscricao.id);
      return "inscrição expirada (apagada)";
    }
    return `falhou (${e.statusCode || e.message})`;
  }
}

const inscricoes = await falhaOuDados(banco.from("proof_push").select("id, usuario_id, endpoint, p256dh, auth, ultimo_tipo"), "inscrições");
console.log(`[${carimbo()}] ${inscricoes.length} aparelho(s) inscrito(s)${TESTE ? " — modo teste" : SIMULAR ? " — simulação" : ""}`);

const porUsuario = new Map();
for (const i of inscricoes) {
  if (!porUsuario.has(i.usuario_id)) porUsuario.set(i.usuario_id, []);
  porUsuario.get(i.usuario_id).push(i);
}

let enviados = 0;
for (const [usuarioId, aparelhos] of porUsuario) {
  let mensagem;
  try {
    mensagem = TESTE
      ? { tipo: "teste", title: "🔔 Lembretes da Lisa_Proof ligados", body: "É assim que o Neuro vai te chamar quando a ofensiva estiver em risco.", url: "/" }
      : await lembreteDe(usuarioId);
  } catch (e) {
    console.log(`  ${usuarioId.slice(0, 8)}…  erro ao decidir: ${e.message}`);
    continue;
  }
  if (!mensagem) {
    console.log(`  ${usuarioId.slice(0, 8)}…  em dia, nada a lembrar`);
    continue;
  }
  for (const aparelho of aparelhos) {
    if (!TESTE && aparelho.ultimo_tipo === `${hoje}:${mensagem.tipo}`) {
      console.log(`  ${usuarioId.slice(0, 8)}…  "${mensagem.tipo}" já enviado hoje para este aparelho`);
      continue;
    }
    const r = SIMULAR ? "simulado" : await enviar(aparelho, mensagem);
    if (r === "enviado") enviados++;
    console.log(`  ${usuarioId.slice(0, 8)}…  ${mensagem.tipo}: ${r}`);
  }
}
console.log(`[${carimbo()}] ${enviados} lembrete(s) enviado(s).`);
