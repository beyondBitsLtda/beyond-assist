import { setRepoEnabled } from "@/lib/ingest/github.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/code-repos/:id   body: { enabled: boolean } */
export async function PATCH(req, { params }) {
  try {
    const { enabled } = await req.json();
    await setRepoEnabled(params.id, enabled);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 400);
  }
}
