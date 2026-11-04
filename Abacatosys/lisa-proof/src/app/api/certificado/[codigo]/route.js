import { json } from "@/lib/http.js";
import { respostaDeErro } from "@/lib/sessao.js";
import { certificadoPublico } from "@/lib/dominio.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/certificado/:codigo — SEM login: quem recebe o certificado confere que ele existe. */
export async function GET(_req, { params }) {
  try {
    const { codigo } = await params;
    return json({ ok: true, certificado: await certificadoPublico(codigo) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
