import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { quemEh, respostaDeErro, ErroDeAcesso } from "@/lib/acesso.js";
import { poderesDo } from "@/dominio/Quadro.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/destinos — para onde este card ou esta coluna pode ir.
 *
 * Os quadros em que você pode CRIAR, cada um com suas colunas. É o que alimenta os dois
 * seletores de "mover para" e "copiar para".
 *
 * Só quadros onde você pode criar. Listar os que você só lê encheria o seletor de destinos
 * que dariam 403 no clique — e a pessoa culparia o sistema, com razão: ele ofereceu.
 */
export async function GET(req) {
  try {
    const usuario = await quemEh(req);
    if (!usuario) throw new ErroDeAcesso(401, "sem sessão");

    const [{ data: meus }, { data: membroDe }] = await Promise.all([
      supabase.from("abacato_quadros").select("id, nome").eq("dono_id", usuario.id).eq("arquivado", false),
      supabase.from("abacato_membros")
        .select("papel, abacato_quadros ( id, nome, arquivado )").eq("usuario_id", usuario.id),
    ]);

    const podeCriar = new Map();
    for (const q of meus || []) podeCriar.set(q.id, q.nome);
    for (const m of membroDe || []) {
      const q = m.abacato_quadros;
      if (!q || q.arquivado || podeCriar.has(q.id)) continue;
      if (poderesDo(m.papel).criar) podeCriar.set(q.id, q.nome);
    }
    if (!podeCriar.size) return json({ ok: true, quadros: [] });

    const { data: colunas } = await supabase
      .from("abacato_colunas").select("id, nome, quadro_id, posicao")
      .in("quadro_id", [...podeCriar.keys()]).eq("arquivada", false).order("posicao");

    const porQuadro = new Map();
    for (const c of colunas || []) {
      if (!porQuadro.has(c.quadro_id)) porQuadro.set(c.quadro_id, []);
      porQuadro.get(c.quadro_id).push({ id: c.id, nome: c.nome });
    }

    const quadros = [...podeCriar.entries()]
      .map(([id, nome]) => ({ id, nome, colunas: porQuadro.get(id) || [] }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return json({ ok: true, quadros });
  } catch (e) {
    return respostaDeErro(e);
  }
}
