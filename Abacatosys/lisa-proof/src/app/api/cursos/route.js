import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe } from "@/lib/sessao.js";
import { criarCurso } from "@/lib/cursos.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cursos   body: { proposta, diasDeEstudo, inicio? }
 *
 * Cria o quadro STUDY no Abacato com a proposta aprovada (conferida de novo aqui) e já monta a
 * trilha. Respeita o limite de quadros da conta do Abacato.
 */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    const r = await criarCurso({
      usuarioId: usuario.id,
      proposta: corpo?.proposta,
      diasDeEstudo: corpo?.diasDeEstudo,
      inicio: corpo?.inicio,
    });
    return json({ ok: true, ...r }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
