import { supabase } from "@/lib/supabase.js";
import { buildSyncSteps } from "@/lib/ingest/runSlice.js";
import { listGithubRepos } from "@/lib/ingest/github.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sync-status — só leitura, sem segredo (não dispara nada, não expõe nada sensível).
 * Reflete o progresso do SYNC AUTOMÁTICO (pg_cron do Supabase — ver src/app/api/cron/sync/route.js
 * e db/cron.sql), não do botão SYNC manual (que não grava em sync_progress).
 *
 * Além do progresso bruto (compat com o indicador pequeno que já existia), devolve o
 * detalhamento pro painel /sync-status: quantos pedaços cada fonte/repositório já tem
 * indexado de verdade (tabela documents), e qual passo está rodando agora.
 */
export async function GET() {
  try {
    const { data: progress, error } = await supabase.from("sync_progress").select("*").eq("id", 1).single();
    if (error) throw new Error(error.message);

    const steps = await buildSyncSteps().catch(() => []);
    const currentStepLabel = steps[progress.step_index]?.label || null;

    const { data: countRows } = await supabase.rpc("document_counts");
    const countMap = new Map((countRows || []).map((r) => [`${r.source}:${r.board}`, Number(r.cnt)]));
    const sourceTotalsMap = new Map();
    for (const r of countRows || []) sourceTotalsMap.set(r.source, (sourceTotalsMap.get(r.source) || 0) + Number(r.cnt));
    const sourceTotals = [...sourceTotalsMap.entries()].map(([source, total]) => ({ source, total }));

    const allRepos = await listGithubRepos().catch(() => []);
    const enabledRepos = allRepos.filter((r) => r.enabled);
    const githubStepStart = steps.findIndex((s) => s.source === "github");
    const repos = allRepos.map((r) => {
      const idxAmongEnabled = enabledRepos.findIndex((e) => e.id === r.id);
      const absoluteStepIndex = r.enabled && githubStepStart >= 0 && idxAmongEnabled >= 0 ? githubStepStart + idxAmongEnabled : -1;
      return {
        full_name: r.full_name,
        enabled: r.enabled,
        indexed_count: countMap.get(`github:${r.full_name}`) || 0,
        isCurrent: progress.status === "running" && absoluteStepIndex >= 0 && absoluteStepIndex === progress.step_index,
      };
    });

    return jsonResponse({ ok: true, ...progress, currentStepLabel, totalSteps: steps.length, sourceTotals, repos });
  } catch (err) {
    // tabela pode não existir ainda (db/schema.sql não rodado) — não é um erro fatal pro HUD
    return jsonResponse({ ok: false, error: String(err?.message || err) });
  }
}
