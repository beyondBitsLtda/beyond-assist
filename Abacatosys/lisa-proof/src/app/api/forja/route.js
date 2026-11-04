import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { forjaDe, forjar } from "@/lib/forja.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/forja — a mana, os artefatos (o que dá para forjar) e o que está fazendo efeito. */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, ...(await forjaDe(usuario.id)) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/forja { item: "pocao" | "escudo" } — forja o artefato com a mana dos estudos. */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const { item } = await corpoDe(req);
    return json({ ok: true, ...(await forjar(usuario.id, String(item || ""))) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
