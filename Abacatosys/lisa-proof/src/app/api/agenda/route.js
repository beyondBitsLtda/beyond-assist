import { json } from "@/lib/http.js";
import { supabase } from "@/lib/supabase.js";
import { exigirUsuario, respostaDeErro, ErroDeAcesso } from "@/lib/sessao.js";
import { avancoDasTrilhas } from "@/lib/avanco.js";
import { buscarTodas } from "@/lib/estudo.js";
import { diaDe, diaValido, diasEntre } from "@/dominio/datas.js";
import { montarAgenda, corDaTrilha } from "@/dominio/agenda.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agenda?de=AAAA-MM-DD&ate=AAAA-MM-DD
 *
 * Os compromissos de todas as trilhas ativas no período — assuntos, entregas de projeto, quiz e
 * exercício — mais os atrasados de antes e os dias em que houve estudo (o 🔥 do calendário).
 */
export async function GET(req) {
  try {
    const usuario = await exigirUsuario(req);
    const url = new URL(req.url);
    const de = url.searchParams.get("de");
    const ate = url.searchParams.get("ate");
    if (!diaValido(de) || !diaValido(ate) || ate < de) throw new ErroDeAcesso(400, "informe de e ate (AAAA-MM-DD)");
    if (diasEntre(de, ate) > 180) throw new ErroDeAcesso(400, "período grande demais (até 180 dias)");
    const hoje = diaDe();

    // A ordem de criação fixa a cor de cada trilha: a mesma trilha não muda de cor entre visitas.
    const { data: trilhas, error } = await supabase
      .from("proof_trilhas").select("id, tema, inicio_em, dias_de_estudo").eq("usuario_id", usuario.id).eq("status", "ativa").order("criada_em");
    if (error) throw new ErroDeAcesso(500, error.message);
    const lista = trilhas || [];
    const ids = lista.map((t) => t.id);

    const [avancos, diarios, eventos] = await Promise.all([
      // as etapas (com o assunto concluído pela teoria + quiz) e as semanas do plano com os projetos delas
      avancoDasTrilhas(lista, hoje),
      ids.length
        ? supabase.from("proof_desafios").select("id, trilha_id, tipo, periodo, rodada, status, nota, titulo")
            .eq("usuario_id", usuario.id).in("tipo", ["quiz", "exercicio"]).gte("periodo", de).lte("periodo", ate)
        : { data: [] },
      buscarTodas(() => supabase.from("proof_eventos").select("dia").eq("usuario_id", usuario.id).gte("dia", de).lte("dia", ate)),
    ]);
    if (diarios.error) throw new ErroDeAcesso(500, diarios.error.message);
    const etapas = new Map(lista.map((t) => [t.id, avancos.get(t.id)?.etapas || []]));
    const semanas = new Map(lista.map((t) => [t.id, avancos.get(t.id)?.unidades || []]));

    const desafios = (diarios.data || []).map((d) => ({
      id: d.id, trilhaId: d.trilha_id, tipo: d.tipo, periodo: d.periodo, rodada: d.rodada, status: d.status, nota: d.nota, titulo: d.titulo,
    }));

    return json({
      ok: true,
      hoje,
      de,
      ate,
      trilhas: lista.map((t, i) => ({ id: t.id, tema: t.tema, cor: corDaTrilha(i) })),
      itens: montarAgenda({ trilhas: lista, etapas, semanas, desafios, hoje, de, ate }),
      diasEstudados: [...new Set(eventos.map((e) => e.dia))],
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
