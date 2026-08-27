import webpush from "web-push";
import { supabase } from "./supabase.js";
import { listTickets } from "./sentinel.js";
import { loadAllTrelloCards } from "./liveTrello.js";

// limiar de "perto de estourar o SLA" — chamado ainda não estourado mas dentro dessa janela
const SLA_NEAR_MS = 2 * 60 * 60 * 1000; // 2h

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      "Chaves VAPID não configuradas (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT). " +
      "Defina em Vercel → Settings → Environment Variables (ou no .env local)."
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/** Salva (ou atualiza) a inscrição de push de um dispositivo/navegador. */
export async function saveSubscription(sub) {
  const { endpoint, keys } = sub || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error("inscrição de push inválida");
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
  if (error) throw new Error(`saveSubscription: ${error.message}`);
}

/** Remove a inscrição de um dispositivo (usuário desativou notificações). */
export async function removeSubscription(endpoint) {
  if (!endpoint) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

/**
 * Eventos recentes (mais novos que `since`) — usado pelo aviso DENTRO do app (banner + voz),
 * como complemento ao push do sistema operacional: a aba aberta consulta isso periodicamente
 * e não precisa de permissão nenhuma do navegador pra funcionar.
 */
export async function listRecentNotifications(since) {
  let q = supabase
    .from("notified_events")
    .select("event_type, entity_id, title, body, url, created_at")
    .order("created_at", { ascending: true })
    .limit(20);
  if (since) q = q.gt("created_at", since);
  const { data, error } = await q;
  if (error) throw new Error(`listRecentNotifications: ${error.message}`);
  return (data || []).filter((r) => r.title); // eventos antigos (de antes dessa coluna existir) não têm título — pula
}

/** Manda uma notificação pra TODOS os dispositivos inscritos; remove inscrições mortas (404/410). */
export async function broadcast({ title, body, url = "/", tag }) {
  ensureConfigured();
  const { data: subs, error } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (error) throw new Error(`broadcast: ${error.message}`);
  if (!subs?.length) return { sent: 0, removed: 0 };

  const payload = JSON.stringify({ title, body, url, tag });
  let sent = 0, removed = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          removed++;
        }
        // outros erros (ex.: rede instável): ignora essa inscrição neste ciclo, não derruba o resto
      }
    })
  );

  return { sent, removed };
}

// ---------- registro de "já notificado" (idempotência entre ciclos do cron) ----------

async function alreadyNotifiedSet(eventType) {
  const { data, error } = await supabase.from("notified_events").select("entity_id").eq("event_type", eventType);
  if (error) throw new Error(`alreadyNotifiedSet(${eventType}): ${error.message}`);
  return new Set((data || []).map((r) => r.entity_id));
}

async function markNotified(ev) {
  // upsert: seguro mesmo se dois ciclos rodarem em cima um do outro (unique cuida disso).
  // Guarda título/corpo/url também — é o que /api/notifications/recent lê pro aviso dentro
  // do app (banner + voz), não só pro push do sistema operacional.
  await supabase.from("notified_events").upsert(
    { event_type: ev.type, entity_id: ev.entityId, title: ev.title, body: ev.body, url: ev.url },
    { onConflict: "event_type,entity_id" }
  );
}

// ---------- Sentinela: chamado novo / reaberto / SLA estourado ou perto de estourar ----------

async function checkSentinelTickets(isFirstRun) {
  const tickets = await listTickets({});
  const { data: snapshotRows, error } = await supabase.from("sentinel_ticket_snapshot").select("ticket_id, status");
  if (error) throw new Error(`checkSentinelTickets: ${error.message}`);
  const snapshotByTicket = new Map((snapshotRows || []).map((r) => [r.ticket_id, r.status]));

  const events = [];
  let notifiedNew = new Set(), notifiedBreach = new Set(), notifiedNear = new Set();
  if (!isFirstRun) {
    [notifiedNew, notifiedBreach, notifiedNear] = await Promise.all([
      alreadyNotifiedSet("ticket_new"),
      alreadyNotifiedSet("ticket_sla_breach"),
      alreadyNotifiedSet("ticket_sla_near"),
    ]);
  }

  const now = Date.now();
  const upserts = [];

  for (const t of tickets) {
    const prevStatus = snapshotByTicket.get(t.id);
    upserts.push({ ticket_id: t.id, status: t.status });

    if (isFirstRun) continue; // 1ª execução: só semeia a snapshot, não notifica nada

    if (prevStatus === undefined) {
      if (!notifiedNew.has(t.id)) {
        events.push({ type: "ticket_new", entityId: t.id, title: "Chamado novo no Sentinela", body: `#${t.display_id} ${t.title}`, url: "/sentinel" });
      }
    } else if (["Resolvido", "Fechado"].includes(prevStatus) && !["Resolvido", "Fechado"].includes(t.status)) {
      events.push({ type: "ticket_reopened", entityId: `${t.id}:${t.updated_at}`, title: "Chamado reaberto no Sentinela", body: `#${t.display_id} ${t.title}`, url: "/sentinel" });
    }

    if (t.response_breached || t.resolution_breached) {
      if (!notifiedBreach.has(t.id)) {
        events.push({ type: "ticket_sla_breach", entityId: t.id, title: "SLA estourado no Sentinela", body: `#${t.display_id} ${t.title}`, url: "/sentinel" });
      }
    } else if (!notifiedNear.has(t.id)) {
      const dueSoon = [t.sla_response_due, t.sla_resolution_due].filter(Boolean).some((d) => {
        const ms = new Date(d).getTime() - now;
        return ms > 0 && ms <= SLA_NEAR_MS;
      });
      if (dueSoon) {
        events.push({ type: "ticket_sla_near", entityId: t.id, title: "Chamado perto de estourar o SLA", body: `#${t.display_id} ${t.title}`, url: "/sentinel" });
      }
    }
  }

  if (upserts.length) {
    const { error: upErr } = await supabase.from("sentinel_ticket_snapshot").upsert(upserts, { onConflict: "ticket_id" });
    if (upErr) throw new Error(`sentinel_ticket_snapshot upsert: ${upErr.message}`);
  }

  return events;
}

