import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { projetosDe, criarProjeto } from "@/lib/ide.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ide/projetos — os projetos da IDE livre da pessoa (sem os arquivos). */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    return json({ ok: true, projetos: await projetosDe(usuario.id) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/ide/projetos  { nome, modelo } — cria um projeto a partir de um modelo (src/dominio/ide.js). */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    return json({ ok: true, projeto: await criarProjeto(usuario.id, { nome: corpo?.nome, modelo: corpo?.modelo }) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
