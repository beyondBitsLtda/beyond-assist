import { getArchDocHtml } from "@/lib/archDocs.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/arch-docs/:id/html — devolve o documento final PRONTO (text/html), pra abrir
 * direto no navegador (link "abrir" na tela /arch-docs) ou salvar como arquivo. */
export async function GET(req, { params }) {
  try {
    const doc = await getArchDocHtml(params.id);
    if (doc.status !== "done" || !doc.html) {
      return new Response("Este mapa de arquitetura ainda não terminou de ser gerado.", {
        status: 409,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return new Response(doc.html, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (err) {
    return new Response(String(err?.message || err), {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
