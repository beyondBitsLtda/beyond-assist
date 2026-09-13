import { saveSubscription, removeSubscription } from "@/lib/notifications.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/notifications/subscribe   body: { subscription: PushSubscriptionJSON } */
export async function POST(req) {
  try {
    const { subscription } = await req.json();
    await saveSubscription(subscription);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

/** DELETE /api/notifications/subscribe   body: { endpoint: string } — usuário desativou. */
export async function DELETE(req) {
  try {
    const { endpoint } = await req.json();
    await removeSubscription(endpoint);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
