import { supabase } from "@/lib/supabase.js";
import { ingestSlice, buildSyncSteps } from "@/lib/ingest/runSlice.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/sync[?reset=1]
 *
 * Disparado pelo pg_cron + pg_net do Supabase (ver db/cron.sql), NÃO pela Vercel — por isso
 * a autenticação é o MESMO segredo do botão SYNC manual (header x-ingest-secret / ?secret=),
 * não o CRON_SECRET nativo da Vercel (que só é injetado automaticamente em crons cadastrados
 * no vercel.json — não é o caso aqui).
 *
 * Como o plano Hobby da Vercel limita funções a 60s, uma sincronização completa não cabe
 * numa chamada só. Em vez disso, o "loop" fica do lado do Postgres/cron:
 *
 *   - ?reset=1  → chamado 1x por hora (minuto 0): reinicia o progresso e marca 'running'.
 *   - sem reset → chamado a cada minuto: se um ciclo estiver em andamento, avança UMA fatia
 *     (mesmo trabalho que uma chamada do botão SYNC); sem ciclo rodando, é um no-op barato.
 *
 * O progresso mora na tabela public.sync_progress (linha única, id=1 — ver db/schema.sql).
 */
export async function GET(req) {
  const need = (process.env.INGEST_SECRET || "").trim();
  if (need) {
    const u = new URL(req.url);
    const got = req.headers.get("x-ingest-secret") || u.searchParams.get("secret") || "";
    if (got !== need) return json({ ok: false, error: "unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") === "1";
  const now = new Date().toISOString();

  try {
    if (reset) {
      const { error } = await supabase
        .from("sync_progress")
        .update({ status: "running", step_index: 0, offset_val: 0, grand_total: 0, started_at: now, last_error: null, updated_at: now })
        .eq("id", 1);
      if (error) throw new Error(error.message);
      return json({ ok: true, note: "ciclo reiniciado" });
    }

    const { data: progress, error: readErr } = await supabase.from("sync_progress").select("*").eq("id", 1).single();
    if (readErr) throw new Error(readErr.message);
    if (!progress || progress.status !== "running") {
      return json({ ok: true, note: "sem ciclo em andamento" });
    }

    const steps = buildSyncSteps();
    if (!steps.length || progress.step_index >= steps.length) {
      await supabase.from("sync_progress").update({ status: "idle", updated_at: now }).eq("id", 1);
      return json({ ok: true, note: steps.length ? "ciclo já concluído" : "nenhuma fonte configurada (TRELLO_BOARD_IDS vazio)" });
    }

    const step = steps[progress.step_index];
    let report;
    try {
      report = await ingestSlice({ source: step.source, boardIndex: step.boardIndex, offset: progress.offset_val });
    } catch (err) {
      // erro transitório (ex.: quota do Gemini): mantém 'running' no mesmo offset — o
      // próximo tick (até 1 min depois) tenta de novo, sem perder o progresso já feito.
      const msg = String(err?.message || err);
      await supabase.from("sync_progress").update({ last_error: msg, updated_at: now }).eq("id", 1);
      return json({ ok: false, error: msg, step: step.label }, 500);
    }

    const grandTotal = (progress.grand_total || 0) + (report.chunks_processed || 0);
    const isLastStep = progress.step_index + 1 >= steps.length;

    if (report.done && isLastStep) {
      await supabase
        .from("sync_progress")
        .update({ status: "idle", step_index: steps.length, offset_val: 0, grand_total: grandTotal, last_error: null, updated_at: now })
        .eq("id", 1);
      return json({ ok: true, note: "ciclo concluído", step: step.label, grand_total: grandTotal });
    }
    if (report.done) {
      await supabase
        .from("sync_progress")
        .update({ step_index: progress.step_index + 1, offset_val: 0, grand_total: grandTotal, last_error: null, updated_at: now })
        .eq("id", 1);
      return json({ ok: true, note: `passo "${step.label}" concluído`, next_step: steps[progress.step_index + 1]?.label, grand_total: grandTotal });
    }
    await supabase
      .from("sync_progress")
      .update({ offset_val: report.next_offset, grand_total: grandTotal, last_error: null, updated_at: now })
      .eq("id", 1);
    return json({ ok: true, note: `passo "${step.label}" em andamento`, chunks_processed: report.chunks_processed, grand_total: grandTotal });
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