// ---------- Trello: card novo / tarefa atrasada ----------
// Direto do Trello (ao vivo, sem SYNC/embeddings) — assim um card criado agora é detectado
// já no próximo tick (5 min), sem esperar o ciclo de SYNC (que só existe pra manter os
// embeddings do Assistente em dia, não pra isso).

async function checkTrelloCards(isFirstRun) {
  const cards = await loadAllTrelloCards({ fresh: true });

  if (isFirstRun) {
    // 1ª execução: só marca os cards atuais como "já vistos", sem notificar nada
    if (cards.length) {
      const rows = cards.map((c) => ({ event_type: "trello_card_new", entity_id: c.id }));
      await supabase.from("notified_events").upsert(rows, { onConflict: "event_type,entity_id" });
    }
    return [];
  }

  const [notifiedNew, notifiedOverdue] = await Promise.all([
    alreadyNotifiedSet("trello_card_new"),
    alreadyNotifiedSet("trello_task_overdue"),
  ]);
  const now = Date.now();
  const events = [];

  for (const c of cards) {
    if (!notifiedNew.has(c.id)) {
      events.push({ type: "trello_card_new", entityId: c.id, title: "Card novo no Trello", body: `${c.title} · ${c.board}`, url: "/" });
    }
    if (c.due && !c.due_complete && new Date(c.due).getTime() < now && !notifiedOverdue.has(c.id)) {
      events.push({ type: "trello_task_overdue", entityId: c.id, title: "Tarefa atrasada no Trello", body: `${c.title} · ${c.board}`, url: "/tasks" });
    }
  }

  return events;
}

// ---------- ponto de entrada do cron ----------

/**
 * Verifica chamados do Sentinela e cards do Trello, notifica o que for novo, e registra
 * cada evento pra não repetir no próximo ciclo. Na 1ª execução (sem nenhum registro/snapshot
 * ainda) só preenche o estado inicial, sem notificar — senão tudo que já existe hoje viraria
 * uma enxurrada de notificações de uma vez.
 */
export async function detectAndNotify() {
  const [{ count: totalNotified }, { count: totalSnapshots }] = await Promise.all([
    supabase.from("notified_events").select("id", { count: "exact", head: true }),
    supabase.from("sentinel_ticket_snapshot").select("ticket_id", { count: "exact", head: true }),
  ]);
  const isFirstRun = (totalNotified || 0) === 0 && (totalSnapshots || 0) === 0;

  const [sentinelEvents, trelloEvents] = await Promise.all([
    checkSentinelTickets(isFirstRun).catch((err) => {
      console.error("[cron/notify] checagem do Sentinela falhou:", err.message);
      return [];
    }),
    checkTrelloCards(isFirstRun).catch((err) => {
      console.error("[cron/notify] checagem do Trello falhou:", err.message);
      return [];
    }),
  ]);
  const events = [...sentinelEvents, ...trelloEvents];

  if (isFirstRun) {
    return { bootstrap: true, sent: 0, events: 0 };
  }

  let sent = 0;
  for (const ev of events) {
    await markNotified(ev);
    try {
      const result = await broadcast({ title: ev.title, body: ev.body, url: ev.url, tag: `${ev.type}:${ev.entityId}` });
      sent += result.sent;
    } catch (err) {
      console.error(`[cron/notify] broadcast falhou pro evento ${ev.type}:${ev.entityId}:`, err.message);
    }
  }

  return { bootstrap: false, sent, events: events.length };
}
