import { supabase } from "./supabase.js";
import { buildPrompt, withPersona, withContextDocs } from "./rag.js";
import { chatStream } from "./gemini.js";
import { resolveScope } from "./scopeResolver.js";
import { broadcast } from "./notifications.js";

// Falas agendadas: "às 8h, todo dia, fale/reporte X" — pra TODOS os dispositivos com o app
// aberto. Entrega reaproveita 100% a fila de notified_events que já existe (ver
// src/lib/notifications.js) — uma linha inserida aqui já aparece como banner + é FALADA em
// qualquer aba aberta (NotificationToasts.js) e também dispara o push do sistema operacional
// (broadcast), sem precisar de nenhum mecanismo de entrega novo.

const GRACE_MINUTES = 5; // cron roda a cada 1 min — 5 min cobre folga/jitter sem disparar horas depois se o cron ficou fora do ar
const DAYS = [0, 1, 2, 3, 4, 5, 6];

function sanitize(input, { partial = false } = {}) {
  const row = {};
  if (!partial || input.label !== undefined) {
    if (!input.label?.trim()) throw new Error("label é obrigatório");
    row.label = input.label.trim();
  }
  if (!partial || input.timeOfDay !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(input.timeOfDay || "")) throw new Error("timeOfDay precisa ser HH:MM");
    row.time_of_day = `${input.timeOfDay}:00`;
  }
  if (!partial || input.daysOfWeek !== undefined) {
    const days = Array.isArray(input.daysOfWeek) ? input.daysOfWeek.map(Number).filter((d) => DAYS.includes(d)) : DAYS;
    row.days_of_week = days.length ? days : DAYS;
  }
  if (!partial || input.mode !== undefined) {
    if (!["fixed", "report"].includes(input.mode)) throw new Error('mode precisa ser "fixed" ou "report"');
    row.mode = input.mode;
  }
  if (input.message !== undefined) row.message = input.message?.trim() || null;
  if (input.scope !== undefined) row.scope = input.scope || null;
  if (input.instruction !== undefined) row.instruction = input.instruction?.trim() || null;
  if (input.personaMode !== undefined) row.persona_mode = !!input.personaMode;
  if (input.enabled !== undefined) row.enabled = !!input.enabled;

  const mode = row.mode ?? input.currentMode;
  if (mode === "fixed" && !partial && !row.message) throw new Error('mode "fixed" precisa de message');
  if (mode === "report" && !partial && !row.instruction) throw new Error('mode "report" precisa de instruction');
  return row;
}

export async function listSchedules() {
  const { data, error } = await supabase.from("scheduled_announcements").select("*").order("time_of_day", { ascending: true });
  if (error) throw new Error(`listSchedules: ${error.message}`);
  return data || [];
}

export async function createSchedule(input) {
  const row = sanitize(input);
  const { data, error } = await supabase.from("scheduled_announcements").insert(row).select().single();
  if (error) throw new Error(`createSchedule: ${error.message}`);
  return data;
}

export async function updateSchedule(id, input) {
  const row = sanitize(input, { partial: true });
  const { data, error } = await supabase.from("scheduled_announcements").update(row).eq("id", id).select().single();
  if (error) throw new Error(`updateSchedule: ${error.message}`);
  return data;
}

export async function deleteSchedule(id) {
  const { error } = await supabase.from("scheduled_announcements").delete().eq("id", id);
  if (error) throw new Error(`deleteSchedule: ${error.message}`);
}

/** Gera o texto de UMA fala agendada — `fixed` é literal, `report` roda a instrução contra o
 * escopo configurado (mesmo roteador de escopo do Assistente, ver scopeResolver.js) e devolve
 * o que o Gemini responder. Escolher um escopo aqui, de propósito, já É consentimento — igual
 * ao escopo "Tarefas Delp" no Assistente — não passa por nenhum gate de confirmação. */
async function generateAnnouncementText(row) {
  if (row.mode === "fixed") return (row.message || "").trim();

  const instruction = row.instruction || "Dê um resumo geral do que está pendente.";
  const { matches, systemInstruction, tools, promptNote } = await resolveScope(row.scope || { mode: "auto" }, instruction);
  const prompt = buildPrompt(instruction, matches, promptNote);
  const finalInstruction = withContextDocs(withPersona(systemInstruction, row.persona_mode));
  let full = "";
  for await (const piece of chatStream(prompt, finalInstruction, { tools })) full += piece;
  return full.trim();
}

/** "Agora" em horário de Brasília, pelos getters LOCAIS do Date — funciona porque o runtime
 * da Vercel roda em UTC por padrão (mesmo truque já usado em retrieveByDate, ver rag.js). */
function nowInSaoPaulo() {
  const now = new Date();
  const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = sp.getFullYear(), mo = sp.getMonth(), d = sp.getDate();
  return {
    dateStr: `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    dow: sp.getDay(),
    minutes: sp.getHours() * 60 + sp.getMinutes(),
  };
}

function isDue(row, now) {
  if (row.last_fired_on === now.dateStr) return false; // já disparou hoje
  if (!(row.days_of_week || DAYS).includes(now.dow)) return false;
  const [hh, mm] = String(row.time_of_day).split(":").map(Number);
  const scheduledMinutes = hh * 60 + mm;
  const late = now.minutes - scheduledMinutes;
  return late >= 0 && late <= GRACE_MINUTES;
}

/**
 * Chamado pelo MESMO cron de 1 min que já verifica Sentinela/Trello (ver /api/cron/notify) —
 * verifica se algum agendamento está na hora de disparar e, se sim, gera o texto e insere em
 * notified_events: a partir daí a entrega é automática (banner + voz em qualquer aba aberta,
 * via NotificationToasts.js, e push do sistema operacional, via broadcast).
 */
export async function checkAndFireDueSchedules() {
  const { data: rows, error } = await supabase.from("scheduled_announcements").select("*").eq("enabled", true);
  if (error) throw new Error(`checkAndFireDueSchedules: ${error.message}`);
  if (!rows?.length) return { checked: 0, fired: 0 };

  const now = nowInSaoPaulo();
  let fired = 0;

  for (const row of rows) {
    if (!isDue(row, now)) continue;
    try {
      const text = await generateAnnouncementText(row);
      if (!text) { console.error(`[scheduledAnnouncements] #${row.id} (${row.label}) gerou texto vazio — pulando disparo`); continue; }

      await supabase.from("notified_events").upsert(
        { event_type: "scheduled_announcement", entity_id: `${row.id}:${now.dateStr}`, title: `⏰ ${row.label}`, body: text, url: "/scheduled-announcements" },
        { onConflict: "event_type,entity_id" }
      );
      await supabase.from("scheduled_announcements").update({ last_fired_on: now.dateStr }).eq("id", row.id);

      // push do sistema operacional — mesmo canal que Sentinela/Trello já usam. Não trava o
      // disparo se falhar (aviso dentro do app já foi garantido pelo upsert acima).
      broadcast({ title: `⏰ ${row.label}`, body: text, url: "/scheduled-announcements", tag: `scheduled:${row.id}:${now.dateStr}` }).catch(() => {});

      fired++;
    } catch (err) {
      console.error(`[scheduledAnnouncements] falha ao disparar #${row.id} (${row.label}):`, err.message);
    }
  }

  return { checked: rows.length, fired };
}
