import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro, corpoDe, ErroDeAcesso } from "@/lib/sessao.js";
import { quadrosDeEstudo, buscarEmLotes, baseDoAbacato } from "@/lib/estudo.js";
import { criarTrilha } from "@/lib/trilhas.js";
import { temModelo } from "@/lib/ia.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/trilhas — os quadros STUDY da pessoa, cada um com a trilha (se já tiver). */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const [quadros, trilhasR] = await Promise.all([
      quadrosDeEstudo(usuario.id),
      supabase.from("proof_trilhas").select("id, quadro_id, inicio_em, gerada_por").eq("usuario_id", usuario.id),
    ]);
    if (trilhasR.error) throw new ErroDeAcesso(500, trilhasR.error.message);
    const trilhaPorQuadro = new Map((trilhasR.data || []).map((t) => [t.quadro_id, t]));

    // Quantos assuntos cada quadro tem, e quantos já estão concluídos.
    const colunas = await buscarEmLotes(
      "abacato_colunas", "id, quadro_id", "quadro_id", quadros.map((q) => q.id), (q) => q.eq("arquivada", false)
    );
    const quadroDaColuna = new Map(colunas.map((c) => [c.id, c.quadro_id]));
    const cards = await buscarEmLotes(
      "abacato_cards", "id, coluna_id, concluido", "coluna_id", colunas.map((c) => c.id), (q) => q.eq("arquivado", false)
    );
    const contagem = new Map();
    for (const c of cards) {
      const q = quadroDaColuna.get(c.coluna_id);
      const atual = contagem.get(q) || { total: 0, feitos: 0 };
      atual.total++;
      if (c.concluido) atual.feitos++;
      contagem.set(q, atual);
    }

    return json({
      ok: true,
      iaDisponivel: temModelo(),
      abacato: baseDoAbacato(),
      quadros: quadros.map((q) => {
        const t = trilhaPorQuadro.get(q.id);
        return {
          id: q.id,
          nome: q.nome,
          tema: q.tema,
          descricao: q.descricao || "",
          assuntos: contagem.get(q.id) || { total: 0, feitos: 0 },
          trilha: t ? { id: t.id, inicioEm: t.inicio_em, geradaPor: t.gerada_por } : null,
        };
      }),
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}

/** POST /api/trilhas   body: { quadroId, diasDeEstudo?, inicio?, usarIa? } */
export async function POST(req) {
  try {
    const usuario = await exigirUsuario(req);
    const corpo = await corpoDe(req);
    if (!corpo?.quadroId) throw new ErroDeAcesso(400, "informe o quadro");
    const r = await criarTrilha({
      usuarioId: usuario.id,
      quadroId: String(corpo.quadroId),
      diasDeEstudo: corpo.diasDeEstudo,
      inicio: corpo.inicio,
      usarIa: corpo.usarIa !== false,
    });
    return json({ ok: true, ...r }, 201);
  } catch (e) {
    return respostaDeErro(e);
  }
}
