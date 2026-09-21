import { json } from "@/lib/http.js";
import { respostaDeErro } from "@/lib/acesso.js";
import { exigirAdmin } from "@/lib/admin.js";
import { criarConvite, listarConvites } from "@/lib/convites.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/convites — os links de cadastro. Só quem administra: o token está na resposta, e
 *  ele é a única coisa entre a internet e um formulário de cadastro. */
export async function GET(req) {
  try {
    await exigirAdmin(req);
    return json({ ok: true, convites: await listarConvites() });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/convites   body: { rotulo?, tipo?, dias?, maxUsos? } */
export async function POST(req) {
  try {
    const admin = await exigirAdmin(req);
    const { rotulo, tipo, dias, maxUsos } = await req.json().catch(() => ({}));
    const convite = await criarConvite({ criadoPor: admin.id, rotulo, tipo, dias, maxUsos });
    return json({ ok: true, convite }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
