import { json } from "@/lib/http.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { proporCurso } from "@/lib/iaCurso.js";
import { temModelo } from "@/lib/ia.js";
import { assuntosParaODuracao, resumoDoCurso, NIVEIS_DO_CURSO, DURACOES_EM_SEMANAS } from "@/dominio/curso.js";
import { normalizarDiasDeEstudo } from "@/dominio/plano.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cursos/proposta   body: { tema, nivel, objetivo?, semanas, diasDeEstudo }
 *
 * A Lisa propõe o curso. NÃO grava nada: a pessoa vê a proposta antes, e só a rota /api/cursos
 * cria o quadro. Pode levar de 20 a 60 segundos (é um curso inteiro).
 */
export async function POST(req) {
  try {
    await exigirUsuario(req);
    if (!temModelo()) throw new ErroDeAcesso(503, "a IA não está configurada neste servidor");
    const corpo = await corpoDe(req);

    const tema = String(corpo?.tema || "").replace(/\s+/g, " ").trim();
    if (tema.length < 2 || tema.length > 80) throw new ErroDeAcesso(400, "informe o tema do curso (até 80 caracteres)");
    const nivel = NIVEIS_DO_CURSO[corpo?.nivel] ? corpo.nivel : "iniciante";
    const semanas = DURACOES_EM_SEMANAS.includes(Number(corpo?.semanas)) ? Number(corpo.semanas) : 4;
    const dias = normalizarDiasDeEstudo(corpo?.diasDeEstudo);
    const objetivo = String(corpo?.objetivo || "").replace(/\s+/g, " ").trim().slice(0, 400);

    let r;
    try {
      r = await proporCurso({
        tema, nivel, objetivo, semanas,
        assuntos: assuntosParaODuracao(semanas, dias.length),
        dias: semanas * dias.length,
      });
    } catch (e) {
      throw new ErroDeAcesso(502, e.message);
    }
    if (!r.ok) throw new ErroDeAcesso(502, r.erros.join("; "));
    return json({ ok: true, proposta: r.proposta, resumo: resumoDoCurso(r.proposta) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
