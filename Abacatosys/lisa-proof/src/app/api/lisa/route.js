import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro } from "@/lib/sessao.js";
import { perfilDaLisa } from "@/lib/lisaJogadora.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/lisa — a Lisa jogadora (BEYOND-0014), para todos verem: reino, cursos, raio-x, Bolsa, cadernos, Acervo e o diário. */
export async function GET(req) {
  try {
    await exigirUsuario(req);
    return json({ ok: true, ...(await perfilDaLisa()) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
