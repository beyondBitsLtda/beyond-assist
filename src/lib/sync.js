/**
 * Reindexação completa (Trello + Beyond Brain) via /api/ingest, em fatias com paginação
 * (respeita quota do Gemini e o limite de 60s por função da Vercel). Extraído do Topbar
 * pra ser reaproveitado pelo botão "↻ ATUALIZAR" de cada painel — sempre que o usuário pede
 * pra atualizar uma aba, ela primeiro puxa dado fresco de verdade (não só re-lê o Supabase).
 *
 * Chamado só pelo navegador (usa localStorage). Ver também src/app/api/cron/sync/route.js,
 * que faz o mesmo ciclo de forma automática/agendada (Supabase pg_cron), passo a passo.
 */
export async function runFullSync({ onProgress } = {}) {
  const secret = typeof window !== "undefined" ? (localStorage.getItem("ingestSecret") || "") : "";
  const headers = secret ? { "x-ingest-secret": secret } : {};
  const boardCount = 4;
  const sources = [
    ...Array.from({ length: boardCount }, (_, i) => ({ label: `board ${i + 1}/${boardCount}`, source: "trello", extra: `&boardIndex=${i}` })),
    { label: "brain (notas)", source: "brain", extra: "" },
  ];

  let grandTotal = 0;
  for (const src of sources) {
    let offset = 0;
    let pageNum = 1;
    while (true) {
      onProgress?.({ type: "start", label: src.label, pageNum, offset });
      try {
        const res = await fetch(`/api/ingest?source=${src.source}${src.extra}&offset=${offset}`, {
          method: "POST",
          headers,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          onProgress?.({ type: "error", label: src.label, message: data.errors?.[0]?.slice(0, 80) || String(res.status) });
          break;
        }
        grandTotal += data.chunks_processed || 0;
        onProgress?.({ type: "chunk", label: src.label, pageNum, processed: data.chunks_processed, total: data.chunks_total });
        if (data.done) break;
        offset = data.next_offset;
        pageNum++;
      } catch (err) {
        onProgress?.({ type: "error", label: src.label, message: err.message });
        break;
      }
    }
  }
  onProgress?.({ type: "finished", grandTotal });
  return grandTotal;
}
